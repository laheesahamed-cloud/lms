import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../quizzes/quizzes_repository.dart';

/// Quiz/exam attempt history — real attempts from the backend
/// (`GET /quiz-attempts/results`).
class ResultsPage extends ConsumerWidget {
  const ResultsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final resultsAsync = ref.watch(resultsListProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () => ref.refresh(resultsListProvider.future),
        child: resultsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 120),
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Could not load your results.\n$e',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft, fontSize: 14)),
                ),
              ),
            ],
          ),
          data: (items) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: <Widget>[
              Text('YOUR HISTORY',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: c.accent)),
              const SizedBox(height: AppSpace.x1),
              Text('Results',
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5)),
              const SizedBox(height: AppSpace.x2),
              Text(
                items.isEmpty
                    ? 'No attempts yet'
                    : '${items.length} attempt${items.length == 1 ? '' : 's'}',
                style: TextStyle(
                    fontSize: 15.5, fontWeight: FontWeight.w500, color: c.inkSoft),
              ),
              const SizedBox(height: AppSpace.x5),
              if (items.isEmpty)
                _EmptyState(c)
              else
                AnimationLimiter(
                  child: Column(
                    children: AnimationConfiguration.toStaggeredList(
                      duration: const Duration(milliseconds: 375),
                      childAnimationBuilder: (Widget w) => SlideAnimation(
                        verticalOffset: 22,
                        child: FadeInAnimation(child: w),
                      ),
                      children: <Widget>[
                        for (final a in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: AppSpace.x3),
                            child: _AttemptCard(attempt: a),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final AppColors c;
  const _EmptyState(this.c);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          Icon(Icons.assignment_outlined, size: 40, color: c.inkMuted),
          const SizedBox(height: 12),
          Text('Take an exam to see your results here.',
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ],
      ),
    );
  }
}

class _AttemptCard extends StatelessWidget {
  const _AttemptCard({required this.attempt});
  final ResultListItem attempt;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.all(AppSpace.x4),
      onTap: () => context.push('/app/results/${attempt.attemptId}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(attempt.quizTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: c.inkStrong,
                        letterSpacing: -0.2)),
                const SizedBox(height: AppSpace.x1),
                Text(
                  attempt.courseTitle.isNotEmpty
                      ? attempt.courseTitle
                      : attempt.topicDisplay,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: c.inkSoft),
                ),
                const SizedBox(height: AppSpace.x3),
                Row(
                  children: <Widget>[
                    _PassChip(passed: attempt.passed),
                    const SizedBox(width: AppSpace.x2),
                    Text('${attempt.correctAnswers} correct',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: c.inkMuted)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpace.x4),
          _ScorePill(percent: attempt.percentage.round()),
        ],
      ),
    );
  }
}

class _PassChip extends StatelessWidget {
  const _PassChip({required this.passed});
  final bool passed;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = passed ? c.success : c.error;
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpace.x2, vertical: AppSpace.x1),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(passed ? Icons.check_circle_outline : Icons.cancel_outlined,
              size: 13, color: tint),
          const SizedBox(width: AppSpace.x1),
          Text(passed ? 'Passed' : 'Failed',
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700, color: tint)),
        ],
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  const _ScorePill({required this.percent});
  final int percent;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final Color color = percent >= 80
        ? c.success
        : percent >= 60
            ? c.warning
            : c.error;
    return Container(
      constraints: const BoxConstraints(minWidth: 60, minHeight: 44),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpace.x3, vertical: AppSpace.x2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.inner),
      ),
      child: Text('$percent%',
          style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: color,
              letterSpacing: -0.3)),
    );
  }
}
