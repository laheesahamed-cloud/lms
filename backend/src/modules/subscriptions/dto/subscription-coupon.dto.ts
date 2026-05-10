import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SubscriptionCouponDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  label?: string;

  @IsString()
  @IsIn(['percent', 'fixed'])
  discountType!: 'percent' | 'fixed';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsString()
  @IsIn(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';

  @IsString()
  @IsOptional()
  startsAt?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxRedemptions?: number;
}
