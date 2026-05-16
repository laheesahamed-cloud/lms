import { Body, Controller, Get, Headers, Patch, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SESSION_TTL_DAYS } from './auth-token.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
    @Query('native') nativeQuery: string | undefined,
    @Res({ passthrough: true }) response: any
  ) {
    const result = await this.authService.login(loginDto);
    this.setSessionCookie(response, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader, nativeQuery)) {
      return result;
    }
    const { sessionToken: _sessionToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('x-lms-native') nativeHeader: string | undefined,
    @Query('native') nativeQuery: string | undefined,
    @Res({ passthrough: true }) response: any
  ) {
    const result = await this.authService.register(registerDto);
    this.setSessionCookie(response, result.sessionToken, result.sessionTtlDays);
    if (this.shouldExposeSessionToken(nativeHeader, nativeQuery)) {
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
  async logout(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: any) {
    this.clearSessionCookie(response);
    return this.authService.logout(authorization);
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

  private setSessionCookie(response: any, token: string, ttlDays = SESSION_TTL_DAYS) {
    response.cookie('lms_session', token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearSessionCookie(response: any) {
    response.clearCookie('lms_session', {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  private shouldExposeSessionToken(...signals: Array<string | undefined>) {
    return signals.some((signal) => /^(1|true|native|ios|android)$/i.test(String(signal || '').trim()));
  }
}
