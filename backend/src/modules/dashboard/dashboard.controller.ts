import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
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
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('student')
  getStudentDashboard(@Headers('authorization') authorization?: string) {
    return this.dashboardService.getStudentDashboard(authorization);
  }

  @Post('student/activity')
  recordStudentActivity(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RecordStudyActivityDto
  ) {
    return this.dashboardService.recordStudentActivity(authorization, dto);
  }
}
