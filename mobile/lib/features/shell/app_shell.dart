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
      body: gatedChild,
      bottomNavigationBar: _BottomNav(index: _index),
    );
  }
}

/// Floating, curved tab bar (detached pill) — mirrors the LMS student nav:
/// rounded surface + soft shadow, active tab in a tinted pill that shows its
/// label; the rest stay icon-only so 5 items never crowd.
class _BottomNav extends StatelessWidget {
  final int index;
  const _BottomNav({required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: Container(
          height: 64,
          padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            color: c.card,
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: dark ? const Color(0x80000000) : const Color(0x1F0B1220),
                blurRadius: 28,
                spreadRadius: -6,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Row(
            children: [
              for (var i = 0; i < kDests.length; i++)
                _NavItem(dest: kDests[i], active: i == index),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final NavDest dest;
  final bool active;
  const _NavItem({required this.dest, required this.active});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      flex: active ? 5 : 2,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () { HapticFeedback.selectionClick(); context.go(dest.route); },
        child: Center(
          child: AnimatedContainer(
            duration: AppDur.hover,
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
