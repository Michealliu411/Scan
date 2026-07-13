export type InspectionResult = 'QUALIFIED' | 'UNQUALIFIED';
export type DailyPlanScanStatus = 'ACTIVE' | 'CLOSED' | 'MISSING';

export type DailyPlanScanSummary = {
  status: DailyPlanScanStatus;
  businessDate: string;
  productionOrderNo: string;
  productionLine?: {
    id: string;
    code: string;
    name: string;
  };
  plannedQuantity: number;
  qualifiedCount: number;
  unqualifiedCount: number;
  remainingQuantity: number;
};

export type ResolvedPart = {
  kind?: 'RESOLVED_PART';
  barcode: string;
  partNumber: string;
  productName?: string | null;
  vehicleModel: string | null;
  partName?: string | null;
  productionOrderNo?: string;
  orderQuantity?: number;
  dailyPlan?: DailyPlanScanSummary;
  source?: 'SIMULATED_LOOKUP' | 'NO_BARCODE_PRODUCT' | 'PRODUCTION_ORDER_LOOKUP';
};

export type DirtyBarcodeAutoSubmitted = {
  kind: 'DIRTY_BARCODE_AUTO_SUBMITTED';
  record: InspectionDetailRecord;
};

export type LookupBarcodeResponse = ResolvedPart | DirtyBarcodeAutoSubmitted;

export type DefectReasonOption = {
  id: string;
  code: string;
  name: string;
  deductionAmount?: number;
};

export type OperatorOption = {
  id: string;
  employeeCode: string | null;
  name: string;
  pinyinInitials: string;
  employmentType: 'FORMAL' | 'LABOR';
};

export type InspectionDetailRecord = {
  id: string;
  barcode: string;
  productionOrderNo?: string | null;
  dailyProductionPlanId?: string | null;
  partNumber: string;
  productName?: string | null;
  vehicleModel: string | null;
  partName?: string | null;
  result: InspectionResult;
  deductionAmount?: number;
  scannedAt: string;
  defectReasons: string[];
  operatorProfile?: OperatorOption | null;
};

export type DuplicateQualifiedDetails = {
  scannedAt: string;
  productionLineName: string;
  inspectorUsername: string;
};

export type SubmitInspectionRecordPayload = {
  barcode: string;
  productionOrderNo?: string;
  partNumber: string;
  productName?: string;
  vehicleModel?: string;
  partName?: string;
  operatorProfileId?: string;
  result: InspectionResult;
  defectReasonIds?: string[];
};
