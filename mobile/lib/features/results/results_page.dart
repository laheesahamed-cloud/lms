import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

/// Quiz mode for an attempt record.
enum _Mode { practice, exam }

/// A single past quiz attempt (demo data, no network).
class _Attempt {
  const _Attempt({
    required this.id,
    required this.title,
    required this.subject,
    required this.date,
    required this.mode,
    required this.score,
    required this.questions,
  });

  final String id;
  final String title;
  final String subject;
  final String date;
  final _Mode mode;
  final int score; // 0..100
  final int questions;
}

const List<_Attempt> _kAttempts = <_Attempt>[
  _Attempt(
    id: 'atp-2041',
    title: 'Cardiology — Arrhythmias',
    subject: 'Internal Medicine',
    date: 'Yesterday',
    mode: _Mode.exam,
    score: 92,
    questions: 40,
  ),
  _Attempt(
    id: 'atp-2038',
    title: 'Acid–Base Disorders',
    subject: 'Physiology',
    date: '2 days ago',
    mode: _Mode.practice,
    score: 78,
    questions: 25,
  ),
  _Attempt(
    id: 'atp-2034',
    title: 'Antibiotics & Resistance',
    subject: 'Pharmacology',
    date: '4 days ago',
    mode: _Mode.practice,
    score: 64,
    questions: 30,
  ),
  _Attempt(
    id: 'atp-2030',
    title: 'Renal Pathology',
    subject: 'Pathology',
    date: 'Last week',
    mode: _Mode.exam,
    score: 88,
    questions: 50,
  ),
  _Attempt(
    id: 'atp-2025',
    title: 'Cranial Nerve Lesions',
    subject: 'Neuroanatomy',
    date: '9 days ago',
    mode: _Mode.practice,
    score: 55,
    questions: 20,
  ),
  _Attempt(
    id: 'atp-2019',
    title: 'Endocrine — Thyroid Axis',
    subject: 'Endocrinology',
    date: '2 weeks ago',
    mode: _Mode.exam,
    score: 81,
    questions: 35,
  ),
  _Attempt(
    id: 'atp-2012',
    title: 'Hemoglobinopathies',
    subject: 'Hematology',
    date: '3 weeks ago',
    mode: _Mode.practice,
    score: 70,
    questions: 28,
  ),
];

class ResultsPage extends StatelessWidget {
  const ResultsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: <Widget>[
          Text(
            'YOUR HISTORY',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent,
            ),
          ),
          const SizedBox(height: AppSpace.x1),
          Text(
            'Results',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            '${_kAttempts.length} recent attempts',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: c.inkSoft,
            ),
          ),
          const SizedBox(height: AppSpace.x5),
          AnimationLimiter(
            child: Column(
              children: AnimationConfiguration.toStaggeredList(
                duration: const Duration(milliseconds: 375),
                childAnimationBuilder: (Widget w) => SlideAnimation(
                  verticalOffset: 22,
                  child: FadeInAnimation(child: w),
                ),
                children: <Widget>[
                  for (final _Attempt a in _kAttempts)
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
    );
  }
}

class _AttemptCard extends StatelessWidget {
  const _AttemptCard({required this.attempt});

  final _Attempt attempt;

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return GlassCard(
      padding: const EdgeInsets.all(AppSpace.x4),
      onTap: () => context.push('/app/results/${attempt.id}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  attempt.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: c.inkStrong,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: AppSpace.x1),
                Text(
                  attempt.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: c.inkSoft,
                  ),
                ),
                const SizedBox(height: AppSpace.x3),
                Row(
                  children: <Widget>[
                    _ModeChip(mode: attempt.mode),
                    const SizedBox(width: AppSpace.x2),
                    Icon(
                      Icons.schedule_outlined,
                      size: 14,
                      color: c.inkMuted,
                    ),
                    const SizedBox(width: AppSpace.x1),
                    Flexible(
                      child: Text(
                        attempt.date,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: c.inkMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpace.x4),
          _ScorePill(score: attempt.score),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.mode});

  final _Mode mode;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final bool isExam = mode == _Mode.exam;
    final String label = isExam ? 'Exam' : 'Practice';
    final IconData icon =
        isExam ? Icons.assignment_outlined : Icons.fitness_center_outlined;
    final Color tint = isExam ? c.accent : c.primary;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpace.x2,
        vertical: AppSpace.x1,
      ),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 13, color: tint),
          const SizedBox(width: AppSpace.x1),
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: tint,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  const _ScorePill({required this.score});

  final int score;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final Color color = score >= 80
        ? c.success
        : score >= 60
            ? c.warning
            : c.error;

    return Container(
      constraints: const BoxConstraints(minWidth: 60, minHeight: 44),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpace.x3,
        vertical: AppSpace.x2,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.inner),
      ),
      child: Text(
        '$score%',
        style: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w800,
          color: color,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}
