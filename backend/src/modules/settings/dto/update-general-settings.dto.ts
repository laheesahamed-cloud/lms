import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  whatsappNumber?: string;

  @IsOptional()
  @IsBoolean()
  newContentNotifications?: boolean;
}
