import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordStudyActivityDto {
  @IsIn(['ai_note_viewed', 'lesson_viewed', 'ai_note_protection_attempt', 'lesson_protection_attempt'])
  activityType!: 'ai_note_viewed' | 'lesson_viewed' | 'ai_note_protection_attempt' | 'lesson_protection_attempt';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  itemId?: number;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  eventType?: string;
}
