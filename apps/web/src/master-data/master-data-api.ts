import { apiFetch } from '../api/client';
import { Role } from '../auth/auth-types';
import {
  ManagedDefectReason,
  ManagedOperatorProfile,
  ManagedProductionLine,
  ManagedSpecialBarcode,
  ManagedUser,
  OperatorEmploymentType,
  SpecialBarcodeType
} from './master-data-types';

export function fetchManagedUsers(): Promise<ManagedUser[]> {
  return apiFetch<ManagedUser[]>('/master-data/users');
}

export function createManagedUser(input: {
  username: string;
  password: string;
  role: Role;
  isActive: boolean;
}): Promise<ManagedUser> {
  return apiFetch<ManagedUser>('/master-data/users', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateManagedUser(
  id: string,
  input: Partial<{
    username: string;
    role: Role;
    isActive: boolean;
  }>
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/master-data/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function deleteManagedUser(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/master-data/users/${id}`, {
    method: 'DELETE'
  });
}

export function resetManagedUserPassword(userId: string, password: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/master-data/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export function fetchManagedDefectReasons(): Promise<ManagedDefectReason[]> {
  return apiFetch<ManagedDefectReason[]>('/master-data/defect-reasons');
}

export function createDefectReason(input: {
  code: string;
  name: string;
  deductionAmount?: number;
  isActive: boolean;
}): Promise<ManagedDefectReason> {
  return apiFetch<ManagedDefectReason>('/master-data/defect-reasons', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateDefectReason(
  id: string,
  input: Partial<{
    code: string;
    name: string;
    deductionAmount: number;
    isActive: boolean;
  }>
): Promise<ManagedDefectReason> {
  return apiFetch<ManagedDefectReason>(`/master-data/defect-reasons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function deleteDefectReason(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/master-data/defect-reasons/${id}`, {
    method: 'DELETE'
  });
}

export function fetchManagedOperators(): Promise<ManagedOperatorProfile[]> {
  return apiFetch<ManagedOperatorProfile[]>('/master-data/operators');
}

export function createOperatorProfile(input: {
  employeeCode?: string;
  name: string;
  pinyinInitials?: string;
  employmentType: OperatorEmploymentType;
  isActive: boolean;
}): Promise<ManagedOperatorProfile> {
  return apiFetch<ManagedOperatorProfile>('/master-data/operators', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateOperatorProfile(
  id: string,
  input: Partial<{
    employeeCode: string;
    name: string;
    pinyinInitials: string;
    employmentType: OperatorEmploymentType;
    isActive: boolean;
  }>
): Promise<ManagedOperatorProfile> {
  return apiFetch<ManagedOperatorProfile>(`/master-data/operators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function importOperatorProfiles(
  rows: Array<{
    employeeCode?: string;
    name: string;
    pinyinInitials?: string;
    employmentType: OperatorEmploymentType;
    isActive?: boolean;
  }>
): Promise<{ created: number; updated: number }> {
  return apiFetch<{ created: number; updated: number }>('/master-data/operators/import', {
    method: 'POST',
    body: JSON.stringify({ rows })
  });
}

export function deleteOperatorProfile(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/master-data/operators/${id}`, {
    method: 'DELETE'
  });
}

export function fetchManagedProductionLines(): Promise<ManagedProductionLine[]> {
  return apiFetch<ManagedProductionLine[]>('/master-data/production-lines');
}

export function createProductionLine(input: {
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<ManagedProductionLine> {
  return apiFetch<ManagedProductionLine>('/master-data/production-lines', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateProductionLine(
  id: string,
  input: Partial<{
    code: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
  }>
): Promise<ManagedProductionLine> {
  return apiFetch<ManagedProductionLine>(`/master-data/production-lines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function deleteProductionLine(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/master-data/production-lines/${id}`, {
    method: 'DELETE'
  });
}

export function fetchManagedSpecialBarcodes(): Promise<ManagedSpecialBarcode[]> {
  return apiFetch<ManagedSpecialBarcode[]>('/master-data/special-barcodes');
}

export function generateSpecialBarcode(): Promise<{ barcode: string }> {
  return apiFetch<{ barcode: string }>('/master-data/special-barcodes/generate', {
    method: 'POST'
  });
}

export function createSpecialBarcode(input: {
  type: SpecialBarcodeType;
  barcode: string;
  vehicleModel?: string;
  partNumber?: string;
  defectReasonId?: string;
  isActive: boolean;
}): Promise<ManagedSpecialBarcode> {
  return apiFetch<ManagedSpecialBarcode>('/master-data/special-barcodes', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateSpecialBarcode(
  id: string,
  input: Partial<{
    barcode: string;
    vehicleModel: string;
    partNumber: string;
    defectReasonId: string;
    isActive: boolean;
  }>
): Promise<ManagedSpecialBarcode> {
  return apiFetch<ManagedSpecialBarcode>(`/master-data/special-barcodes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function deleteSpecialBarcode(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/master-data/special-barcodes/${id}`, {
    method: 'DELETE'
  });
}
