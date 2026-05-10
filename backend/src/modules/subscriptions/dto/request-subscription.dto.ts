import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RequestSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;

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

  @IsString()
  @IsOptional()
  @MaxLength(40)
  couponCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  billingName?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(191)
  billingEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  country?: string;
}
