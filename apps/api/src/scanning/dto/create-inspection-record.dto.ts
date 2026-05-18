import { InspectionResult } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInspectionRecordDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsString()
  @IsNotEmpty()
  partNumber!: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @IsString()
  @IsOptional()
  operatorProfileId?: string;

  @IsEnum(InspectionResult)
  result!: InspectionResult;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  defectReasonIds?: string[];
}
