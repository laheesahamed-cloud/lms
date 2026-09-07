import { Body, Controller, Delete, Get, Header, Headers, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { UpdateLandingPageSettingsDto } from './dto/update-landing-page-settings.dto';
import { UpdateAvailabilitySettingsDto, VerifyAvailabilityUnlockDto } from './dto/update-availability-settings.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { TestSmtpSettingsDto } from './dto/test-smtp-settings.dto';
import { UpdatePopupAlertSettingsDto } from './dto/update-popup-alert-settings.dto';
import { UpdateApnsSettingsDto } from './dto/update-apns-settings.dto';
import { UpdateFcmSettingsDto } from './dto/update-fcm-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService
  ) {}

  @Get('ai-providers')
  @RequirePermissions('settings.manage')
  async getAiProviders(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getAiProviderSettings();
  }

  @Get('general')
  @RequirePermissions('settings.manage')
  async getGeneralSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getGeneralSettings();
  }

  @Get('landing-page')
  @RequirePermissions('settings.manage')
  async getLandingPageSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getLandingPageSettings();
  }

  @Get('availability')
  @RequirePermissions('settings.manage')
  async getAvailabilitySettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getAvailabilitySettings();
  }

  @Get('public')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60')
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get('public/availability')
  @Header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30')
  async getPublicAvailabilitySettings() {
    return this.settingsService.getPublicAvailabilitySettings();
  }

  @Post('availability/unlock')
  async verifyAvailabilityUnlock(@Body() dto: VerifyAvailabilityUnlockDto) {
    return this.settingsService.verifyAvailabilityUnlock(dto);
  }

  @Get('payments')
  @RequirePermissions('settings.manage')
  async getPaymentSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getPaymentSettings();
  }

  @Get('smtp')
  @RequirePermissions('settings.manage')
  async getSmtpSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getSmtpSettings();
  }

  @Get('popup-alert')
  @RequirePermissions('settings.manage')
  async getPopupAlertSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getPopupAlertSettings();
  }

  @Get('apns')
  @RequirePermissions('settings.manage')
  async getApnsSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getApnsSettings();
  }

  @Get('fcm')
  @RequirePermissions('settings.manage')
  async getFcmSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getFcmSettings();
  }

  @Post('ai-providers')
  @RequirePermissions('settings.manage')
  async createAiProvider(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateAiProviderDto) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.createAiProvider(dto);
  }

  @Post('ai-providers/test')
  @RequirePermissions('settings.manage')
  async testAiProvider(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateAiProviderDto) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.testAiProvider(dto);
  }

  @Put('general')
  @RequirePermissions('settings.manage')
  async updateGeneralSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateGeneralSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateGeneralSettings(dto);
  }

  @Put('landing-page')
  @RequirePermissions('settings.manage')
  async updateLandingPageSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateLandingPageSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateLandingPageSettings(dto);
  }

  @Put('availability')
  @RequirePermissions('settings.manage')
  async updateAvailabilitySettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateAvailabilitySettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateAvailabilitySettings(dto);
  }

  @Put('payments')
  @RequirePermissions('settings.manage')
  async updatePaymentSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdatePaymentSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updatePaymentSettings(dto);
  }

  @Put('smtp')
  @RequirePermissions('settings.manage')
  async updateSmtpSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateSmtpSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateSmtpSettings(dto);
  }

  @Post('smtp/test')
  @RequirePermissions('settings.manage')
  async testSmtpSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: TestSmtpSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.sendSmtpTestEmail(dto.toEmail);
  }

  @Put('popup-alert')
  @RequirePermissions('settings.manage')
  async updatePopupAlertSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdatePopupAlertSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updatePopupAlertSettings(dto);
  }

  @Put('apns')
  @RequirePermissions('settings.manage')
  async updateApnsSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateApnsSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateApnsSettings(dto);
  }

  @Put('fcm')
  @RequirePermissions('settings.manage')
  async updateFcmSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateFcmSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateFcmSettings(dto);
  }

  @Put('ai-providers/:id')
  @RequirePermissions('settings.manage')
  async updateAiProvider(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiProviderDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateAiProvider(id, dto);
  }

  @Put('ai-providers/:id/activate')
  @RequirePermissions('settings.manage')
  async activateAiProvider(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.activateAiProvider(id);
  }

  @Delete('ai-providers/:id')
  @RequirePermissions('settings.manage')
  async deleteAiProvider(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.deleteAiProvider(id);
  }
}
