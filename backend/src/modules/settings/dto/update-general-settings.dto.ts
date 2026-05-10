import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsappNumber?: string;
}
