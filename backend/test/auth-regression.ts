import { strict as assert } from 'node:assert';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { hashSessionToken, isValidSessionTokenFormat } from '../src/modules/auth/auth-token.util';

type Query = {
  sql: string;
  params: unknown[];
};

class MockPool {
  queries: Query[] = [];
  user: any;

  constructor(user: any) {
    this.user = user;
  }

  async execute<T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> {
    this.queries.push({ sql, params });
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.startsWith('SELECT id, full_name, email, password, role, status, avatar_key FROM users WHERE email = ?')) {
      const email = String(params[0] || '');
      const userEmail = String(this.user?.email || '');
      return [(this.user && userEmail === email ? [this.user] : []) as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, email FROM users WHERE email = ? LIMIT 1')) {
      const email = String(params[0] || '');
      const userEmail = String(this.user?.email || '');
      return [(this.user && userEmail === email ? [{ id: this.user.id, email: this.user.email }] : []) as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1')) {
      const email = String(params[0] || '');
      const userEmail = String(this.user?.email || '').trim().toLowerCase();
      return [(this.user && userEmail === email ? [{ id: this.user.id, email: this.user.email }] : []) as T, []];
    }

    if (normalizedSql.startsWith('UPDATE users SET password_reset_token = ?, password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?')) {
      this.user.password_reset_token = params[0];
      this.user.password_reset_expires_at = params[1];
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalizedSql.startsWith('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN')) {
      return [[] as T, []];
    }

    if (normalizedSql.startsWith('UPDATE users SET session_token = ?, session_expires_at = ? WHERE id = ?')) {
      this.user.session_token = params[0];
      this.user.session_expires_at = params[1];
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalizedSql.startsWith('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE session_token = ?')) {
      if (this.user.session_token === params[0]) {
        this.user.session_token = null;
        this.user.session_expires_at = null;
      }
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalizedSql.startsWith('SELECT id, full_name, email, password, role, status, avatar_key, session_token, session_expires_at FROM users WHERE session_token = ? AND session_expires_at > NOW()')) {
      const matchesToken = this.user?.session_token === params[0];
      const expiresAt = this.user?.session_expires_at ? new Date(this.user.session_expires_at).getTime() : 0;
      return [(matchesToken && expiresAt > Date.now() ? [this.user] : []) as T, []];
    }

    if (normalizedSql.startsWith('SELECT plans.name AS plan_name, us.status AS subscription_status')) {
      return [[] as T, []];
    }

    if (normalizedSql.startsWith('SELECT sf.feature_key')) {
      return [[] as T, []];
    }

    throw new Error(`Unexpected SQL in auth regression test: ${normalizedSql}`);
  }
}

function createConfig() {
  return {
    get: (key: string) => {
      if (key === 'NODE_ENV') return 'test';
      return '';
    },
  };
}

async function createService(role: string, status = 'active', email = 'test@example.com') {
  const password = 'Keep Spaces 123';
  const user: any = {
    id: 7,
    full_name: 'Test User',
    email,
    password: await bcrypt.hash(password, 10),
    role,
    status,
    avatar_key: '',
    session_token: null,
    session_expires_at: null,
  };
  const db = new MockPool(user);
  const service = new AuthService(db as any, createConfig() as any);
  return { service, db, user, password };
}

async function testLoginCreatesHashedSession() {
  const { service, user, password } = await createService('student');
  const result = await service.login({ email: user.email, password });
  assert.equal(result.ok, true);
  assert(isValidSessionTokenFormat(result.sessionToken));
  assert.equal(user.session_token, hashSessionToken(result.sessionToken));
  assert.notEqual(user.session_token, result.sessionToken);
}

async function testLoginNormalizesEmailCaseAndWhitespace() {
  const { service, user, password } = await createService('student');
  const result = await service.login({ email: '  TEST@example.com  ', password });
  assert.equal(result.ok, true);
  assert.equal(user.session_token, hashSessionToken(result.sessionToken));
}

async function testLogoutInvalidatesEvenExpiredSession() {
  const { service, user, password } = await createService('student');
  const result = await service.login({ email: user.email, password });
  user.session_expires_at = new Date(Date.now() - 60_000);
  await service.logout(`Bearer ${result.sessionToken}`);
  assert.equal(user.session_token, null);
  assert.equal(user.session_expires_at, null);
}

async function testLogoutWithoutTokenIsIdempotent() {
  const { service } = await createService('student');
  const result = await service.logout(undefined);
  assert.equal(result.ok, true);
}

async function testPasswordResetFallsBackToLegacyEmailNormalization() {
  const { service, db, user } = await createService('student', 'active', ' Legacy@Example.COM ');
  const result = await service.requestPasswordReset({ email: 'legacy@example.com' });
  assert.equal(result.ok, true);
  assert(user.password_reset_token, 'password reset token should be stored for legacy-normalized email match');
  assert(db.queries.some((query) => query.sql.includes('WHERE email = ?')), 'password reset should try the indexed exact email lookup first');
  assert(db.queries.some((query) => query.sql.includes('LOWER(TRIM(email))')), 'password reset should fall back to legacy-normalized email lookup');
}

async function testExpiredSessionIsUnauthorized() {
  const { service, user, password } = await createService('student');
  const result = await service.login({ email: user.email, password });
  user.session_expires_at = new Date(Date.now() - 60_000);
  await assert.rejects(() => service.me(`Bearer ${result.sessionToken}`), UnauthorizedException);
}

async function testUnauthorizedAccessRequiresToken() {
  const { service } = await createService('student');
  await assert.rejects(() => service.requireAdmin(undefined), UnauthorizedException);
}

async function testInactiveStaffCannotCreateSession() {
  const { service, user, password } = await createService('admin', 'inactive');
  await assert.rejects(() => service.login({ email: user.email, password }), UnauthorizedException);
  assert.equal(user.session_token, null);
}

async function main() {
  await testLoginCreatesHashedSession();
  await testLoginNormalizesEmailCaseAndWhitespace();
  await testLogoutInvalidatesEvenExpiredSession();
  await testLogoutWithoutTokenIsIdempotent();
  await testPasswordResetFallsBackToLegacyEmailNormalization();
  await testExpiredSessionIsUnauthorized();
  await testUnauthorizedAccessRequiresToken();
  await testInactiveStaffCannotCreateSession();

  console.log('Auth regression checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
