import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';

export interface DrugsSettings {
  enabled: boolean;
  freeLimit: number;
}

type DrugRow = RowDataPacket & {
  id: number;
  name: string;
  drug_class: string | null;
  uses: string | null;
  dosage_adult: string | null;
  dosage_pediatric: string | null;
  side_effects: string | null;
  warnings: string | null;
  drug_interactions: string | null;
  pregnancy_info: string | null;
  sl_brand_names: string | null;
  is_active: number;
};

@Injectable()
export class DrugsService implements OnModuleInit {
  private readonly logger = new Logger(DrugsService.name);
  private settingsCache: DrugsSettings = { enabled: true, freeLimit: 5 };
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  onModuleInit() {
    void this.refreshSettings();
    this.refreshTimer = setInterval(() => void this.refreshSettings(), 5 * 60 * 1000);
  }

  private async refreshSettings() {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT setting_key, setting_value FROM system_settings
         WHERE setting_key IN ('drug_randomizer_enabled','drug_randomizer_free_limit')`,
      );
      for (const r of rows) {
        if (r.setting_key === 'drug_randomizer_enabled') this.settingsCache.enabled = r.setting_value !== 'false';
        if (r.setting_key === 'drug_randomizer_free_limit') this.settingsCache.freeLimit = parseInt(r.setting_value, 10) || 5;
      }
    } catch {
      this.logger.warn('drugs settings cache refresh failed');
    }
  }

  getSettings(): DrugsSettings {
    return { ...this.settingsCache };
  }

  // ── batch fetch — 3 parallel queries, no N+1, no counter increment ──
  async getBatch(userId: number, count: number) {
    const safeCount = Math.min(Math.max(1, count), 20);

    // 3 queries in parallel: user meta + random drugs + distractor pool
    const [[userRows], [drugRows], [classRows]] = await Promise.all([
      this.db.execute<RowDataPacket[]>(
        `SELECT drug_spins_used FROM users WHERE id = ?`, [userId],
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT id, name, drug_class, uses, dosage_adult, dosage_pediatric,
                side_effects, warnings, drug_interactions, pregnancy_info, sl_brand_names
         FROM drugs
         WHERE is_active = 1 AND drug_class IS NOT NULL
         ORDER BY RAND()
         LIMIT ?`, [safeCount],
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT DISTINCT drug_class FROM drugs
         WHERE is_active = 1 AND drug_class IS NOT NULL
         ORDER BY RAND() LIMIT 30`,
      ),
    ]);

    if (!drugRows.length) throw new Error('No active drugs in database');

    const pool: string[] = classRows.map((r) => r.drug_class as string);

    const drugs = (drugRows as DrugRow[]).map((drug) => ({
      drug,
      distractors: pool.filter((c) => c !== drug.drug_class).slice(0, 3),
      questionType: 'drug_class' as const,
    }));

    return {
      drugs,
      useCount: Number((userRows[0] as any)?.drug_spins_used ?? 0),
      freeLimit: this.settingsCache.freeLimit,
      enabled: this.settingsCache.enabled,
    };
  }

  // Check active subscription directly — bypasses session cache which may be stale
  async checkSubscription(userId: number): Promise<boolean> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM user_subscriptions
       WHERE user_id = ? AND status = 'active'
         AND start_date <= CURDATE() AND end_date >= CURDATE()`,
      [userId],
    );
    return Number((rows[0] as any)?.cnt ?? 0) > 0;
  }

  async getSpinCount(userId: number): Promise<number> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT drug_spins_used FROM users WHERE id = ?`, [userId],
    );
    return Number((rows[0] as any)?.drug_spins_used ?? 0);
  }

  async recordSpin(userId: number) {
    await this.db.execute(
      `UPDATE users SET drug_spins_used = drug_spins_used + 1 WHERE id = ?`, [userId],
    );
  }

  // ── admin list (two parallel queries via Promise.all — no N+1) ──
  async listDrugs(page: number, limit: number, search: string) {
    const offset = (page - 1) * limit;
    const like = `%${search}%`;

    const [[countRows], [rows]] = await Promise.all([
      this.db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM drugs WHERE name LIKE ? OR drug_class LIKE ?`,
        [like, like],
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT id, name, drug_class, sl_brand_names, is_active, created_at
         FROM drugs WHERE name LIKE ? OR drug_class LIKE ?
         ORDER BY name ASC LIMIT ? OFFSET ?`,
        [like, like, limit, offset],
      ),
    ]);

    return { drugs: rows, total: Number((countRows[0] as any).total), page, limit };
  }

  async getDrug(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM drugs WHERE id = ?`, [id]);
    return rows[0] ?? null;
  }

  async createDrug(data: Record<string, any>) {
    const [result] = await this.db.execute<any>(
      `INSERT INTO drugs
         (name,drug_class,uses,dosage_adult,dosage_pediatric,side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [data.name, data.drug_class, data.uses, data.dosage_adult, data.dosage_pediatric,
       data.side_effects, data.warnings, data.drug_interactions, data.pregnancy_info, data.sl_brand_names],
    );
    return { id: result.insertId };
  }

  async updateDrug(id: number, data: Record<string, any>) {
    await this.db.execute(
      `UPDATE drugs SET name=?,drug_class=?,uses=?,dosage_adult=?,dosage_pediatric=?,
       side_effects=?,warnings=?,drug_interactions=?,pregnancy_info=?,sl_brand_names=?
       WHERE id=?`,
      [data.name, data.drug_class, data.uses, data.dosage_adult, data.dosage_pediatric,
       data.side_effects, data.warnings, data.drug_interactions, data.pregnancy_info, data.sl_brand_names, id],
    );
  }

  async toggleDrug(id: number) {
    await this.db.execute(`UPDATE drugs SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async importDrugs(buffer: Buffer, filename: string): Promise<{ inserted: number; skipped: number }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    let rows: Record<string, any>[];

    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheet = wb.Sheets['drugs'] ?? wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }

    let inserted = 0, skipped = 0;
    for (const r of rows) {
      if (!r.name) { skipped++; continue; }
      try {
        const [res] = await this.db.execute<any>(
          `INSERT IGNORE INTO drugs
             (name,drug_class,uses,dosage_adult,dosage_pediatric,
              side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [r.name||null, r.drug_class||null, r.uses||null,
           r.dosage_adult||null, r.dosage_pediatric||null,
           r.side_effects||null, r.warnings||null,
           r.drug_interactions||null, r.pregnancy_info||null,
           r.sl_brand_names||null],
        );
        if (res.affectedRows > 0) inserted++; else skipped++;
      } catch { skipped++; }
    }
    return { inserted, skipped };
  }

  async deleteDrug(id: number) {
    await this.db.execute(`DELETE FROM drugs WHERE id = ?`, [id]);
  }

  async updateFeatureSettings(enabled: boolean, freeLimit: number) {
    await Promise.all([
      this.db.execute(
        `INSERT INTO system_settings (setting_key,setting_value) VALUES ('drug_randomizer_enabled',?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
        [enabled ? 'true' : 'false'],
      ),
      this.db.execute(
        `INSERT INTO system_settings (setting_key,setting_value) VALUES ('drug_randomizer_free_limit',?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
        [String(freeLimit)],
      ),
    ]);
    this.settingsCache = { enabled, freeLimit };
  }
}
