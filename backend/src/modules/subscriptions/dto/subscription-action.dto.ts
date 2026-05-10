import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ExtendSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class RenewSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsString()
  @IsOptional()
  @IsIn(['manual', 'paid', 'unpaid', 'waived'])
  paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'waived';
}

export class CancelSubscriptionDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateSubscriptionPaymentDto {
  @IsString()
  @IsOptional()
  @IsIn(['manual', 'paid', 'unpaid', 'waived'])
  paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'waived';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPaid?: number;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  @MaxLength(191)
  paymentReference?: string;

  @IsString()
  @IsOptional()
  paymentDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  receiptUrl?: string;
}
