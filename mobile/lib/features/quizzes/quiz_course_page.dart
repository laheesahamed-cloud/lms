import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../bookmarks/bookmark_button.dart';
import 'quizzes_repository.dart';

/// One course's quiz sets, grouped by subject — `/app/qbank/course/:courseId`.
class QuizCoursePage extends ConsumerWidget {
  final String courseId;
  final bool examMode;
  const QuizCoursePage({super.key, required this.courseId, this.examMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final quizzesAsync = ref.watch(quizListProvider);

    return SafeArea(
      child: quizzesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _back(
          context,
          c,
          Text('Could not load this course.\n$e',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ),
        data: (all) {
          final mine = all
              .where((q) => q.courseId == courseId)
              .where((q) => examMode ? true : !q.examModeOnly)
              .toList();
          final courseName =
              mine.isNotEmpty ? mine.first.courseTitle : 'Course';
          final subjects = groupQuizzesBySubject(mine);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                    color: c.inkMedium,
                    onPressed: () => context.pop(),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(examMode ? 'EXAM SETS' : 'PRACTICE SETS',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: c.accent)),
              const SizedBox(height: 6),
              Text(courseName,
                  style: TextStyle(
                      fontSize: 25,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5,
                      height: 1.15)),
              const SizedBox(height: 4),
              Text(
                  '${subjects.length} subject${subjects.length == 1 ? '' : 's'} · ${mine.length} ${examMode ? 'exam' : 'set'}${mine.length == 1 ? '' : 's'}',
                  style: TextStyle(fontSize: 14, color: c.inkSoft)),
              const SizedBox(height: 18),
              if (subjects.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 30),
                  child: Text('No quiz sets in this course yet.',
                      style: TextStyle(color: c.inkSoft)),
                ),
              AnimationLimiter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 320),
                    childAnimationBuilder: (w) => SlideAnimation(
                      verticalOffset: 20,
                      child: FadeInAnimation(child: w),
                    ),
                    children: [
                      for (final s in subjects) ...[
                        _subjectHeader(c, s),
                        for (final q in s.quizzes)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _QuizCard(quiz: q, exam: examMode),
                          ),
                        const SizedBox(height: 10),
                      ],
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

  Widget _subjectHeader(AppColors c, QuizSubjectGroup s) => Padding(
        padding: const EdgeInsets.only(bottom: 10, top: 2),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 18,
              decoration: BoxDecoration(
                color: c.primary,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(s.subjectName,
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
            ),
            Text('${s.quizzes.length}',
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w700, color: c.inkSoft)),
          ],
        ),
      );

  Widget _back(BuildContext context, AppColors c, Widget child) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Row(children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
              color: c.inkMedium,
              onPressed: () => context.pop(),
            ),
          ]),
          Padding(padding: const EdgeInsets.all(24), child: child),
        ],
      );
}

class _QuizCard extends StatelessWidget {
  final QuizListItem quiz;
  final bool exam;
  const _QuizCard({required this.quiz, required this.exam});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      onTap: () {
        if (quiz.locked) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Upgrade to access this question bank.')),
          );
          return;
        }
        context.push('/app/quizzes/${quiz.id}${exam ? '?exam=1' : ''}');
      },
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.surface2,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(exam ? Icons.timer_outlined : Icons.quiz_outlined,
                size: 18, color: c.inkMedium),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(quiz.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: quiz.locked ? c.inkSoft : c.inkStrong)),
                const SizedBox(height: 3),
                Text(
                  '${quiz.totalQuestions} questions'
                  '${exam && quiz.timeLimit > 0 ? ' · ${quiz.timeLimit} min' : ''}'
                  '${quiz.isFree ? ' · Free' : ''}'
                  '${quiz.isCompleted ? ' · Attempted' : ''}',
                  style: TextStyle(fontSize: 13, color: c.inkSoft),
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
          if (quiz.isCompleted && !quiz.locked) ...[
            const _CompletedTick(),
            const SizedBox(width: 6),
          ],
          Icon(quiz.locked ? Icons.lock_outline_rounded : Icons.chevron_right,
              size: 20, color: c.inkMuted),
          // Save icon last, so it's always in the same column on every row.
          if (!quiz.locked)
            BookmarkButton(
                itemType: 'quiz', itemId: int.tryParse(quiz.id) ?? 0),
        ],
      ),
    );
  }
}

/// Small green check badge marking a completed (attempted) quiz.
class _CompletedTick extends StatelessWidget {
  const _CompletedTick();
  static const _green = Color(0xFF16A34A);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _green.withValues(alpha: 0.16),
        shape: BoxShape.circle,
      ),
      child: const Icon(Icons.check_rounded, size: 15, color: _green),
    );
  }
}
