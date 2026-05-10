import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class BulkUpdateQuestionKeywordsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  questionIds!: number[];

  @IsString()
  keywordsText!: string;

  @IsOptional()
  @IsString()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';
}
