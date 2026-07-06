// Dart port of frontend/src/shared/utils/videoEmbed.js
// Handles YouTube, Vimeo, Google Drive, and direct MP4/WebM/OGG/MOV URLs.

enum VideoEmbedType { iframe, video, blocked, none }

class VideoEmbed {
  final VideoEmbedType type;
  final String src;
  final String provider; // 'youtube' | 'vimeo' | 'drive' | ''
  const VideoEmbed({required this.type, this.src = '', this.provider = ''});
}

String _normalizeUrl(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return '';
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
    final watchId = u.queryParameters['v'];
    final embeddedId = ['embed', 'shorts', 'live'].contains(segments.isNotEmpty ? segments.first : '')
        ? (segments.length > 1 ? segments[1] : null)
        : null;
    final id = watchId ?? embeddedId ?? '';
    if (id.isNotEmpty) return _ytEmbed(id);
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

VideoEmbed _ytEmbed(String id) => VideoEmbed(
      type: VideoEmbedType.iframe,
      src: 'https://www.youtube.com/embed/$id'
          '?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&controls=1&fs=1',
      provider: 'youtube',
    );
