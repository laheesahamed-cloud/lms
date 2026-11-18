import { isMobileAppClient } from '../../common/utils/mobile-client.util';
import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { RecordStudyActivityDto } from './dto/record-study-activity.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @UseGuards(AdminGuard)
  @RequirePermissions('reports.view')
  getAdminDashboard(@Headers('authorization') authorization?: string, @Query('today') today?: string) {
    return this.dashboardService.getAdminDashboard(authorization, today);
  }

  // Before 'admin/:x' style routes; reached as /api/admin/dashboard/search.
  @Get('admin/search')
  @UseGuards(AdminGuard)
  adminSearch(
    @Headers('authorization') authorization?: string,
    @Query('q') q?: string,
    @Query('only') only?: string,
  ) {
    return this.dashboardService.adminSearch(authorization, q, only);
  }

  @Get('student')
  getStudentDashboard(
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.dashboardService.getStudentDashboard(authorization, appClient);
  }

  // Study Hub top part (what the start-up request carries), for a refresh.
  @Get('student/top')
  getStudentHubTop(@Headers('authorization') authorization?: string, @Headers('x-app-client') appClient?: string) {
    return this.dashboardService.getStudentHubTop(authorization, isMobileAppClient(appClient));
  }

  // Study Hub lower cards (plan, analytics, question of the day, weak areas,
  // recent results), loaded by the app when they are scrolled near. The top
  // part comes with the start-up request (POST /app/start).
  // 10.31: Question of the Day for the app — asked only when the phone has
  // no saved Q-Bank sets to pick one from. One question + its 5 options.
  @Get('student/question')
  getStudentQuestionOfDay(@Headers('authorization') authorization?: string) {
    return this.dashboardService.getStudentQuestionOfDay(authorization);
  }

  @Get('student/more')
  getStudentHubMore(
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string,
    // 10.22: the website asks for the light lower cards like the app does
    // (no stale attempt reads) and picks the question of the day itself from
    // the free quiz file (no question-pool reads).
    @Query('lite') lite?: string,
  ) {
    return this.dashboardService.getStudentHubMore(authorization, appClient, lite === '1');
  }

  /**
   * 10.28: practices waiting on the phone for 12 hours with no other request
   * to ride along with. The body is `{ practices: [...] }`; the ride-along step
   * applies them (one statement). Nothing is returned.
   */
  @Post('student/sync')
  syncStudentProgress() {
    return { ok: 1 };
  }

  @Post('student/activity')
  recordStudentActivity(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RecordStudyActivityDto
  ) {
    return this.dashboardService.recordStudentActivity(authorization, dto);
  }
}
