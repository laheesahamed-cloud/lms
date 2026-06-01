import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStudentLessonProgressDto } from './dto/update-student-lesson-progress.dto';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly authService: AuthService,
  ) {}

  @Get('student')
  findStudentCourses(@Headers('authorization') authorization?: string) {
    return this.coursesService.findStudentCourses(authorization);
  }

  @Get('student/:id')
  findStudentCourseDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string
  ) {
    return this.coursesService.findStudentCourseDetail(id, authorization);
  }

  @Patch('student/lessons/:lessonId/progress')
  updateStudentLessonProgress(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() dto: UpdateStudentLessonProgressDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.coursesService.updateStudentLessonProgress(lessonId, dto, authorization);
  }

  @Get()
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  findAll() {
    return this.coursesService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async create(@Headers('authorization') authorization: string | undefined, @Body() createCourseDto: CreateCourseDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.coursesService.create(createCourseDto, actor);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.coursesService.update(id, updateCourseDto, actor);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.coursesService.remove(id, actor);
  }

  @Get(':id/versions')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.listVersions(id);
  }

  @Post(':id/draft')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.coursesService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.coursesService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.coursesService.publish(id, actor);
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
    return this.coursesService.rollback(id, versionNumber, actor);
  }
}
