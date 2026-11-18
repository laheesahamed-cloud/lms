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
  // Nobody signed in: no saved copy to read and nothing to ask the server for
  // (asking only earned 401s, and automatic retries repeated them).
  if (uid == 'anon') throw const SignedOutError();

  final key = 'xyndrome.saved.$uid.$name';
  // Two parts of the app asking for the same list at once share one request
  // (the subscription list was fetched twice in the same moment).
  final original = fetch;
  // The callback must not return the removed future: whenComplete waits for a
  // returned future, and that one is this very request, so it would wait on
  // itself forever (every first load with no saved copy hung: the Planner).
  fetch = () => _inFlight[key] ??= original().whenComplete(() {
        _inFlight.remove(key);
      });
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString(key);

  Future<String> encode(Object? raw) => compute(jsonEncode, raw);

  // Something just changed on the server (a lesson finished, an exam sent):
  // the saved copy is out of date, so wait for the real answer this once.
  if (saved == null || _freshNext.remove(key)) {
    final raw = await fetch();
    _lastRefreshed[key] = DateTime.now();
    unawaited(encode(raw).then((s) => _save(prefs, key, s)));
    return parse(raw);
  }

  // The rebuild that follows a changed refresh reads the copy it just wrote.
  if (_justRefreshed.remove(key)) {
    return parse(await compute(jsonDecode, saved));
  }

  // OPTIMIZE 10.2 #3: a saved copy is trusted for up to a day. Lists built
  // from the catalogue are also re-checked when the server's content version
  // (sent in the start-up reply) differs from the one they were saved under.
  // The student's own changes and pull-to-refresh use freshNext() instead.
  final savedAt = prefs.getInt('$key.at');
  final savedVersion = prefs.getInt('$key.v');
  final age = savedAt == null ? null : DateTime.now().millisecondsSinceEpoch - savedAt;
  final versionChanged = _catalogueLists.any((n) => name == n || name.startsWith('$n:')) &&
      catalogueVersion != null &&
      savedVersion != catalogueVersion;
  if (age != null && age < (_maxAge[name] ?? _dayMs) && !versionChanged) {
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
        await _save(prefs, key, fresh);
        _justRefreshed.add(key);
        ref.invalidateSelf();
      } else {
        await _stamp(prefs, key);
      }
    } catch (_) {
      // Offline or a server hiccup: the saved copy stays on screen.
    }
  }());

  return parse(await compute(jsonDecode, saved));
}

/// The server's catalogue version from the start-up reply (null until known).
int? catalogueVersion;

/// Lists whose content comes from the catalogue (admin-edited courses,
/// lessons, assessments, flashcards); names may carry a suffix ("course:12").
const List<String> _catalogueLists = ['courses', 'course', 'lessons', 'quizzes', 'decks'];

const int _dayMs = 24 * 60 * 60 * 1000;

/// Shorter trust for lists that change through the day on their own.
const Map<String, int> _maxAge = <String, int>{
  'dashboard': 30 * 60 * 1000,
  'dashboard_more': 30 * 60 * 1000,
};

Future<void> _stamp(SharedPreferences prefs, String key) async {
  await prefs.setInt('$key.at', DateTime.now().millisecondsSinceEpoch);
  final v = catalogueVersion;
  if (v != null) await prefs.setInt('$key.v', v);
}

Future<void> _save(SharedPreferences prefs, String key, String json) async {
  await prefs.setString(key, json);
  await _stamp(prefs, key);
}

/// The saved copy of a list for an account (decoded JSON), or null.
Future<Object?> readSaved(String name, {String? uid}) async {
  final who = uid ?? LocalScope.uid;
  if (who == 'anon') return null;
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString('xyndrome.saved.$who.$name');
  if (saved == null) return null;
  try {
    return jsonDecode(saved);
  } catch (_) {
    return null;
  }
}

/// Store a server answer that arrived inside another reply (the start-up or
/// sign-in reply carries the student's progress) as that list's fresh saved
/// copy, so the list's own request is not made.
Future<void> seedSaved(String name, Object? raw) async {
  if (raw == null || LocalScope.uid == 'anon') return;
  final key = 'xyndrome.saved.${LocalScope.uid}.$name';
  final prefs = await SharedPreferences.getInstance();
  await _save(prefs, key, jsonEncode(raw));
  _lastRefreshed[key] = DateTime.now();
  _freshNext.remove(key);
}

final Map<String, Future<Object?>> _inFlight = <String, Future<Object?>>{};
final Set<String> _justRefreshed = <String>{};
final Set<String> _freshNext = <String>{};
final Map<String, DateTime> _lastRefreshed = <String, DateTime>{};

/// How long a list fetched from the server counts as current.
const Duration _quietWindow = Duration(seconds: 30);

/// Delay before each list's background refresh. The dashboard goes first.
const Map<String, Duration> _stagger = <String, Duration>{
  'dashboard': Duration.zero,
  'dashboard_more': Duration.zero,
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
/// Bumped when the student's own progress or plan may have changed; the
/// progress provider (state/catalogue.dart) listens and asks again.
final ValueNotifier<int> progressChanged = ValueNotifier<int>(0);
const Set<String> _progressLists = {'lessons', 'quizzes', 'courses', 'results', 'billing'};

void freshNext(String name) {
  _freshNext.add('xyndrome.saved.${LocalScope.uid}.$name');
  // The lesson / Q-Bank / course lists are built on the phone from the shared
  // catalogue and the student's progress, so it is the progress that is new.
  if (_progressLists.contains(name)) {
    _freshNext.add('xyndrome.saved.${LocalScope.uid}.progress');
    progressChanged.value++;
  }
  // The Study Hub is two requests (top + lower cards); a change to one is a
  // change to both.
  if (name == 'dashboard') _freshNext.add('xyndrome.saved.${LocalScope.uid}.dashboard_more');
}

/// Forget saved lists whose name starts with [prefix] (e.g. every "course:"
/// detail after a purchase changes what is locked).
Future<void> forgetSavedStartingWith(String prefix) async {
  final prefs = await SharedPreferences.getInstance();
  final start = 'xyndrome.saved.${LocalScope.uid}.$prefix';
  for (final k in prefs.getKeys().where((k) => k.startsWith(start))) {
    await prefs.remove(k);
  }
}

/// Forget one account's saved lists (its account was deleted).
Future<void> forgetSavedForAccount(String uid) async {
  if (uid == 'anon') return;
  final prefs = await SharedPreferences.getInstance();
  for (final k in prefs.getKeys().where((k) => k.startsWith('xyndrome.saved.$uid.') || k.startsWith('xyndrome.notices.$uid.') || k.startsWith('xyndrome.flash.$uid.'))) {
    await prefs.remove(k);
  }
}

/// Thrown instead of calling the server while nobody is signed in.
class SignedOutError implements Exception {
  const SignedOutError();
  @override
  String toString() => 'Signed out';
}

/// Forget every saved list (not used on sign-out any more).
Future<void> clearSavedLists() async {
  final prefs = await SharedPreferences.getInstance();
  for (final k in prefs.getKeys().where((k) => k.startsWith('xyndrome.saved.'))) {
    await prefs.remove(k);
  }
  _justRefreshed.clear();
  _lastRefreshed.clear();
}
