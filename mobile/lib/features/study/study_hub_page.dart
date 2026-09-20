import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../drugs/drug_queue_service.dart';

/// Study hub — launcher for all core study tools.
///
/// Layout: Drugs and My Notes are the two featured tools (Drugs already has
/// live stats; My Notes is where students create their own content) — each
/// gets its own full-width row, same size. The remaining six tools sit below
/// in a 2-column grid, one DashAccents color per tool (the same curated
/// palette the dashboard uses) so they read apart at a glance instead of
/// repeating one blue icon chip six times.
class StudyHubPage extends ConsumerWidget {
  const StudyHubPage({super.key});

  static const _tools = <_ToolEntry>[
    _ToolEntry(
      icon: Icons.menu_book_outlined,
      title: 'Lessons',
      subtitle: 'Browse by course, subject, then lesson',
      route: '/app/lessons',
      accent: DashAccents.cyan,
    ),
    _ToolEntry(
      icon: Icons.style_outlined,
      title: 'Flashcards',
      subtitle: 'Spaced repetition for high-yield recall',
      route: '/app/flashcards',
      accent: DashAccents.violet,
    ),
    _ToolEntry(
      icon: Icons.monitor_heart_outlined,
      title: 'ECG',
      subtitle: 'Read ECGs topic by topic, then quiz yourself',
      route: '/app/ecg',
      accent: DashAccents.rose,
    ),
    _ToolEntry(
      icon: Icons.headphones_rounded,
      svgAsset: 'assets/medical/stethoscope.svg',
      title: 'Auscultation',
      subtitle: 'Heart & lung sounds, then quiz yourself',
      route: '/app/auscultation',
      accent: DashAccents.green,
    ),
    _ToolEntry(
      icon: Icons.event_note_outlined,
      title: 'Planner',
      subtitle: 'Map your rotations and exam countdown',
      route: '/app/planner',
      accent: DashAccents.amber,
    ),
    _ToolEntry(
      icon: Icons.bookmark_border_rounded,
      title: 'Saved',
      subtitle: 'Your bookmarked quizzes, notes and questions',
      route: '/app/bookmarks',
      accent: DashAccents.blue,
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
                  // Featured — Drugs (live spin stats) and My Notes (create
                  // your own), each its own full-width row, matching size.
                  // push() (not go) so the tool lands on top of the Study hub,
                  // enabling the iOS swipe-back gesture + back chevron.
                  _DrugRandomizerTile(state: drugState),
                  const SizedBox(height: AppSpace.x3),
                  const _MyNotesTile(),
                  const SizedBox(height: AppSpace.x5),

                  SizedBox(
                    width: double.infinity,
                    child: Text(
                      'EXPLORE',
                      textAlign: TextAlign.left,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: c.inkSoft,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpace.x3),
                  _ToolsGrid(tools: _tools),
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
      onTap: () => context.push('/app/drugs'),
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
                      'Random drug, quick MCQ',
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

// ── My Notes featured tile — same shape/size as Drugs above ────────────────

class _MyNotesTile extends StatelessWidget {
  const _MyNotesTile();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    const gold = DashAccents.gold;

    return GlassCard(
      onTap: () => context.push('/app/my-notes'),
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                      gold.color.withValues(alpha: 0.24),
                      gold.grad.last.withValues(alpha: 0.16),
                    ],
                  ),
                ),
                child: Icon(Icons.edit_note_rounded, size: 24, color: gold.textOn(dark)),
              ),
              const SizedBox(width: AppSpace.x4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'My Notebook',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: c.inkStrong,
                      ),
                    ),
                    const SizedBox(height: AppSpace.x1),
                    Text(
                      'Write anything, your way',
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

          // Second row — matches the Drugs stats row in height/weight so the
          // two featured cards land at the same size, without inventing a
          // notebook count we don't actually track.
          const SizedBox(height: AppSpace.x4),
          Row(
            children: [
              _StatChip(
                label: 'New note',
                icon: Icons.add_rounded,
                c: c,
                color: gold.color,
              ),
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
  final Color? color;
  const _StatChip({required this.label, required this.icon, required this.c, this.color});

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? c.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: chipColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: chipColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: chipColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Remaining tools — 2-column grid, one DashAccents color each ────────────

class _ToolEntry {
  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
  final SectionAccent accent;
  // Overrides `icon` when set — for glyphs Material's bundled icon font
  // doesn't have (e.g. a stethoscope), rendered via flutter_svg and tinted
  // the same way as the Material icons.
  final String? svgAsset;

  const _ToolEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
    required this.accent,
    this.svgAsset,
  });
}

class _ToolsGrid extends StatelessWidget {
  final List<_ToolEntry> tools;
  const _ToolsGrid({required this.tools});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < tools.length; i += 2) {
      final a = tools[i];
      final b = i + 1 < tools.length ? tools[i + 1] : null;
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _ToolGridTile(entry: a, onTap: () => context.push(a.route)),
              ),
              const SizedBox(width: AppSpace.x3),
              Expanded(
                child: b != null
                    ? _ToolGridTile(entry: b, onTap: () => context.push(b.route))
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      );
      if (i + 2 < tools.length) rows.add(const SizedBox(height: AppSpace.x3));
    }
    return Column(children: rows);
  }
}

class _ToolGridTile extends StatelessWidget {
  final _ToolEntry entry;
  final VoidCallback onTap;
  const _ToolGridTile({required this.entry, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = entry.accent;

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpace.x3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.inner),
              color: accent.tint(dark),
            ),
            child: entry.svgAsset != null
                ? SvgPicture.asset(
                    entry.svgAsset!,
                    // The source SVG has more built-in padding than the
                    // Material glyphs (content fills ~75% of its box vs
                    // ~85% for the outlined icons) — sized up slightly so
                    // it reads as the same visual size, not smaller.
                    width: 22,
                    height: 22,
                    colorFilter: ColorFilter.mode(accent.textOn(dark), BlendMode.srcIn),
                  )
                : Icon(entry.icon, size: 20, color: accent.textOn(dark)),
          ),
          const SizedBox(height: AppSpace.x3),
          Text(
            entry.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
              color: c.inkStrong,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            entry.subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, height: 1.3, color: c.inkSoft),
          ),
        ],
      ),
    );
  }
}
