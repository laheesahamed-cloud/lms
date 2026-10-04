import 'dart:math' show Random;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/glass_card.dart';
import 'ecg_repository.dart';
import '../../widgets/page_header.dart';
import '../../widgets/shell_insets.dart';

/// Which of the two learning tiles a topic belongs to.
///
/// Split on the TITLE, not the category field: the admin types that field free
/// hand and the app has never read it, so the titles are the only thing we can
/// rely on today. A topic whose title starts with "basic" — in any case — is a
/// basics topic; everything else is a rhythm.
enum EcgGroup { basics, rhythms }

extension EcgGroupX on EcgGroup {
  String get slug => this == EcgGroup.basics ? 'basics' : 'rhythms';
  String get title =>
      this == EcgGroup.basics ? 'Basics of ECG' : 'Rhythm Library';

  static EcgGroup fromSlug(String? slug) =>
      slug == 'basics' ? EcgGroup.basics : EcgGroup.rhythms;

  bool matches(EcgTopic t) {
    final isBasics = t.title.trimLeft().toLowerCase().startsWith('basic');
    return this == EcgGroup.basics ? isBasics : !isBasics;
  }
}

/// ECG landing — four ways in, over a card that opens something at random.
class EcgPage extends ConsumerStatefulWidget {
  const EcgPage({super.key});
  @override
  ConsumerState<EcgPage> createState() => _EcgPageState();
}

class _EcgPageState extends ConsumerState<EcgPage> {
  /// Fixed for as long as the page is open, so the card does not pick a
  /// different topic every time something above it rebuilds — but a new one
  /// each time you come back to it.
  final int _seed = Random().nextInt(1 << 30);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final topicsAsync = ref.watch(ecgTopicsProvider);
    final topics = topicsAsync.asData?.value ?? const <EcgTopic>[];
    final pick = topics.isEmpty ? null : topics[_seed % topics.length];

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () async => ref.refresh(ecgTopicsProvider.future),
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, 14, 16, 28 + shellNavInset(context)),
          children: [
            const PageHeader(title: 'ECG'),
            const SizedBox(height: 12),
            if (topicsAsync.hasError)
              _ErrorBox(c: c, onRetry: () => ref.refresh(ecgTopicsProvider))
            else ...[
              if (pick != null) ...[
                _ExploreHero(
                  topic: pick,
                  onTap: () => context.push('/app/ecg/topic/${pick.id}'),
                ),
                const SizedBox(height: AppSpace.x3),
              ],
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _HubTile(
                        icon: Icons.school_outlined,
                        title: 'Basics of ECG',
                        subtitle: 'Leads, axis and reading a strip',
                        accent: DashAccents.blue,
                        onTap: () => context.push('/app/ecg/topics/basics'),
                      ),
                    ),
                    const SizedBox(width: AppSpace.x3),
                    Expanded(
                      child: _HubTile(
                        icon: Icons.favorite_outline_rounded,
                        title: 'Rhythm Library',
                        subtitle: 'Common and complex arrhythmias',
                        accent: DashAccents.rose,
                        onTap: () => context.push('/app/ecg/topics/rhythms'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpace.x3),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _HubTile(
                        icon: Icons.monitor_heart_outlined,
                        title: 'Practice Cases',
                        subtitle: 'Real ECGs with full explanations',
                        accent: DashAccents.green,
                        onTap: () => context.push('/app/ecg/quiz'),
                      ),
                    ),
                    const SizedBox(width: AppSpace.x3),
                    Expanded(
                      child: _HubTile(
                        icon: Icons.psychology_outlined,
                        title: 'Quick Quiz',
                        subtitle: 'Test your knowledge in minutes',
                        accent: DashAccents.violet,
                        onTap: () => context.push('/app/quizzes'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The full-width card over the grid. Nothing tracks ECG progress, so rather
/// than pretend to know where you left off it offers a topic at random — and
/// says so.
class _ExploreHero extends StatelessWidget {
  final EcgTopic topic;
  final VoidCallback onTap;
  const _ExploreHero({required this.topic, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'SOMETHING TO LOOK AT',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.3,
                    color: c.primary,
                  ),
                ),
              ),
              if (topic.cardCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: c.surface2,
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: c.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.monitor_heart_outlined,
                        size: 13,
                        color: c.inkSoft,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${topic.cardCount} ECG${topic.cardCount == 1 ? '' : 's'}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: c.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            topic.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 22,
              height: 1.15,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: c.inkStrong,
            ),
          ),
          if (topic.description.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              topic.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, height: 1.35, color: c.inkSoft),
            ),
          ],
          const SizedBox(height: AppSpace.x4),
          AppButton(
            'Explore',
            kind: AppButtonKind.cta,
            onPressed: onTap,
            leading: const Icon(
              Icons.auto_awesome_rounded,
              size: 17,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// The topic list, filtered to one of the two groups. Same tiles the page used
/// to show in one long run.
class EcgTopicsPage extends ConsumerWidget {
  final EcgGroup group;
  const EcgTopicsPage({super.key, required this.group});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final topicsAsync = ref.watch(ecgTopicsProvider);

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () async => ref.refresh(ecgTopicsProvider.future),
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, 14, 16, 28 + shellNavInset(context)),
          children: [
            PageHeader(title: group.title),
            const SizedBox(height: 10),
            topicsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _ErrorBox(
                c: c,
                onRetry: () => ref.refresh(ecgTopicsProvider),
              ),
              data: (all) {
                final topics = all.where(group.matches).toList();
                if (topics.isEmpty) {
                  return _EmptyBox(
                    c: c,
                    text: group == EcgGroup.basics
                        ? 'No basics topics yet. A topic goes here when its title starts with "Basics".'
                        : 'No rhythm topics yet. Check back soon.',
                  );
                }
                return AnimationLimiter(
                  child: Column(
                    children: AnimationConfiguration.toStaggeredList(
                      duration: const Duration(milliseconds: 375),
                      childAnimationBuilder: (w) => SlideAnimation(
                        verticalOffset: 22,
                        child: FadeInAnimation(child: w),
                      ),
                      children: [
                        for (var i = 0; i < topics.length; i++)
                          Padding(
                            padding: const EdgeInsets.only(bottom: AppSpace.x3),
                            child: _TopicTile(
                              index: i,
                              topic: topics[i],
                              c: c,
                              onTap: () => context.push(
                                '/app/ecg/topic/${topics[i].id}',
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// One of the four ways in — the Study hub's own grid tile, to the point: the
/// same x3 padding, 40pt icon chip, 14.5 title and 11.5 subtitle, so the two
/// screens' cards are the same object.
class _HubTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final SectionAccent accent;
  final VoidCallback onTap;
  const _HubTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
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
            child: Icon(icon, size: 20, color: accent.textOn(dark)),
          ),
          const SizedBox(height: AppSpace.x3),
          Text(
            title,
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
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, height: 1.3, color: c.inkSoft),
          ),
        ],
      ),
    );
  }
}

// ── Topic tile ────────────────────────────────────────────────────────────────

class _TopicTile extends StatelessWidget {
  final int index;
  final EcgTopic topic;
  final AppColors c;
  final VoidCallback onTap;
  const _TopicTile({
    required this.index,
    required this.topic,
    required this.c,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final num = (index + 1).toString().padLeft(2, '0');
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 38,
            child: Text(
              num,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: c.primary,
              ),
            ),
          ),
          const SizedBox(width: AppSpace.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  topic.title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: c.inkStrong,
                  ),
                ),
                if (topic.description.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    topic.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: c.inkSoft,
                    ),
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  '${topic.cardCount} ECG${topic.cardCount == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                    color: c.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpace.x2),
          Icon(Icons.chevron_right_rounded, size: 22, color: c.inkMuted),
        ],
      ),
    );
  }
}

// ── States ────────────────────────────────────────────────────────────────────

class _EmptyBox extends StatelessWidget {
  final AppColors c;
  final String text;
  const _EmptyBox({required this.c, required this.text});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: c.inkSoft),
        ),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final AppColors c;
  final VoidCallback onRetry;
  const _ErrorBox({required this.c, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Icon(Icons.cloud_off_rounded, size: 32, color: c.inkMuted),
          const SizedBox(height: 12),
          Text(
            "Couldn't load ECG topics",
            style: TextStyle(fontSize: 14, color: c.inkSoft),
          ),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
