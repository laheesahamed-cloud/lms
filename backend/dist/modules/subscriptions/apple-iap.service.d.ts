export type AppleEnvironment = 'Production' | 'Sandbox';
export interface AppleTransaction {
    transactionId: string;
    originalTransactionId: string;
    productId: string;
    bundleId: string;
    environment: AppleEnvironment;
    purchaseDate: number | null;
    expiresDate: number | null;
    revocationDate: number | null;
    revocationReason: number | null;
    type: string;
    appAccountToken: string | null;
}
export interface AppleNotification {
    notificationType: string;
    subtype: string;
    notificationUUID: string;
    bundleId: string;
    environment: AppleEnvironment;
    signedTransactionInfo: string | null;
    signedRenewalInfo: string | null;
}
export declare class AppleIapService {
    private readonly logger;
    private readonly bundleId;
    private readonly allowSandbox;
    verifyTransaction(jws: string): AppleTransaction;
    verifyNotification(signedPayload: string): AppleNotification;
    isEntitled(transaction: AppleTransaction, now?: number): boolean;
    protected trustAnchor(): {
        pem: string;
        fingerprint: string;
    };
    private verifyJws;
    private verifyChain;
    private parseCertificate;
    private fingerprint;
    private derFromJoseSignature;
    private trimInteger;
    private assertBundleId;
    private assertEnvironment;
    private decodeJson;
    private str;
    private epoch;
}
