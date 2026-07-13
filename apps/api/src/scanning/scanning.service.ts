import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DailyProductionPlan, DailyProductionPlanStatus, InspectionResult, Prisma, SpecialBarcodeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { getBeijingDayRange, nowUtc, toBeijingDateString } from '../time/beijing-time';
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

type ActivePlan = Pick<
  DailyProductionPlan,
  'id' | 'businessDate' | 'productionOrderNo' | 'plannedQuantity' | 'productionLineId' | 'status'
>;

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
        productName: null,
        vehicleModel: null,
        partName: null,
        productionOrderNo: null,
        dailyPlan: null,
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
        productName: null,
        vehicleModel: specialBarcode.vehicleModel,
        partName: null,
        source: 'NO_BARCODE_PRODUCT'
      };
    }

    const result = await this.scanLookup.lookup(trimmedBarcode);
    return {
      kind: 'RESOLVED_PART',
      ...result,
      ...(result.productionOrderNo ? { dailyPlan: await this.findTodayPlanSummary(auth, result.productionOrderNo) } : {}),
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
    const productName = dto.productName?.trim() || null;
    const vehicleModel = dto.vehicleModel?.trim() || null;
    const partName = dto.partName?.trim() || null;
    const operatorProfileId = dto.operatorProfileId?.trim() || null;
    const productionOrderNo = dto.productionOrderNo?.trim() || null;

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

    const isSpecialBarcode = await this.isActiveSpecialBarcode(barcode);
    const dailyPlan = isSpecialBarcode
      ? null
      : await this.resolveActivePlanForSubmission(auth, {
          barcode,
          partNumber,
          productionOrderNo,
          result: dto.result
        });

    if (dto.result === InspectionResult.QUALIFIED) {
      return this.createQualifiedRecord(auth, {
        barcode,
        partNumber,
        productName,
        vehicleModel,
        partName,
        operatorProfileId,
        productionOrderNo,
        dailyPlan,
        allowRepeat: isSpecialBarcode
      });
    }

    return this.createUnqualifiedRecord(auth, {
      barcode,
      partNumber,
      productName,
      vehicleModel,
      partName,
      operatorProfileId,
      productionOrderNo,
      dailyPlan,
      defectReasonIds: dto.defectReasonIds ?? [],
      allowAfterQualified: isSpecialBarcode
    });
  }

  private async createQualifiedRecord(
    auth: ActiveSessionContext,
    data: {
      barcode: string;
      partNumber: string;
      productName: string | null;
      vehicleModel: string | null;
      partName: string | null;
      operatorProfileId: string | null;
      productionOrderNo: string | null;
      dailyPlan: ActivePlan | null;
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
          productName: data.productName,
          vehicleModel: data.vehicleModel,
          partName: data.partName,
          productionOrderNo: data.productionOrderNo,
          dailyProductionPlanId: data.dailyPlan?.id ?? null,
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
      productName: string | null;
      vehicleModel: string | null;
      partName: string | null;
      operatorProfileId?: string | null;
      productionOrderNo: string | null;
      dailyPlan: ActivePlan | null;
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
          productName: data.productName,
          vehicleModel: data.vehicleModel,
          partName: data.partName,
          productionOrderNo: data.productionOrderNo,
          dailyProductionPlanId: data.dailyPlan?.id ?? null,
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
      productName: record.productName,
      vehicleModel: record.vehicleModel,
      partName: record.partName,
      productionOrderNo: record.productionOrderNo,
      dailyProductionPlanId: record.dailyProductionPlanId,
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

  private async resolveActivePlanForSubmission(
    auth: ActiveSessionContext,
    data: {
      barcode: string;
      partNumber: string;
      productionOrderNo: string | null;
      result: InspectionResult;
    }
  ): Promise<ActivePlan> {
    if (!data.productionOrderNo) {
      await this.writePlanInterceptLog(auth, {
        action: 'SCAN_DAILY_PLAN_ORDER_MISSING',
        targetId: null,
        targetLabel: data.barcode,
        barcode: data.barcode,
        partNumber: data.partNumber,
        after: { reason: 'productionOrderNoMissing' }
      });
      throw new BadRequestException({
        code: 'PRODUCTION_ORDER_REQUIRED',
        message: '扫码结果缺少生产订单号，不能按当天计划校验'
      });
    }

    const businessDate = toBeijingDateString(nowUtc());
    const plan = await this.prisma.dailyProductionPlan.findUnique({
      where: {
        businessDate_productionOrderNo_productionLineId: {
          businessDate,
          productionOrderNo: data.productionOrderNo,
          productionLineId: auth.productionLine.id
        }
      },
      select: {
        id: true,
        businessDate: true,
        productionOrderNo: true,
        plannedQuantity: true,
        productionLineId: true,
        status: true
      }
    });

    if (!plan) {
      const otherLinePlans = await this.prisma.dailyProductionPlan.findMany({
        where: {
          businessDate,
          productionOrderNo: data.productionOrderNo
        },
        select: {
          id: true,
          productionOrderNo: true,
          productionLineId: true
        }
      });

      if (otherLinePlans.length) {
        const firstOtherLinePlan = otherLinePlans[0]!;
        await this.writePlanInterceptLog(auth, {
          action: 'SCAN_DAILY_PLAN_LINE_MISMATCH',
          targetId: firstOtherLinePlan.id,
          targetLabel: data.productionOrderNo,
          barcode: data.barcode,
          partNumber: data.partNumber,
          after: {
            businessDate,
            productionOrderNo: data.productionOrderNo,
            plannedProductionLineIds: otherLinePlans.map((otherPlan) => otherPlan.productionLineId),
            scanningProductionLineId: auth.productionLine.id
          }
        });
        throw new ConflictException({
          code: 'DAILY_PLAN_PRODUCTION_LINE_MISMATCH',
          message: '该订单未下达到当前产线，不能在当前产线扫码'
        });
      }

      await this.writePlanInterceptLog(auth, {
        action: 'SCAN_DAILY_PLAN_MISSING',
        targetId: null,
        targetLabel: data.productionOrderNo,
        barcode: data.barcode,
        partNumber: data.partNumber,
        after: {
          businessDate,
          productionOrderNo: data.productionOrderNo,
          status: null
        }
      });
      throw new ConflictException({
        code: 'DAILY_PLAN_REQUIRED',
        message: '该订单今日未下达生产计划'
      });
    }

    if (plan.status !== DailyProductionPlanStatus.ACTIVE) {
      await this.writePlanInterceptLog(auth, {
        action: 'SCAN_DAILY_PLAN_MISSING',
        targetId: plan.id,
        targetLabel: data.productionOrderNo,
        barcode: data.barcode,
        partNumber: data.partNumber,
        after: {
          businessDate,
          productionOrderNo: data.productionOrderNo,
          status: plan.status,
          productionLineId: plan.productionLineId
        }
      });
      throw new ConflictException({
        code: 'DAILY_PLAN_REQUIRED',
        message: '该订单今日未下达生产计划'
      });
    }

    if (data.result === InspectionResult.QUALIFIED) {
      const qualifiedCount = await this.prisma.inspectionRecord.count({
        where: {
          dailyProductionPlanId: plan.id,
          result: InspectionResult.QUALIFIED
        }
      });

      if (qualifiedCount >= plan.plannedQuantity) {
        await this.writePlanInterceptLog(auth, {
          action: 'SCAN_DAILY_PLAN_COMPLETED',
          targetId: plan.id,
          targetLabel: plan.productionOrderNo,
          barcode: data.barcode,
          partNumber: data.partNumber,
          after: {
            businessDate,
            productionOrderNo: plan.productionOrderNo,
            plannedQuantity: plan.plannedQuantity,
            qualifiedCount
          }
        });
        throw new ConflictException({
          code: 'DAILY_PLAN_QUALIFIED_LIMIT_REACHED',
          message: '该订单今日计划已完成，不能继续录入合格品'
        });
      }
    }

    return plan;
  }

  private async findTodayPlanSummary(auth: ActiveSessionContext, productionOrderNo: string) {
    const businessDate = toBeijingDateString(nowUtc());
    const plan = await this.prisma.dailyProductionPlan.findUnique({
      where: {
        businessDate_productionOrderNo_productionLineId: {
          businessDate,
          productionOrderNo,
          productionLineId: auth.productionLine.id
        }
      },
      include: {
        productionLine: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!plan) {
      return {
        businessDate,
        productionOrderNo,
        status: 'MISSING',
        plannedQuantity: 0,
        qualifiedCount: 0,
        unqualifiedCount: 0,
        remainingQuantity: 0,
        completionRate: 0
      };
    }

    const [qualifiedCount, unqualifiedCount] = await Promise.all([
      this.prisma.inspectionRecord.count({
        where: {
          dailyProductionPlanId: plan.id,
          result: InspectionResult.QUALIFIED
        }
      }),
      this.prisma.inspectionRecord.count({
        where: {
          dailyProductionPlanId: plan.id,
          result: InspectionResult.UNQUALIFIED
        }
      })
    ]);

    return {
      id: plan.id,
      businessDate,
      productionOrderNo,
      status: plan.status,
      productionLine: plan.productionLine,
      plannedQuantity: plan.plannedQuantity,
      qualifiedCount,
      unqualifiedCount,
      remainingQuantity: Math.max(0, plan.plannedQuantity - qualifiedCount),
      completionRate: plan.plannedQuantity > 0 ? qualifiedCount / plan.plannedQuantity : 0
    };
  }

  private async writePlanInterceptLog(
    auth: ActiveSessionContext,
    data: {
      action: string;
      targetId: string | null;
      targetLabel: string;
      barcode: string;
      partNumber: string;
      after: unknown;
    }
  ) {
    await this.prisma.operationLog.create({
      data: {
        module: 'inspection',
        action: data.action,
        targetType: 'dailyProductionPlan',
        targetId: data.targetId,
        targetLabel: data.targetLabel,
        barcode: data.barcode,
        partNumber: data.partNumber,
        afterJson: JSON.stringify(data.after),
        operatorId: auth.user.id,
        operatorUsername: auth.user.username
      }
    });
  }
}
