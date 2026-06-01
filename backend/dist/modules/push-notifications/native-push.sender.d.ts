import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
type NativePlatform = 'ios' | 'android' | 'unknown';
type ApnsRuntimeSettings = {
    keyId: string;
    teamId: string;
    bundleId: string;
    useSandbox: boolean;
    privateKeyPath: string;
    privateKey: string;
};
type FcmRuntimeSettings = {
    projectId: string;
    serverKey: string;
    serviceAccountPath: string;
    serviceAccountJson: string;
};
export type NativePushPayload = {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    channelId?: string;
    data?: Record<string, unknown>;
};
export type NativePushSendResult = {
    ok: boolean;
    statusCode?: number;
    error?: string;
};
export declare class NativePushSender {
    private readonly configService;
    private readonly logger;
    private readonly getApnsRuntimeSettings?;
    private readonly getFcmRuntimeSettings?;
    private fcmAccessToken;
    constructor(configService: ConfigService, logger: Logger, getApnsRuntimeSettings?: (() => Promise<ApnsRuntimeSettings>) | undefined, getFcmRuntimeSettings?: (() => Promise<FcmRuntimeSettings>) | undefined);
    isConfigured(): Promise<boolean>;
    isConfiguredFor(platform: NativePlatform): Promise<boolean>;
    send(platform: NativePlatform, token: string, payload: NativePushPayload): Promise<NativePushSendResult>;
    private isApnsConfigured;
    private isFcmConfigured;
    private sendApns;
    private sendFcm;
    private sendFcmLegacy;
    private getFcmAccessToken;
    private getFcmServiceAccount;
    private resolveAndroidChannelId;
    private normalizeAndroidChannelId;
    private resolveFcmSettings;
    private resolveApnsSettings;
    private getApnsPrivateKey;
    private createApnsJwt;
    private signJwt;
    private postJson;
    private postForm;
    private toStringMap;
    private base64Url;
}
export {};
