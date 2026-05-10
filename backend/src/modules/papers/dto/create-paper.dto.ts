import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreatePaperDto {
  @IsString()
  @MinLength(2)
  paperTitle!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsString()
  @IsIn(['local', 'erpm'])
  examSource!: 'local' | 'erpm';

  @IsOptional()
  @IsString()
  keywordsText?: string;

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
