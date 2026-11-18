import 'dart:io' show HttpClient;

import 'package:flutter/foundation.dart';

/// Timing marks for finding slow start-up steps on a real phone.
/// Off unless built with --dart-define=PERF_LOG=true; then each mark prints
/// "[perf] +1234ms label" (milliseconds since the app started), readable with
/// `xcrun devicectl device process launch --console …`.
///
/// A release build prints nowhere, so each mark is also sent to the dev
/// backend as `GET /api/__dev/mark/<ms>/<label>`: the load monitor's request
/// trace (DEV_QUERY_TRACE=1) records the path, which is the label. Dev builds
/// only (PERF_LOG); store builds never send anything.
class PerfLog {
  PerfLog._();
  static const bool enabled = bool.fromEnvironment('PERF_LOG');
  static const String _api = String.fromEnvironment('API_BASE_URL');
  static final Stopwatch _clock = Stopwatch()..start();
  static HttpClient? _http;

  static void mark(String label) {
    if (!enabled) return;
    final ms = _clock.elapsedMilliseconds;
    debugPrint('[perf] +${ms}ms $label');
    if (_api.isEmpty) return;
    try {
      final safe = label.replaceAll(RegExp(r'[^A-Za-z0-9_.:()-]+'), '_');
      final uri = Uri.parse('$_api/__dev/mark/$ms/$safe');
      final http = _http ??= HttpClient();
      http.getUrl(uri).then((r) => r.close()).then((res) => res.drain<void>()).catchError((_) {});
    } catch (_) {}
  }

  /// Times an async step: marks its start and how long it took.
  static Future<T> time<T>(String label, Future<T> Function() run) async {
    if (!enabled) return run();
    final started = _clock.elapsedMilliseconds;
    mark('$label …');
    try {
      return await run();
    } finally {
      mark('$label done in ${_clock.elapsedMilliseconds - started}ms');
    }
  }
}
