import { IsNotEmpty, IsString } from 'class-validator';

export class LookupBarcodeDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;
}
