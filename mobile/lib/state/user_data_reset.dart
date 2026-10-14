import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/lessons/lessons_repository.dart';
import '../features/bookmarks/bookmarks_repository.dart';
import '../features/courses/courses_repository.dart';
import '../features/dashboard/dashboard_repository.dart';
import '../features/drugs/drug_queue_service.dart';
import '../features/flashcards/flashcards_repository.dart';
import '../features/notifications/notifications_repository.dart';
import '../features/planner/planner_repository.dart';
import '../features/quizzes/quizzes_repository.dart';
import '../features/subscriptions/iap_reconciler.dart';
import '../features/subscriptions/subscriptions_repository.dart';

/// Drop every cached, user-scoped provider so one account never sees another's
/// data on the same device. Called on login, logout, and forced sign-out
/// (session expiry). Invalidating a `.family` provider clears all of its
/// instances, so per-id caches (a specific lesson, course, quiz, attempt) are
/// wiped too. Auth, settings, and device-level prefs are intentionally left
/// alone.
///
/// EVERY call here passes `asReload: true`, and that is the whole point.
///
/// A plain `invalidate` is a REFRESH: riverpod keeps the old value readable
/// while the new one loads, so `asData`/`.when(data:)` still render it. That is
/// right for re-fetching the same account's data — it is what stops pages
/// flashing a spinner — and exactly wrong here, where the cached value belongs
/// to the account that just signed out. It let the next student see the
/// previous one's subscription, results, courses and dashboard until each
/// fetch landed.
///
/// `asReload: true` makes the state AsyncLoading instead, so pages show their
/// loading state rather than another person's data. One frame of spinner is
/// the correct trade.
void resetUserScopedData(Ref ref) {
  // AI notes
  ref.invalidate(lessonsListProvider, asReload: true);
  ref.invalidate(lessonDocProvider, asReload: true);
  // Courses
  ref.invalidate(studentCoursesProvider, asReload: true);
  ref.invalidate(courseDetailProvider, asReload: true);
  // Quizzes / exams / results
  ref.invalidate(quizListProvider, asReload: true);
  ref.invalidate(practiceQuizProvider, asReload: true);
  ref.invalidate(examQuizProvider, asReload: true);
  ref.invalidate(attemptResultProvider, asReload: true);
  ref.invalidate(resultsListProvider, asReload: true);
  ref.invalidate(attemptReviewProvider, asReload: true);
  // Flashcards
  ref.invalidate(flashDecksProvider, asReload: true);
  ref.invalidate(flashQueueProvider, asReload: true);
  // Other student surfaces
  // Drop any in-flight cold-start prefetch too: it carries the previous
  // user's dashboard, and invalidating the provider alone would let the
  // next account adopt it.
  DashboardPrefetch.clear();
  ref.invalidate(studentDashboardProvider, asReload: true);
  ref.invalidate(bookmarksProvider, asReload: true);
  ref.invalidate(plannerTasksProvider, asReload: true);
  ref.invalidate(billingProvider, asReload: true);
  ref.invalidate(notificationsProvider, asReload: true);
  // Drug randomizer — app-lifetime provider, so its cached spin count/hasSub
  // would otherwise bleed from one account to the next. Reset it so the new
  // user re-fetches their own count from the server.
  ref.invalidate(drugQueueProvider, asReload: true);
  // Apple IAP: forget which transactions were already redeemed, so the incoming
  // account re-checks StoreKit against its own server-side entitlement instead
  // of assuming the previous user's redemptions apply to it.
  ref.read(iapReconcilerProvider).reset();
}
