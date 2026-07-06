import { IsOptional, IsString } from 'class-validator';

export class CopyDailyProductionPlansDto {
  @IsString()
  @IsOptional()
  sourceDate?: string;

  @IsString()
  @IsOptional()
  targetDate?: string;
}
