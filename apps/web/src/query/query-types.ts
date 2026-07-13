export type InspectionResult = 'QUALIFIED' | 'UNQUALIFIED';

export type ProductionLineOption = {
  id: string;
  code: string;
  name: string;
};

export type DefectReasonOption = {
  id: string;
  code: string;
  name: string;
  deductionAmount?: number;
};

export type DashboardFilters = {
  year?: number;
  month?: number;
  productionLineId?: string;
};

export type DashboardTotals = {
  total: number;
  qualified: number;
  unqualified: number;
};

export type DashboardResponse = {
  period: {
    year: number;
    month: number;
    startUtc: string;
    endUtc: string;
  };
  workshopTotals: DashboardTotals;
  productionLineTotals: Array<{
    productionLineId: string;
    productionLineCode: string;
    productionLineName: string;
    total: number;
    qualified: number;
    unqualified: number;
  }>;
  productDistribution: Array<{
    partNumber: string;
    total: number;
  }>;
  unqualifiedPartDistribution: Array<{
    partNumber: string;
    unqualified: number;
  }>;
};

export type QualityDailyReportFilters = {
  year?: number;
  month?: number;
  productionLineId?: string;
};

export type QualityDailyReportResponse = {
  period: {
    year: number;
    month: number;
    startUtc: string;
    endUtc: string;
  };
  workshop: '缝纫';
  process: '缝纫';
  defectReasons: Array<{ id: string; code: string; name: string }>;
  rows: Array<{
    businessDate: string;
    productionLineId: string;
    productionLineCode: string;
    productionLineName: string;
    vehicleModel: string | null;
    partName: string | null;
    workshop: '缝纫';
    process: '缝纫';
    productionQuantity: number;
    qualifiedQuantity: number;
    unqualifiedQuantity: number;
    qualifiedRate: number;
    defectCounts: Record<string, number>;
  }>;
};

export type DetailQueryFilters = {
  startDate?: string;
  endDate?: string;
  productionLineId?: string;
  barcode?: string;
  partNumber?: string;
  result?: InspectionResult | '';
  defectReasonId?: string;
  page?: number;
  pageSize?: number;
};

export type ChangeLogFilters = {
  startDate?: string;
  endDate?: string;
  barcode?: string;
  operatorUsername?: string;
  page?: number;
  pageSize?: number;
};

export type DetailRecord = {
  id: string;
  scannedAt: string;
  productionLine: ProductionLineOption;
  barcode: string;
  vehicleModel: string | null;
  partNumber: string;
  result: InspectionResult;
  deductionAmount?: number;
  defectReasons: DefectReasonOption[];
  inspector: {
    id: string;
    username: string;
  };
  operatorProfile?: {
    id: string;
    employeeCode: string | null;
    name: string;
    employmentType: 'FORMAL' | 'LABOR';
  } | null;
};

export type DetailQueryResponse = {
  records: DetailRecord[];
  page: number;
  pageSize: number;
  total: number;
};

export type InspectionRecordChangeLog = {
  id: string;
  inspectionRecordId: string | null;
  operatedAt: string;
  barcode: string | null;
  partNumber: string | null;
  previousResult: InspectionResult | null;
  newResult: InspectionResult | null;
  defectReasons: DefectReasonOption[];
  module: string;
  action: string;
  targetType: string;
  targetLabel: string;
  before: unknown;
  after: unknown;
  operator: {
    id: string;
    username: string;
  };
};

export type ChangeLogQueryResponse = {
  logs: InspectionRecordChangeLog[];
  page: number;
  pageSize: number;
  total: number;
};
