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
  WebViewController? _wvc;
  YoutubePlayerController? _ytc;

  @override
  void initState() {
    super.initState();
    _embed = getVideoEmbed(widget.videoUrl);

    // YouTube → the dedicated IFrame player. It loads the official YouTube
    // IFrame API with a valid origin, which plays inline reliably on iOS where
    // a raw WebView embed fails ("player configuration error" / "Watch on
    // YouTube").
    if (_embed.provider == 'youtube') {
      final id = _youtubeId(_embed.src);
      if (id != null && id.isNotEmpty) {
        _ytc = YoutubePlayerController.fromVideoId(
          videoId: id,
          autoPlay: false,
          params: const YoutubePlayerParams(
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

    // Vimeo / Google Drive (iframe) and direct video files → plain WebView.
    if (_embed.type == VideoEmbedType.iframe ||
        _embed.type == VideoEmbedType.video) {
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
        ctrl.loadRequest(Uri.parse(_embed.src));
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
          // 16:9 video area
          Padding(
            padding: const EdgeInsets.all(16),
            child: AspectRatio(
              aspectRatio: 16 / 9,
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
        child: YoutubePlayer(controller: ytc, aspectRatio: 16 / 9),
      );
    }
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
