import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../lessons/watch_video_modal.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../data/api_client.dart';
import '../../theme/tokens.dart';

/// On-device cache for station images.
///
/// A case is ~25 pictures. Without this, walking the same station twice
/// re-downloads all of them, and on a ward with no signal it shows nothing at
/// all. Hand-rolled on `dio` + `path_provider` rather than
/// `cached_network_image`, which drags in `sqflite` — a native plugin, and
/// native plugin additions are what break the iOS build on this machine.
///
/// Files live under application support (not the temp directory) so the OS
/// doesn't reclaim them between sessions, keyed by a hash of the full URL. The
/// `?v=` stamp the server appends is part of that URL, so refilling a slot
/// changes the key and the stale copy simply ages out.
class OsceMediaCache {
  final Dio _dio;
  OsceMediaCache(this._dio);

  /// Roughly two dozen cases' worth of optimised images. Past this the oldest
  /// files go — a cache that grows without limit is a bug report about storage.
  static const int maxBytes = 200 * 1024 * 1024;

  Directory? _dir;
  final Map<String, Future<File?>> _inFlight = {};

  Future<Directory> _directory() async {
    if (_dir != null) return _dir!;
    final base = await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/osce_media');
    if (!await dir.exists()) await dir.create(recursive: true);
    _dir = dir;
    return dir;
  }

  /// A stable filename for a URL.
  ///
  /// Deliberately not a crypto hash: adding `crypto` means touching pubspec,
  /// and a pubspec change triggers the CocoaPods path that is broken on this
  /// machine. A cache key needs to be stable and collision-resistant enough for
  /// a few thousand filenames, which 64-bit FNV-1a over the URL is — and a
  /// collision would only mean one picture served from the wrong file, caught
  /// immediately by eye.
  String _key(String url) {
    var hash = 0xcbf29ce484222325;
    for (final unit in utf8.encode(url)) {
      hash ^= unit;
      // Multiply by the FNV prime, masked to stay in 64 bits.
      hash = (hash * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF;
    }
    final digest = hash.toRadixString(16).padLeft(16, '0');
    // Keep the extension so the decoder has a hint and files stay inspectable.
    final ext = _extFor(url);
    return ext.isEmpty ? digest : '$digest.$ext';
  }

  String _extFor(String url) {
    final path = Uri.tryParse(url)?.path ?? '';
    final dot = path.lastIndexOf('.');
    if (dot < 0 || dot == path.length - 1) return '';
    final ext = path.substring(dot + 1).toLowerCase();
    return ext.length <= 5 ? ext : '';
  }

  /// The cached file for [url], downloading it if this is the first ask.
  /// Returns null when it can't be fetched and isn't already cached — callers
  /// fall back to their own placeholder rather than getting an exception.
  Future<File?> file(String url) {
    if (url.isEmpty) return Future.value(null);
    // Collapse concurrent asks for the same URL: a scene and its mini-map both
    // want the same picture on the same frame.
    return _inFlight.putIfAbsent(url, () => _resolve(url))
        .whenComplete(() => _inFlight.remove(url));
  }

  Future<File?> _resolve(String url) async {
    try {
      final dir = await _directory();
      final target = File('${dir.path}/${_key(url)}');

      if (await target.exists() && await target.length() > 0) {
        // Touch it so eviction treats a re-read as recent use.
        target.setLastModified(DateTime.now()).catchError((_) {});
        return target;
      }

      final res = await _dio.get<List<int>>(
        url,
        options: Options(
          responseType: ResponseType.bytes,
          // Media routes are public and cacheable; a slow ward connection
          // shouldn't hang a whole screen on one picture.
          receiveTimeout: const Duration(seconds: 20),
        ),
      );
      final bytes = res.data;
      if (bytes == null || bytes.isEmpty) return null;

      // Write beside the target then rename, so a killed app can't leave a
      // half-written file that later reads as a corrupt image.
      final tmp = File('${target.path}.part');
      await tmp.writeAsBytes(bytes, flush: true);
      await tmp.rename(target.path);

      _evict();
      return target;
    } catch (_) {
      return null;
    }
  }

  /// Warm every picture in a case so it opens offline later. Failures are
  /// ignored — this is opportunistic, never something the student waits on.
  Future<void> prefetch(Iterable<String> urls) async {
    for (final url in urls.where((u) => u.isNotEmpty)) {
      await file(url);
    }
  }

  /// Drop the oldest files once the cache is over budget. Deliberately not
  /// awaited by callers: it runs after a write and its outcome changes nothing
  /// on screen.
  Future<void> _evict() async {
    try {
      final dir = await _directory();
      final files = <File>[];
      var total = 0;
      await for (final entry in dir.list()) {
        if (entry is! File) continue;
        files.add(entry);
        total += await entry.length();
      }
      if (total <= maxBytes) return;

      final stats = <File, DateTime>{};
      for (final f in files) {
        stats[f] = await f.lastModified().catchError((_) => DateTime(1970));
      }
      files.sort((a, b) => stats[a]!.compareTo(stats[b]!));

      for (final f in files) {
        if (total <= maxBytes) break;
        total -= await f.length().catchError((_) => 0);
        await f.delete().catchError((_) => f);
      }
    } catch (_) {
      // A cache that can't tidy itself is still a working cache.
    }
  }

  /// Bytes currently held, for a settings screen or a "clear" action.
  Future<int> size() async {
    try {
      final dir = await _directory();
      var total = 0;
      await for (final entry in dir.list()) {
        if (entry is File) total += await entry.length();
      }
      return total;
    } catch (_) {
      return 0;
    }
  }

  Future<void> clear() async {
    try {
      final dir = await _directory();
      await for (final entry in dir.list()) {
        if (entry is File) await entry.delete().catchError((_) => entry);
      }
    } catch (_) {
      // Nothing to report — the next read just re-downloads.
    }
  }
}

/// Whether a media URL points at a clip rather than a still.
///
/// Checked on the URL rather than a passed-in flag so EVERY call site gets it
/// right — a slot can hold a clip, and there are half a dozen places that draw
/// slot media. Wiring the flag through each of them by hand is how two of them
/// ended up trying to decode an MP4 as a picture.
bool isOsceVideoUrl(String url) =>
    RegExp(r'\.(mp4|webm|mov|ogv|ogg)(\?|#|$)', caseSensitive: false).hasMatch(url);

final osceMediaCacheProvider = Provider<OsceMediaCache>(
  (ref) => OsceMediaCache(ref.read(apiClientProvider).dio),
);

/// A station image, served from disk when it's there.
///
/// Drop-in for `Image.network` across the OSCE screens. Keeps the caller's
/// [fit] and error placeholder, and holds the previously decoded frame while a
/// new URL resolves so stepping between scenes doesn't flash empty.
class OsceCachedImage extends ConsumerStatefulWidget {
  final String url;
  final BoxFit fit;
  final Widget Function(BuildContext context)? placeholder;
  final double? width;
  final double? height;

  const OsceCachedImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.placeholder,
    this.width,
    this.height,
  });

  @override
  ConsumerState<OsceCachedImage> createState() => _OsceCachedImageState();
}

class _OsceCachedImageState extends ConsumerState<OsceCachedImage> {
  File? _file;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(OsceCachedImage old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url) {
      _failed = false;
      _load();
    }
  }

  Future<void> _load() async {
    // Clips are streamed by the player, not pulled into the image cache — a
    // 60 MB file would blow the cache budget for no benefit.
    if (isOsceVideoUrl(widget.url)) return;
    final found = await ref.read(osceMediaCacheProvider).file(widget.url);
    if (!mounted) return;
    setState(() {
      _file = found;
      _failed = found == null;
    });
  }

  @override
  Widget build(BuildContext context) {
    // A clip can't be decoded as a picture. Rather than fall through to the
    // "missing image" placeholder, offer to play it — the app already has a
    // player for direct video files.
    if (isOsceVideoUrl(widget.url)) {
      return OsceVideoTile(
        url: widget.url,
        width: widget.width,
        height: widget.height,
      );
    }

    final file = _file;
    if (file != null) {
      return Image.file(
        file,
        fit: widget.fit,
        width: widget.width,
        height: widget.height,
        // A file that decodes badly (truncated download, unsupported codec)
        // should look like a missing picture, not a red error box.
        errorBuilder: (_, _, _) => _fallback(context),
      );
    }
    if (_failed) return _fallback(context);
    return _fallback(context, loading: true);
  }

  Widget _fallback(BuildContext context, {bool loading = false}) {
    if (widget.placeholder != null) return widget.placeholder!(context);
    final c = context.c;
    return Container(
      width: widget.width,
      height: widget.height,
      color: c.surface2,
      alignment: Alignment.center,
      child: loading
          ? SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: c.inkMuted),
            )
          : Icon(Icons.image_not_supported_outlined, size: 20, color: c.inkMuted),
    );
  }
}

/// A clip, shown as a tappable panel that opens the app's video player.
///
/// Scales to whatever box it's given: a 54px sign thumbnail gets the play
/// badge alone, a full-width panel gets the label too. Kept here rather than
/// in a separate widget so [OsceCachedImage] — which every OSCE screen already
/// uses — can fall back to it without each caller knowing about clips.
class OsceVideoTile extends StatelessWidget {
  final String url;
  final double? width;
  final double? height;
  final String? label;
  const OsceVideoTile({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        WatchVideoModal.show(context, url);
      },
      child: Container(
        width: width,
        height: height,
        color: c.surface2,
        alignment: Alignment.center,
        child: LayoutBuilder(
          builder: (context, box) {
            // Below roughly a thumbnail's width there's no room for a caption,
            // so the badge has to carry the meaning on its own.
            final tight = box.maxWidth < 90 || box.maxHeight < 90;
            final badge = tight ? 26.0 : 52.0;
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: badge,
                  height: badge,
                  decoration: BoxDecoration(
                    color: c.primary.withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.play_arrow_rounded,
                      size: tight ? 16 : 30, color: c.primary),
                ),
                if (!tight) ...[
                  const SizedBox(height: 8),
                  Text(label?.isNotEmpty == true ? label! : 'Play clip',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: c.inkMedium)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
