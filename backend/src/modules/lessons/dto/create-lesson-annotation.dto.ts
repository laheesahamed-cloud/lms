import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateLessonAnnotationDto {
  @IsString()
  @IsIn(['highlight', 'note'])
  type!: 'highlight' | 'note';

  @IsString()
  @MaxLength(1000)
  selectedText!: string;

  @IsInt()
  @Min(0)
  startOffset!: number;

  @IsInt()
  @Min(0)
  endOffset!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Annotation color must be a safe hex color' })
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  noteText?: string;
}
