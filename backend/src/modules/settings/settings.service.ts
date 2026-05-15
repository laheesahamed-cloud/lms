import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MODE_OPTIONS,
  AiProviderKey,
  decryptSecret,
  encryptSecret,
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  isAiProviderKey,
  maskSecret,
  normalizeAiProviderBaseUrl,
} from '../../common/utils/ai-provider.utils';

type SettingRow = RowDataPacket & {
  setting_key: string;
  setting_value: string | null;
  updated_at: string;
};

type AiProviderRow = RowDataPacket & {
  id: number;
  provider_key: string;
  provider_label: string;
  api_key_encrypted: string | null;
  api_code_encrypted: string | null;
  base_url: string | null;
  model: string | null;
  status: 'active' | 'inactive';
  is_active: number;
  created_at: string;
  updated_at: string;
};

const WHATSAPP_NUMBER_SETTING_KEY = 'contact_whatsapp_number';
const PAYMENT_SETTING_KEYS = {
  enabled: 'payment_payhere_enabled',
  sandboxMode: 'payment_payhere_sandbox_mode',
  merchantId: 'payment_payhere_merchant_id',
  merchantSecret: 'payment_payhere_merchant_secret',
  currency: 'payment_payhere_currency',
  returnUrl: 'payment_payhere_return_url',
  cancelUrl: 'payment_payhere_cancel_url',
  notifyUrl: 'payment_payhere_notify_url',
  checkoutTitle: 'payment_payhere_checkout_title',
  buttonLabel: 'payment_payhere_button_label',
  supportText: 'payment_payhere_support_text',
  autoActivatePaidSubscriptions: 'payment_payhere_auto_activate_paid_subscriptions',
} as const;

const SMTP_SETTING_KEYS = {
  enabled: 'smtp_enabled',
  host: 'smtp_host',
  port: 'smtp_port',
  security: 'smtp_security',
  username: 'smtp_username',
  password: 'smtp_password',
  fromName: 'smtp_from_name',
  fromEmail: 'smtp_from_email',
  publicUrl: 'smtp_public_url',
  subject: 'smtp_reset_subject',
  heading: 'smtp_reset_heading',
  intro: 'smtp_reset_intro',
  buttonLabel: 'smtp_reset_button_label',
  footer: 'smtp_reset_footer',
} as const;

export type PayHerePaymentSettings = {
  enabled: boolean;
  sandboxMode: boolean;
  merchantId: string;
  merchantSecret: string;
  currency: 'LKR' | 'USD';
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  checkoutTitle: string;
  buttonLabel: string;
  supportText: string;
  autoActivatePaidSubscriptions: boolean;
};

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  security: 'starttls' | 'ssl';
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  publicUrl: string;
  subject: string;
  heading: string;
  intro: string;
  buttonLabel: string;
  footer: string;
};

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly configService: ConfigService
  ) {}

  async getGeneralSettings() {
    const whatsappNumber = await this.getSettingValue(WHATSAPP_NUMBER_SETTING_KEY);

    return {
      ok: true,
      whatsappNumber,
      note: 'These lightweight system preferences are saved inside the LMS database and can be updated without changing environment files.',
    };
  }

  async updateGeneralSettings(input: { whatsappNumber?: string }) {
    const whatsappNumber = this.normalizeOptionalValue(input.whatsappNumber);

    await this.saveSettingValue(WHATSAPP_NUMBER_SETTING_KEY, whatsappNumber);

    return this.getGeneralSettings();
  }

  async getPaymentSettings() {
    const settings = await this.getRawPaymentSettings();

    return {
      ok: true,
      provider: 'payhere',
      actionUrl: this.getPayHereCheckoutUrl(settings.sandboxMode),
      ...this.serializePaymentSettings(settings, true),
      note: 'PayHere is configured for hosted checkout. Merchant secrets stay encrypted in the LMS database and are only used on the server to generate and verify hashes.',
    };
  }

  async getSmtpSettings() {
    const settings = await this.getRawSmtpSettings();

    return {
      ok: true,
      ...this.serializeSmtpSettings(settings),
      note: 'SMTP credentials are stored encrypted in the LMS database. Password reset emails are sent only when SMTP is enabled and configured.',
    };
  }

  async getStudentPaymentSettings() {
    const settings = await this.getRawPaymentSettings();
    return this.serializePaymentSettings(settings, false);
  }

  async getPayHereCheckoutSettings() {
    return this.getRawPaymentSettings();
  }

  async updatePaymentSettings(input: Partial<PayHerePaymentSettings>) {
    const current = await this.getRawPaymentSettings();
    const next: PayHerePaymentSettings = {
      enabled: input.enabled ?? current.enabled,
      sandboxMode: input.sandboxMode ?? current.sandboxMode,
      merchantId: input.merchantId !== undefined ? this.normalizeOptionalValue(input.merchantId) : current.merchantId,
      merchantSecret:
        input.merchantSecret !== undefined
          ? this.normalizeSecretInput(input.merchantSecret) || current.merchantSecret
          : current.merchantSecret,
      currency: input.currency === 'USD' ? 'USD' : input.currency === 'LKR' ? 'LKR' : current.currency,
      returnUrl: input.returnUrl !== undefined ? this.normalizeOptionalValue(input.returnUrl) : current.returnUrl,
      cancelUrl: input.cancelUrl !== undefined ? this.normalizeOptionalValue(input.cancelUrl) : current.cancelUrl,
      notifyUrl: input.notifyUrl !== undefined ? this.normalizeOptionalValue(input.notifyUrl) : current.notifyUrl,
      checkoutTitle:
        input.checkoutTitle !== undefined
          ? this.normalizeOptionalValue(input.checkoutTitle) || 'ERPM LMS subscription'
          : current.checkoutTitle,
      buttonLabel:
        input.buttonLabel !== undefined
          ? this.normalizeOptionalValue(input.buttonLabel) || 'Pay with PayHere'
          : current.buttonLabel,
      supportText:
        input.supportText !== undefined
          ? this.normalizeOptionalValue(input.supportText)
          : current.supportText,
      autoActivatePaidSubscriptions: input.autoActivatePaidSubscriptions ?? current.autoActivatePaidSubscriptions,
    };

    await Promise.all([
      this.saveSettingValue(PAYMENT_SETTING_KEYS.enabled, next.enabled ? 'true' : 'false'),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.sandboxMode, next.sandboxMode ? 'true' : 'false'),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.merchantId, next.merchantId),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.merchantSecret, this.encryptSecret(next.merchantSecret)),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.currency, next.currency),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.returnUrl, next.returnUrl),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.cancelUrl, next.cancelUrl),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.notifyUrl, next.notifyUrl),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.checkoutTitle, next.checkoutTitle),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.buttonLabel, next.buttonLabel),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.supportText, next.supportText),
      this.saveSettingValue(PAYMENT_SETTING_KEYS.autoActivatePaidSubscriptions, next.autoActivatePaidSubscriptions ? 'true' : 'false'),
    ]);

    return this.getPaymentSettings();
  }

  async updateSmtpSettings(input: Partial<SmtpSettings>) {
    const current = await this.getRawSmtpSettings();
    const next: SmtpSettings = {
      enabled: input.enabled ?? current.enabled,
      host: input.host !== undefined ? this.normalizeOptionalValue(input.host) : current.host,
      port: Number(input.port || current.port || 587),
      security: input.security === 'ssl' ? 'ssl' : input.security === 'starttls' ? 'starttls' : current.security,
      username: input.username !== undefined ? this.normalizeOptionalValue(input.username) : current.username,
      password:
        input.password !== undefined
          ? this.normalizeSecretInput(input.password) || current.password
          : current.password,
      fromName: input.fromName !== undefined ? this.normalizeOptionalValue(input.fromName) || 'ERPM LMS' : current.fromName,
      fromEmail: input.fromEmail !== undefined ? this.normalizeOptionalValue(input.fromEmail) : current.fromEmail,
      publicUrl: input.publicUrl !== undefined ? this.normalizeOptionalValue(input.publicUrl) : current.publicUrl,
      subject:
        input.subject !== undefined
          ? this.normalizeOptionalValue(input.subject) || 'Reset your ERPM LMS password'
          : current.subject,
      heading:
        input.heading !== undefined
          ? this.normalizeOptionalValue(input.heading) || 'Reset your password'
          : current.heading,
      intro:
        input.intro !== undefined
          ? this.normalizeOptionalValue(input.intro) || 'We received a request to reset your ERPM LMS password.'
          : current.intro,
      buttonLabel:
        input.buttonLabel !== undefined
          ? this.normalizeOptionalValue(input.buttonLabel) || 'Reset password'
          : current.buttonLabel,
      footer:
        input.footer !== undefined
          ? this.normalizeOptionalValue(input.footer) || 'If you did not request this, you can safely ignore this email.'
          : current.footer,
    };

    await Promise.all([
      this.saveSettingValue(SMTP_SETTING_KEYS.enabled, next.enabled ? 'true' : 'false'),
      this.saveSettingValue(SMTP_SETTING_KEYS.host, next.host),
      this.saveSettingValue(SMTP_SETTING_KEYS.port, String(next.port || 587)),
      this.saveSettingValue(SMTP_SETTING_KEYS.security, next.security),
      this.saveSettingValue(SMTP_SETTING_KEYS.username, next.username),
      this.saveSettingValue(SMTP_SETTING_KEYS.password, this.encryptSecret(next.password)),
      this.saveSettingValue(SMTP_SETTING_KEYS.fromName, next.fromName),
      this.saveSettingValue(SMTP_SETTING_KEYS.fromEmail, next.fromEmail),
      this.saveSettingValue(SMTP_SETTING_KEYS.publicUrl, next.publicUrl),
      this.saveSettingValue(SMTP_SETTING_KEYS.subject, next.subject),
      this.saveSettingValue(SMTP_SETTING_KEYS.heading, next.heading),
      this.saveSettingValue(SMTP_SETTING_KEYS.intro, next.intro),
      this.saveSettingValue(SMTP_SETTING_KEYS.buttonLabel, next.buttonLabel),
      this.saveSettingValue(SMTP_SETTING_KEYS.footer, next.footer),
    ]);

    return this.getSmtpSettings();
  }

  async getAiProviderSettings() {
    const providers = await this.listAiProviders();
    const activeProvider = providers.find((provider) => provider.isActive) || null;
    const lessonProviderConfigured = providers.some((provider) => provider.status === 'active' && provider.hasApiKey) ||
      Boolean(String(this.configService.get<string>('OPENROUTER_API_KEY') || '').trim());
    const encryptionKeyConfigured = Boolean(String(this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim());

    return {
      ok: true,
      providers,
      activeProviderId: activeProvider?.id || null,
      activeProvider,
      lessonProviderConfigured,
      availableProviders: Object.entries(AI_PROVIDER_LABELS).map(([providerKey, label]) => ({
        providerKey,
        label,
        defaultModel: getDefaultModelForProvider(providerKey as AiProviderKey),
        modeOptions: AI_PROVIDER_MODE_OPTIONS[providerKey as AiProviderKey] || [],
      })),
      note: 'Only the active provider powers AI-generated pages. Secrets are stored encrypted in the LMS database and returned to the dashboard in masked form only.',
      encryptionStatus: encryptionKeyConfigured
        ? 'Configured from SETTINGS_ENCRYPTION_KEY.'
        : 'Using the development fallback secret. Set SETTINGS_ENCRYPTION_KEY before production deployment.',
    };
  }

  async createAiProvider(input: {
    providerKey: string;
    providerLabel?: string;
    apiKey?: string;
    runCode?: string;
    apiCode?: string;
    baseUrl?: string;
    model?: string;
    status?: string;
    isActive?: boolean;
  }) {
    const providerKey = this.normalizeProviderKey(input.providerKey);
    const providerLabel = this.normalizeOptionalValue(input.providerLabel) || AI_PROVIDER_LABELS[providerKey];
    const apiKey = this.normalizeSecretInput(input.apiKey);
    const apiCode = this.normalizeSecretInput(input.runCode ?? input.apiCode);
    const baseUrl = normalizeAiProviderBaseUrl(providerKey, input.baseUrl);
    const model = this.normalizeOptionalValue(input.model) || getDefaultModelForProvider(providerKey);
    const status = input.status === 'inactive' ? 'inactive' : 'active';
    const isActive = Boolean(input.isActive);

    if (!providerLabel) {
      throw new BadRequestException('Provider label is required');
    }

    await this.db.execute(
      `
        INSERT INTO ai_provider_configs (
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model,
          status,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        providerKey,
        providerLabel,
        this.encryptSecret(apiKey),
        this.encryptSecret(apiCode),
        baseUrl,
        model,
        status,
      ]
    );

    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS id');
    const insertedId = Number(rows[0]?.id || 0);

    if (isActive || (status === 'active' && (await this.countActiveAiProviders()) === 0)) {
      await this.setActiveAiProvider(insertedId);
    }

    return this.getAiProviderSettings();
  }

  async testAiProvider(input: {
    providerKey: string;
    apiKey?: string;
  }) {
    const providerKey = this.normalizeProviderKey(input.providerKey);
    const apiKey = this.normalizeSecretInput(input.apiKey);

    if (!apiKey) {
      throw new BadRequestException('Paste an API key before testing the provider.');
    }

    const modeOptions = await this.runProviderConnectionTest(providerKey, apiKey);
    const normalizedOptions = modeOptions.length > 0 ? modeOptions : AI_PROVIDER_MODE_OPTIONS[providerKey] || [];

    return {
      ok: true,
      providerKey,
      providerLabel: AI_PROVIDER_LABELS[providerKey],
      message: `${AI_PROVIDER_LABELS[providerKey]} accepted the API key.`,
      modeOptions: normalizedOptions,
      defaultModel: normalizedOptions[0] || getDefaultModelForProvider(providerKey),
      testedAt: new Date().toISOString(),
    };
  }

  async updateAiProvider(
    id: number,
    input: {
      providerKey?: string;
      providerLabel?: string;
      apiKey?: string;
      runCode?: string;
      apiCode?: string;
      baseUrl?: string;
      model?: string;
      status?: string;
      isActive?: boolean;
    }
  ) {
    const current = await this.getAiProviderRowOrThrow(id);
    const providerKey = input.providerKey ? this.normalizeProviderKey(input.providerKey) : this.normalizeProviderKey(current.provider_key);
    const providerLabel =
      input.providerLabel !== undefined
        ? this.normalizeOptionalValue(input.providerLabel) || AI_PROVIDER_LABELS[providerKey]
        : current.provider_label;
    const baseUrl =
      input.baseUrl !== undefined
        ? normalizeAiProviderBaseUrl(providerKey, input.baseUrl)
        : normalizeAiProviderBaseUrl(providerKey, current.base_url);
    const model =
      input.model !== undefined
        ? this.normalizeOptionalValue(input.model) || getDefaultModelForProvider(providerKey)
        : String(current.model || '').trim();
    const status = input.status === 'inactive' ? 'inactive' : input.status === 'active' ? 'active' : current.status;
    const nextApiKey = input.apiKey !== undefined ? this.normalizeSecretInput(input.apiKey) : '';
    const nextApiCode =
      input.runCode !== undefined || input.apiCode !== undefined
        ? this.normalizeSecretInput(input.runCode ?? input.apiCode)
        : '';
    const apiKeyEncrypted =
      input.apiKey !== undefined && nextApiKey
        ? this.encryptSecret(nextApiKey)
        : String(current.api_key_encrypted || '');
    const apiCodeEncrypted =
      (input.runCode !== undefined || input.apiCode !== undefined) && nextApiCode
        ? this.encryptSecret(nextApiCode)
        : String(current.api_code_encrypted || '');

    await this.db.execute(
      `
        UPDATE ai_provider_configs
        SET provider_key = ?,
            provider_label = ?,
            api_key_encrypted = ?,
            api_code_encrypted = ?,
            base_url = ?,
            model = ?,
            status = ?
        WHERE id = ?
      `,
      [providerKey, providerLabel, apiKeyEncrypted, apiCodeEncrypted, baseUrl, model, status, id]
    );

    if (input.isActive) {
      await this.setActiveAiProvider(id);
    } else if (status === 'inactive' && current.is_active) {
      await this.db.execute(`UPDATE ai_provider_configs SET is_active = 0 WHERE id = ?`, [id]);
      await this.activateFallbackProvider(id);
    }

    return this.getAiProviderSettings();
  }

  async activateAiProvider(id: number) {
    await this.getAiProviderRowOrThrow(id);
    await this.setActiveAiProvider(id);
    return this.getAiProviderSettings();
  }

  async deleteAiProvider(id: number) {
    const current = await this.getAiProviderRowOrThrow(id);
    await this.db.execute(`DELETE FROM ai_provider_configs WHERE id = ?`, [id]);

    if (current.is_active) {
      await this.activateFallbackProvider(id);
    }

    return this.getAiProviderSettings();
  }

  private async getSettingValue(settingKey: string) {
    const [rows] = await this.db.execute<SettingRow[]>(
      `
        SELECT setting_key, setting_value, updated_at
        FROM system_settings
        WHERE setting_key = ?
        LIMIT 1
      `,
      [settingKey]
    );

    return rows[0]?.setting_value?.trim() || '';
  }

  private async getSettingMap(settingKeys: string[]) {
    if (settingKeys.length === 0) {
      return new Map<string, string>();
    }

    const placeholders = settingKeys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<SettingRow[]>(
      `
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN (${placeholders})
      `,
      settingKeys
    );

    return new Map(rows.map((row) => [String(row.setting_key), String(row.setting_value || '').trim()]));
  }

  private async getRawPaymentSettings(): Promise<PayHerePaymentSettings> {
    const values = await this.getSettingMap(Object.values(PAYMENT_SETTING_KEYS));
    const encryptedMerchantSecret = values.get(PAYMENT_SETTING_KEYS.merchantSecret) || '';
    const currency = values.get(PAYMENT_SETTING_KEYS.currency) === 'USD' ? 'USD' : 'LKR';

    return {
      enabled: this.parseBoolean(values.get(PAYMENT_SETTING_KEYS.enabled), false),
      sandboxMode: this.parseBoolean(values.get(PAYMENT_SETTING_KEYS.sandboxMode), true),
      merchantId: values.get(PAYMENT_SETTING_KEYS.merchantId) || '',
      merchantSecret: encryptedMerchantSecret ? this.decryptSecret(encryptedMerchantSecret) : '',
      currency,
      returnUrl: values.get(PAYMENT_SETTING_KEYS.returnUrl) || '',
      cancelUrl: values.get(PAYMENT_SETTING_KEYS.cancelUrl) || '',
      notifyUrl: values.get(PAYMENT_SETTING_KEYS.notifyUrl) || '',
      checkoutTitle: values.get(PAYMENT_SETTING_KEYS.checkoutTitle) || 'ERPM LMS subscription',
      buttonLabel: values.get(PAYMENT_SETTING_KEYS.buttonLabel) || 'Pay with PayHere',
      supportText:
        values.get(PAYMENT_SETTING_KEYS.supportText) ||
        'Sandbox payments are simulated by PayHere and no real card will be charged.',
      autoActivatePaidSubscriptions: this.parseBoolean(values.get(PAYMENT_SETTING_KEYS.autoActivatePaidSubscriptions), true),
    };
  }

  private async getRawSmtpSettings(): Promise<SmtpSettings> {
    const values = await this.getSettingMap(Object.values(SMTP_SETTING_KEYS));
    const encryptedPassword = values.get(SMTP_SETTING_KEYS.password) || '';
    const publicUrl = values.get(SMTP_SETTING_KEYS.publicUrl) ||
      String(this.configService.get<string>('APP_PUBLIC_URL') || 'http://localhost/lms').trim();

    return {
      enabled: this.parseBoolean(values.get(SMTP_SETTING_KEYS.enabled), false),
      host: values.get(SMTP_SETTING_KEYS.host) || '',
      port: Number(values.get(SMTP_SETTING_KEYS.port) || 587),
      security: values.get(SMTP_SETTING_KEYS.security) === 'ssl' ? 'ssl' : 'starttls',
      username: values.get(SMTP_SETTING_KEYS.username) || '',
      password: encryptedPassword ? this.decryptSecret(encryptedPassword) : '',
      fromName: values.get(SMTP_SETTING_KEYS.fromName) || 'ERPM LMS',
      fromEmail: values.get(SMTP_SETTING_KEYS.fromEmail) || '',
      publicUrl,
      subject: values.get(SMTP_SETTING_KEYS.subject) || 'Reset your ERPM LMS password',
      heading: values.get(SMTP_SETTING_KEYS.heading) || 'Reset your password',
      intro: values.get(SMTP_SETTING_KEYS.intro) || 'We received a request to reset your ERPM LMS password.',
      buttonLabel: values.get(SMTP_SETTING_KEYS.buttonLabel) || 'Reset password',
      footer: values.get(SMTP_SETTING_KEYS.footer) || 'If you did not request this, you can safely ignore this email.',
    };
  }

  private serializeSmtpSettings(settings: SmtpSettings) {
    return {
      enabled: settings.enabled,
      host: settings.host,
      port: settings.port,
      security: settings.security,
      username: settings.username,
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      publicUrl: settings.publicUrl,
      subject: settings.subject,
      heading: settings.heading,
      intro: settings.intro,
      buttonLabel: settings.buttonLabel,
      footer: settings.footer,
      hasPassword: Boolean(settings.password),
      maskedPassword: settings.password ? maskSecret(settings.password) : '',
      configured: Boolean(settings.host && settings.port && settings.username && settings.password && settings.fromEmail),
    };
  }

  private serializePaymentSettings(settings: PayHerePaymentSettings, includeAdminFields: boolean) {
    const base = {
      enabled: settings.enabled,
      sandboxMode: settings.sandboxMode,
      currency: settings.currency,
      checkoutTitle: settings.checkoutTitle,
      buttonLabel: settings.buttonLabel,
      supportText: settings.supportText,
      configured: Boolean(settings.merchantId && settings.merchantSecret),
    };

    if (!includeAdminFields) {
      return base;
    }

    return {
      ...base,
      merchantId: settings.merchantId,
      hasMerchantSecret: Boolean(settings.merchantSecret),
      maskedMerchantSecret: settings.merchantSecret ? maskSecret(settings.merchantSecret) : '',
      returnUrl: settings.returnUrl,
      cancelUrl: settings.cancelUrl,
      notifyUrl: settings.notifyUrl,
      autoActivatePaidSubscriptions: settings.autoActivatePaidSubscriptions,
    };
  }

  private getPayHereCheckoutUrl(sandboxMode: boolean) {
    return sandboxMode ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
  }

  private parseBoolean(value: string | undefined, fallback: boolean) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private normalizeOptionalValue(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || '';
  }

  private normalizeSecretInput(value?: string | null) {
    return value === undefined ? '' : String(value || '').trim();
  }

  private normalizeProviderKey(value: string) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!isAiProviderKey(normalized)) {
      throw new BadRequestException('Unsupported AI provider');
    }

    return normalized;
  }

  private async saveSettingValue(settingKey: string, settingValue: string) {
    await this.db.execute(
      `
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `,
      [settingKey, settingValue]
    );
  }

  private async listAiProviders() {
    const [rows] = await this.db.execute<AiProviderRow[]>(
      `
        SELECT
          id,
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model,
          status,
          is_active,
          created_at,
          updated_at
        FROM ai_provider_configs
        ORDER BY is_active DESC, updated_at DESC, id DESC
      `
    );

    return rows.map((row) => this.serializeAiProvider(row));
  }

  private serializeAiProvider(row: AiProviderRow) {
    const apiKey = this.decryptSecret(String(row.api_key_encrypted || ''));
    const apiCode = this.decryptSecret(String(row.api_code_encrypted || ''));
    const providerKey = isAiProviderKey(String(row.provider_key || '').trim().toLowerCase())
      ? (String(row.provider_key || '').trim().toLowerCase() as AiProviderKey)
      : 'openrouter';

    return {
      id: row.id,
      providerKey,
      providerLabel: String(row.provider_label || '').trim() || AI_PROVIDER_LABELS[providerKey],
      baseUrl: normalizeAiProviderBaseUrl(providerKey, row.base_url),
      model: String(row.model || '').trim() || getDefaultModelForProvider(providerKey),
      status: row.status,
      isActive: Boolean(row.is_active),
      hasApiKey: Boolean(apiKey),
      hasRunCode: Boolean(apiCode),
      maskedApiKey: apiKey ? maskSecret(apiKey) : '',
      maskedRunCode: apiCode ? maskSecret(apiCode) : '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private decryptSecret(value: string) {
    try {
      return decryptSecret(value, this.getEncryptionSecret());
    } catch {
      return '';
    }
  }

  private encryptSecret(value: string) {
    return encryptSecret(value, this.getEncryptionSecret());
  }

  private getEncryptionSecret() {
    const configured = String(this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim();
    const nodeEnv = String(this.configService.get<string>('NODE_ENV') || 'development').trim();
    if (!configured && nodeEnv === 'production') {
      throw new BadRequestException('SETTINGS_ENCRYPTION_KEY must be configured before managing AI provider secrets');
    }
    return configured || 'lms-dev-settings-key-change-me';
  }

  private async countActiveAiProviders() {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ai_provider_configs WHERE is_active = 1 AND status = 'active'`
    );
    return Number(rows[0]?.total || 0);
  }

  private async getAiProviderRowOrThrow(id: number) {
    const [rows] = await this.db.execute<AiProviderRow[]>(
      `
        SELECT
          id,
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model,
          status,
          is_active,
          created_at,
          updated_at
        FROM ai_provider_configs
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException('AI provider configuration not found');
    }

    return rows[0];
  }

  private async setActiveAiProvider(id: number) {
    await this.db.execute(`UPDATE ai_provider_configs SET is_active = 0`);
    await this.db.execute(
      `
        UPDATE ai_provider_configs
        SET is_active = 1,
            status = 'active'
        WHERE id = ?
      `,
      [id]
    );
  }

  private async activateFallbackProvider(excludedId: number) {
    const [rows] = await this.db.execute<AiProviderRow[]>(
      `
        SELECT id
        FROM ai_provider_configs
        WHERE id <> ? AND status = 'active'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      [excludedId]
    );

    const fallbackId = Number(rows[0]?.id || 0);
    if (fallbackId > 0) {
      await this.setActiveAiProvider(fallbackId);
    }
  }

  private async runProviderConnectionTest(providerKey: AiProviderKey, apiKey: string) {
    try {
      switch (providerKey) {
        case 'openai':
          return await this.testOpenAiKey(apiKey);
        case 'claude':
          return await this.testClaudeKey(apiKey);
        case 'gemini':
          return await this.testGeminiKey(apiKey);
        case 'openrouter':
        default:
          return await this.testOpenRouterKey(apiKey);
      }
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadGatewayException(this.formatProviderConnectionError(AI_PROVIDER_LABELS[providerKey], error));
    }
  }

  private async testOpenRouterKey(apiKey: string) {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(this.extractProviderTestError('OpenRouter', response.status));
    }
    const payload = await response.json().catch(() => null);
    return this.extractModelIds(payload?.data, ['id']);
  }

  private async testOpenAiKey(apiKey: string) {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(this.extractProviderTestError('OpenAI', response.status));
    }
    const payload = await response.json().catch(() => null);
    return this.extractModelIds(payload?.data, ['id'], ['gpt', 'o1', 'o3', 'o4']);
  }

  private async testClaudeKey(apiKey: string) {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(this.extractProviderTestError('Claude', response.status));
    }
    const payload = await response.json().catch(() => null);
    return this.extractModelIds(payload?.data, ['id', 'name'], ['claude']);
  }

  private async testGeminiKey(apiKey: string) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);

    if (!response.ok) {
      throw new BadGatewayException(this.extractProviderTestError('Gemini', response.status));
    }
    const payload = await response.json().catch(() => null);
    return (Array.isArray(payload?.models) ? payload.models : [])
      .filter((model: any) =>
        Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent')
      )
      .map((model: any) => String(model?.name || '').replace(/^models\//, '').trim())
      .filter((value: string) => value.startsWith('gemini-'))
      .slice(0, 30);
  }

  private extractProviderTestError(providerLabel: string, statusCode: number) {
    if (statusCode === 401) {
      return `${providerLabel} rejected the API key.`;
    }

    if (statusCode === 403) {
      return `${providerLabel} denied access for this API key.`;
    }

    if (statusCode === 429) {
      return `${providerLabel} rate limit or quota was hit while testing the key.`;
    }

    return `${providerLabel} key test failed with status ${statusCode}.`;
  }

  private formatProviderConnectionError(providerLabel: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error');
    const normalized = message.toLowerCase();

    if (
      normalized.includes('socket connection was closed') ||
      normalized.includes('connectionclosed') ||
      normalized.includes('fetch failed') ||
      normalized.includes('econnreset')
    ) {
      return `${providerLabel} could not be reached. Check internet, VPN/proxy/firewall, DNS, or provider availability.`;
    }

    if (normalized.includes('abort') || normalized.includes('timeout') || normalized.includes('timed out')) {
      return `${providerLabel} did not respond in time. Try again or choose a faster model/provider.`;
    }

    return `${providerLabel} connection test failed: ${message}`;
  }

  private extractModelIds(rows: any, candidateKeys: string[], requiredFragments: string[] = []) {
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((row) => {
        for (const key of candidateKeys) {
          const value = String(row?.[key] || '').trim();
          if (value) {
            return value;
          }
        }

        return '';
      })
      .filter((value) =>
        value &&
        (requiredFragments.length === 0 ||
          requiredFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase())))
      )
      .slice(0, 30);
  }
}
