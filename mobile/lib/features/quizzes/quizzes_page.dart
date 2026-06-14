import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

enum _Difficulty { easy, medium, hard }

class _Quiz {
  final String id;
  final String title;
  final int questions;
  final int minutes;
  final _Difficulty difficulty;
  const _Quiz({
    required this.id,
    required this.title,
    required this.questions,
    required this.minutes,
    required this.difficulty,
  });
}

const List<_Quiz> _quizzes = [
  _Quiz(
    id: 'cardio-arrhythmias',
    title: 'Cardiology — Arrhythmias',
    questions: 20,
    minutes: 30,
    difficulty: _Difficulty.hard,
  ),
  _Quiz(
    id: 'resp-obstructive-disease',
    title: 'Respiratory — Obstructive Disease',
    questions: 18,
    minutes: 25,
    difficulty: _Difficulty.medium,
  ),
  _Quiz(
    id: 'pharm-antibiotics',
    title: 'Pharmacology — Antibiotics',
    questions: 24,
    minutes: 35,
    difficulty: _Difficulty.medium,
  ),
  _Quiz(
    id: 'neuro-stroke-syndromes',
    title: 'Neurology — Stroke Syndromes',
    questions: 16,
    minutes: 22,
    difficulty: _Difficulty.hard,
  ),
  _Quiz(
    id: 'endo-thyroid-disorders',
    title: 'Endocrinology — Thyroid Disorders',
    questions: 15,
    minutes: 20,
    difficulty: _Difficulty.easy,
  ),
  _Quiz(
    id: 'gi-liver-function',
    title: 'Gastroenterology — Liver Function',
    questions: 22,
    minutes: 30,
    difficulty: _Difficulty.easy,
  ),
];

class QuizzesPage extends StatelessWidget {
  final bool examMode;
  const QuizzesPage({super.key, this.examMode = false});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return SafeArea(
      child: AnimationLimiter(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
          children: AnimationConfiguration.toStaggeredList(
            duration: const Duration(milliseconds: 375),
            childAnimationBuilder: (w) => SlideAnimation(
              verticalOffset: 22,
              curve: AppCurves.easeOut,
              child: FadeInAnimation(child: w),
            ),
            children: [
              Text(
                examMode ? 'TIMED ASSESSMENTS' : 'PRACTICE MODE',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  color: c.accent,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                examMode ? 'Exams' : 'Q-Bank',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                examMode
                    ? 'Sit a timed paper under exam conditions.'
                    : 'Build recall with untimed practice sets.',
                style: TextStyle(fontSize: 13.5, color: c.inkSoft),
              ),
              const SizedBox(height: 16),
              for (int i = 0; i < _quizzes.length; i++) ...[
                _QuizCard(quiz: _quizzes[i], examMode: examMode),
                if (i != _quizzes.length - 1) const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _QuizCard extends StatelessWidget {
  final _Quiz quiz;
  final bool examMode;
  const _QuizCard({required this.quiz, required this.examMode});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return GlassCard(
      onTap: () => context.push('/app/quizzes/${quiz.id}'),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  quiz.title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: c.inkStrong,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '${quiz.questions} questions',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: c.inkSoft,
                      ),
                    ),
                    _Chip(
                      icon: examMode
                          ? Icons.timer_outlined
                          : Icons.all_inclusive_rounded,
                      label: examMode ? '${quiz.minutes} min' : 'Untimed',
                    ),
                    _DifficultyPill(difficulty: quiz.difficulty),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(Icons.chevron_right, size: 22, color: c.inkMuted),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Chip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: c.inkSoft),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: c.inkMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _DifficultyPill extends StatelessWidget {
  final _Difficulty difficulty;
  const _DifficultyPill({required this.difficulty});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final Color color;
    final String label;
    switch (difficulty) {
      case _Difficulty.easy:
        color = c.success;
        label = 'Easy';
        break;
      case _Difficulty.medium:
        color = c.warning;
        label = 'Medium';
        break;
      case _Difficulty.hard:
        color = c.error;
        label = 'Hard';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
