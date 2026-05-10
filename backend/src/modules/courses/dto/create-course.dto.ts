import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  courseTitle!: string;

  @IsString()
  @MinLength(1)
  courseCode!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @MinLength(1)
  examType!: string;

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
