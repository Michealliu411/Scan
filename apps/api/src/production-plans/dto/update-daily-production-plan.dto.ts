import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDailyProductionPlanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedQuantity?: number;

  @IsOptional()
  @IsString()
  productionLineId?: string;
}
