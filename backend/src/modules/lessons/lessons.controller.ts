import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonAnnotationDto } from './dto/create-lesson-annotation.dto';
import { UpdateLessonAnnotationDto } from './dto/update-lesson-annotation.dto';

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly authService: AuthService,
  ) {}

  @Get('meta')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  getMeta() {
    return this.lessonsService.getMeta();
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  findAdminList(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('topicId') topicId?: string,
    @Query('subtopicId') subtopicId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('offset') offset?: string
  ) {
    return this.lessonsService.findAdminList({
      search,
      courseId: courseId ? Number(courseId) : undefined,
      topicId: topicId ? Number(topicId) : undefined,
      subtopicId: subtopicId ? Number(subtopicId) : undefined,
      status,
      limit: this.parsePositiveNumber(limit),
      page: this.parsePositiveNumber(page),
      offset: this.parseNonNegativeNumber(offset),
    });
  }

  @Get('student')
  findStudentList(@Headers('authorization') authorization?: string) {
    return this.lessonsService.findStudentList(authorization);
  }

  @Get('student/:id')
  findStudentLesson(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authorization?: string) {
    return this.lessonsService.findStudentLesson(id, authorization);
  }

  @Get(':lessonId/annotations')
  findStudentAnnotations(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.findStudentAnnotations(lessonId, authorization);
  }

  @Post(':lessonId/annotations')
  createStudentAnnotation(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() createLessonAnnotationDto: CreateLessonAnnotationDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.createStudentAnnotation(lessonId, createLessonAnnotationDto, authorization);
  }

  @Patch(':lessonId/annotations/:annotationId')
  updateStudentAnnotation(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Body() updateLessonAnnotationDto: UpdateLessonAnnotationDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.updateStudentAnnotation(lessonId, annotationId, updateLessonAnnotationDto, authorization);
  }

  @Delete(':lessonId/annotations/:annotationId')
  removeStudentAnnotation(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.lessonsService.removeStudentAnnotation(lessonId, annotationId, authorization);
  }

  @Post()
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async create(@Headers('authorization') authorization: string | undefined, @Body() createLessonDto: CreateLessonDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.create(createLessonDto, actor);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.update(id, updateLessonDto, actor);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.remove(id, actor);
  }

  @Get(':id/versions')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.listVersions(id);
  }

  @Post(':id/draft')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.publish(id, actor);
  }

  @Post(':id/rollback/:versionNumber')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.review')
  async rollback(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.rollback(id, versionNumber, actor);
  }

  private parsePositiveNumber(raw?: string) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return Math.trunc(value);
  }

  private parseNonNegativeNumber(raw?: string) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return Math.trunc(value);
  }
}
