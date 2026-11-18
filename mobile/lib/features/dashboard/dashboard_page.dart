import '../../utils/count_plus.dart';
import 'dart:async';
import '../../core/perf_log.dart';
import 'dart:math' as math;
import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../state/onboarding.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../results/reviewed_attempts.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';
import '../../state/auth_controller.dart';
import '../notifications/notifications_popup.dart';
import '../quizzes/quizzes_repository.dart';
import '../flashcards/flashcards_repository.dart';
import '../lessons/lessons_repository.dart';
import '../lessons/lesson_models.dart';
import 'dashboard_repository.dart';
import '../../state/study_days.dart';
import 'first_streak_popup.dart';
import '../search/global_search_page.dart';
import '../../services/streak_reminders.dart';
import '../../services/plan_reminders.dart';
import '../notifications/announcement_widgets.dart';
import '../../widgets/shell_insets.dart';
import '../../widgets/profile_avatar.dart';
import 'question_of_day.dart';

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
  // Nothing the user can actually sit. Return null rather than falling back to
  // *any* quiz: the two fallbacks that used to live here dropped the `open`
  // filter, so once the unlocked quizzes were finished this handed back a
  // locked one — which the caller then offered as "continue where you left
  // off", and tapping it stalled against a backend that refuses access.
  // Returning null also makes the caller's lesson/review branches reachable;
  // previously this function only ever returned null for an empty list, so
  // they were dead code.
  return null;
}

/// Where the "Continue where you left off" card is in its Exam → Review →
/// Lesson rotation. Persisted, so closing the app does not send the card back
/// to the same suggestion it just handed out.
class ContinueTurn extends Notifier<int> {
  static const String _key = 'xyndrome.continue_turn';

  @override
  int build() => ref.read(sharedPrefsProvider).getInt(_key) ?? 0;

  void advance() {
    // Bounded so the stored value cannot grow without limit; 6 is a multiple
    // of every possible slot count (1, 2 or 3), so wrapping never skips one.
    final next = (state + 1) % 6;
    state = next;
    ref.read(sharedPrefsProvider).setInt(_key, next);
  }
}

final continueTurnProvider =
    NotifierProvider<ContinueTurn, int>(ContinueTurn.new);

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  static bool _firstBuildMarked = false;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!_firstBuildMarked && ref.read(studentDashboardProvider).hasValue) {
      _firstBuildMarked = true;
      PerfLog.mark('study hub shown with data');
    }
    // Whenever fresh dashboard data comes in, reconcile the "streak ends
    // tonight" reminder against it — a no-op if the streak is 0 or today's
    // quiz is already done, since reconcile() always cancels-then-reschedules.
    ref.listen(studentDashboardProvider, (previous, next) {
      final d = next.maybeWhen(data: (d) => d, orElse: () => null);
      if (d != null) {
        StreakReminders.reconcile(
          streak: d.quizDayStreak,
          doneToday: d.quizDoneToday,
          graceActive: d.streakGraceActive,
        );
        // Weekly local reminder naming the weakest subject (step 4).
        final weak = d.weakTopics.isEmpty ? null : d.weakTopics.first;
        PlanReminders.reconcileWeak(
            subject: weak?.topicName ?? '', course: weak?.courseTitle ?? '');
      }
    });
    final c = context.c;
    final user = ref.watch(authControllerProvider).user;
    final name = (user?.fullName.trim().isNotEmpty ?? false)
        ? user!.fullName.split(RegExp(r'\s+')).first
        : 'there';

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
    // iPad: the photo spans a much wider screen at the same height, so it
    // was zoomed into a thin slice. A taller header there shows about half
    // of it, close to what the phone shows (2026-11-17, mock B). The room goes
    // under the bell + profile row, so those stay at the top.
    // 2026-11-18: "Study Hub" moved up on big screens (gap 140 → 60) and the
    // picture made a bit shorter (140 → 100 extra) — same top, same framing,
    // so it still reaches behind the top of the Continue card.
    final heroExtra = mq.size.width >= 700 ? 60.0 : 0.0;
    final heroImageExtra = mq.size.width >= 700 ? 100.0 : 0.0;
    final kids = <Widget>[
      // Top bar: notifications + profile
      Row(
        children: [
          const FirstStreakWatcher(),
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
            onTap: () => context.push('/app/profile'),
            child: ClipOval(
              // The user's own avatar instead of their initials, at the same 38
              // the gradient circle was — ClipOval, because ProfileAvatar draws
              // a rounded square and this slot is round.
              child: ProfileAvatar.from(
                avatarKey: user?.avatarKey,
                seed: user?.id ?? user?.email ?? user?.fullName,
                size: 38,
                radius: 0,
              ),
            ),
          ),
        ],
      ),
      SizedBox(height: 2 + heroExtra),
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
      const GlobalSearch(),
      const SizedBox(height: 14),
      // Admin announcement: a banner here, or a centre card shown once (step 4).
      const AnnouncementBanner(),
      const AnnouncementCardHost(),
      // Phone portrait: hero full width, course progress further down.
      // iPad: the continue card and course progress side by side, 2.5 : 1.5
      // (the old "Study status" card is gone, 2026-11-17).
      if (isPhonePortrait)
        _ContinueCard(name: name, mascotAsset: mascotAsset)
      else
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 5,
                child: _ContinueCard(name: name, mascotAsset: mascotAsset),
              ),
              const SizedBox(width: 10),
              const Expanded(flex: 3, child: _CourseProgressCard()),
            ],
          ),
        ),
      const SizedBox(height: 14),
      const _MetricRow(),
      const SizedBox(height: 14),
      if (isPhonePortrait) ...[
        const _CourseProgressCard(),
        const SizedBox(height: 14),
      ],
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
              Expanded(child: _AnalyticsCard(fill: true)),
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
    // The artwork goes BEHIND the first child rather than over the whole page,
    // so it scrolls away with the content instead of staying pinned under it —
    // and the top SafeArea comes off below, so the scroll view owns the full
    // height and the picture can reach the top of the screen.
    final safeTop = mq.viewPadding.top;
    if (kids.isNotEmpty) {
      kids[0] = Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            // Back out of the list's own padding to reach the screen's edges
            // and its very top.
            top: -(safeTop + 14),
            left: -16,
            right: -16,
            height: safeTop + heroImageExtra + _HubHero.toCardTop + _HubHero.intoCard,
            child: _HubHero(pull: _heroPull),
          ),
          kids[0],
        ],
      );
    }

    final list = ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      // The artwork hangs off the first (38pt) row, so the list must keep that
      // row alive until the whole picture is off screen — with the default
      // 250 the row was dropped early and the picture vanished mid-scroll
      // (2026-11-18, phone and iPad).
      scrollCacheExtent: const ScrollCacheExtent.pixels(700),
      padding: EdgeInsets.fromLTRB(16, safeTop + 14, 16, shellScrollEnd(context)),
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
    // How far the list is pulled down past the top (iOS bounce): the artwork's
    // top edge fades by that much, so the gap above it never shows a hard
    // line. 0 at rest, so the resting picture is unchanged (2026-11-18).
    final listened = NotificationListener<ScrollUpdateNotification>(
      onNotification: (n) {
        if (n.depth == 0) {
          final pull = n.metrics.pixels < 0 ? -n.metrics.pixels : 0.0;
          if (pull != _heroPull.value) _heroPull.value = pull;
        }
        return false;
      },
      child: list,
    );
    // No top SafeArea: the inset is in the list's padding above, so the
    // viewport runs to the top of the screen and the artwork is not clipped
    // short of it.
    return reduced ? listened : AnimationLimiter(child: listened);
  }
}

/// The artwork behind the top of the Study Hub, bundled in assets/hub/.
/// One per day, the same way the mascots rotate.
/// Night desks, for the dark theme.
const _kHubHeroes = [
  'assets/hub/hero_1.webp',
  'assets/hub/hero_2.webp',
  'assets/hub/hero_3.webp',
  'assets/hub/hero_4.webp',
  'assets/hub/hero_5.webp',
  'assets/hub/hero_6.webp',
  'assets/hub/hero_7.webp',
];

/// Daylight desks, for the light theme. A set of its own rather than the same
/// pictures lightened: these are lit from the window, and the empty space the
/// words sit on is the bright side instead of the dark one.
const _kHubHeroesLight = [
  'assets/hub/hero_light_1.webp',
  'assets/hub/hero_light_2.webp',
  'assets/hub/hero_light_3.webp',
  'assets/hub/hero_light_4.webp',
  'assets/hub/hero_light_5.webp',
  'assets/hub/hero_light_6.webp',
];

/// Pull-down distance past the top of the Study Hub list (see build).
final _heroPull = ValueNotifier<double>(0);

/// A full-bleed photograph behind the page's first screenful, dissolving into
/// the page colour before it reaches the bottom of the Continue card.
class _HubHero extends StatelessWidget {
  final ValueListenable<double> pull;
  const _HubHero({required this.pull});

  /// From the top of the list's content down to the Continue card's own top:
  /// the 14 padding, the avatar row, and the eyebrow / title / goal-line stack
  /// with its gaps. These are all fixed sizes, so this is arithmetic rather
  /// than a guess — but it is still a number to re-check if that header ever
  /// changes.
  static const double toCardTop = 14 + 38 + 2 + 16 + 5 + 36 + 4 + 18 + 14;

  /// How far INTO the card the artwork is allowed to reach. Half of it.
  static const double intoCard = 74;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final set = dark ? _kHubHeroes : _kHubHeroesLight;
    final asset = set[DateTime.now().day % set.length];

    // Edges fade to SEE-THROUGH (2026-11-18): the top only while the list is
    // pulled down (fade height = the pull, so at rest nothing changes) and a
    // short fade on the left edge (next to the iPad side nav). Bottom and
    // right are as they always were.
    return IgnorePointer(
        child: ValueListenableBuilder<double>(
          valueListenable: pull,
          builder: (context, p, child) => ShaderMask(
            blendMode: BlendMode.dstIn,
            shaderCallback: (rect) {
              final top = rect.height <= 0 ? 0.0 : (p / rect.height).clamp(0.0, 0.35);
              return LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                // Top only (while pulled). The bottom / right side is back to
                // the original look (user, 2026-11-18).
                colors: const [Color(0x00FFFFFF), Color(0xFFFFFFFF)],
                stops: [0.0, top],
              ).createShader(rect);
            },
            // Left edge too: on iPad landscape the picture starts right next
            // to the side nav, which left a hard vertical line. A short fade,
            // the same on every device (2026-11-18).
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (rect) => LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: const [Color(0x00FFFFFF), Color(0xFFFFFFFF)],
                stops: [0.0, rect.width <= 0 ? 0.0 : (56 / rect.width).clamp(0.0, 0.2)],
              ).createShader(rect),
              child: child,
            ),
          ),
          child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(asset,
                fit: BoxFit.cover,
                // iPad: the picture slid up inside the header, so more of the
                // desk shows and less sky (2026-11-17). Phone: as before.
                alignment: MediaQuery.sizeOf(context).width >= 700
                    ? const Alignment(1, 0.35)
                    : Alignment.centerRight),
            // Down the picture: a touch of shade at the very top so the status
            // bar and the avatar row stay readable over the lamp, then clear
            // through the middle, then all the way to the page colour so the
            // photograph ends without an edge.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    c.page.withValues(alpha: 0.45),
                    c.page.withValues(alpha: 0.10),
                    c.page.withValues(alpha: 0.55),
                    c.page,
                  ],
                  stops: const [0.0, 0.3, 0.72, 1.0],
                ),
              ),
            ),
            // And across it: the words all sit on the left, where every one of
            // these photographs is darkest, so this only has to deepen it.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    c.page.withValues(alpha: 0.55),
                    c.page.withValues(alpha: 0.0),
                  ],
                  stops: const [0.0, 0.62],
                ),
              ),
            ),
          ],
        ),
        ),
    );
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
    // Average exam mark, computed on the device from the same attempts the
    // Results page lists — total marks over number of attempts. Replaces the
    // old READINESS chip, which came from a backend snapshot score.
    final examAvg = ref.watch(examAverageProvider);
    // Floored, not rounded — see ExamAverage.displayAverage/displayDelta.
    final avgValue = examAvg.maybeWhen(
        data: (e) => e.hasData ? '${e.displayAverage}%' : '—',
        orElse: () => '—');
    final avgAttempts =
        examAvg.maybeWhen<int>(data: (e) => e.attempts, orElse: () => 0);
    final avgDeltaShown = examAvg.maybeWhen<int>(
        data: (e) => e.hasData ? (e.displayDelta ?? 0) : 0, orElse: () => 0);
    final String avgHint;
    if (avgAttempts == 0) {
      avgHint = 'No exams yet';
    } else if (avgDeltaShown == 0) {
      // 10.29: best mark per exam, so the hint is how many exams it covers.
      avgHint = '$avgAttempts exam${avgAttempts == 1 ? '' : 's'}';
    } else {
      // Bare "+4%" / "-4%" — the minus sign comes free from the int.
      avgHint = '${avgDeltaShown > 0 ? '+' : ''}$avgDeltaShown%';
    }
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
                value: avgValue,
                label: 'AVG MARKS',
                hint: avgHint,
                hintTrend: avgDeltaShown == 0 ? null : avgDeltaShown > 0,
                // The chip stays green; only the number is red below 45,
                // amber 45-75, green above 75.
                accent: DashAccents.green,
                valueAccent: examAvg.maybeWhen<SectionAccent?>(
                    data: (e) => !e.hasData
                        ? null
                        : e.displayAverage < 45
                            ? DashAccents.rose
                            : e.displayAverage <= 75
                                ? DashAccents.amber
                                : DashAccents.green,
                    orElse: () => null))),
        const SizedBox(width: 8),
        Expanded(
            child: _MetricChip(
                value: streak,
                label: 'STREAK',
                hint: 'days',
                icon: Icons.local_fire_department_rounded,
                accent: DashAccents.peach,
                // Brighter than the usual darkened tint text, so it reads
                // orange rather than brown.
                inkLight: const Color(0xFFEA580C),
                inkDark: const Color(0xFFFDBA74))),
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

  /// Colours only the big number, when it should differ from the chip.
  final SectionAccent? valueAccent;

  /// Replaces the number, label and icon colour in light / dark mode.
  final Color? inkLight;
  final Color? inkDark;

  /// Colours [hint]: true = improved (green), false = worse (red), null =
  /// neutral. No icon — the signed number carries the direction on its own.
  final bool? hintTrend;

  const _MetricChip(
      {required this.value,
      required this.label,
      this.hint = '',
      this.icon,
      this.accent,
      this.valueAccent,
      this.inkLight,
      this.inkDark,
      this.hintTrend});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final a = accent;
    final va = valueAccent ?? a;
    final ink = dark ? inkDark : inkLight;
    final valueColor = ink ?? (va != null ? va.textOn(dark) : c.inkStrong);
    final labelColor = ink != null
        ? ink.withValues(alpha: 0.85)
        : (a != null ? a.textOn(dark).withValues(alpha: 0.8) : c.inkSoft);
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
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight:
                        hintTrend == null ? FontWeight.w400 : FontWeight.w700,
                    color: hintTrend == null
                        ? c.inkMuted
                        : (hintTrend! ? c.success : c.error))),
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
    final quizzesAsync = ref.watch(quizListProvider);
    final notesAsync = ref.watch(lessonsListProvider);
    // The results list is what the Results and Review screens are built from,
    // and it is the only place an attempt is described properly: it carries
    // the attemptId (an exact key — no matching on title text), the quiz's own
    // quizNumber, and the server's reviewedAt flag.
    final results = ref.watch(resultsListProvider).asData?.value ??
        const <ResultListItem>[];

    // These two lists arrive independently, and a quiz outranks a lesson in
    // the priority order below. Reading them with `orElse: []` treated "still
    // loading" as "there are none", so the moment the lessons list landed this
    // card committed to "Review lesson" — then the quiz list arrived, recQuiz
    // became non-null, and it visibly flipped to "Start quiz". Wait for both
    // to actually settle before recommending anything.
    final settled = (quizzesAsync.asData != null || quizzesAsync.hasError) &&
        (notesAsync.asData != null || notesAsync.hasError);
    final quizzes = quizzesAsync.asData?.value ?? const <QuizListItem>[];
    final notes = notesAsync.asData?.value ?? const <LessonListItem>[];

    final weak = (d != null && d.weakTopics.isNotEmpty) ? d.weakTopics.first : null;
    final recQuiz = _pickQuiz(quizzes, weak);
    // Rotate the lesson too, seeded by the day, so the card does not keep
    // handing out whichever note happens to sort first.
    // Only lessons that can actually be opened. `locked` means the plan does
    // not include it, and `canvasId` is empty for a note with neither a linked
    // lesson nor an id — pushing either produced a dead end.
    final openNotes = notes
        .where((n) => !n.locked && n.canvasId.trim().isNotEmpty)
        .toList();
    final recNote = openNotes.isEmpty
        ? null
        : (List.of(openNotes)..shuffle(math.Random(DateTime.now().day))).first;
    final lastAttempt =
        (d != null && d.recentAttempts.isNotEmpty) ? d.recentAttempts.first : null;
    // Finishing a quiz should send you to its answers before anything else,
    // ahead of the rotation. Once those answers have been opened this clears
    // and the normal Exam → Review → Lesson rotation resumes.
    /// "Course / Subject", the same way the Results list builds its subtitle
    /// (results_page.dart `_subtitle`): drop empties, and drop the subject
    /// when it merely repeats the course.
    String crumb(String course, String subject) {
      final parts = <String>[];
      if (course.trim().isNotEmpty) parts.add(course.trim());
      // "General" / "Full course" only says the quiz covers the whole course,
      // which the course name already does.
      final sub = subject.trim().toLowerCase();
      final whole = sub == 'general' || sub.contains('full course');
      if (subject.trim().isNotEmpty && subject.trim() != course.trim() && !whole) {
        parts.add(subject.trim());
      }
      return parts.join(' / ');
    }

    /// The attempt as the Results/Review screens know it, matched by id.
    ResultListItem? resultFor(RecentAttempt a) {
      for (final r in results) {
        if (r.attemptId == a.id) return r;
      }
      return null;
    }

    final lastResult = lastAttempt == null ? null : resultFor(lastAttempt);
    // Prefer the server's own reviewedAt; the on-device record still counts,
    // so the card moves on immediately after opening the answers instead of
    // waiting for the next refresh.
    final needsReview = lastAttempt != null &&
        !(lastResult?.reviewed ?? false) &&
        !ReviewedAttempts.contains(lastAttempt.id);

    /// Name the attempt exactly as the quiz itself is named.
    ///
    /// This used to match the attempt back to a quiz by title text. In number
    /// mode ("Quiz N") the titles are not distinct, so it matched whichever
    /// quiz shared the title and showed the wrong number — "Quiz 3" for an
    /// attempt on Quiz 2. The attempt now carries its own quizNumber from the
    /// server, so no guessing is involved.
    String attemptLabel(RecentAttempt a) {
      // Exactly what the Results and Review screens show for this attempt.
      final r = resultFor(a);
      if (r != null && r.displayName.trim().isNotEmpty) return r.displayName;
      // Then the dashboard's own number (needs the deployed backend), and
      // only then the raw title.
      if (a.displayName.isNotEmpty) return a.displayName;
      final raw = a.quizTitle.trim();
      return raw.isEmpty ? 'your last quiz' : raw;
    }

    // Exam → Review → Lesson, advancing each time the card is used, instead of
    // a fixed priority order. The old chain always picked the first available
    // option, so once there was no quiz left to sit it parked permanently on
    // "Review answers" and the lesson was never offered.
    final slots = <({
      String target,
      String label,
      IconData icon,
      String breadcrumb,
      String title
    })>[];

    if (recQuiz != null) {
      // Exam mode: a graded attempt is saved to the DB (practice only logs a
      // streak event), so completing it updates scores/results and weak topics.
      slots.add((
        target: '/app/quizzes/${recQuiz.id}?exam=1',
        label: 'Start quiz',
        icon: Icons.play_arrow_rounded,
        breadcrumb: crumb(recQuiz.courseTitle, recQuiz.subjectName),
        title: recQuiz.displayName,
      ));
    }
    int reviewSlot = -1;
    if (lastAttempt != null) {
      reviewSlot = slots.length;
      // Straight to the answers, not the score summary.
      slots.add((
        target: '/app/review/${lastAttempt.id}',
        label: 'Review answers',
        icon: Icons.rate_review_rounded,
        breadcrumb: crumb(lastResult?.courseTitle ?? lastAttempt.courseTitle,
            lastResult?.topicDisplay ?? lastAttempt.topicName),
        title: attemptLabel(lastAttempt),
      ));
    }
    if (recNote != null) {
      slots.add((
        // Mirrors how the Lessons list opens a lesson
        // (lessons_course_detail_page.dart) — by canvasId, not lessonId,
        // which is empty for topic-level notes and produced a blank route.
        target: '/app/study/lesson/${recNote.canvasId}',
        label: 'Review lesson',
        icon: Icons.menu_book_rounded,
        // Was showing the last *attempt's* course here, which belongs to a
        // different item entirely. Use the lesson's own course and subject.
        breadcrumb: crumb(recNote.courseTitle, recNote.subjectName),
        title: recNote.title,
      ));
    }

    final turn = ref.watch(continueTurnProvider);
    final ({
      String target,
      String label,
      IconData icon,
      String breadcrumb,
      String title
    }) pick;

    if (!settled) {
      // Undecided. Keep the card's chrome and offer a neutral action rather
      // than guessing and then changing it under the user.
      pick = (
        target: '/app/quizzes',
        label: 'Continue',
        icon: Icons.play_arrow_rounded,
        breadcrumb: '',
        title: '',
      );
    } else if (slots.isEmpty) {
      pick = (
        target: '/app/quizzes',
        label: 'Open quizzes',
        icon: Icons.play_arrow_rounded,
        breadcrumb: '',
        title: 'Start studying',
      );
    } else if (needsReview && reviewSlot >= 0) {
      // Priority override — answers before anything else.
      pick = slots[reviewSlot];
    } else {
      pick = slots[turn % slots.length];
    }

    final target = pick.target;
    final label = pick.label;
    final icon = pick.icon;
    final breadcrumb = pick.breadcrumb;
    final quizTitle = pick.title;

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
                    // One line: a long name shrinks to fit instead of wrapping.
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(quizTitle,
                          maxLines: 1,
                          softWrap: false,
                          style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                    ),
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
              onPressed: () {
                // Move to the next slot so the card walks the rotation rather
                // than re-offering what was just opened.
                if (settled && slots.isNotEmpty) {
                  ref.read(continueTurnProvider.notifier).advance();
                }
                context.push(target);
              }),
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
                  label: 'Lessons',
                  // Sweep once the card has finished arriving, in step with
                  // the bars beneath it (_FillBar._afterEntrance).
                  startDelay: const Duration(milliseconds: 750)),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${s.completedLessons} / ${countPlus(s.totalLessons)} lessons',
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
            for (final (i, course) in top.indexed)
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
                      child: _FillBar(
                        value:
                            (course.progressPercent / 100).clamp(0.0, 1.0),
                        color: c.primary,
                        // Cascade down the rows.
                        delay: Duration(milliseconds: 120 * i),
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

/// A progress bar that fills from empty *after* it is on screen.
///
/// A bare TweenAnimationBuilder begins the moment it is first built. For this
/// card that is while the dashboard route is still fading in — and, since the
/// dashboard data is now prefetched during the splash, often before the page
/// is visible at all. The fill was finishing off-screen and the bars simply
/// appeared already full. Holding the target at zero until after the first
/// frame plus the route transition makes it something the user actually sees.
class _FillBar extends StatefulWidget {
  final double value; // 0..1
  final Color color;
  final Duration delay;
  const _FillBar({
    required this.value,
    required this.color,
    this.delay = Duration.zero,
  });

  @override
  State<_FillBar> createState() => _FillBarState();
}

class _FillBarState extends State<_FillBar> {
  double _target = 0;
  Timer? _start;

  /// Wait for the card to finish arriving before filling.
  ///
  /// The dashboard enters as a staggered list (380ms per card, ~63ms apart),
  /// so this card is still sliding up and fading in until roughly 630ms. The
  /// fill used to begin at 220ms — underneath that entrance — so by the time
  /// the card had settled the bars were already full and the animation was
  /// never actually seen. Starting after the page has finished arriving is
  /// the whole point of the effect.
  static const Duration _afterEntrance = Duration(milliseconds: 750);

  @override
  void initState() {
    super.initState();
    _start = Timer(_afterEntrance + widget.delay, () {
      if (mounted) setState(() => _target = widget.value);
    });
  }

  @override
  void didUpdateWidget(covariant _FillBar old) {
    super.didUpdateWidget(old);
    // A refresh that changes the number should track it, but must not restart
    // the intro from zero.
    if (old.value != widget.value && _target != 0) {
      setState(() => _target = widget.value);
    }
  }

  @override
  void dispose() {
    _start?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: _target),
        duration: const Duration(milliseconds: 900),
        curve: AppCurves.easeOut,
        builder: (_, v, _) => LinearProgressIndicator(
          value: v,
          minHeight: 8,
          backgroundColor: c.surface2,
          valueColor: AlwaysStoppedAnimation(widget.color),
        ),
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
    // iPad: all six in one row (2026-11-17); phone: two rows of three.
    final perRow = MediaQuery.sizeOf(context).width >= 700 ? 6 : 3;
    return Column(
      children: [
        for (int r = 0; r < _items.length; r += perRow)
          Padding(
            padding: EdgeInsets.only(top: r == 0 ? 0 : 10),
            child: Row(
              children: [
                for (int i = r; i < r + perRow && i < _items.length; i++) ...[
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

/// Holds a lower card's place while its data loads, in the same glass card
/// and spinner the course progress card uses, so nothing jumps on arrival.
class _LowerCardPlaceholder extends StatelessWidget {
  final double height;
  const _LowerCardPlaceholder({required this.height});
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: SizedBox(
          height: height - 36,
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
    );
  }
}

class _StudyPlanCard extends ConsumerWidget {
  const _StudyPlanCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    // 10.29: today's route = the 4 goals of the day (lesson, exam, practice,
    // flashcards), ticked from today's bits on the phone — no request. The
    // suggestions come from the lists the phone already holds.
    final dash = ref.watch(studentDashboardProvider);
    if (dash.isLoading && !dash.hasValue) return const _LowerCardPlaceholder(height: 220);
    final d = dash.maybeWhen(data: (x) => x, orElse: () => null);
    final bits = d?.todayBits ?? 0;
    final quizzes = ref
        .watch(quizListProvider)
        .maybeWhen(data: (x) => x, orElse: () => const <QuizListItem>[]);
    final notes = ref
        .watch(lessonsListProvider)
        .maybeWhen(data: (x) => x, orElse: () => const <LessonListItem>[]);
    final weak = (d != null && d.weakTopics.isNotEmpty) ? d.weakTopics.first : null;
    final recQuiz = _pickQuiz(quizzes, weak);
    LessonListItem? recNote;
    for (final n in notes) {
      if (!n.locked && !n.lessonCompleted) {
        recNote = n;
        break;
      }
    }
    final quizDetail = recQuiz != null
        ? [recQuiz.courseTitle, recQuiz.subjectName].where((s) => s.isNotEmpty).join(' · ')
        : 'Any set you can finish today';

    final steps = [
      _PlanItem(
        label: 'Lesson',
        icon: Icons.menu_book_rounded,
        title: recNote?.title ?? 'Finish one lesson',
        detail: recNote != null
            ? [recNote.subjectName, recNote.topicName].where((s) => s.trim().isNotEmpty).join(' › ')
            : 'Read a lesson to the end and tap Done',
        done: bits & 1 != 0,
        route: recNote != null ? '/app/study/lesson/${recNote.canvasId}' : '/app/lessons',
      ),
      _PlanItem(
        label: 'Exam',
        icon: Icons.assignment_turned_in_rounded,
        title: recQuiz != null ? recQuiz.displayName : 'Sit one exam',
        detail: quizDetail,
        done: bits & 2 != 0,
        route: recQuiz != null ? '/app/quizzes/${recQuiz.id}?exam=1' : '/app/exams',
      ),
      _PlanItem(
        label: 'Practice',
        icon: Icons.play_arrow_rounded,
        title: recQuiz != null ? 'Practise ${recQuiz.displayName}' : 'Do one practice set',
        detail: quizDetail,
        done: bits & 4 != 0,
        route: recQuiz != null ? '/app/quizzes/${recQuiz.id}' : '/app/quizzes',
      ),
      _PlanItem(
        label: 'Flashcards',
        icon: Icons.style_rounded,
        title: 'Review your flashcards',
        detail: 'At least one card today',
        done: bits & 8 != 0,
        route: '/app/flashcards',
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
    // A finished step wears the same tick as a finished quiz or planner task:
    // a soft green disc with a green check, not a solid green one.
    const tickGreen = Color(0xFF16A34A);
    final badgeColor = done ? tickGreen.withValues(alpha: 0.16) : c.primary;

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
                  ? const Icon(Icons.check_rounded, size: 17, color: tickGreen)
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
  /// [fill]: the card sits beside Today's route (wide screens) and is as tall
  /// as it — the chart then grows to fill the card instead of leaving space.
  final bool fill;
  const _AnalyticsCard({this.fill = false});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    // 10.29: one bar per day the student studied (days with nothing done are
    // skipped), from the study days on the phone — no request.
    final daysAsync = ref.watch(studyDaysProvider);
    if (daysAsync.isLoading && !daysAsync.hasValue) return const _LowerCardPlaceholder(height: 180);
    final days = daysAsync.maybeWhen(data: (x) => x, orElse: () => const <StudyDay>[])
        .where((d) => d.bits != 0 || d.marksCount > 0)
        .toList();
    // Goals the server already has for today (another device, the website)
    // show on today's bar too.
    final serverBits = ref.watch(studentDashboardProvider).maybeWhen(data: (x) => x.todayBits, orElse: () => 0);
    if (serverBits != 0) {
      final t = StudyDays.today();
      final i = days.indexWhere((x) => x.day == t);
      if (i >= 0) {
        final x = days[i];
        days[i] = StudyDay(t, x.bits | serverBits, x.marksSum, x.marksCount);
      } else {
        days.add(StudyDay(t, serverBits, 0, 0));
      }
    }
    final chart = CustomPaint(
                painter: _StudyDayBarsPainter(
                  days: days,
                  today: StudyDays.today(),
                  grid: c.line,
                  label: c.inkSoft,
                  strong: c.inkStrong,
                  empty: c.inkMuted.withValues(alpha: 0.45),
                  dotOn: c.primary,
                  dotOff: c.line,
                  red: DashAccents.rose.color,
                  amber: DashAccents.amber.color,
                  green: DashAccents.green.color,
                ),
              );
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Readiness',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 10),
          if (days.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text('Finish a lesson, exam or practice to start your study bars.',
                  style: TextStyle(fontSize: 13, color: c.inkSoft)),
            )
          else if (fill)
            Expanded(
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 104),
                child: SizedBox(width: double.infinity, child: chart),
              ),
            )
          else
            SizedBox(height: 104, width: double.infinity, child: chart),
          if (days.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('Bar = day\'s average marks · dots = goals done',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11.5, color: c.inkSoft)),
          ],
        ],
      ),
    );
  }
}

/// Readiness bars (10.29): one bar per study day, height = that day's average
/// marks, coloured by the 50 and 75 lines; a day with no marks is a short grey
/// bar; four dots under each bar = the goals done that day.
class _StudyDayBarsPainter extends CustomPainter {
  final List<StudyDay> days;
  final String today;
  final Color grid, label, strong, empty, dotOn, dotOff, red, amber, green;
  _StudyDayBarsPainter({
    required this.days,
    required this.today,
    required this.grid,
    required this.label,
    required this.strong,
    required this.empty,
    required this.dotOn,
    required this.dotOff,
    required this.red,
    required this.amber,
    required this.green,
  });

  void _text(Canvas canvas, String s, Offset at, Color color, {double size = 10, bool center = false, FontWeight w = FontWeight.w600}) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: TextStyle(fontSize: size, color: color, fontWeight: w)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center ? at - Offset(tp.width / 2, 0) : at);
  }

  @override
  void paint(Canvas canvas, Size size) {
    const left = 22.0, labelH = 14.0, dotsH = 12.0;
    final chartH = size.height - labelH - dotsH - 4;
    // Room above a 100% bar so it doesn't touch the card's title.
    const headroom = 12.0;
    double yFor(num pct) => headroom + (chartH - headroom) * (1 - pct / 100);

    // 50 and 75 lines (dashed), with their numbers.
    for (final line in const [(75, true), (50, false)]) {
      final y = yFor(line.$1);
      final color = line.$2 ? green : amber;
      final paint = Paint()
        ..color = color.withValues(alpha: 0.8)
        ..strokeWidth = 1;
      for (var x = left; x < size.width; x += 7) {
        canvas.drawLine(Offset(x, y), Offset((x + 4).clamp(0, size.width), y), paint);
      }
      _text(canvas, '${line.$1}', Offset(0, y - 6), color, size: 9.5);
    }
    canvas.drawLine(Offset(left, chartH), Offset(size.width, chartH), Paint()..color = grid..strokeWidth = 1);

    final n = days.length;
    final slot = (size.width - left) / StudyDays.keep;
    final barW = (slot * 0.62).clamp(6.0, 22.0);
    // Bars start at the left and grow to the right, one per study day.
    final startX = left;
    for (var i = 0; i < n; i++) {
      final d = days[i];
      final cx = startX + slot * i + slot / 2;
      final avg = d.average;
      final Color color = avg == null ? empty : avg >= 75 ? green : avg >= 50 ? amber : red;
      final top = avg == null ? chartH - 4 : yFor(avg.clamp(2, 100));
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(cx - barW / 2, top, cx + barW / 2, chartH), const Radius.circular(4)),
        Paint()..color = color,
      );
      // Goal dots: lesson, exam, practice, flashcards.
      const bitsOrder = [1, 2, 4, 8];
      final dotR = (barW / 9).clamp(1.4, 2.4);
      final gap = dotR * 2.6;
      final dotsLeft = cx - gap * 1.5;
      for (var k = 0; k < 4; k++) {
        canvas.drawCircle(Offset(dotsLeft + gap * k, chartH + 7), dotR,
            Paint()..color = d.bits & bitsOrder[k] != 0 ? dotOn : dotOff);
      }
      final isToday = d.day == today;
      // Only today is named; the other bars carry no number.
      if (isToday) {
        _text(canvas, 'Today', Offset(cx, chartH + dotsH + 2), strong, size: 9.5, center: true);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _StudyDayBarsPainter old) =>
      old.days != days || old.today != today || old.dotOn != dotOn;
}

/// Question of the Day (OPTIMIZE 10.31): answered right here — the 5 options
/// and the right one are already on the phone, so a tap costs no request.
/// The question stays until it is answered; see [QuestionOfDayStore].
class _DailyQuestionCard extends ConsumerStatefulWidget {
  const _DailyQuestionCard();
  @override
  ConsumerState<_DailyQuestionCard> createState() => _DailyQuestionCardState();
}

class _DailyQuestionCardState extends ConsumerState<_DailyQuestionCard> {
  // Taps made on this screen, before the saved state catches up.
  final Set<int> _wrong = {};
  bool _gotIt = false;

  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFDC2626);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(questionOfDayProvider);
    if (async.isLoading && !async.hasValue) return const _LowerCardPlaceholder(height: 260);
    final st = async.maybeWhen(data: (d) => d, orElse: () => null);
    if (st == null) return const SizedBox.shrink();
    final q = st.question;
    final rightIndex = q.options.indexWhere((o) => o.isCorrect);
    // A wrong tap only marks that option; the right one is never shown until
    // the student finds it (2026-11-17).
    final wrong = {...st.wrong, ..._wrong};
    final gotIt = _gotIt || st.answered;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final crumb = [q.subjectName, q.courseTitle].where((s) => s.isNotEmpty).join(' · ');

    Widget option(int i) {
      final o = q.options[i];
      final isRight = gotIt && i == rightIndex;
      final isWrong = wrong.contains(i);
      Color border = c.line, bg = c.cardElevated, labelBg = c.surface2, labelFg = c.inkMedium;
      if (isRight) {
        border = _green;
        bg = _green.withValues(alpha: 0.09);
        labelBg = _green;
        labelFg = Colors.white;
      } else if (isWrong) {
        border = _red;
        bg = _red.withValues(alpha: 0.08);
        labelBg = _red;
        labelFg = Colors.white;
      }
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: InkWell(
          onTap: (gotIt || isWrong)
              ? null
              : () {
                  if (i == rightIndex) {
                    setState(() => _gotIt = true);
                    QuestionOfDayStore.answer(i);
                  } else {
                    setState(() => _wrong.add(i));
                    QuestionOfDayStore.wrong(i);
                  }
                },
          borderRadius: BorderRadius.circular(13),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: border, width: (isRight || isWrong) ? 1.6 : 1),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: labelBg, shape: BoxShape.circle),
                  child: Text(o.optionLabel.isNotEmpty ? o.optionLabel : String.fromCharCode(65 + i),
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: labelFg)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(o.optionText,
                      style: TextStyle(fontSize: 14.5, height: 1.35, color: c.inkStrong)),
                ),
                if (isRight) const Icon(Icons.check_rounded, size: 19, color: _green),
                if (isWrong) const Icon(Icons.close_rounded, size: 19, color: _red),
              ],
            ),
          ),
        ),
      );
    }

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
                  color: DashAccents.amber.textOn(dark))),
          const SizedBox(height: 8),
          Text(q.questionText,
              style: TextStyle(fontSize: 15, height: 1.35, fontWeight: FontWeight.w600, color: c.inkStrong)),
          if (crumb.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(crumb, style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
          ],
          const SizedBox(height: 4),
          for (var i = 0; i < q.options.length; i++) option(i),
          if (gotIt || wrong.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              gotIt ? 'Correct — a new question tomorrow.' : 'Not quite — try again.',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: gotIt ? _green : _red),
            ),
          ],
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
          // Flat tinted square + the flashcards icon, the same as the
          // Flashcards tile on the Study page (2026-11-17: the head icon on a
          // glowing gradient looked out of place).
          Builder(builder: (context) {
            final dark = Theme.of(context).brightness == Brightness.dark;
            return Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.inner),
                color: DashAccents.violet.tint(dark),
              ),
              child: Icon(Icons.style_outlined, size: 22, color: DashAccents.violet.textOn(dark)),
            );
          }),
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

