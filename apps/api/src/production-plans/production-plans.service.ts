import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DailyProductionPlan, DailyProductionPlanStatus, InspectionResult, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SCAN_LOOKUP_GATEWAY, ScanLookupGateway, ScanLookupResult } from '../scanning/scan-lookup.gateway';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { getBeijingDateRange, nowUtc, toBeijingDateString } from '../time/beijing-time';
import { CopyDailyProductionPlansDto } from './dto/copy-daily-production-plans.dto';
import { CreateDailyProductionPlanDto } from './dto/create-daily-production-plan.dto';
import { UpdateDailyProductionPlanDto } from './dto/update-daily-production-plan.dto';

type PlanListQuery = {
  date?: string;
  status?: string;
  productionOrderNo?: string;
};

type PlanStats = {
  qualifiedCount: number;
  unqualifiedCount: number;
  productionLines: Array<{ id: string; code: string; name: string }>;
};

type PlanWithLine = DailyProductionPlan & {
  productionLine: { id: string; code: string; name: string };
};

@Injectable()
export class ProductionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCAN_LOOKUP_GATEWAY)
    private readonly scanLookup: ScanLookupGateway
  ) {}

  async lookupProductionOrder(barcode: string) {
    const result = await this.scanLookup.lookup(barcode);
    const productionOrderNo = result.productionOrderNo?.trim();
    const orderQuantity = result.orderQuantity;

    if (!productionOrderNo || !orderQuantity) {
      throw new BadGatewayException({
        code: 'PRODUCTION_ORDER_INFO_MISSING',
        message: '生产订单接口返回数据缺少生产订单号或订单数量'
      });
    }

    await this.prisma.productionOrderCache.upsert({
      where: { productionOrderNo },
      create: {
        productionOrderNo,
        barcode: result.barcode,
        partNumber: result.partNumber,
        productName: result.productName ?? '',
        orderQuantity,
        rawJson: stringifyRawData(result.rawData),
        fetchedAt: nowUtc()
      },
      update: {
        barcode: result.barcode,
        partNumber: result.partNumber,
        productName: result.productName ?? '',
        orderQuantity,
        rawJson: stringifyRawData(result.rawData),
        fetchedAt: nowUtc()
      }
    });

    return this.toLookupResponse(result, productionOrderNo, orderQuantity);
  }

  async listPlans(query: PlanListQuery) {
    const businessDate = this.resolveBusinessDate(query.date);
    const status = this.resolveStatus(query.status);
    const productionOrderNo = query.productionOrderNo?.trim() || undefined;
    const plans = await this.prisma.dailyProductionPlan.findMany({
      where: {
        businessDate,
        ...(status ? { status } : {}),
        ...(productionOrderNo ? { productionOrderNo: { contains: productionOrderNo } } : {})
      },
      include: { productionLine: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });

    return this.attachStats(plans);
  }

  async createPlan(auth: ActiveSessionContext, dto: CreateDailyProductionPlanDto) {
    const businessDate = this.resolveBusinessDate(dto.businessDate);
    const data = this.normalizePlanInput(dto);
    const productionLine = await this.findActiveProductionLineOrThrow(dto.productionLineId);
    const existing = await this.findPlanForLine(businessDate, data.productionOrderNo, productionLine.id);

    if (existing) {
      throw this.duplicateLinePlanConflict();
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dailyProductionPlan.create({
        data: {
          ...data,
          businessDate,
          productionLineId: productionLine.id,
          status: DailyProductionPlanStatus.ACTIVE,
          createdById: auth.user.id,
          createdByUsername: auth.user.username,
          updatedById: auth.user.id,
          updatedByUsername: auth.user.username
        },
        include: { productionLine: true }
      });

      await this.writeAudit(tx, auth, 'CREATE_DAILY_PLAN', created.id, created.productionOrderNo, null, this.toAuditPlan(created));
      return created;
    });

    return (await this.attachStats([plan]))[0];
  }

  async updatePlan(auth: ActiveSessionContext, id: string, dto: UpdateDailyProductionPlanDto) {
    const existing = await this.findPlanOrThrow(id);

    if (existing.status === DailyProductionPlanStatus.CLOSED) {
      throw new ConflictException({
        code: 'DAILY_PLAN_CLOSED',
        message: '已关闭的计划不能调整'
      });
    }

    if (dto.plannedQuantity === undefined && dto.productionLineId === undefined) {
      throw new BadRequestException({
        code: 'DAILY_PLAN_UPDATE_EMPTY',
        message: '请提供需要调整的计划数或产线'
      });
    }

    const nextProductionLine = dto.productionLineId
      ? await this.findActiveProductionLineOrThrow(dto.productionLineId)
      : existing.productionLine;
    const lineChanged = nextProductionLine.id !== existing.productionLineId;

    if (lineChanged) {
      const duplicate = await this.findPlanForLine(existing.businessDate, existing.productionOrderNo, nextProductionLine.id);
      if (duplicate && duplicate.id !== existing.id) {
        throw this.duplicateLinePlanConflict();
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.dailyProductionPlan.update({
        where: { id },
        data: {
          ...(dto.plannedQuantity !== undefined ? { plannedQuantity: dto.plannedQuantity } : {}),
          productionLineId: nextProductionLine.id,
          updatedById: auth.user.id,
          updatedByUsername: auth.user.username
        },
        include: { productionLine: true }
      });

      await this.writeAudit(tx, auth, 'UPDATE_DAILY_PLAN', plan.id, plan.productionOrderNo, this.toAuditPlan(existing), this.toAuditPlan(plan));
      return plan;
    });

    return (await this.attachStats([updated]))[0];
  }

  async closePlan(auth: ActiveSessionContext, id: string) {
    const existing = await this.findPlanOrThrow(id);

    if (existing.status === DailyProductionPlanStatus.CLOSED) {
      return (await this.attachStats([existing]))[0];
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.dailyProductionPlan.update({
        where: { id },
        data: {
          status: DailyProductionPlanStatus.CLOSED,
          closedAt: nowUtc(),
          updatedById: auth.user.id,
          updatedByUsername: auth.user.username
        },
        include: { productionLine: true }
      });

      await this.writeAudit(tx, auth, 'CLOSE_DAILY_PLAN', plan.id, plan.productionOrderNo, this.toAuditPlan(existing), this.toAuditPlan(plan));
      return plan;
    });

    return (await this.attachStats([updated]))[0];
  }

  async reopenPlan(auth: ActiveSessionContext, id: string) {
    const existing = await this.findPlanOrThrow(id);

    if (existing.status === DailyProductionPlanStatus.ACTIVE) {
      return (await this.attachStats([existing]))[0];
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.dailyProductionPlan.update({
        where: { id },
        data: {
          status: DailyProductionPlanStatus.ACTIVE,
          closedAt: null,
          updatedById: auth.user.id,
          updatedByUsername: auth.user.username
        },
        include: { productionLine: true }
      });

      await this.writeAudit(tx, auth, 'REOPEN_DAILY_PLAN', plan.id, plan.productionOrderNo, this.toAuditPlan(existing), this.toAuditPlan(plan));
      return plan;
    });

    return (await this.attachStats([updated]))[0];
  }

  async copyPlans(auth: ActiveSessionContext, dto: CopyDailyProductionPlansDto) {
    const targetDate = this.resolveBusinessDate(dto.targetDate);
    const sourceDate = this.resolveBusinessDate(dto.sourceDate ?? addBusinessDays(targetDate, -1));
    const sourcePlans = await this.prisma.dailyProductionPlan.findMany({
      where: {
        businessDate: sourceDate,
        status: DailyProductionPlanStatus.ACTIVE
      },
      orderBy: { createdAt: 'asc' }
    });
    const created: PlanWithLine[] = [];
    let skipped = 0;

    for (const sourcePlan of sourcePlans) {
      const exists = await this.prisma.dailyProductionPlan.findUnique({
        where: {
          businessDate_productionOrderNo_productionLineId: {
            businessDate: targetDate,
            productionOrderNo: sourcePlan.productionOrderNo,
            productionLineId: sourcePlan.productionLineId
          }
        }
      });

      if (exists) {
        skipped += 1;
        continue;
      }

      const plan = await this.prisma.$transaction(async (tx) => {
        const copied = await tx.dailyProductionPlan.create({
          data: {
            businessDate: targetDate,
            productionOrderNo: sourcePlan.productionOrderNo,
            partNumber: sourcePlan.partNumber,
            productName: sourcePlan.productName,
            orderQuantity: sourcePlan.orderQuantity,
            plannedQuantity: sourcePlan.plannedQuantity,
            productionLineId: sourcePlan.productionLineId,
            status: DailyProductionPlanStatus.ACTIVE,
            createdById: auth.user.id,
            createdByUsername: auth.user.username,
            updatedById: auth.user.id,
            updatedByUsername: auth.user.username
          },
          include: { productionLine: true }
        });

        await this.writeAudit(tx, auth, 'COPY_DAILY_PLAN', copied.id, copied.productionOrderNo, {
          sourceDate,
          sourcePlanId: sourcePlan.id
        }, this.toAuditPlan(copied));
        return copied;
      });

      created.push(plan);
    }

    return {
      sourceDate,
      targetDate,
      created: created.length,
      skipped,
      plans: await this.attachStats(created)
    };
  }

  private async findPlanOrThrow(id: string) {
    const plan = await this.prisma.dailyProductionPlan.findUnique({
      where: { id },
      include: { productionLine: true }
    });
    if (!plan) {
      throw new NotFoundException({
        code: 'DAILY_PLAN_NOT_FOUND',
        message: '生产计划不存在'
      });
    }

    return plan;
  }

  private async findActiveProductionLineOrThrow(id: string) {
    const productionLine = await this.prisma.productionLine.findFirst({
      where: { id, isActive: true },
      select: { id: true, code: true, name: true }
    });

    if (!productionLine) {
      throw new BadRequestException({
        code: 'DAILY_PLAN_PRODUCTION_LINE_INVALID',
        message: '计划产线不存在或已停用'
      });
    }

    return productionLine;
  }

  private findPlanForLine(businessDate: string, productionOrderNo: string, productionLineId: string) {
    return this.prisma.dailyProductionPlan.findUnique({
      where: {
        businessDate_productionOrderNo_productionLineId: {
          businessDate,
          productionOrderNo,
          productionLineId
        }
      }
    });
  }

  private duplicateLinePlanConflict() {
    return new ConflictException({
      code: 'DAILY_PLAN_ALREADY_EXISTS',
      message: '该生产订单今日在所选产线已存在计划，请直接调整该产线计划'
    });
  }

  private normalizePlanInput(dto: CreateDailyProductionPlanDto) {
    const productionOrderNo = dto.productionOrderNo.trim();
    const partNumber = dto.partNumber.trim();
    const productName = dto.productName.trim();

    if (!productionOrderNo || !partNumber || !productName) {
      throw new BadRequestException({
        code: 'DAILY_PLAN_REQUIRED_FIELDS',
        message: '生产订单号、零件号和产品名称不能为空'
      });
    }

    return {
      productionOrderNo,
      partNumber,
      productName,
      orderQuantity: dto.orderQuantity,
      plannedQuantity: dto.plannedQuantity
    };
  }

  private async attachStats(plans: PlanWithLine[]) {
    if (!plans.length) {
      return [];
    }

    const planIds = plans.map((plan) => plan.id);
    const records = await this.prisma.inspectionRecord.findMany({
      where: {
        dailyProductionPlanId: { in: planIds }
      },
      select: {
        dailyProductionPlanId: true,
        result: true,
        productionLine: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });
    const statsByPlan = new Map<string, PlanStats>();

    for (const plan of plans) {
      statsByPlan.set(plan.id, {
        qualifiedCount: 0,
        unqualifiedCount: 0,
        productionLines: []
      });
    }

    for (const record of records) {
      if (!record.dailyProductionPlanId) {
        continue;
      }

      const stats = statsByPlan.get(record.dailyProductionPlanId);
      if (!stats) {
        continue;
      }

      if (record.result === InspectionResult.QUALIFIED) {
        stats.qualifiedCount += 1;
      } else {
        stats.unqualifiedCount += 1;
      }

      if (!stats.productionLines.some((line) => line.id === record.productionLine.id)) {
        stats.productionLines.push(record.productionLine);
      }
    }

    return plans.map((plan) => {
      const stats = statsByPlan.get(plan.id)!;
      return this.toPlanResponse(plan, stats);
    });
  }

  private toLookupResponse(result: ScanLookupResult, productionOrderNo: string, orderQuantity: number) {
    return {
      barcode: result.barcode,
      productionOrderNo,
      partNumber: result.partNumber,
      productName: result.productName ?? '',
      orderQuantity
    };
  }

  private toPlanResponse(plan: PlanWithLine, stats: PlanStats) {
    const remainingQuantity = Math.max(0, plan.plannedQuantity - stats.qualifiedCount);
    return {
      id: plan.id,
      businessDate: plan.businessDate,
      productionOrderNo: plan.productionOrderNo,
      partNumber: plan.partNumber,
      productName: plan.productName,
      orderQuantity: plan.orderQuantity,
      plannedQuantity: plan.plannedQuantity,
      productionLine: {
        id: plan.productionLine.id,
        code: plan.productionLine.code,
        name: plan.productionLine.name
      },
      status: plan.status,
      closedAt: plan.closedAt?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      createdByUsername: plan.createdByUsername,
      updatedByUsername: plan.updatedByUsername,
      qualifiedCount: stats.qualifiedCount,
      unqualifiedCount: stats.unqualifiedCount,
      remainingQuantity,
      completionRate: plan.plannedQuantity > 0 ? stats.qualifiedCount / plan.plannedQuantity : 0,
      productionLines: stats.productionLines
    };
  }

  private toAuditPlan(plan: PlanWithLine) {
    return {
      id: plan.id,
      businessDate: plan.businessDate,
      productionOrderNo: plan.productionOrderNo,
      partNumber: plan.partNumber,
      productName: plan.productName,
      orderQuantity: plan.orderQuantity,
      plannedQuantity: plan.plannedQuantity,
      productionLineId: plan.productionLineId,
      productionLine: {
        id: plan.productionLine.id,
        code: plan.productionLine.code,
        name: plan.productionLine.name
      },
      status: plan.status,
      closedAt: plan.closedAt?.toISOString() ?? null
    };
  }

  private async writeAudit(
    client: Pick<Prisma.TransactionClient, 'operationLog'>,
    auth: ActiveSessionContext,
    action: string,
    targetId: string,
    targetLabel: string,
    before: unknown,
    after: unknown
  ) {
    await client.operationLog.create({
      data: {
        module: 'productionPlan',
        action,
        targetType: 'dailyProductionPlan',
        targetId,
        targetLabel,
        beforeJson: before === null ? null : JSON.stringify(before),
        afterJson: after === null ? null : JSON.stringify(after),
        operatorId: auth.user.id,
        operatorUsername: auth.user.username
      }
    });
  }

  private resolveBusinessDate(value: string | undefined): string {
    const businessDate = value?.trim() || toBeijingDateString(nowUtc());
    try {
      getBeijingDateRange(businessDate, businessDate);
    } catch {
      throw new BadRequestException({
        code: 'BUSINESS_DATE_INVALID',
        message: '当天日期无效'
      });
    }

    return businessDate;
  }

  private resolveStatus(status: string | undefined): DailyProductionPlanStatus | undefined {
    if (!status?.trim()) {
      return undefined;
    }

    if (status === DailyProductionPlanStatus.ACTIVE || status === DailyProductionPlanStatus.CLOSED) {
      return status;
    }

    throw new BadRequestException({
      code: 'DAILY_PLAN_STATUS_INVALID',
      message: '计划状态无效'
    });
  }
}

function stringifyRawData(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function addBusinessDays(dateString: string, offset: number): string {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(dateString);
  if (!match?.groups) {
    return dateString;
  }

  const date = new Date(Date.UTC(
    Number(match.groups.year),
    Number(match.groups.month) - 1,
    Number(match.groups.day) + offset
  ));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
