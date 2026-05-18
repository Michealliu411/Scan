export type InspectionResult = 'QUALIFIED' | 'UNQUALIFIED';

export type ResolvedPart = {
  kind?: 'RESOLVED_PART';
  barcode: string;
  partNumber: string;
  vehicleModel: string;
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
  partNumber: string;
  vehicleModel: string | null;
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
  partNumber: string;
  vehicleModel?: string;
  operatorProfileId?: string;
  result: InspectionResult;
  defectReasonIds?: string[];
};
