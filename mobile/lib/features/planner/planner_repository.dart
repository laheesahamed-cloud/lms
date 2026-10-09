import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);

class PlannerTask {
  final int id;
  final String title;
  final String description;
  final String dueDate; // 'YYYY-MM-DD' or ''
  final String status; // 'todo' | 'done'
  final String category; // general | lesson | quiz | exam | review | flashcards
  final String priority; // low | medium | high

  PlannerTask({
    required this.id,
    required this.title,
    required this.description,
    required this.dueDate,
    required this.status,
    required this.category,
    required this.priority,
  });

  bool get done => status == 'done';

  /// Parsed due date (local, date-only) or null.
  DateTime? get due {
    if (dueDate.length < 10) return null;
    final p = dueDate.substring(0, 10).split('-');
    if (p.length != 3) return null;
    final y = int.tryParse(p[0]), m = int.tryParse(p[1]), d = int.tryParse(p[2]);
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }

  factory PlannerTask.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return PlannerTask(
      id: _i(m['id']),
      title: _s(m['title']),
      description: _s(m['description']),
      dueDate: _s(m['dueDate'] ?? m['due_date']),
      status: _s(m['status'].toString().isEmpty ? 'todo' : m['status']),
      category: _s(m['category'].toString().isEmpty ? 'general' : m['category']),
      priority: _s(m['priority'].toString().isEmpty ? 'medium' : m['priority']),
    );
  }
}

final plannerTasksProvider = FutureProvider.autoDispose<List<PlannerTask>>((ref) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/student/planner');
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map ? (data['tasks'] ?? data['items'] ?? data['data'] ?? const []) : const []);
  return (rows as List).map(PlannerTask.fromJson).toList();
});

final plannerApiProvider = Provider((ref) => ref.read(apiClientProvider));

/// Create a task; returns the new task id (for scheduling its reminder).
Future<int> createPlannerTask(
  ApiClient api, {
  required String title,
  String? dueDate, // 'YYYY-MM-DD'
  String category = 'general',
  String priority = 'medium',
  String? description,
}) async {
  final res = await api.dio.post('/student/planner', data: {
    'title': title,
    if (dueDate != null && dueDate.isNotEmpty) 'dueDate': dueDate,
    'category': category,
    'priority': priority,
    if (description != null && description.isNotEmpty) 'description': description,
  });
  final d = res.data;
  return d is Map ? _i(d['id']) : 0;
}

/// One task as the bulk endpoint wants it.
class NewPlannerTask {
  final String title;
  final String? dueDate; // 'YYYY-MM-DD'
  final String category;
  final String priority;
  final String? description;
  const NewPlannerTask({
    required this.title,
    this.dueDate,
    this.category = 'general',
    this.priority = 'medium',
    this.description,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        if (dueDate != null && dueDate!.isNotEmpty) 'dueDate': dueDate,
        'category': category,
        'priority': priority,
        if (description != null && description!.isNotEmpty) 'description': description,
      };
}

/// Creates a whole generated plan in ONE request.
///
/// The old path was one POST per task, every one fired at once: a few hundred
/// simultaneous requests from one phone, which queued other students behind
/// them and could leave half a plan if the connection dropped. This is one
/// request, one transaction, all-or-nothing.
///
/// Throws [PlannerBulkUnsupported] if the server has not been updated yet, so
/// the caller can fall back rather than failing in front of the student —
/// the app and the backend are deployed separately here.
Future<List<int>> createPlannerTasksBulk(
  ApiClient api,
  List<NewPlannerTask> tasks,
) async {
  try {
    final res = await api.dio.post('/student/planner/bulk', data: {
      'tasks': tasks.map((t) => t.toJson()).toList(),
    });
    final d = res.data;
    final ids = (d is Map && d['ids'] is List) ? d['ids'] as List : const [];
    return ids.map(_i).toList();
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) throw const PlannerBulkUnsupported();
    rethrow;
  }
}

/// The server predates the bulk endpoint.
class PlannerBulkUnsupported implements Exception {
  const PlannerBulkUnsupported();
  @override
  String toString() => 'Planner bulk endpoint not available on this server';
}

Future<void> setPlannerTaskDone(ApiClient api, int id, bool done) async {
  await api.dio.patch('/student/planner/$id', data: {'status': done ? 'done' : 'todo'});
}

Future<void> deletePlannerTask(ApiClient api, int id) async {
  await api.dio.delete('/student/planner/$id');
}
