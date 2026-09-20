import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../courses/courses_repository.dart';
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
  const _PlanItem(this.title, this.category, this.description);
}

/// Builds a queue of incomplete study items from the selected courses/content
/// types, packs them into consecutive days under the given hours-per-day
/// budget, and creates them as real Planner tasks. Returns the created
/// tasks' ids (so the caller can badge them as "new" in the list).
///
/// Pulls from the same repositories the Courses/Q-Bank/Flashcards tabs
/// already use — no new backend endpoint, this only reads what's already
/// fetchable and writes through the existing `createPlannerTask`.
Future<List<int>> generateStudyPlan(
  WidgetRef ref, {
  required List<String> courseIds,
  required bool includeLessons,
  required bool includeQuizzes,
  required bool includeFlashcards,
  required double hoursPerDay,
  DateTime? untilDate,
  // When false, items are created with no due date at all — the Planner
  // then groups them by subject instead of by day. hoursPerDay/untilDate
  // are meaningless in that mode and ignored.
  bool organizeByDay = true,
}) async {
  final queue = <_PlanItem>[];

  // Title is the actual item name; description carries the subject/topic
  // context (rendered as a subtitle in the Planner list) — a bare "Quiz 4"
  // or "Lesson" with no surrounding context is meaningless once it's sitting
  // in a day's task list away from the Q-Bank/Lessons screen it came from.
  if (includeLessons) {
    for (final courseId in courseIds) {
      final detail = await ref.read(courseDetailProvider(courseId).future);
      for (final subject in detail.subjects) {
        for (final lesson in subject.lessons) {
          if (lesson.done || lesson.locked) continue;
          queue.add(_PlanItem(lesson.title, 'lesson', subject.name));
        }
      }
    }
  }

  if (includeQuizzes) {
    final quizzes = await ref.read(quizListProvider.future);
    var i = 0;
    for (final q in quizzes) {
      if (!courseIds.contains(q.courseId)) continue;
      if (q.isCompleted || q.locked) continue;
      final context = [q.subjectName, q.lessonTitle]
          .firstWhere((s) => s.trim().isNotEmpty, orElse: () => q.courseTitle);
      queue.add(_PlanItem(q.rowLabel(i), 'quiz', context));
      i++;
    }
  }

  if (includeFlashcards) {
    final courses = await ref.read(studentCoursesProvider.future);
    final wantedTitles = courses
        .where((c) => courseIds.contains(c.id))
        .map((c) => c.title)
        .toSet();
    final decksResult = await ref.read(flashDecksProvider.future);

    // Only leaf (lesson-level) nodes — topic/subject/course nodes already
    // aggregate their descendants' counts, so walking every level would
    // schedule the same due cards multiple times over. `parentLabel` tracks
    // the nearest subject/topic ancestor's name for the subtitle.
    void walk(DeckNode node, bool insideWanted, String parentLabel) {
      final inside =
          insideWanted || (node.type == 'course' && wantedTitles.contains(node.label));
      if (inside &&
          node.type == 'lesson' &&
          node.cardCount > 0 &&
          (node.newCount + node.dueCount) > 0) {
        queue.add(_PlanItem(node.label, 'flashcards', parentLabel));
      }
      final nextParent =
          (node.type == 'subject' || node.type == 'topic') ? node.label : parentLabel;
      for (final child in node.children) {
        walk(child, inside, nextParent);
      }
    }

    for (final root in decksResult.decks) {
      walk(root, false, '');
    }
  }

  final api = ref.read(plannerApiProvider);
  final creates = <Future<int>>[];

  if (!organizeByDay) {
    // No day packing at all — every item goes straight in with no due date.
    // The Planner then falls back to grouping by subject (item.description)
    // since there's no date to branch on.
    for (final item in queue) {
      creates.add(createPlannerTask(
        api,
        title: item.title,
        dueDate: null,
        category: item.category,
        description: item.description,
      ));
    }
    return Future.wait(creates);
  }

  // Pack the queue into consecutive days, starting tomorrow, under the
  // hours-per-day budget. No fixed end unless the user chose one — the
  // queue just runs out naturally.
  var day = DateTime.now().add(const Duration(days: 1));
  var dayHoursUsed = 0.0;

  for (final item in queue) {
    final dur = _kDurationHours[item.category] ?? 0.3;
    // Roll to the next day once today's budget is spent — but never strand
    // a single item forever if hoursPerDay is smaller than one item's own
    // duration (dayHoursUsed == 0 means nothing's been placed today yet, so
    // place it anyway rather than looping days indefinitely).
    if (dayHoursUsed > 0 && dayHoursUsed + dur > hoursPerDay) {
      day = day.add(const Duration(days: 1));
      dayHoursUsed = 0;
    }
    if (untilDate != null && day.isAfter(untilDate)) break;
    dayHoursUsed += dur;

    final dueStr =
        '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    creates.add(createPlannerTask(
      api,
      title: item.title,
      dueDate: dueStr,
      category: item.category,
      description: item.description,
    ));
  }

  return Future.wait(creates);
}
