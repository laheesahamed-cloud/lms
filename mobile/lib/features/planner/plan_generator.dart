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
  // Where it sits in the course: the position of its lesson, then its kind
  // (lesson 0, Q-bank 1, flashcards 2, a subject's own sets 3, full papers 5).
  final int pos;
  final int rank;
  // Which subject it belongs to, in the order subjects appear in the course
  // (used by "subject by subject").
  final int subj;
  // The saved plan row this item came from.
  final int? ruleId;
  const _PlanItem(this.title, this.category, this.description,
      {this.itemType,
      this.itemId,
      this.done = false,
      this.pos = 0,
      this.rank = 0,
      this.subj = 0,
      this.ruleId});

  _PlanItem withRule(int id) => _PlanItem(title, category, description,
      itemType: itemType,
      itemId: itemId,
      done: done,
      pos: pos,
      rank: rank,
      subj: subj,
      ruleId: id);
}

/// Sort a course's items into study order.
///
/// Lesson by lesson (the default): for each lesson the lesson itself, then its
/// Q-bank, then its flashcards; a subject's own sets after its last lesson.
/// Subject by subject: all of a subject's lessons, then its Q-bank, then its
/// flashcards, then the next subject. Either way full-course papers come last
/// and a Q-bank set never lands before the lesson it belongs to. Stable: items
/// that tie keep their incoming order.
List<_PlanItem> _studyOrder(List<_PlanItem> items, {bool bySubject = false}) {
  // Within a subject: lessons, lesson Q-bank, the subject's own sets, flashcards.
  int group(int rank) => switch (rank) { 0 => 0, 1 => 1, 3 => 2, 2 => 3, _ => 9 };
  final indexed = [for (var i = 0; i < items.length; i++) (i, items[i])];
  indexed.sort((a, b) {
    final x = a.$2, y = b.$2;
    int cmp;
    if (bySubject) {
      // Papers (and anything with no subject) sort after every subject.
      cmp = (x.rank == 5 ? _kEnd : x.subj).compareTo(y.rank == 5 ? _kEnd : y.subj);
      if (cmp == 0) cmp = group(x.rank).compareTo(group(y.rank));
      if (cmp == 0) cmp = x.pos.compareTo(y.pos);
    } else {
      cmp = x.pos.compareTo(y.pos);
      if (cmp == 0) cmp = x.rank.compareTo(y.rank);
    }
    return cmp != 0 ? cmp : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

/// Several courses in one plan are studied side by side, not one after another:
/// a student does not give a whole day to one course. Each course keeps its own
/// study order; the courses are woven together in proportion to their size, so
/// they all reach the end around the same time.
List<_PlanItem> _interleaveCourses(List<List<_PlanItem>> perCourse) {
  final lists = perCourse.where((l) => l.isNotEmpty).toList();
  if (lists.length <= 1) return lists.isEmpty ? const [] : lists.first;
  final keyed = <(double, int, int, _PlanItem)>[];
  for (var c = 0; c < lists.length; c++) {
    final n = lists[c].length;
    for (var i = 0; i < n; i++) {
      keyed.add(((i + 0.5) / n, c, i, lists[c][i]));
    }
  }
  keyed.sort((a, b) {
    final k = a.$1.compareTo(b.$1);
    if (k != 0) return k;
    final c = a.$2.compareTo(b.$2);
    return c != 0 ? c : a.$3.compareTo(b.$3);
  });
  return [for (final e in keyed) e.$4];
}

const _kEnd = 1 << 30; // after every lesson

/// A course's lessons in study order, used to place Q-bank and flashcards.
class _CourseOrder {
  final Map<int, int> lessonPos; // lesson id -> position
  final Map<String, int> subjectLastPos; // subject name -> its last lesson
  final Map<String, int> subjectIdx; // subject name -> order of first appearance
  final Map<int, int> lessonSubj; // lesson id -> its subject's index
  const _CourseOrder(this.lessonPos, this.subjectLastPos, this.subjectIdx, this.lessonSubj);
}

Future<_CourseOrder> _courseOrder(PlanRead read, String courseId) async {
  final all = await read(lessonsListProvider.future);
  final pos = <int, int>{};
  final last = <String, int>{};
  final subjIdx = <String, int>{};
  final lessonSubj = <int, int>{};
  var i = 0;
  for (final l in all) {
    if (l.courseId != courseId || !l.lessonExists) continue;
    final id = int.tryParse(l.lessonId);
    if (id == null) continue;
    final key = l.subjectName.trim().toLowerCase();
    pos[id] = i;
    last[key] = i;
    lessonSubj[id] = subjIdx.putIfAbsent(key, () => subjIdx.length);
    i++;
  }
  return _CourseOrder(pos, last, subjIdx, lessonSubj);
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

Future<List<_PlanItem>> _collect(PlanRead read, String kind, String courseId,
    {_CourseOrder? order}) async {
  final out = <_PlanItem>[];
  final ord = order ?? await _courseOrder(read, courseId);
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
          itemType: 'lesson',
          itemId: lessonId,
          done: l.lessonCompleted,
          pos: ord.lessonPos[lessonId] ?? _kEnd - 2,
          rank: 0,
          subj: ord.lessonSubj[lessonId] ?? _kEnd - 1));
    }
  } else if (kind == 'quiz') {
    final quizzes = await read(quizListProvider.future);
    // A Q-bank set counts as done only once it has been PASSED as an exam.
    final results = await read(resultsListProvider.future);
    final passed = {for (final r in results) if (r.passed) '${r.quizId}'};
    var i = 0;
    for (final q in sortQuizzesByHierarchy(
        quizzes.where((q) => q.courseId == courseId && !q.locked).toList())) {
      final subject = [q.subjectName, q.lessonTitle]
          .firstWhere((s) => s.trim().isNotEmpty, orElse: () => '');
      final lessonId = int.tryParse(q.lessonId);
      int pos, rank;
      if (lessonId != null && ord.lessonPos.containsKey(lessonId)) {
        pos = ord.lessonPos[lessonId]!; // right after its own lesson
        rank = 1;
      } else if (q.isGeneral) {
        pos = _kEnd; // full papers come last
        rank = 5;
      } else {
        pos = ord.subjectLastPos[q.subjectName.trim().toLowerCase()] ?? _kEnd - 1;
        rank = 3; // a subject's own sets, after all its lessons
      }
      out.add(_PlanItem(q.rowLabel(i), 'quiz', _joinCourseSubject(q.courseTitle, subject),
          itemType: 'quiz',
          itemId: int.tryParse(q.id),
          done: passed.contains(q.id),
          pos: pos,
          rank: rank,
          subj: (lessonId != null ? ord.lessonSubj[lessonId] : null) ??
              ord.subjectIdx[q.subjectName.trim().toLowerCase()] ??
              _kEnd - 1));
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
        final noteId = node.noteIds.isEmpty ? null : node.noteIds.first;
        out.add(_PlanItem(node.label, 'flashcards', _joinCourseSubject(nextCourse, parentLabel),
            itemType: noteId == null ? null : 'flashcards',
            itemId: noteId,
            done: (node.newCount + node.dueCount) == 0,
            pos: (noteId != null ? ord.lessonPos[noteId] : null) ?? _kEnd - 1,
            rank: 2,
            subj: (noteId != null ? ord.lessonSubj[noteId] : null) ?? _kEnd - 1));
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
  // 'lesson' = lesson by lesson; 'subject' = a whole subject's lessons, then its
  // Q-bank and flashcards, then the next subject.
  String order = 'lesson',
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
  final fallbackByCourse = <List<_PlanItem>>[]; // for a server that predates rules
  for (final courseId in courseIds) {
    final courseTitle = courses
        .firstWhere((c) => c.id == courseId, orElse: () => courses.first)
        .title;
    final courseOrder = await _courseOrder(ref.read, courseId);
    final courseOpen = <_PlanItem>[];
    for (final kind in kinds) {
      final items = await _collect(ref.read, kind, courseId, order: courseOrder);
      final open = items.where((i) => !i.done).toList();
      if (open.isEmpty) continue;
      courseOpen.addAll(open);
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
          'order': order,
          if (untilDate != null) 'until': _dateKey(untilDate),
          if (skip.isNotEmpty) 'skip': skip,
        },
      ));
    }
    // Lesson, then its Q-bank, then its flashcards; full papers last.
    fallbackByCourse.add(_studyOrder(courseOpen, bySubject: order == 'subject'));
  }
  if (rules.isEmpty) return const [];
  final fallback = _interleaveCourses(fallbackByCourse);

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
///
/// Rules saved together (same course, start, hours and end) are laid out as ONE
/// plan: lesson, then its Q-bank, then its flashcards, subject by subject, with
/// full papers at the end — never a Q-bank ahead of its lesson.
Future<List<PlannerTask>> expandPlanRules(PlanRead read, List<PlannerTask> rules) async {
  final groups = <String, List<PlannerTask>>{};
  for (final rule in rules) {
    final r = rule.rule;
    if (r == null) continue;
    // Not keyed by course: courses planned together are laid out together.
    final key = '${rule.dueDate}|${r['hours']}|${r['byDay']}|${r['until']}|${r['order']}';
    groups.putIfAbsent(key, () => []).add(rule);
  }

  final out = <PlannerTask>[];
  for (final group in groups.values) {
    final first = group.first;
    final r0 = first.rule!;
    final byCourse = <String, List<_PlanItem>>{};
    final orders = <String, _CourseOrder>{};
    for (final rule in group) {
      final r = rule.rule!;
      final courseId = '${r['courseId']}';
      final order = orders[courseId] ??= await _courseOrder(read, courseId);
      final skip = <int>{
        for (final v in (r['skip'] is List ? r['skip'] as List : const [])) int.tryParse('$v') ?? -1,
      };
      final collected = await _collect(read, '${r['kind']}', courseId, order: order);
      byCourse.putIfAbsent(courseId, () => []).addAll(collected
          .where((i) => i.itemId == null || !skip.contains(i.itemId))
          .map((i) => i.withRule(rule.id)));
    }
    final bySubject = r0['order'] == 'subject';
    final ordered = _interleaveCourses([
      for (final items in byCourse.values) _studyOrder(items, bySubject: bySubject),
    ]);
    final byDay = r0['byDay'] != false;
    final hours = (r0['hours'] is num) ? (r0['hours'] as num).toDouble() : 2.0;
    final start = _parseDay(first.dueDate) ?? DateTime.now().add(const Duration(days: 1));
    final placed = byDay
        ? _pack(ordered, start: start, hoursPerDay: hours, until: _parseDay('${r0['until'] ?? ''}'))
        : [for (final i in ordered) (i, '')];
    var n = 0;
    for (final (item, due) in placed) {
      n++;
      out.add(PlannerTask(
        // Negative (not a row), but RISING with n: the list sorts tasks by id,
        // so the plan reads in the order it was laid out.
        id: n + first.id * 100000 - 0x10000000000,
        ruleId: item.ruleId ?? first.id,
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
