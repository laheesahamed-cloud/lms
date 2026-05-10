import { IsOptional, IsString, MinLength } from 'class-validator';

export class BeautifyLessonDto {
  @IsOptional()
  @IsString()
  lessonTitle?: string;

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
  subtopic?: string;

  @IsString()
  @MinLength(20)
  lessonContent!: string;
}
