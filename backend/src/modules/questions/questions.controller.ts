import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/admin.guard';
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
  constructor(private readonly questionsService: QuestionsService) {}

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
      random: random === '1' || random === 'true',
    });
  }

  @Get('meta')
  meta() {
    return this.questionsService.meta();
  }

  @Get('export/workbook')
  async exportQuestions(
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
    });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="questions-export-${Date.now()}.csv"`);
    response.send(workbook);
  }

  @Get('export')
  async exportQuestionsLegacy(
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
  importQuestions(@UploadedFile() file: any) {
    return this.questionsService.importWorkbook(file);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', workbookUploadOptions))
  importQuestionsLegacy(@UploadedFile() file: any) {
    return this.questionsService.importWorkbook(file);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.findOne(id);
  }

  @Post()
  create(@Body() createQuestionDto: CreateQuestionDto) {
    return this.questionsService.create(createQuestionDto);
  }

  @Post('keywords/bulk')
  bulkUpdateKeywords(@Body() bulkUpdateQuestionKeywordsDto: BulkUpdateQuestionKeywordsDto) {
    return this.questionsService.bulkUpdateKeywords(bulkUpdateQuestionKeywordsDto);
  }

  @Post('bulk-delete')
  bulkDelete(@Body() bulkDeleteQuestionsDto: BulkDeleteQuestionsDto) {
    return this.questionsService.bulkDelete(bulkDeleteQuestionsDto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateQuestionDto: UpdateQuestionDto) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.remove(id);
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
}
