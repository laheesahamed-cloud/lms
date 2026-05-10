import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class RecordStudyActivityDto {
  @IsIn(['ai_note_viewed'])
  activityType!: 'ai_note_viewed';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  itemId?: number;
}
