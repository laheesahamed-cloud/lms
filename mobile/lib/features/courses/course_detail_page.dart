import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';
import 'courses_repository.dart';

/// Course summary — mirrors the web `CourseDetailPage` (`csum-*`) core: a hero
/// progress ring + "Continue", at-a-glance stats, a progress breakdown, and the
/// Subjects list where each subject opens its next lesson (no full lesson list,
/// matching the web). Lessons open the native AI note.
class CourseDetailPage extends ConsumerWidget {
  final String courseId;
  const CourseDetailPage({super.key, required this.courseId});

  /// The next lesson to study: in-progress → not-started. Null = all done/locked.
  static LessonItem? _next(List<LessonItem> lessons) {
    LessonItem? inProg, notStarted;
    for (final l in lessons) {
      if (l.locked) continue;
      if (l.status == 'in_progress') {
        inProg ??= l;
      } else if (l.status == 'not_started') {
        notStarted ??= l;
      }
    }
    return inProg ?? notStarted;
  }

  void _openLesson(BuildContext context, LessonItem l) {
    if (l.locked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('This lesson is included with a subscription.')),
      );
      return;
    }
    context.push('/app/study/lesson/${l.id}');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final detailAsync = ref.watch(courseDetailProvider(courseId));

    return SafeArea(
      child: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _back(
          context,
          c,
          Text('Could not load this course.\n$e',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ),
        data: (detail) {
          final courseNext =
              _next(detail.subjects.expand((s) => s.lessons).toList());
          final completed = detail.completedLessons;
          final total = detail.totalLessons;
          final frac = total > 0 ? (completed / total).clamp(0.0, 1.0) : 0.0;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Row(children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                  color: c.inkMedium,
                  onPressed: () => context.pop(),
                ),
              ]),

              // ── Hero: progress ring + title + Continue ──
              Center(
                child: ScoreRing(
                    percent: detail.progressPercent, size: 132, label: 'Complete'),
              ),
              const SizedBox(height: 16),
              Text(detail.title,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5,
                      height: 1.15)),
              if (detail.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(detail.description,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 15.5, height: 1.45, color: c.inkMedium)),
              ],
              const SizedBox(height: 16),
              if (courseNext != null)
                AppButton(
                  detail.progressPercent > 0 ? 'Continue learning' : 'Start course',
                  kind: AppButtonKind.primary,
                  expand: true,
                  leading: const Icon(Icons.play_arrow_rounded, size: 20),
                  onPressed: () => _openLesson(context, courseNext),
                )
              else
                Center(
                  child: Text('Course complete',
                      style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: c.success)),
                ),
              const SizedBox(height: 22),

              // ── At a glance ──
              Row(
                children: [
                  Expanded(
                      child: _Stat(
                          icon: Icons.menu_book_outlined,
                          value: '$total',
                          label: 'Lessons')),
                  const SizedBox(width: 10),
                  Expanded(
                      child: _Stat(
                          icon: Icons.check_circle_outline_rounded,
                          value: '$completed',
                          label: 'Completed')),
                  const SizedBox(width: 10),
                  Expanded(
                      child: _Stat(
                          icon: Icons.category_outlined,
                          value: '${detail.subjects.length}',
                          label: 'Subjects')),
                ],
              ),
              const SizedBox(height: 22),

              // ── Progress breakdown ──
              Text('Progress',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: frac,
                  minHeight: 9,
                  backgroundColor: c.surface2,
                  valueColor: AlwaysStoppedAnimation<Color>(c.primary),
                ),
              ),
              const SizedBox(height: 6),
              Text('$completed of $total lessons done',
                  style: TextStyle(fontSize: 13, color: c.inkSoft)),
              const SizedBox(height: 22),

              // ── Subjects (each → its next lesson) ──
              Text('Subjects',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const SizedBox(height: 10),
              if (detail.subjects.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('No subjects in this course yet.',
                      style: TextStyle(color: c.inkSoft)),
                )
              else
                AnimationLimiter(
                  child: Column(
                    children: AnimationConfiguration.toStaggeredList(
                      duration: const Duration(milliseconds: 320),
                      childAnimationBuilder: (w) => SlideAnimation(
                          verticalOffset: 20, child: FadeInAnimation(child: w)),
                      children: [
                        for (final s in detail.subjects)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _SubjectSummary(
                              subject: s,
                              onOpen: (l) => _openLesson(context, l),
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

class _Stat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  const _Stat({required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.inner),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: c.accent),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.3)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: c.inkSoft)),
        ],
      ),
    );
  }
}

/// Tap-to-expand subject card: header + progress, expands to the full lesson
/// list so any lesson can be opened.
class _SubjectSummary extends StatefulWidget {
  final SubjectGroup subject;
  final void Function(LessonItem) onOpen;
  const _SubjectSummary({required this.subject, required this.onOpen});

  @override
  State<_SubjectSummary> createState() => _SubjectSummaryState();
}

class _SubjectSummaryState extends State<_SubjectSummary> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = widget.subject;
    final frac = (s.progressPercent / 100).clamp(0.0, 1.0);

    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            borderRadius: BorderRadius.circular(AppRadius.inner),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: c.primaryTint,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(Icons.folder_outlined, size: 19, color: c.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: c.inkStrong)),
                        const SizedBox(height: 2),
                        Text(
                          '${s.lessons.length} lesson${s.lessons.length == 1 ? '' : 's'} · ${s.progressPercent.round()}%',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: c.inkSoft),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.expand_more_rounded, color: c.inkMuted),
                  ),
                ],
              ),
            ),
          ),
          if (s.progressPercent > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: frac,
                  minHeight: 5,
                  backgroundColor: c.surface2,
                  valueColor: AlwaysStoppedAnimation<Color>(c.primary),
                ),
              ),
            ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Column(
              children: [
                Divider(color: c.line, height: 1, indent: 14, endIndent: 14),
                for (var i = 0; i < s.lessons.length; i++) ...[
                  _LessonRow(
                    index: i + 1,
                    lesson: s.lessons[i],
                    onTap: () => widget.onOpen(s.lessons[i]),
                  ),
                  if (i != s.lessons.length - 1)
                    Divider(color: c.line, height: 1, indent: 56, endIndent: 14),
                ],
                if (s.lessons.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text('No lessons here yet.',
                        style: TextStyle(color: c.inkSoft, fontSize: 14)),
                  ),
              ],
            ),
            crossFadeState:
                _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }
}

class _LessonRow extends StatelessWidget {
  final int index;
  final LessonItem lesson;
  final VoidCallback onTap;
  const _LessonRow(
      {required this.index, required this.lesson, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration:
                  BoxDecoration(color: c.surface2, shape: BoxShape.circle),
              child: Text('$index',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: lesson.done ? c.success : c.inkMedium)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(lesson.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                      color: lesson.locked ? c.inkSoft : c.inkStrong)),
            ),
            const SizedBox(width: 8),
            Icon(
              lesson.locked
                  ? Icons.lock_outline_rounded
                  : (lesson.done
                      ? Icons.check_circle
                      : Icons.chevron_right_rounded),
              size: lesson.done ? 20 : 18,
              color: lesson.locked
                  ? c.inkMuted
                  : (lesson.done ? c.success : c.accent),
            ),
          ],
        ),
      ),
    );
  }
}
