import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateQuizDto {
  @IsInt()
  courseId!: number;

  @IsOptional()
  @IsInt()
  topicId?: number | null;

  @IsOptional()
  @IsString()
  subtopic?: string;

  @IsOptional()
  @IsInt()
  subtopicId?: number | null;

  @IsOptional()
  @IsInt()
  lessonId?: number | null;

  @IsOptional()
  @IsInt()
  paperId?: number | null;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  collectionTags?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  isFree?: 0 | 1;

  @IsInt()
  @IsIn([0, 1])
  isGeneral!: 0 | 1;

  @IsInt()
  @IsIn([0, 1])
  examModeOnly!: 0 | 1;

  @IsOptional()
  @IsString()
  adminName!: string;

  @IsOptional()
  @IsString()
  studentTitle!: string;

  @IsOptional()
  @IsString()
  @IsIn(['number', 'title'])
  displayTitleMode?: 'number' | 'title';

  @IsOptional()
  @IsInt()
  @Min(1)
  quizNumber?: number | null;

  @IsOptional()
  @IsString()
  quizTitle?: string;

  @IsOptional()
  @IsString()
  quizDescription?: string;

  @IsOptional()
  blueprint?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @IsIn(['static', 'dynamic'])
  randomizationMode?: 'static' | 'dynamic';

  @IsInt()
  @Min(1)
  timeLimit!: number;

  @IsInt()
  @IsIn([0, 1])
  hideTimeLimit!: 0 | 1;

  @IsInt()
  @Min(0)
  @Max(100)
  passingMarks!: number;

  @IsInt()
  @IsIn([0, 1])
  hidePassingMarks!: 0 | 1;

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';

  @IsArray()
  @IsInt({ each: true })
  questionIds!: number[];
}
