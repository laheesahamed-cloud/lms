import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'courses_repository.dart';

/// The student Course library (real data). Tap a course → subject-wise lessons.
class CoursesPage extends ConsumerWidget {
  const CoursesPage({super.key});

  // Accent palette cycled by index (backend has no per-course colour).
  static const List<Color> _accents = <Color>[
    Color(0xFFF43F5E),
    Color(0xFF38BDF8),
    Color(0xFF8B5CF6),
    Color(0xFFF59E0B),
    Color(0xFF10B981),
    Color(0xFF3B82F6),
  ];
  static const List<IconData> _icons = <IconData>[
    Icons.favorite_outline_rounded,
    Icons.air_rounded,
    Icons.psychology_outlined,
    Icons.water_drop_outlined,
    Icons.bubble_chart_outlined,
    Icons.healing_outlined,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final coursesAsync = ref.watch(studentCoursesProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: <Widget>[
          Text(
            'YOUR LIBRARY',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent,
            ),
          ),
          const SizedBox(height: AppSpace.x1),
          Text(
            'Courses',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: c.inkStrong,
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            'Pick a course, then a subject, then a lesson to open its notes.',
            style: TextStyle(fontSize: 15.5, height: 1.4, color: c.inkSoft),
          ),
          const SizedBox(height: AppSpace.x5),
          coursesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.only(top: 60),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Text('Could not load courses.\n$e',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.inkSoft, fontSize: 14)),
            ),
            data: (courses) {
              if (courses.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No courses yet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                );
              }
              return AnimationLimiter(
                child: Column(
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 375),
                    childAnimationBuilder: (Widget w) => SlideAnimation(
                      verticalOffset: 22,
                      child: FadeInAnimation(child: w),
                    ),
                    children: <Widget>[
                      for (var i = 0; i < courses.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpace.x3),
                          child: _CourseCard(
                            course: courses[i],
                            accent: _accents[i % _accents.length],
                            icon: _icons[i % _icons.length],
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({
    required this.course,
    required this.accent,
    required this.icon,
  });

  final CourseCard course;
  final Color accent;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final double frac = (course.progressPercent / 100).clamp(0.0, 1.0);
    final int pct = course.progressPercent.round();

    return GlassCard(
      onTap: () => context.push('/app/courses/${course.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(AppRadius.inner),
                ),
                child: Icon(icon, color: accent, size: 24),
              ),
              const SizedBox(width: AppSpace.x4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      course.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: c.inkStrong,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      course.totalLessons > 0
                          ? '${course.totalLessons} lessons'
                          : (course.subjectCount > 0
                              ? '${course.subjectCount} subjects'
                              : 'Course'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: c.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.inkMuted, size: 22),
            ],
          ),
          if (course.description.isNotEmpty) ...[
            const SizedBox(height: AppSpace.x3),
            Text(
              course.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, height: 1.4, color: c.inkSoft),
            ),
          ],
          const SizedBox(height: AppSpace.x4),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: frac,
              minHeight: 6,
              backgroundColor: c.surface2,
              valueColor: AlwaysStoppedAnimation<Color>(accent),
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            '$pct% complete',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: c.inkMedium,
            ),
          ),
        ],
      ),
    );
  }
}
