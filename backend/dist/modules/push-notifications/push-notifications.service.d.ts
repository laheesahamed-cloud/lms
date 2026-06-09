import { ConfigService } from '@nestjs/config';
import { Pool } from 'mysql2/promise';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
type DeliveryMode = 'inside' | 'outside' | 'both';
type AdminDeliveryType = 'inside' | 'outside' | 'both';
type PushPayload = {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    channelId?: string;
    data?: Record<string, unknown>;
};
export declare class PushNotificationsService {
    private readonly db;
    private readonly authService;
    private readonly configService;
    private readonly settingsService;
    private readonly logger;
    private readonly nativePushSender;
    constructor(db: Pool, authService: AuthService, configService: ConfigService, settingsService: SettingsService);
    getPublicConfig(): {
        enabled: boolean;
        publicKey: string;
    };
    getSettings(authorization?: string): Promise<{
        supported: boolean;
        vapidEnabled: boolean;
        deliveryMode: DeliveryMode;
        outsideEnabled: boolean;
        nativeEnabled: boolean;
    }>;
    updateSettings(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        deliveryMode: DeliveryMode;
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
    private summarizeNativePushError;
    subscribe(authorization: string | undefined, input: any, userAgent?: string): Promise<{
        ok: boolean;
        reason: string;
    }>;
    unsubscribe(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
    }>;
    saveNativeToken(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        deliveryMode: DeliveryMode;
        nativeEnabled: boolean;
    }>;
    deleteNativeToken(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
    }>;
    sendAdminNotification(authorization: string | undefined, input: any): Promise<{
        ok: boolean;
        deliveryType: AdminDeliveryType;
        inAppCreated: number;
        sent: number;
        failed: number;
        reason: string | undefined;
    }>;
    sendAnnouncementPush(input: {
        title: string;
        body: string;
        targetRole: 'all' | 'student' | 'admin';
        url?: string;
    }): Promise<{
        ok: boolean;
        sent: number;
        failed: number;
        reason: string;
    } | {
        ok: boolean;
        sent: number;
        failed: number;
        reason?: undefined;
    }>;
    sendToAudience(payload: PushPayload, audience?: {
        targetRole?: string;
        userIds?: number[];
    }): Promise<{
        ok: boolean;
        sent: number;
        failed: number;
        reason: string;
    } | {
        ok: boolean;
        sent: number;
        failed: number;
        reason?: undefined;
    }>;
    private sendNativeToAudience;
    private normalizePayload;
    private withDefaults;
    private inferAndroidChannelId;
    private normalizeAndroidChannelId;
    private normalizeDeliveryMode;
    private normalizeAdminDeliveryType;
    private normalizeTargetRole;
    private normalizeNativePlatform;
    private safeInternalPath;
    private hashEndpoint;
    private markNativeTokenFailure;
    private hasEnabledNativeToken;
    private createInAppAnnouncement;
}
export {};
