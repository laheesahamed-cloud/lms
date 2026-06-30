import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import 'note_models.dart';

/// Fetches the AI note for a lesson. The authoritative backend route is
/// `GET /ai-notes/student/lesson/:lessonId` (controller `@Controller('ai-notes')`);
/// the web's `/student/ai-notes/lesson/:lessonId` is tried as a fallback.
/// Honors subscription gating: a locked lesson returns a NoteDoc with
/// `locked == true` (the canvas shows the upgrade screen). No mock content —
/// an accessible lesson with no generated note returns an empty NoteDoc.
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

  // Prefer a result that is locked or has real content over an empty one.
  final a = await tryGet('/ai-notes/student/lesson/$lessonId');
  if (a != null && (a.locked || !a.isEmpty)) return a;
  final b = await tryGet('/student/ai-notes/lesson/$lessonId');
  if (b != null && (b.locked || !b.isEmpty)) return b;
  // Fallback: id may be the note's own id (topic-level notes without a lesson link)
  final c = await tryGet('/ai-notes/$lessonId');
  if (c != null && (c.locked || !c.isEmpty)) return c;
  return a ?? b ?? c ?? NoteDoc.empty();
});

/// The student's AI-notes list — `GET /student/ai-notes`.
final notesListProvider = FutureProvider.autoDispose<List<NoteListItem>>((ref) async {
  ref.watch(currentUserIdProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get(
    '/student/ai-notes',
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
