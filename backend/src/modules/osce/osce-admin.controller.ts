import {
  BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe,
  Post, Put, Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { OsceService, CaseDocument } from './osce.service';
import { OsceGeneratorService } from './osce-generator.service';
import { SmartNotesImageApiService } from '../smart-notes/smart-notes-image-api.service';

@Controller('admin/osce')
export class OsceAdminController {
  constructor(
    private readonly svc: OsceService,
    private readonly generator: OsceGeneratorService,
    private readonly imageApi: SmartNotesImageApiService,
    private readonly authService: AuthService,
  ) {}

  /**
   * The request's own host wins over any configured origin: it reflects how the
   * client actually reached us, so a phone on the LAN gets LAN URLs. Preferring
   * a configured value here silently hands out `localhost` links that resolve to
   * the device itself. The env var stays as a fallback for when the Host header
   * can't be trusted (some proxy setups).
   */
  private baseUrl(req: Request) {
    const host = req.get('host');
    if (host) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      return `${proto}://${host}`;
    }
    return String(process.env.API_PUBLIC_URL || process.env.APP_PUBLIC_URL || '')
      .trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }

  /* ─────────────────────── systems ─────────────────────────── */

  /** OSCE's own categories, plus the courses they hang under. */
  @Get('systems')
  @RequirePermissions('content.manage')
  async systems(@Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return {
      systems: await this.svc.listCategories(),
      courses: await this.svc.listCourses(),
    };
  }

  @Post('categories')
  @RequirePermissions('content.manage')
  async createCategory(
    @Body() body: { courseId: number; name: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.createCategory(Number(body?.courseId), body?.name || '');
  }

  @Put('categories/:id')
  @RequirePermissions('content.manage')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; isActive?: boolean },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.updateCategory(id, body || {});
  }

  @Delete('categories/:id')
  @RequirePermissions('content.manage')
  async deleteCategory(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return this.svc.deleteCategory(id);
  }

  /** Explicit ordering — the point is that OSCE doesn't inherit one. */
  @Put('categories-order')
  @RequirePermissions('content.manage')
  async reorderCategories(
    @Body() body: { ids: number[] },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.reorderCategories(body?.ids || []);
  }

  @Put('cases-order')
  @RequirePermissions('content.manage')
  async reorderCases(
    @Body() body: { ids: number[] },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.reorderCases(body?.ids || []);
  }

  /* ──────────────────────── cases ──────────────────────────── */

  @Get('cases')
  @RequirePermissions('content.manage')
  async cases(@Query('system') system?: string, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return { cases: await this.svc.listCases({ categoryId: system ? Number(system) : undefined }) };
  }

  @Get('cases/:id')
  @RequirePermissions('content.manage')
  async caseById(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    const found = await this.svc.getCaseById(id);
    if (!found) throw new BadRequestException('Case not found');
    const shotList = await this.svc.shotList(id);
    return { case: found, shotList };
  }

  @Post('cases')
  @RequirePermissions('content.manage')
  async createCase(
    @Body() body: { categoryId: number; title: string; summary?: string; difficulty?: string; stationType?: 'short' | 'long' },
    @Headers('authorization') auth?: string,
  ) {
    const admin = await this.authService.requireAdmin(auth);
    return this.svc.createCase({ ...body, createdBy: Number((admin as any)?.id) || null });
  }

  /**
   * AI writes the case text and declares the image slots. One call, ~15–30s —
   * no job queue, because nothing here generates images.
   */
  @Post('cases/generate')
  @RequirePermissions('content.manage')
  async generateCase(
    @Body() body: { categoryId: number; title: string; notes?: string; stationType?: 'short' | 'long' },
    @Headers('authorization') auth?: string,
  ) {
    const admin = await this.authService.requireAdmin(auth);
    if (!body?.title?.trim()) throw new BadRequestException('A condition name is required');
    if (!body?.categoryId) throw new BadRequestException('Pick a category first');

    const categoryName = await this.svc.categoryName(Number(body.categoryId));
    const draft = await this.generator.generateCase(
      body.title.trim(), categoryName, body.notes, body.stationType === 'long' ? 'long' : 'short');
    const created = await this.svc.createCase({
      categoryId: Number(body.categoryId),
      stationType: body.stationType === 'long' ? 'long' : 'short',
      title: body.title.trim(),
      summary: draft.summary,
      caseData: draft.document,
      createdBy: Number((admin as any)?.id) || null,
    });
    return { case: created, warnings: draft.warnings };
  }

  @Put('cases/:id')
  @RequirePermissions('content.manage')
  async updateCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      title?: string; summary?: string; difficulty?: string;
      categoryId?: number; caseData?: CaseDocument; isPublic?: boolean; isFree?: boolean;
      stationType?: 'short' | 'long';
    },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.updateCase(id, body || {});
  }

  @Delete('cases/:id')
  @RequirePermissions('content.manage')
  async deleteCase(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return this.svc.deleteCase(id);
  }

  /**
   * The case exactly as the app would receive it — same hydration, but without
   * the published/scope gates so a draft can be checked. Authoring and seeing
   * the result shouldn't need a 60-second app rebuild.
   */
  @Get('cases/:id/preview')
  @RequirePermissions('content.manage')
  async preview(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    const found = await this.svc.getCaseById(id);
    if (!found) throw new BadRequestException('Case not found');
    return this.svc.hydrateCase(found.slug, this.baseUrl(req), false);
  }

  @Get('cases/:id/shot-list')
  @RequirePermissions('content.manage')
  async shotList(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return { shotList: await this.svc.shotList(id) };
  }

  @Post('cases/:id/publish')
  @RequirePermissions('content.manage')
  async publish(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return this.svc.publishCase(id);
  }

  @Post('cases/:id/unpublish')
  @RequirePermissions('content.manage')
  async unpublish(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return this.svc.unpublishCase(id);
  }

  /* ───────────────────────── media ─────────────────────────── */

  /**
   * One slot, one image. The panel optimises to WebP (and makes the @480 thumb)
   * before sending, so the server stores bytes rather than needing `sharp`.
   */
  @Post('cases/:id/media/:slot')
  @RequirePermissions('content.manage')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
  }))
  async uploadSlot(
    @Param('id', ParseIntPipe) id: number,
    @Param('slot') slot: string,
    @UploadedFile() file: any,
    @Body() body: { width?: string; height?: string; thumb?: string; source?: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    if (!file?.buffer) throw new BadRequestException('No file received');

    let thumbBuffer: Buffer | undefined;
    if (body?.thumb) {
      const m = String(body.thumb).match(/^data:[^;,]+;base64,(.+)$/s);
      if (m) thumbBuffer = Buffer.from(m[1], 'base64');
    }

    return this.svc.saveSlotImage(id, slot, file, {
      width: body?.width ? Number(body.width) : undefined,
      height: body?.height ? Number(body.height) : undefined,
      thumbBuffer,
      // A generated image comes back through this same route after the panel
      // optimises it, so it must be able to keep its 'ai' badge.
      source: body?.source === 'ai' ? 'ai' : undefined,
    });
  }

  /**
   * Fill a slot with an AI-generated placeholder so a case can be walked end to
   * end before the real pictures exist. Stored as `source: 'ai'` and badged in
   * the panel — these are stand-ins, not final teaching images.
   */
  @Post('cases/:id/media/:slot/generate')
  @RequirePermissions('content.manage')
  async generateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Param('slot') slot: string,
    @Body() body: { prompt?: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    if (!this.svc.canGenerateSlot(slot)) {
      throw new BadRequestException(
        'ECG, X-ray and echo images cannot be generated — an image model draws what the film '
        + 'looks like with no signal behind it. Link a real ECG or auscultation card instead.'
      );
    }
    const prompt = body?.prompt?.trim() || await this.svc.promptForSlot(id, slot);
    const model = await this.svc.getImageModel();
    const dataUrl = (await this.generator.generateImage(prompt, model))
      || (await this.imageApi.generateIllustration(prompt));
    if (!dataUrl) {
      throw new BadRequestException(
        'The image model returned no picture. Check the Gemini key in Admin → Settings → AI, '
        + 'and that the key has image generation enabled.'
      );
    }
    // Hand the raw image back rather than writing it: the panel runs it through
    // the same WebP optimiser a manual upload uses, then posts it to the upload
    // route with source:'ai'. The backend has no image library, so an image
    // saved here would be a ~1.3 MB PNG — the one path that skipped the resize.
    return { dataUrl, prompt };
  }

  /** The prompt a slot would use, so it can be edited before generating. */
  @Get('cases/:id/media/:slot/prompt')
  @RequirePermissions('content.manage')
  async slotPrompt(
    @Param('id', ParseIntPipe) id: number,
    @Param('slot') slot: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return { prompt: await this.svc.promptForSlot(id, slot) };
  }

  @Delete('cases/:id/media/:slot')
  @RequirePermissions('content.manage')
  async clearSlot(
    @Param('id', ParseIntPipe) id: number,
    @Param('slot') slot: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.clearSlot(id, slot);
  }

  /** Which image model generation uses — swappable so models can be compared. */
  @Get('settings')
  @RequirePermissions('content.manage')
  async getSettings(@Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return { imageModel: await this.svc.getImageModel() };
  }

  @Get('image-models')
  @RequirePermissions('content.manage')
  async imageModels(@Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return {
      models: await this.generator.listImageModels(),
      selected: await this.svc.getImageModel(),
    };
  }

  @Put('settings')
  @RequirePermissions('content.manage')
  async putSettings(
    @Body() body: { imageModel?: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.setImageModel(body?.imageModel || '');
  }

  /**
   * Existing ECG and auscultation content to attach to a case. Linking a real
   * card beats generating a fake one: it's already correct and already reviewed.
   */
  @Get('linkable')
  @RequirePermissions('content.manage')
  async linkable(
    @Req() req: Request,
    @Query('q') q?: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.listLinkableContent(q || '', this.baseUrl(req));
  }

  /** The doctor and patient pictures shared by every long case. */
  @Get('global-media')
  @RequirePermissions('content.manage')
  async globalMedia(@Req() req: Request, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return { cast: await this.svc.globalMedia(this.baseUrl(req)) };
  }

  @Post('global-media/:slot')
  @RequirePermissions('content.manage')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
  }))
  async uploadGlobal(
    @Param('slot') slot: string,
    @UploadedFile() file: any,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    return this.svc.saveGlobalImage(`global:${slot}`, file);
  }

  /** Generate the shared art, so a long case can be walked before real photos. */
  @Post('global-media/:slot/generate')
  @RequirePermissions('content.manage')
  async generateGlobal(
    @Param('slot') slot: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.authService.requireAdmin(auth);
    const who = slot === 'doctor'
      ? 'a friendly doctor in a white coat with a stethoscope, seated, facing the camera'
      : 'a middle-aged patient seated in a clinic chair, calm, facing the camera';
    const prompt = `Clean photographic portrait for a medical teaching app: ${who}. `
      + 'Plain neutral background, even lighting, head and shoulders, warm and approachable. '
      + 'No text, no letters, no labels, no watermarks. Framed 4:3.';

    const model = await this.svc.getImageModel();
    const dataUrl = (await this.generator.generateImage(prompt, model))
      || (await this.imageApi.generateIllustration(prompt));
    if (!dataUrl) throw new BadRequestException('The image model returned nothing.');

    // Returned, not saved — same reason as generateSlot: the panel optimises it
    // and posts it back, so generated art isn't the one uncompressed path.
    return { dataUrl };
  }

  /** Files bulk-dropped into uploads/osce/_inbox via file manager. */
  @Get('inbox')
  @RequirePermissions('content.manage')
  async inbox(@Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    return { files: await this.svc.listInbox() };
  }

  /** Hand the raw bytes to the panel so it can optimise them in the browser. */
  @Get('inbox/:fileName')
  @RequirePermissions('content.manage')
  async inboxFile(@Param('fileName') fileName: string, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    const { buffer } = await this.svc.takeFromInbox(fileName);
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { fileName, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  }

  @Post('inbox/:fileName/archive')
  @RequirePermissions('content.manage')
  async archiveInboxFile(@Param('fileName') fileName: string, @Headers('authorization') auth?: string) {
    await this.authService.requireAdmin(auth);
    await this.svc.archiveInbox(fileName);
    return { archived: true };
  }
}
