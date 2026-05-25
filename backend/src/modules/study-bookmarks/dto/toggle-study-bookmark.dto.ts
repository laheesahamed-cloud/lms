import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

export class ToggleStudyBookmarkDto {
  @IsIn(['quiz', 'ai_note', 'question'])
  itemType!: 'quiz' | 'ai_note' | 'question';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;
}
