import '../../state/content_files.dart';
import 'dart:convert';
import 'dart:async';
import '../../core/perf_log.dart';
import '../../state/catalogue.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import '../../services/xp_gain.dart';
import 'lesson_models.dart';

/// Saved-lesson format (10.32: 2 = the website's lesson, not reshaped).
const _lessonFormat = 2;

/// Fetches the AI note for a lesson via GET /lessons/:id/note.
final lessonDocProvider =
    FutureProvider.autoDispose.family<LessonDoc, String>((ref, lessonId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final id = int.tryParse(lessonId) ?? 0;

  // Step 5: an opened lesson is kept on the phone (a file) and reused until
  // the lesson itself changes (its stamp in the catalogue), so opening it
  // again costs no request. Only lessons this student may open are kept/used.
  Catalogue? cat;
  StudentProgress? prog;
  try {
    cat = await ref.read(catalogueProvider.future);
    prog = await ref.read(studentProgressProvider.future);
  } catch (_) {}
  final row = cat?.lessonById[id];
  final stamp = (row != null && row.length > 11) ? (row[11] as num).toInt() : 0;
  final course = row == null ? null : cat?.courseById[row[1] as int];
  final canOpen = row != null && prog != null && prog.canOpenLesson(id, row[1] as int, row[5] == 1);
  Map<String, dynamic> withCourse(Map data) => {
        ...Map<String, dynamic>.from(data),
        if (data['courseTitle'] == null && course != null) 'courseTitle': '${course[1]}',
      };

  if (canOpen && stamp > 0) {
    final saved = await ContentFiles.read('lesson_$id.json');
    if (saved != null) {
      try {
        final m = jsonDecode(saved) as Map;
        // 10.32: copies saved before the server stopped reshaping lessons
        // (format 1, no 'f') are ignored and downloaded once more.
        if ((m['stamp'] as num?)?.toInt() == stamp && m['f'] == _lessonFormat && m['data'] is Map) {
          return LessonDoc.fromApi(withCourse(m['data'] as Map));
        }
      } catch (_) {}
    }
  }

  try {
    final res = await api.dio.get('/lessons/$lessonId/note', queryParameters: const {'engine': 'gemini'});
    final data = res.data;
    if (data is! Map) return LessonDoc.fromApi(data);
    final doc = LessonDoc.fromApi(withCourse(data));
    if (canOpen && stamp > 0 && data['accessLocked'] != true) {
      unawaited(ContentFiles.write('lesson_$id.json', jsonEncode({'stamp': stamp, 'f': _lessonFormat, 'data': data})));
    }
    return doc;
  } catch (_) {
    return LessonDoc.empty();
  }
});

/// Marks a lesson as completed via PATCH /courses/student/lessons/:id/progress.
/// [readSeconds]: how long the lesson screen was open (the phone's timer; the
/// server pays lesson XP from it). [subjectId]: for today's Study Hub row.
/// Returns the XP it paid and the finished-lessons bitmap's new version (10.14).
Future<({XpGain? xp, int? progressVersion})> markLessonComplete(ApiClient api, String lessonId,
    {int? readSeconds, int? subjectId}) async {
  final res = await api.dio.patch(
    '/courses/student/lessons/$lessonId/progress',
    data: {
      'status': 'completed',
      'progressPercent': 100,
      'readSeconds': ?readSeconds,
      'subjectId': ?subjectId,
    },
  );
  // What the completion paid in XP. The server decides it; this only shows it.
  final data = res.data;
  if (data is! Map) return (xp: null, progressVersion: null);
  return (xp: XpGain.fromJson(data['xp']), progressVersion: (data['progressVersion'] as num?)?.toInt());
}

/// The student's lessons notes list — GET /lessons/canvas/student/notes.
/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
/// Every ready lesson with this student's completion and lock state. Built on
/// the phone from the shared catalogue and the student's progress (step 5):
/// no lesson-list request; the catalogue changes only with the content
/// version, progress only when the student does something.
final lessonsListProvider = FutureProvider<List<LessonListItem>>((ref) async {
  ref.watch(userScopeProvider);
  final cat = await ref.watch(catalogueProvider.future);
  final prog = await ref.watch(studentProgressProvider.future);
  final items = buildLessonItems(cat, prog);
  PerfLog.mark('lessons list built (${items.length})');
  return items;
});

List<LessonListItem> buildLessonItems(Catalogue cat, StudentProgress prog) {
  final out = <LessonListItem>[];
  for (final l in cat.lessons) {
    final id = l[0] as int, courseId = l[1] as int;
    final course = cat.courseById[courseId];
    final isFree = l[5] == 1;
    final canOpen = prog.canOpenLesson(id, courseId, isFree);
    out.add(LessonListItem(
      id: '$id',
      lessonId: '$id',
      lessonTitle: '${l[4]}',
      title: '${l[4]}'.isNotEmpty ? '${l[4]}' : 'Untitled note',
      courseTitle: '${course?[1] ?? ''}',
      courseId: '$courseId',
      examType: '${course?[3] ?? ''}',
      subjectName: '${cat.subjectById[l[2]]?[2] ?? ''}',
      topicName: '${cat.topicById[l[3]]?[2] ?? ''}',
      lessonCompleted: prog.lessonDone(id),
      hasPdf: l[7] == 1,
      hasNote: l[6] == 1,
      locked: !canOpen,
      lockReason: canOpen
          ? ''
          : (prog.paid ? 'Your package only unlocks selected course or lesson content.' : 'Upgrade to access this feature'),
    ));
  }
  return out;
}
