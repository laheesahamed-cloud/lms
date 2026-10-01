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

  // Where the question sits in the syllabus. The frontend sends the same
  // payload shape to all three AI endpoints, and the other two declare these —
  // this one did not, so with forbidNonWhitelisted every why-incorrect call
  // was rejected with "property course should not exist" before it reached the
  // model. Generating an explanation or an approach on its own worked, which
  // is why this only ever showed up in a bulk run: that is the only path that
  // calls why-incorrect for every SBA question.
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
