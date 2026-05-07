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

export type DetailQueryFilters = {
  startDate?: string;
  endDate?: string;
  productionLineId?: string;
  barcode?: string;
  partNumber?: string;
  result?: InspectionResult | '';
  defectReasonId?: string;
};

export type DetailRecord = {
  id: string;
  scannedAt: string;
  productionLine: ProductionLineOption;
  barcode: string;
  vehicleModel: string | null;
  partNumber: string;
  result: InspectionResult;
  defectReasons: DefectReasonOption[];
  inspector: {
    id: string;
    username: string;
  };
};

export type DetailQueryResponse = {
  records: DetailRecord[];
  limit: number;
};
