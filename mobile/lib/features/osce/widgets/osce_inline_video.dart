import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../../theme/tokens.dart';
import '../../lessons/video_embed.dart';
import '../../shell/app_shell.dart' show appRouteObserver;

/// A station clip that plays where the picture would have been.
///
/// A finding is read in place — you look at the chest, you look at the hands —
/// so sending a clip to a full-screen popup breaks that reading. This plays in
/// the slot itself, with the platform's own controls.
///
/// Built on a WebView around a bare <video> rather than the `video_player`
/// plugin: that's a native plugin, and native plugin additions are what break
/// the iOS build on this machine. It's the same approach the lesson player
/// already uses, so the path is proven.
class OsceInlineVideo extends StatefulWidget {
  final String url;
  const OsceInlineVideo({super.key, required this.url});

  @override
  State<OsceInlineVideo> createState() => _OsceInlineVideoState();
}

class _OsceInlineVideoState extends State<OsceInlineVideo>
    with WidgetsBindingObserver, RouteAware {
  late WebViewController _wvc;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _build();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) appRouteObserver.subscribe(this, route);
  }

  /// Another screen was pushed over this one. dispose() doesn't fire — the
  /// widget is still mounted underneath — so without this the clip keeps
  /// sounding behind the new screen.
  @override
  void didPushNext() => _pause();

  void _pause() {
    _wvc.runJavaScript(
      "var v=document.getElementById('v'); if(v){v.pause();}",
    ).catchError((_) {});
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    // Fire-and-forget: the widget is going away either way, and playback has
    // to stop or the clip keeps sounding over whatever screen comes next.
    teardownVideoPage(_wvc);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Backgrounding the app should pause a clip too — it isn't being watched.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) _pause();
  }

  @override
  void didUpdateWidget(OsceInlineVideo old) {
    super.didUpdateWidget(old);
    // A sign view steps sideways between findings, so the same widget is reused
    // with a different clip — reload rather than keep showing the previous one.
    if (old.url != widget.url) {
      _error = null;
      _build();
    }
  }

  void _build() {
    PlatformWebViewControllerCreationParams params =
        const PlatformWebViewControllerCreationParams();
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        // Without this iOS takes the video fullscreen the moment it plays,
        // which is the behaviour we're removing.
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    }
    _wvc = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..addJavaScriptChannel('OsceVideoBridge', onMessageReceived: (msg) {
        try {
          final data = jsonDecode(msg.message) as Map<String, dynamic>;
          if (data['error'] == true && mounted) {
            setState(() => _error = _describe((data['code'] as num?)?.toInt() ?? 0));
          }
        } catch (_) {
          // A malformed bridge message tells us nothing; ignore it.
        }
      })
      ..setNavigationDelegate(NavigationDelegate(
        onWebResourceError: (e) {
          if (mounted) setState(() => _error = 'Could not load the clip (${e.description}).');
        },
        onHttpError: (e) {
          final code = e.response?.statusCode;
          if (mounted) {
            setState(() => _error = code != null
                ? 'The server returned HTTP $code for this clip.'
                : 'The server returned an error for this clip.');
          }
        },
      ))
      ..loadHtmlString(_html(widget.url),
          baseUrl: videoPageBaseUrl(widget.url));
  }

  /// MediaError codes per the HTML5 spec, said in plain terms.
  String _describe(int code) {
    switch (code) {
      case 2:
        return 'Network error while loading the clip.';
      case 3:
        return 'This clip is in a format the player could not decode.';
      case 4:
        // Two very different causes land on the same code, so name both: iOS
        // reports an unsupported container (a WebM slot uploaded before those
        // were rejected) exactly as it reports a non-video response body.
        return _looksUnplayableOnIos(widget.url)
            ? 'This clip is a ${_ext(widget.url).toUpperCase()} file, which iOS '
                'cannot play. Re-upload it as MP4.'
            : 'The server did not return a playable clip — it may not be '
                'deployed yet, or the file is missing.';
      default:
        return 'This clip could not be played.';
    }
  }

  static String _ext(String url) {
    final m = RegExp(r'\.([A-Za-z0-9]+)(?:\?|#|$)').firstMatch(url);
    return m?.group(1) ?? '';
  }

  /// Containers iOS WebKit has no decoder for, whatever the server sends.
  static bool _looksUnplayableOnIos(String url) =>
      const {'webm', 'ogv', 'ogg', 'mkv', 'avi'}.contains(_ext(url).toLowerCase());

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      final c = context.c;
      return Container(
        color: c.surface2,
        alignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.videocam_off_outlined, size: 26, color: c.inkMuted),
            const SizedBox(height: 8),
            Text(error,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.45, color: c.inkMedium)),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () { setState(() => _error = null); _build(); },
              child: const Text('Try again'),
            ),
          ],
        ),
      );
    }
    return ColoredBox(
      color: Colors.black,
      child: WebViewWidget(controller: _wvc),
    );
  }

  /// `controls` is the platform's own bar — no custom chrome to maintain, and it
  /// already handles scrubbing, which the media route supports via Range.
  static String _html(String src) => '''<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0}
html,body{background:#000;height:100%;width:100%;overflow:hidden}
video{width:100%;height:100%;object-fit:contain;display:block}
</style>
</head><body>
<video id="v" src="$src" controls playsinline webkit-playsinline
  preload="metadata" disablepictureinpicture oncontextmenu="return false"></video>
<script>
var v = document.getElementById('v');
v.addEventListener('error', function(){
  try {
    OsceVideoBridge.postMessage(JSON.stringify({
      error: true,
      code: v.error ? v.error.code : 0
    }));
  } catch (e) {}
});
</script>
</body></html>''';
}
