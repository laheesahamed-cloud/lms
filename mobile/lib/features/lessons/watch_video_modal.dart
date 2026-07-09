import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';
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
  WebViewController? _wvc;

  @override
  void initState() {
    super.initState();
    _embed = getVideoEmbed(widget.videoUrl);
    if (_embed.type == VideoEmbedType.iframe || _embed.type == VideoEmbedType.video) {
      // Use iOS-specific params so YouTube plays inline without requiring a tap.
      PlatformWebViewControllerCreationParams params =
          const PlatformWebViewControllerCreationParams();
      if (WebViewPlatform.instance is WebKitWebViewPlatform) {
        params = WebKitWebViewControllerCreationParams(
          allowsInlineMediaPlayback: true,
          mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
        );
      }
      final ctrl = WebViewController.fromPlatformCreationParams(params)
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.black);
      if (_embed.type == VideoEmbedType.iframe) {
        // Load the provider embed INSIDE an <iframe> on the provider's own
        // origin (via baseUrl), not as a top-level navigation. YouTube/Vimeo's
        // embedded player rejects top-level loads on some videos with a
        // "player configuration error" — running it in an iframe with a valid
        // origin (like a normal web page) fixes that.
        String origin = '';
        try {
          origin = Uri.parse(_embed.src).origin;
        } catch (_) {}
        ctrl.loadHtmlString('''<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#000;height:100%;overflow:hidden}.f{position:fixed;inset:0}iframe{width:100%;height:100%;border:0;display:block}</style>
</head><body>
<div class="f">
<iframe src="${_embed.src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; gyroscope; accelerometer" allowfullscreen></iframe>
</div>
</body></html>''', baseUrl: origin.isNotEmpty ? origin : null);
      } else {
        // Direct video — minimal HTML5 wrapper
        ctrl.loadHtmlString('''<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;height:100vh;display:flex;align-items:center}video{width:100%;max-height:100vh}</style>
</head><body>
<video src="${_embed.src}" controls preload="metadata" playsinline
  controlslist="nodownload" oncontextmenu="return false"></video>
</body></html>''');
      }
      _wvc = ctrl;
    }
  }

  bool get _isYouTube => _embed.provider == 'youtube';

  /// Open the video in its native app / browser. This always works, even when
  /// the in-app WebView embed is refused (iOS gives loadHtmlString content an
  /// opaque origin, so YouTube sometimes shows "Watch on YouTube").
  Future<void> _openExternal() async {
    final url = widget.videoUrl.trim();
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the video.')),
      );
    }
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
          // 16:9 video area
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: _buildPlayer(c, dark),
              ),
            ),
          ),
          // Always-available fallback: some videos won't play inline in the
          // in-app player (iOS embed restrictions), so give a reliable way out.
          if (widget.videoUrl.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: _openExternal,
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: Text(_isYouTube
                      ? 'Not playing? Open in YouTube'
                      : 'Not playing? Open in browser'),
                ),
              ),
            ),
          SizedBox(height: bottom + 8),
        ],
      ),
    );
  }

  Widget _buildPlayer(AppColors c, bool dark) {
    final wvc = _wvc;
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
