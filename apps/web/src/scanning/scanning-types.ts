export type InspectionResult = 'QUALIFIED' | 'UNQUALIFIED';

export type ResolvedPart = {
  barcode: string;
  partNumber: string;
  vehicleModel: string;
};

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
