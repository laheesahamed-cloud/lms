import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sandboxMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  merchantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  merchantSecret?: string;

  @IsOptional()
  @IsIn(['LKR', 'USD'])
  currency?: 'LKR' | 'USD';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  returnUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancelUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notifyUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  checkoutTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportText?: string;

  @IsOptional()
  @IsBoolean()
  autoActivatePaidSubscriptions?: boolean;
}
