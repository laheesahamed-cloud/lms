import 'dart:async';
import 'dart:convert';

import 'package:fsrs/fsrs.dart' as fsrs;
import 'package:shared_preferences/shared_preferences.dart';

import '../data/api_client.dart';
import 'local_scope.dart';
import 'content_files.dart';
import 'study_days.dart';

/// Flashcards on the phone (OPTIMIZE 10, step 5; decision 2026-11-15).
///
///  - Card content: downloaded once per lesson and kept on the phone for every
///    account; downloaded again only when the catalogue's stamp for that
///    lesson says its cards changed.
///  - Review progress (FSRS memory state per card): kept on the phone, per
///    account, scheduled with the official FSRS library — no server request
///    per review. A student's existing history is imported once.
///  - Nothing is removed on sign-out; deleting the app removes it.
class FlashStore {
  FlashStore._();

  static Future<SharedPreferences> get _sp => SharedPreferences.getInstance();
  static String _k(String name) => 'xyndrome.flash.${LocalScope.uid}.$name';
  static String _cardsKey(int lessonId) => 'xyndrome.flashcards.cards.$lessonId';
  static const _settingsKey = 'xyndrome.flashcards.settings';

  // ── review states ─────────────────────────────────────────────────────────
  // cardId → [state 1-3, step, stability, difficulty, dueIso, lastReviewIso, suspended, buried, lessonId]

  static Map<int, List<dynamic>>? _reviews;
  static String? _reviewsUid;

  static Future<Map<int, List<dynamic>>> reviews() async {
    if (_reviews != null && _reviewsUid == LocalScope.uid) return _reviews!;
    // 10.23 F8: kept in a file (written in batches), not the settings store —
    // older copies in the settings store are read once and moved.
    final sp = await _sp;
    var raw = await ContentFiles.read(_reviewsFile);
    final legacy = sp.getString(_k('reviews'));
    if (raw == null && legacy != null) raw = legacy;
    final out = <int, List<dynamic>>{};
    if (raw != null) {
      try {
        (jsonDecode(raw) as Map).forEach((k, v) => out[int.parse('$k')] = List<dynamic>.from(v as List));
      } catch (_) {}
    }
    _reviews = out;
    _reviewsUid = LocalScope.uid;
    if (legacy != null) {
      await ContentFiles.write(_reviewsFile, jsonEncode(out.map((k, v) => MapEntry('$k', v))));
      await sp.remove(_k('reviews'));
    }
    return out;
  }

  static String get _reviewsFile => 'flash_reviews_${LocalScope.uid}.json';
  static Timer? _saveTimer;
  static int _unsaved = 0;

  /// Grades are written in batches (every 5 grades or 2 s after the last one),
  /// not the whole record after every tap — instant at 10,000 cards.
  static Future<void> _saveReviews() async {
    _unsaved++;
    _saveTimer?.cancel();
    if (_unsaved >= 5) {
      await flushReviews();
      return;
    }
    _saveTimer = Timer(const Duration(seconds: 2), () => flushReviews());
  }

  /// Writes any grades not yet saved (also called when a session ends).
  static Future<void> flushReviews() async {
    _saveTimer?.cancel();
    _saveTimer = null;
    final r = _reviews;
    if (r == null || _unsaved == 0) return;
    _unsaved = 0;
    await ContentFiles.write(_reviewsFile, jsonEncode(r.map((k, v) => MapEntry('$k', v))));
  }

  /// From the start-up / sign-in reply (10.23 F7): the scheduling settings.
  /// (10.36: no history import any more, so `flashHistory` is ignored.)
  static Future<void> applyStart(Map? raw, String uid) async {
    if (raw == null) return;
    final sp = await _sp;
    if (raw['flashSettings'] is Map) await sp.setString(_settingsKey, jsonEncode(raw['flashSettings']));
  }

  // ── card content ──────────────────────────────────────────────────────────

  /// Cards of these lessons, downloading only lessons missing or changed
  /// (stamp from the catalogue). One request for all of them.
  /// Returns lessonId → cards [id, lessonId, question, answer, sourceHint, imageUrls, imageFit, sortOrder].
  static Future<Map<int, List<List<dynamic>>>> cardsFor(ApiClient api, Map<int, int> stampByLesson) async {
    final sp = await _sp;
    final out = <int, List<List<dynamic>>>{};
    final need = <int>[];
    for (final entry in stampByLesson.entries) {
      final lessonId = entry.key, stamp = entry.value;
      final raw = await ContentFiles.read('flashcards_$lessonId.json') ?? sp.getString(_cardsKey(lessonId));
      if (raw != null) {
        try {
          final m = jsonDecode(raw) as Map;
          if ((m['stamp'] as num?)?.toInt() == stamp) {
            out[lessonId] = (m['cards'] as List).map((c) => List<dynamic>.from(c as List)).toList();
            continue;
          }
        } catch (_) {}
      }
      need.add(lessonId);
    }
    for (var i = 0; i < need.length; i += 50) {
      final chunk = need.sublist(i, (i + 50).clamp(0, need.length));
      try {
        final res = await api.dio.get('/student/flashcards/cards', queryParameters: {'lessonIds': chunk.join(',')});
        final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
        if (data['settings'] is Map) await sp.setString(_settingsKey, jsonEncode(data['settings']));
        final byLesson = <int, List<List<dynamic>>>{};
        for (final c in (data['cards'] is List ? data['cards'] as List : const [])) {
          if (c is List && c.length >= 8) byLesson.putIfAbsent((c[1] as num).toInt(), () => []).add(List<dynamic>.from(c));
        }
        final served = (data['lessonIds'] is List) ? (data['lessonIds'] as List).map((e) => (e as num).toInt()).toSet() : <int>{};
        for (final lessonId in chunk) {
          if (!served.contains(lessonId)) continue; // locked: nothing kept
          final cards = (byLesson[lessonId] ?? [])..sort((a, b) => (a[7] as num).compareTo(b[7] as num) != 0 ? (a[7] as num).compareTo(b[7] as num) : (a[0] as num).compareTo(b[0] as num));
          out[lessonId] = cards;
          await ContentFiles.write('flashcards_$lessonId.json', jsonEncode({'stamp': stampByLesson[lessonId], 'cards': cards}));
          await sp.remove(_cardsKey(lessonId));
        }
      } catch (_) {
        // Offline: use whatever older copy exists.
        for (final lessonId in chunk) {
          final raw = await ContentFiles.read('flashcards_$lessonId.json') ?? sp.getString(_cardsKey(lessonId));
          if (raw == null) continue;
          try {
            out[lessonId] = ((jsonDecode(raw) as Map)['cards'] as List).map((c) => List<dynamic>.from(c as List)).toList();
          } catch (_) {}
        }
      }
    }
    return out;
  }

  // ── scheduling ────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> settings() async {
    final raw = (await _sp).getString(_settingsKey);
    try {
      return raw == null ? <String, dynamic>{} : Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  static fsrs.Scheduler schedulerFrom(Map<String, dynamic> s) {
    final w = (s['weights'] is List) ? (s['weights'] as List).map((e) => (e as num).toDouble()).toList() : const <double>[];
    return fsrs.Scheduler(
      parameters: w.length == 21 ? w : fsrs.defaultParameters,
      desiredRetention: (s['requestRetention'] as num?)?.toDouble() ?? 0.9,
      maximumInterval: (s['maximumInterval'] as num?)?.toInt() ?? 36500,
      enableFuzzing: s['enableFuzz'] != false,
    );
  }

  static fsrs.Card toCard(int cardId, List<dynamic>? row) {
    if (row == null) return fsrs.Card(cardId: cardId);
    final stability = (row[2] as num?)?.toDouble();
    final difficulty = (row[3] as num?)?.toDouble();
    return fsrs.Card(
      cardId: cardId,
      state: fsrs.State.fromValue((row[0] as num).toInt().clamp(1, 3)),
      step: (row[0] as num).toInt() == 2 ? null : (row[1] as num?)?.toInt() ?? 0,
      stability: stability == null || stability <= 0 ? null : stability,
      difficulty: difficulty == null || difficulty <= 0 ? null : difficulty,
      due: DateTime.tryParse('${row[4]}')?.toUtc() ?? DateTime.now().toUtc(),
      lastReview: row[5] == null ? null : DateTime.tryParse('${row[5]}')?.toUtc(),
    );
  }

  /// Applies a grade on the phone and keeps the new state.
  static Future<void> review({required int cardId, required int lessonId, required int rating, required DateTime at}) async {
    final mine = await reviews();
    final row = mine[cardId];
    final scheduler = schedulerFrom(await settings());
    final result = scheduler.reviewCard(toCard(cardId, row), fsrs.Rating.fromValue(rating.clamp(1, 4)), reviewDateTime: at.toUtc());
    final c = result.card;
    mine[cardId] = [
      c.state.value,
      c.step ?? 0,
      c.stability,
      c.difficulty,
      c.due.toUtc().toIso8601String(),
      c.lastReview?.toUtc().toIso8601String(),
      row != null ? row[6] : 0,
      row != null ? row[7] : 0,
      lessonId,
    ];
    await _saveReviews();
    // 10.29/10.30: today's flashcards goal, on the phone only (no request).
    if (_goalDay != StudyDays.today()) {
      _goalDay = StudyDays.today();
      await StudyDays.done(StudyDays.flashcards);
    }
  }
  static String? _goalDay;

  /// "<10m", "4d", "3mo", "2y" — the server's button labels.
  static String intervalLabel(int minutes) {
    if (minutes < 60) return '${minutes < 1 ? 1 : minutes}m';
    final hours = minutes / 60;
    if (hours < 24) return '${hours.round()}h';
    final days = hours / 24;
    if (days < 30) return '${days.round()}d';
    final months = days / 30;
    if (months < 12) return '${months.round()}mo';
    final years = days / 365;
    return '${years.toStringAsFixed(years < 10 ? 1 : 0)}y';
  }
}
