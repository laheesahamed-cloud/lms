import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../quizzes/quizzes_repository.dart';

/// Per-question review of a submitted attempt — real answers + explanations
/// (`GET /quiz-attempts/review/:attemptId`).
class ReviewPage extends ConsumerWidget {
  final String attemptId;
  const ReviewPage({super.key, required this.attemptId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final reviewAsync = ref.watch(attemptReviewProvider(attemptId));
    return SafeArea(
      child: reviewAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Could not load the review.\n$e',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: c.inkSoft)),
                const SizedBox(height: 16),
                TextButton(
                    onPressed: () => context.pop(), child: const Text('Back')),
              ],
            ),
          ),
        ),
        data: (review) {
          final correct =
              review.questions.where((q) => q.status == 'correct').length;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: Icon(Icons.arrow_back_ios_new_rounded,
                        size: 18, color: c.inkMedium),
                  ),
                  Text('Review',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: c.inkStrong)),
                  const Spacer(),
                  Text('$correct/${review.questions.length} correct',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: c.inkSoft)),
                ],
              ),
              const SizedBox(height: 10),
              for (int qi = 0; qi < review.questions.length; qi++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ReviewCard(index: qi, item: review.questions[qi]),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  final int index;
  final ReviewQuestion item;
  const _ReviewCard({required this.index, required this.item});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final q = item.question;
    final statusColor = item.status == 'correct'
        ? c.success
        : (item.status == 'unanswered' ? c.inkMuted : c.error);
    final statusLabel = item.status == 'correct'
        ? 'Correct'
        : (item.status == 'unanswered' ? 'Skipped' : 'Incorrect');
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Question ${index + 1}',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: c.accent)),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(statusLabel,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(q.text,
              style: TextStyle(
                  fontSize: 15.5,
                  height: 1.4,
                  fontWeight: FontWeight.w700,
                  color: c.inkStrong)),
          const SizedBox(height: 12),
          if (item.isTrueFalse)
            for (final o in q.options)
              _TfReviewRow(
                text: '${o.label}.  ${o.text}',
                correctIsTrue: q.correctOptionIds.contains(o.id),
                marked: item.tfMarks[o.id],
              )
          else
            for (final o in q.options)
              _OptionRow(
                text: '${o.label}.  ${o.text}',
                correct: q.correctOptionIds.contains(o.id),
                wrongChosen: item.selectedOptionIds.contains(o.id) &&
                    !q.correctOptionIds.contains(o.id),
              ),
          if (q.explanation.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: c.surface2,
                borderRadius: BorderRadius.circular(AppRadius.inner),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.lightbulb_outline_rounded,
                      size: 17, color: c.accent),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(q.explanation,
                        style: TextStyle(
                            fontSize: 13,
                            height: 1.45,
                            color: c.inkMedium)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  final String text;
  final bool correct;
  final bool wrongChosen;
  const _OptionRow(
      {required this.text, required this.correct, required this.wrongChosen});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = correct ? c.success : (wrongChosen ? c.error : null);
    final icon = correct
        ? Icons.check_circle_rounded
        : (wrongChosen ? Icons.cancel_rounded : Icons.circle_outlined);
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        decoration: BoxDecoration(
          color: tint == null ? c.surface2 : tint.withValues(alpha: 0.13),
          borderRadius: BorderRadius.circular(AppRadius.inner),
        ),
        child: Row(
          children: [
            Icon(icon, size: 17, color: tint ?? c.inkMuted),
            const SizedBox(width: 9),
            Expanded(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: (correct || wrongChosen)
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: tint ?? c.inkMedium)),
            ),
          ],
        ),
      ),
    );
  }
}

/// One true/false statement in review — shows the correct answer and the
/// student's mark, flagging a mismatch in red.
class _TfReviewRow extends StatelessWidget {
  final String text;
  final bool correctIsTrue;
  final bool? marked; // null = not answered
  const _TfReviewRow({
    required this.text,
    required this.correctIsTrue,
    required this.marked,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final wasRight = marked != null && marked == correctIsTrue;
    final tint = marked == null ? null : (wasRight ? c.success : c.error);
    final markedLabel =
        marked == null ? 'Not answered' : (marked! ? 'True' : 'False');
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        decoration: BoxDecoration(
          color: tint == null ? c.surface2 : tint.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadius.inner),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  marked == null
                      ? Icons.remove_circle_outline
                      : (wasRight
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded),
                  size: 16,
                  color: tint ?? c.inkMuted,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(text,
                      style: TextStyle(
                          fontSize: 14, height: 1.4, color: c.inkStrong)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.only(left: 24),
              child: Text(
                  'Answer: ${correctIsTrue ? 'True' : 'False'}  ·  You: $markedLabel',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: tint ?? c.inkSoft)),
            ),
          ],
        ),
      ),
    );
  }
}
