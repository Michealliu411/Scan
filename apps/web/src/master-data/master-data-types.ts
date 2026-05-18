import { Role } from '../auth/auth-types';

export type ManagedUser = {
  id: string;
  username: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  referenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
};

export type ManagedDefectReason = {
  id: string;
  code: string;
  name: string;
  deductionAmount?: number;
  isActive: boolean;
  referenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type OperatorEmploymentType = 'FORMAL' | 'LABOR';

export type ManagedOperatorProfile = {
  id: string;
  employeeCode: string | null;
  name: string;
  pinyinInitials: string;
  employmentType: OperatorEmploymentType;
  isActive: boolean;
  referenced: boolean;
  canDelete: boolean;
};

export type ManagedProductionLine = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  referenced: boolean;
  canDelete: boolean;
};

export type SpecialBarcodeType = 'DIRTY' | 'NO_BARCODE_PRODUCT';

export type ManagedSpecialBarcode = {
  id: string;
  type: SpecialBarcodeType;
  barcode: string;
  vehicleModel: string | null;
  partNumber: string | null;
  defectReason: {
    id: string;
    code: string;
    name: string;
  } | null;
  isActive: boolean;
  referenced: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type MasterDataSnapshot = {
  users: ManagedUser[];
  defectReasons: ManagedDefectReason[];
  operators: ManagedOperatorProfile[];
  productionLines: ManagedProductionLine[];
  specialBarcodes: ManagedSpecialBarcode[];
};
