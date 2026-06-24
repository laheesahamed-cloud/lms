import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'quizzes_repository.dart';

class QuizzesPage extends ConsumerStatefulWidget {
  final bool examMode;
  const QuizzesPage({super.key, this.examMode = false});

  @override
  ConsumerState<QuizzesPage> createState() => _QuizzesPageState();
}

class _QuizzesPageState extends ConsumerState<QuizzesPage> {
  late bool _exam = widget.examMode;

  static const List<Color> _accents = <Color>[
    Color(0xFFF43F5E),
    Color(0xFF38BDF8),
    Color(0xFF8B5CF6),
    Color(0xFFF59E0B),
    Color(0xFF10B981),
    Color(0xFF3B82F6),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final quizzesAsync = ref.watch(quizListProvider);

    return SafeArea(
      child: quizzesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load quizzes.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 14)),
          ),
        ),
        data: (all) {
          final list = _exam ? all : all.where((q) => !q.examModeOnly).toList();
          final groups = groupQuizzesByCourse(list);
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Text(_exam ? 'TIMED ASSESSMENTS' : 'PRACTICE MODE',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: c.accent)),
              const SizedBox(height: 5),
              Text(_exam ? 'Exams' : 'Q-Bank',
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5)),
              const SizedBox(height: 12),
              _modeToggle(c),
              const SizedBox(height: 8),
              Text(
                _exam
                    ? 'Pick a course, then a subject set, and sit it timed.'
                    : 'Pick a course, then a subject set to practise with answers.',
                style: TextStyle(fontSize: 14, color: c.inkSoft),
              ),
              const SizedBox(height: 16),
              if (groups.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No quizzes available yet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                ),
              AnimationLimiter(
                child: Column(
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 350),
                    childAnimationBuilder: (w) => SlideAnimation(
                      verticalOffset: 22,
                      child: FadeInAnimation(child: w),
                    ),
                    children: [
                      for (var i = 0; i < groups.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _CourseCard(
                            group: groups[i],
                            exam: _exam,
                            accent: _accents[i % _accents.length],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _modeToggle(AppColors c) {
    Widget seg(String label, IconData icon, bool on, VoidCallback onTap) =>
        Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: on ? c.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 16, color: on ? Colors.white : c.inkMedium),
                  const SizedBox(width: 6),
                  Text(label,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: on ? Colors.white : c.inkMedium)),
                ],
              ),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          seg('Practice', Icons.all_inclusive_rounded, !_exam,
              () => setState(() => _exam = false)),
          seg('Exam', Icons.timer_outlined, _exam,
              () => setState(() => _exam = true)),
        ],
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final QuizCourseGroup group;
  final bool exam;
  final Color accent;
  const _CourseCard(
      {required this.group, required this.exam, required this.accent});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final courseId = group.quizzes.isNotEmpty ? group.quizzes.first.courseId : '';
    return GlassCard(
      onTap: () => context.push(
          '/app/qbank/course/$courseId${exam ? '?exam=1' : ''}'),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(AppRadius.inner),
            ),
            child: Icon(Icons.fact_check_outlined, color: accent, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(group.courseName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Text(
                  '${group.subjectCount} subject${group.subjectCount == 1 ? '' : 's'} · ${group.quizzes.length} ${exam ? 'exam' : 'set'}${group.quizzes.length == 1 ? '' : 's'}',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: c.inkSoft),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.inkMuted, size: 22),
        ],
      ),
    );
  }
}
