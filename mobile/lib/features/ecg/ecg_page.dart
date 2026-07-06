import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'ecg_repository.dart';

/// ECG landing — numbered topic list + a quiz entry banner.
class EcgPage extends ConsumerWidget {
  const EcgPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final topicsAsync = ref.watch(ecgTopicsProvider);
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => ref.refresh(ecgTopicsProvider.future),
        child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
              children: [
                if (!isLandscape) ...[
                  Text('STUDY TOOL',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                          letterSpacing: 1.4, color: c.accent)),
                  const SizedBox(height: 5),
                  Text('ECG',
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800,
                          letterSpacing: -0.5, color: c.inkStrong)),
                  const SizedBox(height: 4),
                  Text('Learn to read the ECG, topic by topic',
                      style: TextStyle(fontSize: 14, color: c.inkSoft)),
                  const SizedBox(height: 16),
                ] else ...[
                  Row(
                    children: [
                      Text('ECG',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                              letterSpacing: -0.4, color: c.inkStrong)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text('Learn to read the ECG, topic by topic',
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 13, color: c.inkSoft)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                _QuizBanner(c: c, onTap: () => context.push('/app/ecg/quiz')),
                const SizedBox(height: 16),

                topicsAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => _ErrorBox(
                    c: c,
                    onRetry: () => ref.refresh(ecgTopicsProvider),
                  ),
                  data: (topics) {
                    if (topics.isEmpty) {
                      return _EmptyBox(c: c, text: 'No ECG topics yet. Check back soon.');
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
                                  onTap: () => context.push('/app/ecg/topic/${topics[i].id}'),
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

// ── Quiz banner ───────────────────────────────────────────────────────────────

class _QuizBanner extends StatelessWidget {
  final AppColors c;
  final VoidCallback onTap;
  const _QuizBanner({required this.c, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.inner),
              gradient: LinearGradient(
                begin: Alignment.topLeft, end: Alignment.bottomRight,
                colors: [
                  c.accent.withValues(alpha: 0.22),
                  c.primary.withValues(alpha: 0.14),
                ],
              ),
            ),
            child: Icon(Icons.monitor_heart_outlined, size: 24, color: c.primary),
          ),
          const SizedBox(width: AppSpace.x4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('ECG Quiz',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700,
                        letterSpacing: -0.2, color: c.inkStrong)),
                const SizedBox(height: AppSpace.x1),
                Text('Test yourself — identify ECGs from the image',
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, height: 1.3, color: c.inkSoft)),
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
