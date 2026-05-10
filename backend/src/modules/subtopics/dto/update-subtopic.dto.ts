import { PartialType } from '@nestjs/mapped-types';
import { CreateSubtopicDto } from './create-subtopic.dto';

export class UpdateSubtopicDto extends PartialType(CreateSubtopicDto) {}
