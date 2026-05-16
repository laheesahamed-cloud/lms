import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateAiQuizDto {
  @IsOptional()
  @IsInt()
  courseId?: number | null;

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

  @IsString()
  @IsIn(['past_paper', 'mock', 'ai'])
  category!: 'past_paper' | 'mock' | 'ai';

  @IsString()
  @IsIn(['sba', 'true_false'])
  questionType!: 'sba' | 'true_false';

  @IsString()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty!: 'easy' | 'medium' | 'hard';

  @IsInt()
  @Min(1)
  @Max(20)
  numberOfQuestions!: number;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsBoolean()
  includeExplanations?: boolean;

  @IsOptional()
  @IsBoolean()
  includeWhyIncorrect?: boolean;
}
