import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAppOnlyContentSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
