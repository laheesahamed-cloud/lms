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
}
