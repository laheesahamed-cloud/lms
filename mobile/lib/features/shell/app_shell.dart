import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';
import '../../widgets/brand_logo.dart';

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
    final width = MediaQuery.sizeOf(context).width;
    if (width >= Breakpoints.desktop) {
      return Scaffold(
        body: Row(
          children: [
            _SideBar(index: _index),
            Expanded(child: child),
          ],
        ),
      );
    }
    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomNav(index: _index),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int index;
  const _BottomNav({required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(
        color: c.surface1,
        border: Border(top: BorderSide(color: c.line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Row(
            children: List.generate(kDests.length, (i) {
              final d = kDests[i];
              final active = i == index;
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => context.go(d.route),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: AppDur.micro,
                        height: 3,
                        width: active ? 26 : 0,
                        margin: const EdgeInsets.only(bottom: 6),
                        decoration: BoxDecoration(
                          color: c.primary,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                      Icon(d.icon,
                          size: 23,
                          color: active ? c.primary : c.inkSoft),
                      const SizedBox(height: 3),
                      Text(d.label,
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: active ? c.primary : c.inkSoft)),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _SideBar extends StatelessWidget {
  final int index;
  const _SideBar({required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      width: 264,
      decoration: BoxDecoration(
        color: c.page,
        border: Border(right: BorderSide(color: c.line)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 18, 14, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(left: 6, bottom: 18),
                child: BrandWordmark(),
              ),
              ...List.generate(kDests.length, (i) {
                final d = kDests[i];
                final active = i == index;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => context.go(d.route),
                    child: AnimatedContainer(
                      duration: AppDur.micro,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 11),
                      decoration: BoxDecoration(
                        color: active ? c.primaryTint : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(d.icon,
                              size: 19,
                              color: active ? c.primary : c.inkSoft),
                          const SizedBox(width: 11),
                          Text(d.label,
                              style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: active ? c.primary : c.inkMedium)),
                        ],
                      ),
                    ),
                  ),
                );
              }),
              const Spacer(),
              Text('Medical Student',
                  style: TextStyle(fontSize: 12, color: c.inkMuted)),
            ],
          ),
        ),
      ),
    );
  }
}
