export declare class SubscriptionCouponDto {
    code: string;
    label?: string;
    couponMode?: 'discount' | 'package';
    discountType: 'percent' | 'fixed';
    discountValue: number;
    planIds?: number[];
    status?: 'active' | 'inactive';
    startsAt?: string;
    expiresAt?: string;
    maxRedemptions?: number;
}
