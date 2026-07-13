import { BadRequestException, Injectable } from '@nestjs/common';
import { InspectionResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getBeijingMonthRange, getCurrentBeijingYearMonth, toBeijingDateString } from '../time/beijing-time';

type DashboardQuery = {
  year?: string;
  month?: string;
  productionLineId?: string;
};

type Totals = {
  total: number;
  qualified: number;
  unqualified: number;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query: DashboardQuery) {
    const { year, month } = this.resolvePeriod(query);
    const { startUtc, endUtc } = getBeijingMonthRange(year, month);
    const productionLineId = query.productionLineId?.trim() || undefined;

    if (productionLineId) {
      await this.assertProductionLineExists(productionLineId);
    }

    const [productionLines, records] = await Promise.all([
      this.prisma.productionLine.findMany({
        where: {
          isActive: true,
          ...(productionLineId ? { id: productionLineId } : {})
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
      }),
      this.prisma.inspectionRecord.findMany({
        where: {
          scannedAt: {
            gte: startUtc,
            lt: endUtc
          },
          ...(productionLineId ? { productionLineId } : {})
        },
        select: {
          barcode: true,
          partNumber: true,
          productionLineId: true,
          result: true
        },
        orderBy: { scannedAt: 'asc' }
      })
    ]);

    const workshopTotals = this.countTotals(records);
    const recordsByLine = new Map<string, typeof records>();
    for (const record of records) {
      const lineRecords = recordsByLine.get(record.productionLineId) ?? [];
      lineRecords.push(record);
      recordsByLine.set(record.productionLineId, lineRecords);
    }

    return {
      period: {
        year,
        month,
        startUtc: startUtc.toISOString(),
        endUtc: endUtc.toISOString()
      },
      workshopTotals,
      productionLineTotals: productionLines.map((line) => ({
        productionLineId: line.id,
        productionLineCode: line.code,
        productionLineName: line.name,
        ...this.countTotals(recordsByLine.get(line.id) ?? [])
      })),
      productDistribution: this.countByPart(records, 'total'),
      unqualifiedPartDistribution: this.countByPart(
        records.filter((record) => record.result === InspectionResult.UNQUALIFIED),
        'unqualified'
      )
    };
  }

  async getQualityDailyReport(query: DashboardQuery) {
    const { year, month } = this.resolvePeriod(query);
    const { startUtc, endUtc } = getBeijingMonthRange(year, month);
    const productionLineId = query.productionLineId?.trim() || undefined;

    if (productionLineId) {
      await this.assertProductionLineExists(productionLineId);
    }

    const [defectReasons, records] = await Promise.all([
      this.prisma.defectReason.findMany({
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        select: { id: true, code: true, name: true }
      }),
      this.prisma.inspectionRecord.findMany({
        include: {
          productionLine: {
            select: { id: true, code: true, name: true, sortOrder: true }
          },
          defectReasonLinks: {
            select: { defectReasonId: true }
          }
        },
        orderBy: [{ scannedAt: 'asc' }, { id: 'asc' }]
      })
    ]);

    const firstRecordsByBarcode = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      if (!firstRecordsByBarcode.has(record.barcode)) {
        firstRecordsByBarcode.set(record.barcode, record);
      }
    }

    const initialDefectCounts = () => Object.fromEntries(defectReasons.map((reason) => [reason.id, 0]));
    const rowsByKey = new Map<
      string,
      {
        businessDate: string;
        productionLineId: string;
        productionLineCode: string;
        productionLineName: string;
        productionLineSortOrder: number;
        vehicleModel: string | null;
        partName: string | null;
        workshop: '缝纫';
        process: '缝纫';
        productionQuantity: number;
        qualifiedQuantity: number;
        unqualifiedQuantity: number;
        defectCounts: Record<string, number>;
      }
    >();

    for (const record of firstRecordsByBarcode.values()) {
      if (
        record.scannedAt < startUtc ||
        record.scannedAt >= endUtc ||
        (productionLineId && record.productionLineId !== productionLineId)
      ) {
        continue;
      }

      const businessDate = toBeijingDateString(record.scannedAt);
      const key = JSON.stringify([
        businessDate,
        record.productionLineId,
        record.vehicleModel,
        record.partName
      ]);
      let row = rowsByKey.get(key);

      if (!row) {
        row = {
          businessDate,
          productionLineId: record.productionLine.id,
          productionLineCode: record.productionLine.code,
          productionLineName: record.productionLine.name,
          productionLineSortOrder: record.productionLine.sortOrder,
          vehicleModel: record.vehicleModel,
          partName: record.partName,
          workshop: '缝纫',
          process: '缝纫',
          productionQuantity: 0,
          qualifiedQuantity: 0,
          unqualifiedQuantity: 0,
          defectCounts: initialDefectCounts()
        };
        rowsByKey.set(key, row);
      }

      row.productionQuantity += 1;
      if (record.result === InspectionResult.QUALIFIED) {
        row.qualifiedQuantity += 1;
      } else {
        row.unqualifiedQuantity += 1;
        for (const link of record.defectReasonLinks) {
          const currentCount = row.defectCounts[link.defectReasonId];
          if (currentCount !== undefined) {
            row.defectCounts[link.defectReasonId] = currentCount + 1;
          }
        }
      }
    }

    return {
      period: { year, month, startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() },
      workshop: '缝纫',
      process: '缝纫',
      defectReasons,
      rows: [...rowsByKey.values()]
        .sort(
          (left, right) =>
            left.businessDate.localeCompare(right.businessDate) ||
            left.productionLineSortOrder - right.productionLineSortOrder ||
            left.productionLineCode.localeCompare(right.productionLineCode) ||
            (left.vehicleModel ?? '').localeCompare(right.vehicleModel ?? '') ||
            (left.partName ?? '').localeCompare(right.partName ?? '')
        )
        .map(({ productionLineSortOrder: _sortOrder, ...row }) => ({
          ...row,
          qualifiedRate: row.productionQuantity ? row.qualifiedQuantity / row.productionQuantity : 0
        }))
    };
  }

  private resolvePeriod(query: DashboardQuery): { year: number; month: number } {
    if (!query.year && !query.month) {
      return getCurrentBeijingYearMonth();
    }

    const year = Number(query.year);
    const month = Number(query.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      throw new BadRequestException({
        code: 'DASHBOARD_PERIOD_INVALID',
        message: '统计月份参数无效'
      });
    }

    getBeijingMonthRange(year, month);
    return { year, month };
  }

  private async assertProductionLineExists(productionLineId: string): Promise<void> {
    const exists = await this.prisma.productionLine.count({
      where: { id: productionLineId }
    });

    if (!exists) {
      throw new BadRequestException({
        code: 'PRODUCTION_LINE_INVALID',
        message: '产线不存在'
      });
    }
  }

  private countTotals(records: Array<{ barcode: string; result: InspectionResult }>): Totals {
    return {
      total: this.countDistinctBarcodes(records),
      qualified: this.countDistinctBarcodes(
        records.filter((record) => record.result === InspectionResult.QUALIFIED)
      ),
      unqualified: this.countDistinctBarcodes(
        records.filter((record) => record.result === InspectionResult.UNQUALIFIED)
      )
    };
  }

  private countByPart<TCountKey extends 'total' | 'unqualified'>(
    records: Array<{ barcode: string; partNumber: string }>,
    countKey: TCountKey
  ): Array<{ partNumber: string } & Record<TCountKey, number>> {
    const counts = new Map<string, number>();

    for (const record of this.distinctRecordsByBarcode(records)) {
      counts.set(record.partNumber, (counts.get(record.partNumber) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort(([partA, countA], [partB, countB]) => countB - countA || partA.localeCompare(partB))
      .map(([partNumber, count]) => ({
        partNumber,
        [countKey]: count
      })) as Array<{ partNumber: string } & Record<TCountKey, number>>;
  }

  private countDistinctBarcodes(records: Array<{ barcode: string }>): number {
    return new Set(records.map((record) => record.barcode)).size;
  }

  private distinctRecordsByBarcode<TRecord extends { barcode: string }>(records: TRecord[]): TRecord[] {
    const byBarcode = new Map<string, TRecord>();

    for (const record of records) {
      if (!byBarcode.has(record.barcode)) {
        byBarcode.set(record.barcode, record);
      }
    }

    return [...byBarcode.values()];
  }
}
