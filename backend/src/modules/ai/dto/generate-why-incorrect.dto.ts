import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
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
  @IsOptional()
  @IsString()
  @IsIn(['sba', 'true_false'])
  questionType?: 'sba' | 'true_false';

  @IsString()
  questionText!: string;

  @IsOptional()
  @IsString()
  correctAnswerLabel?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhyIncorrectOptionDto)
  options!: WhyIncorrectOptionDto[];
}
