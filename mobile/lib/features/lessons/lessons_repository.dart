import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import '../../services/xp_gain.dart';
import 'lesson_models.dart';

/// Fetches the AI note for a lesson via GET /lessons/:id/note.
final lessonDocProvider =
    FutureProvider.autoDispose.family<LessonDoc, String>((ref, lessonId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);

  Future<LessonDoc?> tryGet(String path) async {
    try {
      final res = await api.dio.get(
        path,
        queryParameters: const {'engine': 'gemini'},
      );
      return LessonDoc.fromApi(res.data);
    } catch (_) {
      return null;
    }
  }

  final raw = await tryGet('/lessons/$lessonId/note');
  if (raw != null && (raw.locked || !raw.isEmpty)) return raw;
  return raw ?? LessonDoc.empty();
});

/// Marks a lesson as completed via PATCH /courses/student/lessons/:id/progress.
Future<XpGain?> markLessonComplete(ApiClient api, String lessonId) async {
  final res = await api.dio.patch(
    '/courses/student/lessons/$lessonId/progress',
    data: {'status': 'completed', 'progressPercent': 100},
  );
  // What the completion paid in XP. The server decides it; this only shows it.
  final data = res.data;
  return data is Map ? XpGain.fromJson(data['xp']) : null;
}

/// Tells the server the lesson screen has opened. Starts the clock its
/// "at least 60 seconds" XP check reads. Fire-and-forget: if it never lands,
/// the lesson still completes, it just does not pay XP.
void markLessonOpened(ApiClient api, String lessonId) {
  api.dio
      .post('/courses/student/lessons/$lessonId/opened')
      .catchError((_) => Response<dynamic>(requestOptions: RequestOptions()));
}

/// The student's lessons notes list — GET /lessons/canvas/student/notes.
/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
final lessonsListProvider = FutureProvider<List<LessonListItem>>((ref) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get(
    '/lessons/canvas/student/notes',
    queryParameters: const {'engine': 'gemini'},
  );
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map
          ? (data['notes'] ?? data['aiNotes'] ?? data['items'] ?? data['data'] ?? const [])
          : const []);
  return compute(
    (List<dynamic> r) => r.map(LessonListItem.fromJson).toList(),
    rows as List<dynamic>,
  );
});
