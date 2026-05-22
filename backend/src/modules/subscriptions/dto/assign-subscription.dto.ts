import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AssignSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

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
  notes?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'pending', 'expired', 'cancelled'])
  status?: 'active' | 'pending' | 'expired' | 'cancelled';

  @IsString()
  @IsOptional()
  @IsIn(['manual', 'paid', 'unpaid', 'free_plan'])
  paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'free_plan';

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

  @IsString()
  @IsOptional()
  @IsIn(['all', 'courses', 'lessons'])
  accessScope?: 'all' | 'courses' | 'lessons';

  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsOptional()
  courseIds?: number[];

  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsOptional()
  lessonIds?: number[];
}
