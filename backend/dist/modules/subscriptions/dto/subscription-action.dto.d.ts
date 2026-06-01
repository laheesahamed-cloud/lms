export declare class ExtendSubscriptionDto {
    days: number;
    notes?: string;
}
export declare class RenewSubscriptionDto {
    planId: number;
    startDate?: string;
    endDate?: string;
    notes?: string;
    paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'free_plan';
}
export declare class CancelSubscriptionDto {
    notes?: string;
}
export declare class UpdateSubscriptionPaymentDto {
    paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'free_plan';
    amountPaid?: number;
    paymentMethod?: string;
    paymentReference?: string;
    paymentDate?: string;
    receiptUrl?: string;
}
