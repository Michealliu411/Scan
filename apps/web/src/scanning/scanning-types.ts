export type InspectionResult = 'QUALIFIED' | 'UNQUALIFIED';

export type ResolvedPart = {
  kind?: 'RESOLVED_PART';
  barcode: string;
  partNumber: string;
  vehicleModel: string;
  source?: 'SIMULATED_LOOKUP' | 'NO_BARCODE_PRODUCT';
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
};

export type InspectionDetailRecord = {
  id: string;
  barcode: string;
  partNumber: string;
  vehicleModel: string | null;
  result: InspectionResult;
  scannedAt: string;
  defectReasons: string[];
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
  result: InspectionResult;
  defectReasonIds?: string[];
};
