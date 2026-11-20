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
var DrugsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrugsService = void 0;
const general_ci_sort_1 = require("../../common/utils/general-ci-sort");
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const content_version_1 = require("../../common/utils/content-version");
const admin_counters_1 = require("../../common/utils/admin-counters");
let DrugsService = DrugsService_1 = class DrugsService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(DrugsService_1.name);
        this.settingsCache = { enabled: true, freeLimit: 5 };
        this.refreshTimer = null;
        this.drugsCopy = null;
        this.drugsLoading = null;
    }
    onModuleInit() {
        void this.refreshSettings();
        this.refreshTimer = setInterval(() => void this.refreshSettings(), 5 * 60 * 1000);
        this.refreshTimer.unref?.();
    }
    onModuleDestroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    async refreshSettings() {
        try {
            const [rows] = await this.db.execute(`SELECT setting_key, setting_value FROM system_settings
         WHERE setting_key IN ('drug_randomizer_enabled','drug_randomizer_free_limit')`);
            for (const r of rows) {
                if (r.setting_key === 'drug_randomizer_enabled')
                    this.settingsCache.enabled = r.setting_value !== 'false';
                if (r.setting_key === 'drug_randomizer_free_limit')
                    this.settingsCache.freeLimit = parseInt(r.setting_value, 10) || 5;
            }
        }
        catch {
            this.logger.warn('drugs settings cache refresh failed');
        }
    }
    getSettings() {
        return { ...this.settingsCache };
    }
    async drugs() {
        const v = await (0, content_version_1.getContentVersion)(this.db);
        if (this.drugsCopy && this.drugsCopy.v === v)
            return this.drugsCopy;
        if (!this.drugsLoading) {
            this.drugsLoading = (async () => {
                const [rows] = await this.db.query(`SELECT id, name, drug_class, uses, dosage_adult, dosage_pediatric,
                  side_effects, warnings, drug_interactions, pregnancy_info, sl_brand_names
             FROM drugs WHERE is_active = 1 AND drug_class IS NOT NULL`);
                const sorted = [...rows];
                (0, general_ci_sort_1.sortByName)(sorted, (r) => String(r.name));
                const copy = {
                    v,
                    list: sorted.map((r) => [Number(r.id), String(r.name), String(r.drug_class)]),
                    byId: new Map(rows.map((r) => [Number(r.id), { ...r }])),
                };
                this.drugsCopy = copy;
                return copy;
            })().finally(() => { this.drugsLoading = null; });
        }
        return this.drugsLoading;
    }
    async drugList() {
        const copy = await this.drugs();
        return { v: copy.v, drugs: copy.list };
    }
    async drugItem(id) {
        const copy = await this.drugs();
        return copy.byId.get(Number(id)) || null;
    }
    async spinsUsed(userId) {
        const [rows] = await this.db.execute('SELECT drug_spins_used AS used FROM users WHERE id = ? LIMIT 1', [userId]);
        return Number(rows[0]?.used ?? 0);
    }
    async recordSpins(userId, count) {
        const n = Math.max(0, Math.min(100, Math.trunc(Number(count) || 0)));
        if (!n)
            return;
        const limit = this.settingsCache.freeLimit;
        await this.db.execute(`UPDATE users SET drug_spins_used = GREATEST(drug_spins_used, LEAST(drug_spins_used + ?, ?)) WHERE id = ?`, [n, limit, userId]);
    }
    async pickRandomDrugs(count) {
        const [idRows] = await this.db.execute(`SELECT id FROM drugs
       WHERE is_active = 1 AND drug_class IS NOT NULL
       ORDER BY RAND()
       LIMIT ?`, [count]);
        const ids = idRows.map((r) => Number(r.id));
        if (!ids.length)
            return [[], null];
        const [rows] = await this.db.execute(`SELECT id, name, drug_class, uses, dosage_adult, dosage_pediatric,
              side_effects, warnings, drug_interactions, pregnancy_info, sl_brand_names
       FROM drugs
       WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
        const byId = new Map(rows.map((r) => [Number(r.id), r]));
        return [ids.map((id) => byId.get(id)).filter((r) => !!r), null];
    }
    async getBatch(userId, count) {
        const safeCount = Math.min(Math.max(1, count), 20);
        const [[userRows], [drugRows], [classRows]] = await Promise.all([
            this.db.execute(`SELECT drug_spins_used FROM users WHERE id = ?`, [userId]),
            this.pickRandomDrugs(safeCount),
            this.db.execute(`SELECT DISTINCT drug_class FROM drugs
         WHERE is_active = 1 AND drug_class IS NOT NULL
         ORDER BY RAND() LIMIT 30`),
        ]);
        if (!drugRows.length)
            throw new Error('No active drugs in database');
        const pool = classRows.map((r) => r.drug_class);
        const drugs = drugRows.map((drug) => ({
            drug,
            distractors: pool.filter((c) => c !== drug.drug_class).slice(0, 3),
            questionType: 'drug_class',
        }));
        return {
            drugs,
            useCount: Number(userRows[0]?.drug_spins_used ?? 0),
            freeLimit: this.settingsCache.freeLimit,
            enabled: this.settingsCache.enabled,
        };
    }
    async checkSubscription(userId) {
        const [rows] = await this.db.execute(`SELECT COUNT(*) AS cnt FROM user_subscriptions
       WHERE user_id = ? AND status = 'active'
         AND start_date <= CURDATE() AND end_date >= CURDATE()
         AND (access_expires_at IS NULL OR access_expires_at > UTC_TIMESTAMP())
         AND payment_status != 'free_plan'`, [userId]);
        return Number(rows[0]?.cnt ?? 0) > 0;
    }
    async getSpinCount(userId) {
        const [rows] = await this.db.execute(`SELECT drug_spins_used FROM users WHERE id = ?`, [userId]);
        return Number(rows[0]?.drug_spins_used ?? 0);
    }
    async recordSpin(userId) {
        await this.db.execute(`UPDATE users SET drug_spins_used = drug_spins_used + 1 WHERE id = ?`, [userId]);
    }
    async listDrugs(page, limit, search, after) {
        const take = Math.min(100, Math.max(1, Math.trunc(limit) || 30));
        const pageNo = Math.max(1, Math.trunc(page) || 1);
        const columns = 'id, name, drug_class, sl_brand_names, is_active, created_at';
        if (String(search || '').trim()) {
            const like = `%${String(search).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
            const [rows] = await this.db.query(`SELECT ${columns} FROM drugs WHERE name LIKE ? OR drug_class LIKE ? LIMIT 500`, [like, like]);
            (0, general_ci_sort_1.sortByName)(rows, (r) => String(r.name));
            return { drugs: rows.slice((pageNo - 1) * take, pageNo * take), total: rows.length, page: pageNo, limit: take };
        }
        const keyset = after && Number.isInteger(after.id) && after.id > 0;
        const [rows] = await this.db.query(`SELECT ${columns} FROM drugs FORCE INDEX (idx_drugs_name_id)
       ${keyset ? 'WHERE name > ? OR (name = ? AND id > ?)' : ''}
       ORDER BY name ASC, id ASC LIMIT ?`, keyset ? [after.name, after.name, after.id, take] : [take]);
        let total = null;
        if (!keyset) {
            total = (await (0, admin_counters_1.readCounters)(this.db, 'drugs:total')).get('drugs:total') ?? 0;
        }
        return { drugs: rows, total, page: pageNo, limit: take };
    }
    async listDrugIds(search) {
        const q = String(search || '').trim();
        const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const [rows] = await this.db.query(`SELECT id FROM drugs ${q ? 'WHERE name LIKE ? OR drug_class LIKE ?' : ''}`, q ? [like, like] : []);
        return { ids: rows.map((r) => Number(r.id)) };
    }
    async getDrug(id) {
        const [rows] = await this.db.execute(`SELECT id, name, drug_class, uses, dosage_adult, dosage_pediatric, side_effects, warnings,
              drug_interactions, pregnancy_info, sl_brand_names, is_active, created_at, updated_at
       FROM drugs WHERE id = ?`, [id]);
        return rows[0] ?? null;
    }
    async createDrug(data) {
        const [result] = await this.db.execute(`INSERT INTO drugs
         (name,drug_class,uses,dosage_adult,dosage_pediatric,side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
       VALUES (?,?,?,?,?,?,?,?,?,?)`, [data.name, data.drug_class, data.uses, data.dosage_adult, data.dosage_pediatric,
            data.side_effects, data.warnings, data.drug_interactions, data.pregnancy_info, data.sl_brand_names].map((v) => v ?? null));
        await (0, admin_counters_1.bumpCounter)(this.db, 'drugs:total', 1);
        return { id: result.insertId };
    }
    async updateDrug(id, data) {
        await this.db.execute(`UPDATE drugs SET name=?,drug_class=?,uses=?,dosage_adult=?,dosage_pediatric=?,
       side_effects=?,warnings=?,drug_interactions=?,pregnancy_info=?,sl_brand_names=?
       WHERE id=?`, [...[data.name, data.drug_class, data.uses, data.dosage_adult, data.dosage_pediatric,
                data.side_effects, data.warnings, data.drug_interactions, data.pregnancy_info, data.sl_brand_names].map((v) => v ?? null), id]);
    }
    async toggleDrug(id) {
        await this.db.execute(`UPDATE drugs SET is_active = 1 - is_active WHERE id = ?`, [id]);
    }
    async importDrugs(buffer, filename) {
        const XLSX = require('xlsx');
        let rows;
        const ext = filename.toLowerCase().split('.').pop();
        if (ext === 'csv') {
            const wb = XLSX.read(buffer, { type: 'buffer' });
            rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }
        else {
            const wb = XLSX.read(buffer, { type: 'buffer' });
            const sheet = wb.Sheets['drugs'] ?? wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet);
        }
        let inserted = 0, skipped = 0;
        for (const r of rows) {
            if (!r.name) {
                skipped++;
                continue;
            }
            try {
                const [res] = await this.db.execute(`INSERT IGNORE INTO drugs
             (name,drug_class,uses,dosage_adult,dosage_pediatric,
              side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
           VALUES (?,?,?,?,?,?,?,?,?,?)`, [r.name || null, r.drug_class || null, r.uses || null,
                    r.dosage_adult || null, r.dosage_pediatric || null,
                    r.side_effects || null, r.warnings || null,
                    r.drug_interactions || null, r.pregnancy_info || null,
                    r.sl_brand_names || null]);
                if (res.affectedRows > 0)
                    inserted++;
                else
                    skipped++;
            }
            catch {
                skipped++;
            }
        }
        if (inserted)
            await (0, admin_counters_1.bumpCounter)(this.db, 'drugs:total', inserted);
        return { inserted, skipped };
    }
    async deleteDrug(id) {
        const [res] = await this.db.execute(`DELETE FROM drugs WHERE id = ?`, [id]);
        if (res.affectedRows > 0)
            await (0, admin_counters_1.bumpCounter)(this.db, 'drugs:total', -res.affectedRows);
    }
    async updateFeatureSettings(enabled, freeLimit) {
        await Promise.all([
            this.db.execute(`INSERT INTO system_settings (setting_key,setting_value) VALUES ('drug_randomizer_enabled',?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`, [enabled ? 'true' : 'false']),
            this.db.execute(`INSERT INTO system_settings (setting_key,setting_value) VALUES ('drug_randomizer_free_limit',?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`, [String(freeLimit)]),
        ]);
        this.settingsCache = { enabled, freeLimit };
    }
};
exports.DrugsService = DrugsService;
exports.DrugsService = DrugsService = DrugsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], DrugsService);
//# sourceMappingURL=drugs.service.js.map