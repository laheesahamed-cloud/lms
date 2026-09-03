import 'package:shared_preferences/shared_preferences.dart';

import '../../state/local_scope.dart';

/// Attempts whose answers the student has already opened.
///
/// The dashboard's `recentAttempts` carry no "reviewed" flag and no quiz id,
/// so the Continue card had no way to tell that an attempt had been looked at
/// — it kept offering the same review indefinitely instead of moving on to the
/// next thing. Recorded on-device because there is no server field for it.
///
/// Scoped by [LocalScope.uid] like the other on-device stores, so one
/// student's history is never read for another.
class ReviewedAttempts {
  ReviewedAttempts._();

  static SharedPreferences? _prefs;

  /// Keep the list bounded — only the recent tail is ever consulted.
  static const int _max = 200;

  static String get _key => 'xyndrome.reviewed_attempts.${LocalScope.uid}';

  static void init(SharedPreferences prefs) => _prefs = prefs;

  static bool contains(int attemptId) =>
      (_prefs?.getStringList(_key) ?? const <String>[]).contains('$attemptId');

  static Future<void> mark(int attemptId) async {
    final prefs = _prefs;
    if (prefs == null || attemptId <= 0) return;
    final list = prefs.getStringList(_key) ?? <String>[];
    if (list.contains('$attemptId')) return;
    list.add('$attemptId');
    if (list.length > _max) list.removeRange(0, list.length - _max);
    await prefs.setStringList(_key, list);
  }
}
