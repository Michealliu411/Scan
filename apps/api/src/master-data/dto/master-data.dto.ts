import { OperatorEmploymentType, Role, SpecialBarcodeType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength
} from 'class-validator';

export class CreateManagedUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateManagedUserDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  username?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ResetManagedUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class CreateDefectReasonDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deductionAmount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateDefectReasonDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deductionAmount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateOperatorProfileDto {
  @IsString()
  @IsOptional()
  employeeCode?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  pinyinInitials?: string;

  @IsEnum(OperatorEmploymentType)
  employmentType!: OperatorEmploymentType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateOperatorProfileDto {
  @IsString()
  @IsOptional()
  employeeCode?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  pinyinInitials?: string;

  @IsEnum(OperatorEmploymentType)
  @IsOptional()
  employmentType?: OperatorEmploymentType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ImportOperatorProfilesDto {
  @IsArray()
  rows!: CreateOperatorProfileDto[];
}

export class CreateProductionLineDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProductionLineDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateSpecialBarcodeDto {
  @IsEnum(SpecialBarcodeType)
  type!: SpecialBarcodeType;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  barcode!: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @IsString()
  @IsOptional()
  partNumber?: string;

  @IsString()
  @IsOptional()
  defectReasonId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSpecialBarcodeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @IsString()
  @IsOptional()
  partNumber?: string;

  @IsString()
  @IsOptional()
  defectReasonId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
