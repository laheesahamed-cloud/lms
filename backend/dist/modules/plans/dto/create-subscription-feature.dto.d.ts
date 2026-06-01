import { SUBSCRIPTION_FEATURE_CATEGORIES } from '../subscription-catalog';
export declare class CreateSubscriptionFeatureDto {
    featureName: string;
    featureKey: string;
    description?: string;
    category: (typeof SUBSCRIPTION_FEATURE_CATEGORIES)[number];
    status?: 'active' | 'inactive';
}
