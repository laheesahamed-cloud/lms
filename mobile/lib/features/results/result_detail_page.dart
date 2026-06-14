import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';

/// Result detail for a single quiz attempt — score ring, per-topic breakdown,
/// and review/retry actions. Self-contained demo data, no network.
class ResultDetailPage extends StatelessWidget {
  final String attemptId;
  const ResultDetailPage({super.key, required this.attemptId});

  static const List<_TopicScore> _topics = [
    _TopicScore('Glomerular filtration', 0.84),
    _TopicScore('Acid–base balance', 0.78),
    _TopicScore('Nephron transport', 0.70),
    _TopicScore('Renal pharmacology', 0.62),
    _TopicScore('Fluid & electrolytes', 0.56),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    final reduced = MediaQuery.of(context).disableAnimations;
    final kids = <Widget>[
              _BackRow(onBack: () => context.pop()),
              const SizedBox(height: AppSpace.x4),
              const _ScoreCard(),
              const SizedBox(height: AppSpace.sectionGap),
              const _BreakdownCard(topics: _topics),
              const SizedBox(height: AppSpace.sectionGap),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      'Review answers',
                      kind: AppButtonKind.ghost,
                      expand: true,
                      leading: Icon(Icons.fact_check_outlined,
                          size: 18, color: c.inkStrong),
                      onPressed: () => context.push('/app/review/$attemptId'),
                    ),
                  ),
                  const SizedBox(width: AppSpace.x3),
                  Expanded(
                    child: AppButton(
                      'Retry',
                      expand: true,
                      leading: const Icon(Icons.refresh_rounded,
                          size: 18, color: Color(0xFF04121F)),
                      onPressed: () => context.push('/app/quizzes/$attemptId'),
                    ),
                  ),
                ],
              ),
    ];
    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
      children: reduced
          ? kids
          : AnimationConfiguration.toStaggeredList(
              duration: const Duration(milliseconds: 375),
              childAnimationBuilder: (w) => SlideAnimation(
                verticalOffset: 22,
                child: FadeInAnimation(child: w),
              ),
              children: kids,
            ),
    );
    return SafeArea(child: reduced ? list : AnimationLimiter(child: list));
  }
}

class _BackRow extends StatelessWidget {
  final VoidCallback onBack;
  const _BackRow({required this.onBack});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onBack,
          child: SizedBox(
            width: AppSpace.touch,
            height: AppSpace.touch,
            child: Icon(Icons.arrow_back_ios_new_rounded,
                size: 19, color: c.inkMedium),
          ),
        ),
        Text(
          'Result',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: c.inkMedium,
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const ScoreRing(percent: 72, size: 132, label: 'Score'),
          const SizedBox(height: AppSpace.x5),
          Text(
            '36 / 50 correct',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: AppSpace.x1),
          Text(
            'Renal mock exam · Practice',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
              color: c.inkSoft,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _BreakdownCard extends StatelessWidget {
  final List<_TopicScore> topics;
  const _BreakdownCard({required this.topics});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'BREAKDOWN BY TOPIC',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent,
            ),
          ),
          const SizedBox(height: AppSpace.x4),
          for (int i = 0; i < topics.length; i++) ...[
            _TopicRow(topic: topics[i]),
            if (i != topics.length - 1) const SizedBox(height: AppSpace.x4),
          ],
        ],
      ),
    );
  }
}

class _TopicRow extends StatelessWidget {
  final _TopicScore topic;
  const _TopicRow({required this.topic});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final pct = (topic.value * 100).round();
    final Color barColor = topic.value >= 0.75
        ? c.success
        : topic.value >= 0.6
            ? c.primary
            : c.warning;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                topic.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  color: c.inkStrong,
                  letterSpacing: -0.1,
                ),
              ),
            ),
            const SizedBox(width: AppSpace.x3),
            Text(
              '$pct%',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
                color: c.inkMedium,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpace.x2),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: LinearProgressIndicator(
            value: topic.value,
            minHeight: 6,
            backgroundColor: c.surface2,
            valueColor: AlwaysStoppedAnimation<Color>(barColor),
          ),
        ),
      ],
    );
  }
}

class _TopicScore {
  final String name;
  final double value; // 0..1
  const _TopicScore(this.name, this.value);
}
