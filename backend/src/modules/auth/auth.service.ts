import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomBytes, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { sqlPlaceholders } from '../../database/sql-safety';
import { decryptSecret } from '../../common/utils/ai-provider.utils';
import { ADMIN_SESSION_TTL_DAYS, SESSION_TTL_DAYS, createSessionExpiry, extractBearerToken, hashSessionToken, isValidSessionTokenFormat } from './auth-token.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
import { isStaffRole, permissionsForRole, UserRole } from './role-permissions';

type UserRow = RowDataPacket & {
  id: number;
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatar_key?: string | null;
  session_token?: string | null;
  session_expires_at?: string | Date | null;
  password_reset_token?: string | null;
  password_reset_expires_at?: string | Date | null;
  email_verified?: number | string | null;
  email_otp_code?: string | null;
  email_otp_expires_at?: string | Date | null;
  email_otp_attempts?: number | string | null;
  email_otp_last_sent_at?: string | Date | null;
};

type SubscriptionAccessRow = RowDataPacket & {
  plan_name: string | null;
  subscription_status: string | null;
};

type SettingRow = RowDataPacket & {
  setting_key: string;
  setting_value: string | null;
};

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type AuthUser = Pick<UserRow, 'id' | 'full_name' | 'email' | 'role' | 'status' | 'avatar_key'>;

const ALLOWED_AVATAR_KEYS = new Set(['blue-tie', 'teal-coat', 'pink-necklace', 'violet-scarf', 'amber-coat', 'cyan-necklace']);
const PASSWORD_RESET_TTL_MINUTES = 30;
const EMAIL_OTP_TTL_MINUTES = 10;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
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
const LEGACY_SMTP_BRAND_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bERPM LMS\b/g, 'xyndrome'],
  [/\bERPM\b/g, 'xyndrome'],
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly configService: ConfigService
  ) {}

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, password, role, status, avatar_key, email_verified FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [email]
    );

    const user = rows[0];

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const submittedPassword = loginDto.password;
    const passwordMatches = await bcrypt.compare(submittedPassword, user.password).catch(() => false);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (isStaffRole(user.role) && user.status !== 'active') {
      throw new UnauthorizedException('Your admin account is not active right now');
    }

    // Onboarding email verification: a student whose email is not yet verified
    // gets a fresh 6-digit code and NO session until they confirm it.
    if (user.role === 'student' && !this.isEmailVerified(user)) {
      return this.beginEmailVerification(user);
    }

    const sessionToken = randomBytes(32).toString('hex');
    const sessionTtlDays = isStaffRole(user.role) ? ADMIN_SESSION_TTL_DAYS : SESSION_TTL_DAYS;
    await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ? WHERE id = ?', [
      hashSessionToken(sessionToken),
      createSessionExpiry(sessionTtlDays),
      user.id,
    ]);

    return {
      ok: true,
      sessionToken,
      sessionTtlDays,
      redirectPath: this.getRedirectPath(user.role, user.status),
      user: await this.serializeUser(user),
    };
  }

  async register(registerDto: RegisterDto) {
    const fullName = registerDto.fullName.trim();
    const email = registerDto.email.trim().toLowerCase();

    if (registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    if (!registerDto.acceptedTerms) {
      throw new BadRequestException('Please accept the terms and conditions');
    }

    const [existing] = await this.db.execute<RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      throw new BadRequestException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // New self-signup students start unverified (email_verified = 0) and must
    // confirm a 6-digit code before any session is issued.
    const [result] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO users (full_name, email, password, role, status, email_verified) VALUES (?, ?, ?, ?, ?, 0)',
      [fullName, email, hashedPassword, 'student', 'active']
    );

    await this.assignDefaultEntryPlan(result.insertId);

    return this.beginEmailVerification({
      id: result.insertId,
      full_name: fullName,
      email,
      role: 'student',
      status: 'active',
    } as UserRow);
  }

  async loginWithGoogle(googleLoginDto: GoogleLoginDto) {
    const profile = await this.verifyGoogleCredential(googleLoginDto.credential);
    return this.loginWithGoogleProfile(profile);
  }

  async loginWithGoogleCode(
    googleCodeLoginDto: GoogleCodeLoginDto,
    context: { origin?: string; requestedWith?: string } = {}
  ) {
    if (String(context.requestedWith || '').toLowerCase() !== 'xmlhttprequest') {
      throw new BadRequestException('Google sign-in request is invalid');
    }

    const redirectUri = this.resolveGoogleCodeRedirectUri(googleCodeLoginDto.redirectUri || context.origin);
    const idToken = await this.exchangeGoogleAuthorizationCode(googleCodeLoginDto.code, redirectUri);
    const profile = await this.verifyGoogleCredential(idToken);
    return this.loginWithGoogleProfile(profile);
  }

  private async loginWithGoogleProfile(profile: GoogleTokenInfo) {
    const email = String(profile.email || '').trim().toLowerCase();
    const fullName = this.getGoogleDisplayName(profile);

    const [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, full_name, email, password, role, status, avatar_key FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [email]
    );

    let user = rows[0];
    if (!user) {
      const randomPassword = await bcrypt.hash(`google:${profile.sub}:${randomBytes(16).toString('hex')}`, 10);
      const [result] = await this.db.execute<ResultSetHeader>(
        'INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [fullName, email, randomPassword, 'student', 'active']
      );
      await this.assignDefaultEntryPlan(result.insertId);
      user = {
        id: result.insertId,
        full_name: fullName,
        email,
        password: randomPassword,
        role: 'student',
        status: 'active',
      } as UserRow;
    }

    if (isStaffRole(user.role) && user.status !== 'active') {
      throw new UnauthorizedException('Your admin account is not active right now');
    }

    // Google guarantees a verified email, so these accounts skip the OTP step and
    // are flagged verified for any future email/password logins.
    const sessionToken = randomBytes(32).toString('hex');
    const sessionTtlDays = isStaffRole(user.role) ? ADMIN_SESSION_TTL_DAYS : SESSION_TTL_DAYS;
    await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ?, email_verified = 1 WHERE id = ?', [
      hashSessionToken(sessionToken),
      createSessionExpiry(sessionTtlDays),
      user.id,
    ]);

    return {
      ok: true,
      sessionToken,
      sessionTtlDays,
      redirectPath: this.getRedirectPath(user.role, user.status),
      user: await this.serializeUser(user),
    };
  }

  async me(authorization?: string) {
    const user = await this.findUserByToken(this.extractToken(authorization));

    return {
      ok: true,
      user: await this.serializeUser(user),
      redirectPath: this.getRedirectPath(user.role, user.status),
    };
  }

  async logout(authorization?: string) {
    const token = extractBearerToken(authorization);
    if (isValidSessionTokenFormat(token)) {
      await this.db.execute('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE session_token = ?', [hashSessionToken(token)]);
    }

    return {
      ok: true,
    };
  }

  async deleteAccount(authorization?: string) {
    const user = await this.findUserByToken(this.extractToken(authorization));

    if (isStaffRole(user.role)) {
      throw new BadRequestException('Staff accounts cannot be self-deleted here');
    }

    // Soft delete: keep the row (and its history) but anonymize personal data and
    // lock the login. deleted_at marks it as deleted — kept separate from `status`,
    // which is the approval (active/inactive) state.
    const scrambledEmail = `deleted+${user.id}-${randomBytes(6).toString('hex')}@deleted.invalid`;
    const lockedPassword = await bcrypt.hash(`deleted:${randomBytes(16).toString('hex')}`, 10);

    await this.db.execute(
      `UPDATE users
       SET full_name = 'Deleted user',
           email = ?,
           password = ?,
           avatar_key = NULL,
           session_token = NULL,
           session_expires_at = NULL,
           password_reset_token = NULL,
           password_reset_expires_at = NULL,
           deleted_at = NOW()
       WHERE id = ?`,
      [scrambledEmail, lockedPassword, user.id]
    );

    return {
      ok: true,
      message: 'Your account has been deleted.',
    };
  }

  private canExposeDevResetToken(shouldSendEmail: boolean) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const exposeDevResetToken =
      String(this.configService.get<string>('EXPOSE_DEV_RESET_TOKEN') || '').toLowerCase() === 'true';
    return nodeEnv !== 'production' && !shouldSendEmail && exposeDevResetToken;
  }

  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto) {
    const email = forgotPasswordDto.email.trim().toLowerCase();
    let [rows] = await this.db.execute<UserRow[]>(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length) {
      [rows] = await this.db.execute<UserRow[]>(
        'SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
        [email]
      );
    }

    const user = rows[0];
    if (!user) {
      return {
        ok: true,
        message: 'If an account exists for that email, a reset link is ready.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.db.execute(
      `UPDATE users
       SET password_reset_token = ?,
           password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`,
      [hashSessionToken(resetToken), PASSWORD_RESET_TTL_MINUTES, user.id]
    );

    const smtpSettings = await this.getPasswordResetSmtpSettings();
    const resetPath = `/auth/reset-password?token=${resetToken}`;
    const resetUrl = `${smtpSettings.publicUrl.replace(/\/+$/, '')}${resetPath}`;
    const shouldSendEmail = smtpSettings.enabled && smtpSettings.configured;
    const canExposeLocalResetLink = this.canExposeDevResetToken(shouldSendEmail);
    if (!shouldSendEmail) {
      this.logger.warn(
        `Password reset email skipped for user ${user.id}: SMTP ${smtpSettings.enabled ? 'incomplete' : 'disabled'}`
      );
    }
    const emailSent = shouldSendEmail
      ? await this.sendPasswordResetEmail({
          to: user.email,
          resetUrl,
          settings: smtpSettings,
        }).catch((error) => {
          const errorCode = String(error?.code || error?.responseCode || error?.name || 'email_error');
          this.logger.warn(`Password reset email failed for user ${user.id}: ${errorCode}`);
          return false;
        })
      : false;

    return {
      ok: true,
      message: emailSent
        ? 'Password reset email sent. Check your inbox.'
        : shouldSendEmail
          ? 'If an account exists for that email, a reset link is ready.'
          : canExposeLocalResetLink
            ? 'Password reset link created.'
            : 'If an account exists for that email, a reset link is ready.',
      emailSent,
      resetToken: canExposeLocalResetLink ? resetToken : undefined,
      resetPath: canExposeLocalResetLink ? resetPath : undefined,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, password_reset_token, password_reset_expires_at
       FROM users
       WHERE password_reset_token = ?
         AND password_reset_expires_at > NOW()
       LIMIT 1`,
      [hashSessionToken(resetPasswordDto.token.trim())]
    );

    const user = rows[0];
    if (!user) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.db.execute(
      `UPDATE users
       SET password = ?,
           password_reset_token = NULL,
           password_reset_expires_at = NULL,
           session_token = NULL,
           session_expires_at = NULL
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    return {
      ok: true,
      message: 'Password updated. You can sign in with your new password.',
    };
  }

  // ── Onboarding email OTP verification ────────────────────────────────────────

  private isEmailVerified(user: Pick<UserRow, 'email_verified'>) {
    // Default to verified when the flag is absent (older schema / non-students) so
    // we never lock anyone out; only an explicit 0/false counts as unverified.
    const raw = String(user.email_verified ?? '1').trim().toLowerCase();
    return !['0', '', 'false', 'no'].includes(raw);
  }

  private async beginEmailVerification(user: UserRow) {
    const { emailSent, code } = await this.issueEmailOtp(user);
    const exposeDevCode = !emailSent && this.configService.get<string>('NODE_ENV') !== 'production';
    return {
      ok: true,
      emailVerificationRequired: true,
      email: user.email,
      emailSent,
      expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
      message: emailSent
        ? `We sent a 6-digit verification code to ${user.email}.`
        : 'Enter the 6-digit verification code to continue.',
      ...(exposeDevCode ? { devCode: code } : {}),
    };
  }

  private async issueEmailOtp(user: Pick<UserRow, 'id' | 'email'>) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.execute(
      `UPDATE users
       SET email_otp_code = ?,
           email_otp_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
           email_otp_attempts = 0,
           email_otp_last_sent_at = NOW()
       WHERE id = ?`,
      [hashSessionToken(code), EMAIL_OTP_TTL_MINUTES, user.id]
    );

    const settings = await this.getPasswordResetSmtpSettings();
    const shouldSendEmail = settings.enabled && settings.configured;
    if (!shouldSendEmail) {
      this.logger.warn(`Email OTP not sent for user ${user.id}: SMTP ${settings.enabled ? 'incomplete' : 'disabled'}`);
      return { emailSent: false, code };
    }

    const emailSent = await this.sendEmailVerificationOtp({ to: user.email, code, settings }).catch((error) => {
      const errorCode = String(error?.code || error?.responseCode || error?.name || 'email_error');
      this.logger.warn(`Email OTP send failed for user ${user.id}: ${errorCode}`);
      return false;
    });
    return { emailSent, code };
  }

  async verifyEmailOtp(verifyEmailOtpDto: VerifyEmailOtpDto) {
    const email = verifyEmailOtpDto.email.trim().toLowerCase();
    const code = String(verifyEmailOtpDto.code || '').trim();

    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, full_name, email, password, role, status, avatar_key,
              email_verified, email_otp_code, email_otp_expires_at, email_otp_attempts
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user) {
      throw new BadRequestException('Verification code is invalid or has expired');
    }

    // Idempotent: an already-verified account (e.g. a double submit) just gets a session.
    if (this.isEmailVerified(user)) {
      return this.issueSessionForUser(user);
    }

    const attempts = Number(user.email_otp_attempts || 0);
    if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new code and try again.');
    }

    const expiresAt = user.email_otp_expires_at ? new Date(user.email_otp_expires_at) : null;
    const expired = !user.email_otp_code || !expiresAt || expiresAt.getTime() <= Date.now();
    if (expired) {
      throw new BadRequestException('Verification code is invalid or has expired');
    }

    if (hashSessionToken(code) !== user.email_otp_code) {
      await this.db.execute('UPDATE users SET email_otp_attempts = email_otp_attempts + 1 WHERE id = ?', [user.id]);
      const remaining = Math.max(0, EMAIL_OTP_MAX_ATTEMPTS - (attempts + 1));
      throw new BadRequestException(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Incorrect code. Request a new code and try again.'
      );
    }

    await this.db.execute(
      `UPDATE users
       SET email_verified = 1,
           email_otp_code = NULL,
           email_otp_expires_at = NULL,
           email_otp_attempts = 0
       WHERE id = ?`,
      [user.id]
    );

    return this.issueSessionForUser(user);
  }

  async resendEmailOtp(resendEmailOtpDto: ResendEmailOtpDto) {
    const email = resendEmailOtpDto.email.trim().toLowerCase();
    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, email, role, email_verified, email_otp_last_sent_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    const user = rows[0];

    // Generic response either way — never reveal whether the account exists or is verified.
    const baseResponse = {
      ok: true,
      expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
      message: 'If your email still needs verification, a new code is on its way.',
    };

    if (!user || user.role !== 'student' || this.isEmailVerified(user)) {
      return baseResponse;
    }

    const lastSentAt = user.email_otp_last_sent_at ? new Date(user.email_otp_last_sent_at) : null;
    if (lastSentAt) {
      const secondsSince = (Date.now() - lastSentAt.getTime()) / 1000;
      if (secondsSince < EMAIL_OTP_RESEND_COOLDOWN_SECONDS) {
        return { ...baseResponse, retryAfterSeconds: Math.ceil(EMAIL_OTP_RESEND_COOLDOWN_SECONDS - secondsSince) };
      }
    }

    const { emailSent, code } = await this.issueEmailOtp(user);
    const exposeDevCode = !emailSent && this.configService.get<string>('NODE_ENV') !== 'production';
    return {
      ...baseResponse,
      emailSent,
      ...(exposeDevCode ? { devCode: code } : {}),
    };
  }

  private async issueSessionForUser(user: UserRow) {
    if (isStaffRole(user.role) && user.status !== 'active') {
      throw new UnauthorizedException('Your admin account is not active right now');
    }

    const sessionToken = randomBytes(32).toString('hex');
    const sessionTtlDays = isStaffRole(user.role) ? ADMIN_SESSION_TTL_DAYS : SESSION_TTL_DAYS;
    await this.db.execute('UPDATE users SET session_token = ?, session_expires_at = ? WHERE id = ?', [
      hashSessionToken(sessionToken),
      createSessionExpiry(sessionTtlDays),
      user.id,
    ]);

    return {
      ok: true,
      sessionToken,
      sessionTtlDays,
      redirectPath: this.getRedirectPath(user.role, user.status),
      user: await this.serializeUser(user),
    };
  }

  private async sendEmailVerificationOtp(input: {
    to: string;
    code: string;
    settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>;
  }) {
    const { settings, code, to } = input;
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.security === 'ssl',
      auth: {
        user: settings.username,
        pass: settings.password,
      },
    });

    await transporter.sendMail({
      from: `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`,
      to,
      subject: `Your ${settings.fromName} verification code`,
      text: this.renderEmailOtpText(settings, code),
      html: this.renderEmailOtpHtml(settings, code),
    });

    return true;
  }

  private renderEmailOtpText(settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>, code: string) {
    return `Verify your email

Enter this 6-digit code to finish signing in to ${settings.fromName}:

${code}

This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes.

If you did not try to sign in, you can safely ignore this email.`;
  }

  private renderEmailOtpHtml(settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>, code: string) {
    const body = `
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">Enter this 6-digit code to finish signing in:</p>
            <div style="text-align:center;margin:8px 0 22px;">
              <span style="display:inline-block;font-size:32px;font-weight:900;letter-spacing:.2em;white-space:nowrap;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px 14px 24px;">${this.escapeHtml(code)}</span>
            </div>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes.</p>`;

    return this.renderBrandEmailDocument({
      settings,
      heading: 'Verify your email',
      bodyHtml: body,
      footerHtml: 'If you did not try to sign in, you can safely ignore this email.',
    });
  }

  private escapeHtml(value: string) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char));
  }

  // Shared email shell. Pins the message to a LIGHT theme (color-scheme meta +
  // explicit solid backgrounds) so dark-mode clients (Gmail, iOS Mail) can't
  // darken the white card, and seats the light logo on its own white rounded
  // backdrop so it always reads on any background.
  private renderBrandEmailDocument(input: {
    settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>;
    heading: string;
    bodyHtml: string;
    footerHtml: string;
  }) {
    const { settings, heading, bodyHtml, footerHtml } = input;
    const safe = (value: string) => this.escapeHtml(value);
    const logoUrl = `${String(settings.publicUrl || '').replace(/\/+$/, '')}/landing/logo.png`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>:root{color-scheme:light only;supported-color-schemes:light only;}</style>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;">
  <div style="margin:0;padding:32px;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ef;border-radius:18px;overflow:hidden;box-shadow:0 18px 46px rgba(15,23,42,.10);">
      <div style="padding:28px 28px 22px;background:#ffffff;text-align:center;">
        <img src="${safe(logoUrl)}" alt="${safe(settings.fromName)}" width="160" style="display:inline-block;max-width:160px;height:auto;border:0;outline:none;text-decoration:none;" />
      </div>
      <div style="padding:22px 28px;background:linear-gradient(135deg,#2563EB,#14B8A6);color:#ffffff;">
        <h1 style="margin:0;font-size:26px;line-height:1.15;color:#ffffff;">${safe(heading)}</h1>
      </div>
      <div style="padding:28px;background:#ffffff;color:#0f172a;">
        ${bodyHtml}
      </div>
      <div style="border-top:1px solid #e2e8f0;padding:18px 28px;font-size:12px;line-height:1.6;color:#64748b;background:#f8fafc;">${footerHtml}</div>
    </div>
  </div>
</body>
</html>`;
  }

  async updateProfile(authorization: string | undefined, updateProfileDto: UpdateProfileDto) {
    const user = await this.findUserByToken(this.extractToken(authorization));
    const fullName = updateProfileDto.fullName.trim();
    const avatarKey = updateProfileDto.avatarKey?.trim() || null;

    if (avatarKey && !ALLOWED_AVATAR_KEYS.has(avatarKey)) {
      throw new BadRequestException('Selected avatar is not available');
    }

    await this.db.execute('UPDATE users SET full_name = ?, avatar_key = ? WHERE id = ?', [fullName, avatarKey, user.id]);

    return {
      ok: true,
      user: await this.serializeUser({
        ...user,
        full_name: fullName,
        avatar_key: avatarKey,
      }),
    };
  }

  async changePassword(authorization: string | undefined, changePasswordDto: ChangePasswordDto) {
    const user = await this.findUserByToken(this.extractToken(authorization));

    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const currentPassword = changePasswordDto.currentPassword;
    const passwordMatches = await bcrypt.compare(currentPassword, user.password).catch(() => false);

    if (!passwordMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    return {
      ok: true,
    };
  }

  async requireAdmin(authorization?: string) {
    const user = await this.findUserByToken(this.extractToken(authorization));

    if (!isStaffRole(user.role) || user.status !== 'active') {
      throw new UnauthorizedException('Admin access is required');
    }

    return this.serializeUser(user);
  }

  async requireAuthenticatedUser(authorization?: string) {
    const user = await this.findUserByToken(this.extractToken(authorization));
    return this.serializeUser(user);
  }

  async requireStudent(authorization?: string) {
    const user = await this.findUserByToken(this.extractToken(authorization));

    if (user.role !== 'student' || user.status !== 'active') {
      throw new UnauthorizedException('Student access is required');
    }

    return this.serializeUser(user);
  }

  private getRedirectPath(role: string, status: string) {
    if (isStaffRole(role)) {
      if (status !== 'active') {
        throw new UnauthorizedException('Your admin account is not active right now');
      }

      return '/admin/dashboard';
    }

    return status === 'active' ? '/app/dashboard' : '/app/pending';
  }

  private extractToken(authorization?: string) {
    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    return token;
  }

  private async findUserByToken(sessionToken: string) {
    const [rows] = await this.db.execute<UserRow[]>(
      `SELECT id, full_name, email, password, role, status, avatar_key, session_token, session_expires_at
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`,
      [hashSessionToken(sessionToken)]
    );

    const user = rows[0];

    if (!user) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    return user;
  }

  private async getPasswordResetSmtpSettings() {
    const keys = Object.values(SMTP_SETTING_KEYS);
    const placeholders = sqlPlaceholders(keys);
    const [rows] = await this.db.execute<SettingRow[]>(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
      keys
    );
    const values = new Map(rows.map((row) => [String(row.setting_key), String(row.setting_value || '').trim()]));
    const encryptedPassword = values.get(SMTP_SETTING_KEYS.password) || '';
    const password = encryptedPassword ? this.decryptSettingsSecret(encryptedPassword) : '';
    const publicUrl = values.get(SMTP_SETTING_KEYS.publicUrl) ||
      String(this.configService.get<string>('APP_PUBLIC_URL') || 'http://localhost/lms').trim();

    return {
      enabled: this.parseBoolean(values.get(SMTP_SETTING_KEYS.enabled), false),
      host: values.get(SMTP_SETTING_KEYS.host) || '',
      port: Number(values.get(SMTP_SETTING_KEYS.port) || 587),
      security: values.get(SMTP_SETTING_KEYS.security) === 'ssl' ? 'ssl' : 'starttls',
      username: values.get(SMTP_SETTING_KEYS.username) || '',
      password,
      fromName: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.fromName)) || 'xyndrome',
      fromEmail: values.get(SMTP_SETTING_KEYS.fromEmail) || '',
      publicUrl,
      subject: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.subject)) || 'Reset your xyndrome password',
      heading: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.heading)) || 'Reset your password',
      intro: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.intro)) || 'We received a request to reset your xyndrome password.',
      buttonLabel: values.get(SMTP_SETTING_KEYS.buttonLabel) || 'Reset password',
      footer: this.normalizeSmtpBrandText(values.get(SMTP_SETTING_KEYS.footer)) || 'If you did not request this, you can safely ignore this email.',
      configured: Boolean(values.get(SMTP_SETTING_KEYS.host) && password && values.get(SMTP_SETTING_KEYS.username) && values.get(SMTP_SETTING_KEYS.fromEmail)),
    };
  }

  private normalizeSmtpBrandText(value: string | undefined) {
    let normalized = String(value || '').trim();
    for (const [pattern, replacement] of LEGACY_SMTP_BRAND_REPLACEMENTS) {
      normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
  }

  private async sendPasswordResetEmail(input: {
    to: string;
    resetUrl: string;
    settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>;
  }) {
    const { settings, resetUrl, to } = input;
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.security === 'ssl',
      auth: {
        user: settings.username,
        pass: settings.password,
      },
    });

    await transporter.sendMail({
      from: `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`,
      to,
      subject: settings.subject,
      text: this.renderPasswordResetText(settings, resetUrl),
      html: this.renderPasswordResetHtml(settings, resetUrl),
    });

    return true;
  }

  private renderPasswordResetText(settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>, resetUrl: string) {
    return `${settings.heading}

${settings.intro}

Reset link:
${resetUrl}

This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.

${settings.footer}`;
  }

  private renderPasswordResetHtml(settings: Awaited<ReturnType<AuthService['getPasswordResetSmtpSettings']>>, resetUrl: string) {
    const safe = (value: string) => this.escapeHtml(value);
    const body = `
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">${safe(settings.intro)}</p>
            <a href="${safe(resetUrl)}" style="display:inline-block;border-radius:10px;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:800;padding:13px 18px;">${safe(settings.buttonLabel)}</a>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">${safe(resetUrl)}</p>`;

    return this.renderBrandEmailDocument({
      settings,
      heading: settings.heading,
      bodyHtml: body,
      footerHtml: safe(settings.footer),
    });
  }

  private parseBoolean(value: string | undefined, fallback: boolean) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private decryptSettingsSecret(value: string) {
    const configured = String(this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim();
    return decryptSecret(value, configured || 'lms-dev-settings-key-change-me');
  }

  private getGoogleClientIds() {
    return String(
      this.configService.get<string>('GOOGLE_CLIENT_IDS') ||
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      ''
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getPrimaryGoogleClientId() {
    return this.getGoogleClientIds()[0] || '';
  }

  private getGoogleClientSecret() {
    return String(this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '').trim();
  }

  private resolveGoogleCodeRedirectUri(rawRedirectUri?: string) {
    const raw = String(rawRedirectUri || '').trim();
    if (!raw) {
      throw new BadRequestException('Google sign-in redirect URI is missing');
    }

    try {
      // The web LoginPage uses the GIS redirect flow (ux_mode:'redirect') with
      // redirect_uri = `${origin}/auth/login`. Google binds the auth code to
      // that exact URI and requires the same value here, so we keep origin +
      // path (dropping any query/hash). Google also enforces it against the
      // client's registered "Authorized redirect URIs", so a forged value fails.
      const url = new URL(raw);
      return `${url.origin}${url.pathname}`;
    } catch {
      throw new BadRequestException('Google sign-in redirect URI is invalid');
    }
  }

  private async exchangeGoogleAuthorizationCode(code: string, redirectUri: string) {
    const clientId = this.getPrimaryGoogleClientId();
    const clientSecret = this.getGoogleClientSecret();

    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured yet');
    }

    if (!clientSecret) {
      throw new BadRequestException('Google sign-in server secret is not configured yet');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        // Must exactly match the redirect_uri the GIS redirect-flow code client
        // used (`${origin}/auth/login`); Google rejects a mismatch with
        // invalid_grant ("authorization code is invalid").
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenPayload = await response.json().catch(() => ({})) as GoogleTokenResponse;

    if (!response.ok || tokenPayload.error) {
      const errorMessage = tokenPayload.error_description || tokenPayload.error || 'Google sign-in authorization code is invalid';
      this.logger.warn(`Google code exchange failed: ${errorMessage}`);
      throw new UnauthorizedException('Google sign-in authorization code is invalid');
    }

    if (!tokenPayload.id_token) {
      throw new UnauthorizedException('Google sign-in did not return an identity token');
    }

    return tokenPayload.id_token;
  }

  private async verifyGoogleCredential(credential: string) {
    const clientIds = this.getGoogleClientIds();
    if (clientIds.length === 0) {
      throw new BadRequestException('Google sign-in is not configured yet');
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const profile = await response.json().catch(() => ({})) as GoogleTokenInfo;

    if (!response.ok || profile.error) {
      throw new UnauthorizedException('Google sign-in token is invalid');
    }

    if (!profile.aud || !clientIds.includes(String(profile.aud))) {
      throw new UnauthorizedException('Google sign-in token was issued for a different app');
    }

    if (!profile.sub || !profile.email) {
      throw new UnauthorizedException('Google account details are incomplete');
    }

    if (String(profile.email_verified).toLowerCase() !== 'true') {
      throw new UnauthorizedException('Google email address is not verified');
    }

    return profile;
  }

  private getGoogleDisplayName(profile: GoogleTokenInfo) {
    const name = String(profile.name || '').trim();
    if (name.length >= 2) return name.slice(0, 120);

    const composed = `${String(profile.given_name || '').trim()} ${String(profile.family_name || '').trim()}`.trim();
    if (composed.length >= 2) return composed.slice(0, 120);

    const emailName = String(profile.email || '').split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Google Student';
    return emailName.length >= 2 ? emailName.slice(0, 120) : 'Google Student';
  }

  private async serializeUser(user: AuthUser) {
    const accessProfile = user.role === 'student'
      ? await this.getStudentAccessProfile(user.id)
      : {
          hasActiveSubscription: true,
          subscriptionStatus: 'active',
        currentPlanName: '',
        featureAccess: {
          aiNotes: true,
          advancedInsights: true,
          practiceMode: true,
          examMode: true,
          aiQuizGenerator: true,
          resultsTracking: true,
          notesCanvasStudyMode: true,
          performanceAnalytics: true,
          weakAreaAnalysis: true,
          progressTrackingBasic: true,
          progressTrackingAdvanced: true,
          reportQuestion: true,
          pastPaperAccess: true,
          mockPaperAccess: true,
          featureKeys: [],
        },
      };

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      permissions: permissionsForRole(user.role),
      status: user.status,
      avatarKey: user.avatar_key || '',
      hasActiveSubscription: accessProfile.hasActiveSubscription,
      subscriptionStatus: accessProfile.subscriptionStatus,
      currentPlanName: accessProfile.currentPlanName,
      featureAccess: accessProfile.featureAccess,
    };
  }

  private async getStudentAccessProfile(userId: number) {
    const [rows] = await this.db.execute<SubscriptionAccessRow[]>(
      `SELECT plans.name AS plan_name, us.status AS subscription_status
       FROM user_subscriptions us
       INNER JOIN plans ON plans.id = us.plan_id
       WHERE us.user_id = ?
         AND us.status = 'active'
         AND us.start_date <= CURDATE()
         AND us.end_date >= CURDATE()
       ORDER BY us.end_date DESC, us.id DESC
       LIMIT 1`,
      [userId]
    );

    const row = rows[0];
    if (!row) {
      return {
        hasActiveSubscription: false,
        subscriptionStatus: 'none',
        currentPlanName: '',
        featureAccess: {
          aiNotes: false,
          advancedInsights: false,
          practiceMode: false,
          examMode: false,
          aiQuizGenerator: false,
          resultsTracking: false,
          notesCanvasStudyMode: false,
          performanceAnalytics: false,
          weakAreaAnalysis: false,
          progressTrackingBasic: false,
          progressTrackingAdvanced: false,
          reportQuestion: false,
          pastPaperAccess: false,
          mockPaperAccess: false,
          featureKeys: [],
        },
      };
    }

    const featureKeys = await this.getActiveFeatureKeysForUser(userId);
    const featureAccess = this.buildFeatureAccessMap(featureKeys);

    return {
      hasActiveSubscription: true,
      subscriptionStatus: String(row.subscription_status || 'active'),
      currentPlanName: String(row.plan_name || ''),
      featureAccess,
    };
  }

  private async getActiveFeatureKeysForUser(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
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
      `,
      [userId]
    );

    return Array.from(new Set(rows.map((row) => String(row.feature_key || '').trim()).filter(Boolean)));
  }

  private buildFeatureAccessMap(featureKeys: string[]) {
    const has = (featureKey: string) => featureKeys.includes(featureKey);

    return {
      aiNotes: has('notes_canvas_study_mode'),
      advancedInsights: has('performance_analytics') || has('weak_area_analysis') || has('progress_tracking_advanced'),
      notesAccess: has('notes_canvas_study_mode'),
      aiTools: has('ai_quiz_generator'),
      analytics: has('performance_analytics') || has('weak_area_analysis') || has('progress_tracking_advanced'),
      lessonsAccess: has('lessons_access_full') || has('lessons_access_limited') || has('notes_canvas_study_mode'),
      practiceMode: has('practice_mode'),
      examMode: has('exam_mode'),
      aiQuizGenerator: has('ai_quiz_generator'),
      resultsTracking: has('results_tracking'),
      notesCanvasStudyMode: has('notes_canvas_study_mode'),
      performanceAnalytics: has('performance_analytics'),
      weakAreaAnalysis: has('weak_area_analysis'),
      progressTrackingBasic: has('progress_tracking_basic'),
      progressTrackingAdvanced: has('progress_tracking_advanced'),
      reportQuestion: has('report_question'),
      pastPaperAccess: has('past_paper_access'),
      mockPaperAccess: has('mock_paper_access'),
      featureKeys,
    };
  }

  private async assignDefaultEntryPlan(userId: number) {
    const [planRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id
       FROM plans
       WHERE slug = 'free'
       ORDER BY id ASC
       LIMIT 1`
    );
    const entryPlan = planRows[0];
    if (!entryPlan) {
      return;
    }

    const startDate = new Date();
    const toDateOnly = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    await this.db.execute(
      `
        INSERT INTO user_subscriptions (
          user_id, plan_id, assigned_by, notes, status, payment_status, start_date, end_date
        ) VALUES (?, ?, NULL, 'Auto-assigned Free plan on signup', 'active', 'free_plan', ?, ?)
      `,
      [userId, Number(entryPlan.id), toDateOnly(startDate), '9999-12-31']
    );
  }
}
