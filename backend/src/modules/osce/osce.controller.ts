import {
  BadRequestException, Controller, Get, Headers, NotFoundException, Param,
  ParseIntPipe, Put, Body, Query, Req, Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { stat } from 'fs/promises';
import { join, resolve } from 'path';
import { AuthService } from '../auth/auth.service';
import { OsceService } from './osce.service';

const MEDIA_MIME: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  // A slot can hold a clip instead of a still.
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
};

@Controller('osce')
export class OsceController {
  constructor(
    private readonly svc: OsceService,
    private readonly authService: AuthService,
  ) {}

  /** Absolute base for media URLs — configured origin wins, else the request's. */
  /**
   * Absolute base for media URLs.
   *
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

  /** Step 1 of the drill-down: courses that have published stations. */
  @Get('courses')
  async courses(@Headers('authorization') auth?: string) {
    const user = await this.authService.requireStudent(auth);
    return { courses: await this.svc.listStudentCourses(Number((user as any).id)) };
  }

  /**
   * Stations grouped by body region — the body-map way in, as an alternative to
   * course → subject → station.
   */
  @Get('regions')
  async regions(@Req() req: Request, @Headers('authorization') auth?: string) {
    const user = await this.authService.requireStudent(auth);
    return {
      regions: await this.svc.listRegions(this.baseUrl(req), Number((user as any).id)),
    };
  }

  @Get('systems')
  async systems(
    @Query('course') courseId?: string,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.authService.requireStudent(auth);
    return {
      systems: await this.svc.listCategories({
        courseId: courseId ? Number(courseId) : undefined,
        publishedOnly: true,
        userId: Number((user as any).id),
      }),
    };
  }

  @Get('cases')
  async cases(
    @Req() req: Request,
    @Query('system') system?: string,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.authService.requireStudent(auth);
    return {
      cases: await this.svc.listCases({
        categoryId: system ? Number(system) : undefined,
        publishedOnly: true,
        userId: Number((user as any).id),
        baseUrl: this.baseUrl(req),
      }),
    };
  }

  @Get('cases/:slug')
  async caseBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.authService.requireStudent(auth);
    const found = await this.svc.hydrateCase(
      slug, this.baseUrl(req), true, Number((user as any).id));
    if (!found) throw new NotFoundException('Case not found');
    return found;
  }

  @Get('progress')
  async progress(@Headers('authorization') auth?: string) {
    const user = await this.authService.requireStudent(auth);
    return { progress: await this.svc.getProgress(Number((user as any).id)) };
  }

  @Put('progress/:caseId')
  async saveProgress(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: {
      checklist?: Record<string, boolean>; seen?: string[]; completed?: boolean;
      favourite?: boolean;
    },
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.authService.requireStudent(auth);
    return this.svc.saveProgress(Number((user as any).id), caseId, body || {});
  }

  /** ECG images are stored as base64 data URIs — decode and stream as a real image. */
  @Get('ecg/:cardId/image')
  async ecgImage(@Param('cardId', ParseIntPipe) cardId: number, @Res() res: Response) {
    const found = await this.svc.ecgImageBytes(cardId);
    if (!found) throw new NotFoundException('ECG image not found');
    res.setHeader('Content-Type', found.mime);
    res.setHeader('Content-Length', String(found.buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(found.buffer);
  }

  /**
   * An auscultation clip, served the same public cacheable way as the ECG image
   * above — a teaching sound, not user data. This exists so the admin reference
   * picker can audition a clip before linking it: the library's own audio route
   * is student-only, and an <audio> tag carries no bearer token.
   */
  @Get('sound/:cardId/audio')
  async soundAudio(@Param('cardId', ParseIntPipe) cardId: number, @Res() res: Response) {
    const found = await this.svc.auscultationAudioBytes(cardId);
    if (!found) throw new NotFoundException('Sound not found');
    res.setHeader('Content-Type', found.mime);
    res.setHeader('Content-Length', String(found.buffer.length));
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(found.buffer);
  }

  /**
   * Case media. Public like the other cacheable image mounts — these are
   * teaching illustrations, not user data, and immutable caching is the whole
   * point. `?v=` from updated_at busts the cache when a slot is refilled.
   */
  @Get('media/:caseSlug/:fileName')
  async media(
    @Param('caseSlug') caseSlug: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    // `_global` is the reserved folder for the shared long-case art.
    if (!/^[A-Za-z0-9._-]{1,200}$/.test(caseSlug)) throw new BadRequestException('Invalid case');
    if (!/^[A-Za-z0-9._@-]+\.(?:webp|jpe?g|png|mp4|webm|mov|ogv)$/i.test(fileName)) {
      throw new BadRequestException('Invalid media file name');
    }

    const root = resolve(process.cwd(), 'uploads', 'osce');
    const filePath = resolve(join(root, caseSlug, fileName));
    if (!filePath.startsWith(`${root}/`)) throw new BadRequestException('Invalid media path');

    const stats = await stat(filePath).catch(() => null);
    if (!stats?.isFile()) throw new NotFoundException('Media not found');

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    res.setHeader('Content-Type', MEDIA_MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Content-Length is left to sendFile, which also answers Range requests.
    // Setting it here would fight the 206 partial responses a <video> element
    // relies on to seek, so a clip could only be played straight through.
    res.sendFile(filePath);
  }
}
