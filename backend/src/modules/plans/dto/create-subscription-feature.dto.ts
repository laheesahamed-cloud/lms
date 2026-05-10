import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUBSCRIPTION_FEATURE_CATEGORIES } from '../subscription-catalog';

export class CreateSubscriptionFeatureDto {
  @IsString()
  @MinLength(2)
  featureName!: string;

  @IsString()
  @MinLength(2)
  featureKey!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsIn([...SUBSCRIPTION_FEATURE_CATEGORIES])
  category!: (typeof SUBSCRIPTION_FEATURE_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
