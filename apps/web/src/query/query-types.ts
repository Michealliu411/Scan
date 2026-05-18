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

export type DetailQueryFilters = {
  startDate?: string;
  endDate?: string;
  productionLineId?: string;
  barcode?: string;
  partNumber?: string;
  result?: InspectionResult | '';
  defectReasonId?: string;
};

export type ChangeLogFilters = {
  startDate?: string;
  endDate?: string;
  barcode?: string;
  operatorUsername?: string;
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
  limit: number;
};

export type InspectionRecordChangeLog = {
  id: string;
  inspectionRecordId: string;
  operatedAt: string;
  barcode: string;
  partNumber: string;
  previousResult: InspectionResult;
  newResult: InspectionResult;
  defectReasons: DefectReasonOption[];
  operator: {
    id: string;
    username: string;
  };
};

export type ChangeLogQueryResponse = {
  logs: InspectionRecordChangeLog[];
  limit: number;
};
