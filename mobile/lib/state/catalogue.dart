import '../core/perf_log.dart';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/api_client.dart';
import 'current_user.dart';
import 'saved_first.dart';
import 'practice_queue.dart';
import 'local_scope.dart';
import 'content_files.dart';

/// The shared student catalogue (OPTIMIZE 10, step 5): every course, subject,
/// topic, ready lesson and quiz set, the same for every student. Downloaded
/// once per catalogue version (gzipped, ~35 KB), kept on the phone for all
/// accounts and offline, and asked for again only when the start-up reply
/// carries a newer version — then with If-None-Match, so an unchanged
/// catalogue costs a 304 and no body.
///
/// Each student's own state (plan access, lesson and quiz progress) is
/// [studentProgressProvider], read by their user id on the server.
class Catalogue {
  final int version;
  final List<List<dynamic>> courses; // [id, title, code, examType, description]
  final List<List<dynamic>> subjects; // [id, courseId, name]
  final List<List<dynamic>> topics; // [id, subjectId, name]
  final List<List<dynamic>> lessons; // [id, courseId, subjectId, topicId, title, isFree, hasNote, hasPdf, hasVideo]
  final List<List<dynamic>> quizzes; // [id, courseId, subjectId, topicId, lessonId, isGeneral, examModeOnly, isFree, studentTitle, quizTitle, numberMode, quizNumber, totalQuestions, timeLimit, passingMarks, dynamic]
  final Map<int, List<dynamic>> courseById;
  final Map<int, List<dynamic>> subjectById;
  final Map<int, List<dynamic>> topicById;
  final Map<int, List<dynamic>> lessonById;

  Catalogue._(this.version, this.courses, this.subjects, this.topics, this.lessons, this.quizzes)
      : courseById = {for (final c in courses) c[0] as int: c},
        subjectById = {for (final s in subjects) s[0] as int: s},
        topicById = {for (final t in topics) t[0] as int: t},
        lessonById = {for (final l in lessons) l[0] as int: l};

  static List<List<dynamic>> _rows(dynamic v) =>
      v is List ? v.whereType<List>().map((r) => List<dynamic>.from(r)).toList() : <List<dynamic>>[];

  factory Catalogue.fromJson(Map<String, dynamic> m) => Catalogue._(
        (m['v'] as num?)?.toInt() ?? 0,
        _rows(m['courses']),
        _rows(m['subjects']),
        _rows(m['topics']),
        _rows(m['lessons']),
        _rows(m['quizzes']),
      );
}

Catalogue _parseCatalogue(String json) =>
    Catalogue.fromJson(Map<String, dynamic>.from(jsonDecode(json) as Map));

const _catKey = 'xyndrome.catalogue.json';

/// The catalogue SHAPE this app reads. Format 4 (OPTIMIZE 10.23 L2): each
/// course comes as two parts, so a screen downloads only what it shows.
const int kCatalogueFormat = 5;

/// The list index's shape (its `If-None-Match` tag). Still 4: only the
/// lessons / quizzes parts changed in format 5 (10.25).
const int kIndexFormat = 4;

/// A format-5 part (10.25) as the rows every screen reads (format 4):
///  - ids arrive as the gap from the row before; added back up here;
///  - quiz rows arrive with ONE name and no number fields:
///    [id, course, subject, topic, lesson, general, examOnly, free, name,
///     questions, time, pass, dynamic, stamp] → the 17-field row with the name in
///    both title slots and number mode off (stamp last, 10.27).
/// A format-4 part (an older server) is returned as it is.
Map widenPart(Map part, int format) {
  if (format < 5) return part;
  List<dynamic> ungap(Object? rows) {
    var id = 0;
    return [
      for (final r in (rows as List? ?? const []))
        () {
          final row = List<dynamic>.from(r as List);
          id += (row[0] as num).toInt();
          row[0] = id;
          return row;
        }(),
    ];
  }
  final out = Map<String, dynamic>.from(part);
  if (part['lessons'] != null) out['lessons'] = ungap(part['lessons']);
  if (part['quizzes'] != null) {
    out['quizzes'] = [
      for (final q in ungap(part['quizzes']))
        [q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[8], 0, 0, q[9], q[10], q[11], q[12], q.length > 13 ? q[13] : 1],
    ];
  }
  return out;
}

/// Which part of the list a screen needs (10.23 L2).
enum CatalogueKind { lessons, quizzes }

/// The lessons list: courses, subjects, topics and lessons (Lessons, Courses,
/// Flashcards, Study Hub). Its `quizzes` are empty — see [quizCatalogueProvider].
final catalogueProvider =
    FutureProvider<Catalogue>((ref) => PerfLog.time('catalogue lessons', () => _loadCatalogue(ref, CatalogueKind.lessons)));

/// The quiz list: courses, subjects, topics and quiz sets (Q-Bank, exams,
/// results). Downloaded the first time a quiz screen needs it, never with
/// the lessons. Its `lessons` hold only lessons that quizzes point to.
final quizCatalogueProvider =
    FutureProvider<Catalogue>((ref) => PerfLog.time('catalogue quizzes', () => _loadCatalogue(ref, CatalogueKind.quizzes)));

Future<Response<String>>? _indexRequest;
int? _indexAskedWith;
DateTime _indexAskedAt = DateTime.fromMillisecondsSinceEpoch(0);

Future<Response<String>> _sharedIndex(ApiClient api, int? haveVersion) {
  final fresh = DateTime.now().difference(_indexAskedAt) < const Duration(seconds: 30);
  if (_indexRequest != null && fresh && _indexAskedWith == haveVersion) return _indexRequest!;
  _indexAskedWith = haveVersion;
  _indexAskedAt = DateTime.now();
  final request = api.dio.get<String>(
    '/student/catalogue/index',
    options: Options(
      responseType: ResponseType.plain,
      headers: {if (haveVersion != null) 'If-None-Match': '"catalogue-index-v$haveVersion-f$kIndexFormat"'},
      validateStatus: (s) => s != null && (s == 304 || (s >= 200 && s < 300)),
    ),
  );
  _indexRequest = request;
  request.catchError((_) {
    _indexRequest = null;
    return Response<String>(requestOptions: RequestOptions());
  });
  return request;
}

Future<Catalogue> _loadCatalogue(Ref ref, CatalogueKind kind) async {
  final sp = await SharedPreferences.getInstance();
  final tag = kind == CatalogueKind.lessons ? 'L' : 'Q';
  final file = 'catalogue_f${kCatalogueFormat}_$tag.json';
  final versionKey = 'xyndrome.catalogue.f$kCatalogueFormat.$tag.v';
  // Older single-catalogue copies are no longer read.
  if (sp.getString(_catKey) != null) await sp.remove(_catKey);
  final saved = await ContentFiles.read(file);
  final savedVersion = saved == null ? null : sp.getInt(versionKey);
  final wanted = catalogueVersion; // from the start-up / sign-in reply
  if (saved != null && (wanted == null || savedVersion == wanted)) {
    return compute(_parseCatalogue, saved);
  }
  // Format 5 (10.25) replaced the format-4 copies: drop them once.
  if (saved == null) await ContentFiles.deleteStartingWith(const ['catalogue_f4_', 'catpart_f4_']);
  final api = ref.read(apiClientProvider);
  try {
    // The small index first (one fingerprint per course part, per kind);
    // then only that kind's parts whose fingerprint changed, in one request.
    // 10.24: both lists share ONE index request (asked once, reused for 30 s).
    final idx = await _sharedIndex(api, saved != null && savedVersion != null ? savedVersion : null);
    if (idx.statusCode == 304 && saved != null) {
      final v = int.tryParse('${idx.headers.value('x-catalogue-version') ?? ''}');
      if (v != null) await sp.setInt(versionKey, v);
      return compute(_parseCatalogue, saved);
    }
    final index = jsonDecode(idx.data ?? '{}') as Map;
    final kindKey = kind == CatalogueKind.lessons ? 'lessonParts' : 'quizParts';
    // An older server without kinds: the combined parts carry everything.
    final split = index[kindKey] is Map;
    final hashes = Map<String, dynamic>.from((split ? index[kindKey] : index['parts']) as Map);
    final parts = <String, Map>{};
    final need = <String>[];
    for (final e in hashes.entries) {
      final raw = await ContentFiles.read('catpart_f${kCatalogueFormat}_${tag}_${e.key}.json');
      if (raw != null) {
        try {
          final m = jsonDecode(raw) as Map;
          if (m['hash'] == e.value && m['part'] is Map) {
            parts[e.key] = m['part'] as Map;
            continue;
          }
        } catch (_) {}
      }
      need.add(e.key);
    }
    if (need.isNotEmpty) {
      final res = await api.dio.get<String>(
        '/student/catalogue/parts',
        queryParameters: {'courses': need.join(','), if (split) 'kind': kind.name},
        options: Options(responseType: ResponseType.plain),
      );
      final body = jsonDecode(res.data ?? '{}') as Map;
      final format = (body['f'] as num?)?.toInt() ?? 4;
      for (final p in (body['parts'] as List? ?? const [])) {
        final part = widenPart(p as Map, format);
        final id = '${part['course']}';
        parts[id] = part;
        await ContentFiles.write('catpart_f${kCatalogueFormat}_${tag}_$id.json', jsonEncode({'hash': hashes[id], 'part': part}));
      }
    }
    // Assemble in the index's course order; quiz sets newest first, as before.
    final assembled = <String, dynamic>{
      'v': index['v'],
      'courses': index['courses'],
      'subjects': <dynamic>[],
      'topics': <dynamic>[],
      'lessons': <dynamic>[],
      'quizzes': <dynamic>[],
    };
    for (final c in (index['courses'] as List)) {
      final part = parts['${(c as List)[0]}'];
      if (part == null) continue;
      for (final k in ['subjects', 'topics', 'lessons', 'quizzes']) {
        (assembled[k] as List).addAll(part[k] as List? ?? const []);
      }
    }
    (assembled['quizzes'] as List).sort((x, y) => ((y as List)[0] as num).compareTo((x as List)[0] as num));
    final json = jsonEncode(assembled);
    final cat = await compute(_parseCatalogue, json);
    await ContentFiles.write(file, json);
    await sp.setInt(versionKey, cat.version);
    return cat;
  } catch (_) {
    if (saved != null) return compute(_parseCatalogue, saved); // offline: the copy we have
    rethrow;
  }
}

/// This student's own state, read by their user id on the server:
/// plan access, lesson progress and quiz progress (only what they used).
class StudentProgress {
  final bool paid;
  final bool full;
  final Set<int> courseIds;
  final Set<int> lessonIds;
  final bool quizFull;
  final Set<int> quizCourseIds;
  final bool features;
  /// A PAID plan (not the free plan) — 10.19: the Planner's gate, from the
  /// progress reply instead of /subscriptions/me. Null from an older server.
  final bool? paidPlan;
  /// Today's 4 goals on the server (lesson 1 · exam 2 · practice 4 · flashcards 8), 10.28.
  final int todayBits;
  final Map<int, List<int>> lessons; // id → [status 0/1/2, percent]
  final Map<int, List<num>> quizzes; // id → [examAttempts, practiceDone, latestAttemptId, bestPct]
  /// Quiz marks (OPTIMIZE 10.16): byte per quiz id — top bit passed, 7 bits best % + 1, 0 = not done.
  final Map<int, int> quizMarks;
  /// The 5 recent results (one per different quiz), oldest first.
  final List<Map<String, dynamic>> recentResults;

  StudentProgress._({
    required this.paid,
    required this.full,
    required this.courseIds,
    required this.lessonIds,
    required this.quizFull,
    required this.quizCourseIds,
    required this.features,
    this.paidPlan,
    this.todayBits = 0,
    required this.lessons,
    required this.quizzes,
    this.quizMarks = const {},
    this.recentResults = const [],
  });

  /// Best whole % for a quiz (null = not done).
  int? quizBest(int id) {
    final b = quizMarks[id] ?? 0;
    return b == 0 ? null : (b & 127) - 1;
  }

  bool quizPassed(int id) => ((quizMarks[id] ?? 0) & 128) != 0;

  /// The free-slot rule (OPTIMIZE 10.18), worked out from data the phone
  /// already holds — no request, no wait. A new exam may start when fewer than
  /// 5 results are kept, when it is a redo (it takes its own slot), or when any
  /// result is passed AND reviewed. Otherwise returns the quiz id the student
  /// should review / pass first (the oldest not-free result), else null.
  int? examBlocker(int quizId) => examBlockerIn(recentResults, quizId);
  bool examBlockerPassed(int blockerId) => examBlockerPassedIn(recentResults, blockerId);

  static Set<int> _ids(dynamic v) => v is List ? v.map((e) => (e as num).toInt()).toSet() : <int>{};

  factory StudentProgress.fromJson(dynamic raw) {
    final m = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final a = m['access'] is Map ? Map<String, dynamic>.from(m['access']) : <String, dynamic>{};
    final lessons = <int, List<int>>{};
    final bits = m['lessonsBits'];
    if (bits is String) {
      // Finished lessons as a bitmap (OPTIMIZE 10.14): bit n = lesson id n.
      for (final id in decodeLessonBits(bits)) {
        lessons[id] = const [2, 100];
      }
    } else {
      for (final r in (m['lessons'] is List ? m['lessons'] as List : const [])) {
        if (r is List && r.length >= 3) lessons[(r[0] as num).toInt()] = [(r[1] as num).toInt(), (r[2] as num).toInt()];
      }
    }
    final quizzes = <int, List<num>>{};
    for (final r in (m['quizzes'] is List ? m['quizzes'] as List : const [])) {
      if (r is List && r.length >= 5) quizzes[(r[0] as num).toInt()] = [r[1] as num, r[2] as num, r[3] as num, r[4] as num];
    }
    // Quiz marks as a byte map (10.16): also fills the older per-quiz shape
    // (sat = 1 attempt, best %) so the lists keep working unchanged.
    final quizMarks = <int, int>{};
    if (m['quizMarks'] is String && (m['quizMarks'] as String).isNotEmpty) {
      final bytes = base64Decode(m['quizMarks'] as String);
      for (var i = 0; i < bytes.length; i++) {
        if (bytes[i] == 0) continue;
        quizMarks[i] = bytes[i];
        quizzes.putIfAbsent(i, () => [1, 0, 0, (bytes[i] & 127) - 1]);
      }
    }
    final recent = <Map<String, dynamic>>[
      for (final e in (m['recentResults'] is List ? m['recentResults'] as List : const []))
        if (e is Map) Map<String, dynamic>.from(e),
    ];
    return StudentProgress._(
      paid: a['paid'] == true,
      full: a['full'] == true,
      courseIds: _ids(a['courseIds']),
      lessonIds: _ids(a['lessonIds']),
      quizFull: a['quizFull'] == true,
      quizCourseIds: _ids(a['quizCourseIds']),
      features: a['features'] == true,
      paidPlan: a['paidPlan'] is bool ? a['paidPlan'] as bool : null,
      todayBits: (m['todayBits'] as num?)?.toInt() ?? 0,
      lessons: lessons,
      quizzes: quizzes,
      quizMarks: quizMarks,
      recentResults: recent,
    );
  }

  /// Same rule as the server: free, or full access, or the course / lesson in the plan.
  bool canOpenLesson(int lessonId, int courseId, bool isFree) =>
      isFree || (paid && (full || courseIds.contains(courseId) || lessonIds.contains(lessonId)));

  bool canOpenQuiz(int courseId, bool isFree) => isFree || (paid && (quizFull || quizCourseIds.contains(courseId)));

  bool lessonDone(int id) => (lessons[id]?[0] ?? 0) == 2;
}

// ── Finished lessons as a bitmap, cached with a version (OPTIMIZE 10.14) ────
// The server keeps one bit per lesson id; the phone keeps the bitmap and its
// version in its saved progress. Requests send "userId:version": the server
// answers "unchanged" (no bits) when it matches, else sends the bitmap.

/// Lesson ids whose bit is on (lowest bit first in each byte).
List<int> decodeLessonBits(String b64) {
  if (b64.isEmpty) return const [];
  final bytes = base64Decode(b64);
  final out = <int>[];
  for (var i = 0; i < bytes.length; i++) {
    final byte = bytes[i];
    if (byte == 0) continue;
    for (var bit = 0; bit < 8; bit++) {
      if (byte & (1 << bit) != 0) out.add(i * 8 + bit);
    }
  }
  return out;
}

/// The bitmap with one more lesson's bit turned on.
String setLessonBit(String b64, int lessonId) {
  final bytes = b64.isEmpty ? Uint8List(0) : base64Decode(b64);
  final idx = lessonId ~/ 8;
  final out = Uint8List(bytes.length > idx ? bytes.length : idx + 1)..setRange(0, bytes.length, bytes);
  out[idx] |= 1 << (lessonId % 8);
  return base64Encode(out);
}

/// "userId:version" of the saved progress for [uid] (null if none).
Future<String?> savedProgressVersion({String? uid}) async {
  final who = uid ?? LocalScope.uid;
  final saved = await readSaved('progress', uid: who);
  if (saved is! Map || saved['lessonsBits'] is! String) return null;
  final v = (saved['lessonsVersion'] as num?)?.toInt();
  return v == null || v <= 0 ? null : '$who:$v';
}

/// A progress reply made whole: "unchanged" takes the bitmap from the saved copy.
Future<Object?> mergeProgress(Object? raw) async {
  // 10.28: practice numbering continues after the server's last applied one.
  if (raw is Map && raw['practiceSeq'] is num) await PracticeQueue.seed((raw['practiceSeq'] as num).toInt());
  if (raw is! Map || raw['lessonsUnchanged'] != true) return raw;
  final saved = await readSaved('progress');
  final merged = Map<String, dynamic>.from(raw)..remove('lessonsUnchanged');
  merged['lessonsBits'] = saved is Map && saved['lessonsBits'] is String ? saved['lessonsBits'] : '';
  // Unchanged covers the quiz marks and recent results too (same version).
  if (saved is Map) {
    if (saved['quizMarks'] is String) merged['quizMarks'] = saved['quizMarks'];
    if (saved['recentResults'] is List) merged['recentResults'] = saved['recentResults'];
  }
  return merged;
}

/// After an exam (10.16): set the quiz's byte (passed stays on, best % only
/// rises), replace / add its recent entry (5 kept, oldest dropped) and keep the
/// server's new version — no progress download.
/// True when a recent result frees its slot (passed AND reviewed, 10.18).
bool recentSlotFree(Map e) => e['passed'] == true && e['reviewed'] == true;

/// See [StudentProgress.examBlocker].
int? examBlockerIn(List<Map<String, dynamic>> recent, int quizId) {
  if (recent.length < 5) return null;
  if (recent.any((e) => '${e['k']}' == '$quizId')) return null;
  if (recent.any(recentSlotFree)) return null;
  int idOf(Map e) => e['quizId'] is num ? (e['quizId'] as num).toInt() : int.tryParse('${e['quizId']}') ?? 0;
  // 2026-11-18: a PASSED result that only needs its review is the quickest
  // way to free a slot — point there first (it used to always point at the
  // oldest result, often a failed one that a review alone can't free).
  for (final e in recent.reversed) {
    if (e['passed'] == true && e['reviewed'] != true) return idOf(e);
  }
  return idOf(recent.first);
}

/// True when the blocking result is already passed (it only needs its review).
bool examBlockerPassedIn(List<Map<String, dynamic>> recent, int blockerId) =>
    recent.any((e) => '${e['k']}' == '$blockerId' && e['passed'] == true);

Future<void> applyExamLocally(int quizId, int pct, bool passed, int? serverVersion, {int? correct, int? wrong}) async {
  final saved = await readSaved('progress');
  if (saved is! Map) {
    freshNext('progress');
    return;
  }
  final m = Map<String, dynamic>.from(saved);
  final bytes = (m['quizMarks'] is String && (m['quizMarks'] as String).isNotEmpty)
      ? base64Decode(m['quizMarks'] as String)
      : Uint8List(0);
  final out = Uint8List(bytes.length > quizId ? bytes.length : quizId + 1)..setRange(0, bytes.length, bytes);
  final old = out[quizId];
  final oldBest = old == 0 ? -1 : (old & 127) - 1;
  final best = pct > oldBest ? pct : oldBest;
  out[quizId] = ((old & 128) != 0 || passed ? 128 : 0) + best.clamp(0, 100) + 1;
  m['quizMarks'] = base64Encode(out);
  final recent = [
    for (final e in (m['recentResults'] is List ? m['recentResults'] as List : const []))
      if (e is Map && '${e['k']}' != '$quizId') Map<String, dynamic>.from(e),
  ]..add({
      'k': '$quizId', 'quizId': quizId, 'pct': pct, 'passed': passed, 'reviewed': false,
      'at': DateTime.now().toUtc().toIso8601String(),
      // Correct / wrong counts, as the server keeps them (Results shows them).
      'c': ?correct, 'w': ?wrong,
    });
  // Same rule as the server (10.18): past 5 the oldest FREE result (passed
  // and reviewed) makes room; failed / unreviewed results stay.
  while (recent.length > 5) {
    final free = recent.indexWhere(recentSlotFree);
    recent.removeAt(free >= 0 && free < recent.length - 1 ? free : 0);
  }
  m['recentResults'] = recent;
  final had = (m['lessonsVersion'] as num?)?.toInt() ?? 0;
  if (serverVersion != null) m['lessonsVersion'] = serverVersion;
  await seedSaved('progress', m);
  if (serverVersion == null || serverVersion != had + 1) freshNext('progress');
}

/// Whether this recent result is already marked reviewed on the phone (10.27 R2).
Future<bool> recentReviewedLocally(int quizId) async {
  final saved = await readSaved('progress');
  if (saved is! Map) return false;
  for (final e in (saved['recentResults'] is List ? saved['recentResults'] as List : const [])) {
    if (e is Map && '${e['k']}' == '$quizId') return e['reviewed'] == true;
  }
  return false;
}

/// Review finished (10.16): the recent entry's "reviewed" flag, locally.
/// [alreadyOnServer]: the server had it already (10.27 R2) — nothing to refresh.
Future<void> markReviewedLocally(int quizId, int? serverVersion, {bool alreadyOnServer = false}) async {
  final saved = await readSaved('progress');
  if (saved is! Map) return;
  final m = Map<String, dynamic>.from(saved);
  m['recentResults'] = [
    for (final e in (m['recentResults'] is List ? m['recentResults'] as List : const []))
      if (e is Map) {...Map<String, dynamic>.from(e), if ('${e['k']}' == '$quizId') 'reviewed': true},
  ];
  final had = (m['lessonsVersion'] as num?)?.toInt() ?? 0;
  if (serverVersion != null) m['lessonsVersion'] = serverVersion;
  await seedSaved('progress', m);
  if (alreadyOnServer) return;
  if (serverVersion == null || serverVersion != had + 1) freshNext('progress');
}

/// After "Done": flip the lesson's bit in the saved progress and keep the
/// server's new version — no progress download. If the version is not the
/// saved one + 1, something else changed too (another device, the website):
/// the next progress read asks for the fresh bitmap instead.
Future<void> markLessonDoneLocally(int lessonId, int? serverVersion) async {
  final saved = await readSaved('progress');
  if (saved is! Map || saved['lessonsBits'] is! String) {
    freshNext('progress');
    return;
  }
  final m = Map<String, dynamic>.from(saved);
  final had = (m['lessonsVersion'] as num?)?.toInt() ?? 0;
  m['lessonsBits'] = setLessonBit(m['lessonsBits'] as String, lessonId);
  if (serverVersion != null) m['lessonsVersion'] = serverVersion;
  await seedSaved('progress', m);
  if (serverVersion == null || serverVersion != had + 1) freshNext('progress');
}

final studentProgressProvider = FutureProvider<StudentProgress>((ref) async {
  ref.watch(userScopeProvider);
  // freshNext() for lessons, quizzes, courses, results or billing means the
  // student just changed something: ask again (the saved copy is skipped).
  void changed() => ref.invalidateSelf();
  progressChanged.addListener(changed);
  ref.onDispose(() => progressChanged.removeListener(changed));
  final api = ref.read(apiClientProvider);
  PerfLog.mark('progress requested');
  return savedFirst(
    ref,
    name: 'progress',
    fetch: () async {
      final have = await savedProgressVersion();
      final res = await api.dio.get('/student/progress', queryParameters: {'format': 'bits', 'v': ?have});
      return mergeProgress(res.data);
    },
    parse: (raw) async => StudentProgress.fromJson(raw),
  );
});
