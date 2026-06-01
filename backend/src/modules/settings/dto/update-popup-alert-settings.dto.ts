import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePopupAlertSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['landing', 'login', 'app', 'all'])
  placement?: 'landing' | 'login' | 'app' | 'all';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  buttonUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageAlt?: string;

  @IsOptional()
  @IsString()
  imageDataUrl?: string;

  @IsOptional()
  @IsString()
  imageFileName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6000)
  imageWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6000)
  imageHeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3_000_000)
  imageBytes?: number;
}
