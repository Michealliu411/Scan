import { apiFetch } from '../api/client';
import {
  DefectReasonOption,
  InspectionDetailRecord,
  LookupBarcodeResponse,
  SubmitInspectionRecordPayload
} from './scanning-types';

type BackendInspectionRecord = Omit<InspectionDetailRecord, 'defectReasons'> & {
  defectReasons: Array<DefectReasonOption | string>;
};

export async function lookupBarcode(barcode: string): Promise<LookupBarcodeResponse> {
  const response = await apiFetch<LookupBarcodeResponse>('/scanning/lookup', {
    method: 'POST',
    body: JSON.stringify({ barcode })
  });

  if (response.kind === 'DIRTY_BARCODE_AUTO_SUBMITTED') {
    return {
      ...response,
      record: normalizeRecord(response.record as BackendInspectionRecord)
    };
  }

  return response;
}

export function fetchDefectReasons(): Promise<DefectReasonOption[]> {
  return apiFetch<DefectReasonOption[]>('/scanning/defect-reasons');
}

export async function fetchTodayRecords(): Promise<InspectionDetailRecord[]> {
  const records = await apiFetch<BackendInspectionRecord[]>('/scanning/today-records');
  return records.map((record) => normalizeRecord(record));
}

export async function submitInspectionRecord(
  payload: SubmitInspectionRecordPayload
): Promise<InspectionDetailRecord> {
  const record = await apiFetch<BackendInspectionRecord>('/scanning/records', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return normalizeRecord(record);
}

function normalizeRecord(record: BackendInspectionRecord): InspectionDetailRecord {
  return {
    ...record,
    defectReasons: record.defectReasons.map((reason) =>
      typeof reason === 'string' ? reason : reason.name
    )
  };
}
