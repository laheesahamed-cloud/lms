import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../drugs/drug_queue_service.dart';

/// Study hub — launcher for all core study tools.
class StudyHubPage extends ConsumerWidget {
  const StudyHubPage({super.key});

  static const _tools = <_ToolEntry>[
    _ToolEntry(
      icon: Icons.menu_book_outlined,
      title: 'Lessons',
      subtitle: 'Browse by course, subject, then lesson',
      route: '/app/lessons',
    ),
    _ToolEntry(
      icon: Icons.style_outlined,
      title: 'Flashcards',
      subtitle: 'Spaced repetition for high-yield recall',
      route: '/app/flashcards',
    ),
    _ToolEntry(
      icon: Icons.monitor_heart_outlined,
      title: 'ECG',
      subtitle: 'Read ECGs topic by topic, then quiz yourself',
      route: '/app/ecg',
    ),
    _ToolEntry(
      icon: Icons.headphones_rounded,
      title: 'Auscultation',
      subtitle: 'Heart & lung sounds, then quiz yourself',
      route: '/app/auscultation',
    ),
    _ToolEntry(
      icon: Icons.event_note_outlined,
      title: 'Planner',
      subtitle: 'Map your rotations and exam countdown',
      route: '/app/planner',
    ),
    _ToolEntry(
      icon: Icons.bookmark_border_rounded,
      title: 'Saved',
      subtitle: 'Your bookmarked quizzes, notes and questions',
      route: '/app/bookmarks',
    ),
    _ToolEntry(
      icon: Icons.edit_note_rounded,
      title: 'My Notes',
      subtitle: 'Your own canvas notebooks — write anything',
      route: '/app/my-notes',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final drugState = ref.watch(drugQueueProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text(
            'TOOLS',
            style: TextStyle(
              fontSize: 12,
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
                  // Drug Randomizer — featured card with live spin stats
                  _DrugRandomizerTile(state: drugState),
                  const SizedBox(height: AppSpace.x3),

                  for (final tool in _tools) ...[
                    _ToolTile(
                      entry: tool,
                      onTap: () => context.go(tool.route),
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

// ── Drug Randomizer featured tile ──────────────────────────────────────────

class _DrugRandomizerTile extends StatelessWidget {
  final DrugQueueState state;
  const _DrugRandomizerTile({required this.state});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final spinsUsed  = state.useCount.clamp(0, state.freeLimit);
    final freeLimit  = state.freeLimit;
    final hasSub     = state.hasSub;
    final progress   = hasSub ? 1.0 : (spinsUsed / freeLimit).clamp(0.0, 1.0);

    return GlassCard(
      onTap: () => context.go('/app/drugs'),
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Icon container — same gradient as other tiles but teal/purple accent
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
                child: Icon(Icons.medication_outlined, size: 24, color: c.primary),
              ),
              const SizedBox(width: AppSpace.x4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Drugs',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: c.inkStrong,
                      ),
                    ),
                    const SizedBox(height: AppSpace.x1),
                    Text(
                      'Spin a random drug, answer a quick MCQ',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 14, height: 1.3, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpace.x3),
              Icon(Icons.chevron_right_rounded, size: 22, color: c.inkMuted),
            ],
          ),

          // Stats row
          const SizedBox(height: AppSpace.x4),
          Row(
            children: [
              // Spins stat
              _StatChip(
                label: hasSub ? 'Unlimited' : '$spinsUsed / $freeLimit spins',
                icon: Icons.shuffle_rounded,
                c: c,
              ),
              const SizedBox(width: AppSpace.x2),
              // Queue ready stat
              _StatChip(
                label: state.ready ? 'Ready' : 'Loading…',
                icon: state.ready
                    ? Icons.check_circle_outline_rounded
                    : Icons.hourglass_empty_rounded,
                c: c,
              ),
              if (!hasSub) ...[
                const Spacer(),
                // Mini progress bar
                SizedBox(
                  width: 56,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 5,
                          backgroundColor: c.inkMuted.withValues(alpha: 0.15),
                          valueColor: AlwaysStoppedAnimation(
                            progress >= 1 ? Colors.orange : c.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final AppColors c;
  const _StatChip({required this.label, required this.icon, required this.c});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: c.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: c.primary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: c.primary,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Standard tool tile ──────────────────────────────────────────────────────

class _ToolEntry {
  final IconData icon;
  final String title;
  final String subtitle;
  final String route;

  const _ToolEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
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
                    fontSize: 17,
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
                    fontSize: 14,
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
