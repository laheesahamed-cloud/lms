import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';
import '../../widgets/brand_logo.dart';
import '../../state/auth_controller.dart';
import '../notifications/notification_priming.dart';

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
  NavDest('Lessons', Icons.auto_stories_outlined, '/app/ai-notes'),
  NavDest('Flashcards', Icons.style_outlined, '/app/flashcards'),
  NavDest('Drugs', Icons.medication_outlined, '/app/drugs'),
  NavDest('ECG', Icons.monitor_heart_outlined, '/app/ecg'),
  NavDest('Auscultation', Icons.headphones_rounded, '/app/auscultation'),
  NavDest('Planner', Icons.event_note_outlined, '/app/planner'),
  NavDest('Saved', Icons.bookmark_border_rounded, '/app/bookmarks'),
];

class AppShell extends StatelessWidget {
  final Widget child;
  final String location;
  const AppShell({super.key, required this.child, required this.location});

  int get _index {
    final i = kDests.indexWhere((d) => location.startsWith(d.route));
    return i < 0 ? 2 : i;
  }

  @override
  Widget build(BuildContext context) {
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
        onTap: () => context.go(dest.route),
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
