import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkQuizStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Type(() => Number)
  quizIds!: number[];

  /// 'active' = approve / publish drafts to students. 'inactive' = move back to draft.
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
