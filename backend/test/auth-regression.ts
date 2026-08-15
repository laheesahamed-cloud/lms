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

    // Matchers anchor on the FROM/WHERE clause rather than the exact SELECT column
    // list: the column list churns whenever a column is added (email_verified,
    // permissions, …), and matching on it silently turned this suite into a
    // "Unexpected SQL" crash instead of a regression test.
    if (normalizedSql.includes('FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1')) {
      const email = String(params[0] || '');
      const userEmail = String(this.user?.email || '');
      const isDeleted = Boolean(this.user?.deleted_at);
      return [(this.user && !isDeleted && userEmail === email ? [this.user] : []) as T, []];
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

    if (normalizedSql.includes('FROM users WHERE session_token = ? AND session_expires_at > NOW()')) {
      const matchesToken = this.user?.session_token === params[0];
      const expiresAt = this.user?.session_expires_at ? new Date(this.user.session_expires_at).getTime() : 0;
      return [(matchesToken && expiresAt > Date.now() ? [this.user] : []) as T, []];
    }

    if (normalizedSql.startsWith('UPDATE users SET email_otp_code = ?, email_otp_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), email_otp_attempts = 0, email_otp_last_sent_at = NOW() WHERE id = ?')) {
      this.user.email_otp_code = params[0];
      this.user.email_otp_expires_at = params[1];
      this.user.email_otp_attempts = 0;
      return [{ affectedRows: 1 } as T, []];
    }

    if (normalizedSql.startsWith('SELECT plans.name AS plan_name, us.status AS subscription_status')) {
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

async function createService(
  role: string,
  status = 'active',
  email = 'test@example.com',
  emailVerified: number | null = 1
) {
  const password = 'Keep Spaces 123';
  const user: any = {
    id: 7,
    full_name: 'Test User',
    email,
    password: await bcrypt.hash(password, 10),
    role,
    status,
    avatar_key: '',
    email_verified: emailVerified,
    session_token: null,
    session_expires_at: null,
  };
  const db = new MockPool(user);
  const service = new AuthService(db as any, createConfig() as any);
  return { service, db, user, password };
}

type LoginResult = Awaited<ReturnType<AuthService['login']>>;
type SessionLoginResult = Extract<LoginResult, { sessionToken: string }>;

// Since onboarding email OTP landed, login() returns a union: either a real
// session, or a "verify your email first" payload that deliberately carries no
// session. Tests that care about the session branch must prove they got it
// rather than assume it.
function expectSessionIssued(result: LoginResult): SessionLoginResult {
  assert(
    'sessionToken' in result,
    `expected login to issue a session, got the email-verification branch instead: ${JSON.stringify(result)}`
  );
  return result;
}

async function testLoginCreatesHashedSession() {
  const { service, user, password } = await createService('student');
  const result = expectSessionIssued(await service.login({ email: user.email, password }));
  assert.equal(result.ok, true);
  assert(isValidSessionTokenFormat(result.sessionToken));
  assert.equal(user.session_token, hashSessionToken(result.sessionToken));
  assert.notEqual(user.session_token, result.sessionToken);
}

async function testLoginNormalizesEmailCaseAndWhitespace() {
  const { service, user, password } = await createService('student');
  const result = expectSessionIssued(await service.login({ email: '  TEST@example.com  ', password }));
  assert.equal(result.ok, true);
  assert.equal(user.session_token, hashSessionToken(result.sessionToken));
}

async function testUnverifiedStudentGetsNoSession() {
  const { service, user, password } = await createService('student', 'active', 'test@example.com', 0);
  const result = await service.login({ email: user.email, password });
  assert(!('sessionToken' in result), 'unverified student must not receive a session token');
  assert.equal((result as any).emailVerificationRequired, true);
  assert.equal(user.session_token, null, 'no session may be written for an unverified student');
  assert(user.email_otp_code, 'an email OTP should be issued');
  assert.notEqual(user.email_otp_code, (result as any).devCode, 'the OTP must be stored hashed, not in plaintext');
}

async function testLegacyUserWithoutVerificationFlagStillLogsIn() {
  // Grandfathered rows predate the email_verified column; a NULL must not lock them out.
  const { service, user, password } = await createService('student', 'active', 'test@example.com', null);
  const result = expectSessionIssued(await service.login({ email: user.email, password }));
  assert.equal(user.session_token, hashSessionToken(result.sessionToken));
}

async function testLogoutInvalidatesEvenExpiredSession() {
  const { service, user, password } = await createService('student');
  const result = expectSessionIssued(await service.login({ email: user.email, password }));
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
  const result = expectSessionIssued(await service.login({ email: user.email, password }));
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
  await testUnverifiedStudentGetsNoSession();
  await testLegacyUserWithoutVerificationFlagStillLogsIn();
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
