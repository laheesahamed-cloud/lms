import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';
import '../quizzes/quizzes_repository.dart';

/// Result detail for a single attempt — real, server-graded score
/// (`GET /quiz-attempts/result/:attemptId`).
class ResultDetailPage extends ConsumerWidget {
  final String attemptId;
  const ResultDetailPage({super.key, required this.attemptId});

  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFDC2626);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final resultAsync = ref.watch(attemptResultProvider(attemptId));
    return SafeArea(
      child: resultAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Could not load this result.\n$e',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: c.inkSoft)),
                const SizedBox(height: 16),
                TextButton(
                    onPressed: () => context.pop(), child: const Text('Back')),
              ],
            ),
          ),
        ),
        data: (r) => _content(context, c, r),
      ),
    );
  }

  Widget _content(BuildContext context, AppColors c, AttemptResult r) {
    final reduced = MediaQuery.of(context).disableAnimations;
    final kids = <Widget>[
      _BackRow(onBack: () => context.pop()),
      const SizedBox(height: AppSpace.x4),
      _ScoreCard(result: r),
      const SizedBox(height: AppSpace.sectionGap),
      _BreakdownCard(result: r),
      const SizedBox(height: AppSpace.sectionGap),
      AppButton('Review answers',
          kind: AppButtonKind.ghost,
          expand: true,
          leading:
              Icon(Icons.fact_check_outlined, size: 18, color: c.inkStrong),
          onPressed: () => context.push('/app/review/$attemptId')),
      const SizedBox(height: AppSpace.x3),
      AppButton('Retake exam',
          kind: AppButtonKind.ghost,
          expand: true,
          leading: Icon(Icons.refresh_rounded, size: 18, color: c.inkStrong),
          onPressed: () =>
              context.pushReplacement('/app/quizzes/${r.quizId}?exam=1')),
      const SizedBox(height: AppSpace.x3),
      AppButton('Done',
          kind: AppButtonKind.primary,
          expand: true,
          onPressed: () => context.pop()),
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
    return reduced ? list : AnimationLimiter(child: list);
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
        Text('Result',
            style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: c.inkMedium,
                letterSpacing: -0.2)),
      ],
    );
  }
}

class _ScoreCard extends StatelessWidget {
  final AttemptResult result;
  const _ScoreCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final passed = result.passed;
    final tint = passed ? ResultDetailPage._green : ResultDetailPage._red;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ScoreRing(
              percent: result.percentage.toDouble(), size: 132, label: 'Score'),
          const SizedBox(height: AppSpace.x5),
          Text('${result.correctAnswers} / ${result.totalQuestions} correct',
              style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.4)),
          const SizedBox(height: AppSpace.x1),
          Text(result.displayName,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: c.inkSoft)),
          const SizedBox(height: AppSpace.x3),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(passed ? 'PASSED' : 'NOT PASSED',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: tint)),
          ),
        ],
      ),
    );
  }
}

class _BreakdownCard extends StatelessWidget {
  final AttemptResult result;
  const _BreakdownCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('BREAKDOWN',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  color: c.accent)),
          const SizedBox(height: AppSpace.x4),
          _row(c, 'Correct', '${result.correctAnswers}',
              ResultDetailPage._green),
          const SizedBox(height: AppSpace.x3),
          _row(c, 'Wrong', '${result.wrongAnswers}', ResultDetailPage._red),
          const SizedBox(height: AppSpace.x3),
          _row(c, 'Skipped', '${result.unansweredQuestions}', c.inkSoft),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpace.x3),
            child: Divider(height: 1, color: c.line),
          ),
          _row(c, 'Pass mark', '${_n(result.passingMarks)}%', c.inkMedium),
        ],
      ),
    );
  }

  String _n(num v) => v == v.roundToDouble() ? '${v.round()}' : v.toStringAsFixed(1);

  Widget _row(AppColors c, String label, String value, Color valueColor) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w600,
                  color: c.inkStrong)),
          Text(value,
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: valueColor)),
        ],
      );
}
