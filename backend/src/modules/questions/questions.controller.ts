import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { QuestionsService } from './questions.service';
import { BulkDeleteQuestionsDto } from './dto/bulk-delete-questions.dto';
import { BulkUpdateQuestionKeywordsDto } from './dto/bulk-update-question-keywords.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

const workbookUploadOptions = {
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 0,
    fieldNameSize: 80,
  },
  fileFilter: (_request: unknown, file: { originalname?: string; mimetype?: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const name = String(file.originalname || '').toLowerCase();
    const mimetype = String(file.mimetype || '').toLowerCase();
    const allowedExtension = name.endsWith('.csv');
    const allowedMime =
      mimetype === 'text/csv' ||
      mimetype === 'application/csv' ||
      mimetype === 'application/vnd.ms-excel';

    if (!allowedExtension || !allowedMime) {
      callback(new BadRequestException('Only CSV question imports are allowed'), false);
      return;
    }

    callback(null, true);
  },
};

@Controller('questions')
@UseGuards(AdminGuard)
@RequirePermissions('questions.manage')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('courseId') courseId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('paperId') paperId?: string,
    @Query('category') category?: string,
    @Query('unclassified') unclassified?: string,
    @Query('keywords') keywords?: string,
    @Query('usage') usage?: string,
    @Query('ids') ids?: string,
    @Query('excludeIds') excludeIds?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('offset') offset?: string,
    @Query('random') random?: string
  ) {
    return this.questionsService.findAll({
      search,
      status,
      type,
      category,
      keywords,
      usage,
      courseId: courseId ? Number(courseId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
      topicId: topicId ? Number(topicId) : undefined,
      lessonId: lessonId ? Number(lessonId) : undefined,
      paperId: paperId ? Number(paperId) : undefined,
      unclassified: unclassified === '1' || unclassified === 'true',
      ids: this.parseIdList(ids),
      excludeIds: this.parseIdList(excludeIds),
      limit: this.parseLimit(limit),
      page: this.parsePositiveNumber(page),
      offset: this.parseNonNegativeNumber(offset),
      random: random === '1' || random === 'true',
    });
  }

  @Get('meta')
  meta() {
    return this.questionsService.meta();
  }

  @Get('export/workbook')
  async exportQuestions(
    @Headers('authorization') authorization?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('courseId') courseId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('paperId') paperId?: string,
    @Query('category') category?: string,
    @Query('unclassified') unclassified?: string,
    @Query('keywords') keywords?: string,
    @Query('usage') usage?: string,
    @Res() response?: any,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    const workbook = await this.questionsService.exportWorkbook({
      search,
      status,
      type,
      category,
      keywords,
      usage,
      courseId: courseId ? Number(courseId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
      topicId: topicId ? Number(topicId) : undefined,
      lessonId: lessonId ? Number(lessonId) : undefined,
      paperId: paperId ? Number(paperId) : undefined,
      unclassified: unclassified === '1' || unclassified === 'true',
    }, actor);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="questions-export-${Date.now()}.csv"`);
    response.send(workbook);
  }

  @Get('export')
  async exportQuestionsLegacy(
    @Headers('authorization') authorization?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('courseId') courseId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('paperId') paperId?: string,
    @Query('category') category?: string,
    @Query('unclassified') unclassified?: string,
    @Query('keywords') keywords?: string,
    @Query('usage') usage?: string,
    @Res() response?: any,
  ) {
    return this.exportQuestions(
      authorization,
      search,
      status,
      type,
      courseId,
      subjectId,
      topicId,
      lessonId,
      paperId,
      category,
      unclassified,
      keywords,
      usage,
      response,
    );
  }

  @Post('import/workbook')
  @UseInterceptors(FileInterceptor('file', workbookUploadOptions))
  async importQuestions(@Headers('authorization') authorization: string | undefined, @UploadedFile() file: any) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.importWorkbook(file, actor);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', workbookUploadOptions))
  async importQuestionsLegacy(@Headers('authorization') authorization: string | undefined, @UploadedFile() file: any) {
    return this.importQuestions(authorization, file);
  }

  @Get(':id/versions')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.listVersions(id);
  }

  @Post(':id/draft')
  async markDraft(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.markDraft(id, actor);
  }

  @Post(':id/submit-review')
  async submitForReview(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.submitForReview(id, actor);
  }

  @Post(':id/publish')
  @RequirePermissions('content.review')
  async publish(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.publish(id, actor);
  }

  @Post(':id/rollback/:versionNumber')
  @RequirePermissions('content.review')
  async rollback(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.rollback(id, versionNumber, actor);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.findOne(id);
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() createQuestionDto: CreateQuestionDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.create(createQuestionDto, actor);
  }

  @Post('keywords/bulk')
  async bulkUpdateKeywords(
    @Headers('authorization') authorization: string | undefined,
    @Body() bulkUpdateQuestionKeywordsDto: BulkUpdateQuestionKeywordsDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.bulkUpdateKeywords(bulkUpdateQuestionKeywordsDto, actor);
  }

  @Post('bulk-delete')
  async bulkDelete(@Headers('authorization') authorization: string | undefined, @Body() bulkDeleteQuestionsDto: BulkDeleteQuestionsDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.bulkDelete(bulkDeleteQuestionsDto, actor);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.update(id, updateQuestionDto, actor);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.questionsService.remove(id, actor);
  }

  private parseIdList(raw?: string) {
    return Array.from(
      new Set(
        String(raw || '')
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    );
  }

  private parseLimit(raw?: string) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return Math.min(Math.max(Math.trunc(value), 1), 200);
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
