import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import 'note_models.dart';

/// Fetches the AI note for a lesson via GET /lessons/:id/note.
final lessonNoteProvider =
    FutureProvider.autoDispose.family<NoteDoc, String>((ref, lessonId) async {
  ref.watch(currentUserIdProvider);
  final api = ref.read(apiClientProvider);

  Future<NoteDoc?> tryGet(String path) async {
    try {
      final res = await api.dio.get(
        path,
        queryParameters: const {'engine': 'gemini'},
      );
      return NoteDoc.fromApi(res.data);
    } catch (_) {
      return null;
    }
  }

  final a = await tryGet('/lessons/$lessonId/note');
  if (a != null && (a.locked || !a.isEmpty)) return a;
  return a ?? NoteDoc.empty();
});

/// Marks a lesson as completed via PATCH /courses/student/lessons/:id/progress.
Future<void> markLessonComplete(ApiClient api, String lessonId) async {
  await api.dio.patch(
    '/courses/student/lessons/$lessonId/progress',
    data: {'status': 'completed', 'progressPercent': 100},
  );
}

/// The student's lessons notes list — GET /lessons/canvas/student/notes.
final notesListProvider = FutureProvider.autoDispose<List<NoteListItem>>((ref) async {
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
  return (rows as List).map(NoteListItem.fromJson).toList();
});
