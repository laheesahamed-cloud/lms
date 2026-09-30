import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

/**
 * A real, served page whose only job is to hold a provider's video iframe.
 *
 * YouTube authorises an embed by its referrer, and there are exactly two ways
 * to get that wrong, both of which this project shipped:
 *
 *  - Build the page in memory (`loadHtmlString`, as youtube_player_iframe
 *    does). The document has no URL, so no matter what `origin` claims, there
 *    is nothing for YouTube to verify. Claiming to be youtube.com is a spoof
 *    and comes back as error 152-4; claiming our own domain is honest but
 *    unverifiable, and comes back as a black player.
 *  - Load `youtube.com/embed/<id>` as the top-level document. Now the referrer
 *    isn't wrong, it's *absent* — there is no parent page to be referred from —
 *    which is error 153, "video player configuration error".
 *
 * Both failures are the same failure: an iframe needs a page around it. So we
 * serve that page. The app navigates here for real, this page frames YouTube,
 * and the iframe request carries `Referer: https://<our host>/api/embed/...`
 * — an ordinary third-party embed with an honest referrer, which is the only
 * arrangement YouTube supports and the only one we want. Nothing here forges a
 * header or works around a check; it supplies what the check asks for.
 */
@Controller('embed')
export class EmbedController {
  /** YouTube ids are exactly 11 url-safe base64 characters. */
  private static readonly YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

  @Get('youtube')
  youtube(@Query('v') id: string, @Res() res: Response) {
    if (!EmbedController.YOUTUBE_ID.test(String(id || ''))) {
      throw new BadRequestException('Invalid video id');
    }
    // `?v=` is validated above, so it cannot carry markup — but the id is
    // still interpolated into a URL inside an attribute, and the validation
    // and the interpolation are far enough apart in a file's lifetime that
    // leaning on it alone is how an injection arrives later.
    const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');

    this.harden(res);
    res.end(this.page(
      `https://www.youtube.com/embed/${safeId}`
        + '?playsinline=1&rel=0&modestbranding=1&iv_load_policy=3',
    ));
  }

  /**
   * The headers this page needs, several of which fight a global default.
   *
   * Two of these are the whole point, and removing either silently breaks
   * playback with no error in our own logs:
   *
   *  - `Referrer-Policy`. The app sets `no-referrer` globally, which is right
   *    for every other route and fatal here: it strips the one header YouTube
   *    authorises the embed by, putting us straight back to error 153.
   *    `strict-origin-when-cross-origin` sends the origin and nothing else —
   *    YouTube learns which site is embedding, never which lesson.
   *  - `frame-src`. The global policy is `'self'`, which blocks the iframe
   *    outright. This page's own policy names YouTube and nothing else.
   *
   * The rest is a deliberately tiny surface: no scripts (`default-src 'none'`
   * with no `script-src`), so there is nothing to inject into, and the id has
   * already been validated down to 11 characters.
   */
  private harden(res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Not cached. This page is under a kilobyte, and a CDN holding a stale
    // copy of a media route has already cost this project a debugging session
    // once (the auscultation clip that would not play).
    res.setHeader('Cache-Control', 'no-store');
    // The global default is DENY, which is correct: nothing should frame this.
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'DENY');
  }

  /** Full-bleed black page holding one iframe, sized by the app's own box. */
  private page(src: string) {
    return '<!DOCTYPE html>'
      + '<html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      + '<title>Video</title>'
      + '<style>'
      + 'html,body{margin:0;height:100%;background:#000;overflow:hidden}'
      + 'iframe{display:block;border:0;width:100%;height:100%}'
      + '</style></head><body>'
      + `<iframe src="${src}" title="Video"`
      + ' allow="accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture"'
      + ' allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>'
      + '</body></html>';
  }
}
