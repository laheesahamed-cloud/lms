import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import 'plan_generator.dart';

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
  // The real lesson, quiz or flashcard deck this task stands for (set when a
  // plan generated it). Null for tasks the student typed in, which are the only
  // ones that can be swiped done.
  final String? itemType; // 'lesson' | 'quiz' | 'flashcards'
  final int? itemId;
  // On a saved plan's one row: the rule the app expands into days (kind,
  // courseId, hours, byDay, until, skip). Null on an ordinary task.
  final Map<String, dynamic>? rule;
  // On a task the app worked out from a rule: the row it came from.
  final int? ruleId;

  PlannerTask({
    required this.id,
    required this.title,
    required this.description,
    required this.dueDate,
    required this.status,
    required this.category,
    required this.priority,
    this.itemType,
    this.itemId,
    this.rule,
    this.ruleId,
  });

  bool get done => status == 'done';

  /// Made by a plan and tied to a real lesson, quiz or deck. Such a task is
  /// finished by doing that thing, never by swiping it.
  bool get isLinked =>
      (itemType == 'lesson' || itemType == 'quiz' || itemType == 'flashcards') && itemId != null;

  PlannerTask withStatus(String newStatus) => PlannerTask(
        id: id,
        title: title,
        description: description,
        dueDate: dueDate,
        status: newStatus,
        category: category,
        priority: priority,
        itemType: itemType,
        itemId: itemId,
        rule: rule,
        ruleId: ruleId,
      );

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
      itemType: (m['itemType'] == 'lesson' || m['itemType'] == 'quiz' || m['itemType'] == 'flashcards')
          ? m['itemType'] as String
          : null,
      itemId: _i(m['itemId']) > 0 ? _i(m['itemId']) : null,
      rule: m['rule'] is Map ? Map<String, dynamic>.from(m['rule'] as Map) : null,
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
  final all = (rows as List).map(PlannerTask.fromJson).toList();
  final rules = all.where((t) => t.rule != null).toList();
  if (rules.isEmpty) return all;
  // A saved plan is one row; the days are worked out here from the lesson,
  // quiz and deck lists the app already holds.
  List<PlannerTask> expanded = const [];
  try {
    expanded = await expandPlanRules(ref.read, rules);
  } catch (_) {}
  return [...all.where((t) => t.rule == null), ...expanded];
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
  String? itemType,
  int? itemId,
}) async {
  final res = await api.dio.post('/student/planner', data: {
    'title': title,
    if (itemType != null && itemId != null) ...{'itemType': itemType, 'itemId': itemId},
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
  final String? itemType; // 'lesson' | 'quiz' | 'flashcards'
  final int? itemId;
  final Map<String, dynamic>? rule; // a whole plan as one row
  const NewPlannerTask({
    required this.title,
    this.dueDate,
    this.category = 'general',
    this.priority = 'medium',
    this.description,
    this.itemType,
    this.itemId,
    this.rule,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        if (dueDate != null && dueDate!.isNotEmpty) 'dueDate': dueDate,
        'category': category,
        'priority': priority,
        if (description != null && description!.isNotEmpty) 'description': description,
        if (itemType != null && itemId != null) ...{'itemType': itemType, 'itemId': itemId},
        if (rule != null) 'rule': rule,
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

/// Saves plan rules (one row per course and kind). [supported] is false when
/// the server predates rules and stored them as plain tasks; the caller then
/// removes those rows and falls back to one row per item.
Future<({List<int> ids, bool supported})> createPlannerRules(
  ApiClient api,
  List<NewPlannerTask> rules,
) async {
  try {
    final res = await api.dio.post('/student/planner/bulk', data: {
      'tasks': rules.map((t) => t.toJson()).toList(),
    });
    final d = res.data;
    final ids = (d is Map && d['ids'] is List) ? (d['ids'] as List).map(_i).toList() : <int>[];
    return (ids: ids, supported: d is Map && d['rules'] == true);
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

/// Clears the whole planner in ONE request. Clearing used to send one delete
/// per task, every one at once: hundreds of simultaneous requests from one
/// phone for a big plan. Throws [PlannerClearUnsupported] if the server has
/// not been updated yet, so the caller can fall back.
Future<void> clearPlannerTasks(ApiClient api) async {
  try {
    await api.dio.delete('/student/planner');
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) throw const PlannerClearUnsupported();
    rethrow;
  }
}

/// The server predates the clear-all endpoint.
class PlannerClearUnsupported implements Exception {
  const PlannerClearUnsupported();
  @override
  String toString() => 'Planner clear-all endpoint not available on this server';
}

Future<void> deletePlannerTask(ApiClient api, int id) async {
  await api.dio.delete('/student/planner/$id');
}
