import { apiFetch } from '../api/client';
import {
  DefectReasonOption,
  InspectionDetailRecord,
  ResolvedPart,
  SubmitInspectionRecordPayload
} from './scanning-types';

type BackendInspectionRecord = Omit<InspectionDetailRecord, 'defectReasons'> & {
  defectReasons: Array<DefectReasonOption | string>;
};

export function lookupBarcode(barcode: string): Promise<ResolvedPart> {
  return apiFetch<ResolvedPart>('/scanning/lookup', {
    method: 'POST',
    body: JSON.stringify({ barcode })
  });
}

export function fetchDefectReasons(): Promise<DefectReasonOption[]> {
  return apiFetch<DefectReasonOption[]>('/scanning/defect-reasons');
}

export async function fetchTodayRecords(): Promise<InspectionDetailRecord[]> {
  const records = await apiFetch<BackendInspectionRecord[]>('/scanning/today-records');
  return records.map((record) => ({
    ...record,
    defectReasons: record.defectReasons.map((reason) =>
      typeof reason === 'string' ? reason : reason.name
    )
  }));
}

export async function submitInspectionRecord(
  payload: SubmitInspectionRecordPayload
): Promise<InspectionDetailRecord> {
  const record = await apiFetch<BackendInspectionRecord>('/scanning/records', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return {
    ...record,
    defectReasons: record.defectReasons.map((reason) =>
      typeof reason === 'string' ? reason : reason.name
    )
  };
}
