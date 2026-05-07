import { BadRequestException, Injectable } from '@nestjs/common';
import { InspectionResult, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getBeijingDateRange, getBeijingMonthRange, getCurrentBeijingYearMonth } from '../time/beijing-time';

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
    defectReasonLinks: {
      include: {
        defectReason: true;
      };
    };
  };
}>;

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

  private resolveDateRange(query: DetailQueryParams): { startUtc: Date; endUtc: Date } {
    if (!query.startDate && !query.endDate) {
      const { year, month } = getCurrentBeijingYearMonth();
      return getBeijingMonthRange(year, month);
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

  private toRecordResponse(record: DetailRecord) {
    return {
      id: record.id,
      barcode: record.barcode,
      partNumber: record.partNumber,
      vehicleModel: record.vehicleModel,
      result: record.result,
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
      defectReasons: record.defectReasonLinks.map((link) => ({
        id: link.defectReason.id,
        code: link.defectReason.code,
        name: link.defectReason.name
      }))
    };
  }
}
