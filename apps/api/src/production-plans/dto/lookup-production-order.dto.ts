import { IsNotEmpty, IsString } from 'class-validator';

export class LookupProductionOrderDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;
}
