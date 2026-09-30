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
var player, ready = false, timer = null;
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
  el('play').textContent = playing ? '❚❚' : '►';
  el('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if (playing && !timer) timer = setInterval(tick, 250);
  if (!playing && timer) { clearInterval(timer); timer = null; tick(); }
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

function toggle() {
  if (!ready) return;
  var s = player.getPlayerState();
  if (s === YT.PlayerState.PLAYING) player.pauseVideo(); else player.playVideo();
}

var seeking = false;
function wire() {
  el('cover').addEventListener('click', toggle);
  var shield = el('shield');
  // The point of the shield: nothing reaches YouTube's iframe.
  shield.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  shield.addEventListener('click', toggle);
  el('play').addEventListener('click', toggle);

  var seek = el('seek');
  seek.addEventListener('input', function () { seeking = true; });
  seek.addEventListener('change', function () {
    seeking = false;
    if (!ready) return;
    var of = player.getDuration() || 0;
    if (of > 0) player.seekTo((Number(seek.value) / 1000) * of, true);
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
            + '#stage{position:absolute;inset:0;background:#000}'
            + '#player,#stage iframe{position:absolute;left:0;width:100%;'
            + 'height:300%;top:-100%;border:0}'
            + '#stage.fallback iframe{height:100%;top:0}'
            + '#shield{position:absolute;inset:0;z-index:2}'
            + '#bar{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;'
            + 'align-items:center;gap:10px;padding:10px 12px;'
            + 'background:linear-gradient(transparent,rgba(0,0,0,.75));'
            + 'font:500 12px/1 -apple-system,system-ui,sans-serif;color:#fff;'
            + 'opacity:0;transition:opacity .2s}'
            + '#stage.ready #bar{opacity:1}'
            + '#cover{position:absolute;inset:0;z-index:4;background:#000;display:flex;'
            + 'align-items:center;justify-content:center;cursor:pointer}'
            + '#stage.started #cover,#stage.fallback #cover{display:none}'
            + '#coverplay{width:62px;height:62px;border-radius:50%;color:#fff;font-size:22px;'
            + 'background:rgba(255,255,255,.16);display:flex;align-items:center;'
            + 'justify-content:center;padding-left:4px}'
            + '#stage.fallback #bar,#stage.fallback #shield{display:none}'
            + '#play{width:32px;height:32px;flex:0 0 auto;border:0;border-radius:50%;'
            + 'background:rgba(255,255,255,.15);color:#fff;font-size:13px;cursor:pointer}'
            + '#seek{flex:1;-webkit-appearance:none;appearance:none;height:3px;'
            + 'border-radius:2px;background:rgba(255,255,255,.3);cursor:pointer}'
            + '#seek::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;'
            + 'border-radius:50%;background:#fff}'
            + '#time{flex:0 0 auto;font-variant-numeric:tabular-nums;opacity:.85}'
            + '</style></head><body>'
            + '<div id="stage">'
            + '<div id="player"></div>'
            + '<div id="shield"></div>'
            + '<div id="cover"><span id="coverplay">&#9658;</span></div>'
            + '<div id="bar">'
            + '<button id="play" type="button" aria-label="Play">&#9658;</button>'
            + '<input id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">'
            + '<span id="time"><span id="at">0:00</span> / <span id="total">0:00</span></span>'
            + '</div></div>'
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