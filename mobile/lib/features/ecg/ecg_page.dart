import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
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

/// ECG landing — four ways in, two of them the topic list split in half.
class EcgPage extends ConsumerWidget {
  const EcgPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final topicsAsync = ref.watch(ecgTopicsProvider);
    final topics = topicsAsync.asData?.value ?? const <EcgTopic>[];
    final basics = topics.where(EcgGroup.basics.matches).length;
    final rhythms = topics.where(EcgGroup.rhythms.matches).length;

    String countLabel(int n) => n == 0 ? '' : '$n TOPIC${n == 1 ? '' : 'S'}';

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
              Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _HubTile(
                      icon: Icons.school_outlined,
                      title: 'Basics of ECG',
                      subtitle: 'Leads, axis and how to read a strip',
                      badge: countLabel(basics),
                      tint: c.primary,
                      onTap: () => context.push('/app/ecg/topics/basics'),
                    ),
                  ),
                  const SizedBox(width: AppSpace.x3),
                  Expanded(
                    child: _HubTile(
                      icon: Icons.favorite_outline_rounded,
                      title: 'Rhythm Library',
                      subtitle: 'Common and complex arrhythmias',
                      badge: countLabel(rhythms),
                      tint: c.error,
                      onTap: () => context.push('/app/ecg/topics/rhythms'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpace.x3),
              Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _HubTile(
                      icon: Icons.monitor_heart_outlined,
                      title: 'Practice Cases',
                      subtitle: 'Real ECGs with full explanations',
                      badge: 'CLINICAL',
                      tint: c.success,
                      onTap: () => context.push('/app/ecg/quiz'),
                    ),
                  ),
                  const SizedBox(width: AppSpace.x3),
                  Expanded(
                    child: _HubTile(
                      icon: Icons.psychology_outlined,
                      title: 'Quick Quiz',
                      subtitle: 'Test your knowledge in minutes',
                      badge: 'Q-BANK',
                      tint: c.accent,
                      onTap: () => context.push('/app/quizzes'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
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
              error: (e, _) =>
                  _ErrorBox(c: c, onRetry: () => ref.refresh(ecgTopicsProvider)),
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
                              onTap: () =>
                                  context.push('/app/ecg/topic/${topics[i].id}'),
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

/// One of the four ways in. Icon chip, title, one line of what it is, and a
/// small label — the count where there is one, otherwise what kind of thing it
/// is.
class _HubTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String badge;
  final Color tint;
  final VoidCallback onTap;
  const _HubTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.tint,
    required this.onTap,
  });

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
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(AppRadius.inner),
            ),
            child: Icon(icon, size: 22, color: tint),
          ),
          const SizedBox(height: AppSpace.x3),
          Text(title,
              style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                  color: c.inkStrong)),
          const SizedBox(height: 3),
          Text(subtitle,
              style: TextStyle(fontSize: 12.5, height: 1.3, color: c.inkSoft)),
          if (badge.isNotEmpty) ...[
            const SizedBox(height: AppSpace.x3),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(badge,
                  style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.7,
                      color: tint)),
            ),
          ],
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
    required this.index, required this.topic, required this.c, required this.onTap,
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
            child: Text(num,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                    letterSpacing: -0.5, color: c.primary)),
          ),
          const SizedBox(width: AppSpace.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(topic.title,
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700,
                        letterSpacing: -0.2, color: c.inkStrong)),
                if (topic.description.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(topic.description,
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 13, height: 1.35, color: c.inkSoft)),
                ],
                const SizedBox(height: 6),
                Text('${topic.cardCount} ECG${topic.cardCount == 1 ? '' : 's'}',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700,
                        letterSpacing: 0.3, color: c.primary)),
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
        child: Text(text, textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: c.inkSoft)),
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
          Text("Couldn't load ECG topics",
              style: TextStyle(fontSize: 14, color: c.inkSoft)),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
