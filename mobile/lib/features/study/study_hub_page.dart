import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

/// Study hub — a calm launcher for the three core study tools.
class StudyHubPage extends StatelessWidget {
  const StudyHubPage({super.key});

  static const _tools = <_ToolEntry>[
    _ToolEntry(
      icon: Icons.menu_book_outlined,
      title: 'AI Notes & Lessons',
      subtitle: 'Concise summaries across every system',
      route: '/app/ai-notes',
      drillIn: false,
    ),
    _ToolEntry(
      icon: Icons.style_outlined,
      title: 'Flashcards',
      subtitle: 'Spaced repetition for high-yield recall',
      route: '/app/flashcards',
      drillIn: false,
    ),
    _ToolEntry(
      icon: Icons.event_note_outlined,
      title: 'Planner',
      subtitle: 'Map your rotations and exam countdown',
      route: '/app/planner',
      drillIn: true,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text(
            'TOOLS',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent,
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            'Study',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: c.inkStrong,
            ),
          ),
          const SizedBox(height: AppSpace.x5),
          AnimationLimiter(
            child: Column(
              children: AnimationConfiguration.toStaggeredList(
                duration: const Duration(milliseconds: 375),
                childAnimationBuilder: (w) => SlideAnimation(
                  verticalOffset: 22,
                  child: FadeInAnimation(child: w),
                ),
                children: [
                  for (final tool in _tools) ...[
                    _ToolTile(
                      entry: tool,
                      onTap: () => tool.drillIn
                          ? context.push(tool.route)
                          : context.go(tool.route),
                    ),
                    const SizedBox(height: AppSpace.x3),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolEntry {
  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
  final bool drillIn;

  const _ToolEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
    required this.drillIn,
  });
}

class _ToolTile extends StatelessWidget {
  final _ToolEntry entry;
  final VoidCallback onTap;

  const _ToolTile({required this.entry, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.inner),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  c.accent.withValues(alpha: 0.22),
                  c.primary.withValues(alpha: 0.14),
                ],
              ),
            ),
            child: Icon(entry.icon, size: 24, color: c.primary),
          ),
          const SizedBox(width: AppSpace.x4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  entry.title,
                  style: TextStyle(
                    fontSize: 16.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: c.inkStrong,
                  ),
                ),
                const SizedBox(height: AppSpace.x1),
                Text(
                  entry.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.3,
                    color: c.inkSoft,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpace.x3),
          Icon(Icons.chevron_right_rounded, size: 22, color: c.inkMuted),
        ],
      ),
    );
  }
}
