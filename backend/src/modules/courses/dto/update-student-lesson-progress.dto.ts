import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateStudentLessonProgressDto {
  @IsIn(['not_started', 'in_progress', 'completed'])
  status!: 'not_started' | 'in_progress' | 'completed';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;

  /** Seconds the lesson screen was open, timed on the phone (OPTIMIZE 10.12). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  @IsOptional()
  readSeconds?: number;

  /** The lesson's subject, from the phone's catalogue (today's Study Hub row). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  subjectId?: number;
}
