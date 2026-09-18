import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ExplanationOptionDto {
  @IsString()
  optionLabel!: string;

  @IsString()
  optionText!: string;

  @IsOptional()
  isCorrect?: number | boolean;

  @IsOptional()
  @IsString()
  whyIncorrect?: string | null;
}

export class GenerateExplanationDto {
  @IsString()
  questionText!: string;

  @IsOptional()
  @IsString()
  questionType?: 'sba' | 'true_false';

  @IsString()
  correctAnswerLabel!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExplanationOptionDto)
  options!: ExplanationOptionDto[];

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  lesson?: string;
}
