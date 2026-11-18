import '../data/api_client.dart';
import 'practice_queue.dart';

/// Practices that waited 12 hours with no main request to ride along with —
/// or [force] (before sign-out) — are sent once on their own (OPTIMIZE 10.28).
/// The body is just `{}`: the ApiClient adds the waiting practices, and the
/// server's `X-Practices-Applied` answer clears them.
Future<void> syncPracticesIfOverdue(ApiClient api, {bool force = false}) async {
  try {
    final waiting = await PracticeQueue.pending();
    if (waiting.isEmpty) return;
    if (!force && !await PracticeQueue.overdue()) return;
    await api.dio.post('/student/dashboard/sync', data: <String, dynamic>{});
  } catch (_) {
    // Offline or signed out: they stay on the phone and go later.
  }
}
