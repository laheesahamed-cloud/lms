import { IsIn, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateLessonDto {
  @IsInt()
  courseId!: number;

  @IsInt()
  topicId!: number;

  @IsInt()
  subtopicId!: number;

  @IsString()
  lessonTitle!: string;

  @IsOptional()
  @IsString()
  lessonContent?: string;

  @IsOptional()
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
    },
    { message: 'Video URL must be a valid URL with http:// or https://' }
  )
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  isFree?: 0 | 1;

  @IsString()
  status!: 'active' | 'inactive';
}
