import { IsArray, IsString } from 'class-validator';

export class ReclassifyInspectionRecordDto {
  @IsArray()
  @IsString({ each: true })
  defectReasonIds!: string[];
}
