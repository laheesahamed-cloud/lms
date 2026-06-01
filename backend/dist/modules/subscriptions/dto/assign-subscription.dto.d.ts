export declare class AssignSubscriptionDto {
    userId: number;
    planId: number;
    startDate?: string;
    endDate?: string;
    notes?: string;
    status?: 'active' | 'pending' | 'expired' | 'cancelled';
    paymentStatus?: 'manual' | 'paid' | 'unpaid' | 'free_plan';
    amountPaid?: number;
    paymentMethod?: string;
    paymentReference?: string;
    paymentDate?: string;
    receiptUrl?: string;
    accessScope?: 'all' | 'courses' | 'lessons';
    courseIds?: number[];
    lessonIds?: number[];
}
