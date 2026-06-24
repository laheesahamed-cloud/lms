import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';
import 'quizzes_repository.dart';

/// Shown after an exam is submitted to the backend — the real, server-graded
/// result with a per-bucket breakdown, plus Review answers / Done.
class ExamCompletePage extends ConsumerWidget {
  final String attemptId;
  const ExamCompletePage({super.key, required this.attemptId});

  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFDC2626);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final resultAsync = ref.watch(attemptResultProvider(attemptId));
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: resultAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Your exam was submitted, but the result could not be '
                      'loaded.\n$e',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                  const SizedBox(height: 16),
                  AppButton('Done',
                      kind: AppButtonKind.primary,
                      onPressed: () => context.go('/app/exams')),
                ],
              ),
            ),
          ),
          data: (r) => _content(context, c, r),
        ),
      ),
    );
  }

  Widget _content(BuildContext context, AppColors c, AttemptResult r) {
    final passed = r.passed;
    final accent = passed ? _green : _red;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(99),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(passed ? Icons.emoji_events_rounded : Icons.replay_rounded,
                    size: 16, color: accent),
                const SizedBox(width: 6),
                Text(passed ? 'PASSED' : 'NOT PASSED',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: accent)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text('Exam complete',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: c.inkStrong,
                letterSpacing: -0.5)),
        const SizedBox(height: 2),
        Text(r.quizTitle,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: c.inkSoft)),
        const SizedBox(height: 20),
        Center(
          child: ScoreRing(
              percent: r.percentage.toDouble(), label: 'Score', size: 150),
        ),
        const SizedBox(height: 22),
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  _Stat(
                      label: 'Correct',
                      value: '${r.correctAnswers}',
                      color: _green),
                  _vDivider(c),
                  _Stat(
                      label: 'Wrong', value: '${r.wrongAnswers}', color: _red),
                  _vDivider(c),
                  _Stat(
                      label: 'Skipped',
                      value: '${r.unansweredQuestions}',
                      color: c.inkSoft),
                ],
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Divider(height: 1, color: c.line),
              ),
              _row(c, 'Score', '${_n(r.score)} / ${r.totalMarks}'),
              const SizedBox(height: 8),
              _row(c, 'Percentage', '${_n(r.percentage)}%'),
              const SizedBox(height: 8),
              _row(c, 'Pass mark', '${_n(r.passingMarks)}%'),
              if (r.courseTitle.isNotEmpty) ...[
                const SizedBox(height: 8),
                _row(c, 'Course', r.courseTitle),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppButton('Review answers',
            kind: AppButtonKind.ghost,
            expand: true,
            leading:
                Icon(Icons.fact_check_outlined, size: 18, color: c.inkStrong),
            onPressed: () => context.push('/app/review/$attemptId')),
        const SizedBox(height: 10),
        AppButton('Done',
            kind: AppButtonKind.primary,
            expand: true,
            onPressed: () => context.go('/app/exams')),
      ],
    );
  }

  String _n(num v) => v == v.roundToDouble() ? '${v.round()}' : v.toStringAsFixed(1);

  Widget _row(AppColors c, String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 14, color: c.inkSoft)),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: c.inkStrong)),
          ),
        ],
      );

  Widget _vDivider(AppColors c) =>
      Container(width: 1, height: 34, color: c.line);
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _Stat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label.toUpperCase(),
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                  color: c.inkSoft)),
        ],
      ),
    );
  }
}
