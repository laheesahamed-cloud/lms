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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const sql_safety_1 = require("../../database/sql-safety");
const subscription_catalog_1 = require("./subscription-catalog");
let PlansService = class PlansService {
    constructor(db) {
        this.db = db;
    }
    async findAll() {
        return this.listPlans(false);
    }
    async findActive() {
        return this.listPlans(true);
    }
    async findById(id) {
        const plans = await this.listPlans(false, id);
        const plan = plans[0];
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        return plan;
    }
    async findByIds(ids) {
        const cleanIds = Array.from(new Set(ids
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)));
        if (cleanIds.length === 0) {
            return new Map();
        }
        const requestedIds = new Set(cleanIds);
        const plans = await this.listPlans(false);
        return new Map(plans
            .filter((plan) => requestedIds.has(Number(plan.id)))
            .map((plan) => [Number(plan.id), plan]));
    }
    async getFeatureCatalog() {
        const features = await this.getFeatures(false);
        return {
            categories: [...subscription_catalog_1.SUBSCRIPTION_FEATURE_CATEGORIES],
            features,
        };
    }
    async create(dto) {
        const payload = await this.normalizeCreatePayload(dto);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(`
          INSERT INTO plans (
            name, slug, description, price, regular_price, offer_price, offer_enabled, currency,
            billing_period, duration_days, features_json, status, sort_order, recommended
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'month', ?, '[]', ?, ?, ?)
        `, [
                payload.name,
                payload.slug,
                payload.description,
                payload.regularPrice,
                payload.regularPrice,
                payload.offerPrice,
                payload.offerEnabled ? 1 : 0,
                payload.currency,
                payload.durationDays,
                payload.status,
                payload.sortOrder,
                payload.recommended ? 1 : 0,
            ]);
            await this.syncPlanFeatures(connection, result.insertId, payload.featureIds);
            await connection.commit();
            return { ok: true, id: result.insertId };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async update(id, dto) {
        const existing = await this.findById(id);
        const payload = await this.normalizeUpdatePayload(existing, dto);
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(`
          UPDATE plans
          SET
            name = ?,
            slug = ?,
            description = ?,
            price = ?,
            regular_price = ?,
            offer_price = ?,
            offer_enabled = ?,
            currency = ?,
            duration_days = ?,
            status = ?,
            sort_order = ?,
            recommended = ?
          WHERE id = ?
        `, [
                payload.name,
                payload.slug,
                payload.description,
                payload.regularPrice,
                payload.regularPrice,
                payload.offerPrice,
                payload.offerEnabled ? 1 : 0,
                payload.currency,
                payload.durationDays,
                payload.status,
                payload.sortOrder,
                payload.recommended ? 1 : 0,
                id,
            ]);
            await this.syncPlanFeatures(connection, id, payload.featureIds);
            await connection.commit();
            return { ok: true, id };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async remove(id) {
        await this.findById(id);
        const [subscriptionRows] = await this.db.execute('SELECT COUNT(*) AS total FROM user_subscriptions WHERE plan_id = ?', [id]);
        if (Number(subscriptionRows[0]?.total || 0) > 0) {
            throw new common_1.BadRequestException('This plan has subscription history and cannot be deleted.');
        }
        await this.db.execute('DELETE FROM subscription_plan_features WHERE plan_id = ?', [id]);
        await this.db.execute('DELETE FROM plans WHERE id = ?', [id]);
        return { ok: true, id };
    }
    async createFeature(dto) {
        const payload = this.normalizeFeaturePayload(dto);
        const [existingRows] = await this.db.execute('SELECT id FROM subscription_features WHERE feature_key = ? LIMIT 1', [payload.featureKey]);
        if (existingRows[0]) {
            throw new common_1.BadRequestException('A feature with this key already exists');
        }
        const [result] = await this.db.execute(`
        INSERT INTO subscription_features (feature_name, feature_key, description, category, status)
        VALUES (?, ?, ?, ?, ?)
      `, [payload.featureName, payload.featureKey, payload.description, payload.category, payload.status]);
        return { ok: true, id: result.insertId };
    }
    async updateFeature(id, dto) {
        const existing = await this.findFeatureById(id);
        const payload = this.normalizeFeaturePayload({
            featureName: dto.featureName ?? existing.featureName,
            featureKey: dto.featureKey ?? existing.featureKey,
            description: dto.description ?? existing.description,
            category: (dto.category ?? existing.category),
            status: dto.status ?? existing.status,
        });
        const [duplicateRows] = await this.db.execute('SELECT id FROM subscription_features WHERE feature_key = ? AND id <> ? LIMIT 1', [payload.featureKey, id]);
        if (duplicateRows[0]) {
            throw new common_1.BadRequestException('A feature with this key already exists');
        }
        await this.db.execute(`
        UPDATE subscription_features
        SET feature_name = ?, feature_key = ?, description = ?, category = ?, status = ?
        WHERE id = ?
      `, [payload.featureName, payload.featureKey, payload.description, payload.category, payload.status, id]);
        await this.refreshPlansFeatureJsonForFeature(id);
        return { ok: true, id };
    }
    async getActiveFeatureKeysForUser(userId) {
        const [rows] = await this.db.execute(`
        SELECT sf.feature_key
        FROM user_subscriptions us
        INNER JOIN subscription_plan_features spf
          ON spf.plan_id = us.plan_id
         AND spf.is_enabled = 1
        INNER JOIN subscription_features sf
          ON sf.id = spf.feature_id
         AND sf.status = 'active'
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
      `, [userId]);
        return Array.from(new Set(rows.map((row) => String(row.feature_key || '').trim()).filter(Boolean)));
    }
    async hasFeatureAccess(userId, featureKey) {
        const [rows] = await this.db.execute(`
        SELECT sf.id
        FROM user_subscriptions us
        INNER JOIN subscription_plan_features spf
          ON spf.plan_id = us.plan_id
         AND spf.is_enabled = 1
        INNER JOIN subscription_features sf
          ON sf.id = spf.feature_id
         AND sf.status = 'active'
        WHERE us.user_id = ?
          AND us.status = 'active'
          AND us.start_date <= CURDATE()
          AND us.end_date >= CURDATE()
          AND sf.feature_key = ?
        LIMIT 1
      `, [userId, featureKey]);
        return rows.length > 0;
    }
    async listPlans(activeOnly, planId) {
        let sql = `
      SELECT
        id, name, slug, description, price, regular_price, offer_price, offer_enabled,
        currency, billing_period, duration_days, features_json, status, sort_order, recommended,
        created_at, updated_at
      FROM plans
      WHERE 1 = 1
    `;
        const params = [];
        if (activeOnly) {
            sql += " AND status = 'active'";
        }
        if (planId) {
            sql += ' AND id = ?';
            params.push(planId);
        }
        sql += ` ORDER BY sort_order ASC, FIELD(status, 'active', 'inactive'), regular_price ASC, id ASC`;
        const [planRows] = await this.db.execute(sql, params);
        const features = await this.getFeatures(false);
        const featureMap = await this.getPlanFeatureMap(planRows.map((row) => Number(row.id)));
        const featureById = new Map(features.map((feature) => [feature.id, feature]));
        return planRows.map((row) => {
            const enabledFeatureIds = featureMap.get(Number(row.id)) || [];
            const enabledFeatures = enabledFeatureIds
                .map((featureId) => featureById.get(featureId))
                .filter((feature) => Boolean(feature));
            return this.mapPlan(row, enabledFeatures);
        });
    }
    async getFeatures(activeOnly) {
        let sql = `
      SELECT id, feature_name, feature_key, description, category, status, created_at, updated_at
      FROM subscription_features
      WHERE 1 = 1
    `;
        if (activeOnly) {
            sql += " AND status = 'active'";
        }
        sql += ' ORDER BY FIELD(category, ?, ?, ?, ?, ?, ?, ?), feature_name ASC';
        const [rows] = await this.db.execute(sql, [...subscription_catalog_1.SUBSCRIPTION_FEATURE_CATEGORIES]);
        return rows.map((row) => ({
            id: Number(row.id),
            featureName: String(row.feature_name),
            featureKey: String(row.feature_key),
            description: String(row.description || ''),
            category: String(row.category),
            status: row.status,
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        }));
    }
    async getPlanFeatureMap(planIds) {
        const map = new Map();
        if (planIds.length === 0) {
            return map;
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(planIds);
        const [rows] = await this.db.execute(`
        SELECT plan_id, feature_id, is_enabled
        FROM subscription_plan_features
        WHERE plan_id IN (${placeholders})
      `, planIds);
        for (const row of rows) {
            if (Number(row.is_enabled) !== 1) {
                continue;
            }
            const existing = map.get(Number(row.plan_id)) || [];
            existing.push(Number(row.feature_id));
            map.set(Number(row.plan_id), existing);
        }
        return map;
    }
    async normalizeCreatePayload(dto) {
        const featureIds = await this.validateFeatureIds(dto.featureIds || []);
        const name = dto.name.trim();
        const slug = await this.ensureUniqueSlug(this.slugify(dto.slug || name));
        return {
            name,
            slug,
            description: String(dto.description || '').trim(),
            regularPrice: Number(dto.regularPrice || 0),
            offerPrice: dto.offerPrice === null || dto.offerPrice === undefined ? null : Number(dto.offerPrice),
            offerEnabled: Boolean(dto.offerEnabled),
            currency: 'LKR',
            durationDays: Number(dto.durationDays || 30),
            sortOrder: Number(dto.sortOrder || 0),
            recommended: Boolean(dto.recommended),
            status: dto.status,
            featureIds,
        };
    }
    async normalizeUpdatePayload(existing, dto) {
        const featureIds = dto.featureIds ? await this.validateFeatureIds(dto.featureIds) : existing.featureIds;
        const nextSlug = dto.slug !== undefined
            ? this.slugify(dto.slug || dto.name || existing.name)
            : (dto.name ? this.slugify(dto.name) : existing.slug);
        const slug = await this.ensureUniqueSlug(nextSlug, existing.id);
        return {
            name: dto.name?.trim() || existing.name,
            slug,
            description: dto.description !== undefined ? String(dto.description || '').trim() : existing.description,
            regularPrice: dto.regularPrice !== undefined ? Number(dto.regularPrice) : existing.regularPrice,
            offerPrice: dto.offerPrice === undefined ? existing.offerPrice : (dto.offerPrice === null ? null : Number(dto.offerPrice)),
            offerEnabled: dto.offerEnabled !== undefined ? Boolean(dto.offerEnabled) : existing.offerEnabled,
            currency: 'LKR',
            durationDays: dto.durationDays !== undefined ? Number(dto.durationDays) : existing.durationDays,
            sortOrder: dto.sortOrder !== undefined ? Number(dto.sortOrder) : existing.sortOrder,
            recommended: dto.recommended !== undefined ? Boolean(dto.recommended) : existing.recommended,
            status: dto.status || existing.status,
            featureIds,
        };
    }
    normalizeFeaturePayload(dto) {
        return {
            featureName: dto.featureName.trim(),
            featureKey: this.slugify(dto.featureKey).replace(/-/g, '_'),
            description: String(dto.description || '').trim(),
            category: dto.category,
            status: dto.status || 'active',
        };
    }
    async validateFeatureIds(featureIds) {
        const cleaned = Array.from(new Set((featureIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
        if (cleaned.length === 0) {
            return [];
        }
        const placeholders = (0, sql_safety_1.sqlPlaceholders)(cleaned);
        const [rows] = await this.db.execute(`SELECT id FROM subscription_features WHERE id IN (${placeholders})`, cleaned);
        if (rows.length !== cleaned.length) {
            throw new common_1.BadRequestException('One or more selected features could not be found');
        }
        return cleaned;
    }
    async ensureUniqueSlug(baseSlug, currentPlanId) {
        let slug = baseSlug || 'plan';
        let suffix = 1;
        while (true) {
            const [rows] = await this.db.execute(`SELECT id FROM plans WHERE slug = ? ${currentPlanId ? 'AND id <> ?' : ''} LIMIT 1`, currentPlanId ? [slug, currentPlanId] : [slug]);
            if (!rows[0]) {
                return slug;
            }
            suffix += 1;
            slug = `${baseSlug}-${suffix}`;
        }
    }
    async syncPlanFeatures(connection, planId, featureIds) {
        await connection.execute('DELETE FROM subscription_plan_features WHERE plan_id = ?', [planId]);
        for (const featureId of featureIds) {
            await connection.execute('INSERT INTO subscription_plan_features (plan_id, feature_id, is_enabled) VALUES (?, ?, 1)', [planId, featureId]);
        }
        await this.refreshSinglePlanFeatureJson(connection, planId, featureIds);
    }
    async refreshSinglePlanFeatureJson(connection, planId, featureIds) {
        let featureNames = [];
        if (featureIds.length > 0) {
            const placeholders = (0, sql_safety_1.sqlPlaceholders)(featureIds);
            const [rows] = await connection.execute(`SELECT feature_name FROM subscription_features WHERE id IN (${placeholders}) ORDER BY feature_name ASC`, featureIds);
            featureNames = rows.map((row) => String(row.feature_name || '').trim()).filter(Boolean);
        }
        await connection.execute('UPDATE plans SET features_json = ? WHERE id = ?', [JSON.stringify(featureNames), planId]);
    }
    async refreshPlansFeatureJsonForFeature(featureId) {
        const [rows] = await this.db.execute('SELECT plan_id FROM subscription_plan_features WHERE feature_id = ?', [featureId]);
        const planIds = Array.from(new Set(rows.map((row) => Number(row.plan_id)).filter((id) => id > 0)));
        if (planIds.length === 0) {
            return;
        }
        const connection = await this.db.getConnection();
        try {
            for (const planId of planIds) {
                const [featureRows] = await connection.execute(`
            SELECT feature_id
            FROM subscription_plan_features
            WHERE plan_id = ? AND is_enabled = 1
          `, [planId]);
                await this.refreshSinglePlanFeatureJson(connection, planId, featureRows.map((row) => Number(row.feature_id)).filter((id) => id > 0));
            }
        }
        finally {
            connection.release();
        }
    }
    async findFeatureById(id) {
        const [rows] = await this.db.execute(`
        SELECT id, feature_name, feature_key, description, category, status, created_at, updated_at
        FROM subscription_features
        WHERE id = ?
        LIMIT 1
      `, [id]);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Feature not found');
        }
        return {
            id: Number(row.id),
            featureName: String(row.feature_name),
            featureKey: String(row.feature_key),
            description: String(row.description || ''),
            category: String(row.category),
            status: row.status,
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        };
    }
    mapPlan(row, enabledFeatures) {
        const regularPrice = Number(row.regular_price ?? row.price ?? 0);
        const offerPrice = row.offer_price === null || row.offer_price === undefined ? null : Number(row.offer_price);
        const offerEnabled = Number(row.offer_enabled) === 1;
        const effectivePrice = offerEnabled && offerPrice !== null ? offerPrice : regularPrice;
        return {
            id: Number(row.id),
            name: String(row.name),
            slug: String(row.slug || ''),
            description: String(row.description || ''),
            price: regularPrice,
            regularPrice,
            offerPrice,
            offerEnabled,
            effectivePrice,
            currency: 'LKR',
            billingPeriod: String(row.billing_period || 'month'),
            durationDays: Number(row.duration_days || 30),
            status: row.status,
            sortOrder: Number(row.sort_order || 0),
            recommended: Number(row.recommended) === 1,
            features: enabledFeatures.map((feature) => feature.featureName),
            featureIds: enabledFeatures.map((feature) => feature.id),
            featureKeys: enabledFeatures.map((feature) => feature.featureKey),
            enabledFeatures,
            featuresByCategory: subscription_catalog_1.SUBSCRIPTION_FEATURE_CATEGORIES.map((category) => ({
                category,
                features: enabledFeatures.filter((feature) => feature.category === category),
            })),
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
        };
    }
    slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'plan';
    }
};
exports.PlansService = PlansService;
exports.PlansService = PlansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], PlansService);
//# sourceMappingURL=plans.service.js.map