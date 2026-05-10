import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionOptionDto {
  @IsString()
  @MinLength(1)
  optionLabel!: string;

  @IsString()
  @MinLength(1)
  optionText!: string;

  @IsIn([0, 1])
  isCorrect!: 0 | 1;

  @IsOptional()
  @IsString()
  whyIncorrect?: string | null;

  @IsOptional()
  @IsString()
  why_incorrect?: string | null;
}

export class CreateQuestionDto {
  @IsInt()
  courseId!: number;

  @IsInt()
  subjectId!: number;

  @IsOptional()
  @IsInt()
  topicId?: number | null;

  @IsOptional()
  @IsInt()
  lessonId?: number | null;

  @IsOptional()
  @IsInt()
  paperId?: number | null;

  @IsOptional()
  @IsString()
  topicLabel?: string;

  @IsString()
  @IsIn(['past', 'past_paper', 'mock', 'ai'])
  category!: 'past' | 'past_paper' | 'mock' | 'ai';

  @IsString()
  @IsIn(['sba', 'true_false'])
  questionType!: 'sba' | 'true_false';

  @IsString()
  @MinLength(1)
  questionText!: string;

  @IsOptional()
  @IsString()
  keywordsText?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];
}
