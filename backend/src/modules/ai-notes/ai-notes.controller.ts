import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Allow, ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { createHash } from 'crypto';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AiNotesService } from './ai-notes.service';

// Minimal structural type so we can drive conditional-request headers without
// pulling in @types/express (not installed). Nest injects the real express res.
type CacheableResponse = {
  status(code: number): { end(): void };
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
};

class GenerateDto {
  @IsString() @MinLength(10) @MaxLength(12000)
  text!: string;
}

class CreateNoteDto {
  @IsString() @MinLength(1) @MaxLength(255)
  title!: string;

  @IsOptional() @IsString() @MaxLength(12000)
  rawText?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  courseId?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  topicId?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  subtopicId?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  lessonId?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  isFree?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Video URL must be a valid http:// or https:// URL' })
  @MaxLength(1000)
  videoUrl?: string;
}

class UpdateNoteDto {
  @IsOptional() @IsString() @MaxLength(255)
  title?: string;

  @IsOptional() @IsString() @MaxLength(50000)
  rawText?: string;

  @IsOptional() @Allow()
  noteData?: unknown;

  @IsOptional() @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  courseId?: number | null;

  @IsOptional() @IsInt() @Type(() => Number)
  topicId?: number | null;

  @IsOptional() @IsInt() @Type(() => Number)
  subtopicId?: number | null;

  @IsOptional() @IsInt() @Type(() => Number)
  lessonId?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Video URL must be a valid http:// or https:// URL' })
  @MaxLength(1000)
  videoUrl?: string | null;

  @IsOptional() @IsInt() @Type(() => Number)
  isFree?: number | null;
}

class GenerateLessonFlashcardsDto {
  @IsOptional() @IsInt() @Min(6) @Max(60) @Type(() => Number)
  count?: number;
}

class CreateLessonFlashcardDto {
  @IsString() @MinLength(8) @MaxLength(1000)
  question!: string;

  @IsString() @MinLength(12) @MaxLength(3000)
  answer!: string;

  @IsOptional() @IsString() @MaxLength(500)
  sourceHint?: string;

  @IsOptional() @IsString() @MaxLength(1500000)
  imageUrl?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1500000, { each: true })
  imageUrls?: string[];

  @IsOptional() @IsIn(['contain', 'cover'])
  imageFit?: 'contain' | 'cover';

  @IsOptional() @IsIn(['draft', 'approved', 'rejected'])
  status?: 'draft' | 'approved' | 'rejected';
}

class UpdateLessonFlashcardDto {
  @IsOptional() @IsString() @MinLength(8) @MaxLength(1000)
  question?: string;

  @IsOptional() @IsString() @MinLength(12) @MaxLength(3000)
  answer?: string;

  @IsOptional() @IsString() @MaxLength(500)
  sourceHint?: string;

  @IsOptional() @IsString() @MaxLength(1500000)
  imageUrl?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(1500000, { each: true })
  imageUrls?: string[];

  @IsOptional() @IsIn(['contain', 'cover'])
  imageFit?: 'contain' | 'cover';

  @IsOptional() @IsIn(['draft', 'approved', 'rejected'])
  status?: 'draft' | 'approved' | 'rejected';

  @IsOptional() @IsInt() @Type(() => Number)
  sortOrder?: number;
}

function token(auth: string | undefined) {
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

function engine(value: string | undefined, svc: AiNotesService) {
  return svc.normalizeEngineKey(value);
}

@Controller('ai-notes')
export class AiNotesController {
  constructor(private readonly svc: AiNotesService) {}

  // ── Admin routes ─────────────────────────────────────────
  @Post('generate')
  @RequirePermissions('ai.manage')
  @HttpCode(200)
  generate(@Body() dto: GenerateDto, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.generate(dto.text, token(auth), engine(engineKey, this.svc));
  }

  @Get('admin')
  @RequirePermissions('content.manage')
  adminList(@Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.adminList(token(auth), engine(engineKey, this.svc));
  }

  @Post('admin')
  @RequirePermissions('content.manage')
  adminCreate(@Body() dto: CreateNoteDto, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.adminCreate(dto.title, dto.rawText, dto.courseId, dto.topicId, dto.subtopicId, dto.lessonId, dto.isFree, dto.videoUrl, token(auth), engine(engineKey, this.svc));
  }

  @Get('admin/:id/flashcards')
  @RequirePermissions('content.manage')
  adminListFlashcards(@Param('id', ParseIntPipe) id: number, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.adminListFlashcards(id, token(auth), engine(engineKey, this.svc));
  }

  @Post('admin/:id/flashcards')
  @RequirePermissions('content.manage')
  adminCreateFlashcard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLessonFlashcardDto,
    @Query('engine') engineKey: string,
    @Headers('authorization') auth: string,
  ) {
    return this.svc.adminCreateFlashcard(id, dto, token(auth), engine(engineKey, this.svc));
  }

  @Post('admin/:id/flashcards/generate')
  @RequirePermissions('ai.manage')
  @HttpCode(200)
  adminGenerateFlashcards(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateLessonFlashcardsDto,
    @Query('engine') engineKey: string,
    @Headers('authorization') auth: string,
  ) {
    return this.svc.adminGenerateFlashcards(id, dto, token(auth), engine(engineKey, this.svc));
  }

  @Patch('admin/:id/flashcards/:cardId')
  @RequirePermissions('content.manage')
  adminUpdateFlashcard(
    @Param('id', ParseIntPipe) id: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: UpdateLessonFlashcardDto,
    @Query('engine') engineKey: string,
    @Headers('authorization') auth: string,
  ) {
    return this.svc.adminUpdateFlashcard(id, cardId, dto, token(auth), engine(engineKey, this.svc));
  }

  @Delete('admin/:id/flashcards/:cardId')
  @RequirePermissions('content.manage')
  adminRemoveFlashcard(
    @Param('id', ParseIntPipe) id: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Query('engine') engineKey: string,
    @Headers('authorization') auth: string,
  ) {
    return this.svc.adminRemoveFlashcard(id, cardId, token(auth), engine(engineKey, this.svc));
  }

  @Get('admin/hierarchy/courses')
  @RequirePermissions('content.manage')
  getCourses(@Headers('authorization') auth: string) {
    return this.svc.getCourses(token(auth));
  }

  @Get('admin/hierarchy/topics')
  @RequirePermissions('content.manage')
  getTopics(@Query('courseId') courseId: string, @Headers('authorization') auth: string) {
    return this.svc.getTopics(courseId ? Number(courseId) : undefined, token(auth));
  }

  @Get('admin/hierarchy/subtopics')
  @RequirePermissions('content.manage')
  getSubtopics(@Query('topicId') topicId: string, @Headers('authorization') auth: string) {
    return this.svc.getSubtopics(topicId ? Number(topicId) : undefined, token(auth));
  }

  @Get('admin/:id')
  @RequirePermissions('content.manage')
  adminFindOne(@Param('id', ParseIntPipe) id: number, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.adminFindOne(id, token(auth), engine(engineKey, this.svc));
  }

  @Patch('admin/:id')
  @RequirePermissions('content.manage')
  adminUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.adminUpdate(id, dto, token(auth), engine(engineKey, this.svc));
  }

  @Delete('admin/:id')
  @RequirePermissions('content.manage')
  adminRemove(@Param('id', ParseIntPipe) id: number, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.adminRemove(id, token(auth), engine(engineKey, this.svc));
  }

  // ── Student read-only routes ──────────────────────────────
  @Get()
  studentList(@Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.studentList(token(auth), engine(engineKey, this.svc));
  }

  @Get('student/lesson/:lessonId')
  async studentFindByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Query('engine') engineKey: string,
    @Headers('authorization') auth: string,
    @Headers('if-none-match') ifNoneMatch: string,
    @Res() res: CacheableResponse,
  ) {
    const eng = engine(engineKey, this.svc);
    const result = await this.svc.studentFindByLesson(lessonId, token(auth), eng);
    this.sendNote(res, ifNoneMatch, `lesson:${lessonId}:${eng}`, result);
  }

  @Get(':id/flashcards')
  studentFlashcards(@Param('id', ParseIntPipe) id: number, @Query('engine') engineKey: string, @Headers('authorization') auth: string) {
    return this.svc.studentFlashcards(id, token(auth), engine(engineKey, this.svc));
  }

  @Get(':id')
  async studentFindOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('engine') engineKey: string,
    @Headers('authorization') auth: string,
    @Headers('if-none-match') ifNoneMatch: string,
    @Res() res: CacheableResponse,
  ) {
    const eng = engine(engineKey, this.svc);
    const result = await this.svc.studentFindOne(id, token(auth), eng);
    this.sendNote(res, ifNoneMatch, `note:${id}:${eng}`, result);
  }

  // Conditional-request support for the two heavy ~900KB lesson reads. A weak
  // ETag derived from the note's updatedAt + flashcard count + the viewer's
  // progress lets an unchanged lesson return a tiny 304 instead of the full
  // canvas. Cache-Control: private keeps it out of shared proxies/CDNs.
  private sendNote(
    res: CacheableResponse,
    ifNoneMatch: string | undefined,
    seed: string,
    result: { updatedAt?: unknown; approvedFlashcardCount?: unknown; lessonProgressPercent?: unknown; lessonProgressStatus?: unknown },
  ) {
    const etag = 'W/"' + createHash('sha1')
      .update(`${seed}:${result?.updatedAt ?? ''}:${result?.approvedFlashcardCount ?? ''}:${result?.lessonProgressPercent ?? ''}:${result?.lessonProgressStatus ?? ''}`)
      .digest('base64url') + '"';
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.json(result);
  }
}
