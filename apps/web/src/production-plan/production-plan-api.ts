import { apiFetch } from '../api/client';
import {
  CopyDailyProductionPlansInput,
  CopyDailyProductionPlansResponse,
  CreateDailyProductionPlanInput,
  DailyProductionPlan,
  ProductionOrderLookup,
  ProductionLineOption,
  ProductionPlanFilters,
  UpdateDailyProductionPlanInput
} from './production-plan-types';

export function lookupProductionOrder(barcode: string): Promise<ProductionOrderLookup> {
  return apiFetch<ProductionOrderLookup>('/production-plans/lookup', {
    method: 'POST',
    body: JSON.stringify({ barcode })
  });
}

export function fetchDailyProductionPlans(filters: ProductionPlanFilters = {}): Promise<DailyProductionPlan[]> {
  return apiFetch<DailyProductionPlan[]>(`/production-plans${toQueryString(filters)}`);
}

export function fetchProductionPlanLines(): Promise<ProductionLineOption[]> {
  return apiFetch<ProductionLineOption[]>('/production-lines');
}

export function createDailyProductionPlan(input: CreateDailyProductionPlanInput): Promise<DailyProductionPlan> {
  return apiFetch<DailyProductionPlan>('/production-plans', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateDailyProductionPlan(id: string, input: UpdateDailyProductionPlanInput): Promise<DailyProductionPlan> {
  return apiFetch<DailyProductionPlan>(`/production-plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function closeDailyProductionPlan(id: string): Promise<DailyProductionPlan> {
  return apiFetch<DailyProductionPlan>(`/production-plans/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function reopenDailyProductionPlan(id: string): Promise<DailyProductionPlan> {
  return apiFetch<DailyProductionPlan>(`/production-plans/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function copyDailyProductionPlans(input: CopyDailyProductionPlansInput): Promise<CopyDailyProductionPlansResponse> {
  return apiFetch<CopyDailyProductionPlansResponse>('/production-plans/copy', {
    method: 'POST',
    body: JSON.stringify(input)
  });
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
