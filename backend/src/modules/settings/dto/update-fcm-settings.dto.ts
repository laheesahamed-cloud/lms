import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFcmSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  serverKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  serviceAccountPath?: string;

  @IsOptional()
  @IsString()
  serviceAccountJson?: string;
}
