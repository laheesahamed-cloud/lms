import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class SaveExamProgressDto {
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  currentQuestionIndex?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  flaggedQuestionIds?: number[];

}
