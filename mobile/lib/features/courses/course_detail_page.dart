import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';

class CourseDetailPage extends StatelessWidget {
  final String courseId;
  const CourseDetailPage({super.key, required this.courseId});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    // Realistic medical demo data, varied subtly by courseId.
    final lessons = _demoLessons(courseId);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          // Back button row.
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                color: c.inkMedium,
                splashRadius: 22,
                tooltip: 'Back',
                constraints: const BoxConstraints(
                  minWidth: AppSpace.touch,
                  minHeight: AppSpace.touch,
                ),
                onPressed: () => context.pop(),
              ),
            ],
          ),
          const SizedBox(height: AppSpace.x2),

          // Eyebrow + title + summary.
          Text(
            'COURSE',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent,
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            'Cardiovascular system',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            'How the heart pumps blood, controls its own rhythm, and keeps '
            'pressure steady across the body.',
            style: TextStyle(
              fontSize: 15,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: c.inkMedium,
            ),
          ),
          const SizedBox(height: AppSpace.x4),

          // Stat chips.
          Row(
            children: const [
              Expanded(
                child: _StatChip(
                  icon: Icons.menu_book_outlined,
                  label: 'Lessons',
                  value: '12',
                ),
              ),
              SizedBox(width: AppSpace.x3),
              Expanded(
                child: _StatChip(
                  icon: Icons.quiz_outlined,
                  label: 'Quizzes',
                  value: '5',
                ),
              ),
              SizedBox(width: AppSpace.x3),
              Expanded(
                child: _StatChip(
                  icon: Icons.trending_up_rounded,
                  label: 'Progress',
                  value: '58%',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpace.sectionGap),

          // Lessons section heading.
          Text(
            'Lessons',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: AppSpace.x3),

          // Lessons list inside a single GlassCard.
          GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: AnimationLimiter(
              child: Column(
                children: AnimationConfiguration.toStaggeredList(
                  duration: const Duration(milliseconds: 375),
                  childAnimationBuilder: (w) => SlideAnimation(
                    verticalOffset: 22,
                    child: FadeInAnimation(child: w),
                  ),
                  children: [
                    for (var i = 0; i < lessons.length; i++) ...[
                      _LessonRow(
                        index: i + 1,
                        title: lessons[i].title,
                        done: lessons[i].done,
                        onTap: () => context.push('/app/ai-notes'),
                      ),
                      if (i != lessons.length - 1)
                        Divider(
                          color: c.line,
                          height: 1,
                          thickness: 1,
                          indent: 16,
                          endIndent: 16,
                        ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpace.sectionGap),

          AppButton(
            'Continue learning',
            kind: AppButtonKind.primary,
            expand: true,
            leading: const Icon(Icons.play_arrow_rounded, size: 20),
            onPressed: () => context.push('/app/ai-notes'),
          ),
        ],
      ),
    );
  }

  static List<_Lesson> _demoLessons(String courseId) {
    // Mark "done" deterministically from courseId so different courses vary.
    final seed = courseId.codeUnits.fold<int>(0, (a, b) => a + b);
    final titles = <String>[
      'Heart anatomy & chambers',
      'The cardiac cycle',
      'Conduction system & ECG basics',
      'Cardiac output & preload',
      'Blood pressure regulation',
      'Common arrhythmias',
    ];
    return [
      for (var i = 0; i < titles.length; i++)
        _Lesson(titles[i], done: ((seed + i) % 5) < 3 ? i < 3 : i < 2),
    ];
  }
}

class _Lesson {
  final String title;
  final bool done;
  const _Lesson(this.title, {required this.done});
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _StatChip({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      constraints: const BoxConstraints(minHeight: AppSpace.touch),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpace.x3,
        vertical: AppSpace.x3,
      ),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.inner),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: c.accent),
          const SizedBox(height: AppSpace.x2),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: c.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

class _LessonRow extends StatelessWidget {
  final int index;
  final String title;
  final bool done;
  final VoidCallback onTap;
  const _LessonRow({
    required this.index,
    required this.title,
    required this.done,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.inner),
      child: Container(
        constraints: const BoxConstraints(minHeight: AppSpace.touch + 8),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpace.x4,
          vertical: AppSpace.x3,
        ),
        child: Row(
          children: [
            // Index circle.
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: c.surface2,
                shape: BoxShape.circle,
              ),
              child: Text(
                '$index',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: done ? c.success : c.inkMedium,
                ),
              ),
            ),
            const SizedBox(width: AppSpace.x4),
            // Title.
            Expanded(
              child: Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                  color: c.inkStrong,
                ),
              ),
            ),
            const SizedBox(width: AppSpace.x3),
            // Trailing state icon.
            Icon(
              done ? Icons.check_circle : Icons.play_circle_outline,
              size: 24,
              color: done ? c.success : c.accent,
            ),
          ],
        ),
      ),
    );
  }
}
