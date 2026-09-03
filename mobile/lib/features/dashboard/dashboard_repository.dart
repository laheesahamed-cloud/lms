import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';
import '../../state/current_user.dart';

int _i(dynamic v) =>
    v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);
num _n(dynamic v) => v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
String _s(dynamic v) => v == null ? '' : '$v';
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

/// Clamp any score-like number into a 0–100 integer.
int clampPct(num v) => v.isNaN ? 0 : v.clamp(0, 100).round();

/// A weak topic surfaced by the backend (`weakTopics[]` / `strongTopics[]`).
class WeakTopic {
  final String topicName;
  final String courseTitle;
  final num averagePercentage; // 0–100
  final int attemptsCount;
  WeakTopic({
    required this.topicName,
    required this.courseTitle,
    required this.averagePercentage,
    required this.attemptsCount,
  });
  factory WeakTopic.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return WeakTopic(
      topicName: _s(m['topicName']).isEmpty ? 'General' : _s(m['topicName']),
      courseTitle: _s(m['courseTitle']),
      averagePercentage: _n(m['averagePercentage']),
      attemptsCount: _i(m['attemptsCount']),
    );
  }
}

/// One course's lesson-completion progress (`courseProgress[]`).
class CourseProgress {
  final int id;
  final String courseTitle;
  final String courseCode;
  final String examType;
  final int subjectCount;
  final num progressPercent; // 0–100
  final int completedLessonsCount;
  final int totalLessonsCount;
  final String actionLabel;
  CourseProgress({
    required this.id,
    required this.courseTitle,
    required this.courseCode,
    required this.examType,
    required this.subjectCount,
    required this.progressPercent,
    required this.completedLessonsCount,
    required this.totalLessonsCount,
    required this.actionLabel,
  });
  factory CourseProgress.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return CourseProgress(
      id: _i(m['id']),
      courseTitle: _s(m['courseTitle']),
      courseCode: _s(m['courseCode']),
      examType: _s(m['examType']),
      subjectCount: _i(m['subjectCount']),
      progressPercent: _n(m['progressPercent']),
      completedLessonsCount: _i(m['completedLessonsCount']),
      totalLessonsCount: _i(m['totalLessonsCount']),
      actionLabel:
          _s(m['actionLabel']).isEmpty ? 'View course' : _s(m['actionLabel']),
    );
  }
}

/// Aggregate of all courses (`courseProgressSummary`).
class CourseProgressSummary {
  final int visibleCourses;
  final int completedLessons;
  final int totalLessons;
  final num overallProgressPercent; // 0–100
  const CourseProgressSummary({
    required this.visibleCourses,
    required this.completedLessons,
    required this.totalLessons,
    required this.overallProgressPercent,
  });
  factory CourseProgressSummary.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return CourseProgressSummary(
      visibleCourses: _i(m['visibleCourses']),
      completedLessons: _i(m['completedLessons']),
      totalLessons: _i(m['totalLessons']),
      overallProgressPercent: _n(m['overallProgressPercent']),
    );
  }
}

/// One of the last few submitted attempts (`recentAttempts[]`).
class RecentAttempt {
  final int id;
  final String quizTitle;
  final String courseTitle;
  final String topicName;
  final num score;
  final int totalQuestions;
  final num percentage; // 0–100
  final String passStatus;
  final String submittedAt;
  /// Straight from the quiz row, so an attempt names itself the same way the
  /// quiz does everywhere else. Matching by title text got this wrong: in
  /// number mode the titles are not unique.
  final int quizNumber;
  final String displayTitleMode;

  /// Mirrors QuizListItem.displayName. Empty when the server has not supplied
  /// the number yet, so callers can fall back to the raw title.
  String get displayName {
    if (displayTitleMode == 'number' && quizNumber > 0) return 'Quiz $quizNumber';
    return quizTitle.trim();
  }

  RecentAttempt({
    required this.id,
    required this.quizTitle,
    required this.courseTitle,
    required this.topicName,
    required this.score,
    required this.totalQuestions,
    required this.percentage,
    required this.passStatus,
    required this.submittedAt,
    this.quizNumber = 0,
    this.displayTitleMode = 'number',
  });
  factory RecentAttempt.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return RecentAttempt(
      id: _i(m['id']),
      quizTitle: _s(m['quizTitle']),
      courseTitle: _s(m['courseTitle']),
      topicName: _s(m['topicName']),
      score: _n(m['score']),
      totalQuestions: _i(m['totalQuestions']),
      percentage: _n(m['percentage']),
      passStatus: _s(m['passStatus']),
      submittedAt: _s(m['submittedAt']),
      quizNumber: _i(m['quizNumber'] ?? m['quiz_number']),
      displayTitleMode: m['displayTitleMode'] == 'title' ? 'title' : 'number',
    );
  }
}

/// 7-day performance window (`performanceSnapshot`).
class PerfSnapshot {
  final num readinessScore; // 0–100
  final String readinessLabel;
  final int weeklyAttempts;
  final num weeklyAverage; // 0–100
  final num previousWeeklyAverage;
  final num scoreDelta;
  final String scoreTrend; // new | empty | up | down | steady
  final String trendLabel;
  final String comparisonLabel;
  final String emptyState;
  const PerfSnapshot({
    required this.readinessScore,
    required this.readinessLabel,
    required this.weeklyAttempts,
    required this.weeklyAverage,
    required this.previousWeeklyAverage,
    required this.scoreDelta,
    required this.scoreTrend,
    required this.trendLabel,
    required this.comparisonLabel,
    required this.emptyState,
  });
  factory PerfSnapshot.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return PerfSnapshot(
      readinessScore: _n(m['readinessScore']),
      readinessLabel:
          _s(m['readinessLabel']).isEmpty ? 'Baseline not set' : _s(m['readinessLabel']),
      weeklyAttempts: _i(m['weeklyAttempts']),
      weeklyAverage: _n(m['weeklyAverage']),
      previousWeeklyAverage: _n(m['previousWeeklyAverage']),
      scoreDelta: _n(m['scoreDelta']),
      scoreTrend: _s(m['scoreTrend']),
      trendLabel: _s(m['trendLabel']),
      comparisonLabel: _s(m['comparisonLabel']),
      emptyState: _s(m['emptyState']),
    );
  }
  static const empty = PerfSnapshot(
    readinessScore: 0,
    readinessLabel: 'Baseline not set',
    weeklyAttempts: 0,
    weeklyAverage: 0,
    previousWeeklyAverage: 0,
    scoreDelta: 0,
    scoreTrend: 'new',
    trendLabel: '',
    comparisonLabel: '',
    emptyState: '',
  );
}

/// One step of the adaptive study plan (`adaptivePlan[]`).
class PlanStep {
  final String key;
  final String title;
  final String description;
  final String actionType; // quiz | note | results
  final String status; // done | next | queued
  PlanStep({
    required this.key,
    required this.title,
    required this.description,
    required this.actionType,
    required this.status,
  });
  factory PlanStep.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return PlanStep(
      key: _s(m['key']),
      title: _s(m['title']),
      description: _s(m['description']),
      actionType: _s(m['actionType']),
      status: _s(m['status']).isEmpty ? 'queued' : _s(m['status']),
    );
  }
}

/// One answer option of the question of the day.
class QodOption {
  final int id;
  final String optionLabel;
  final String optionText;
  final bool isCorrect;
  QodOption({
    required this.id,
    required this.optionLabel,
    required this.optionText,
    required this.isCorrect,
  });
  factory QodOption.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return QodOption(
      id: _i(m['id']),
      optionLabel: _s(m['optionLabel']),
      optionText: _s(m['optionText']),
      isCorrect: _b(m['isCorrect']),
    );
  }
}

/// The single SBA practice question (`questionOfDay`).
class QuestionOfDay {
  final int id;
  final String questionType;
  final String questionText;
  final String courseTitle;
  final String subjectName;
  final String topicName;
  final List<QodOption> options;
  QuestionOfDay({
    required this.id,
    required this.questionType,
    required this.questionText,
    required this.courseTitle,
    required this.subjectName,
    required this.topicName,
    required this.options,
  });
  static QuestionOfDay? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final m = Map<String, dynamic>.from(raw);
    if (_s(m['questionText']).isEmpty) return null;
    return QuestionOfDay(
      id: _i(m['id']),
      questionType: _s(m['questionType']),
      questionText: _s(m['questionText']),
      courseTitle: _s(m['courseTitle']),
      subjectName: _s(m['subjectName']),
      topicName: _s(m['topicName']),
      options: (m['options'] is List)
          ? (m['options'] as List).map(QodOption.fromJson).toList()
          : const <QodOption>[],
    );
  }
}

/// The aggregated student dashboard (`GET /student/dashboard`).
class StudentDashboard {
  final String fullName;
  final int quizDayStreak;
  final List<String> recentActiveDays; // YYYY-MM-DD strings for last 7 days
  final num avgScore; // 0–100
  final num passRate; // 0–100
  final int totalAttempts;
  final int totalPassed;
  final int totalCourses;
  final int totalQuizzes;
  final int dailyGoalsCompleted;
  final int dailyGoalsTotal;
  final List<WeakTopic> weakTopics;
  final List<WeakTopic> strongTopics;
  final List<CourseProgress> courseProgress;
  final CourseProgressSummary courseProgressSummary;
  final List<RecentAttempt> recentAttempts;
  final PerfSnapshot performanceSnapshot;
  final List<PlanStep> adaptivePlan;
  final QuestionOfDay? questionOfDay;
  final String progressNote;

  StudentDashboard({
    required this.fullName,
    required this.quizDayStreak,
    required this.recentActiveDays,
    required this.avgScore,
    required this.passRate,
    required this.totalAttempts,
    required this.totalPassed,
    required this.totalCourses,
    required this.totalQuizzes,
    required this.dailyGoalsCompleted,
    required this.dailyGoalsTotal,
    required this.weakTopics,
    required this.strongTopics,
    required this.courseProgress,
    required this.courseProgressSummary,
    required this.recentAttempts,
    required this.performanceSnapshot,
    required this.adaptivePlan,
    required this.questionOfDay,
    required this.progressNote,
  });

  int get goalsRemaining =>
      (dailyGoalsTotal - dailyGoalsCompleted).clamp(0, dailyGoalsTotal);

  /// Readiness = snapshot readiness, falling back to the all-time average.
  int get readiness => clampPct(
      performanceSnapshot.readinessScore > 0 ? performanceSnapshot.readinessScore : avgScore);

  /// Mirrors the web's `buildDashboardLevelProgress` XP/level maths.
  int get earnedXp => (totalAttempts * 70 +
          totalPassed * 110 +
          dailyGoalsCompleted * 55 +
          quizDayStreak * 35)
      .clamp(0, 1 << 31)
      .toInt();
  int get level => (earnedXp ~/ 300) + 1;
  int get nextLevelIn => ((level * 300) - earnedXp).clamp(0, 300).toInt();
  int get levelProgressPct =>
      clampPct(((earnedXp - (level - 1) * 300) / 300) * 100);

  factory StudentDashboard.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final user =
        (m['user'] is Map) ? Map<String, dynamic>.from(m['user']) : const {};
    final goals = (m['dailyGoals'] is List) ? m['dailyGoals'] as List : const [];
    List<WeakTopic> topics(String key) => (m[key] is List)
        ? (m[key] as List).map(WeakTopic.fromJson).toList()
        : <WeakTopic>[];
    return StudentDashboard(
      fullName: _s(user['fullName']),
      quizDayStreak: _i(m['quizDayStreak']),
      recentActiveDays: (m['recentActiveDays'] is List)
          ? List<String>.from(m['recentActiveDays'])
          : <String>[],
      avgScore: _n(m['avgScore']),
      passRate: _n(m['passRate']),
      totalAttempts: _i(m['totalAttempts']),
      totalPassed: _i(m['totalPassed']),
      totalCourses: _i(m['totalCourses']),
      totalQuizzes: _i(m['totalQuizzes']),
      dailyGoalsCompleted: _i(m['dailyGoalsCompleted']),
      dailyGoalsTotal: goals.isEmpty ? 3 : goals.length,
      weakTopics: topics('weakTopics'),
      strongTopics: topics('strongTopics'),
      courseProgress: (m['courseProgress'] is List)
          ? (m['courseProgress'] as List).map(CourseProgress.fromJson).toList()
          : <CourseProgress>[],
      courseProgressSummary:
          CourseProgressSummary.fromJson(m['courseProgressSummary']),
      recentAttempts: (m['recentAttempts'] is List)
          ? (m['recentAttempts'] as List).map(RecentAttempt.fromJson).toList()
          : <RecentAttempt>[],
      performanceSnapshot: (m['performanceSnapshot'] is Map)
          ? PerfSnapshot.fromJson(m['performanceSnapshot'])
          : PerfSnapshot.empty,
      adaptivePlan: (m['adaptivePlan'] is List)
          ? (m['adaptivePlan'] as List).map(PlanStep.fromJson).toList()
          : <PlanStep>[],
      questionOfDay: QuestionOfDay.fromJson(m['questionOfDay']),
      progressNote: _s(m['progressNote']),
    );
  }
}

StudentDashboard _parseDashboard(dynamic raw) => StudentDashboard.fromJson(raw);

/// Single source of truth for the streak / daily-goal / weak-topic widgets.
/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
Future<StudentDashboard> fetchStudentDashboard(ApiClient api) async {
  final res = await api.dio.get('/student/dashboard');
  return compute(_parseDashboard, res.data);
}

/// Holds the cold-start dashboard request so it survives long enough to be
/// used.
///
/// On a cold launch the app used to make two server round trips back to back:
/// `/auth/me` (the ECG splash runs for exactly as long as this takes), and
/// only then `/student/dashboard` (the spinner on an empty Study Hub).
/// `AuthController._hydrate` now fires the dashboard request *alongside*
/// `me()`, so the ECG covers both and Study Hub opens already populated.
///
/// This holder is what makes that work. [studentDashboardProvider] watches
/// [userScopeProvider], which is null during hydration and flips to the
/// real id the moment `me()` resolves — invalidating the provider. Without
/// parking the in-flight future here it would be discarded and re-requested,
/// making the prefetch pointless.
class DashboardPrefetch {
  DashboardPrefetch._();

  static Future<StudentDashboard>? _inFlight;
  static DateTime? _startedAt;

  /// Long enough to bridge hydration, short enough that a warm result is never
  /// mistaken for a cache.
  static const Duration _ttl = Duration(seconds: 20);

  /// Begin a prefetch. The token is already set on [api] at this point, but has
  /// not yet been validated by `me()`. That is safe: the server authorises the
  /// request itself, so a stale token yields a 401 and nothing else.
  static void start(ApiClient api) {
    final future = fetchStudentDashboard(api);
    _inFlight = future;
    _startedAt = DateTime.now();
    // Attach a handler now so a failed prefetch can never surface as an
    // unhandled async error. On failure drop it, and the provider simply does
    // its own request as before.
    future.then<void>((_) {}, onError: (Object _) {
      if (identical(_inFlight, future)) clear();
    });
  }

  /// Take the pending result, if there is a usable one. One-shot by design:
  /// a later refresh (pull-to-refresh, `invalidate`) must hit the network
  /// rather than replay this.
  static Future<StudentDashboard>? take() {
    final future = _inFlight;
    final startedAt = _startedAt;
    if (future == null || startedAt == null) return null;
    clear();
    if (DateTime.now().difference(startedAt) > _ttl) return null;
    return future;
  }

  /// Drop anything pending. Must be called on logout and account switch — this
  /// future carries one user's dashboard, and the next user must never adopt
  /// it. [resetUserScopedData] does this.
  static void clear() {
    _inFlight = null;
    _startedAt = null;
  }
}

final studentDashboardProvider = FutureProvider<StudentDashboard>((ref) async {
  ref.watch(userScopeProvider);
  final warm = DashboardPrefetch.take();
  if (warm != null) return warm;
  return fetchStudentDashboard(ref.read(apiClientProvider));
});
