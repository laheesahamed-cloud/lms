import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { StudentGuard } from '../auth/student.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  findAll(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('topicId') topicId?: string,
    @Query('status') status?: string
  ) {
    return this.quizzesService.findAll({
      search,
      courseId: courseId ? parseInt(courseId, 10) : undefined,
      topicId: topicId || undefined,
      status,
    });
  }

  @Get('meta')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  meta(@Query('includeQuestions') includeQuestions?: string) {
    return this.quizzesService.meta({
      includeQuestions: includeQuestions === '1' || includeQuestions === 'true',
    });
  }

  @Get(':id/cards')
  @UseGuards(StudentGuard)
  getCards(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authorization?: string) {
    return this.quizzesService.getCards(authorization, id);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.findOne(id);
  }

  @Get(':id/versions')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.listVersions(id);
  }

  @Post(':id/draft')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.quizzesService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.quizzesService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.quizzesService.publish(id, actor);
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
    return this.quizzesService.rollback(id, versionNumber, actor);
  }

  @Post()
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  async create(@Headers('authorization') authorization: string | undefined, @Body() createQuizDto: CreateQuizDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.quizzesService.create(createQuizDto, actor);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuizDto: UpdateQuizDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.quizzesService.update(id, updateQuizDto, actor);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @RequirePermissions('quizzes.manage')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.quizzesService.remove(id, actor);
  }
}
