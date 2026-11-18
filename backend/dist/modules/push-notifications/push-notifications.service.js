"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PushNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationsService = void 0;
const notices_service_1 = require("../notices/notices.service");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const auth_service_1 = require("../auth/auth.service");
const settings_service_1 = require("../settings/settings.service");
const native_push_sender_1 = require("./native-push.sender");
let PushNotificationsService = PushNotificationsService_1 = class PushNotificationsService {
    constructor(db, authService, configService, settingsService, notices) {
        this.db = db;
        this.authService = authService;
        this.configService = configService;
        this.settingsService = settingsService;
        this.notices = notices;
        this.logger = new common_1.Logger(PushNotificationsService_1.name);
        this.pendingDebounced = new Map();
        this.spreadTimers = new Set();
        this.runningBatches = new Set();
        this.nativePushSender = new native_push_sender_1.NativePushSender(this.configService, this.logger, () => this.settingsService.getRawApnsSettings(), () => this.settingsService.getRawFcmSettings(), () => this.settingsService.getRawPushSettings());
    }
    getPublicConfig() {
        return {
            enabled: false,
            publicKey: '',
        };
    }
    async getSettings(authorization) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        const nativeEnabled = await this.hasEnabledNativeToken(user.id);
        return {
            supported: true,
            vapidEnabled: false,
            deliveryMode: 'outside',
            outsideEnabled: nativeEnabled,
            nativeEnabled,
        };
    }
    async updateSettings(authorization, input) {
        await this.authService.requireAuthenticatedUser(authorization);
        const deliveryMode = this.normalizeDeliveryMode(input?.deliveryMode || 'inside');
        return { ok: true, deliveryMode };
    }
    async getAdminStatus(authorization) {
        await this.authService.requireAdmin(authorization);
        const rows = [];
        const [nativeRows] = await this.db.execute(`SELECT
          COUNT(*) AS totalNativeTokens,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS activeNativeTokens,
          COUNT(DISTINCT CASE WHEN enabled = 1 THEN user_id END) AS nativePushUsers
       FROM native_push_tokens`);
        const [errorRows] = await this.db.execute(`SELECT platform, enabled, delivery_mode, last_error, failed_at, updated_at
         FROM native_push_tokens
        WHERE last_error IS NOT NULL AND last_error <> ''
        ORDER BY (failed_at IS NULL), failed_at DESC, updated_at DESC
        LIMIT 8`);
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
    summarizeNativePushError(raw) {
        const value = String(raw || '').trim();
        if (!value)
            return '';
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && parsed.reason) {
                return String(parsed.reason);
            }
        }
        catch {
        }
        return value.length > 160 ? `${value.slice(0, 160)}…` : value;
    }
    async subscribe(authorization, input, userAgent) {
        await this.authService.requireAuthenticatedUser(authorization);
        return { ok: false, reason: 'Web push is disabled. Use native app notifications.' };
    }
    async unsubscribe(authorization, _input) {
        await this.authService.requireAuthenticatedUser(authorization);
        return { ok: true };
    }
    async saveNativeToken(authorization, input) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        const token = String(input?.token || '').trim();
        const platform = this.normalizeNativePlatform(input?.platform);
        const deliveryMode = this.normalizeDeliveryMode(input?.deliveryMode || 'outside');
        if (!token) {
            throw new common_1.BadRequestException('Native push token is required');
        }
        await this.db.execute(`INSERT INTO native_push_tokens
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
        updated_at = CURRENT_TIMESTAMP`, [
            user.id,
            this.hashEndpoint(token),
            token,
            platform,
            deliveryMode,
            deliveryMode === 'inside' ? 0 : 1,
        ]);
        return { ok: true, deliveryMode, nativeEnabled: deliveryMode !== 'inside' };
    }
    async deleteNativeToken(authorization, input) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        const token = String(input?.token || '').trim();
        if (token) {
            await this.db.execute(`UPDATE native_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_hash = ?`, [user.id, this.hashEndpoint(token)]);
        }
        else {
            await this.db.execute(`UPDATE native_push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [user.id]);
        }
        return { ok: true };
    }
    async sendAdminNotification(authorization, input) {
        const admin = await this.authService.requireAdmin(authorization);
        const payload = this.normalizePayload(input);
        const deliveryType = this.normalizeAdminDeliveryType(input?.deliveryType || input?.deliveryMode || 'both');
        const targetRole = this.normalizeTargetRole(input?.targetRole);
        const userIds = Array.isArray(input?.userIds)
            ? input.userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
            : [];
        let inAppCreated = 0;
        let pushResult = { ok: true, sent: 0, failed: 0 };
        void admin;
        let notice = null;
        if (deliveryType === 'inside' || deliveryType === 'both') {
            notice = this.notices.addNotice({
                kind: 'admin',
                title: payload.title,
                body: payload.body,
                url: payload.url,
                audience: this.normalizeTargetRole(targetRole),
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
    async sendAnnouncementPush(input) {
        return this.sendToAudience(this.withNotice({
            title: input.title,
            body: input.body,
            url: input.url || '/notifications',
            tag: `announcement-${Date.now()}`,
        }, input.notice || null), { targetRole: input.targetRole }, { spread: true });
    }
    async notifyStudentsOfNewContent(payload) {
        try {
            if (!(await this.settingsService.isNewContentNotificationsEnabled()))
                return;
        }
        catch (error) {
            this.logger.warn(`New-content switch lookup failed, notifying anyway: ${error?.message || error}`);
        }
        let notice = null;
        try {
            notice = this.notices.addNotice({ kind: 'content', title: payload.title, body: payload.body, url: payload.url, audience: 'student' });
        }
        catch (error) {
            this.logger.warn(`New-content notice not saved: ${error?.message || error}`);
        }
        return this.sendAnnouncementPush({ ...payload, targetRole: 'student', notice }).catch((error) => {
            this.logger.warn(`New-content push failed: ${error?.message || error}`);
        });
    }
    notifyStudentsOfNewContentDebounced(key, buildPayload, delayMs = 60_000) {
        const existing = this.pendingDebounced.get(key);
        const count = (existing?.count || 0) + 1;
        if (existing)
            clearTimeout(existing.timer);
        const timer = setTimeout(() => {
            this.pendingDebounced.delete(key);
            void this.notifyStudentsOfNewContent(buildPayload(count));
        }, delayMs);
        timer.unref?.();
        this.pendingDebounced.set(key, { timer, count });
    }
    onModuleDestroy() {
        for (const { timer } of this.pendingDebounced.values())
            clearTimeout(timer);
        this.pendingDebounced.clear();
        for (const timer of this.spreadTimers)
            clearTimeout(timer);
        this.spreadTimers.clear();
    }
    async waitForPushIdle() {
        while (this.spreadTimers.size || this.runningBatches.size) {
            await Promise.all([...this.runningBatches]);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    async sendToAudience(payload, audience = {}, options = {}) {
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
        for (let i = 0; i < rows.length; i += PushNotificationsService_1.SEND_CONCURRENCY) {
            const result = await this.sendBatch(rows.slice(i, i + PushNotificationsService_1.SEND_CONCURRENCY), message, settings);
            sent += result.sent;
            failed += result.failed;
        }
        return { ok: failed === 0, sent, failed };
    }
    spreadWindowMs() {
        const value = Number(this.configService.get('PUSH_SPREAD_MS') ?? 180_000);
        return Number.isFinite(value) && value >= 0 ? value : 180_000;
    }
    scheduleSpread(rows, message, settings) {
        if (!rows.length)
            return;
        const slots = PushNotificationsService_1.SPREAD_SLOTS;
        const size = Math.max(PushNotificationsService_1.MIN_SPREAD_BATCH, Math.ceil(rows.length / slots));
        const batches = [];
        for (let i = 0; i < rows.length; i += size)
            batches.push(rows.slice(i, i + size));
        const interval = this.spreadWindowMs() / slots;
        batches.forEach((batch, index) => {
            const timer = setTimeout(() => {
                this.spreadTimers.delete(timer);
                const run = this.sendBatch(batch, message, settings)
                    .catch((error) => this.logger.warn(`Push batch failed: ${error?.message || error}`))
                    .finally(() => this.runningBatches.delete(run));
                this.runningBatches.add(run);
            }, Math.round(index * interval));
            timer.unref?.();
            this.spreadTimers.add(timer);
        });
    }
    async loadAudienceTokens(audience) {
        const params = [];
        const where = [`npt.enabled = 1`, `npt.delivery_mode IN ('outside','both')`];
        if (audience.userIds?.length) {
            where.push(`npt.user_id IN (${(0, sql_safety_1.sqlPlaceholders)(audience.userIds)})`);
            params.push(...audience.userIds);
        }
        else if (audience.targetRole && audience.targetRole !== 'all') {
            where.push('u.role = ?');
            params.push(audience.targetRole);
        }
        const [rows] = await this.db.execute(`SELECT npt.id, npt.token, npt.platform
       FROM native_push_tokens npt
       INNER JOIN users u ON u.id = npt.user_id
       WHERE ${where.join(' AND ')}`, params);
        return rows;
    }
    async sendBatch(rows, message, settings) {
        const failures = [];
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
            }
            catch (error) {
                failures.push({ id: Number(row.id), statusCode: 0, message: error?.message || 'Native push delivery failed' });
            }
        }));
        if (failures.length)
            await this.markNativeTokenFailures(failures);
        return { sent, failed: failures.length };
    }
    normalizePayload(input) {
        const title = String(input?.title || '').trim();
        const body = String(input?.body || '').trim();
        if (!title || !body) {
            throw new common_1.BadRequestException('Notification title and body are required');
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
    withDefaults(payload) {
        const data = payload.data || {};
        const channelId = this.normalizeAndroidChannelId(payload.channelId ||
            data.channelId ||
            data.androidChannelId ||
            this.inferAndroidChannelId(payload)) || 'course_updates';
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
    inferAndroidChannelId(payload) {
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
    normalizeAndroidChannelId(value) {
        const channelId = String(value || '').trim();
        return ['default', 'exam_reminders', 'course_updates', 'account_alerts'].includes(channelId) ? channelId : '';
    }
    normalizeDeliveryMode(value) {
        return value === 'outside' || value === 'both' || value === 'inside' ? value : 'outside';
    }
    normalizeAdminDeliveryType(value) {
        return value === 'inside' || value === 'outside' || value === 'both' ? value : 'both';
    }
    normalizeTargetRole(value) {
        return value === 'student' || value === 'admin' || value === 'all' ? value : 'all';
    }
    normalizeNativePlatform(value) {
        return value === 'ios' || value === 'android' ? value : 'unknown';
    }
    safeInternalPath(value) {
        const path = String(value || '/notifications').trim();
        if (!path.startsWith('/') || path.startsWith('//'))
            return '/notifications';
        return path;
    }
    hashEndpoint(endpoint) {
        return (0, crypto_1.createHash)('sha256').update(endpoint).digest('hex');
    }
    async markNativeTokenFailures(failures) {
        const dead = failures.filter((f) => [400, 404, 410].includes(f.statusCode)).map((f) => f.id);
        const ids = failures.map((f) => f.id);
        const errorCases = failures.map(() => 'WHEN ? THEN ?').join(' ');
        const params = [];
        for (const f of failures)
            params.push(f.id, String(f.message || 'Native push delivery failed').slice(0, 500));
        await this.db.query(`UPDATE native_push_tokens
       SET enabled = CASE WHEN id IN (?) THEN 0 ELSE enabled END,
           last_error = CASE id ${errorCases} ELSE last_error END,
           failed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (?)`, [dead.length ? dead : [0], ...params, ids]);
    }
    async hasEnabledNativeToken(userId) {
        const [rows] = await this.db.execute(`SELECT id FROM native_push_tokens WHERE user_id = ? AND enabled = 1 LIMIT 1`, [userId]);
        return rows.length > 0;
    }
    withNotice(payload, notice) {
        if (!notice)
            return payload;
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
};
exports.PushNotificationsService = PushNotificationsService;
PushNotificationsService.SEND_CONCURRENCY = 25;
PushNotificationsService.SPREAD_SLOTS = 18;
PushNotificationsService.MIN_SPREAD_BATCH = 10;
exports.PushNotificationsService = PushNotificationsService = PushNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, auth_service_1.AuthService,
        config_1.ConfigService,
        settings_service_1.SettingsService,
        notices_service_1.NoticesService])
], PushNotificationsService);
//# sourceMappingURL=push-notifications.service.js.map