export declare class ManualPaymentRequestDto {
    planId: number;
    couponCode?: string;
    billingName?: string;
    billingEmail?: string;
    phone?: string;
    paymentReference?: string;
    proofFileName?: string;
    proofMimeType?: string;
    proofDataUrl: string;
    message?: string;
    accessScope?: 'all' | 'courses' | 'lessons';
    courseIds?: number[];
    lessonIds?: number[];
}
