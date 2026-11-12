import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';
import '../courses/courses_repository.dart';
import '../lessons/lessons_repository.dart';
import '../flashcards/flashcards_repository.dart';
import '../quizzes/quizzes_repository.dart';
import 'planner_repository.dart';

/// Rough minutes-per-item, just enough to know how many items fit in one
/// day's study-hours budget — not meant to be a precise time estimate.
const _kDurationHours = {
  'lesson': 0.5,
  'quiz': 0.33,
  'flashcards': 0.25,
};

class _PlanItem {
  final String title;
  final String category; // matches PlannerTask.category
  final String description;
  // The real lesson or quiz, so the planner can tell when it is really done.
  final String? itemType;
  final int? itemId;
  // Already finished when the list was read. Kept in the list so a plan's days
  // do not move as the student finishes things.
  final bool done;
  const _PlanItem(this.title, this.category, this.description,
      {this.itemType, this.itemId, this.done = false});
}

String _joinCourseSubject(String courseTitle, String subject) {
  final c = courseTitle.trim();
  final s = subject.trim();
  if (s.isEmpty || s == c) return c;
  return '$c \u00B7 $s';
}

/// Everything of one kind in one course, in course order. Reads the lists the
/// Lessons, Q-Bank and Flashcards screens already hold, so no request is made
/// that the app was not making anyway.
typedef PlanRead = T Function<T>(ProviderListenable<T> provider);

Future<List<_PlanItem>> _collect(PlanRead read, String kind, String courseId) async {
  final out = <_PlanItem>[];
  if (kind == 'lesson') {
    // The server sends the list in course order, so walking it as it comes IS
    // the course order.
    final all = await read(lessonsListProvider.future);
    for (final l in all) {
      if (l.courseId != courseId) continue;
      if (!l.lessonExists || l.locked) continue;
      // A topic-level note has no lesson to finish, so it cannot be tracked.
      final lessonId = int.tryParse(l.lessonId);
      if (lessonId == null) continue;
      out.add(_PlanItem(l.title, 'lesson', _joinCourseSubject(l.courseTitle, l.subjectName),
          itemType: 'lesson', itemId: lessonId, done: l.lessonCompleted));
    }
  } else if (kind == 'quiz') {
    final quizzes = await read(quizListProvider.future);
    var i = 0;
    // The raw list comes newest-first; the Q-Bank screen shows sets in
    // hierarchy order (subject, topic, lesson, set number), so do the same.
    final ordered = sortQuizzesByHierarchy(
        quizzes.where((q) => q.courseId == courseId && !q.locked).toList());
    for (final q in ordered) {
      final subject = [q.subjectName, q.lessonTitle]
          .firstWhere((s) => s.trim().isNotEmpty, orElse: () => '');
      out.add(_PlanItem(q.rowLabel(i), 'quiz', _joinCourseSubject(q.courseTitle, subject),
          itemType: 'quiz', itemId: int.tryParse(q.id), done: q.isCompleted));
      i++;
    }
  } else if (kind == 'flashcards') {
    final courses = await read(studentCoursesProvider.future);
    final wanted = courses.where((c) => c.id == courseId).map((c) => c.title).toSet();
    final decksResult = await read(flashDecksProvider.future);
    // Only leaf (lesson-level) nodes: parents already add up their children.
    void walk(DeckNode node, bool inside, String parentLabel, String courseTitle) {
      final isIn = inside || (node.type == 'course' && wanted.contains(node.label));
      final nextCourse = node.type == 'course' ? node.label : courseTitle;
      if (isIn && node.type == 'lesson' && node.cardCount > 0) {
        out.add(_PlanItem(node.label, 'flashcards', _joinCourseSubject(nextCourse, parentLabel),
            itemType: node.noteIds.isEmpty ? null : 'flashcards',
            itemId: node.noteIds.isEmpty ? null : node.noteIds.first,
            done: (node.newCount + node.dueCount) == 0));
      }
      final nextParent = (node.type == 'subject' || node.type == 'topic') ? node.label : parentLabel;
      for (final child in node.children) {
        walk(child, isIn, nextParent, nextCourse);
      }
    }
    for (final root in decksResult.decks) {
      walk(root, false, '', '');
    }
  }
  return out;
}

String _dateKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Packs items into consecutive days under the hours-per-day budget. The same
/// function lays out a plan when it is made and when it is shown, so the days
/// always agree.
List<(_PlanItem, String)> _pack(
  List<_PlanItem> items, {
  required DateTime start,
  required double hoursPerDay,
  DateTime? until,
}) {
  final out = <(_PlanItem, String)>[];
  var day = start;
  var used = 0.0;
  for (final item in items) {
    final dur = _kDurationHours[item.category] ?? 0.3;
    // Roll to the next day once today's budget is spent, but never strand an
    // item that is longer than the whole budget.
    if (used > 0 && used + dur > hoursPerDay) {
      day = day.add(const Duration(days: 1));
      used = 0;
    }
    if (until != null && day.isAfter(until)) break;
    used += dur;
    out.add((item, _dateKey(day)));
  }
  return out;
}

DateTime? _parseDay(String? v) {
  if (v == null || v.length < 10) return null;
  return DateTime.tryParse(v.substring(0, 10));
}

/// Builds the plan and saves it as one RULE per course and kind (for example
/// "Medicine, all lessons, 2 hours a day from tomorrow") rather than one row per
/// lesson. A plan over every subject used to send two or three thousand rows;
/// now it sends a handful. The app already holds every lesson, quiz and deck,
/// so [expandPlanRules] works the days out on the phone.
///
/// Returns the ids of the rows created, so the caller can badge them as new.
Future<List<int>> generateStudyPlan(
  WidgetRef ref, {
  required List<String> courseIds,
  required bool includeLessons,
  required bool includeQuizzes,
  required bool includeFlashcards,
  required double hoursPerDay,
  DateTime? untilDate,
  // When false the tasks have no due date and the Planner groups them by
  // subject instead of by day.
  bool organizeByDay = true,
  void Function(int done, int total)? onProgress,
}) async {
  final api = ref.read(plannerApiProvider);
  final courses = await ref.read(studentCoursesProvider.future);
  final kinds = [
    if (includeLessons) 'lesson',
    if (includeQuizzes) 'quiz',
    if (includeFlashcards) 'flashcards',
  ];
  final start = DateTime.now().add(const Duration(days: 1));
  final label = {'lesson': 'Lessons', 'quiz': 'Q-Bank', 'flashcards': 'Flashcards'};

  final rules = <NewPlannerTask>[];
  final fallback = <_PlanItem>[]; // for a server that predates rules
  for (final courseId in courseIds) {
    final courseTitle = courses
        .firstWhere((c) => c.id == courseId, orElse: () => courses.first)
        .title;
    for (final kind in kinds) {
      final items = await _collect(ref.read, kind, courseId);
      final open = items.where((i) => !i.done).toList();
      if (open.isEmpty) continue;
      fallback.addAll(open);
      final skip = [for (final i in items) if (i.done && i.itemId != null) i.itemId!];
      rules.add(NewPlannerTask(
        title: '$courseTitle \u00B7 ${label[kind]}',
        description: courseTitle,
        dueDate: organizeByDay ? _dateKey(start) : null,
        category: kind == 'quiz' ? 'quiz' : (kind == 'flashcards' ? 'flashcards' : 'lesson'),
        rule: {
          'kind': kind,
          'courseId': courseId,
          'hours': hoursPerDay,
          'byDay': organizeByDay,
          if (untilDate != null) 'until': _dateKey(untilDate),
          if (skip.isNotEmpty) 'skip': skip,
        },
      ));
    }
  }
  if (rules.isEmpty) return const [];

  onProgress?.call(0, rules.length);
  try {
    final result = await createPlannerRules(api, rules);
    if (result.supported) {
      onProgress?.call(rules.length, rules.length);
      return result.ids;
    }
    // An older server stored the rules as plain, empty-looking tasks. Remove
    // them and use the row-per-item path below.
    for (final id in result.ids) {
      try {
        await api.dio.delete('/student/planner/$id');
      } catch (_) {}
    }
  } on PlannerBulkUnsupported {
    // fall through to the old path
  }

  final creates = <NewPlannerTask>[];
  if (!organizeByDay) {
    for (final item in fallback) {
      creates.add(NewPlannerTask(
        title: item.title,
        category: item.category,
        description: item.description,
        itemType: item.itemType,
        itemId: item.itemId,
      ));
    }
  } else {
    for (final (item, due) in _pack(fallback, start: start, hoursPerDay: hoursPerDay, until: untilDate)) {
      creates.add(NewPlannerTask(
        title: item.title,
        dueDate: due,
        category: item.category,
        description: item.description,
        itemType: item.itemType,
        itemId: item.itemId,
      ));
    }
  }
  return _send(api, creates, onProgress);
}

/// Turns the saved rule rows into the day-by-day tasks the planner shows. The
/// result carries negative ids (they are not rows) and a link to the real
/// lesson, quiz or deck, so they are finished by doing the thing, never swiped.
Future<List<PlannerTask>> expandPlanRules(PlanRead read, List<PlannerTask> rules) async {
  final out = <PlannerTask>[];
  for (final rule in rules) {
    final r = rule.rule;
    if (r == null) continue;
    final kind = '${r['kind']}';
    final skip = <int>{
      for (final v in (r['skip'] is List ? r['skip'] as List : const [])) int.tryParse('$v') ?? -1,
    };
    final items = (await _collect(read, kind, '${r['courseId']}'))
        .where((i) => i.itemId == null || !skip.contains(i.itemId))
        .toList();
    final byDay = r['byDay'] != false;
    final hours = (r['hours'] is num) ? (r['hours'] as num).toDouble() : 2.0;
    final start = _parseDay(rule.dueDate) ?? DateTime.now().add(const Duration(days: 1));
    final placed = byDay
        ? _pack(items, start: start, hoursPerDay: hours, until: _parseDay('${r['until'] ?? ''}'))
        : [for (final i in items) (i, '')];
    var n = 0;
    for (final (item, due) in placed) {
      n++;
      out.add(PlannerTask(
        // Negative (not a row), but RISING with n AND with the rule's id: the
        // list sorts tasks by id, so lessons, then Q-Bank, then flashcards (the
        // order the rules were saved) each run front to back.
        id: n + rule.id * 100000 - 0x10000000000,
        ruleId: rule.id,
        title: item.title,
        description: item.description,
        dueDate: due,
        status: item.done ? 'done' : 'todo',
        category: item.category,
        priority: 'medium',
        itemType: item.itemType,
        itemId: item.itemId,
      ));
    }
  }
  return out;
}

/// Sends the plan — one request, with the old path kept as a fallback.
///
/// The app and the backend are deployed separately here, so a phone can be
/// newer than the server it talks to. If the bulk endpoint is not there yet
/// the plan still gets created the slow way rather than failing in front of
/// the student; that path reports each task as it lands, which is the only
/// case where the progress count moves gradually.
Future<List<int>> _send(
  ApiClient api,
  List<NewPlannerTask> tasks,
  void Function(int done, int total)? onProgress,
) async {
  if (tasks.isEmpty) return const [];
  final total = tasks.length;
  onProgress?.call(0, total);
  try {
    final ids = await createPlannerTasksBulk(api, tasks);
    onProgress?.call(total, total);
    return ids;
  } on PlannerBulkUnsupported {
    var done = 0;
    return Future.wait(tasks.map((t) => createPlannerTask(
          api,
          title: t.title,
          dueDate: t.dueDate,
          category: t.category,
          priority: t.priority,
          description: t.description,
          itemType: t.itemType,
          itemId: t.itemId,
        ).then((id) {
          done += 1;
          onProgress?.call(done, total);
          return id;
        })));
  }
}
