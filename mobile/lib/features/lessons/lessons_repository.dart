import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import 'lesson_models.dart';

/// Fetches the AI note for a lesson via GET /lessons/:id/note.
final lessonDocProvider =
    FutureProvider.autoDispose.family<LessonDoc, String>((ref, lessonId) async {
  ref.watch(currentUserIdProvider);
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
Future<void> markLessonComplete(ApiClient api, String lessonId) async {
  await api.dio.patch(
    '/courses/student/lessons/$lessonId/progress',
    data: {'status': 'completed', 'progressPercent': 100},
  );
}

/// The student's lessons notes list — GET /lessons/canvas/student/notes.
final lessonsListProvider = FutureProvider.autoDispose<List<LessonListItem>>((ref) async {
  ref.watch(currentUserIdProvider);
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
