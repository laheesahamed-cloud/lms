import { PushNotificationsService } from './push-notifications.service';
export declare class PushNotificationsController {
    private readonly pushNotificationsService;
    constructor(pushNotificationsService: PushNotificationsService);
    getVapidPublicKey(): {
        enabled: boolean;
        publicKey: string;
    };
    getSettings(authorization?: string): Promise<{
        supported: boolean;
        vapidEnabled: boolean;
        deliveryMode: "outside" | "inside" | "both";
        outsideEnabled: boolean;
        nativeEnabled: boolean;
    }>;
    getAdminStatus(authorization?: string): Promise<{
        vapidEnabled: boolean;
        publicKeyConfigured: boolean;
        privateKeyConfigured: boolean;
        subject: string;
        totalSubscriptions: number;
        activeSubscriptions: number;
        phoneSubscriptions: number;
        insideOnlySubscriptions: number;
        phoneUsers: number;
        nativePushConfigured: boolean;
        iosNativePushConfigured: boolean;
        androidNativePushConfigured: boolean;
        nativePushUsers: number;
        nativePushTokens: number;
        failedNativeTokens: number;
        recentNativeErrors: {
            platform: string;
            enabled: boolean;
            deliveryMode: string;
            reason: string;
            failedAt: any;
        }[];
        defaultIcon: string;
        defaultBadge: string;
    }>;
    updateSettings(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
        deliveryMode: "outside" | "inside" | "both";
    }>;
    subscribe(authorization: string | undefined, userAgent: string | undefined, body: any): Promise<{
        ok: boolean;
        reason: string;
    }>;
    unsubscribe(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
    }>;
    saveNativeToken(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
        deliveryMode: "outside" | "inside" | "both";
        nativeEnabled: boolean;
    }>;
    deleteNativeToken(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
    }>;
    sendAdminNotification(authorization: string | undefined, body: any): Promise<{
        ok: boolean;
        deliveryType: "outside" | "inside" | "both";
        inAppCreated: number;
        sent: number;
        failed: number;
        reason: string | undefined;
    }>;
}
