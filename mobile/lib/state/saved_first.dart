import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'local_scope.dart';

/// "Saved first" loading for a list provider: if the phone already holds the
/// last answer from the server, return it at once and refresh behind it, so the
/// screen never starts empty. The first load after a fresh sign-in still waits
/// for the network, since nothing is saved yet.
///
/// The saved copy is the server's raw JSON, kept per account. It is replaced
/// quietly when the fresh answer differs, and the provider is rebuilt only then.
///
/// [fetch] returns the server's raw response data. [parse] turns that (already
/// JSON-decoded) data into the provider's value.
Future<T> savedFirst<T>(
  Ref ref, {
  required String name,
  required Future<Object?> Function() fetch,
  required Future<T> Function(Object? raw) parse,
}) async {
  final uid = LocalScope.uid;
  // Not signed in yet (or being restored): nothing safe to read, go to the server.
  if (uid == 'anon') return parse(await fetch());

  final key = 'xyndrome.saved.$uid.$name';
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString(key);

  Future<String> encode(Object? raw) => compute(jsonEncode, raw);

  // Something just changed on the server (a lesson finished, an exam sent):
  // the saved copy is out of date, so wait for the real answer this once.
  if (saved == null || _freshNext.remove(key)) {
    final raw = await fetch();
    _lastRefreshed[key] = DateTime.now();
    unawaited(encode(raw).then((s) => prefs.setString(key, s)));
    return parse(raw);
  }

  // The rebuild that follows a changed refresh reads the copy it just wrote.
  if (_justRefreshed.remove(key)) {
    return parse(await compute(jsonDecode, saved));
  }

  // Refreshed from the server moments ago (coming back to a screen, a second
  // widget asking for the same list): the saved copy is current, don't ask again.
  final last = _lastRefreshed[key];
  if (last != null && DateTime.now().difference(last) < _quietWindow) {
    return parse(await compute(jsonDecode, saved));
  }

  unawaited(() async {
    try {
      // The screen already shows the saved copy, so the refreshes don't need to
      // leave at the same instant: spacing them out keeps app launch from
      // asking the server for everything at once.
      final wait = _stagger[name] ?? const Duration(milliseconds: 400);
      if (wait > Duration.zero) await Future<void>.delayed(wait);
      final raw = await fetch();
      _lastRefreshed[key] = DateTime.now();
      final fresh = await encode(raw);
      if (fresh != saved) {
        await prefs.setString(key, fresh);
        _justRefreshed.add(key);
        ref.invalidateSelf();
      }
    } catch (_) {
      // Offline or a server hiccup: the saved copy stays on screen.
    }
  }());

  return parse(await compute(jsonDecode, saved));
}

final Set<String> _justRefreshed = <String>{};
final Set<String> _freshNext = <String>{};
final Map<String, DateTime> _lastRefreshed = <String, DateTime>{};

/// How long a list fetched from the server counts as current.
const Duration _quietWindow = Duration(seconds: 30);

/// Delay before each list's background refresh. The dashboard goes first.
const Map<String, Duration> _stagger = <String, Duration>{
  'dashboard': Duration.zero,
  'courses': Duration(milliseconds: 250),
  'quizzes': Duration(milliseconds: 500),
  'lessons': Duration(milliseconds: 750),
  'results': Duration(milliseconds: 1000),
  'decks': Duration(milliseconds: 1250),
  'planner': Duration(milliseconds: 1500),
};

/// Call just before invalidating a list whose server data you know has changed,
/// so the rebuild waits for fresh data instead of showing the old saved copy
/// first (the old value stays on screen meanwhile; nothing blinks).
void freshNext(String name) {
  _freshNext.add('xyndrome.saved.${LocalScope.uid}.$name');
}

/// Forget every saved list (sign-out, or switching accounts on the same phone).
Future<void> clearSavedLists() async {
  final prefs = await SharedPreferences.getInstance();
  for (final k in prefs.getKeys().where((k) => k.startsWith('xyndrome.saved.'))) {
    await prefs.remove(k);
  }
  _justRefreshed.clear();
  _lastRefreshed.clear();
}
