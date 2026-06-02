import { Body, Controller, Get, Headers, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SESSION_TTL_DAYS } from './auth-token.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
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
    const result = await this.authService.login(loginDto);
    this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
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
    const result = await this.authService.register(registerDto);
    this.setSessionCookie(response, request, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
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

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
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
