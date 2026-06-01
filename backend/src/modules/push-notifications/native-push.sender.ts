import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import { readFileSync } from 'fs';
import * as http2 from 'http2';
import * as https from 'https';

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

export class NativePushSender {
  private fcmAccessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    private readonly getApnsRuntimeSettings?: () => Promise<ApnsRuntimeSettings>,
    private readonly getFcmRuntimeSettings?: () => Promise<FcmRuntimeSettings>
  ) {}

  async isConfigured() {
    return (await this.isApnsConfigured()) || this.isFcmConfigured();
  }

  async isConfiguredFor(platform: NativePlatform) {
    if (platform === 'ios') return this.isApnsConfigured();
    if (platform === 'android') return this.isFcmConfigured();
    return false;
  }

  async send(platform: NativePlatform, token: string, payload: NativePushPayload): Promise<NativePushSendResult> {
    if (platform === 'ios') return this.sendApns(token, payload);
    if (platform === 'android') return this.sendFcm(token, payload);
    return { ok: false, error: 'Unsupported native push platform' };
  }

  private async isApnsConfigured() {
    const settings = await this.resolveApnsSettings();
    return Boolean(
      settings.keyId &&
      settings.teamId &&
      settings.bundleId &&
      this.getApnsPrivateKey(settings)
    );
  }

  private async isFcmConfigured() {
    const settings = await this.resolveFcmSettings();
    return Boolean(
      settings.projectId &&
      (this.getFcmServiceAccount(settings) || settings.serverKey)
    );
  }

  private async sendApns(token: string, payload: NativePushPayload): Promise<NativePushSendResult> {
    const settings = await this.resolveApnsSettings();
    if (!(await this.isApnsConfigured())) return { ok: false, error: 'APNs is not configured' };

    const host = settings.useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const body = JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
      },
      url: payload.url || '/notifications',
      tag: payload.tag,
      data: payload.data || {},
    });

    return new Promise((resolve) => {
      const client = http2.connect(`https://${host}`);
      let settled = false;

      function finish(result: NativePushSendResult) {
        if (settled) return;
        settled = true;
        client.close();
        resolve(result);
      }

      client.on('error', (error) => finish({ ok: false, error: error.message }));

      const request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${this.createApnsJwt(settings)}`,
        'apns-topic': settings.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      });

      let responseBody = '';
      let statusCode = 0;
      request.setEncoding('utf8');
      request.on('response', (headers) => {
        statusCode = Number(headers[':status'] || 0);
      });
      request.on('data', (chunk) => {
        responseBody += chunk;
      });
      request.on('end', () => {
        finish({
          ok: statusCode >= 200 && statusCode < 300,
          statusCode,
          error: statusCode >= 200 && statusCode < 300 ? undefined : responseBody || `APNs HTTP ${statusCode}`,
        });
      });
      request.on('error', (error) => finish({ ok: false, error: error.message }));
      request.end(body);
    });
  }

  private async sendFcm(token: string, payload: NativePushPayload): Promise<NativePushSendResult> {
    const settings = await this.resolveFcmSettings();
    if (!(await this.isFcmConfigured())) return { ok: false, error: 'FCM is not configured' };
    const channelId = this.resolveAndroidChannelId(payload);

    const legacyServerKey = settings.serverKey;
    if (legacyServerKey) {
      return this.sendFcmLegacy(token, payload, legacyServerKey);
    }

    const projectId = settings.projectId;
    const accessToken = await this.getFcmAccessToken();
    const body = JSON.stringify({
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: this.toStringMap({
          url: payload.url || '/notifications',
          tag: payload.tag || 'erpm-lms-notification',
          channelId,
          ...(payload.data || {}),
        }),
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: channelId,
            sound: 'default',
            click_action: 'OPEN_LMS_NOTIFICATION',
          },
        },
      },
    });

    return this.postJson(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, body, {
      authorization: `Bearer ${accessToken}`,
    });
  }

  private sendFcmLegacy(token: string, payload: NativePushPayload, serverKey: string) {
    const channelId = this.resolveAndroidChannelId(payload);
    const body = JSON.stringify({
      to: token,
      priority: 'high',
      notification: {
        title: payload.title,
        body: payload.body,
        sound: 'default',
        android_channel_id: channelId,
      },
      data: this.toStringMap({
        url: payload.url || '/notifications',
        tag: payload.tag || 'erpm-lms-notification',
        channelId,
        ...(payload.data || {}),
      }),
    });

    return this.postJson('https://fcm.googleapis.com/fcm/send', body, {
      authorization: `key=${serverKey}`,
    });
  }

  private async getFcmAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this.fcmAccessToken && this.fcmAccessToken.expiresAt - 60 > now) {
      return this.fcmAccessToken.value;
    }

    const account = this.getFcmServiceAccount(await this.resolveFcmSettings());
    if (!account?.client_email || !account?.private_key) {
      throw new Error('FCM service account is missing client_email or private_key');
    }

    const assertion = this.signJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      account.private_key.replace(/\\n/g, '\n'),
      'RSA-SHA256'
    );

    const response = await this.postForm('https://oauth2.googleapis.com/token', new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString());

    const token = String(response.access_token || '');
    if (!token) throw new Error('FCM access token response was empty');

    this.fcmAccessToken = {
      value: token,
      expiresAt: now + Number(response.expires_in || 3600),
    };
    return token;
  }

  private getFcmServiceAccount(settings: FcmRuntimeSettings): any {
    const inlineJson = settings.serviceAccountJson;
    const filePath = settings.serviceAccountPath;

    try {
      if (inlineJson) return JSON.parse(inlineJson);
      if (filePath) return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error: any) {
      this.logger.warn(`Unable to read FCM service account: ${error?.message || error}`);
    }

    return null;
  }

  private resolveAndroidChannelId(payload: NativePushPayload) {
    const explicit = this.normalizeAndroidChannelId(payload.channelId || payload.data?.channelId || payload.data?.androidChannelId);
    if (explicit) return explicit;

    const haystack = [
      payload.title,
      payload.body,
      payload.url,
      payload.tag,
      payload.data?.type,
      payload.data?.kind,
      payload.data?.category,
    ].map((value) => String(value || '').toLowerCase()).join(' ');

    if (/\b(exam|quiz|assessment|deadline|reminder|attempt|result)\b/.test(haystack)) {
      return 'exam_reminders';
    }
    if (/\b(account|security|privacy|password|payment|subscription|billing|lock|locked|login)\b/.test(haystack)) {
      return 'account_alerts';
    }
    return 'course_updates';
  }

  private normalizeAndroidChannelId(value: unknown) {
    const channelId = String(value || '').trim();
    return ['default', 'exam_reminders', 'course_updates', 'account_alerts'].includes(channelId) ? channelId : '';
  }

  private async resolveFcmSettings(): Promise<FcmRuntimeSettings> {
    if (this.getFcmRuntimeSettings) {
      const settings = await this.getFcmRuntimeSettings();
      if (settings.projectId || settings.serverKey || settings.serviceAccountJson || settings.serviceAccountPath) {
        return settings;
      }
    }

    return {
      projectId: String(this.configService.get<string>('FCM_PROJECT_ID') || '').trim(),
      serverKey: String(this.configService.get<string>('FCM_SERVER_KEY') || '').trim(),
      serviceAccountPath: String(this.configService.get<string>('FCM_SERVICE_ACCOUNT_PATH') || this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS') || '').trim(),
      serviceAccountJson: String(this.configService.get<string>('FCM_SERVICE_ACCOUNT_JSON') || '').trim(),
    };
  }

  private async resolveApnsSettings(): Promise<ApnsRuntimeSettings> {
    if (this.getApnsRuntimeSettings) {
      const settings = await this.getApnsRuntimeSettings();
      if (settings.keyId || settings.teamId || settings.privateKey || settings.privateKeyPath) {
        return settings;
      }
    }

    return {
      keyId: String(this.configService.get<string>('APNS_KEY_ID') || '').trim(),
      teamId: String(this.configService.get<string>('APNS_TEAM_ID') || '').trim(),
      bundleId: String(this.configService.get<string>('APNS_BUNDLE_ID') || 'com.erpm.medical.lms').trim(),
      useSandbox: String(this.configService.get<string>('APNS_USE_SANDBOX') || '').toLowerCase() === 'true',
      privateKeyPath: String(this.configService.get<string>('APNS_PRIVATE_KEY_PATH') || '').trim(),
      privateKey: String(this.configService.get<string>('APNS_PRIVATE_KEY') || '').replace(/\\n/g, '\n').trim(),
    };
  }

  private getApnsPrivateKey(settings: ApnsRuntimeSettings) {
    if (settings.privateKey) return settings.privateKey.replace(/\\n/g, '\n');
    if (!settings.privateKeyPath) return '';
    try {
      return readFileSync(settings.privateKeyPath, 'utf8');
    } catch (error: any) {
      this.logger.warn(`Unable to read APNs private key: ${error?.message || error}`);
      return '';
    }
  }

  private createApnsJwt(settings: ApnsRuntimeSettings) {
    const now = Math.floor(Date.now() / 1000);
    return this.signJwt(
      {
        alg: 'ES256',
        kid: settings.keyId,
      },
      {
        iss: settings.teamId,
        iat: now,
      },
      this.getApnsPrivateKey(settings),
      'SHA256'
    );
  }

  private signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string, algorithm: string) {
    const encodedHeader = this.base64Url(JSON.stringify(header));
    const encodedPayload = this.base64Url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const sign = createSign(algorithm);
    sign.update(signingInput);
    sign.end();
    return `${signingInput}.${this.base64Url(sign.sign(privateKey))}`;
  }

  private postJson(url: string, body: string, headers: Record<string, string>): Promise<NativePushSendResult> {
    return new Promise((resolve) => {
      const target = new URL(url);
      const request = https.request({
        method: 'POST',
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        headers: {
          ...headers,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      }, (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          const statusCode = Number(response.statusCode || 0);
          resolve({
            ok: statusCode >= 200 && statusCode < 300,
            statusCode,
            error: statusCode >= 200 && statusCode < 300 ? undefined : responseBody || `HTTP ${statusCode}`,
          });
        });
      });

      request.on('error', (error) => resolve({ ok: false, error: error.message }));
      request.end(body);
    });
  }

  private postForm(url: string, body: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const target = new URL(url);
      const request = https.request({
        method: 'POST',
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
        },
      }, (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          if (Number(response.statusCode || 0) < 200 || Number(response.statusCode || 0) >= 300) {
            reject(new Error(responseBody || `OAuth HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            reject(error);
          }
        });
      });

      request.on('error', reject);
      request.end(body);
    });
  }

  private toStringMap(input: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
    );
  }

  private base64Url(value: string | Buffer) {
    return Buffer.from(value)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
