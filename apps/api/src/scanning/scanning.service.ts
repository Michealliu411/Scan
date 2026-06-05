import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { InspectionResult, Prisma, SpecialBarcodeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { getBeijingDayRange, nowUtc } from '../time/beijing-time';
import { CreateInspectionRecordDto } from './dto/create-inspection-record.dto';
import { SCAN_LOOKUP_GATEWAY, ScanLookupGateway } from './scan-lookup.gateway';

type InspectionRecordWithDetails = Prisma.InspectionRecordGetPayload<{
  include: {
    productionLine: true;
    inspector: true;
    operatorProfile: true;
    defectReasonLinks: {
      include: {
        defectReason: true;
      };
    };
  };
}>;

@Injectable()
export class ScanningService {
  private readonly todayRecordLimit = 80;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCAN_LOOKUP_GATEWAY)
    private readonly scanLookup: ScanLookupGateway
  ) {}

  async lookupBarcode(auth: ActiveSessionContext, barcode: string) {
    const trimmedBarcode = barcode.trim();
    const specialBarcode = await this.prisma.specialBarcode.findUnique({
      where: { barcode: trimmedBarcode },
      include: { defectReason: true }
    });

    if (specialBarcode?.isActive && specialBarcode.type === SpecialBarcodeType.DIRTY) {
      if (!specialBarcode.defectReasonId) {
        throw new BadRequestException({
          code: 'DIRTY_BARCODE_REASON_REQUIRED',
          message: '条码污损配置缺少缺陷原因'
        });
      }

      const record = await this.createUnqualifiedRecord(auth, {
        barcode: trimmedBarcode,
        partNumber: 'DIRTY-BARCODE',
        vehicleModel: null,
        defectReasonIds: [specialBarcode.defectReasonId],
        allowAfterQualified: true
      });

      return {
        kind: 'DIRTY_BARCODE_AUTO_SUBMITTED',
        record
      };
    }

    if (specialBarcode?.isActive && specialBarcode.type === SpecialBarcodeType.NO_BARCODE_PRODUCT) {
      if (!specialBarcode.partNumber || !specialBarcode.vehicleModel) {
        throw new BadRequestException({
          code: 'NO_BARCODE_PRODUCT_INFO_REQUIRED',
          message: '无条码产品配置缺少车型或零件号'
        });
      }

      return {
        kind: 'RESOLVED_PART',
        barcode: trimmedBarcode,
        partNumber: specialBarcode.partNumber,
        vehicleModel: specialBarcode.vehicleModel,
        source: 'NO_BARCODE_PRODUCT'
      };
    }

    const result = await this.scanLookup.lookup(trimmedBarcode);
    return {
      kind: 'RESOLVED_PART',
      ...result,
      source: result.source ?? 'SIMULATED_LOOKUP'
    };
  }

  async listActiveDefectReasons() {
    const reasons = await this.prisma.defectReason.findMany({
      where: { isActive: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        deductionAmount: true
      }
    });

    return reasons.map((reason) => ({
      ...reason,
      deductionAmount: reason.deductionAmount.toNumber()
    }));
  }

  async searchActiveOperators(query: string) {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return [];
    }

    return this.prisma.operatorProfile.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: keyword } },
          { employeeCode: { contains: keyword } },
          { pinyinInitials: { contains: keyword } }
        ]
      },
      orderBy: [{ name: 'asc' }],
      take: 20,
      select: {
        id: true,
        employeeCode: true,
        name: true,
        pinyinInitials: true,
        employmentType: true
      }
    });
  }

  async listTodayRecords(auth: ActiveSessionContext) {
    const { startUtc, endUtc } = getBeijingDayRange(nowUtc());
    const records = await this.prisma.inspectionRecord.findMany({
      where: {
        productionLineId: auth.productionLine.id,
        scannedAt: {
          gte: startUtc,
          lt: endUtc
        }
      },
      include: this.recordInclude,
      orderBy: { scannedAt: 'desc' },
      take: this.todayRecordLimit
    });

    return records.map((record) => this.toRecordResponse(record));
  }

  async createRecord(auth: ActiveSessionContext, dto: CreateInspectionRecordDto) {
    const barcode = dto.barcode.trim();
    const partNumber = dto.partNumber.trim();
    const vehicleModel = dto.vehicleModel?.trim() || null;
    const operatorProfileId = dto.operatorProfileId?.trim() || null;

    if (!barcode) {
      throw new BadRequestException({
        code: 'BARCODE_REQUIRED',
        message: '请输入条码'
      });
    }

    if (!partNumber) {
      throw new BadRequestException({
        code: 'PART_NUMBER_REQUIRED',
        message: '缺少零件号'
      });
    }

    if (operatorProfileId) {
      const operator = await this.prisma.operatorProfile.findFirst({
        where: {
          id: operatorProfileId,
          isActive: true
        },
        select: { id: true }
      });

      if (!operator) {
        throw new BadRequestException({
          code: 'OPERATOR_PROFILE_INVALID',
          message: '操作工不存在或已停用'
        });
      }
    }

    if (dto.result === InspectionResult.QUALIFIED) {
      return this.createQualifiedRecord(auth, {
        barcode,
        partNumber,
        vehicleModel,
        operatorProfileId,
        allowRepeat: await this.isActiveSpecialBarcode(barcode)
      });
    }

    return this.createUnqualifiedRecord(auth, {
      barcode,
      partNumber,
      vehicleModel,
      operatorProfileId,
      defectReasonIds: dto.defectReasonIds ?? [],
      allowAfterQualified: await this.isActiveSpecialBarcode(barcode)
    });
  }

  private async createQualifiedRecord(
    auth: ActiveSessionContext,
    data: {
      barcode: string;
      partNumber: string;
      vehicleModel: string | null;
      operatorProfileId: string | null;
      allowRepeat?: boolean;
    }
  ) {
    if (!data.allowRepeat) {
      const existing = await this.findQualifiedRecord(data.barcode);
      if (existing) {
        throw this.duplicateQualified(existing);
      }
    }

    try {
      const record = await this.prisma.inspectionRecord.create({
        data: {
          barcode: data.barcode,
          qualifiedBarcodeKey: data.allowRepeat ? null : data.barcode,
          partNumber: data.partNumber,
          vehicleModel: data.vehicleModel,
          productionLineId: auth.productionLine.id,
          inspectorId: auth.user.id,
          operatorProfileId: data.operatorProfileId,
          result: InspectionResult.QUALIFIED,
          deductionAmount: 0,
          scannedAt: nowUtc()
        },
        include: this.recordInclude
      });

      return this.toRecordResponse(record);
    } catch (error) {
      if (this.isUniqueQualifiedConflict(error)) {
        const conflictRecord = await this.findQualifiedRecord(data.barcode);
        if (conflictRecord) {
          throw this.duplicateQualified(conflictRecord);
        }
      }

      throw error;
    }
  }

  private async createUnqualifiedRecord(
    auth: ActiveSessionContext,
    data: {
      barcode: string;
      partNumber: string;
      vehicleModel: string | null;
      operatorProfileId?: string | null;
      defectReasonIds: string[];
      allowAfterQualified?: boolean;
    }
  ) {
    const defectReasonIds = [...new Set(data.defectReasonIds)];
    const existingQualified = data.allowAfterQualified ? null : await this.findQualifiedRecord(data.barcode);

    if (existingQualified) {
      throw new ConflictException({
        code: 'BARCODE_ALREADY_QUALIFIED',
        message: '该条码已存在合格记录，不能再录入不合格',
        existingRecord: this.toRecordResponse(existingQualified)
      });
    }

    if (!defectReasonIds.length) {
      throw new BadRequestException({
        code: 'DEFECT_REASON_REQUIRED',
        message: '不合格记录必须选择至少一个缺陷原因'
      });
    }

    const activeReasons = await this.prisma.defectReason.findMany({
      where: {
        id: { in: defectReasonIds },
        isActive: true
      },
      select: { id: true, deductionAmount: true }
    });

    if (activeReasons.length !== defectReasonIds.length) {
      throw new BadRequestException({
        code: 'DEFECT_REASON_INVALID',
        message: '缺陷原因不存在或已停用'
      });
    }

    const deductionAmount = activeReasons.reduce((total, reason) => total + reason.deductionAmount.toNumber(), 0);

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inspectionRecord.create({
        data: {
          barcode: data.barcode,
          qualifiedBarcodeKey: null,
          partNumber: data.partNumber,
          vehicleModel: data.vehicleModel,
          productionLineId: auth.productionLine.id,
          inspectorId: auth.user.id,
          operatorProfileId: data.operatorProfileId || null,
          result: InspectionResult.UNQUALIFIED,
          deductionAmount,
          scannedAt: nowUtc()
        }
      });

      await tx.inspectionRecordDefectReason.createMany({
        data: defectReasonIds.map((defectReasonId) => ({
          inspectionRecordId: created.id,
          defectReasonId
        }))
      });

      return tx.inspectionRecord.findUniqueOrThrow({
        where: { id: created.id },
        include: this.recordInclude
      });
    });

    return this.toRecordResponse(record);
  }

  private findQualifiedRecord(barcode: string) {
    return this.prisma.inspectionRecord.findUnique({
      where: { qualifiedBarcodeKey: barcode },
      include: this.recordInclude
    });
  }

  private async isActiveSpecialBarcode(barcode: string): Promise<boolean> {
    const specialBarcode = await this.prisma.specialBarcode.findUnique({
      where: { barcode },
      select: { isActive: true }
    });

    return specialBarcode?.isActive === true;
  }

  private duplicateQualified(record: InspectionRecordWithDetails): ConflictException {
    return new ConflictException({
      code: 'QUALIFIED_BARCODE_DUPLICATE',
      message: '该条码已存在合格记录，不能重复提交',
      existingRecord: this.toRecordResponse(record)
    });
  }

  private isUniqueQualifiedConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('qualifiedBarcodeKey')
    );
  }

  private toRecordResponse(record: InspectionRecordWithDetails) {
    return {
      id: record.id,
      barcode: record.barcode,
      partNumber: record.partNumber,
      vehicleModel: record.vehicleModel,
      result: record.result,
      deductionAmount: record.deductionAmount.toNumber(),
      scannedAt: record.scannedAt.toISOString(),
      productionLine: {
        id: record.productionLine.id,
        code: record.productionLine.code,
        name: record.productionLine.name
      },
      inspector: {
        id: record.inspector.id,
        username: record.inspector.username
      },
      operatorProfile: record.operatorProfile
        ? {
            id: record.operatorProfile.id,
            employeeCode: record.operatorProfile.employeeCode,
            name: record.operatorProfile.name,
            employmentType: record.operatorProfile.employmentType
          }
        : null,
      defectReasons: record.defectReasonLinks.map((link) => ({
        id: link.defectReason.id,
        code: link.defectReason.code,
        name: link.defectReason.name,
        deductionAmount: link.defectReason.deductionAmount.toNumber()
      }))
    };
  }

  private get recordInclude() {
    return {
      productionLine: true,
      inspector: true,
      operatorProfile: true,
      defectReasonLinks: {
        include: {
          defectReason: true
        },
        orderBy: {
          defectReason: {
            code: 'asc'
          }
        }
      }
    } satisfies Prisma.InspectionRecordInclude;
  }
}
