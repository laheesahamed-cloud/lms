import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlIdentifier, sqlPlaceholders } from '../../database/sql-safety';

type SetupStatus = 'ok' | 'warning' | 'error';

type TableCheck = {
  name: string;
  label: string;
  present: boolean;
  count: number | null;
};

type SettingRow = RowDataPacket & {
  setting_key: string;
  setting_value: string | null;
};

const REQUIRED_TABLES = [
  ['users', 'Users'],
  ['courses', 'Courses'],
  ['topics', 'Topics'],
  ['subtopics', 'Subtopics'],
  ['lessons', 'Lessons'],
  ['questions', 'Questions'],
  ['quizzes', 'Quizzes'],
  ['system_settings', 'System settings'],
  ['ai_provider_configs', 'AI providers'],
] as const;

const PAYMENT_KEYS = ['payment_payhere_enabled', 'payment_payhere_merchant_id', 'payment_payhere_merchant_secret'];
const SMTP_KEYS = ['smtp_enabled', 'smtp_host', 'smtp_username', 'smtp_password', 'smtp_from_email'];

@Injectable()
export class SetupService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly configService: ConfigService
  ) {}

  async getSetupStatus() {
    const generatedAt = new Date().toISOString();
    const database = await this.getDatabaseStatus();
    const storage = await this.getStorageStatus();

    const checks = [
      database.status,
      storage.status,
      ...(database.configuration?.map((item) => item.status) || []),
    ];

    const overall: SetupStatus = checks.includes('error') ? 'error' : checks.includes('warning') ? 'warning' : 'ok';

    return {
      overall,
      generatedAt,
      database,
      storage,
    };
  }

  private async getDatabaseStatus() {
    try {
      await this.db.query<RowDataPacket[]>('SELECT 1 AS ok');
      const [tableRows] = await this.db.query<RowDataPacket[]>('SHOW TABLES');
      const tableNames = new Set(
        tableRows.map((row) => String(Object.values(row)[0] || '').trim()).filter(Boolean)
      );

      const tables = await Promise.all(
        REQUIRED_TABLES.map(async ([name, label]) => this.getTableCheck(name, label, tableNames.has(name)))
      );
      const missingTables = tables.filter((table) => !table.present);
      const configuration = await this.getConfigurationChecks(tableNames);
      const hasActiveAdmin = !configuration.some((item) => item.key === 'admin-users' && item.status !== 'ok');

      const status: SetupStatus =
        missingTables.length > 0 || !hasActiveAdmin
          ? 'warning'
          : configuration.some((item) => item.status === 'warning')
            ? 'warning'
            : 'ok';

      return {
        status,
        connected: true,
        message: missingTables.length > 0
          ? `${missingTables.length} required database table(s) are missing.`
          : 'Database is connected and required tables are present.',
        tables,
        configuration,
      };
    } catch (error) {
      return {
        status: 'error' as SetupStatus,
        connected: false,
        message: 'Database connection failed. Check backend database environment values and MySQL status.',
        tables: [],
        configuration: [],
      };
    }
  }

  private async getTableCheck(name: string, label: string, present: boolean): Promise<TableCheck> {
    if (!present) {
      return { name, label, present: false, count: null };
    }

    try {
      const table = sqlIdentifier(name, REQUIRED_TABLES.map(([tableName]) => tableName), 'setup table');
      const [rows] = await this.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${table}`);
      return { name, label, present: true, count: Number(rows[0]?.total || 0) };
    } catch {
      return { name, label, present: true, count: null };
    }
  }

  private async getConfigurationChecks(tableNames: Set<string>) {
    const settings = tableNames.has('system_settings') ? await this.getSettingsMap([...PAYMENT_KEYS, ...SMTP_KEYS]) : new Map<string, string>();
    const aiProviderCount = tableNames.has('ai_provider_configs') ? await this.countAiProviders() : 0;
    const activeAdminCount = tableNames.has('users') ? await this.countActiveAdmins() : 0;
    const paymentEnabled = settings.get('payment_payhere_enabled') === 'true';
    const paymentConfigured = Boolean(settings.get('payment_payhere_merchant_id') && settings.get('payment_payhere_merchant_secret'));
    const smtpEnabled = settings.get('smtp_enabled') === 'true';
    const smtpConfigured = Boolean(
      settings.get('smtp_host') &&
      settings.get('smtp_username') &&
      settings.get('smtp_password') &&
      settings.get('smtp_from_email')
    );

    return [
      {
        key: 'admin-users',
        label: 'Admin users',
        status: activeAdminCount > 0 ? 'ok' as SetupStatus : 'warning' as SetupStatus,
        value: `${activeAdminCount} active admin${activeAdminCount === 1 ? '' : 's'}`,
        detail: 'At least one active admin account should exist before handover.',
      },
      {
        key: 'payments',
        label: 'PayHere payments',
        status: paymentEnabled && !paymentConfigured ? 'warning' as SetupStatus : 'ok' as SetupStatus,
        value: paymentConfigured ? 'Configured' : paymentEnabled ? 'Enabled, missing credentials' : 'Disabled',
        detail: 'Payment credentials stay encrypted in the LMS database.',
      },
      {
        key: 'smtp',
        label: 'SMTP email',
        status: smtpEnabled && !smtpConfigured ? 'warning' as SetupStatus : 'ok' as SetupStatus,
        value: smtpConfigured ? 'Configured' : smtpEnabled ? 'Enabled, missing credentials' : 'Disabled',
        detail: 'Needed for real password reset emails.',
      },
      {
        key: 'ai',
        label: 'AI providers',
        status: aiProviderCount > 0 ? 'ok' as SetupStatus : 'warning' as SetupStatus,
        value: `${aiProviderCount} saved provider${aiProviderCount === 1 ? '' : 's'}`,
        detail: 'AI-powered lessons and question tools use the active provider.',
      },
    ];
  }

  private async getSettingsMap(keys: string[]) {
    if (keys.length === 0) {
      return new Map<string, string>();
    }

    const placeholders = sqlPlaceholders(keys);
    const [rows] = await this.db.query<SettingRow[]>(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
      keys
    );
    return new Map(rows.map((row) => [row.setting_key, String(row.setting_value || '').trim()]));
  }

  private async countAiProviders() {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ai_provider_configs WHERE status = 'active' AND api_key_encrypted IS NOT NULL AND api_key_encrypted <> ''`
    );
    return Number(rows[0]?.total || 0);
  }

  private async countActiveAdmins() {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'active'`
    );
    return Number(rows[0]?.total || 0);
  }

  private async getStorageStatus() {
    const uploadsPath = join(process.cwd(), 'uploads');

    try {
      await access(uploadsPath, constants.R_OK | constants.W_OK);
      return {
        status: 'ok' as SetupStatus,
        message: 'Upload folder is readable and writable.',
      };
    } catch {
      return {
        status: 'warning' as SetupStatus,
        message: 'Upload folder is missing or not writable. Payment proofs and uploads may fail until it exists.',
      };
    }
  }
}
