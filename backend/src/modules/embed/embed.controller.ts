import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'crypto';

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
const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path fill="currentColor" d="M12 5V2L7 6l5 4V7a5.5 5.5 0 1 1-5.5 5.5H4.5'
  + 'A7.5 7.5 0 1 0 12 5z"/></svg>';
const FWD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path fill="currentColor" d="M12 5V2l5 4-5 4V7a5.5 5.5 0 1 0 5.5 5.5h2'
  + 'A7.5 7.5 0 1 1 12 5z"/></svg>';
const FULL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path fill="currentColor" d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM4 15h2v3h3v2H4zm14 0h2v5h-5v-2h3z"/></svg>';
const EXIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path fill="currentColor" d="M9 4v5H4V7h3V4zm6 0h2v3h3v2h-5zM4 15h5v5H7v-3H4zm11 2v3h-2v-5h5v2z"/></svg>';
const COVER_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">'
  + '<path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>';

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
    // still interpolated into the page, and the validation and the
    // interpolation are far enough apart in a file's lifetime that leaning on
    // it alone is how an injection arrives later.
    const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');

    const script = this.script(safeId);
    // The inline script is allowed by its own hash rather than by
    // 'unsafe-inline', so the policy permits exactly this script and nothing
    // an injection could add. Computed from the text we are about to send, so
    // it cannot drift out of sync with it.
    const hash = createHash('sha256').update(script, 'utf8').digest('base64');

    this.harden(res, `'sha256-${hash}'`);
    res.end(this.page(script));
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
   */
  private harden(res: Response, scriptHash: string) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        // youtube.com serves the IFrame API, which in turn pulls the widget
        // API from the same origin. Our own script is named by its hash.
        `script-src https://www.youtube.com ${scriptHash}`,
        "style-src 'unsafe-inline'",
        'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Not cached. This page is a couple of kilobytes, and a CDN holding a
    // stale copy of a media route has already cost this project a debugging
    // session once (the auscultation clip that would not play).
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
  }

  /**
   * The player, driven through YouTube's IFrame API so the lesson keeps its
   * own controls instead of YouTube's.
   *
   * `controls: 0` removes YouTube's control bar, and with it the share button,
   * the title link and the channel avatar — every affordance that hands a
   * student the video's URL. The bar below is ours.
   *
   * The shield over the player is what makes that stick. The iframe is a
   * different origin, so we cannot suppress a context menu inside it or reach
   * its DOM; what we CAN do is make sure pointer events never arrive there.
   * The shield swallows right-click, long-press and stray taps, and forwards
   * a plain tap to play/pause. Without it, right-clicking the picture still
   * offers "Copy video URL".
   *
   * Honest limits: this defeats casual sharing, which is what it is for. It is
   * not DRM. Anyone who can reach the network traffic can still find the id.
   */
  private script(videoId: string) {
    return `
var player, ready = false, timer = null, hideAt = null, seeking = false;
var SKIP = 10, IDLE = 3000;
function el(id) { return document.getElementById(id); }

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    videoId: '${videoId}',
    playerVars: {
      controls: 0, disablekb: 1, rel: 0, fs: 0, playsinline: 1,
      iv_load_policy: 3, modestbranding: 1
    },
    events: { onReady: onReady, onStateChange: onState }
  });
}

function onReady() {
  ready = true;
  el('stage').classList.add('ready');
  el('total').textContent = clock(player.getDuration());
}

function onState(e) {
  var playing = e.data === YT.PlayerState.PLAYING;
  // Before the first frame and after the last, YouTube draws its own poster
  // and end screen — both carry a share button and a link out. The cover hides
  // those two moments; in between, the picture is all there is to see.
  if (playing) el('stage').classList.add('started');
  if (e.data === YT.PlayerState.ENDED) el('stage').classList.remove('started');

  el('big').innerHTML = playing ? PAUSE : PLAY;
  el('big').setAttribute('aria-label', playing ? 'Pause' : 'Play');

  if (playing && !timer) timer = setInterval(tick, 250);
  if (!playing && timer) { clearInterval(timer); timer = null; tick(); }
  // Paused is a deliberate stop — leave the controls up. Playing hides them
  // so nothing sits over the picture while it's being watched.
  if (playing) idle(); else show(true);
}

function clock(s) {
  if (!isFinite(s) || s < 0) s = 0;
  var m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function tick() {
  if (!ready) return;
  var at = player.getCurrentTime() || 0, of = player.getDuration() || 0;
  el('at').textContent = clock(at);
  el('total').textContent = clock(of);
  if (!seeking && of > 0) el('seek').value = String((at / of) * 1000);
}

function playing() {
  return ready && player.getPlayerState() === YT.PlayerState.PLAYING;
}

function toggle() {
  if (!ready) return;
  if (playing()) player.pauseVideo(); else player.playVideo();
}

/** Show the controls; while playing, start the countdown to hiding again. */
function show(stay) {
  el('stage').classList.add('ui');
  if (hideAt) { clearTimeout(hideAt); hideAt = null; }
  if (!stay) idle();
}
function hide() {
  el('stage').classList.remove('ui');
  if (hideAt) { clearTimeout(hideAt); hideAt = null; }
}
function idle() {
  if (hideAt) clearTimeout(hideAt);
  hideAt = setTimeout(function () { if (playing()) hide(); }, IDLE);
}

/**
 * Fullscreen, by whichever route this page is being viewed through.
 *
 * Inside the app, iOS only grants the Fullscreen API to a <video> element —
 * never to a div — so calling requestFullscreen() on the stage does nothing on
 * an iPhone. The app can resize the sheet itself, though, so the button hands
 * the decision to Flutter over a channel and Flutter calls setFs() back to keep
 * the icon honest. On the web, where the API does work on any element, it is
 * used directly.
 */
function fullscreen() {
  show();
  if (window.Fullscreen && window.Fullscreen.postMessage) {
    window.Fullscreen.postMessage('toggle');
    return;
  }
  var st = el('stage');
  if (document.fullscreenElement) {
    document.exitFullscreen();
    setFs(false);
  } else if (st.requestFullscreen) {
    st.requestFullscreen();
    setFs(true);
  }
}

/**
 * Stop playback from outside the page.
 *
 * The app plays this page inline in a station slot as well as in the lesson
 * sheet, and leaving that screen does not dispose the widget — without a way
 * to reach in and pause, the clip keeps sounding behind whatever comes next.
 */
window.pauseVideo = function () {
  try { if (player && player.pauseVideo) player.pauseVideo(); } catch (e) {}
};

/** Called by the app once it has actually resized, so the icon can't lie. */
function setFs(on) {
  el('stage').classList.toggle('fs', !!on);
  el('full').innerHTML = on ? EXIT : FULL;
  el('full').setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
}
window.setFs = setFs;

function skip(by) {
  if (!ready) return;
  var of = player.getDuration() || 0;
  var to = (player.getCurrentTime() || 0) + by;
  player.seekTo(Math.max(0, Math.min(of, to)), true);
  tick();
  show();
}

var FULL = '${FULL_ICON.replace(/'/g, "\\'")}';
var EXIT = '${EXIT_ICON.replace(/'/g, "\\'")}';
var PLAY = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">'
  + '<path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>';
var PAUSE = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">'
  + '<path fill="currentColor" d="M7 5h3.2v14H7zm6.8 0H17v14h-3.2z"/></svg>';

function wire() {
  el('big').innerHTML = PLAY;
  el('cover').addEventListener('click', function () { toggle(); show(); });

  // A tap on the picture is about the controls, not playback: it shows them,
  // or puts them away if they're already up. Play/pause is the button's job
  // alone, so a mis-tap while watching can't stop the video.
  el('shield').addEventListener('click', function () {
    if (el('stage').classList.contains('ui')) hide(); else show();
  });
  el('shield').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  el('big').addEventListener('click', function () { toggle(); show(); });
  el('back').addEventListener('click', function () { skip(-SKIP); });
  el('fwd').addEventListener('click', function () { skip(SKIP); });
  el('full').innerHTML = FULL;
  el('full').addEventListener('click', fullscreen);

  var seek = el('seek');
  seek.addEventListener('input', function () { seeking = true; show(true); });
  seek.addEventListener('change', function () {
    seeking = false;
    if (ready) {
      var of = player.getDuration() || 0;
      if (of > 0) player.seekTo((Number(seek.value) / 1000) * of, true);
    }
    show();
  });

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // A black page is worse than a visible share button. If the API never
  // arrives — blocked script, dead connection — fall back to the ordinary
  // embed so the lesson is still watchable.
  setTimeout(function () {
    if (ready) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0';
    f.allow = 'accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture';
    f.setAttribute('allowfullscreen', '');
    el('stage').className = 'fallback';
    el('stage').innerHTML = '';
    el('stage').appendChild(f);
  }, 10000);
}
wire();
`;
  }

  /** Full-bleed black page: the player, the shield, and our own controls. */
  private page(script: string) {
    return '<!DOCTYPE html>'
      + '<html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      + '<title>Video</title>'
      + '<style>'
      + 'html,body{margin:0;height:100%;background:#000;overflow:hidden}'
      // Nothing on this page is selectable or long-pressable: an iOS
      // long-press on a video otherwise offers its own save/copy sheet.
      + '*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;'
      + '-webkit-tap-highlight-color:transparent}'
      + 'button{border:0;background:none;color:#fff;cursor:pointer;padding:0;'
      + 'font:inherit;display:flex;align-items:center;justify-content:center}'
      + '#stage{position:absolute;inset:0;background:#000}'
      // YouTube's title bar, channel name and watermark cannot be turned off —
      // `modestbranding` was deprecated in 2023 and `controls:0` does not
      // remove them. They anchor to the PLAYER's edges, though, not the
      // picture's. So the iframe is made three times the container's height
      // and pulled up by one: YouTube letterboxes the video to the width,
      // which centres the picture exactly over the container, while the
      // overlays sit in the dead bands above and below, out of sight.
      + '#player,#stage iframe{position:absolute;left:0;width:100%;'
      + 'height:300%;top:-100%;border:0}'
      // The fallback embed keeps YouTube's own controls, so it must not be cropped.
      + '#stage.fallback iframe{height:100%;top:0}'
      // Above the iframe, below the controls. This is the piece that keeps
      // pointer events away from YouTube's own UI.
      + '#shield{position:absolute;inset:0;z-index:2}'
      // The control layer itself is transparent to taps — only its buttons
      // take them — so tapping the picture still reaches the shield.
      + '#ui{position:absolute;inset:0;z-index:3;pointer-events:none;'
      + 'opacity:0;transition:opacity .18s}'
      + '#stage.ready.ui #ui{opacity:1}'
      + '#ui button,#ui input{pointer-events:auto}'
      + '#stage:not(.ui) #ui button,#stage:not(.ui) #ui input{pointer-events:none}'
      + '#big{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'width:84px;height:84px;border-radius:50%;background:#0c0d11;'
      + 'box-shadow:0 2px 14px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.14) inset}'
      + '#big svg{width:30px;height:30px}'
      + '#bar{position:absolute;left:0;right:0;bottom:0;display:flex;'
      + 'align-items:center;gap:12px;padding:12px 14px;'
      + 'background:linear-gradient(transparent,rgba(0,0,0,.78));'
      + 'font:500 12px/1 -apple-system,system-ui,sans-serif;color:#fff}'
      + '.skip{flex:0 0 auto;gap:2px;font-size:11px;font-weight:700;opacity:.92}'
      + '.skip svg{width:19px;height:19px}'
      + '#seek{flex:1;-webkit-appearance:none;appearance:none;height:3px;'
      + 'border-radius:2px;background:rgba(255,255,255,.3);cursor:pointer}'
      + '#seek::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;'
      + 'border-radius:50%;background:#fff}'
      + '#time{flex:0 0 auto;font-variant-numeric:tabular-nums;opacity:.85}'
      + '#cover{position:absolute;inset:0;z-index:4;background:#000;display:flex;'
      + 'align-items:center;justify-content:center;cursor:pointer}'
      + '#stage.started #cover,#stage.fallback #cover{display:none}'
      + '#coverplay{width:62px;height:62px;border-radius:50%;color:#fff;'
      + 'background:rgba(255,255,255,.16);display:flex;align-items:center;'
      + 'justify-content:center}'
      + '</style></head><body>'
      + '<div id="stage" class="ui">'
      + '<div id="player"></div>'
      + '<div id="shield"></div>'
      + '<div id="ui">'
      + '<button id="big" type="button" aria-label="Play"></button>'
      + '<div id="bar">'
      + '<button id="back" class="skip" type="button" aria-label="Back 10 seconds">'
      + BACK_ICON + '<span>10</span></button>'
      + '<input id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">'
      + '<button id="fwd" class="skip" type="button" aria-label="Forward 10 seconds">'
      + '<span>10</span>' + FWD_ICON + '</button>'
      + '<span id="time"><span id="at">0:00</span> / <span id="total">0:00</span></span>'
      + '<button id="full" class="skip" type="button" aria-label="Full screen"></button>'
      + '</div></div>'
      + '<div id="cover"><span id="coverplay">' + COVER_ICON + '</span></div>'
      + '</div>'
      + '<script src="https://www.youtube.com/iframe_api"></script>'
      + `<script>${script}</script>`
      + '</body></html>';
  }
}
