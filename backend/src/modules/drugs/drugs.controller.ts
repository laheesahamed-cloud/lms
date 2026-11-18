import { Body, Controller, Get, Headers, Inject, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { DrugsService } from './drugs.service';
import { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { getScopeRows } from '../../common/auth/subscription-scope';

@Controller('drugs')
export class DrugsController {
  constructor(
    private readonly svc: DrugsService,
    private readonly authService: AuthService,
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
  ) {}

  /** A PAID plan from the signed token's plan list (free plan slug = 'free'; 0 statements for the app). */
  private async paidPlan(userId: number) {
    return (await getScopeRows<{ plan_slug?: string | null }>(this.db, userId)).some((r) => String(r.plan_slug || '') !== 'free');
  }

  // ── 10.19: the light list, asked when the Drugs page opens ──
  @Get('list')
  async list(@Headers('authorization') auth?: string, @Query('have') have?: string) {
    const student = await this.authService.requireStudent(auth);
    const settings = this.svc.getSettings();
    if (!settings.enabled) return { blocked: true, reason: 'feature_disabled' };
    // The list from memory + the student's spin state (1 statement).
    const [list, paid] = await Promise.all([this.svc.drugList(), this.paidPlan(student.id)]);
    // Free users: spins used (1 row by key). Paid plans: nothing to read.
    const spin = { paid, used: paid ? 0 : await this.svc.spinsUsed(student.id) };
    // The phone already holds this version's list → only the spin state.
    const same = Number(have) > 0 && Number(have) === list.v;
    return { v: list.v, ...(same ? { unchanged: true } : { drugs: list.drugs }), useCount: spin.used, freeLimit: settings.freeLimit, hasSubscription: spin.paid };
  }

  // ── 10.19: one drug's full text (kept on the phone afterwards) ──
  @Get('item/:id')
  async item(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireStudent(auth);
    if (!this.svc.getSettings().enabled) return { blocked: true, reason: 'feature_disabled' };
    const drug = await this.svc.drugItem(id);
    if (!drug) throw new NotFoundException('Drug not found');
    return { drug };
  }

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

    // Check subscription directly from DB — session cache can be stale
    const [hasSubscription, result] = await Promise.all([
      this.svc.checkSubscription(student.id),
      this.svc.getBatch(student.id, Number(count)),
    ]);

    return {
      ...result,
      hasSubscription,
    };
  }

  // ── record a spin — enforces limit server-side ──
  @Post('record')
  async record(@Headers('authorization') auth?: string, @Body() body?: { count?: number }) {
    const student = await this.authService.requireStudent(auth);
    // 10.19: the spins of one visit in one request (free users; subscribers
    // never send it). Older builds send no count: one spin, as before.
    if (body && body.count !== undefined) {
      if (await this.paidPlan(student.id)) return { ok: true }; // paid plans never count
      await this.svc.recordSpins(student.id, Number(body.count)); // 1 statement
      return { ok: true };
    }
    // Check subscription directly from DB — never trust session hasActiveSubscription
    const hasSubscription = await this.svc.checkSubscription(student.id);
    const settings = this.svc.getSettings();

    const useCount = await this.svc.getSpinCount(student.id);

    if (!hasSubscription && useCount >= settings.freeLimit) {
      return { ok: false, reason: 'limit_reached', useCount, freeLimit: settings.freeLimit };
    }

    await this.svc.recordSpin(student.id);
    return { ok: true, useCount: useCount + 1, freeLimit: settings.freeLimit };
  }
}
