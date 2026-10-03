import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';
import '../../widgets/brand_logo.dart';
import '../../state/auth_controller.dart';
import '../notifications/notification_priming.dart';
import '../lessons/lessons_repository.dart';
import '../courses/courses_repository.dart';
import '../quizzes/quizzes_repository.dart';
import '../flashcards/flashcards_repository.dart';
import '../dashboard/dashboard_repository.dart';
import '../bookmarks/bookmarks_repository.dart';
import '../planner/planner_repository.dart';
import '../../widgets/shell_insets.dart';

/// Observes the root navigator so the shell can refresh its lists when a
/// pushed detail screen (lesson, quiz, course, review…) is popped back.
final appRouteObserver = RouteObserver<PageRoute<dynamic>>();

class NavDest {
  final String label;
  final IconData icon;
  final String route;
  const NavDest(this.label, this.icon, this.route);
}

const kDests = [
  NavDest('Courses', Icons.menu_book_outlined, '/app/courses'),
  NavDest('Q-Bank', Icons.fact_check_outlined, '/app/quizzes'),
  NavDest('Study Hub', Icons.grid_view_rounded, '/app/dashboard'),
  NavDest('Study', Icons.auto_stories_outlined, '/app/study'),
  NavDest('Results', Icons.bar_chart_rounded, '/app/results'),
];

// The side rail (iPad/desktop) is richer than the phone bottom nav: the Study
// Hub tools are broken out into their own items.
const _kSideMain = [
  NavDest('Study Hub', Icons.grid_view_rounded, '/app/dashboard'),
  NavDest('Courses', Icons.menu_book_outlined, '/app/courses'),
  NavDest('Q-Bank', Icons.fact_check_outlined, '/app/quizzes'),
  NavDest('Results', Icons.bar_chart_rounded, '/app/results'),
];
const _kSideStudy = [
  NavDest('Lessons', Icons.auto_stories_outlined, '/app/lessons'),
  NavDest('My Notes', Icons.edit_note_outlined, '/app/my-notes'),
  NavDest('Flashcards', Icons.style_outlined, '/app/flashcards'),
  NavDest('Drugs', Icons.medication_outlined, '/app/drugs'),
  NavDest('ECG', Icons.monitor_heart_outlined, '/app/ecg'),
  NavDest('Auscultation', Icons.headphones_rounded, '/app/auscultation'),
  NavDest('Planner', Icons.event_note_outlined, '/app/planner'),
  NavDest('Saved', Icons.bookmark_border_rounded, '/app/bookmarks'),
];

class AppShell extends ConsumerStatefulWidget {
  final Widget child;
  final String location;
  const AppShell({super.key, required this.child, required this.location});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> with RouteAware {
  /// Which bottom-nav tab owns [location].
  ///
  /// This used to be `kDests.indexWhere(startsWith)` with `i < 0 ? 2 : i`, and
  /// kDests only lists five routes. So every screen outside those five —
  /// Exams, Lessons, My Notes, Flashcards, Planner, ECG, Drugs, Saved,
  /// Profile, Subscriptions, and every review/result detail — fell through to
  /// the fallback and lit up **Study Hub**. Walking from Q-Bank into an exam
  /// made the highlight jump from Q-Bank to Study Hub and back, which is the
  /// "jumping between lesson and exam" behaviour.
  ///
  /// Sub-routes are grouped under the tab they were opened from, longest
  /// prefix first so `/app/my-flashcards` is not captured by `/app/flashcards`.
  static const List<(String, int)> _tabForPrefix = [
    // Q-Bank: the list, exams, and everything a quiz leads to.
    ('/app/quizzes', 1),
    ('/app/exams', 1),
    ('/app/qbank', 1),
    ('/app/review', 1),
    ('/app/exam-complete', 1),
    // Results
    ('/app/results', 4),
    // Courses
    ('/app/courses', 0),
    // Study: the hub and every tool reached from it.
    ('/app/study', 3),
    ('/app/lessons', 3),
    ('/app/my-notes', 3),
    ('/app/my-flashcards', 3),
    ('/app/flashcards', 3),
    ('/app/drugs', 3),
    ('/app/ecg', 3),
    ('/app/auscultation', 3),
    ('/app/planner', 3),
    ('/app/bookmarks', 3),
    ('/app/canvas', 3),
    // Study Hub itself, plus account screens that have no tab of their own.
    ('/app/dashboard', 2),
  ];

  int get _index {
    final location = widget.location;
    for (final (prefix, tab) in _tabForPrefix) {
      if (location == prefix || location.startsWith('$prefix/')) return tab;
    }
    return 2;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) appRouteObserver.subscribe(this, route);
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    super.dispose();
  }

  /// A pushed detail screen was just popped back to the shell — refetch the
  /// content lists so edits made inside (a new note page, a completed lesson,
  /// a finished quiz, updated progress…) show immediately instead of staying
  /// stale until the next app launch. Invalidate only refetches the list the
  /// user is actually looking at; the rest are marked stale cheaply.
  @override
  void didPopNext() {
    // Only refresh the list actually on screen. Invalidating all of them (as
    // this used to) marked every other page stale too, so each one refetched
    // on its next visit — which is why every navigation hit a spinner once
    // these providers stopped being autoDispose. The rest keep their cache
    // and stay instant.
    final location = widget.location;
    if (location.startsWith('/app/dashboard')) {
      ref.invalidate(studentDashboardProvider);
    } else if (location.startsWith('/app/lessons')) {
      ref.invalidate(lessonsListProvider);
    } else if (location.startsWith('/app/courses')) {
      ref.invalidate(studentCoursesProvider);
    } else if (location.startsWith('/app/quizzes') ||
        location.startsWith('/app/exams')) {
      ref.invalidate(quizListProvider);
    } else if (location.startsWith('/app/results')) {
      ref.invalidate(resultsListProvider);
    } else if (location.startsWith('/app/flashcards')) {
      ref.invalidate(flashDecksProvider);
    } else if (location.startsWith('/app/planner')) {
      ref.invalidate(plannerTasksProvider);
    } else if (location.startsWith('/app/bookmarks')) {
      ref.invalidate(bookmarksProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.child;
    final location = widget.location;
    // Gate the shell so the notification priming sheet appears once after login.
    final gatedChild = NotificationPrimingGate(child: child);
    final width = MediaQuery.sizeOf(context).width;
    if (width >= Breakpoints.desktop) {
      return Scaffold(
        body: Row(
          children: [
            _SideBar(location: location),
            Expanded(child: gatedChild),
          ],
        ),
      );
    }
    return Scaffold(
      // EXPERIMENTAL (frosted tab bar): the body paints behind the bar so the
      // blur has something to work on. Pages add shellNavInset() to their
      // scroll padding so the last item still clears the glass.
      extendBody: true,
      body: gatedChild,
      bottomNavigationBar: _BottomNav(index: _index),
    );
  }
}


/// How far above the pill the blur begins to come in.
const double _kBlurRunUp = 46;

/// Floating, curved tab bar (detached pill) — mirrors the LMS student nav:
/// rounded surface + soft shadow, active tab in a tinted pill that shows its
/// label; the rest stay icon-only so 5 items never crowd.
///
/// EXPERIMENTAL: the pill is frosted glass over a blur that ramps in from
/// nothing [_kBlurRunUp] above it to full strength at the screen's edge, so
/// content dissolves into the bar rather than meeting a hard line.
class _BottomNav extends StatelessWidget {
  final int index;
  const _BottomNav({required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final safe = MediaQuery.viewPaddingOf(context).bottom;

    return SizedBox(
      height: kShellPillHeight + kShellPillMargin + safe + _kBlurRunUp,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const _ProgressiveBlur(),
          // The page's own colour, fading in downward. Blur alone leaves bright
          // content showing straight through; this settles it into the bar.
          IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    c.page.withValues(alpha: 0.0),
                    c.page.withValues(alpha: 0.48),
                    c.page.withValues(alpha: 0.90),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: kShellPillMargin + safe,
            height: kShellPillHeight,
            child: _pill(c, dark),
          ),
        ],
      ),
    );
  }

  Widget _pill(AppColors c, bool dark) {
    // The shadow has to sit OUTSIDE the clip, or it is cut away with everything
    // else beyond the rounded rect. Without it the bar has no edge of its own
    // in light mode — a white pill, over a white scrim, over a white page.
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          // The rim, on the TOP half only. A shadow cannot be drawn to an arc,
          // but offsetting it up by more than it spreads puts it entirely above
          // the pill's bottom edge: strongest across the top, thinning down the
          // sides, gone before it reaches the foot — so you can see where it
          // starts and ends instead of a uniform ring.
          if (!dark)
            const BoxShadow(
              color: Color(0x080B1220),
              blurRadius: 3,
              spreadRadius: 0.5,
              offset: Offset(0, -1.5),
            ),
          BoxShadow(
            color: dark ? const Color(0x80000000) : const Color(0x240B1220),
            blurRadius: 28,
            spreadRadius: -6,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
      borderRadius: BorderRadius.circular(26),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 34, sigmaY: 34),
        child: DecoratedBox(
          decoration: BoxDecoration(
            // Translucent, so the blur behind it reads as glass rather than
            // being hidden under an opaque fill.
            color: c.card.withValues(alpha: 0.62),
            borderRadius: BorderRadius.circular(26),
            // A white hairline reads as light catching the rim on a dark
            // ground and as nothing at all on a light one, where the shadow
            // draws that edge instead.
            border: dark
                ? Border.all(color: Colors.white.withValues(alpha: 0.10))
                : null,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            // LayoutBuilder (not Expanded/flex) so each tab's width is a real
            // animatable number — flex changes on Expanded snap instantly with
            // no way to tween them, which is what made switching tabs feel
            // like a jump cut instead of a slide.
            child: LayoutBuilder(
              builder: (context, constraints) {
                const activeShare = 5;
                const inactiveShare = 2;
                final totalShare =
                    activeShare + inactiveShare * (kDests.length - 1);
                final unit = constraints.maxWidth / totalShare;

                return Row(
                  children: [
                    for (var i = 0; i < kDests.length; i++)
                      _NavItem(
                        dest: kDests[i],
                        active: i == index,
                        width:
                            unit * (i == index ? activeShare : inactiveShare),
                      ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
      ),
    );
  }
}

/// A blur that ramps in down the screen instead of switching on at an edge.
///
/// One BackdropFilter cannot vary its sigma across its own area, so this stacks
/// several — each stronger than the last, and each masked by a gradient so it
/// fades in over its own band. The bands overlap, so what you see is a smooth
/// ramp rather than the steps it is built from.
class _ProgressiveBlur extends StatelessWidget {
  const _ProgressiveBlur();

  // 7, not 6: the step between layers is maxSigma/layers, so raising the
  // sigma without raising the count is what makes the bands show.
  static const _layers = 7;
  static const _maxSigma = 32.0;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ClipRect(
        child: Stack(
          fit: StackFit.expand,
          children: [
            for (var i = 0; i < _layers; i++)
              ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (rect) => LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: const [Colors.transparent, Colors.black],
                  // Each band starts where the one before it was already
                  // fully in, so the layers pile up toward the bottom.
                  stops: [i / _layers, (i + 1) / _layers],
                ).createShader(rect),
                child: BackdropFilter(
                  filter: ImageFilter.blur(
                    sigmaX: _maxSigma * (i + 1) / _layers,
                    sigmaY: _maxSigma * (i + 1) / _layers,
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final NavDest dest;
  final bool active;
  final double width;
  const _NavItem({required this.dest, required this.active, required this.width});

  // Slow enough to read as a slide rather than a jump, still snappy enough
  // not to lag behind a tap.
  static const _navDur = Duration(milliseconds: 680);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () { HapticFeedback.selectionClick(); context.go(dest.route); },
      child: AnimatedContainer(
        duration: _navDur,
        curve: AppCurves.easeOut,
        width: width,
        alignment: Alignment.center,
        child: AnimatedContainer(
          duration: _navDur,
          curve: AppCurves.easeOut,
          padding: EdgeInsets.symmetric(horizontal: active ? 14 : 0, vertical: 9),
          decoration: BoxDecoration(
            color: active ? c.primaryTint : Colors.transparent,
            borderRadius: BorderRadius.circular(99),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(dest.icon,
                  size: 22, color: active ? c.primary : c.inkSoft),
              if (active) ...[
                const SizedBox(width: 7),
                Flexible(
                  child: Text(dest.label,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: c.primary)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SideBar extends ConsumerWidget {
  final String location;
  const _SideBar({required this.location});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final user = ref.watch(authControllerProvider).user;
    // Floating, curved side rail — a detached rounded card on the page gutter
    // (mirrors the LMS student desktop sidebar), not an edge-to-edge bar.
    return Container(
      width: 256,
      color: c.page,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 6, 14),
          child: Container(
            decoration: BoxDecoration(
              color: c.card,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: dark ? const Color(0x80000000) : const Color(0x1A0B1220),
                  blurRadius: 28,
                  spreadRadius: -8,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 18, 12, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(left: 6, bottom: 18),
                    child: Row(
                      children: [
                        const BrandLogo(size: 44),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('xyndrome',
                                style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                    color: c.inkStrong)),
                            Text('Student Portal',
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: c.inkSoft)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final d in _kSideMain) _item(context, c, d),
                          const SizedBox(height: 16),
                          _label(c, 'STUDY'),
                          const SizedBox(height: 6),
                          for (final d in _kSideStudy) _item(context, c, d),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _SideBarFooter(user: user, c: c),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(AppColors c, String text) => Padding(
        padding: const EdgeInsets.only(left: 12, bottom: 2),
        child: Text(text,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: c.inkMuted)),
      );

  Widget _item(BuildContext context, AppColors c, NavDest d) {
    final active = location.startsWith(d.route);
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.go(d.route),
        child: AnimatedContainer(
          duration: AppDur.micro,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: active ? c.primaryTint : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(d.icon, size: 19, color: active ? c.primary : c.inkSoft),
              const SizedBox(width: 11),
              Text(d.label,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: active ? c.primary : c.inkMedium)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SideBarFooter extends StatelessWidget {
  final dynamic user; // AppUser?
  final AppColors c;
  const _SideBarFooter({required this.user, required this.c});

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
  }

  @override
  Widget build(BuildContext context) {
    final name = (user?.fullName as String?)?.trim().isNotEmpty == true
        ? user!.fullName as String
        : 'Student';
    final initials = _initials(name);
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.primaryTint,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Text(initials,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: c.primary)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: c.inkStrong)),
                Text('Medical Student',
                    style: TextStyle(fontSize: 11, color: c.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
