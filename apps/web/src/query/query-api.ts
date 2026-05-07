import { apiFetch } from '../api/client';
import {
  DashboardFilters,
  DashboardResponse,
  DefectReasonOption,
  DetailQueryFilters,
  DetailQueryResponse,
  ProductionLineOption
} from './query-types';

export function fetchDashboard(filters: DashboardFilters = {}): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`/analytics/dashboard${toQueryString(filters)}`);
}

export function fetchDetailRecords(filters: DetailQueryFilters = {}): Promise<DetailQueryResponse> {
  return apiFetch<DetailQueryResponse>(`/detail-query/records${toQueryString(filters)}`);
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
