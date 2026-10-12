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

  // Optional like its siblings below, and nullable with them.
  //
  // A past paper is sat across a whole course, and a course-wide assessment
  // has no subject to give its questions — questions.topic_id is nullable in
  // the schema for exactly that reason. @IsInt() alone refused the null those
  // cases send, so the question could not be saved at all.
  @IsOptional()
  @IsInt()
  subjectId?: number | null;

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

  @IsOptional()
  @IsString()
  explanationImageUrl?: string | null;

  @IsOptional()
  @IsString()
  questionApproach?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionApproachHighlights?: string[];

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];
}
