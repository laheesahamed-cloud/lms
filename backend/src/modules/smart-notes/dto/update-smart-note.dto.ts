import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateSmartNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  rawText?: string;

  @IsOptional()
  processedQa?: Array<{ q: string; a: string }>;

  @IsOptional()
  infographicElements?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  representativeImageData?: string;

  @IsOptional()
  @IsString()
  representativeImagePrompt?: string;
}
