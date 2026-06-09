import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { WorkspaceService } from './workspace.service';

@Controller()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('announcements/admin')
  @RequirePermissions('notifications.manage')
  listAdminAnnouncements(@Headers('authorization') authorization?: string) {
    return this.workspaceService.listAdminAnnouncements(authorization);
  }

  @Post('announcements/admin')
  @RequirePermissions('notifications.manage')
  createAnnouncement(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.workspaceService.createAnnouncement(authorization, body);
  }

  @Patch('announcements/admin/:id')
  @RequirePermissions('notifications.manage')
  updateAnnouncement(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.workspaceService.updateAnnouncement(authorization, id, body);
  }

  @Delete('announcements/admin/:id')
  @RequirePermissions('notifications.manage')
  deleteAnnouncement(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    return this.workspaceService.deleteAnnouncement(authorization, id);
  }

  @Get('notifications')
  listNotifications(@Headers('authorization') authorization?: string) {
    return this.workspaceService.listNotifications(authorization);
  }

  @Post('notifications/:id/read')
  markNotificationRead(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    return this.workspaceService.markNotificationRead(authorization, id);
  }

  @Get('study-planner')
  listPlannerTasks(@Headers('authorization') authorization?: string) {
    return this.workspaceService.listPlannerTasks(authorization);
  }

  @Get('study-planner/agenda')
  getPlannerAgenda(@Headers('authorization') authorization?: string) {
    return this.workspaceService.getPlannerAgenda(authorization);
  }

  @Post('study-planner')
  createPlannerTask(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.workspaceService.createPlannerTask(authorization, body);
  }

  @Patch('study-planner/:id')
  updatePlannerTask(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.workspaceService.updatePlannerTask(authorization, id, body);
  }

  @Delete('study-planner/:id')
  deletePlannerTask(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    return this.workspaceService.deletePlannerTask(authorization, id);
  }

  @Get('reports/admin')
  @RequirePermissions('reports.view')
  getAdminReports(
    @Headers('authorization') authorization?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('courseId') courseId?: string,
    @Query('userId') userId?: string
  ) {
    return this.workspaceService.getAdminReports(authorization, { startDate, endDate, courseId, userId });
  }

  @Post('question-reports')
  createQuestionReport(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.workspaceService.createQuestionReport(authorization, body);
  }

  @Get('question-reports/admin')
  @RequirePermissions('questions.manage')
  listQuestionReports(@Headers('authorization') authorization?: string, @Query('status') status?: string) {
    return this.workspaceService.listQuestionReports(authorization, status);
  }

  @Get('question-review/admin')
  @RequirePermissions('content.review')
  listLegacyQuestionReview(@Headers('authorization') authorization?: string, @Query('status') status?: string) {
    return this.workspaceService.listQuestionReports(authorization, status);
  }

  @Post('question-review/admin')
  @RequirePermissions('content.review')
  createLegacyQuestionReview() {
    throw new BadRequestException('Use question reports for student-submitted question review items');
  }

  @Patch('question-reports/admin/:id')
  @RequirePermissions('questions.manage')
  updateQuestionReport(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.workspaceService.updateQuestionReport(authorization, id, body);
  }

  @Patch('question-review/admin/:id')
  @RequirePermissions('content.review')
  updateLegacyQuestionReview(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.workspaceService.updateQuestionReport(authorization, id, body);
  }

}
