import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class SavePracticeDto {
  @IsInt()
  questionId!: number;

  @IsInt()
  questionIndex!: number;

  @IsString()
  @IsIn(['sba', 'true_false'])
  questionType!: 'sba' | 'true_false';

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  selected?: number[];

  @IsOptional()
  @IsObject()
  tfAnswers?: Record<string, number | string>;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;
}
