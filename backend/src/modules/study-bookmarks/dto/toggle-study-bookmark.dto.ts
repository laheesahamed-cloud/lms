import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class ToggleStudyBookmarkDto {
  @IsIn(['quiz', 'ai_note', 'question'])
  itemType!: 'quiz' | 'ai_note' | 'question';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;
}
