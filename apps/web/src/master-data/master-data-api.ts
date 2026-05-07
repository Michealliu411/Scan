import { apiFetch } from '../api/client';
import { Role } from '../auth/auth-types';
import {
  ManagedDefectReason,
  ManagedProductionLine,
  ManagedSpecialBarcode,
  ManagedUser,
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
  isActive: boolean;
}): Promise<ManagedDefectReason> {
  return apiFetch<ManagedDefectReason>('/master-data/defect-reasons', {
    method: 'POST',
    body: JSON.stringify(input)
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
