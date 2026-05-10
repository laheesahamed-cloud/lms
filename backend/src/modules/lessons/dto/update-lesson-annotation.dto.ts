import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateLessonAnnotationDto {
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
