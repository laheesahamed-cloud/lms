import { IsIn, IsInt, IsString, MinLength } from 'class-validator';

export class CreateSubtopicDto {
  @IsInt()
  topicId!: number;

  @IsString()
  @MinLength(1)
  subtopicName!: string;

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
