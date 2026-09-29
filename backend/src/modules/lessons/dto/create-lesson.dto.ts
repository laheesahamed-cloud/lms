import { IsIn, IsInt, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateLessonDto {
  @IsInt()
  courseId!: number;

  @IsInt()
  topicId!: number;

  // Optional — a lesson can live directly under a subject (course + subject is enough).
  @IsOptional()
  @IsInt()
  subtopicId?: number;

  @IsString()
  lessonTitle!: string;

  @IsOptional()
  @IsString()
  lessonContent?: string;

  /**
   * Either an external link (YouTube, Vimeo) or a video uploaded here.
   *
   * An upload returns an app-relative path — `/uploads/video/lesson-3-…mp4` —
   * which has no protocol, so requiring http(s) rejected the app's own uploads
   * and every save straight after one failed with "must be a valid URL".
   */
  @IsOptional()
  @Matches(/^(?:https?:\/\/\S+|\/uploads\/video\/[A-Za-z0-9._-]+)$/, {
    message: 'Video must be an http:// or https:// link, or a video uploaded here',
  })
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  isFree?: 0 | 1;

  @IsString()
  status!: 'active' | 'inactive';
}
