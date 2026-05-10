import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

export class ToggleStudyBookmarkDto {
  @IsIn(['quiz', 'ai_note'])
  itemType!: 'quiz' | 'ai_note';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;
}
