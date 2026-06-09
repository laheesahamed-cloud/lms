import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import { NativePushSender } from './native-push.sender';

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

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly nativePushSender: NativePushSender;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService
  ) {
    this.nativePushSender = new NativePushSender(
      this.configService,
      this.logger,
      () => this.settingsService.getRawApnsSettings(),
      () => this.settingsService.getRawFcmSettings()
    );
  }

  getPublicConfig() {
    return {
      enabled: false,
      publicKey: '',
    };
  }

  async getSettings(authorization?: string) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT delivery_mode, enabled
       FROM push_subscriptions
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [user.id]
    );

    return {
      supported: true,
      vapidEnabled: false,
      deliveryMode: this.normalizeDeliveryMode(rows[0]?.delivery_mode || 'outside'),
      outsideEnabled: Boolean(rows[0]?.enabled),
      nativeEnabled: await this.hasEnabledNativeToken(user.id),
    };
  }

  async updateSettings(authorization: string | undefined, input: any) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const deliveryMode = this.normalizeDeliveryMode(input?.deliveryMode || 'inside');
    await this.db.execute(
      `UPDATE push_subscriptions SET delivery_mode = ?, enabled = ? WHERE user_id = ?`,
      [deliveryMode, deliveryMode === 'inside' ? 0 : 1, user.id]
    );
    return { ok: true, deliveryMode };
  }

  async getAdminStatus(authorization?: string) {
    await this.authService.requireAdmin(authorization);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
          COUNT(*) AS totalSubscriptions,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS activeSubscriptions,
          SUM(CASE WHEN enabled = 1 AND delivery_mode IN ('outside','both') THEN 1 ELSE 0 END) AS phoneSubscriptions,
          SUM(CASE WHEN delivery_mode = 'inside' THEN 1 ELSE 0 END) AS insideOnlySubscriptions,
          COUNT(DISTINCT CASE WHEN enabled = 1 AND delivery_mode IN ('outside','both') THEN user_id END) AS phoneUsers
       FROM push_subscriptions`
    );
    const [nativeRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
          COUNT(*) AS totalNativeTokens,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS activeNativeTokens,
          COUNT(DISTINCT CASE WHEN enabled = 1 THEN user_id END) AS nativePushUsers
       FROM native_push_tokens`
    );
    // Surface the most recent delivery failures so admins can see why a push was
    // rejected (e.g. BadDeviceToken = APNs sandbox/production mismatch) without
    // querying the database directly.
    const [errorRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT platform, enabled, delivery_mode, last_error, failed_at, updated_at
         FROM native_push_tokens
        WHERE last_error IS NOT NULL AND last_error <> ''
        ORDER BY (failed_at IS NULL), failed_at DESC, updated_at DESC
        LIMIT 8`
    );
    const stats = rows[0] || {};
    const nativeStats = nativeRows[0] || {};
    return {
      vapidEnabled: false,
      publicKeyConfigured: false,
      privateKeyConfigured: false,
      subject: '',
      totalSubscriptions: Number(stats.totalSubscriptions || 0),
      activeSubscriptions: Number(stats.activeSubscriptions || 0),
      phoneSubscriptions: Number(stats.phoneSubscriptions || 0),
      insideOnlySubscriptions: Number(stats.insideOnlySubscriptions || 0),
      phoneUsers: Number(stats.phoneUsers || 0),
      nativePushConfigured: await this.nativePushSender.isConfigured(),
      iosNativePushConfigured: await this.nativePushSender.isConfiguredFor('ios'),
      androidNativePushConfigured: await this.nativePushSender.isConfiguredFor('android'),
      nativePushUsers: Number(nativeStats.nativePushUsers || 0),
      nativePushTokens: Number(nativeStats.activeNativeTokens || 0),
      failedNativeTokens: errorRows.length,
      recentNativeErrors: errorRows.map((row) => ({
        platform: this.normalizeNativePlatform(row.platform),
        enabled: Number(row.enabled) === 1,
        deliveryMode: String(row.delivery_mode || ''),
        reason: this.summarizeNativePushError(String(row.last_error || '')),
        failedAt: row.failed_at || row.updated_at || null,
      })),
      defaultIcon: '/lms/pwa-icon.svg',
      defaultBadge: '/lms/pwa-maskable.svg',
    };
  }

  private summarizeNativePushError(raw: string): string {
    const value = String(raw || '').trim();
    if (!value) return '';
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && parsed.reason) {
        return String(parsed.reason);
      }
    } catch {
      // Not JSON (e.g. a transport error string) — fall back to the raw text.
    }
    return value.length > 160 ? `${value.slice(0, 160)}…` : value;
  }

  async subscribe(authorization: string | undefined, input: any, userAgent?: string) {
    await this.authService.requireAuthenticatedUser(authorization);
    return { ok: false, reason: 'Web push is disabled. Use native app notifications.' };
  }

  async unsubscribe(authorization: string | undefined, input: any) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const endpoint = String(input?.endpoint || '');

    if (endpoint) {
      await this.db.execute(
        `UPDATE push_subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND endpoint_hash = ?`,
        [user.id, this.hashEndpoint(endpoint)]
      );
    } else {
      await this.db.execute(
        `UPDATE push_subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [user.id]
      );
    }

    return { ok: true };
  }

  async saveNativeToken(authorization: string | undefined, input: any) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const token = String(input?.token || '').trim();
    const platform = this.normalizeNativePlatform(input?.platform);
    const deliveryMode = this.normalizeDeliveryMode(input?.deliveryMode || 'outside');

    if (!token) {
      throw new BadRequestException('Native push token is required');
    }

    await this.db.execute(
      `INSERT INTO native_push_tokens
        (user_id, token_hash, token, platform, delivery_mode, enabled)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        token = VALUES(token),
        platform = VALUES(platform),
        delivery_mode = VALUES(delivery_mode),
        enabled = VALUES(enabled),
        last_error = NULL,
        failed_at = NULL,
        updated_at = CURRENT_TIMESTAMP`,
      [
        user.id,
        this.hashEndpoint(token),
        token,
        platform,
        deliveryMode,
        deliveryMode === 'inside' ? 0 : 1,
      ]
    );

    return { ok: true, deliveryMode, nativeEnabled: deliveryMode !== 'inside' };
  }

  async deleteNativeToken(authorization: string | undefined, input: any) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const token = String(input?.token || '').trim();

    if (token) {
      await this.db.execute(
        `UPDATE native_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_hash = ?`,
        [user.id, this.hashEndpoint(token)]
      );
    } else {
      await this.db.execute(
        `UPDATE native_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [user.id]
      );
    }

    return { ok: true };
  }

  async sendAdminNotification(authorization: string | undefined, input: any) {
    const admin = await this.authService.requireAdmin(authorization);
    const payload = this.normalizePayload(input);
    const deliveryType = this.normalizeAdminDeliveryType(input?.deliveryType || input?.deliveryMode || 'both');
    const targetRole = this.normalizeTargetRole(input?.targetRole);
    const userIds = Array.isArray(input?.userIds)
      ? input.userIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    let inAppCreated = 0;
    let pushResult: { ok: boolean; sent: number; failed: number; reason?: string } = { ok: true, sent: 0, failed: 0 };

    // Admin controls delivery per message. Students only opt their device into phone push.
    if (deliveryType === 'inside' || deliveryType === 'both') {
      inAppCreated = await this.createInAppAnnouncement(payload, targetRole, Number(admin.id));
    }

    if (deliveryType === 'outside' || deliveryType === 'both') {
      pushResult = await this.sendToAudience(payload, { targetRole, userIds });
    }

    return {
      ok: deliveryType === 'inside' ? true : pushResult.ok,
      deliveryType,
      inAppCreated,
      sent: pushResult.sent,
      failed: pushResult.failed,
      reason: pushResult.reason,
    };
  }

  async sendAnnouncementPush(input: {
    title: string;
    body: string;
    targetRole: 'all' | 'student' | 'admin';
    url?: string;
  }) {
    return this.sendToAudience(
      {
        title: input.title,
        body: input.body,
        url: input.url || '/notifications',
        tag: `announcement-${Date.now()}`,
      },
      { targetRole: input.targetRole }
    );
  }

  async sendToAudience(payload: PushPayload, audience: { targetRole?: string; userIds?: number[] } = {}) {
    if (!(await this.nativePushSender.isConfigured())) {
      this.logger.warn('Skipping native push send because native push credentials are not configured.');
      return { ok: false, sent: 0, failed: 0, reason: 'Native push credentials are not configured' };
    }

    const nativeResult = await this.sendNativeToAudience(payload, audience);
    return { ok: nativeResult.failed === 0, sent: nativeResult.sent, failed: nativeResult.failed };
  }

  private async sendNativeToAudience(payload: PushPayload, audience: { targetRole?: string; userIds?: number[] } = {}) {
    if (!(await this.nativePushSender.isConfigured())) {
      return { sent: 0, failed: 0 };
    }

    const params: Array<string | number> = [];
    const where = [`npt.enabled = 1`, `npt.delivery_mode IN ('outside','both')`];

    if (audience.userIds?.length) {
      where.push(`npt.user_id IN (${sqlPlaceholders(audience.userIds)})`);
      params.push(...audience.userIds);
    } else if (audience.targetRole && audience.targetRole !== 'all') {
      where.push('u.role = ?');
      params.push(audience.targetRole);
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT npt.id, npt.token, npt.platform
       FROM native_push_tokens npt
       INNER JOIN users u ON u.id = npt.user_id
       WHERE ${where.join(' AND ')}`,
      params
    );

    let sent = 0;
    let failed = 0;

    await Promise.all(rows.map(async (row) => {
      const platform = this.normalizeNativePlatform(row.platform);
      try {
        const result = await this.nativePushSender.send(platform, String(row.token), this.withDefaults(payload));
        if (result.ok) {
          sent += 1;
          return;
        }

        failed += 1;
        await this.markNativeTokenFailure(Number(row.id), result.statusCode || 0, result.error || 'Native push delivery failed');
      } catch (error: any) {
        failed += 1;
        await this.markNativeTokenFailure(Number(row.id), 0, error?.message || 'Native push delivery failed');
      }
    }));

    return { sent, failed };
  }

  private normalizePayload(input: any): PushPayload {
    const title = String(input?.title || '').trim();
    const body = String(input?.body || '').trim();

    if (!title || !body) {
      throw new BadRequestException('Notification title and body are required');
    }

    return this.withDefaults({
      title,
      body,
      url: this.safeInternalPath(input?.url || input?.actionPath || '/notifications'),
      icon: input?.icon,
      badge: input?.badge,
      tag: input?.tag,
      channelId: input?.channelId || input?.androidChannelId || input?.notificationChannel,
      data: typeof input?.data === 'object' && input.data !== null ? input.data : {},
    });
  }

  private withDefaults(payload: PushPayload): PushPayload {
    const data = payload.data || {};
    const channelId = this.normalizeAndroidChannelId(
      payload.channelId ||
      data.channelId ||
      data.androidChannelId ||
      this.inferAndroidChannelId(payload)
    ) || 'course_updates';

    return {
      title: payload.title || 'xyndrome',
      body: payload.body || 'You have a new notification.',
      url: this.safeInternalPath(payload.url || '/notifications'),
      icon: payload.icon || '/lms/pwa-icon.svg',
      badge: payload.badge || '/lms/pwa-maskable.svg',
      tag: payload.tag || 'erpm-lms-notification',
      channelId,
      data: { ...data, channelId },
    };
  }

  private inferAndroidChannelId(payload: PushPayload) {
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

  private normalizeDeliveryMode(value: unknown): DeliveryMode {
    return value === 'outside' || value === 'both' || value === 'inside' ? value : 'outside';
  }

  private normalizeAdminDeliveryType(value: unknown): AdminDeliveryType {
    return value === 'inside' || value === 'outside' || value === 'both' ? value : 'both';
  }

  private normalizeTargetRole(value: unknown) {
    return value === 'student' || value === 'admin' || value === 'all' ? value : 'all';
  }

  private normalizeNativePlatform(value: unknown) {
    return value === 'ios' || value === 'android' ? value : 'unknown';
  }

  private safeInternalPath(value: unknown) {
    const path = String(value || '/notifications').trim();
    if (!path.startsWith('/') || path.startsWith('//')) return '/notifications';
    return path;
  }

  private hashEndpoint(endpoint: string) {
    return createHash('sha256').update(endpoint).digest('hex');
  }

  private async markNativeTokenFailure(id: number, statusCode: number, message: string) {
    await this.db.execute(
      `UPDATE native_push_tokens
       SET enabled = CASE WHEN ? IN (400, 404, 410) THEN 0 ELSE enabled END,
           last_error = ?,
           failed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [statusCode, String(message || 'Native push delivery failed').slice(0, 500), id]
    );
  }

  private async hasEnabledNativeToken(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM native_push_tokens WHERE user_id = ? AND enabled = 1 LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  }

  private async createInAppAnnouncement(payload: PushPayload, targetRole: string, adminId: number) {
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO announcements (title, body, target_role, status, publish_at, created_by)
       VALUES (?, ?, ?, 'published', NULL, ?)`,
      [
        String(payload.title || 'xyndrome').slice(0, 180),
        payload.body || 'You have a new notification.',
        this.normalizeTargetRole(targetRole),
        adminId || null,
      ]
    );

    return Number(result.insertId || 0);
  }
}
