import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkDeleteQuizzesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Type(() => Number)
  quizIds!: number[];

  /// false (default): delete the assessments only, every question stays in the bank.
  /// true: also delete the questions that belong ONLY to these assessments.
  @IsOptional()
  @IsBoolean()
  deleteQuestions?: boolean;
}
