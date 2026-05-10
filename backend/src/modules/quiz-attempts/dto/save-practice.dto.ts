import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString } from 'class-validator';

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
}
