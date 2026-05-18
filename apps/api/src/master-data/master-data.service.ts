import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DefectReason,
  OperatorEmploymentType,
  OperatorProfile,
  Prisma,
  ProductionLine,
  Role,
  SpecialBarcode,
  SpecialBarcodeType,
  User
} from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { pinyin } from 'pinyin-pro';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDefectReasonDto,
  CreateManagedUserDto,
  CreateOperatorProfileDto,
  CreateProductionLineDto,
  CreateSpecialBarcodeDto,
  ImportOperatorProfilesDto,
  ResetManagedUserPasswordDto,
  UpdateDefectReasonDto,
  UpdateManagedUserDto,
  UpdateOperatorProfileDto,
  UpdateProductionLineDto,
  UpdateSpecialBarcodeDto
} from './dto/master-data.dto';

type ManagedUser = Omit<User, 'passwordHash'> & {
  inspectionRecordCount: number;
  sessionCount: number;
  referenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
};

type ManagedDefectReason = Omit<DefectReason, 'deductionAmount'> & {
  deductionAmount: number;
  inspectionRecordCount: number;
  specialBarcodeCount: number;
  referenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type ManagedOperatorProfile = OperatorProfile & {
  inspectionRecordCount: number;
  referenced: boolean;
  canDelete: boolean;
};

type ManagedProductionLine = ProductionLine & {
  inspectionRecordCount: number;
  sessionCount: number;
  referenced: boolean;
  canDelete: boolean;
};

type ManagedSpecialBarcode = SpecialBarcode & {
  defectReason: DefectReason | null;
  inspectionRecordCount: number;
  referenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(): Promise<ManagedUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { username: 'asc' },
      include: {
        _count: {
          select: {
            inspectionRecords: true,
            sessions: true
          }
        }
      }
    });

    return users.map((user) => this.toManagedUser(user));
  }

  async createUser(dto: CreateManagedUserDto): Promise<ManagedUser> {
    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        passwordHash: await argon2.hash(dto.password),
        role: dto.role,
        isActive: dto.isActive ?? true,
        mustChangePassword: true
      },
      include: this.userCounts
    });

    return this.toManagedUser(user);
  }

  async updateUser(id: string, dto: UpdateManagedUserDto): Promise<ManagedUser> {
    const current = await this.ensureUser(id);

    if (current.username === 'admin') {
      throw new BadRequestException({
        code: 'ADMIN_ACCOUNT_EDIT_NOT_ALLOWED',
        message: 'admin账户禁止编辑'
      });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.username !== undefined ? { username: dto.username.trim() } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: this.userCounts
    });

    return this.toManagedUser(user);
  }

  async resetUserPassword(id: string, dto: ResetManagedUserPasswordDto): Promise<void> {
    const user = await this.ensureUser(id);

    if (user.role === Role.ADMIN) {
      throw new BadRequestException({
        code: 'ADMIN_PASSWORD_RESET_NOT_ALLOWED',
        message: '管理员密码不能通过主数据重置'
      });
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(dto.password),
        mustChangePassword: true
      }
    });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userCounts
    });

    if (!user) {
      throw this.notFound('USER_NOT_FOUND', '用户不存在');
    }

    if (user._count.inspectionRecords > 0 || user._count.sessions > 0) {
      throw new ConflictException({
        code: 'USER_REFERENCED',
        message: '用户已有检验记录或会话，不能删除，可停用'
      });
    }

    await this.prisma.user.delete({ where: { id } });
  }

  async listDefectReasons(): Promise<ManagedDefectReason[]> {
    const reasons = await this.prisma.defectReason.findMany({
      orderBy: { code: 'asc' },
      include: this.defectReasonCounts
    });

    return reasons.map((reason) => this.toManagedDefectReason(reason));
  }

  async createDefectReason(dto: CreateDefectReasonDto): Promise<ManagedDefectReason> {
    const reason = await this.prisma.defectReason.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        deductionAmount: dto.deductionAmount ?? 0,
        isActive: dto.isActive ?? true
      },
      include: this.defectReasonCounts
    });

    return this.toManagedDefectReason(reason);
  }

  async updateDefectReason(id: string, dto: UpdateDefectReasonDto): Promise<ManagedDefectReason> {
    const reason = await this.prisma.defectReason.findUnique({
      where: { id },
      include: this.defectReasonCounts
    });

    if (!reason) {
      throw this.notFound('DEFECT_REASON_NOT_FOUND', '缺陷原因不存在');
    }

    const referenced = this.defectReasonReferenced(reason);
    const changesIdentity = dto.code !== undefined || dto.name !== undefined;

    if (referenced && changesIdentity) {
      throw new ConflictException({
        code: 'DEFECT_REASON_REFERENCED',
        message: '缺陷原因已被引用，不能编辑或删除，只能停用'
      });
    }

    const updated = await this.prisma.defectReason.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.deductionAmount !== undefined ? { deductionAmount: dto.deductionAmount } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: this.defectReasonCounts
    });

    return this.toManagedDefectReason(updated);
  }

  async listOperatorProfiles(): Promise<ManagedOperatorProfile[]> {
    const operators = await this.prisma.operatorProfile.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: this.operatorProfileCounts
    });

    return operators.map((operator) => this.toManagedOperatorProfile(operator));
  }

  async searchActiveOperatorProfiles(query: string): Promise<ManagedOperatorProfile[]> {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return [];
    }

    const operators = await this.prisma.operatorProfile.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: keyword } },
          { employeeCode: { contains: keyword } },
          { pinyinInitials: { contains: keyword } }
        ]
      },
      orderBy: [{ name: 'asc' }],
      include: this.operatorProfileCounts,
      take: 20
    });

    return operators.map((operator) => this.toManagedOperatorProfile(operator));
  }

  async createOperatorProfile(dto: CreateOperatorProfileDto): Promise<ManagedOperatorProfile> {
    const operator = await this.prisma.operatorProfile.create({
      data: this.toOperatorProfileData(dto),
      include: this.operatorProfileCounts
    });

    return this.toManagedOperatorProfile(operator);
  }

  async updateOperatorProfile(id: string, dto: UpdateOperatorProfileDto): Promise<ManagedOperatorProfile> {
    await this.ensureOperatorProfile(id);

    const nextName = dto.name?.trim();
    const operator = await this.prisma.operatorProfile.update({
      where: { id },
      data: {
        ...(dto.employeeCode !== undefined ? { employeeCode: dto.employeeCode.trim() || null } : {}),
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(dto.pinyinInitials !== undefined || nextName !== undefined
          ? { pinyinInitials: normalizeInitials(dto.pinyinInitials, nextName) }
          : {}),
        ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: this.operatorProfileCounts
    });

    return this.toManagedOperatorProfile(operator);
  }

  async importOperatorProfiles(dto: ImportOperatorProfilesDto): Promise<{ created: number; updated: number }> {
    const rows = dto.rows ?? [];
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const data = this.toOperatorProfileData(row);
      if (data.employeeCode) {
        const existing = await this.prisma.operatorProfile.findUnique({
          where: { employeeCode: data.employeeCode }
        });

        if (existing) {
          await this.prisma.operatorProfile.update({
            where: { id: existing.id },
            data
          });
          updated += 1;
          continue;
        }
      }

      await this.prisma.operatorProfile.create({ data });
      created += 1;
    }

    return { created, updated };
  }

  async deleteOperatorProfile(id: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id },
      include: this.operatorProfileCounts
    });

    if (!operator) {
      throw this.notFound('OPERATOR_PROFILE_NOT_FOUND', '操作工档案不存在');
    }

    if (operator._count.inspectionRecords > 0) {
      throw new ConflictException({
        code: 'OPERATOR_PROFILE_REFERENCED',
        message: '操作工已有检验记录，不能删除，可停用'
      });
    }

    await this.prisma.operatorProfile.delete({ where: { id } });
  }

  async deleteDefectReason(id: string): Promise<void> {
    const reason = await this.prisma.defectReason.findUnique({
      where: { id },
      include: this.defectReasonCounts
    });

    if (!reason) {
      throw this.notFound('DEFECT_REASON_NOT_FOUND', '缺陷原因不存在');
    }

    if (this.defectReasonReferenced(reason)) {
      throw new ConflictException({
        code: 'DEFECT_REASON_REFERENCED',
        message: '缺陷原因已被引用，不能编辑或删除，只能停用'
      });
    }

    await this.prisma.defectReason.delete({ where: { id } });
  }

  async listProductionLines(): Promise<ManagedProductionLine[]> {
    const lines = await this.prisma.productionLine.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: this.productionLineCounts
    });

    return lines.map((line) => this.toManagedProductionLine(line));
  }

  async createProductionLine(dto: CreateProductionLineDto): Promise<ManagedProductionLine> {
    const line = await this.prisma.productionLine.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true
      },
      include: this.productionLineCounts
    });

    return this.toManagedProductionLine(line);
  }

  async updateProductionLine(id: string, dto: UpdateProductionLineDto): Promise<ManagedProductionLine> {
    await this.ensureProductionLine(id);

    const line = await this.prisma.productionLine.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: this.productionLineCounts
    });

    return this.toManagedProductionLine(line);
  }

  async deleteProductionLine(id: string): Promise<void> {
    const line = await this.prisma.productionLine.findUnique({
      where: { id },
      include: this.productionLineCounts
    });

    if (!line) {
      throw this.notFound('PRODUCTION_LINE_NOT_FOUND', '产线不存在');
    }

    if (line._count.inspectionRecords > 0 || line._count.sessions > 0) {
      throw new ConflictException({
        code: 'PRODUCTION_LINE_REFERENCED',
        message: '产线已有检验记录或会话，不能删除，可停用'
      });
    }

    await this.prisma.productionLine.delete({ where: { id } });
  }

  generateSpecialBarcode(): { barcode: string } {
    return { barcode: randomUUID() };
  }

  async listSpecialBarcodes(): Promise<ManagedSpecialBarcode[]> {
    const specialBarcodes = await this.prisma.specialBarcode.findMany({
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      include: {
        defectReason: true
      }
    });

    return Promise.all(specialBarcodes.map((specialBarcode) => this.toManagedSpecialBarcode(specialBarcode)));
  }

  async createSpecialBarcode(dto: CreateSpecialBarcodeDto): Promise<ManagedSpecialBarcode> {
    await this.validateSpecialBarcodeInput(dto.type, dto);

    const created = await this.prisma.specialBarcode.create({
      data: this.toSpecialBarcodeData(dto.type, dto),
      include: {
        defectReason: true
      }
    });

    return this.toManagedSpecialBarcode(created);
  }

  async updateSpecialBarcode(id: string, dto: UpdateSpecialBarcodeDto): Promise<ManagedSpecialBarcode> {
    const current = await this.prisma.specialBarcode.findUnique({
      where: { id },
      include: {
        defectReason: true
      }
    });

    if (!current) {
      throw this.notFound('SPECIAL_BARCODE_NOT_FOUND', '特殊条码不存在');
    }

    const referenced = await this.specialBarcodeReferenced(current.barcode);
    const changesIdentity =
      dto.barcode !== undefined ||
      dto.vehicleModel !== undefined ||
      dto.partNumber !== undefined ||
      dto.defectReasonId !== undefined;

    if (referenced && changesIdentity) {
      throw new ConflictException({
        code: 'SPECIAL_BARCODE_REFERENCED',
        message: '特殊条码已被引用，不能编辑或删除，只能停用'
      });
    }

    await this.validateSpecialBarcodeInput(current.type, {
      ...current,
      ...dto,
      barcode: dto.barcode ?? current.barcode,
      defectReasonId: dto.defectReasonId ?? current.defectReasonId ?? undefined,
      vehicleModel: dto.vehicleModel ?? current.vehicleModel ?? undefined,
      partNumber: dto.partNumber ?? current.partNumber ?? undefined
    });

    const updated = await this.prisma.specialBarcode.update({
      where: { id },
      data: {
        ...(dto.barcode !== undefined ? { barcode: dto.barcode.trim() } : {}),
        ...(dto.vehicleModel !== undefined ? { vehicleModel: dto.vehicleModel.trim() || null } : {}),
        ...(dto.partNumber !== undefined ? { partNumber: dto.partNumber.trim() || null } : {}),
        ...(dto.defectReasonId !== undefined ? { defectReasonId: dto.defectReasonId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: {
        defectReason: true
      }
    });

    return this.toManagedSpecialBarcode(updated);
  }

  async deleteSpecialBarcode(id: string): Promise<void> {
    const specialBarcode = await this.prisma.specialBarcode.findUnique({ where: { id } });
    if (!specialBarcode) {
      throw this.notFound('SPECIAL_BARCODE_NOT_FOUND', '特殊条码不存在');
    }

    if (await this.specialBarcodeReferenced(specialBarcode.barcode)) {
      throw new ConflictException({
        code: 'SPECIAL_BARCODE_REFERENCED',
        message: '特殊条码已被引用，不能编辑或删除，只能停用'
      });
    }

    await this.prisma.specialBarcode.delete({ where: { id } });
  }

  private async ensureUser(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw this.notFound('USER_NOT_FOUND', '用户不存在');
    }
    return user;
  }

  private async ensureProductionLine(id: string): Promise<ProductionLine> {
    const line = await this.prisma.productionLine.findUnique({ where: { id } });
    if (!line) {
      throw this.notFound('PRODUCTION_LINE_NOT_FOUND', '产线不存在');
    }
    return line;
  }

  private async ensureOperatorProfile(id: string): Promise<OperatorProfile> {
    const operator = await this.prisma.operatorProfile.findUnique({ where: { id } });
    if (!operator) {
      throw this.notFound('OPERATOR_PROFILE_NOT_FOUND', '操作工档案不存在');
    }
    return operator;
  }

  private toManagedUser(user: User & { _count: { inspectionRecords: number; sessions: number } }): ManagedUser {
    const { passwordHash: _passwordHash, _count, ...publicUser } = user;
    const referenced = _count.inspectionRecords > 0 || _count.sessions > 0;
    return {
      ...publicUser,
      inspectionRecordCount: _count.inspectionRecords,
      sessionCount: _count.sessions,
      referenced,
      canEdit: user.username !== 'admin',
      canDelete: !referenced,
      canResetPassword: user.role !== Role.ADMIN
    };
  }

  private toManagedDefectReason(
    reason: DefectReason & { _count: { inspectionRecordLinks: number; specialBarcodes: number } }
  ): ManagedDefectReason {
    const referenced = this.defectReasonReferenced(reason);
    return {
      ...reason,
      deductionAmount: decimalToNumber(reason.deductionAmount),
      inspectionRecordCount: reason._count.inspectionRecordLinks,
      specialBarcodeCount: reason._count.specialBarcodes,
      referenced,
      canEdit: !referenced,
      canDelete: !referenced
    };
  }

  private toManagedOperatorProfile(
    operator: OperatorProfile & { _count: { inspectionRecords: number } }
  ): ManagedOperatorProfile {
    const referenced = operator._count.inspectionRecords > 0;
    return {
      ...operator,
      inspectionRecordCount: operator._count.inspectionRecords,
      referenced,
      canDelete: !referenced
    };
  }

  private toOperatorProfileData(
    dto: CreateOperatorProfileDto
  ): Prisma.OperatorProfileUncheckedCreateInput {
    const name = dto.name.trim();
    const employmentType = dto.employmentType;

    if (employmentType !== OperatorEmploymentType.FORMAL && employmentType !== OperatorEmploymentType.LABOR) {
      throw new BadRequestException({
        code: 'OPERATOR_EMPLOYMENT_TYPE_INVALID',
        message: '操作工类型无效'
      });
    }

    return {
      employeeCode: dto.employeeCode?.trim() || null,
      name,
      pinyinInitials: normalizeInitials(dto.pinyinInitials, name),
      employmentType,
      isActive: dto.isActive ?? true
    };
  }

  private toManagedProductionLine(
    line: ProductionLine & { _count: { inspectionRecords: number; sessions: number } }
  ): ManagedProductionLine {
    const referenced = line._count.inspectionRecords > 0 || line._count.sessions > 0;
    return {
      ...line,
      inspectionRecordCount: line._count.inspectionRecords,
      sessionCount: line._count.sessions,
      referenced,
      canDelete: !referenced
    };
  }

  private async toManagedSpecialBarcode(
    specialBarcode: SpecialBarcode & { defectReason: DefectReason | null }
  ): Promise<ManagedSpecialBarcode> {
    const inspectionRecordCount = await this.prisma.inspectionRecord.count({
      where: { barcode: specialBarcode.barcode }
    });
    const referenced = inspectionRecordCount > 0;

    return {
      ...specialBarcode,
      inspectionRecordCount,
      referenced,
      canEdit: !referenced,
      canDelete: !referenced
    };
  }

  private async validateSpecialBarcodeInput(
    type: SpecialBarcodeType,
    data: {
      barcode: string;
      vehicleModel?: string | null;
      partNumber?: string | null;
      defectReasonId?: string | null;
    }
  ): Promise<void> {
    if (!data.barcode.trim()) {
      throw new BadRequestException({
        code: 'SPECIAL_BARCODE_REQUIRED',
        message: '特殊条码不能为空'
      });
    }

    if (type === SpecialBarcodeType.DIRTY) {
      if (!data.defectReasonId) {
        throw new BadRequestException({
          code: 'DIRTY_BARCODE_REASON_REQUIRED',
          message: '条码污损配置必须关联缺陷原因'
        });
      }

      const reason = await this.prisma.defectReason.findUnique({
        where: { id: data.defectReasonId }
      });
      if (!reason || reason.code !== 'BARCODE_DAMAGED') {
        throw new BadRequestException({
          code: 'DIRTY_BARCODE_REASON_INVALID',
          message: '条码污损配置必须关联“条码污损”缺陷原因'
        });
      }
      return;
    }

    if (!data.vehicleModel?.trim() || !data.partNumber?.trim()) {
      throw new BadRequestException({
        code: 'NO_BARCODE_PRODUCT_INFO_REQUIRED',
        message: '无条码产品必须填写车型和零件号'
      });
    }
  }

  private toSpecialBarcodeData(type: SpecialBarcodeType, dto: CreateSpecialBarcodeDto): Prisma.SpecialBarcodeUncheckedCreateInput {
    if (type === SpecialBarcodeType.DIRTY) {
      return {
        type,
        barcode: dto.barcode.trim(),
        defectReasonId: dto.defectReasonId,
        vehicleModel: null,
        partNumber: null,
        isActive: dto.isActive ?? true
      };
    }

    return {
      type,
      barcode: dto.barcode.trim(),
      defectReasonId: null,
      vehicleModel: dto.vehicleModel?.trim() || null,
      partNumber: dto.partNumber?.trim() || null,
      isActive: dto.isActive ?? true
    };
  }

  private async specialBarcodeReferenced(barcode: string): Promise<boolean> {
    const count = await this.prisma.inspectionRecord.count({ where: { barcode } });
    return count > 0;
  }

  private defectReasonReferenced(reason: { _count: { inspectionRecordLinks: number; specialBarcodes: number } }): boolean {
    return reason._count.inspectionRecordLinks > 0 || reason._count.specialBarcodes > 0;
  }

  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }

  private get userCounts(): Prisma.UserInclude {
    return {
      _count: {
        select: {
          inspectionRecords: true,
          sessions: true
        }
      }
    };
  }

  private get defectReasonCounts(): Prisma.DefectReasonInclude {
    return {
      _count: {
        select: {
          inspectionRecordLinks: true,
          specialBarcodes: true
        }
      }
    };
  }

  private get productionLineCounts(): Prisma.ProductionLineInclude {
    return {
      _count: {
        select: {
          inspectionRecords: true,
          sessions: true
        }
      }
    };
  }

  private get operatorProfileCounts(): Prisma.OperatorProfileInclude {
    return {
      _count: {
        select: {
          inspectionRecords: true
        }
      }
    };
  }
}

function normalizeInitials(initials: string | undefined | null, name: string | undefined): string {
  const provided = initials?.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (provided) {
    return provided;
  }

  return pinyin(name?.trim() ?? '', {
    pattern: 'first',
    toneType: 'none',
    type: 'array'
  })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}
