import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateSmartNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  rawText?: string;
}
