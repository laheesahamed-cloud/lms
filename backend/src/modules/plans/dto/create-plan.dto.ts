import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

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

  /// StoreKit product id this plan is sold as in the iOS app, e.g.
  /// `app.xyndrome.lk.yearly`. Empty or null unmaps it.
  ///
  /// This is what turns an Apple purchase into a subscription: redemption looks
  /// the plan up by this id, and a product with no plan carrying it is rejected
  /// after Apple has already charged. It used to be settable only by SQL, which
  /// is how the yearly product shipped unmapped.
  @IsOptional()
  @IsString()
  @MaxLength(191)
  appleProductId?: string | null;
}
