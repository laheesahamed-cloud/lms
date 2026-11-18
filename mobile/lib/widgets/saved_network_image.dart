import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../state/content_files.dart';

/// A network content image kept as a file on the phone (OPTIMIZE 10.26 P1):
/// downloaded the first time it's shown, then read from the file on every
/// later view and app start — no request, same picture, same quality.
///
/// Content-hashed names (16 hex characters, how the editor saves new images)
/// never change, so they're never asked for again. Other names may be
/// replaced in place: those are re-checked at most once per app session with
/// their ETag (an unchanged picture answers 304 with no body).
class SavedNetworkImage extends StatefulWidget {
  final String url;
  final BoxFit fit;
  final int decodeWidth;
  const SavedNetworkImage(this.url, {super.key, required this.fit, required this.decodeWidth});

  @override
  State<SavedNetworkImage> createState() => _SavedNetworkImageState();
}

final _dio = Dio(BaseOptions(responseType: ResponseType.bytes, connectTimeout: const Duration(seconds: 20)));
final _checkedThisSession = <String>{};
final _inFlight = <String, Future<File?>>{};
final _hashedName = RegExp(r'/[0-9a-f]{16}\.(webp|png|jpe?g|gif)$', caseSensitive: false);

/// FNV-1a 64-bit of the URL: a short, stable file name.
String _key(String url) {
  var h = 0xcbf29ce484222325;
  for (final c in url.codeUnits) {
    h ^= c;
    h = (h * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF;
  }
  return 'img_${h.toRadixString(16)}';
}

Future<File?> _download(String url, File file, {String? etag}) async {
  try {
    final res = await _dio.get<List<int>>(
      url,
      options: Options(
        headers: {if (etag != null) 'If-None-Match': etag},
        validateStatus: (s) => s == 200 || s == 304,
      ),
    );
    if (res.statusCode == 304) return file;
    final bytes = res.data;
    if (bytes == null || bytes.isEmpty) return null;
    final name = file.uri.pathSegments.last;
    await ContentFiles.writeBytes(name, Uint8List.fromList(bytes));
    final tag = res.headers.value('etag');
    if (tag != null) await ContentFiles.write('$name.etag', tag);
    return file;
  } catch (_) {
    return null;
  }
}

/// The saved file for [url], downloading (or re-checking) it when needed.
Future<File?> savedImageFile(String url) {
  return _inFlight[url] ??= () async {
    final name = _key(url);
    final file = await ContentFiles.fileFor(name);
    final have = await file.exists();
    if (have && (_hashedName.hasMatch(url) || _checkedThisSession.contains(url))) return file;
    _checkedThisSession.add(url);
    if (have) {
      // Show the saved copy now; re-check it in the background.
      final etag = await ContentFiles.read('$name.etag');
      _download(url, file, etag: etag).ignore();
      return file;
    }
    return _download(url, file);
  }().whenComplete(() {
    // A block, not `=> remove(url)`: remove returns this very future and
    // whenComplete would wait on it — the load never finished (images stayed blank).
    _inFlight.remove(url);
  });
}

class _SavedNetworkImageState extends State<SavedNetworkImage> {
  late Future<File?> _file = savedImageFile(widget.url);

  @override
  void didUpdateWidget(covariant SavedNetworkImage old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url) _file = savedImageFile(widget.url);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<File?>(
      future: _file,
      builder: (context, snap) {
        final file = snap.data;
        if (file != null) {
          return Image.file(file,
              fit: widget.fit,
              cacheWidth: widget.decodeWidth,
              gaplessPlayback: true,
              errorBuilder: (_, _, _) => const SizedBox.shrink());
        }
        if (snap.connectionState == ConnectionState.done) {
          // No saved copy and the download failed: try the network directly.
          return Image.network(widget.url,
              fit: widget.fit,
              cacheWidth: widget.decodeWidth,
              errorBuilder: (_, _, _) => const SizedBox.shrink());
        }
        return const SizedBox.shrink(); // same as Image.network while loading
      },
    );
  }
}
