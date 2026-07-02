import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/lessons/lessons_repository.dart';
import '../features/bookmarks/bookmarks_repository.dart';
import '../features/courses/courses_repository.dart';
import '../features/dashboard/dashboard_repository.dart';
import '../features/flashcards/flashcards_repository.dart';
import '../features/notifications/notifications_repository.dart';
import '../features/planner/planner_repository.dart';
import '../features/quizzes/quizzes_repository.dart';
import '../features/subscriptions/subscriptions_repository.dart';

/// Drop every cached, user-scoped provider so one account never sees another's
/// data on the same device. Called on login, logout, and forced sign-out
/// (session expiry). Invalidating a `.family` provider clears all of its
/// instances, so per-id caches (a specific lesson, course, quiz, attempt) are
/// wiped too. Auth, settings, and device-level prefs are intentionally left
/// alone.
void resetUserScopedData(Ref ref) {
  // AI notes
  ref.invalidate(lessonsListProvider);
  ref.invalidate(lessonDocProvider);
  // Courses
  ref.invalidate(studentCoursesProvider);
  ref.invalidate(courseDetailProvider);
  // Quizzes / exams / results
  ref.invalidate(quizListProvider);
  ref.invalidate(practiceQuizProvider);
  ref.invalidate(examQuizProvider);
  ref.invalidate(attemptResultProvider);
  ref.invalidate(resultsListProvider);
  ref.invalidate(attemptReviewProvider);
  // Flashcards
  ref.invalidate(flashDecksProvider);
  ref.invalidate(flashQueueProvider);
  // Other student surfaces
  ref.invalidate(studentDashboardProvider);
  ref.invalidate(bookmarksProvider);
  ref.invalidate(plannerTasksProvider);
  ref.invalidate(billingProvider);
  ref.invalidate(notificationsProvider);
}
