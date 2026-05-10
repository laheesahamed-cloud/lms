import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export const AI_PROVIDER_KEYS = ['openai', 'gemini', 'claude', 'openrouter'] as const;

export type AiProviderKey = (typeof AI_PROVIDER_KEYS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderKey, string> = {
  openai: 'ChatGPT / OpenAI',
  gemini: 'Gemini',
  claude: 'Claude',
  openrouter: 'OpenRouter',
};

export const AI_PROVIDER_MODE_OPTIONS: Record<AiProviderKey, string[]> = {
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  claude: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  openrouter: ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001'],
};

export function isAiProviderKey(value: string): value is AiProviderKey {
  return AI_PROVIDER_KEYS.includes(value as AiProviderKey);
}

export function getDefaultModelForProvider(providerKey: AiProviderKey) {
  switch (providerKey) {
    case 'openai':
      return 'gpt-4.1-mini';
    case 'gemini':
      return 'gemini-1.5-flash';
    case 'claude':
      return 'claude-3-5-sonnet-latest';
    case 'openrouter':
    default:
      return 'openai/gpt-4o-mini';
  }
}

export function getDefaultBaseUrlForProvider(providerKey: AiProviderKey) {
  switch (providerKey) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'claude':
      return 'https://api.anthropic.com/v1/messages';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'gemini':
    default:
      return '';
  }
}

export function normalizeAiProviderBaseUrl(providerKey: AiProviderKey, value?: string | null) {
  const normalized = String(value || '').trim();
  const fallback = getDefaultBaseUrlForProvider(providerKey);

  if (!normalized) {
    return fallback;
  }

  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/, '');

    if (providerKey === 'openai' && (path === '/v1' || path === '/v1/models')) {
      url.pathname = '/v1/chat/completions';
      url.search = '';
      url.hash = '';
      return url.toString();
    }

    if (providerKey === 'openrouter' && (path === '/api/v1' || path === '/api/v1/models')) {
      url.pathname = '/api/v1/chat/completions';
      url.search = '';
      url.hash = '';
      return url.toString();
    }

    if (providerKey === 'claude' && (path === '/v1' || path === '/v1/models')) {
      url.pathname = '/v1/messages';
      url.search = '';
      url.hash = '';
      return url.toString();
    }

    return normalized;
  } catch {
    return fallback;
  }
}

export function buildEncryptionKey(secret: string) {
  return createHash('sha256')
    .update(secret || 'lms-dev-settings-key-change-me')
    .digest();
}

export function encryptSecret(value: string, secret: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', buildEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(value: string, secret: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (!normalized.startsWith('v1:')) {
    return normalized;
  }

  const parts = normalized.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted secret payload');
  }

  const [, ivBase64, tagBase64, encryptedBase64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', buildEncryptionKey(secret), Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8').trim();
}

export function maskSecret(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}***`;
  }

  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}
