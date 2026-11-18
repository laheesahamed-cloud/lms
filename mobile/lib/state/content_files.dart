import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

/// Large content kept on the phone as files (OPTIMIZE 10 step 5): the shared
/// catalogue, opened lessons, practice quizzes and flashcard cards.
///
/// Not in SharedPreferences: that store is read in full before the first
/// screen shows, so large entries there slowed every app start. Files are read
/// only when that content is needed. Writes go to a temp file first, then a
/// rename, so a crash never leaves half a file. Kept until the app is deleted.
class ContentFiles {
  ContentFiles._();

  static Directory? _dir;

  static Future<Directory> _root() async {
    final existing = _dir;
    if (existing != null) return existing;
    final base = await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/content');
    if (!await dir.exists()) await dir.create(recursive: true);
    return _dir = dir;
  }

  static String _safe(String name) => name.replaceAll(RegExp(r'[^A-Za-z0-9_.-]'), '_');

  static Future<String?> read(String name) async {
    try {
      final f = File('${(await _root()).path}/${_safe(name)}');
      return await f.exists() ? await f.readAsString() : null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> write(String name, String data) async {
    try {
      final root = await _root();
      final path = '${root.path}/${_safe(name)}';
      final tmp = File('$path.tmp');
      await tmp.writeAsString(data, flush: true);
      await tmp.rename(path);
    } catch (_) {
      // Full disk or similar: the content is simply asked for again next time.
    }
  }

  /// Remove a saved file (missing is fine).
  static Future<void> delete(String name) async {
    try {
      final f = File('${(await _root()).path}/${_safe(name)}');
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }

  /// Remove every saved file whose name starts with one of [prefixes]
  /// (an older list format's copies after a format change).
  static Future<void> deleteStartingWith(List<String> prefixes) async {
    try {
      await for (final e in (await _root()).list()) {
        final name = e.uri.pathSegments.isEmpty ? '' : e.uri.pathSegments.last;
        if (e is File && prefixes.any(name.startsWith)) await e.delete();
      }
    } catch (_) {}
  }

  /// Names of the saved files starting with [prefix] (10.31: the practice
  /// sets the Question of the Day can be picked from).
  static Future<List<String>> names(String prefix) async {
    final out = <String>[];
    try {
      await for (final e in (await _root()).list()) {
        final name = e.uri.pathSegments.isEmpty ? '' : e.uri.pathSegments.last;
        if (e is File && name.startsWith(prefix) && !name.endsWith('.tmp')) out.add(name);
      }
    } catch (_) {}
    return out;
  }

  /// The file a saved binary (an image) lives in; it may not exist yet.
  static Future<File> fileFor(String name) async => File('${(await _root()).path}/${_safe(name)}');

  /// Save bytes (an image) the same safe way as [write].
  static Future<void> writeBytes(String name, Uint8List data) async {
    try {
      final path = (await fileFor(name)).path;
      final tmp = File('$path.tmp');
      await tmp.writeAsBytes(data, flush: true);
      await tmp.rename(path);
    } catch (_) {}
  }
}
