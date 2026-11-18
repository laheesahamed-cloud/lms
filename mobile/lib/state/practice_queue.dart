import 'dart:convert';

import 'content_files.dart';
import 'local_scope.dart';

/// Finished practices waiting on the phone (OPTIMIZE 10.28).
///
/// A finished practice never makes a request of its own. It is noted here with
/// a number (counting up per account), its day and whether it was passed, and
/// rides along with the next main request the app sends anyway — start-up,
/// lesson done, exam finish, flashcard save (see the ApiClient). The server
/// answers `X-Practices-Applied: <last number saved>`, and only those are
/// dropped here. If nothing has gone for 12 hours while the app is open, they
/// are sent once on their own (`/student/dashboard/sync`), and before sign-out.
///
/// The server keeps the last number it applied, so a retried request never
/// counts a practice twice; after a reinstall the numbering continues after
/// the server's (`practiceSeq` in the progress reply).
class PracticeQueue {
  PracticeQueue._();

  static const maxWait = Duration(hours: 12);

  /// Changes run one at a time: a confirm and a re-number arriving together
  /// (the start-up reply) must not overwrite each other's file.
  static Future<void> _chain = Future.value();
  static Future<T> _serial<T>(Future<T> Function() job) {
    final run = _chain.then((_) => job());
    _chain = run.then((_) {}, onError: (_) {});
    return run;
  }

  static String get _file => 'practices_${LocalScope.uid}.json';

  static Future<Map<String, dynamic>> _read() async {
    final raw = await ContentFiles.read(_file);
    if (raw == null) return {'next': 1, 'pending': <dynamic>[]};
    try {
      final m = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      m['pending'] = List<dynamic>.from(m['pending'] as List? ?? const []);
      return m;
    } catch (_) {
      return {'next': 1, 'pending': <dynamic>[]};
    }
  }

  static Future<void> _write(Map<String, dynamic> m) =>
      ContentFiles.write(_file, jsonEncode(m));

  /// Today as the server counts days (YYYY-MM-DD, phone's local date).
  static String today() {
    final d = DateTime.now();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// A practice was finished (passed = at or above the quiz's pass mark).
  static Future<void> add({required bool passed}) => _serial(() async {
    final m = await _read();
    final n = (m['next'] as num?)?.toInt() ?? 1;
    (m['pending'] as List).add({
      'n': n,
      'day': today(),
      'passed': passed,
      'at': DateTime.now().toUtc().toIso8601String(),
    });
    m['next'] = n + 1;
    m['lastDay'] = today();
    await _write(m);
  });

  /// All 4 of [day]'s goals are done on this phone (10.30): the day-done mark
  /// rides along with the next request and moves the streak for that day on
  /// the server (one UPDATE of the same row). Once per day.
  static Future<void> addDayDone(String day) => _serial(() async {
    final m = await _read();
    if (m['doneDay'] == day) return;
    final n = (m['next'] as num?)?.toInt() ?? 1;
    (m['pending'] as List).add({
      'n': n,
      'day': day,
      'kind': 'day',
      'at': DateTime.now().toUtc().toIso8601String(),
    });
    m['next'] = n + 1;
    m['doneDay'] = day;
    await _write(m);
  });

  /// The practices to send with the next request (empty when none).
  static Future<List<Map<String, dynamic>>> pending() async {
    final m = await _read();
    return [
      for (final p in m['pending'] as List)
        if (p is Map)
          p['kind'] == 'day' || p['kind'] == 'flash'
              ? {'n': p['n'], 'day': p['day'], 'kind': p['kind']}
              : {'n': p['n'], 'day': p['day'], 'passed': p['passed'] == true},
    ];
  }

  /// The server saved every practice up to [savedMax]: drop them here.
  static Future<void> confirm(int savedMax) => _serial(() async {
    if (savedMax <= 0) return;
    final m = await _read();
    m['pending'] = [
      for (final p in m['pending'] as List)
        if (p is Map && ((p['n'] as num?)?.toInt() ?? 0) > savedMax) p,
    ];
    await _write(m);
  });

  /// The progress reply's `practiceSeq` (the last number the server applied):
  /// numbering continues after it, and anything at or below it is done.
  static Future<void> seed(int serverSeq) => _serial(() async {
    if (serverSeq <= 0) return;
    final m = await _read();
    final next = (m['next'] as num?)?.toInt() ?? 1;
    if (next <= serverSeq) m['next'] = serverSeq + 1;
    m['pending'] = [
      for (final p in m['pending'] as List)
        if (p is Map && ((p['n'] as num?)?.toInt() ?? 0) > serverSeq) p,
    ];
    await _write(m);
  });

  /// Whether a practice was finished today on this phone (today's goal bit
  /// shows at once, before the server has it).
  static Future<bool> practisedToday() async {
    final m = await _read();
    return m['lastDay'] == today();
  }

  /// The oldest waiting practice is older than 12 hours.
  static Future<bool> overdue() async {
    final m = await _read();
    for (final p in m['pending'] as List) {
      final at = p is Map ? DateTime.tryParse('${p['at']}') : null;
      if (at != null && DateTime.now().toUtc().difference(at) >= maxWait) {
        return true;
      }
    }
    return false;
  }
}
