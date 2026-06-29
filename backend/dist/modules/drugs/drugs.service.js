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
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
let DrugsService = DrugsService_1 = class DrugsService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(DrugsService_1.name);
        this.settingsCache = { enabled: true, freeLimit: 5 };
        this.refreshTimer = null;
    }
    onModuleInit() {
        void this.refreshSettings();
        this.refreshTimer = setInterval(() => void this.refreshSettings(), 5 * 60 * 1000);
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
    async getBatch(userId, count) {
        const safeCount = Math.min(Math.max(1, count), 20);
        const [[userRows], [drugRows], [classRows]] = await Promise.all([
            this.db.execute(`SELECT drug_spins_used FROM users WHERE id = ?`, [userId]),
            this.db.execute(`SELECT id, name, drug_class, uses, dosage_adult, dosage_pediatric,
                side_effects, warnings, drug_interactions, pregnancy_info, sl_brand_names
         FROM drugs
         WHERE is_active = 1 AND drug_class IS NOT NULL
         ORDER BY RAND()
         LIMIT ?`, [safeCount]),
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
    async getSpinCount(userId) {
        const [rows] = await this.db.execute(`SELECT drug_spins_used FROM users WHERE id = ?`, [userId]);
        return Number(rows[0]?.drug_spins_used ?? 0);
    }
    async recordSpin(userId) {
        await this.db.execute(`UPDATE users SET drug_spins_used = drug_spins_used + 1 WHERE id = ?`, [userId]);
    }
    async listDrugs(page, limit, search) {
        const offset = (page - 1) * limit;
        const like = `%${search}%`;
        const [[countRows], [rows]] = await Promise.all([
            this.db.execute(`SELECT COUNT(*) AS total FROM drugs WHERE name LIKE ? OR drug_class LIKE ?`, [like, like]),
            this.db.execute(`SELECT id, name, drug_class, sl_brand_names, is_active, created_at
         FROM drugs WHERE name LIKE ? OR drug_class LIKE ?
         ORDER BY name ASC LIMIT ? OFFSET ?`, [like, like, limit, offset]),
        ]);
        return { drugs: rows, total: Number(countRows[0].total), page, limit };
    }
    async getDrug(id) {
        const [rows] = await this.db.execute(`SELECT * FROM drugs WHERE id = ?`, [id]);
        return rows[0] ?? null;
    }
    async createDrug(data) {
        const [result] = await this.db.execute(`INSERT INTO drugs
         (name,drug_class,uses,dosage_adult,dosage_pediatric,side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
       VALUES (?,?,?,?,?,?,?,?,?,?)`, [data.name, data.drug_class, data.uses, data.dosage_adult, data.dosage_pediatric,
            data.side_effects, data.warnings, data.drug_interactions, data.pregnancy_info, data.sl_brand_names]);
        return { id: result.insertId };
    }
    async updateDrug(id, data) {
        await this.db.execute(`UPDATE drugs SET name=?,drug_class=?,uses=?,dosage_adult=?,dosage_pediatric=?,
       side_effects=?,warnings=?,drug_interactions=?,pregnancy_info=?,sl_brand_names=?
       WHERE id=?`, [data.name, data.drug_class, data.uses, data.dosage_adult, data.dosage_pediatric,
            data.side_effects, data.warnings, data.drug_interactions, data.pregnancy_info, data.sl_brand_names, id]);
    }
    async toggleDrug(id) {
        await this.db.execute(`UPDATE drugs SET is_active = 1 - is_active WHERE id = ?`, [id]);
    }
    async importDrugs(buffer, filename) {
        const XLSX = require('xlsx');
        const ext = filename.toLowerCase().split('.').pop();
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheet = (ext !== 'csv' && wb.Sheets['drugs']) ? wb.Sheets['drugs'] : wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        let inserted = 0, skipped = 0;
        for (const r of rows) {
            if (!r.name) { skipped++; continue; }
            try {
                const [res] = await this.db.execute(`INSERT IGNORE INTO drugs
             (name,drug_class,uses,dosage_adult,dosage_pediatric,
              side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
           VALUES (?,?,?,?,?,?,?,?,?,?)`, [r.name || null, r.drug_class || null, r.uses || null,
                    r.dosage_adult || null, r.dosage_pediatric || null,
                    r.side_effects || null, r.warnings || null,
                    r.drug_interactions || null, r.pregnancy_info || null,
                    r.sl_brand_names || null]);
                if (res.affectedRows > 0) inserted++; else skipped++;
            }
            catch { skipped++; }
        }
        return { inserted, skipped };
    }
    async deleteDrug(id) {
        await this.db.execute(`DELETE FROM drugs WHERE id = ?`, [id]);
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