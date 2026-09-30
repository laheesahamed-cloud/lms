"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EmbedController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbedController = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
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
let EmbedController = EmbedController_1 = class EmbedController {
    youtube(id, res) {
        if (!EmbedController_1.YOUTUBE_ID.test(String(id || ''))) {
            throw new common_1.BadRequestException('Invalid video id');
        }
        const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');
        const script = this.script(safeId);
        const hash = (0, crypto_1.createHash)('sha256').update(script, 'utf8').digest('base64');
        this.harden(res, `'sha256-${hash}'`);
        res.end(this.page(script));
    }
    harden(res, scriptHash) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy', [
            "default-src 'none'",
            `script-src https://www.youtube.com ${scriptHash}`,
            "style-src 'unsafe-inline'",
            'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
            "base-uri 'none'",
            "form-action 'none'",
        ].join('; '));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Frame-Options', 'DENY');
    }
    script(videoId) {
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
    page(script) {
        return '<!DOCTYPE html>'
            + '<html lang="en"><head><meta charset="utf-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            + '<title>Video</title>'
            + '<style>'
            + 'html,body{margin:0;height:100%;background:#000;overflow:hidden}'
            + '*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;'
            + '-webkit-tap-highlight-color:transparent}'
            + 'button{border:0;background:none;color:#fff;cursor:pointer;padding:0;'
            + 'font:inherit;display:flex;align-items:center;justify-content:center}'
            + '#stage{position:absolute;inset:0;background:#000}'
            + '#player,#stage iframe{position:absolute;left:0;width:100%;'
            + 'height:300%;top:-100%;border:0}'
            + '#stage.fallback iframe{height:100%;top:0}'
            + '#shield{position:absolute;inset:0;z-index:2}'
            + '#ui{position:absolute;inset:0;z-index:3;pointer-events:none;'
            + 'opacity:0;transition:opacity .18s}'
            + '#stage.ready.ui #ui{opacity:1}'
            + '#ui button,#ui input{pointer-events:auto}'
            + '#stage:not(.ui) #ui button,#stage:not(.ui) #ui input{pointer-events:none}'
            + '#big{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
            + 'width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.45);'
            + 'backdrop-filter:blur(2px)}'
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
};
exports.EmbedController = EmbedController;
EmbedController.YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
__decorate([
    (0, common_1.Get)('youtube'),
    __param(0, (0, common_1.Query)('v')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EmbedController.prototype, "youtube", null);
exports.EmbedController = EmbedController = EmbedController_1 = __decorate([
    (0, common_1.Controller)('embed')
], EmbedController);
//# sourceMappingURL=embed.controller.js.map