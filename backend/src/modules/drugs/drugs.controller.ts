import { Controller, Get, Post, Query, Headers } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { DrugsService } from './drugs.service';

@Controller('drugs')
export class DrugsController {
  constructor(
    private readonly svc: DrugsService,
    private readonly authService: AuthService,
  ) {}

  // ── batch fetch — returns N drugs, no counter increment ──
  @Get('batch')
  async batch(
    @Query('count') count = '10',
    @Headers('authorization') auth?: string,
  ) {
    const student = await this.authService.requireStudent(auth);
    const settings = this.svc.getSettings();

    if (!settings.enabled) {
      return { blocked: true, reason: 'feature_disabled' };
    }

    const hasSubscription = !!student.hasActiveSubscription;
    const result = await this.svc.getBatch(student.id, Number(count));

    return {
      ...result,
      hasSubscription,
    };
  }

  // ── record a spin — enforces limit server-side ──
  @Post('record')
  async record(@Headers('authorization') auth?: string) {
    const student = await this.authService.requireStudent(auth);
    const hasSubscription = !!student.hasActiveSubscription;
    const settings = this.svc.getSettings();

    const useCount = await this.svc.getSpinCount(student.id);

    if (!hasSubscription && useCount >= settings.freeLimit) {
      return { ok: false, reason: 'limit_reached', useCount, freeLimit: settings.freeLimit };
    }

    await this.svc.recordSpin(student.id);
    return { ok: true, useCount: useCount + 1, freeLimit: settings.freeLimit };
  }
}
