import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WhyIncorrectOptionDto {
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

export class GenerateWhyIncorrectDto {
  @IsString()
  questionText!: string;

  @IsString()
  correctAnswerLabel!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhyIncorrectOptionDto)
  options!: WhyIncorrectOptionDto[];
}
