import { NoticesService } from '../notices/notices.service';
import { progressOptions } from '../courses/student-catalogue.service';
import { StartPayloadService } from './start-payload.service';
import { Body, Controller, Get, Headers, Inject, Post, Query } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { getContentVersion } from '../../common/utils/content-version';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';

/**
 * The app's ONE cold-open request (OPTIMIZE 10.2 #2). Sent with the saved
 * session token, it renews the signed access token (the cold-open account
 * check: one indexed user row + the access profile) and returns what the first
 * screen needs, so the app makes no other request before Study Hub shows.
 *
 *   accessToken / accessExpiresIn — for every following request (no session SQL)
 *   user                           — profile + access (plan, features)
 *   contentVersion                 — saved lists on the phone stay valid while unchanged
 *   dashboard                      — Study Hub (a stored per-student summary from step 3)
 */
@Controller('app')
export class AppStartController {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly notices: NoticesService,
    private readonly startPayload: StartPayloadService,
  ) {}

  @Post('start')
  async start(
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string,
    @Body() body?: { lastNoticeId?: number; progressFormat?: string; progressVersion?: number; courses?: boolean },
  ) {
    const renewed = await this.authService.renewAccessToken(authorization);
    const start = await this.startPayload.build(
      String(renewed.user.role), renewed.accessToken, Number(body?.lastNoticeId) || 0, Number(renewed.user.id) || 0,
      progressOptions(body?.progressFormat, body?.progressVersion),
      // 10.22: the website's Study Hub also shows course progress cards.
      body?.courses === true,
    );
    return {
      ok: true,
      accessToken: renewed.accessToken,
      accessExpiresIn: renewed.accessExpiresIn,
      user: renewed.user,
      // Catalogue version, Study Hub top, notices newer than the phone's last
      // one and the active announcements (step 4/5).
      ...start,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Notices newer than `after` and the active announcements, from the JSON
   * files (0 database rows; the account comes from the signed token). Used
   * right after a fresh sign-in and on the inbox's pull-to-refresh; cold opens
   * get the same inside POST /app/start.
   */
  @Get('notices')
  async listNotices(@Headers('authorization') authorization?: string, @Query('after') after?: string) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    const role = String(user.role);
    return {
      notices: this.notices.noticesFor(role, Math.max(0, Number(after) || 0)),
      popups: this.notices.popupsFor(role),
      // A fresh sign-in skips the start-up reply: the phone needs the
      // catalogue version to keep its saved lists valid.
      contentVersion: await getContentVersion(this.db),
    };
  }
}
