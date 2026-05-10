import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  regularPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offerPrice?: number | null;

  @Type(() => Boolean)
  @IsBoolean()
  offerEnabled!: boolean;

  @IsString()
  @MinLength(1)
  @IsOptional()
  currency?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays!: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  featureIds?: number[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  recommended?: boolean;

  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
