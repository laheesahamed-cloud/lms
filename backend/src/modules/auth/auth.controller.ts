import { Body, Controller, Delete, Get, Headers, HttpException, InternalServerErrorException, Logger, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SESSION_TTL_DAYS } from './auth-token.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    const result: any = await this.authService.login(loginDto);
    // No session is issued when the student still needs to verify their email.
    if (result.sessionToken) {
      this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    }
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    const result: any = await this.authService.register(registerDto);
    // New self-signup students must verify their email before a session is issued.
    if (result.sessionToken) {
      this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    }
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('verify-email-otp')
  async verifyEmailOtp(
    @Body() verifyEmailOtpDto: VerifyEmailOtpDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    const result: any = await this.authService.verifyEmailOtp(verifyEmailOtpDto);
    this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('resend-email-otp')
  resendEmailOtp(@Body() resendEmailOtpDto: ResendEmailOtpDto) {
    return this.authService.resendEmailOtp(resendEmailOtpDto);
  }

  @Post('google')
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    const result = await this.authService.loginWithGoogle(googleLoginDto);
    this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('google/code')
  async googleCodeLogin(
    @Body() googleCodeLoginDto: GoogleCodeLoginDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Headers('x-requested-with') requestedWith: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    let result: any;
    try {
      result = await this.authService.loginWithGoogleCode(googleCodeLoginDto, { origin, requestedWith });
    } catch (err) {
      // Clean, intended errors (400/401 etc.) pass through unchanged.
      if (err instanceof HttpException) throw err;
      // Otherwise surface the real server-side reason instead of an opaque 500
      // so Google sign-in setup issues are diagnosable. (No secrets in message.)
      throw new InternalServerErrorException(`Google sign-in error: ${(err as any)?.message || err}`);
    }
    this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('apple')
  async appleLogin(
    @Body() appleLoginDto: AppleLoginDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    const result = await this.authService.loginWithApple(appleLoginDto);
    this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  // Web "Sign in with Apple" (same-page redirect flow, like Google). Apple
  // form-POSTs the result HERE (not back to the SPA), so we verify it, set the
  // session cookie, and 302 the browser to the dashboard. A short-lived state
  // cookie (SameSite=None so it survives Apple's cross-site POST) guards CSRF.
  @Post('apple/callback')
  async appleWebCallbackPost(@Body() body: any, @Req() request: any, @Res() response: any) {
    await this.handleAppleWebCallback(body || {}, request, response);
  }

  @Get('apple/callback')
  async appleWebCallbackGet(@Query() query: any, @Req() request: any, @Res() response: any) {
    await this.handleAppleWebCallback(query || {}, request, response);
  }

  private async handleAppleWebCallback(payload: any, request: any, response: any) {
    const successUrl = String(this.configService.get<string>('APPLE_WEB_SUCCESS_URL') || 'https://xyndrome.lk/lms/frontend/dist/dashboard');
    const failureBase = String(this.configService.get<string>('APPLE_WEB_FAILURE_URL') || 'https://xyndrome.lk/lms/frontend/dist/auth/login?apple=failed');
    const fail = (reason: string) => this.redirectTo(response, this.appendParam(failureBase, 'reason', reason));

    try {
      // CSRF: the state we set before redirecting must echo back from Apple.
      const expectedState = this.readCookie(request, 'xy_apple_state');
      try { response.clearCookie('xy_apple_state', { path: '/' }); } catch { /* non-fatal */ }

      if (payload.error) return fail('apple_error');
      // Best-effort CSRF: only reject on an actual state MISMATCH. Some browsers
      // (notably Safari/ITP) drop the SameSite=None state cookie on Apple's
      // cross-site POST; when the cookie is absent we proceed and rely on the
      // Apple-signed, audience-bound id_token (which prevents token forgery).
      if (payload.state && expectedState && payload.state !== expectedState) {
        this.logger.warn('Apple callback state mismatch — rejecting');
        return fail('state');
      }
      if (!payload.id_token) return fail('no_token');

      // The `user` blob (first sign-in only) carries the name as JSON.
      let fullName = '';
      if (payload.user) {
        try {
          const parsed = typeof payload.user === 'string' ? JSON.parse(payload.user) : payload.user;
          fullName = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ').trim();
        } catch {
          // Malformed user blob — fall back to an email-derived name server-side.
        }
      }

      const result = await this.authService.loginWithApple({
        identityToken: String(payload.id_token || ''),
        fullName: fullName || undefined,
      } as AppleLoginDto);
      this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
      return this.redirectTo(response, successUrl);
    } catch (err) {
      // Never bubble a 500 to the browser — log the real reason and redirect.
      this.logger.error(`Apple web callback failed: ${(err as any)?.message || err}`);
      return fail('verify');
    }
  }

  /** Redirect that won't throw even if res.redirect is unavailable. */
  private redirectTo(response: any, url: string) {
    try {
      response.redirect(302, url);
    } catch {
      try {
        response.statusCode = 302;
        response.setHeader('Location', url);
        response.end();
      } catch {
        /* last resort — nothing more we can do */
      }
    }
  }

  private appendParam(url: string, key: string, value: string) {
    return url + (url.includes('?') ? '&' : '?') + `${key}=${encodeURIComponent(value)}`;
  }

  private readCookie(request: any, name: string) {
    return String(request?.headers?.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || '';
  }

  @Get('me')
  me(
    @Headers('authorization') authorization?: string,
    @Headers('cookie') cookie?: string
  ) {
    return this.authService.me(authorization || this.authorizationFromCookie(cookie));
  }

  @Post('logout')
  async logout(
    @Headers('authorization') authorization: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    this.clearSessionCookie(response, request);
    return this.authService.logout(authorization || this.authorizationFromCookie(cookie));
  }

  @Delete('account')
  async deleteAccount(
    @Headers('authorization') authorization: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Req() request: any,
    @Res({ passthrough: true }) response: any
  ) {
    const result = await this.authService.deleteAccount(authorization || this.authorizationFromCookie(cookie));
    this.clearSessionCookie(response, request);
    return result;
  }

  @Post('forgot-password')
  requestPasswordReset(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Patch('profile')
  updateProfile(@Headers('authorization') authorization: string | undefined, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(authorization, updateProfileDto);
  }

  @Patch('password')
  changePassword(@Headers('authorization') authorization: string | undefined, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(authorization, changePasswordDto);
  }

  private setSessionCookie(response: any, request: any, token: string, ttlDays = SESSION_TTL_DAYS) {
    response.cookie('lms_session', token, {
      httpOnly: true,
      secure: this.shouldUseSecureSessionCookie(request),
      sameSite: 'lax',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearSessionCookie(response: any, request: any) {
    const secure = this.shouldUseSecureSessionCookie(request);
    response.clearCookie('lms_session', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    });
  }

  private shouldUseSecureSessionCookie(request?: any) {
    const explicit = this.getBooleanConfig('SESSION_COOKIE_SECURE') ?? this.getBooleanConfig('COOKIE_SECURE');
    if (explicit !== null) return explicit;

    if (this.isInsecureLocalOrLanRequest(request)) return false;

    if (this.configService.get<string>('NODE_ENV') === 'production') return true;

    const configuredUrls = [
      this.configService.get<string>('frontendUrl'),
      this.configService.get<string>('FRONTEND_URL'),
      this.configService.get<string>('APP_PUBLIC_URL'),
      this.configService.get<string>('API_PUBLIC_URL'),
      ...String(this.configService.get<string>('FRONTEND_URLS') || '').split(','),
    ];

    return configuredUrls.some((value) => {
      const clean = String(value || '').trim();
      if (!clean || ['null', 'undefined'].includes(clean.toLowerCase())) return false;

      try {
        const origin = new URL(clean).origin;
        return origin.startsWith('https://') &&
          !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) &&
          !/^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin);
      } catch {
        return false;
      }
    });
  }

  private getBooleanConfig(name: string) {
    const value = this.configService.get<string>(name);
    const normalized = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return null;
  }

  private isInsecureLocalOrLanRequest(request?: any) {
    const host = String(request?.headers?.host || '').trim();
    const forwardedProto = String(request?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
    const protocol = forwardedProto || String(request?.protocol || '').trim();
    const origin = String(request?.headers?.origin || '').trim();
    const referer = String(request?.headers?.referer || '').trim();
    const requestUrl = host ? `${protocol || 'http'}://${host}` : '';

    return [requestUrl, origin, referer].some((value) => this.isInsecureLocalOrLanUrl(value));
  }

  private isInsecureLocalOrLanUrl(value: string) {
    if (!value) return false;

    try {
      const url = new URL(value);
      return url.protocol === 'http:' && (
        /^(localhost|127\.0\.0\.1)$/i.test(url.hostname) ||
        /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(url.hostname)
      );
    } catch {
      return false;
    }
  }

  private shouldExposeSessionToken(nativeHeader: string | undefined) {
    return /^(1|true|native|ios|android)$/i.test(String(nativeHeader || '').trim());
  }

  private authorizationFromCookie(cookieHeader?: string) {
    const token = String(cookieHeader || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('lms_session='))
      ?.slice('lms_session='.length) || '';
    return token ? `Bearer ${decodeURIComponent(token)}` : undefined;
  }
}
