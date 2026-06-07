export declare class UpdatePaymentSettingsDto {
    enabled?: boolean;
    sandboxMode?: boolean;
    merchantId?: string;
    merchantSecret?: string;
    currency?: 'LKR';
    returnUrl?: string;
    cancelUrl?: string;
    notifyUrl?: string;
    checkoutTitle?: string;
    buttonLabel?: string;
    supportText?: string;
    bankTransferDetails?: string;
    autoActivatePaidSubscriptions?: boolean;
}
