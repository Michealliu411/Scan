import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateDailyProductionPlanDto {
  @IsString()
  @IsOptional()
  businessDate?: string;

  @IsString()
  @IsNotEmpty()
  productionOrderNo!: string;

  @IsString()
  @IsNotEmpty()
  partNumber!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsNotEmpty()
  productionLineId!: string;

  @IsInt()
  @Min(1)
  orderQuantity!: number;

  @IsInt()
  @Min(1)
  plannedQuantity!: number;
}
