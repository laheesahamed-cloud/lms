import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import '../../theme/tokens.dart';
import 'video_embed.dart';

class WatchVideoModal extends StatefulWidget {
  final String videoUrl;
  const WatchVideoModal({super.key, required this.videoUrl});

  static Future<void> show(BuildContext context, String videoUrl) =>
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => WatchVideoModal(videoUrl: videoUrl),
      );

  @override
  State<WatchVideoModal> createState() => _WatchVideoModalState();
}

class _WatchVideoModalState extends State<WatchVideoModal> {
  late final VideoEmbed _embed;
  WebViewController? _iframeWvc;
  YoutubePlayerController? _ytc;

  @override
  void initState() {
    super.initState();
    _embed = getVideoEmbed(widget.videoUrl);

    // YouTube → the dedicated IFrame player with YouTube's own controls
    // (showControls: true). We tried hiding these in favor of a fully custom
    // bar, but that made some videos fail to play at all — reverted for
    // reliability.
    //
    // `origin` is deliberately our own real domain, NOT the package's
    // default of 'https://www.youtube.com'. Per Google's own docs, `origin`
    // is "an extra security measure... specify your domain as the value" —
    // claiming to *be* youtube.com is self-referential nonsense that a
    // legitimate third-party embed should never send, and YouTube appears to
    // have started rejecting it more often recently (the "error 150/152/153"
    // reports across many apps in late 2025 — see
    // https://github.com/sarbagyastha/youtube_player_flutter/issues/1084 —
    // point at YouTube tightening origin/referrer validation for embeds).
    if (_embed.provider == 'youtube') {
      final id = _youtubeId(_embed.src);
      if (id != null && id.isNotEmpty) {
        _ytc = YoutubePlayerController.fromVideoId(
          videoId: id,
          autoPlay: false,
          params: const YoutubePlayerParams(
            origin: 'https://xyndrome.lk',
            showControls: true,
            showFullscreenButton: true,
            playsInline: true,
            enableCaption: false,
            strictRelatedVideos: true,
          ),
        );
        return;
      }
    }

    // Vimeo and Google Drive — their own iframe/controls. Neither gives us
    // a clean way to drive a fully custom UI the way YouTube's IFrame API
    // does: Vimeo's basic embed terms require their player chrome, and
    // Drive's own `/preview` page is what reliably handles a private/shared
    // file's cookies + confirmation flow (a bare <video> tag can't).
    if (_embed.type == VideoEmbedType.iframe) {
      PlatformWebViewControllerCreationParams params =
          const PlatformWebViewControllerCreationParams();
      if (WebViewPlatform.instance is WebKitWebViewPlatform) {
        params = WebKitWebViewControllerCreationParams(
          allowsInlineMediaPlayback: true,
          mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
        );
      }
      _iframeWvc = WebViewController.fromPlatformCreationParams(params)
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.black)
        ..loadRequest(Uri.parse(_embed.src));
    }
    // VideoEmbedType.video (direct mp4/webm/ogg/mov file links only, not
    // Drive) is handled entirely by _DirectVideoBlock below, which owns its
    // own WebViewController and a bare <video> element with no browser
    // chrome at all.
  }

  /// Pull the 11-char video id out of a `youtube.com/embed/{id}` URL.
  String? _youtubeId(String embedSrc) {
    try {
      final segs = Uri.parse(embedSrc).pathSegments;
      final i = segs.indexOf('embed');
      if (i >= 0 && i + 1 < segs.length) return segs[i + 1];
    } catch (_) {}
    return null;
  }

  @override
  void dispose() {
    _ytc?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final c = context.c;
    final bottom = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF0F121F) : const Color(0xFFFBFCFF),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: c.line,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 8, 12),
            child: Row(children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Watch lesson video',
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                    const SizedBox(height: 2),
                    Text('Video added by your instructor.',
                        style: TextStyle(fontSize: 11, color: c.inkSoft)),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: Icon(Icons.close_rounded, size: 20, color: c.inkMedium),
              ),
            ]),
          ),
          Divider(height: 1, color: c.line),
          // Video area — 9:16 for a vertical video (e.g. a YouTube Short),
          // 16:9 otherwise, so the picture is never stretched to fit the
          // wrong box.
          Padding(
            padding: const EdgeInsets.all(16),
            child: AspectRatio(
              aspectRatio: _embed.isVertical ? 9 / 16 : 16 / 9,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: _buildPlayer(c, dark),
              ),
            ),
          ),
          SizedBox(height: bottom + 8),
        ],
      ),
    );
  }

  Widget _buildPlayer(AppColors c, bool dark) {
    final ytc = _ytc;
    if (ytc != null) {
      return ColoredBox(
        color: Colors.black,
        child: YoutubePlayer(
          controller: ytc,
          aspectRatio: _embed.isVertical ? 9 / 16 : 16 / 9,
        ),
      );
    }
    if (_embed.type == VideoEmbedType.video) {
      return ColoredBox(
        color: Colors.black,
        child: _DirectVideoBlock(src: _embed.src),
      );
    }
    final wvc = _iframeWvc;
    if (wvc != null) {
      return ColoredBox(
        color: Colors.black,
        child: WebViewWidget(controller: wvc),
      );
    }
    // blocked or none
    return ColoredBox(
      color: dark ? const Color(0x08FFFFFF) : const Color(0xFFF8FAFC),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _embed.type == VideoEmbedType.blocked ? '⚠️' : '🎬',
                style: const TextStyle(fontSize: 36),
              ),
              const SizedBox(height: 10),
              Text(
                _embed.type == VideoEmbedType.blocked
                    ? 'This video cannot be played.'
                    : 'No video yet.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong),
              ),
              const SizedBox(height: 4),
              Text(
                _embed.type == VideoEmbedType.blocked
                    ? 'Ask your instructor to upload an embeddable video.'
                    : "Your instructor hasn't added a video for this lesson.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: c.inkSoft),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shared auto-hide behavior for both player backends below: controls start
/// visible, tapping the player toggles them, and they auto-hide 3s after
/// playback starts (never while paused).
mixin _AutoHideControls<T extends StatefulWidget> on State<T> {
  bool controlsVisible = true;
  Timer? _hideTimer;

  void scheduleAutoHide(bool isPlaying) {
    _hideTimer?.cancel();
    if (isPlaying) {
      _hideTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => controlsVisible = false);
      });
    }
  }

  void toggleControls(bool isPlaying) {
    setState(() => controlsVisible = !controlsVisible);
    if (controlsVisible) scheduleAutoHide(isPlaying);
  }

  void disposeAutoHide() => _hideTimer?.cancel();
}

/// The app's own control bar — play/pause, ±10s skip, seek bar, elapsed/total
/// time. Used identically for the YouTube block and the direct/Drive video
/// block below, so both look and behave the same regardless of source.
class _ControlsBar extends StatelessWidget {
  final bool visible;
  final bool playing;
  final Duration position;
  final Duration duration;
  final VoidCallback onPlayPause;
  final ValueChanged<Duration> onSeek;
  final ValueChanged<int> onSkip; // delta in seconds

  const _ControlsBar({
    required this.visible,
    required this.playing,
    required this.position,
    required this.duration,
    required this.onPlayPause,
    required this.onSeek,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    final durMs = duration.inMilliseconds;
    final posMs = durMs == 0
        ? 0.0
        : position.inMilliseconds.clamp(0, durMs).toDouble();
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: const Duration(milliseconds: 200),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [
                Colors.black.withValues(alpha: 0.78),
                Colors.transparent,
              ],
            ),
          ),
          alignment: Alignment.bottomCenter,
          padding: const EdgeInsets.fromLTRB(8, 30, 8, 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SliderTheme(
                data: const SliderThemeData(
                  trackHeight: 2.5,
                  thumbShape: RoundSliderThumbShape(enabledThumbRadius: 6),
                  overlayShape: RoundSliderOverlayShape(overlayRadius: 12),
                ),
                child: Slider(
                  value: durMs == 0 ? 0 : posMs,
                  min: 0,
                  max: durMs == 0 ? 1 : durMs.toDouble(),
                  activeColor: Colors.white,
                  inactiveColor: Colors.white.withValues(alpha: 0.28),
                  onChanged: durMs == 0
                      ? null
                      : (v) => onSeek(Duration(milliseconds: v.round())),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.replay_10_rounded,
                        color: Colors.white, size: 22),
                    onPressed: () => onSkip(-10),
                  ),
                  IconButton(
                    iconSize: 38,
                    icon: Icon(
                      playing
                          ? Icons.pause_circle_filled_rounded
                          : Icons.play_circle_fill_rounded,
                      color: Colors.white,
                    ),
                    onPressed: onPlayPause,
                  ),
                  IconButton(
                    icon: const Icon(Icons.forward_10_rounded,
                        color: Colors.white, size: 22),
                    onPressed: () => onSkip(10),
                  ),
                  const SizedBox(width: 2),
                  Text(
                    '${_fmt(position)} / ${_fmt(duration)}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _fmt(Duration d) {
    final total = d.inSeconds.clamp(0, 359999);
    final m = total ~/ 60;
    final s = total % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }
}

/// Direct video file links (mp4/webm/ogg/mov) — NOT Google Drive, which
/// needs Drive's own page to handle cookies/sharing (see the iframe path
/// above). A bare `<video>` element with NO native browser controls at all,
/// driven by our own [_ControlsBar] over a small JS bridge (Flutter → JS for
/// play/pause/seek, JS → Flutter for position/duration/playing state).
class _DirectVideoBlock extends StatefulWidget {
  final String src;
  const _DirectVideoBlock({required this.src});

  @override
  State<_DirectVideoBlock> createState() => _DirectVideoBlockState();
}

class _DirectVideoBlockState extends State<_DirectVideoBlock>
    with _AutoHideControls {
  late final WebViewController _wvc;
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  String? _error;

  @override
  void initState() {
    super.initState();
    PlatformWebViewControllerCreationParams params =
        const PlatformWebViewControllerCreationParams();
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    }
    _wvc = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..addJavaScriptChannel('VideoBridge', onMessageReceived: _onBridgeMessage)
      ..setNavigationDelegate(NavigationDelegate(
        // Catches the video's own network fetch failing outright (blocked,
        // DNS, TLS, etc.) — separate from a <video> "can't decode/play"
        // error, which arrives over the JS bridge instead.
        onWebResourceError: (error) {
          if (!mounted) return;
          setState(() => _error =
              'Could not load the video (${error.description}).');
        },
        onHttpError: (error) {
          if (!mounted) return;
          final code = error.response?.statusCode;
          setState(() => _error = code != null
              ? 'The video server returned an error (HTTP $code).'
              : 'The video server returned an error.');
        },
      ))
      ..loadHtmlString(_html(widget.src));
  }

  void _onBridgeMessage(JavaScriptMessage msg) {
    try {
      final data = jsonDecode(msg.message) as Map<String, dynamic>;
      if (!mounted) return;
      if (data['error'] == true) {
        setState(() => _error = _describePlaybackError(data));
        return;
      }
      final dur = (data['duration'] as num?)?.toDouble() ?? 0;
      final cur = (data['currentTime'] as num?)?.toDouble() ?? 0;
      final playing = data['playing'] == true;
      setState(() {
        _playing = playing;
        if (dur > 0) _duration = Duration(milliseconds: (dur * 1000).round());
        _position = Duration(milliseconds: (cur * 1000).round());
      });
      scheduleAutoHide(playing);
    } catch (_) {
      // Ignore malformed bridge messages.
    }
  }

  String _describePlaybackError(Map<String, dynamic> data) {
    // MediaError.code per the HTML5 spec: 1=aborted, 2=network,
    // 3=decode, 4=src not supported.
    final code = (data['code'] as num?)?.toInt() ?? 0;
    switch (code) {
      case 2:
        return 'Network error while loading the video. Check the connection and try again.';
      case 3:
        return 'This video is in a format the player could not decode.';
      case 4:
        return "This link didn't return a playable video file. Check that "
            "it's a direct link to an mp4/webm/ogg/mov file.";
      default:
        return 'This video could not be played.';
    }
  }

  void _retry() {
    setState(() => _error = null);
    _wvc.loadHtmlString(_html(widget.src));
  }

  void _run(String js) => _wvc.runJavaScript(js);

  @override
  void dispose() {
    disposeAutoHide();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    return Stack(
      fit: StackFit.expand,
      children: [
        WebViewWidget(controller: _wvc),
        if (error != null)
          Container(
            color: Colors.black,
            alignment: Alignment.center,
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('⚠️', style: TextStyle(fontSize: 32)),
                const SizedBox(height: 10),
                Text(error,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: _retry,
                  icon: const Icon(Icons.refresh_rounded,
                      color: Colors.white, size: 18),
                  label: const Text('Try again',
                      style: TextStyle(color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.white38)),
                ),
              ],
            ),
          )
        else
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () => toggleControls(_playing),
              child: _ControlsBar(
                visible: controlsVisible,
                playing: _playing,
                position: _position,
                duration: _duration,
                onPlayPause: () => _run(_playing
                    ? "document.getElementById('v').pause();"
                    : "document.getElementById('v').play();"),
                onSeek: (d) => _run(
                    "document.getElementById('v').currentTime = ${d.inMilliseconds / 1000};"),
                onSkip: (delta) => _run(
                    "var v=document.getElementById('v'); v.currentTime = Math.max(0, Math.min(v.duration||1e9, v.currentTime + ($delta)));"),
              ),
            ),
          ),
      ],
    );
  }

  static String _html(String src) => '''<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0}
html,body{background:#000;height:100%;width:100%;overflow:hidden}
video{width:100%;height:100%;object-fit:contain;display:block}
</style>
</head><body>
<video id="v" src="$src" playsinline webkit-playsinline preload="metadata"
  disablepictureinpicture oncontextmenu="return false"></video>
<script>
var v = document.getElementById('v');
function post(){
  try {
    VideoBridge.postMessage(JSON.stringify({
      playing: !v.paused && !v.ended,
      currentTime: v.currentTime || 0,
      duration: isFinite(v.duration) ? v.duration : 0
    }));
  } catch (e) {}
}
['loadedmetadata','timeupdate','play','pause','ended','seeked'].forEach(function(ev){
  v.addEventListener(ev, post);
});
v.addEventListener('error', function(){
  try {
    var code = v.error ? v.error.code : 0;
    var message = v.error ? v.error.message : '';
    VideoBridge.postMessage(JSON.stringify({ error: true, code: code, message: message }));
  } catch (e) {}
});
setInterval(post, 500);
</script>
</body></html>''';
}
