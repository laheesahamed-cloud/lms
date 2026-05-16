import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import { readFileSync } from 'fs';
import * as http2 from 'http2';
import * as https from 'https';

type NativePlatform = 'ios' | 'android' | 'unknown';

export type NativePushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
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
    private readonly logger: Logger
  ) {}

  isConfigured() {
    return this.isApnsConfigured() || this.isFcmConfigured();
  }

  isConfiguredFor(platform: NativePlatform) {
    if (platform === 'ios') return this.isApnsConfigured();
    if (platform === 'android') return this.isFcmConfigured();
    return false;
  }

  async send(platform: NativePlatform, token: string, payload: NativePushPayload): Promise<NativePushSendResult> {
    if (platform === 'ios') return this.sendApns(token, payload);
    if (platform === 'android') return this.sendFcm(token, payload);
    return { ok: false, error: 'Unsupported native push platform' };
  }

  private isApnsConfigured() {
    return Boolean(
      this.configService.get<string>('APNS_KEY_ID') &&
      this.configService.get<string>('APNS_TEAM_ID') &&
      this.configService.get<string>('APNS_BUNDLE_ID') &&
      this.getApnsPrivateKey()
    );
  }

  private isFcmConfigured() {
    return Boolean(
      this.configService.get<string>('FCM_PROJECT_ID') &&
      (this.getFcmServiceAccount() || this.configService.get<string>('FCM_SERVER_KEY'))
    );
  }

  private async sendApns(token: string, payload: NativePushPayload): Promise<NativePushSendResult> {
    if (!this.isApnsConfigured()) return { ok: false, error: 'APNs is not configured' };

    const bundleId = String(this.configService.get<string>('APNS_BUNDLE_ID'));
    const useSandbox = String(this.configService.get<string>('APNS_USE_SANDBOX') || '').toLowerCase() === 'true';
    const host = useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
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
        authorization: `bearer ${this.createApnsJwt()}`,
        'apns-topic': bundleId,
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
    if (!this.isFcmConfigured()) return { ok: false, error: 'FCM is not configured' };

    const legacyServerKey = this.configService.get<string>('FCM_SERVER_KEY');
    if (legacyServerKey) {
      return this.sendFcmLegacy(token, payload, legacyServerKey);
    }

    const projectId = String(this.configService.get<string>('FCM_PROJECT_ID'));
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
          ...(payload.data || {}),
        }),
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'default',
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
    const body = JSON.stringify({
      to: token,
      priority: 'high',
      notification: {
        title: payload.title,
        body: payload.body,
        sound: 'default',
      },
      data: this.toStringMap({
        url: payload.url || '/notifications',
        tag: payload.tag || 'erpm-lms-notification',
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

    const account = this.getFcmServiceAccount();
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

  private getFcmServiceAccount(): any {
    const inlineJson = this.configService.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    const filePath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    try {
      if (inlineJson) return JSON.parse(inlineJson);
      if (filePath) return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error: any) {
      this.logger.warn(`Unable to read FCM service account: ${error?.message || error}`);
    }

    return null;
  }

  private getApnsPrivateKey() {
    const inlineKey = this.configService.get<string>('APNS_PRIVATE_KEY');
    const filePath = this.configService.get<string>('APNS_PRIVATE_KEY_PATH');
    if (inlineKey) return inlineKey.replace(/\\n/g, '\n');
    if (!filePath) return '';
    try {
      return readFileSync(filePath, 'utf8');
    } catch (error: any) {
      this.logger.warn(`Unable to read APNs private key: ${error?.message || error}`);
      return '';
    }
  }

  private createApnsJwt() {
    const now = Math.floor(Date.now() / 1000);
    return this.signJwt(
      {
        alg: 'ES256',
        kid: String(this.configService.get<string>('APNS_KEY_ID')),
      },
      {
        iss: String(this.configService.get<string>('APNS_TEAM_ID')),
        iat: now,
      },
      this.getApnsPrivateKey(),
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
