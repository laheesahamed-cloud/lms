import { ArgumentsHost, BadRequestException, Body, Catch, Controller, Delete, ExceptionFilter, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage, diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

/**
 * Videos stream straight to disk.
 *
 * `memoryStorage` held the whole upload in RAM and then wrote it with
 * `writeFileSync` — half a gigabyte of resident memory, and a synchronous write
 * that blocked the event loop (so the rest of the API stopped answering) for the
 * length of the write. Disk storage streams it and never buffers.
 *
 * The mime check and size cap live here as multer options rather than in the
 * handler, so a wrong or oversized file is rejected while it uploads instead of
 * after the whole thing has arrived.
 */
const videoUpload = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = join(process.cwd(), 'uploads', 'video');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = (file.originalname.split('.').pop() || 'mp4')
        .toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      cb(null, `lesson-upload-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
    },
  }),
  limits: { fileSize: VIDEO_MAX_BYTES },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!VIDEO_MIME.includes(file.mimetype)) {
      cb(new BadRequestException('Only MP4, WebM, MOV or OGG videos are allowed'), false);
      return;
    }
    cb(null, true);
  },
};
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonAnnotationDto } from './dto/create-lesson-annotation.dto';
import { UpdateLessonAnnotationDto } from './dto/update-lesson-annotation.dto';

/**
 * Multer throws its own error type when a file exceeds `limits.fileSize`, and
 * without this it reaches the client as an opaque 500. The upload screen shows
 * whatever message comes back, so it needs to be the real reason.
 */
@Catch()
class UploadErrorFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        statusCode: 400,
        message: 'That video is over the 500 MB limit.',
      });
      return;
    }
    const status = Number(exception?.status || exception?.getStatus?.() || 500);
    res.status(status).json({
      statusCode: status,
      message: exception?.response?.message || exception?.message || 'Upload failed',
    });
  }
}

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
  findStudentLesson(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string,
    @Headers('x-app-client') appClient?: string
  ) {
    return this.lessonsService.findStudentLesson(id, authorization, appClient);
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

  @Post(':id/pdf')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadPdf(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Only PDF files are allowed');
    if (file.size > 50 * 1024 * 1024) throw new BadRequestException('PDF must be under 50 MB');
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.uploadPdf(id, file, actor);
  }

  @Delete(':id/pdf')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async removePdf(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.removePdf(id, actor);
  }

  @Post(':id/video')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  @UseFilters(UploadErrorFilter)
  @UseInterceptors(FileInterceptor('file', videoUpload))
  async uploadVideo(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.uploadVideo(id, file, actor);
  }

  @Delete(':id/video')
  @UseGuards(AdminGuard)
  @RequirePermissions('content.manage')
  async removeVideo(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.lessonsService.removeVideo(id, actor);
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

  // ─── Canvas (AI Notes) routes ────────────────────────────────────────────

  @Post('canvas/:id/section/regenerate')
  canvasRegenerateSection(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body('heading') heading: string,
  ) {
    return this.lessonsService.regenerateSection(id, heading, this.bearerToken(auth));
  }

  @Post('canvas/source/preview')
  canvasSourcePreview(
    @Headers('authorization') auth: string,
    @Body('text') text: string,
    @Body('sourceFormat') sourceFormat?: string,
  ) {
    return this.lessonsService.previewSource(
      text,
      this.bearerToken(auth),
      sourceFormat === 'html' ? 'html' : 'text',
    );
  }

  @Post('canvas/generate')
  canvasGenerate(
    @Headers('authorization') auth: string,
    @Body('text') text: string,
    @Body('sourceFormat') sourceFormat?: string,
  ) {
    return this.lessonsService.canvasGenerate(
      text,
      this.bearerToken(auth),
      undefined,
      sourceFormat === 'html' ? 'html' : 'text',
    );
  }

  // Progress-log variant: starts generation in the background and returns a
  // job id immediately; the admin UI polls canvasGenerateStatus for a running
  // log of stages instead of one long blocking wait with no visibility.
  @Post('canvas/generate/start')
  canvasGenerateStart(
    @Headers('authorization') auth: string,
    @Body('text') text: string,
    @Body('sourceFormat') sourceFormat?: string,
  ) {
    return this.lessonsService.startCanvasGenerate(
      text,
      this.bearerToken(auth),
      sourceFormat === 'html' ? 'html' : 'text',
    );
  }

  @Get('canvas/generate/status/:jobId')
  canvasGenerateStatus(@Headers('authorization') auth: string, @Param('jobId') jobId: string) {
    return this.lessonsService.getCanvasGenerateJob(jobId, this.bearerToken(auth));
  }

  @Get('canvas/admin')
  canvasAdminList(@Headers('authorization') auth: string, @Query('engineKey') engineKey?: string) {
    return this.lessonsService.canvasAdminList(this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
  }

  @Patch('canvas/admin/reorder')
  canvasReorderLessons(@Headers('authorization') auth: string, @Body('orderedIds') orderedIds: number[]) {
    return this.lessonsService.canvasReorderLessons(Array.isArray(orderedIds) ? orderedIds.map(Number) : [], this.bearerToken(auth));
  }

  @Get('canvas/hierarchy/courses')
  canvasGetCourses(@Headers('authorization') auth: string) {
    return this.lessonsService.getCourses(this.bearerToken(auth));
  }

  @Get('canvas/hierarchy/topics')
  canvasGetTopics(@Headers('authorization') auth: string, @Query('courseId') courseId?: string) {
    return this.lessonsService.getTopics(courseId ? Number(courseId) : undefined, this.bearerToken(auth));
  }

  @Get('canvas/hierarchy/subtopics')
  canvasGetSubtopics(@Headers('authorization') auth: string, @Query('topicId') topicId?: string) {
    return this.lessonsService.getSubtopics(topicId ? Number(topicId) : undefined, this.bearerToken(auth));
  }

  @Get('canvas/admin/:id')
  canvasAdminFindOne(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('engineKey') engineKey?: string,
  ) {
    return this.lessonsService.canvasAdminFindOne(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
  }

  @Patch('canvas/admin/:id')
  canvasAdminUpdate(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Query('engineKey') engineKey?: string,
  ) {
    return this.lessonsService.canvasAdminUpdate(
      id,
      { title: body.title as string, rawText: body.rawText as string, noteData: body.noteData, status: body.status as string, courseId: body.courseId != null ? Number(body.courseId) : undefined, topicId: body.topicId != null ? Number(body.topicId) : undefined, subtopicId: body.subtopicId != null ? Number(body.subtopicId) : undefined, videoUrl: body.videoUrl as string, isFree: body.isFree != null ? Number(body.isFree) : undefined },
      this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey),
    );
  }

  @Delete('canvas/admin/:id')
  canvasAdminRemove(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('engineKey') engineKey?: string,
  ) {
    return this.lessonsService.canvasAdminRemove(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey));
  }

  @Get('canvas/admin/:id/flashcards')
  canvasAdminListFlashcards(@Headers('authorization') auth: string, @Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.canvasAdminListFlashcards(id, this.bearerToken(auth));
  }

  @Post('canvas/admin/:id/flashcards')
  canvasAdminCreateFlashcard(@Headers('authorization') auth: string, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.lessonsService.canvasAdminCreateFlashcard(id, body as never, this.bearerToken(auth));
  }

  @Post('canvas/admin/:id/flashcards/generate')
  canvasAdminGenerateFlashcards(@Headers('authorization') auth: string, @Param('id', ParseIntPipe) id: number, @Body() body: { count?: number }) {
    return this.lessonsService.canvasAdminGenerateFlashcards(id, body, this.bearerToken(auth));
  }

  @Patch('canvas/admin/:id/flashcards/:cardId')
  canvasAdminUpdateFlashcard(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lessonsService.canvasAdminUpdateFlashcard(id, cardId, body as never, this.bearerToken(auth));
  }

  @Delete('canvas/admin/:id/flashcards/:cardId')
  canvasAdminRemoveFlashcard(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('cardId', ParseIntPipe) cardId: number,
  ) {
    return this.lessonsService.canvasAdminRemoveFlashcard(id, cardId, this.bearerToken(auth));
  }

  @Get('canvas/student/notes')
  canvasStudentList(
    @Headers('authorization') auth: string,
    @Query('engineKey') engineKey?: string,
    @Headers('x-app-client') appClient?: string,
  ) {
    return this.lessonsService.canvasStudentList(this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey), appClient);
  }

  @Get(':id/note')
  canvasStudentFindNote(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('engineKey') engineKey?: string,
    @Headers('x-app-client') appClient?: string,
  ) {
    return this.lessonsService.canvasStudentFindNote(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey), appClient);
  }

  @Get(':id/flashcards')
  canvasStudentFlashcards(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('engineKey') engineKey?: string,
    @Headers('x-app-client') appClient?: string,
  ) {
    return this.lessonsService.canvasStudentFlashcards(id, this.bearerToken(auth), this.lessonsService.normalizeEngineKey(engineKey), appClient);
  }

  private bearerToken(auth: string | undefined) {
    if (!auth) return '';
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    return m ? m[1].trim() : '';
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
