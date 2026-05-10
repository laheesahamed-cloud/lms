import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService
  ) {}

  @Get('ai-providers')
  async getAiProviders(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getAiProviderSettings();
  }

  @Get('general')
  async getGeneralSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getGeneralSettings();
  }

  @Get('payments')
  async getPaymentSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getPaymentSettings();
  }

  @Get('smtp')
  async getSmtpSettings(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.getSmtpSettings();
  }

  @Post('ai-providers')
  async createAiProvider(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateAiProviderDto) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.createAiProvider(dto);
  }

  @Post('ai-providers/test')
  async testAiProvider(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateAiProviderDto) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.testAiProvider(dto);
  }

  @Put('general')
  async updateGeneralSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateGeneralSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateGeneralSettings(dto);
  }

  @Put('payments')
  async updatePaymentSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdatePaymentSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updatePaymentSettings(dto);
  }

  @Put('smtp')
  async updateSmtpSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateSmtpSettingsDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateSmtpSettings(dto);
  }

  @Put('ai-providers/:id')
  async updateAiProvider(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiProviderDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.updateAiProvider(id, dto);
  }

  @Put('ai-providers/:id/activate')
  async activateAiProvider(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.activateAiProvider(id);
  }

  @Delete('ai-providers/:id')
  async deleteAiProvider(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number
  ) {
    await this.authService.requireAdmin(authorization);
    return this.settingsService.deleteAiProvider(id);
  }
}
