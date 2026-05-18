import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InspectionResult, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { getBeijingDateRange, toBeijingDateString } from '../time/beijing-time';
import { ReclassifyInspectionRecordDto } from './dto/reclassify-inspection-record.dto';

type DetailQueryParams = {
  startDate?: string;
  endDate?: string;
  productionLineId?: string;
  barcode?: string;
  partNumber?: string;
  result?: string;
  defectReasonId?: string;
};

type DetailRecord = Prisma.InspectionRecordGetPayload<{
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

type ChangeLogRecord = Prisma.InspectionRecordChangeLogGetPayload<{
  include: {
    operator: true;
  };
}>;

type ChangeLogQueryParams = {
  startDate?: string;
  endDate?: string;
  barcode?: string;
  operatorUsername?: string;
};

const DETAIL_QUERY_LIMIT = 200;

@Injectable()
export class DetailQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecords(query: DetailQueryParams) {
    const { startUtc, endUtc } = this.resolveDateRange(query);
    const result = this.resolveResult(query.result);
    const productionLineId = query.productionLineId?.trim() || undefined;
    const defectReasonId = query.defectReasonId?.trim() || undefined;

    const records = await this.prisma.inspectionRecord.findMany({
      where: {
        scannedAt: {
          gte: startUtc,
          lt: endUtc
        },
        ...(productionLineId ? { productionLineId } : {}),
        ...(query.barcode?.trim() ? { barcode: { contains: query.barcode.trim() } } : {}),
        ...(query.partNumber?.trim() ? { partNumber: { contains: query.partNumber.trim() } } : {}),
        ...(result ? { result } : {}),
        ...(defectReasonId
          ? {
              defectReasonLinks: {
                some: { defectReasonId }
              }
            }
          : {})
      },
      include: {
        productionLine: true,
        inspector: true,
        operatorProfile: true,
        defectReasonLinks: {
          include: {
            defectReason: true
          }
        }
      },
      orderBy: { scannedAt: 'desc' },
      take: DETAIL_QUERY_LIMIT
    });

    return {
      records: records.map((record) => this.toRecordResponse(record)),
      limit: DETAIL_QUERY_LIMIT
    };
  }

  listActiveDefectReasons() {
    return this.prisma.defectReason.findMany({
      where: { isActive: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true
      }
    });
  }

  async reclassifyQualifiedRecordToUnqualified(
    auth: ActiveSessionContext,
    inspectionRecordId: string,
    dto: ReclassifyInspectionRecordDto
  ) {
    const defectReasons = await this.resolveActiveDefectReasons(dto.defectReasonIds ?? []);
    const deductionAmount = defectReasons.reduce((total, reason) => total + reason.deductionAmount.toNumber(), 0);
    const existing = await this.prisma.inspectionRecord.findUnique({
      where: { id: inspectionRecordId },
      include: {
        defectReasonLinks: true
      }
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'INSPECTION_RECORD_NOT_FOUND',
        message: '检验记录不存在'
      });
    }

    if (existing.result !== InspectionResult.QUALIFIED) {
      throw new ConflictException({
        code: 'INSPECTION_RECORD_NOT_QUALIFIED',
        message: '只有合格记录可以变更为不合格'
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.inspectionRecordDefectReason.deleteMany({
        where: { inspectionRecordId }
      });

      await tx.inspectionRecordDefectReason.createMany({
        data: defectReasons.map((reason) => ({
          inspectionRecordId,
          defectReasonId: reason.id
        }))
      });

      const record = await tx.inspectionRecord.update({
        where: { id: inspectionRecordId },
        data: {
          result: InspectionResult.UNQUALIFIED,
          qualifiedBarcodeKey: null,
          deductionAmount
        },
        include: {
          productionLine: true,
          inspector: true,
          operatorProfile: true,
          defectReasonLinks: {
            include: {
              defectReason: true
            }
          }
        }
      });

      await tx.inspectionRecordChangeLog.create({
        data: {
          inspectionRecordId,
          operatorId: auth.user.id,
          barcode: existing.barcode,
          partNumber: existing.partNumber,
          previousResult: InspectionResult.QUALIFIED,
          newResult: InspectionResult.UNQUALIFIED,
          defectReasonsJson: JSON.stringify(
            defectReasons.map((reason) => ({
              id: reason.id,
              code: reason.code,
              name: reason.name
            }))
          )
        }
      });

      return record;
    });

    return this.toRecordResponse(updated);
  }

  async listChangeLogs(query: ChangeLogQueryParams) {
    const { startUtc, endUtc } = this.resolveDateRange(query);
    const barcode = query.barcode?.trim() || undefined;
    const operatorUsername = query.operatorUsername?.trim() || undefined;

    const logs = await this.prisma.inspectionRecordChangeLog.findMany({
      where: {
        operatedAt: {
          gte: startUtc,
          lt: endUtc
        },
        ...(barcode ? { barcode: { contains: barcode } } : {}),
        ...(operatorUsername
          ? {
              operator: {
                username: { contains: operatorUsername }
              }
            }
          : {})
      },
      include: {
        operator: true
      },
      orderBy: { operatedAt: 'desc' },
      take: DETAIL_QUERY_LIMIT
    });

    return {
      logs: logs.map((log) => this.toChangeLogResponse(log)),
      limit: DETAIL_QUERY_LIMIT
    };
  }

  private resolveDateRange(query: DetailQueryParams): { startUtc: Date; endUtc: Date } {
    if (!query.startDate && !query.endDate) {
      return getBeijingDateRange(toBeijingDateString(new Date()), toBeijingDateString(new Date()));
    }

    if (!query.startDate || !query.endDate) {
      throw new BadRequestException({
        code: 'DETAIL_DATE_RANGE_REQUIRED',
        message: '请选择开始日期和结束日期'
      });
    }

    try {
      return getBeijingDateRange(query.startDate, query.endDate);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw new BadRequestException({
          code: 'DETAIL_DATE_RANGE_INVALID',
          message: '日期范围无效'
        });
      }

      throw error;
    }
  }

  private resolveResult(result: string | undefined): InspectionResult | undefined {
    if (!result?.trim()) {
      return undefined;
    }

    if (result === InspectionResult.QUALIFIED || result === InspectionResult.UNQUALIFIED) {
      return result;
    }

    throw new BadRequestException({
      code: 'DETAIL_RESULT_INVALID',
      message: '检验结果筛选无效'
    });
  }

  private async resolveActiveDefectReasons(defectReasonIds: string[]) {
    const uniqueIds = [...new Set(defectReasonIds.map((id) => id.trim()).filter(Boolean))];

    if (!uniqueIds.length) {
      throw new BadRequestException({
        code: 'DEFECT_REASON_REQUIRED',
        message: '不合格记录必须选择至少一个缺陷原因'
      });
    }

    const reasons = await this.prisma.defectReason.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        deductionAmount: true
      }
    });

    if (reasons.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'DEFECT_REASON_INVALID',
        message: '缺陷原因不存在或已停用'
      });
    }

    const reasonById = new Map(reasons.map((reason) => [reason.id, reason]));
    return uniqueIds.map((id) => reasonById.get(id)!);
  }

  private toRecordResponse(record: DetailRecord) {
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
        name: link.defectReason.name
      }))
    };
  }

  private toChangeLogResponse(log: ChangeLogRecord) {
    return {
      id: log.id,
      inspectionRecordId: log.inspectionRecordId,
      barcode: log.barcode,
      partNumber: log.partNumber,
      previousResult: log.previousResult,
      newResult: log.newResult,
      operatedAt: log.operatedAt.toISOString(),
      operator: {
        id: log.operator.id,
        username: log.operator.username
      },
      defectReasons: parseDefectReasonsJson(log.defectReasonsJson)
    };
  }
}

function parseDefectReasonsJson(value: string): Array<{ id: string; code: string; name: string }> {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const reason = item as Record<string, unknown>;
    return typeof reason.id === 'string' && typeof reason.code === 'string' && typeof reason.name === 'string'
      ? [{ id: reason.id, code: reason.code, name: reason.name }]
      : [];
  });
}
