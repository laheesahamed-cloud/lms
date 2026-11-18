import { Controller, Get, Headers, Inject, Query, Res } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { getScopeRows } from '../../common/auth/subscription-scope';
import { buildContentAccess, ScopeRowLike } from '../../common/auth/content-access';
import { AuthService } from '../auth/auth.service';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { CATALOGUE_FORMAT, StudentCatalogueService, progressOptions } from './student-catalogue.service';

/**
 * The lists every student screen is built from (OPTIMIZE 10, step 5):
 *
 *  GET /student/catalogue  the shared catalogue for the current version,
 *                          gzipped once on the server. The phone sends the
 *                          version it holds (If-None-Match); same version =
 *                          304 and no body. 0 database rows.
 *  GET /student/progress   this student's own state, read by their user id:
 *                          plan access (from the signed token, no SQL),
 *                          lesson progress rows and quiz progress rows (only
 *                          what they actually used).
 *
 * Locks are worked out on the phone from `access` with the same rules as the
 * server (free, or full access, or the course / lesson in the plan); opening a
 * lesson or quiz is still checked on the server.
 */
@Controller('catalogue')
export class StudentCatalogueController {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly catalogue: StudentCatalogueService,
    private readonly studyStats: StudyStatsService,
  ) {}

  @Get('student')
  async student(
    @Headers('authorization') authorization: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('accept-encoding') acceptEncoding: string | undefined,
    @Res() res: any,
  ) {
    await this.authService.requireStudent(authorization);
    const current = await this.catalogue.get();
    const etag = `"catalogue-v${current.v}-f${CATALOGUE_FORMAT}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Catalogue-Version', String(current.v));
    res.setHeader('X-Catalogue-Format', String(CATALOGUE_FORMAT));
    if (ifNoneMatch && ifNoneMatch.split(',').map((t) => t.trim()).includes(etag)) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (/\bgzip\b/i.test(String(acceptEncoding || ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.status(200).end(current.gzip);
      return;
    }
    res.status(200).end(current.json);
  }

  /** Two-level catalogue: the index (courses + one fingerprint per course part). */
  @Get('student/index')
  async index(
    @Headers('authorization') authorization: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('accept-encoding') acceptEncoding: string | undefined,
    @Res() res: any,
  ) {
    await this.authService.requireStudent(authorization);
    const current = await this.catalogue.get();
    const etag = `"catalogue-index-v${current.v}-f${CATALOGUE_FORMAT}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Catalogue-Version', String(current.v));
    res.setHeader('X-Catalogue-Format', String(CATALOGUE_FORMAT));
    if (ifNoneMatch && ifNoneMatch.split(',').map((t) => t.trim()).includes(etag)) {
      res.status(304).end();
      return;
    }
    this.send(res, current.index.json, current.index.gzip, acceptEncoding);
  }

  /** Two-level catalogue: the parts of the given courses (only those that changed). */
  @Get('student/parts')
  async parts(
    @Headers('authorization') authorization: string | undefined,
    @Query('courses') courses: string | undefined,
    @Headers('accept-encoding') acceptEncoding: string | undefined,
    @Res() res: any,
    @Query('kind') kind?: string,
  ) {
    await this.authService.requireStudent(authorization);
    const ids = String(courses || '').split(',').map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
    const reply = await this.catalogue.partsFor(ids, kind);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Catalogue-Version', String(reply.v));
    this.send(res, reply.json, reply.gzip, acceptEncoding);
  }

  private send(res: any, json: string, gzip: Buffer, acceptEncoding?: string) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (/\bgzip\b/i.test(String(acceptEncoding || ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.status(200).end(gzip);
      return;
    }
    res.status(200).end(json);
  }

  @Get('student/progress')
  async progress(
    @Headers('authorization') authorization?: string,
    @Query('format') format?: string,
    @Query('v') version?: string,
  ) {
    const user = await this.authService.requireStudent(authorization);
    return this.catalogue.progressFor(Number(user.id), this.studyStats, progressOptions(format, version));
  }
}
