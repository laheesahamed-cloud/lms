import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApnsSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  keyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  teamId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bundleId?: string;

  @IsOptional()
  @IsBoolean()
  useSandbox?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  privateKeyPath?: string;

  @IsOptional()
  @IsString()
  privateKey?: string;
}
