import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTopicDto {
  @IsInt()
  courseId!: number;

  @IsString()
  @MinLength(2)
  topicName!: string;

  @IsString()
  @IsOptional()
  topicDescription?: string;

  @IsString({ each: true })
  @IsOptional()
  subtopics?: string[];

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
