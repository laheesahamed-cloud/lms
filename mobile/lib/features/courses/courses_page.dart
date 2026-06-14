import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

/// The student Course library.
class CoursesPage extends StatelessWidget {
  const CoursesPage({super.key});

  static const List<_Course> _courses = <_Course>[
    _Course(
      id: 'cardiology',
      subject: 'Cardiology',
      blurb: 'Heart failure, arrhythmias & ECG mastery',
      lessons: 24,
      progress: 0.72,
      accent: Color(0xFFF43F5E),
      icon: Icons.favorite_outline_rounded,
    ),
    _Course(
      id: 'respiratory',
      subject: 'Respiratory',
      blurb: 'Asthma, COPD & ventilation physiology',
      lessons: 18,
      progress: 0.45,
      accent: Color(0xFF38BDF8),
      icon: Icons.air_rounded,
    ),
    _Course(
      id: 'neurology',
      subject: 'Neurology',
      blurb: 'Stroke, seizures & the cranial nerves',
      lessons: 21,
      progress: 0.30,
      accent: Color(0xFF8B5CF6),
      icon: Icons.psychology_outlined,
    ),
    _Course(
      id: 'renal',
      subject: 'Renal',
      blurb: 'Acid-base, AKI & electrolyte balance',
      lessons: 16,
      progress: 0.58,
      accent: Color(0xFFF59E0B),
      icon: Icons.water_drop_outlined,
    ),
    _Course(
      id: 'endocrine',
      subject: 'Endocrine',
      blurb: 'Diabetes, thyroid & adrenal disorders',
      lessons: 19,
      progress: 0.12,
      accent: Color(0xFF10B981),
      icon: Icons.bubble_chart_outlined,
    ),
    _Course(
      id: 'surgery',
      subject: 'Surgery',
      blurb: 'Acute abdomen, trauma & peri-op care',
      lessons: 27,
      progress: 0.04,
      accent: Color(0xFF3B82F6),
      icon: Icons.healing_outlined,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: <Widget>[
          Text(
            'YOUR LIBRARY',
            style: TextStyle(
              fontSize: 11.5,
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
            'Pick up where you left off across your subjects.',
            style: TextStyle(
              fontSize: 14,
              height: 1.4,
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
                  for (final _Course course in _courses)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpace.x3),
                      child: _CourseCard(course: course),
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

class _Course {
  const _Course({
    required this.id,
    required this.subject,
    required this.blurb,
    required this.lessons,
    required this.progress,
    required this.accent,
    required this.icon,
  });

  final String id;
  final String subject;
  final String blurb;
  final int lessons;
  final double progress;
  final Color accent;
  final IconData icon;
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({required this.course});

  final _Course course;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final int pct = (course.progress * 100).round();

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
                  color: course.accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(AppRadius.inner),
                ),
                child: Icon(course.icon, color: course.accent, size: 24),
              ),
              const SizedBox(width: AppSpace.x4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      course.subject,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: c.inkStrong,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${course.lessons} lessons',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: c.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: c.inkMuted,
                size: 22,
              ),
            ],
          ),
          const SizedBox(height: AppSpace.x3),
          Text(
            course.blurb,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.4,
              color: c.inkSoft,
            ),
          ),
          const SizedBox(height: AppSpace.x4),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: course.progress,
              minHeight: 6,
              backgroundColor: c.surface2,
              valueColor: AlwaysStoppedAnimation<Color>(course.accent),
            ),
          ),
          const SizedBox(height: AppSpace.x2),
          Text(
            '$pct% complete',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: c.inkMedium,
            ),
          ),
        ],
      ),
    );
  }
}
