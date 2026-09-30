// Dart port of frontend/src/shared/utils/videoEmbed.js
// Handles YouTube, Vimeo, Google Drive, and direct MP4/WebM/OGG/MOV URLs.

import 'package:webview_flutter/webview_flutter.dart';

import '../../config/app_config.dart';

enum VideoEmbedType { iframe, video, blocked, none }

class VideoEmbed {
  final VideoEmbedType type;
  final String src;
  final String provider; // 'youtube' | 'vimeo' | 'drive' | ''
  /// The provider's own id for the video, where it has one. Kept alongside
  /// [src] because the YouTube path needs the bare id to build our own player
  /// page URL, and re-parsing it back out of the embed URL is a needless
  /// second place for that to go wrong.
  final String videoId;
  // True for a vertical video (e.g. a YouTube Short) — the player should use
  // a 9:16 box instead of the default 16:9, or the picture gets stretched.
  final bool isVertical;
  const VideoEmbed({
    required this.type,
    this.src = '',
    this.provider = '',
    this.videoId = '',
    this.isVertical = false,
  });
}

String _normalizeUrl(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return '';
  // A video uploaded through the panel is stored server-relative
  // (`/uploads/video/lesson-3-….mp4`). The web app resolves that against its
  // own origin for free; a native device has no origin, so it arrives here
  // without a scheme, fails the http/https check below, and classifies as
  // "no video" — the button looks live and opening it shows nothing.
  // Same resolution ContentImage already does for pictures.
  if (s.startsWith('/')) return AppConfig.resolveUpload(s);
  // Raw 11-char YouTube ID
  if (RegExp(r'^[A-Za-z0-9_-]{11}$').hasMatch(s)) return 'https://youtu.be/$s';
  // Protocol-relative
  if (s.startsWith('//')) return 'https:$s';
  // Has a scheme — validate http/https only
  if (RegExp(r'^[a-z][a-z\d+.\-]*:', caseSensitive: false).hasMatch(s)) {
    try {
      final u = Uri.parse(s);
      return (u.scheme == 'http' || u.scheme == 'https') ? s : '';
    } catch (_) {
      return '';
    }
  }
  // Bare hostnames / partial URLs
  if (RegExp(
    r'^(www\.|youtu\.be\/|youtube\.com\/|m\.youtube\.com\/|vimeo\.com\/|player\.vimeo\.com\/|drive\.google\.com\/)',
    caseSensitive: false,
  ).hasMatch(s)) {
    return 'https://$s';
  }
  return s;
}

VideoEmbed getVideoEmbed(String url) {
  final raw = _normalizeUrl(url);
  if (raw.isEmpty) return const VideoEmbed(type: VideoEmbedType.none);

  Uri u;
  try {
    u = Uri.parse(raw);
    if (u.scheme != 'http' && u.scheme != 'https') {
      return const VideoEmbed(type: VideoEmbedType.none);
    }
  } catch (_) {
    return const VideoEmbed(type: VideoEmbedType.none);
  }

  final host = u.host.replaceFirst(RegExp(r'^www\.'), '');
  final segments = u.pathSegments.where((s) => s.isNotEmpty).toList();

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (host == 'youtu.be') {
    final id = segments.isNotEmpty ? segments.first : '';
    if (id.isNotEmpty) return _ytEmbed(id);
  }
  if (host.contains('youtube.com')) {
    final first = segments.isNotEmpty ? segments.first : '';
    final watchId = u.queryParameters['v'];
    final embeddedId = ['embed', 'shorts', 'live'].contains(first)
        ? (segments.length > 1 ? segments[1] : null)
        : null;
    final id = watchId ?? embeddedId ?? '';
    if (id.isNotEmpty) return _ytEmbed(id, isVertical: first == 'shorts');
  }

  // ── Vimeo ──────────────────────────────────────────────────────────────────
  if (host.contains('vimeo.com')) {
    final id = segments.firstWhere(
      (s) => RegExp(r'^\d+$').hasMatch(s),
      orElse: () => '',
    );
    if (id.isNotEmpty) {
      return VideoEmbed(
        type: VideoEmbedType.iframe,
        src: 'https://player.vimeo.com/video/$id?dnt=1&title=0&byline=0&portrait=0&badge=0',
        provider: 'vimeo',
      );
    }
  }

  // ── Google Drive ───────────────────────────────────────────────────────────
  // Back to Drive's `/preview` page (their own file viewer + player chrome).
  // The "clean" direct-stream URL (`uc?export=download`) only works when a
  // file is fully public and small enough to skip Google's confirmation
  // flow — for a real private/shared file it needs cookies and an
  // interactive confirmation that a bare <video> tag can't do, so it just
  // fails to load. `/preview` is Google's own page handling all of that
  // internally, so it reliably plays — the trade-off is Drive's own chrome
  // (open/download icons) stays visible, same as Vimeo's iframe below.
  if (host == 'drive.google.com') {
    final dIdx = segments.indexOf('d');
    final id = (dIdx >= 0 && dIdx + 1 < segments.length)
        ? segments[dIdx + 1]
        : u.queryParameters['id'] ?? '';
    if (id.isNotEmpty) {
      return VideoEmbed(
        type: VideoEmbedType.iframe,
        src: 'https://drive.google.com/file/d/$id/preview',
        provider: 'drive',
      );
    }
  }

  // ── Direct video file ──────────────────────────────────────────────────────
  if (RegExp(r'\.(mp4|webm|ogg|mov)([?#].*)?$', caseSensitive: false).hasMatch(raw)) {
    return VideoEmbed(type: VideoEmbedType.video, src: raw);
  }

  return VideoEmbed(type: VideoEmbedType.blocked, src: raw);
}

VideoEmbed _ytEmbed(String id, {bool isVertical = false}) => VideoEmbed(
      type: VideoEmbedType.iframe,
      src: 'https://www.youtube.com/embed/$id'
          '?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&controls=1&fs=1',
      provider: 'youtube',
      videoId: id,
      isVertical: isVertical,
    );

/// The origin to load a bare-<video> player page against.
///
/// WKWebView gives a page loaded with a nil base URL an opaque origin and
/// blocks its remote subresource loads, so a `<video src="https://…">` inside
/// it can fail to fetch whatever the server returns. Handing it the video's own
/// origin gives the page a real one and makes the media load same-origin.
String? videoPageBaseUrl(String src) {
  try {
    final u = Uri.parse(src);
    if (u.scheme != 'http' && u.scheme != 'https') return null;
    if (u.authority.isEmpty) return null;
    return '${u.scheme}://${u.authority}/';
  } catch (_) {
    return null;
  }
}

/// Stop a bare-<video> player page and release its media element.
///
/// Disposing the Flutter widget does not stop a WKWebView's playback — the
/// media element outlives it, so sound carries on over the next screen. Pausing
/// alone isn't enough either: the element has to lose its source, so the page
/// is replaced outright.
Future<void> teardownVideoPage(WebViewController wvc) async {
  try {
    await wvc.runJavaScript(
      "var v=document.getElementById('v');"
      "if(v){v.pause();v.removeAttribute('src');v.load();}",
    );
  } catch (_) {
    // The controller may already be gone; the blank load below still covers it.
  }
  try {
    await wvc.loadHtmlString(
      '<!DOCTYPE html><html><body style="margin:0;background:#000"></body></html>',
    );
  } catch (_) {
    // Nothing left to tear down.
  }
}

/// Our own player page for a YouTube video, served by the API.
///
/// YouTube authorises an embed by the referrer of the page the iframe sits on,
/// so the iframe needs a page that was genuinely served from somewhere. An
/// in-memory page (`loadHtmlString`) has no URL to be referred from, and
/// loading `youtube.com/embed/<id>` as the top-level document has no parent
/// page at all — that one is error 153, "video player configuration error".
///
/// So the backend serves a one-iframe page at this route and the app navigates
/// to it for real. Built from [AppConfig.apiBaseUrl] rather than a constant so
/// it follows the app to whichever environment it was compiled for.
String youtubePlayerPageUrl(String videoId) {
  final base = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/+$'), '');
  return '$base/embed/youtube?v=${Uri.encodeQueryComponent(videoId)}';
}
