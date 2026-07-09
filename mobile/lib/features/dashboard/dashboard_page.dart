import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';
import '../../state/auth_controller.dart';
import '../notifications/notifications_popup.dart';
import '../quizzes/quizzes_repository.dart';
import '../flashcards/flashcards_repository.dart';
import '../lessons/lessons_repository.dart';
import '../lessons/lesson_models.dart';
import 'dashboard_repository.dart';

String _timeAgo(String iso) {
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return '';
  final now = DateTime.now();
  final days = DateTime(now.year, now.month, now.day)
      .difference(DateTime(dt.year, dt.month, dt.day))
      .inDays;
  if (days <= 0) return 'Today';
  if (days == 1) return 'Yesterday';
  if (days < 7) return '$days days ago';
  if (days < 30) return '${(days / 7).floor()}w ago';
  return '${(days / 30).floor()}mo ago';
}

String _gradeLetter(num pct) {
  if (pct >= 80) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
}

/// Recommended-quiz logic. Prefer an OPEN (not-completed, unlocked) quiz on the
/// weakest topic, else any open quiz — so once the user finishes a quiz it is
/// never recommended again. Only if everything is done/locked do we fall back
/// to a weak-topic match, then the first quiz.
QuizListItem? _pickQuiz(List<QuizListItem> qs, WeakTopic? weak) {
  if (qs.isEmpty) return null;
  final rng = math.Random(DateTime.now().day);
  List<QuizListItem> shuffle(List<QuizListItem> list) =>
      (List.of(list)..shuffle(rng));
  bool open(QuizListItem q) => !q.isCompleted && !q.locked;
  bool onWeak(QuizListItem q) =>
      weak != null &&
      q.courseTitle == weak.courseTitle &&
      q.subjectName == weak.topicName;
  if (weak != null) {
    final hits = shuffle(qs.where((q) => open(q) && onWeak(q)).toList());
    if (hits.isNotEmpty) return hits.first;
  }
  final openAll = shuffle(qs.where(open).toList());
  if (openAll.isNotEmpty) return openAll.first;
  if (weak != null) {
    final weakAll = shuffle(qs.where(onWeak).toList());
    if (weakAll.isNotEmpty) return weakAll.first;
  }
  return shuffle(qs).first;
}

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _showProfileMenu(BuildContext context, WidgetRef ref) async {
    final c = context.c;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        return SafeArea(
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            decoration: BoxDecoration(
              color: c.cardElevated,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: c.line),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 8),
                Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: c.lineStrong,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(height: 6),
                _MenuRow(
                  icon: Icons.person_outline_rounded,
                  label: 'Profile',
                  color: c.inkStrong,
                  onTap: () {
                    Navigator.of(sheetCtx).pop();
                    context.push('/app/profile');
                  },
                ),
                Divider(height: 1, color: c.line),
                _MenuRow(
                  icon: Icons.logout_rounded,
                  label: 'Sign out',
                  color: c.error,
                  onTap: () {
                    Navigator.of(sheetCtx).pop();
                    ref.read(authControllerProvider.notifier).logout();
                  },
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final user = ref.watch(authControllerProvider).user;
    final name = (user?.fullName.trim().isNotEmpty ?? false)
        ? user!.fullName.split(RegExp(r'\s+')).first
        : 'there';

    final initials = user?.initials ?? 'MS';
    final unread = ref.watch(unreadCountProvider);
    final goalLine = ref.watch(studentDashboardProvider).maybeWhen(
          data: (d) {
            final r = d.goalsRemaining;
            if (r <= 0) return 'Daily goal complete — nice work!';
            return "You're $r goal${r == 1 ? '' : 's'} from your daily goal.";
          },
          orElse: () => 'Loading your study snapshot…',
        );
    final mq = MediaQuery.of(context);
    final reduced = mq.disableAnimations;
    final isPortrait = mq.orientation == Orientation.portrait;
    final isPhonePortrait = isPortrait && mq.size.width < 600;
    final mascotAsset = _kMascots[DateTime.now().day % _kMascots.length];
    final kids = <Widget>[
      // Top bar: notifications + profile
      Row(
        children: [
          const Spacer(),
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                onPressed: () => showNotificationsPopup(context),
                icon: Icon(Icons.notifications_none_rounded, color: c.inkMedium),
              ),
              if (unread > 0)
                Positioned(
                  right: 6,
                  top: 6,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    constraints: const BoxConstraints(minWidth: 16),
                    decoration: BoxDecoration(
                      color: c.error,
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: c.page, width: 1.5),
                    ),
                    child: Text(
                      unread > 9 ? '9+' : '$unread',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
          GestureDetector(
            onTap: () => _showProfileMenu(context, ref),
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [
                  c.accent.withValues(alpha: 0.30),
                  c.primary.withValues(alpha: 0.24),
                ]),
              ),
              child: Text(initials,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
            ),
          ),
        ],
      ),
      const SizedBox(height: 2),
      // Hero
      Text('${_greeting()}, $name',
          style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent)),
      const SizedBox(height: 5),
      Text('Study Hub',
          style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.5)),
      const SizedBox(height: 4),
      Text(goalLine, style: TextStyle(fontSize: 14, color: c.inkSoft)),
      const SizedBox(height: 14),
      // Phone portrait: hero full-width, mood card hidden.
      // iPad portrait + landscape: side by side.
      if (isPhonePortrait)
        _ContinueCard(name: name, mascotAsset: mascotAsset)
      else
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 3,
                child: _ContinueCard(name: name, mascotAsset: mascotAsset),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 1,
                child: const _StudyMoodCard(),
              ),
            ],
          ),
        ),
      const SizedBox(height: 14),
      const _MetricRow(),
      const SizedBox(height: 14),
      const _CourseProgressCard(),
      const SizedBox(height: 14),
      const _StreakHeatmapCard(),
      const SizedBox(height: 14),
      const _QuickActions(),
      const SizedBox(height: 14),
      if (mq.size.width >= 600)
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: const [
              Expanded(child: _StudyPlanCard()),
              SizedBox(width: 14),
              Expanded(child: _AnalyticsCard()),
            ],
          ),
        )
      else ...[
        const _StudyPlanCard(),
        const SizedBox(height: 14),
        const _AnalyticsCard(),
      ],
      const SizedBox(height: 14),
      const _DailyQuestionCard(),
      const SizedBox(height: 14),
      const _MascotCard(),
      const SizedBox(height: 14),
      const _WeakTopics(),
      const SizedBox(height: 14),
      const _RecentResults(),
      const SizedBox(height: 14),
      // Gold trophy Level/XP card — last card, matching the web/Capacitor app.
      _LevelCard(name: name),
    ];
    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
      children: reduced
          ? kids
          : AnimationConfiguration.toStaggeredList(
              duration: const Duration(milliseconds: 380),
              childAnimationBuilder: (w) => SlideAnimation(
                verticalOffset: 22,
                curve: AppCurves.easeOut,
                child: FadeInAnimation(child: w),
              ),
              children: kids,
            ),
    );
    return SafeArea(child: reduced ? list : AnimationLimiter(child: list));
  }
}

// ── Mascots bundled in assets/mascots/ (no network download) ──────────────
const _kMascots = [
  'assets/mascots/2d-brain-dj.webp',
  'assets/mascots/2d-microscope-wizard.webp',
  'assets/mascots/neon-brain-goggles.webp',
  'assets/mascots/neon-dna-hoverboard.webp',
  'assets/mascots/neon-stetho-rocket.webp',
  'assets/mascots/neon-tablet-doctor.webp',
  'assets/mascots/dashboard-hero-companion.webp',
  'assets/mascots/hero-brain-coffee.webp',
  'assets/mascots/hero-lesson-book.webp',
  'assets/mascots/vibe-dna-surf.webp',
  'assets/mascots/vibe-headphone-brain.webp',
  'assets/mascots/vibe-vial-stetho.webp',
];

// ── Study Mood card helpers ────────────────────────────────────────────────
class _MoodData {
  final String value;
  final String text;
  final int meter;
  const _MoodData(this.value, this.text, this.meter);
}

_MoodData _studyMood(int readiness, int streak, int weeklyAttempts) {
  if (readiness >= 80) return const _MoodData('Exam ready pace', 'Your readiness is strong. Keep reviewing weak areas to stay sharp.', 92);
  if (streak >= 5) return const _MoodData('Consistent progress', 'You have a strong streak. Keep one small task planned for today.', 84);
  if (weeklyAttempts >= 3) return const _MoodData('Practice in progress', 'You have attempted several practice sets. Review mistakes before starting more.', 72);
  if (readiness > 0) return _MoodData('Building readiness', 'You have started making progress. Finish one focused lesson or quiz next.', readiness.clamp(38, 100));
  return const _MoodData('Ready to begin', "Start with one short practice set or one lesson to build today's progress.", 34);
}

class _MetricRow extends ConsumerWidget {
  const _MetricRow();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dash = ref.watch(studentDashboardProvider);
    final courses = dash.maybeWhen(data: (d) {
      final n = d.courseProgress.isNotEmpty
          ? d.courseProgress.length
          : d.totalCourses;
      return '$n';
    }, orElse: () => '—');
    final coursesHint = dash.maybeWhen(data: (d) {
      final s = d.courseProgressSummary;
      return s.totalLessons > 0
          ? '${clampPct(s.overallProgressPercent)}% lessons'
          : 'In progress';
    }, orElse: () => '');
    final readiness =
        dash.maybeWhen(data: (d) => '${d.readiness}%', orElse: () => '—');
    final readinessHint = dash.maybeWhen(data: (d) {
      final delta = d.performanceSnapshot.scoreDelta;
      if (delta == 0) return 'Avg. readiness';
      return '${delta > 0 ? '+' : ''}${delta.round()}%';
    }, orElse: () => '');
    final streak =
        dash.maybeWhen(data: (d) => '${d.quizDayStreak}', orElse: () => '—');
    return Row(
      children: [
        Expanded(
            child: _MetricChip(
                value: courses,
                label: 'COURSES',
                hint: coursesHint,
                accent: DashAccents.violet)),
        const SizedBox(width: 8),
        Expanded(
            child: _MetricChip(
                value: readiness,
                label: 'READINESS',
                hint: readinessHint,
                accent: DashAccents.green)),
        const SizedBox(width: 8),
        Expanded(
            child: _MetricChip(
                value: streak,
                label: 'STREAK',
                hint: 'days',
                icon: Icons.local_fire_department_rounded,
                accent: DashAccents.amber)),
      ],
    );
  }
}

class _MetricChip extends StatelessWidget {
  final String value;
  final String label;
  final String hint;
  final IconData? icon;
  final SectionAccent? accent;
  const _MetricChip(
      {required this.value, required this.label, this.hint = '', this.icon, this.accent});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final a = accent;
    final valueColor = a != null ? a.textOn(dark) : c.inkStrong;
    final labelColor = a != null ? a.textOn(dark).withValues(alpha: 0.8) : c.inkSoft;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: a != null ? a.tint(dark) : c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.inner),
      ),
      child: Column(
        children: [
          if (icon != null)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: valueColor),
                const SizedBox(width: 3),
                Text(value,
                    style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: valueColor)),
              ],
            )
          else
            Text(value,
              style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: valueColor)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: labelColor,
                  letterSpacing: 0.6)),
          if (hint.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10.5, color: c.inkMuted)),
          ],
        ],
      ),
    );
  }
}

class _ContinueCard extends ConsumerWidget {
  final String name;
  final String mascotAsset;
  const _ContinueCard({required this.name, required this.mascotAsset});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final d =
        ref.watch(studentDashboardProvider).maybeWhen(data: (x) => x, orElse: () => null);
    final quizzes = ref
        .watch(quizListProvider)
        .maybeWhen(data: (x) => x, orElse: () => const <QuizListItem>[]);
    final notes = ref
        .watch(lessonsListProvider)
        .maybeWhen(data: (x) => x, orElse: () => const <LessonListItem>[]);

    final weak = (d != null && d.weakTopics.isNotEmpty) ? d.weakTopics.first : null;
    final recQuiz = _pickQuiz(quizzes, weak);
    final recNote = notes.isNotEmpty ? notes.first : null;

    String target;
    String label;
    IconData icon;
    if (recQuiz != null) {
      // Exam mode: a graded attempt is saved to the DB (practice only logs a
      // streak event), so completing it updates scores/results and this card
      // advances to the next quiz instead of re-suggesting the same one.
      target = '/app/quizzes/${recQuiz.id}?exam=1';
      label = 'Start quiz';
      icon = Icons.play_arrow_rounded;
    } else if (recNote != null) {
      target = '/app/study/lesson/${recNote.lessonId}';
      label = 'Review lesson';
      icon = Icons.menu_book_rounded;
    } else {
      target = '/app/quizzes';
      label = 'Open quizzes';
      icon = Icons.play_arrow_rounded;
    }

    // Build breadcrumb: Course · Subject for quiz, or fallback
    String breadcrumb;
    String quizTitle;
    if (recQuiz != null) {
      final parts = [recQuiz.courseTitle, recQuiz.subjectName]
          .where((s) => s.isNotEmpty)
          .toList();
      breadcrumb = parts.join(' · ');
      quizTitle = recQuiz.displayName;
    } else if (recNote != null) {
      breadcrumb = d != null && d.recentAttempts.isNotEmpty
          ? d.recentAttempts.first.courseTitle
          : '';
      quizTitle = recNote.title;
    } else {
      breadcrumb = '';
      quizTitle = 'Start studying';
    }

    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── text area ──────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CONTINUE WHERE YOU LEFT OFF',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                            color: c.accent)),
                    if (breadcrumb.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(breadcrumb,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: c.inkSoft)),
                    ],
                    const SizedBox(height: 4),
                    Text(quizTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // ── mascot image (bundled asset, no download) ──
              Image.asset(
                mascotAsset,
                width: 92,
                height: 92,
                fit: BoxFit.contain,
                errorBuilder: (context, error, _) => const SizedBox(width: 92, height: 92),
              ),
            ],
          ),
          const SizedBox(height: 14),
          AppButton(label,
              kind: AppButtonKind.cta,
              expand: true,
              leading: Icon(icon, color: Colors.white, size: 20),
              onPressed: () => context.push(target)),
        ],
      ),
    );
  }
}

// ── Study Mood Card — compact status strip (≈ 1/4 hero height) ────────────
class _StudyMoodCard extends ConsumerWidget {
  const _StudyMoodCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final d = ref
        .watch(studentDashboardProvider)
        .maybeWhen(data: (x) => x, orElse: () => null);
    final mood = _studyMood(
      d?.readiness ?? 0,
      d?.quizDayStreak ?? 0,
      d?.performanceSnapshot.weeklyAttempts ?? 0,
    );
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: DashAccents.cyan.tint(dark),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(Icons.insights_outlined,
                size: 17, color: DashAccents.cyan.textOn(dark)),
          ),
          const Spacer(),
          Text('STUDY\nSTATUS',
              style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  height: 1.3,
                  color: c.inkMuted)),
          const SizedBox(height: 4),
          Text(mood.value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  height: 1.2,
                  color: c.inkStrong)),
          const SizedBox(height: 6),
          Text(mood.text,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 10,
                  fontStyle: FontStyle.italic,
                  height: 1.4,
                  color: c.inkSoft)),
          const SizedBox(height: 8),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: mood.meter / 100.0),
            duration: const Duration(milliseconds: 900),
            curve: AppCurves.easeOut,
            builder: (_, v, child) => ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: v,
                minHeight: 5,
                backgroundColor: c.surface2,
                valueColor: AlwaysStoppedAnimation(DashAccents.cyan.color),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CourseProgressCard extends ConsumerWidget {
  const _CourseProgressCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final d = ref
        .watch(studentDashboardProvider)
        .maybeWhen(data: (x) => x, orElse: () => null);
    if (d == null) {
      return const GlassCard(
        padding: EdgeInsets.all(18),
        child: SizedBox(
            height: 96,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }
    final s = d.courseProgressSummary;
    final courses = [...d.courseProgress]
      ..sort((a, b) => b.progressPercent.compareTo(a.progressPercent));
    final top = courses.take(3).toList();
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Course progress',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const Spacer(),
              GestureDetector(
                onTap: () => context.push('/app/courses'),
                child: Text('Courses',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: c.accent)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              ScoreRing(
                  percent: clampPct(s.overallProgressPercent).toDouble(),
                  size: 92,
                  label: 'Lessons'),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${s.completedLessons} / ${s.totalLessons} lessons',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                    const SizedBox(height: 3),
                    Text(
                        '${s.visibleCourses} course${s.visibleCourses == 1 ? '' : 's'} in progress',
                        style: TextStyle(fontSize: 13, color: c.inkSoft)),
                  ],
                ),
              ),
            ],
          ),
          if (top.isNotEmpty) ...[
            const SizedBox(height: 14),
            for (final course in top)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    SizedBox(
                      width: 116,
                      child: Text(course.courseTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: c.inkMedium)),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: (course.progressPercent / 100).clamp(0.0, 1.0),
                          minHeight: 8,
                          backgroundColor: c.surface2,
                          valueColor: AlwaysStoppedAnimation(c.primary),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text('${clampPct(course.progressPercent)}%',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: c.inkSoft)),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _StreakHeatmapCard extends ConsumerWidget {
  const _StreakHeatmapCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final dash = ref.watch(studentDashboardProvider);
    final streak = dash.maybeWhen(data: (d) => d.quizDayStreak, orElse: () => 0);
    final activeDaySet = dash.maybeWhen(
      data: (d) => Set<String>.from(d.recentActiveDays),
      orElse: () => <String>{},
    );
    final now = DateTime.now();
    // Monday of the current week
    final monday = now.subtract(Duration(days: now.weekday - 1));
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    // Date key for each day of the current week (Mon=0 … Sun=6)
    String dayKey(int i) {
      final d = monday.add(Duration(days: i));
      return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    }
    bool isFuture(int i) => monday.add(Duration(days: i)).isAfter(now);
    bool isToday(int i) {
      final d = monday.add(Duration(days: i));
      return d.year == now.year && d.month == now.month && d.day == now.day;
    }
    // Count active days so far this week
    final activeDaysCount = List.generate(7, (i) => i)
        .where((i) => !isFuture(i) && activeDaySet.contains(dayKey(i)))
        .length;
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_fire_department_rounded,
                  size: 18, color: streak > 0 ? const Color(0xFFFF6B35) : c.inkMuted),
              const SizedBox(width: 6),
              Text('Daily streak',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const Spacer(),
              Text('$streak day${streak == 1 ? '' : 's'}',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: streak > 0 ? const Color(0xFFFF6B35) : c.inkMuted)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (int i = 0; i < labels.length; i++)
                _HeatCell(
                  label: labels[i],
                  active: !isFuture(i) && activeDaySet.contains(dayKey(i)),
                  isToday: isToday(i),
                  isFuture: isFuture(i),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
              activeDaysCount > 0
                  ? '$activeDaysCount day${activeDaysCount == 1 ? '' : 's'} active this week.'
                  : 'No activity yet this week.',
              style: TextStyle(fontSize: 13, color: c.inkSoft)),
        ],
      ),
    );
  }
}

class _HeatCell extends StatelessWidget {
  final String label;
  final bool active;
  final bool isToday;
  final bool isFuture;
  const _HeatCell(
      {required this.label, required this.active, required this.isToday, this.isFuture = false});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final green = DashAccents.green;
    return Column(
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            gradient: active ? green.gradient : null,
            color: active ? null : isFuture ? c.surface2.withValues(alpha: 0.4) : c.surface2,
            shape: BoxShape.circle,
            border: isToday ? Border.all(color: green.color, width: 1.8) : null,
          ),
          child: active
              ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
              : null,
        ),
        const SizedBox(height: 5),
        Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: isToday
                    ? green.color
                    : isFuture
                        ? c.inkMuted
                        : c.inkSoft)),
      ],
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();
  static const _items = [
    (Icons.assignment_outlined, 'Exams', '/app/exams', DashAccents.blue),
    (Icons.event_note_outlined, 'Planner', '/app/planner', DashAccents.amber),
    (Icons.quiz_outlined, 'Q-Bank', '/app/quizzes', DashAccents.violet),
    (Icons.sticky_note_2_outlined, 'Lessons', '/app/lessons', DashAccents.cyan),
    (Icons.bookmark_outline_rounded, 'Saved', '/app/bookmarks', DashAccents.rose),
    (Icons.insights_outlined, 'Results', '/app/results', DashAccents.green),
  ];
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (int r = 0; r < _items.length; r += 3)
          Padding(
            padding: EdgeInsets.only(top: r == 0 ? 0 : 10),
            child: Row(
              children: [
                for (int i = r; i < r + 3 && i < _items.length; i++) ...[
                  if (i != r) const SizedBox(width: 10),
                  Expanded(
                    child: _QuickTile(
                      icon: _items[i].$1,
                      label: _items[i].$2,
                      accent: _items[i].$4,
                      onTap: () => context.push(_items[i].$3),
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _QuickTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final SectionAccent accent;
  final VoidCallback onTap;
  const _QuickTile(
      {required this.icon,
      required this.label,
      required this.accent,
      required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.inner),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.inner),
        child: Ink(
          decoration: BoxDecoration(
            gradient: accent.gradient,
            borderRadius: BorderRadius.circular(AppRadius.inner),
            boxShadow: [
              BoxShadow(
                color: accent.color.withValues(alpha: 0.30),
                blurRadius: 16,
                spreadRadius: -8,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(icon, color: Colors.white, size: 21),
                ),
                const SizedBox(height: 8),
                Text(label,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Colors.white)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PlanItem {
  final String label;
  final IconData icon;
  final String title;
  final String detail;
  final bool done;
  final String route;
  const _PlanItem({
    required this.label,
    required this.icon,
    required this.title,
    required this.detail,
    required this.done,
    required this.route,
  });
}

class _StudyPlanCard extends ConsumerWidget {
  const _StudyPlanCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final d = ref.watch(studentDashboardProvider).maybeWhen(
        data: (x) => x, orElse: () => null);
    final quizzes = ref
        .watch(quizListProvider)
        .maybeWhen(data: (x) => x, orElse: () => const <QuizListItem>[]);
    final notes = ref
        .watch(lessonsListProvider)
        .maybeWhen(data: (x) => x, orElse: () => const <LessonListItem>[]);

    final weak = (d != null && d.weakTopics.isNotEmpty) ? d.weakTopics.first : null;
    final recQuiz = _pickQuiz(quizzes, weak);
    final recNote = notes.isNotEmpty ? notes.first : null;
    final latestAttempt = (d != null && d.recentAttempts.isNotEmpty) ? d.recentAttempts.first : null;

    // Completion detection via actionType — avoids fragile keyword collisions.
    final doneTypes = (d?.adaptivePlan ?? [])
        .where((s) => s.status == 'done')
        .map((s) => s.actionType)
        .toSet();

    final practiceToday = latestAttempt != null &&
        DateTime.now()
                .difference(DateTime.tryParse(latestAttempt.submittedAt)?.toLocal() ?? DateTime(2000))
                .inHours <
            24;

    final steps = [
      _PlanItem(
        label: 'Practice',
        icon: Icons.play_arrow_rounded,
        title: weak != null
            ? 'Answer questions on ${weak.topicName}'
            : recQuiz?.displayName ?? 'Do one focused practice set',
        detail: weak != null
            ? (weak.courseTitle.isEmpty ? 'Weak area' : weak.courseTitle)
            : (recQuiz != null
                ? [recQuiz.courseTitle, recQuiz.subjectName]
                    .where((s) => s.isNotEmpty)
                    .join(' · ')
                : 'Use any short set you can finish today'),
        done: practiceToday || doneTypes.contains('quiz'),
        // Exam mode so the attempt is graded + saved to the DB — that's what
        // flips this step to "done" and feeds results/weak-topics.
        route: recQuiz != null ? '/app/quizzes/${recQuiz.id}?exam=1' : '/app/quizzes',
      ),
      _PlanItem(
        label: 'Review',
        icon: Icons.rate_review_rounded,
        title: latestAttempt != null
            ? 'Review your latest answers'
            : 'Check your results page',
        detail: latestAttempt != null
            ? '${latestAttempt.quizTitle} · ${latestAttempt.percentage.round()}%'
            : 'Complete an exam to see results',
        done: doneTypes.contains('results'),
        route: latestAttempt != null
            ? '/app/results/${latestAttempt.id}'
            : '/app/results',
      ),
      _PlanItem(
        label: 'Lesson',
        icon: Icons.menu_book_rounded,
        title: recNote?.title ?? 'Open one lesson note',
        detail: recNote != null ? 'Lesson note' : 'Study one topic in depth',
        done: doneTypes.contains('note'),
        route: recNote != null
            ? '/app/study/lesson/${recNote.lessonId}'
            : '/app/lessons',
      ),
    ];

    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('STUDY PLAN',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: c.inkMuted)),
                    const SizedBox(height: 2),
                    Text("Today's route",
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          for (int i = 0; i < steps.length; i++) ...[
            _PlanRow(item: steps[i], index: i,
                onTap: () => context.push(steps[i].route)),
            if (i < steps.length - 1)
              Padding(
                padding: const EdgeInsets.only(left: 13),
                child: Container(width: 2, height: 12, color: c.surface2),
              ),
          ],
        ],
      ),
    );
  }
}

class _PlanRow extends StatelessWidget {
  final _PlanItem item;
  final int index;
  final VoidCallback onTap;
  const _PlanRow({required this.item, required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final done = item.done;
    final isNext = !done;
    final badgeColor = done ? c.success : c.primary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // step badge
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration:
                  BoxDecoration(color: badgeColor, shape: BoxShape.circle),
              child: done
                  ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
                  : Text('${index + 1}',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Colors.white)),
            ),
            const SizedBox(width: 12),
            // label + title + detail
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.label.toUpperCase(),
                      style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                          color: c.inkMuted)),
                  const SizedBox(height: 1),
                  Text(item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: done
                              ? c.inkSoft
                              : c.inkStrong,
                          decoration: done
                              ? TextDecoration.lineThrough
                              : TextDecoration.none)),
                  if (item.detail.isNotEmpty) ...[
                    const SizedBox(height: 1),
                    Text(item.detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11, color: c.inkSoft)),
                  ],
                ],
              ),
            ),
            if (isNext)
              Icon(Icons.chevron_right_rounded, color: c.inkSoft, size: 20),
          ],
        ),
      ),
    );
  }
}

class _AnalyticsCard extends ConsumerWidget {
  const _AnalyticsCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final d = ref
        .watch(studentDashboardProvider)
        .maybeWhen(data: (x) => x, orElse: () => null);
    if (d == null) return const SizedBox.shrink();
    final snap = d.performanceSnapshot;
    final values = d.recentAttempts.isNotEmpty
        ? (d.recentAttempts.take(7).toList().reversed
            .map((a) => clampPct(a.percentage).toDouble())
            .toList())
        : <double>[];
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Readiness: ${snap.readinessLabel}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
              ),
              GestureDetector(
                onTap: () => context.push('/app/results'),
                child: Text('Results',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: c.accent)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _AnalyticStat(
                  value: '${snap.weeklyAttempts}', label: 'Last 7 days'),
              const SizedBox(width: 14),
              _AnalyticStat(
                  value: '${clampPct(snap.weeklyAverage)}%', label: 'Average'),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 64,
            width: double.infinity,
            child: CustomPaint(
              painter: _SparklinePainter(
                values: values,
                fallbackAvg: clampPct(snap.weeklyAverage).toDouble(),
                line: DashAccents.cyan.color,
                grid: c.line,
              ),
            ),
          ),
          if (snap.trendLabel.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(snap.trendLabel,
                style: TextStyle(fontSize: 13, color: c.inkSoft)),
          ],
        ],
      ),
    );
  }
}

class _AnalyticStat extends StatelessWidget {
  final String value;
  final String label;
  const _AnalyticStat({required this.value, required this.label});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(AppRadius.inner),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 12, color: c.inkSoft)),
          ],
        ),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> values;
  final double fallbackAvg;
  final Color line;
  final Color grid;
  _SparklinePainter(
      {required this.values,
      required this.fallbackAvg,
      required this.line,
      required this.grid});

  @override
  void paint(Canvas canvas, Size size) {
    final pts = values.isNotEmpty
        ? values
        : [
            (fallbackAvg - 16).clamp(0, 100).toDouble(),
            fallbackAvg,
            (fallbackAvg + 10).clamp(0, 100).toDouble(),
          ];
    // gridlines
    final gridPaint = Paint()
      ..color = grid.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    for (final f in [0.2, 0.5, 0.8]) {
      final y = size.height * f;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    final n = pts.length;
    Offset at(int i) {
      final x = n == 1 ? size.width / 2 : (i / (n - 1)) * size.width;
      final y = size.height - (pts[i].clamp(0, 100) / 100) * (size.height - 6) - 3;
      return Offset(x, y);
    }

    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (int i = 1; i < n; i++) {
      path.lineTo(at(i).dx, at(i).dy);
    }
    // area
    final area = Path.from(path)
      ..lineTo(at(n - 1).dx, size.height)
      ..lineTo(at(0).dx, size.height)
      ..close();
    canvas.drawPath(
        area, Paint()..color = line.withValues(alpha: 0.20));
    canvas.drawPath(
      path,
      Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );
    final last = at(n - 1);
    canvas.drawCircle(last, 4, Paint()..color = line);
    canvas.drawCircle(
        last, 4, Paint()..color = line.withValues(alpha: 0.25)..strokeWidth = 4
          ..style = PaintingStyle.stroke);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter old) =>
      old.values != values || old.fallbackAvg != fallbackAvg;
}

class _DailyQuestionCard extends ConsumerWidget {
  const _DailyQuestionCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final q = ref
        .watch(studentDashboardProvider)
        .maybeWhen(data: (d) => d.questionOfDay, orElse: () => null);
    if (q == null) return const SizedBox.shrink();
    final crumb = [q.subjectName, q.courseTitle]
        .where((s) => s.isNotEmpty)
        .join(' · ');
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('QUESTION OF THE DAY',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.0,
                  color: DashAccents.amber.textOn(
                      Theme.of(context).brightness == Brightness.dark))),
          const SizedBox(height: 8),
          Text(q.questionText,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 15,
                  height: 1.35,
                  fontWeight: FontWeight.w600,
                  color: c.inkStrong)),
          if (crumb.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(crumb, style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
          ],
          const SizedBox(height: 14),
          AppButton('Answer in Q-Bank',
              kind: AppButtonKind.soft,
              expand: true,
              leading: Icon(Icons.bolt_rounded,
                  color: DashAccents.amber.textOn(
                      Theme.of(context).brightness == Brightness.dark),
                  size: 19),
              onPressed: () => context.push('/app/quizzes')),
        ],
      ),
    );
  }
}

/// Compact gold-trophy Level/XP card — mirrors the web `study-level-summary`.
class _LevelCard extends ConsumerWidget {
  final String name;
  const _LevelCard({required this.name});

  static String _fmtNum(int v) {
    final s = v.toString();
    final b = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
      b.write(s[i]);
    }
    return b.toString();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final d = ref
        .watch(studentDashboardProvider)
        .maybeWhen(data: (x) => x, orElse: () => null);
    if (d == null) return const SizedBox.shrink();
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: DashAccents.gold.gradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: DashAccents.gold.color.withValues(alpha: 0.35),
                  blurRadius: 16,
                  spreadRadius: -6,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.emoji_events_rounded,
                color: Colors.white, size: 25),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("You're doing great, $name!",
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        height: 1.16,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Text('Keep your focus high and your future will thank you.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                        color: c.inkSoft)),
              ],
            ),
          ),
          const SizedBox(width: 6),
          _LevelStat(label: 'XP', value: _fmtNum(d.earnedXp)),
          Container(
            width: 1,
            height: 30,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            color: c.line,
          ),
          _LevelStat(label: 'Level', value: '${d.level}'),
        ],
      ),
    );
  }
}

class _LevelStat extends StatelessWidget {
  final String label;
  final String value;
  const _LevelStat({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w800, color: c.inkSoft)),
        const SizedBox(height: 3),
        Text(value,
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w900, color: c.inkStrong)),
      ],
    );
  }
}

class _MascotCard extends ConsumerWidget {
  const _MascotCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final due = ref.watch(flashDecksProvider).maybeWhen(
        data: (d) => d.totalDue, orElse: () => -1);
    final title = due > 0 ? 'Cards are due!' : 'All caught up!';
    final subtitle = due > 0
        ? 'Review $due flashcard${due == 1 ? '' : 's'} due across your decks.'
        : due == 0
            ? 'No flashcards are due right now.'
            : 'Checking your flashcard decks…';
    return GlassCard(
      onTap: () => context.push('/app/flashcards'),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(colors: [
                c.accent.withValues(alpha: 0.22),
                c.primary.withValues(alpha: 0.18),
              ]),
            ),
            child: Icon(Icons.psychology_alt_outlined, color: c.accent, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Text(subtitle,
                    style: TextStyle(fontSize: 13, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WeakTopics extends ConsumerWidget {
  const _WeakTopics();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final topics = ref.watch(studentDashboardProvider).maybeWhen(
        data: (d) => d.weakTopics, orElse: () => const <WeakTopic>[]);
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Weak topics',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
          const SizedBox(height: 10),
          if (topics.isEmpty)
            Text('Complete a few quizzes to reveal your weak topics.',
                style: TextStyle(fontSize: 14, color: c.inkSoft))
          else
            for (final t in topics)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    SizedBox(
                      width: 116,
                      child: Text(t.topicName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: c.inkMedium)),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(
                              begin: 0,
                              end: (t.averagePercentage / 100).clamp(0.0, 1.0)),
                          duration: const Duration(milliseconds: 700),
                          curve: AppCurves.easeOut,
                          builder: (_, v, _) => LinearProgressIndicator(
                            value: v,
                            minHeight: 8,
                            backgroundColor: c.surface2,
                            valueColor:
                                AlwaysStoppedAnimation(DashAccents.rose.color),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text('${t.averagePercentage.round()}%',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: DashAccents.rose.textOn(
                                Theme.of(context).brightness ==
                                    Brightness.dark))),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _RecentResults extends ConsumerWidget {
  const _RecentResults();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final results = ref.watch(resultsListProvider);
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent results',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
          const SizedBox(height: 6),
          results.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                  child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))),
            ),
            error: (_, _) => Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text("Couldn't load recent results.",
                  style: TextStyle(fontSize: 14, color: c.inkSoft)),
            ),
            data: (list) {
              if (list.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('No results yet — your scores will show here.',
                      style: TextStyle(fontSize: 14, color: c.inkSoft)),
                );
              }
              final rows = list.take(3).toList();
              return Column(
                children: [
                  for (int i = 0; i < rows.length; i++)
                    _resultRow(context, c, rows[i], first: i == 0),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _resultRow(BuildContext context, AppColors c, ResultListItem r,
      {required bool first}) {
    final pct = r.percentage;
    final scoreColor = pct >= 75
        ? DashAccents.green.color
        : (pct >= 50 ? DashAccents.amber.color : DashAccents.rose.color);
    return InkWell(
      onTap: () => context.push('/app/results/${r.attemptId}'),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          border: first ? null : Border(top: BorderSide(color: c.line)),
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scoreColor.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(_gradeLetter(pct),
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: scoreColor,
                      fontSize: 14)),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: c.inkStrong)),
                  Text(_timeAgo(r.submittedAt),
                      style: TextStyle(fontSize: 12, color: c.inkSoft)),
                ],
              ),
            ),
            Text('${pct.round()}%',
                style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800,
                    color: scoreColor)),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        child: Row(
          children: [
            Icon(icon, size: 21, color: color),
            const SizedBox(width: 14),
            Text(label,
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}
