import { Notice, NoticesService } from '../notices/notices.service';
import { BadRequestException, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import { NativePushSender, NativePushSettingsSnapshot } from './native-push.sender';

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
export class PushNotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly nativePushSender: NativePushSender;
  // In-memory debounce for "new content" bursts (e.g. an admin approving many
  // flashcards back-to-back) — coalesces same-key events within the delay
  // window into a single notification instead of one per event. Per-process
  // only (no shared cache) — acceptable on this single-instance deployment;
  // a pending batch is simply lost (not sent) across a process restart.
  private readonly pendingDebounced = new Map<string, { timer: NodeJS.Timeout; count: number }>();
  // Broadcast batches waiting for their turn (spread sending). Per-process,
  // like the debounce above: a restart drops batches not yet sent.
  private readonly spreadTimers = new Set<NodeJS.Timeout>();
  private readonly runningBatches = new Set<Promise<unknown>>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly notices: NoticesService
  ) {
    this.nativePushSender = new NativePushSender(
      this.configService,
      this.logger,
      () => this.settingsService.getRawApnsSettings(),
      () => this.settingsService.getRawFcmSettings(),
      () => this.settingsService.getRawPushSettings()
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
    // 10.42: browser web push (push_subscriptions) removed; phone push only.
    const nativeEnabled = await this.hasEnabledNativeToken(user.id);
    return {
      supported: true,
      vapidEnabled: false,
      deliveryMode: 'outside' as const,
      outsideEnabled: nativeEnabled,
      nativeEnabled,
    };
  }

  async updateSettings(authorization: string | undefined, input: any) {
    await this.authService.requireAuthenticatedUser(authorization);
    const deliveryMode = this.normalizeDeliveryMode(input?.deliveryMode || 'inside');
    return { ok: true, deliveryMode }; // 10.42: no web-push row to update
  }

  async getAdminStatus(authorization?: string) {
    await this.authService.requireAdmin(authorization);
    const rows: RowDataPacket[] = []; // 10.42: web push removed — its counts are 0
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
      defaultIcon: '/pwa-icon-192.png',
      defaultBadge: '/pwa-icon-512.png',
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

  async unsubscribe(authorization: string | undefined, _input: any) {
    await this.authService.requireAuthenticatedUser(authorization);
    return { ok: true }; // 10.42: web push removed
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
    void admin;

    // Admin controls delivery per message. Students only opt their device into phone push.
    // In-app = a notice in the shared feed (no database rows); phones pick it
    // up with the start-up reply or from the push itself.
    let notice: Notice | null = null;
    if (deliveryType === 'inside' || deliveryType === 'both') {
      notice = this.notices.addNotice({
        kind: 'admin',
        title: payload.title,
        body: payload.body,
        url: payload.url,
        audience: this.normalizeTargetRole(targetRole) as Notice['audience'],
      });
      inAppCreated = notice.id;
    }

    if (deliveryType === 'outside' || deliveryType === 'both') {
      pushResult = await this.sendToAudience(this.withNotice(payload, notice), { targetRole, userIds });
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
    notice?: Notice | null;
  }) {
    return this.sendToAudience(
      this.withNotice({
        title: input.title,
        body: input.body,
        url: input.url || '/notifications',
        tag: `announcement-${Date.now()}`,
      }, input.notice || null),
      { targetRole: input.targetRole },
      // Broadcasts are spread over ~3 minutes so every phone doesn't open the
      // app (and hit the server) in the same second. Callers don't wait for it.
      { spread: true }
    );
  }

  /// Fire-and-forget notify for system-generated "new content" events (quiz/lesson/
  /// flashcards/paper publish) — writes an in-app announcement row (system-authored,
  /// created_by = NULL) then sends native push to all students. Callers should never
  /// await this into a save/publish request path; catch on the call site.
  async notifyStudentsOfNewContent(payload: { title: string; body: string; url?: string }) {
    // Admin switch (Settings → General): off means publishing stays silent.
    try {
      if (!(await this.settingsService.isNewContentNotificationsEnabled())) return;
    } catch (error: any) {
      this.logger.warn(`New-content switch lookup failed, notifying anyway: ${error?.message || error}`);
    }

    // In the shared notices feed (a small JSON file), not the database.
    let notice: Notice | null = null;
    try {
      notice = this.notices.addNotice({ kind: 'content', title: payload.title, body: payload.body, url: payload.url, audience: 'student' });
    } catch (error: any) {
      this.logger.warn(`New-content notice not saved: ${error?.message || error}`);
    }

    return this.sendAnnouncementPush({ ...payload, targetRole: 'student', notice }).catch((error: any) => {
      this.logger.warn(`New-content push failed: ${error?.message || error}`);
    });
  }

  /// Same as notifyStudentsOfNewContent, but coalesces repeated calls sharing
  /// the same `key` (e.g. `flashcards:${lessonId}`) within `delayMs` into one
  /// notification — so approving 20 flashcards in a row sends one "20 new
  /// flashcards added" push instead of 20 separate ones. Each call resets the
  /// window and bumps the count; `buildPayload(count)` is invoked once, right
  /// before sending, with the final tally.
  notifyStudentsOfNewContentDebounced(
    key: string,
    buildPayload: (count: number) => { title: string; body: string; url?: string },
    delayMs = 60_000
  ) {
    const existing = this.pendingDebounced.get(key);
    const count = (existing?.count || 0) + 1;
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => {
      this.pendingDebounced.delete(key);
      void this.notifyStudentsOfNewContent(buildPayload(count));
    }, delayMs);
    // Timer alone must never keep the process alive (e.g. during shutdown).
    timer.unref?.();

    this.pendingDebounced.set(key, { timer, count });
  }

  onModuleDestroy() {
    for (const { timer } of this.pendingDebounced.values()) clearTimeout(timer);
    this.pendingDebounced.clear();
    for (const timer of this.spreadTimers) clearTimeout(timer);
    this.spreadTimers.clear();
  }

  /** Resolves when no spread batch is scheduled or running (tests and measurements). */
  async waitForPushIdle() {
    while (this.spreadTimers.size || this.runningBatches.size) {
      await Promise.all([...this.runningBatches]);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Phone push to an audience. Database work per broadcast, whatever the
   * number of phones: 1 settings read + 1 token read, and 1 write per batch
   * only when some tokens failed. (Before: 2 settings reads per phone, all at
   * once — 10 phones ≈ 25 statements, 200 phones overflowed the pool queue
   * and nothing was sent.)
   *
   * `spread`: send in batches over PUSH_SPREAD_MS (default 3 minutes) and
   * return at once; used for broadcasts nobody waits on. Without it (the
   * admin's own "Send notification"), all are sent now, 25 at a time, and the
   * result is returned.
   */
  async sendToAudience(
    payload: PushPayload,
    audience: { targetRole?: string; userIds?: number[] } = {},
    options: { spread?: boolean } = {},
  ) {
    const settings = await this.nativePushSender.loadSettings();
    if (!(await this.nativePushSender.isConfigured(settings))) {
      this.logger.warn('Skipping native push send because native push credentials are not configured.');
      return { ok: false, sent: 0, failed: 0, reason: 'Native push credentials are not configured' };
    }

    const rows = await this.loadAudienceTokens(audience);
    const message = this.withDefaults(payload);
    if (options.spread) {
      this.scheduleSpread(rows, message, settings);
      return { ok: true, sent: 0, failed: 0, queued: rows.length };
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += PushNotificationsService.SEND_CONCURRENCY) {
      const result = await this.sendBatch(rows.slice(i, i + PushNotificationsService.SEND_CONCURRENCY), message, settings);
      sent += result.sent;
      failed += result.failed;
    }
    return { ok: failed === 0, sent, failed };
  }

  private static readonly SEND_CONCURRENCY = 25;
  private static readonly SPREAD_SLOTS = 18; // 3 minutes → a batch every 10 s
  private static readonly MIN_SPREAD_BATCH = 10; // a few phones go in one batch, now

  private spreadWindowMs() {
    const value = Number(this.configService.get<string>('PUSH_SPREAD_MS') ?? 180_000);
    return Number.isFinite(value) && value >= 0 ? value : 180_000;
  }

  private scheduleSpread(rows: RowDataPacket[], message: PushPayload, settings: NativePushSettingsSnapshot) {
    if (!rows.length) return;
    const slots = PushNotificationsService.SPREAD_SLOTS;
    const size = Math.max(PushNotificationsService.MIN_SPREAD_BATCH, Math.ceil(rows.length / slots));
    const batches: RowDataPacket[][] = [];
    for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));
    const interval = this.spreadWindowMs() / slots;
    batches.forEach((batch, index) => {
      const timer = setTimeout(() => {
        this.spreadTimers.delete(timer);
        // One batch at a time per broadcast step; each batch sends ≤ size pushes.
        const run = this.sendBatch(batch, message, settings)
          .catch((error: any) => this.logger.warn(`Push batch failed: ${error?.message || error}`))
          .finally(() => this.runningBatches.delete(run));
        this.runningBatches.add(run);
      }, Math.round(index * interval));
      timer.unref?.();
      this.spreadTimers.add(timer);
    });
  }

  /** One token read for the whole audience (examined = the audience's tokens). */
  private async loadAudienceTokens(audience: { targetRole?: string; userIds?: number[] }) {
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
    return rows;
  }

  /** Send to a few phones together; failed tokens are recorded in ONE statement. */
  private async sendBatch(rows: RowDataPacket[], message: PushPayload, settings: NativePushSettingsSnapshot) {
    const failures: Array<{ id: number; statusCode: number; message: string }> = [];
    let sent = 0;
    await Promise.all(rows.map(async (row) => {
      const platform = this.normalizeNativePlatform(row.platform);
      try {
        const result = await this.nativePushSender.send(platform, String(row.token), message, settings);
        if (result.ok) {
          sent += 1;
          return;
        }
        failures.push({ id: Number(row.id), statusCode: result.statusCode || 0, message: result.error || 'Native push delivery failed' });
      } catch (error: any) {
        failures.push({ id: Number(row.id), statusCode: 0, message: error?.message || 'Native push delivery failed' });
      }
    }));
    if (failures.length) await this.markNativeTokenFailures(failures);
    return { sent, failed: failures.length };
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
      icon: payload.icon || '/pwa-icon-192.png',
      badge: payload.badge || '/pwa-icon-512.png',
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

  /** Apple/Google said "this token is gone" (400/404/410): disable it. Any failure: keep the error. One statement for the batch. */
  private async markNativeTokenFailures(failures: Array<{ id: number; statusCode: number; message: string }>) {
    const dead = failures.filter((f) => [400, 404, 410].includes(f.statusCode)).map((f) => f.id);
    const ids = failures.map((f) => f.id);
    const errorCases = failures.map(() => 'WHEN ? THEN ?').join(' ');
    const params: Array<string | number> = [];
    for (const f of failures) params.push(f.id, String(f.message || 'Native push delivery failed').slice(0, 500));
    await this.db.query(
      `UPDATE native_push_tokens
       SET enabled = CASE WHEN id IN (?) THEN 0 ELSE enabled END,
           last_error = CASE id ${errorCases} ELSE last_error END,
           failed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (?)`,
      [dead.length ? dead : [0], ...params, ids]
    );
  }

  private async hasEnabledNativeToken(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM native_push_tokens WHERE user_id = ? AND enabled = 1 LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  }

  /** The push carries its notice, so a phone can put it in its inbox at once. */
  private withNotice(payload: PushPayload, notice: Notice | null): PushPayload {
    if (!notice) return payload;
    return {
      ...payload,
      data: {
        ...(payload.data || {}),
        noticeId: notice.id,
        noticeKind: notice.kind,
        noticeAt: notice.createdAt,
      },
    };
  }

}
