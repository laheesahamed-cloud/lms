import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAiModelDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  model!: string;
}
