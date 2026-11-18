import { Controller, Get, Headers, Param, ParseIntPipe, Res } from '@nestjs/common';
import { AppOnlyContentException } from '../../common/exceptions/app-only-content.exception';
import { SamplesService } from './samples.service';

/**
 * The light website's free samples (OPTIMIZE 10.21), public and cacheable:
 *   GET /samples/index        free lessons, quizzes and decks per course
 *   GET /samples/lesson/:id   one free lesson (canvas)
 *   GET /samples/quiz/:id     one free quiz (questions, answer key, explanations)
 *   GET /samples/deck/:id     one free flashcard deck (by lesson id)
 * No sign-in and no database work: served from memory, with the content
 * version as the ETag (same version = 304, no body).
 */
@Controller('samples')
export class SamplesController {
  constructor(private readonly samples: SamplesService) {}

  @Get('index')
  async index(@Headers('if-none-match') inm: string | undefined, @Headers('accept-encoding') enc: string | undefined, @Res() res: any) {
    const bundle = await this.samples.get();
    this.send(res, bundle.v, 'index', bundle.index, inm, enc);
  }

  @Get('lesson/:id')
  async lesson(@Param('id', ParseIntPipe) id: number, @Headers('if-none-match') inm: string | undefined, @Headers('accept-encoding') enc: string | undefined, @Res() res: any) {
    const bundle = await this.samples.get();
    const body = bundle.lessons.get(id);
    if (!body) throw new AppOnlyContentException();
    this.send(res, bundle.v, `lesson-${id}`, body, inm, enc);
  }

  @Get('quiz/:id')
  async quiz(@Param('id', ParseIntPipe) id: number, @Headers('if-none-match') inm: string | undefined, @Headers('accept-encoding') enc: string | undefined, @Res() res: any) {
    const bundle = await this.samples.get();
    const body = bundle.quizzes.get(id);
    if (!body) throw new AppOnlyContentException();
    this.send(res, bundle.v, `quiz-${id}`, body, inm, enc);
  }

  @Get('deck/:id')
  async deck(@Param('id', ParseIntPipe) id: number, @Headers('if-none-match') inm: string | undefined, @Headers('accept-encoding') enc: string | undefined, @Res() res: any) {
    const bundle = await this.samples.get();
    const body = bundle.decks.get(id);
    if (!body) throw new AppOnlyContentException();
    this.send(res, bundle.v, `deck-${id}`, body, inm, enc);
  }

  private send(res: any, v: number, name: string, body: { json: string; gzip: Buffer }, inm?: string, enc?: string) {
    const etag = `"samples-${name}-v${v}"`;
    res.setHeader('ETag', etag);
    // Public: Cloudflare and the browser may keep it; a publish changes the version.
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (inm && inm.split(',').map((t) => t.trim()).includes(etag)) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (/\bgzip\b/i.test(String(enc || ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.status(200).end(body.gzip);
      return;
    }
    res.status(200).end(body.json);
  }
}
