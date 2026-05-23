import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
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

  @Get('study-planner/suggestions')
  listPlannerSuggestions(@Headers('authorization') authorization?: string) {
    return this.workspaceService.listPlannerSuggestions(authorization);
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

  @Get('question-review/admin')
  @RequirePermissions('content.review')
  listQuestionReviewItems(@Headers('authorization') authorization?: string, @Query('status') status?: string) {
    return this.workspaceService.listQuestionReviewItems(authorization, status);
  }

  @Post('question-review/admin')
  @RequirePermissions('content.review')
  createQuestionReviewItem(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.workspaceService.createQuestionReviewItem(authorization, body);
  }

  @Patch('question-review/admin/:id')
  @RequirePermissions('content.review')
  updateQuestionReviewItem(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.workspaceService.updateQuestionReviewItem(authorization, id, body);
  }

  @Get('lesson-doubts')
  listStudentDoubts(@Headers('authorization') authorization?: string) {
    return this.workspaceService.listStudentDoubts(authorization);
  }

  @Post('lesson-doubts')
  createDoubt(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    return this.workspaceService.createDoubt(authorization, body);
  }

  @Get('lesson-doubts/admin')
  @RequirePermissions('support.manage')
  listAdminDoubts(@Headers('authorization') authorization?: string, @Query('status') status?: string) {
    return this.workspaceService.listAdminDoubts(authorization, status);
  }

  @Patch('lesson-doubts/admin/:id')
  @RequirePermissions('support.manage')
  answerDoubt(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.workspaceService.answerDoubt(authorization, id, body);
  }
}
