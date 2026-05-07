import { Role, SpecialBarcodeType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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
