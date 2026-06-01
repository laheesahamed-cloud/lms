import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateAvailabilitySettingsDto {
  @IsOptional()
  @IsIn(['live', 'maintenance', 'coming-soon'])
  mode?: 'live' | 'maintenance' | 'coming-soon';

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  @Matches(/^\d+$/, { message: 'Unlock code must contain digits only' })
  unlockCode?: string;
}

export class VerifyAvailabilityUnlockDto {
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  @Matches(/^\d+$/, { message: 'Unlock code must contain digits only' })
  code!: string;
}
