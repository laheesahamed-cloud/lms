import { IsObject } from 'class-validator';

export class SubmitExamDto {
  @IsObject()
  answers!: Record<string, unknown>;
}
