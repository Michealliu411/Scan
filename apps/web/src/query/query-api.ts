import { apiFetch } from '../api/client';
import {
  ChangeLogFilters,
  ChangeLogQueryResponse,
  DashboardFilters,
  DashboardResponse,
  DefectReasonOption,
  DetailRecord,
  DetailQueryFilters,
  DetailQueryResponse,
  ProductionLineOption,
  QualityDailyReportFilters,
  QualityDailyReportResponse
} from './query-types';

export function fetchDashboard(filters: DashboardFilters = {}): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`/analytics/dashboard${toQueryString(filters)}`);
}

export function fetchQualityDailyReport(
  filters: QualityDailyReportFilters
): Promise<QualityDailyReportResponse> {
  return apiFetch<QualityDailyReportResponse>(`/analytics/quality-daily-report${toQueryString(filters)}`);
}

export function fetchDetailRecords(filters: DetailQueryFilters = {}): Promise<DetailQueryResponse> {
  return apiFetch<DetailQueryResponse>(`/detail-query/records${toQueryString(filters)}`);
}

export function reclassifyInspectionRecord(recordId: string, defectReasonIds: string[]): Promise<DetailRecord> {
  return apiFetch<DetailRecord>(`/detail-query/records/${recordId}/reclassify-unqualified`, {
    method: 'POST',
    body: JSON.stringify({ defectReasonIds })
  });
}

export function updateUnqualifiedRecordReasons(recordId: string, defectReasonIds: string[]): Promise<DetailRecord> {
  return apiFetch<DetailRecord>(`/detail-query/records/${recordId}/update-unqualified-reasons`, {
    method: 'POST',
    body: JSON.stringify({ defectReasonIds })
  });
}

export function fetchInspectionRecordChangeLogs(
  filters: ChangeLogFilters = {}
): Promise<ChangeLogQueryResponse> {
  return apiFetch<ChangeLogQueryResponse>(`/detail-query/change-logs${toQueryString(filters)}`);
}

export function fetchQueryProductionLines(): Promise<ProductionLineOption[]> {
  return apiFetch<ProductionLineOption[]>('/production-lines');
}

export function fetchQueryDefectReasons(): Promise<DefectReasonOption[]> {
  return apiFetch<DefectReasonOption[]>('/detail-query/defect-reasons');
}

function toQueryString(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') {
      continue;
    }

    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}
