export declare class RequestSubscriptionDto {
    planId: number;
    userId?: number;
    message?: string;
    accessScope?: 'all' | 'courses' | 'lessons';
    courseIds?: number[];
    lessonIds?: number[];
    couponCode?: string;
    billingName?: string;
    billingEmail?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
}
