import 'dart:convert';
import 'dart:typed_data';

import 'content_files.dart';
import 'saved_first.dart';

/// Study-tool content kept on the phone per content version (OPTIMIZE 10.19):
/// OSCE, ECG and Auscultation lists and topics are asked once and read from
/// the phone until an admin changes content (the start-up reply carries the
/// version). Nothing about the student is in them.
///
/// [needsPlan]: premium content (a case, a topic) is read from the phone only
/// while the student has a plan — otherwise the server decides, as before.
Future<dynamic> keptPerVersion(String name, Future<dynamic> Function() fetch, {bool needsPlan = false}) async {
  final v = catalogueVersion;
  final file = 'kept_$name.json';
  if (v != null && (!needsPlan || await _hasPlan())) {
    final raw = await ContentFiles.read(file);
    if (raw != null) {
      try {
        final m = jsonDecode(raw) as Map;
        if ((m['v'] as num?)?.toInt() == v) return m['d'];
      } catch (_) {}
    }
  }
  final data = await fetch();
  if (v != null && data != null) await ContentFiles.write(file, jsonEncode({'v': v, 'd': data}));
  return data;
}

/// Bytes (an audio clip) kept the same way.
Future<({Uint8List bytes, String mime})> keptBytesPerVersion(
  String name,
  Future<({Uint8List bytes, String mime})> Function() fetch,
) async {
  final v = catalogueVersion;
  final file = 'keptb_${name}_v$v';
  if (v != null && await _hasPlan()) {
    final f = await ContentFiles.fileFor(file);
    final mime = await ContentFiles.read('$file.mime');
    if (mime != null && await f.exists()) return (bytes: await f.readAsBytes(), mime: mime);
  }
  final got = await fetch();
  if (v != null && got.bytes.isNotEmpty) {
    await ContentFiles.writeBytes(file, got.bytes);
    await ContentFiles.write('$file.mime', got.mime);
  }
  return got;
}

/// Whether the saved progress says the student has a plan (no request).
Future<bool> _hasPlan() async {
  final saved = await readSaved('progress');
  if (saved is! Map) return false;
  final access = saved['access'];
  return access is Map && (access['features'] == true || access['paid'] == true);
}
