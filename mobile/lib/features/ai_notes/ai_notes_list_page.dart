import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeletons.dart';
import 'note_models.dart';
import 'notes_repository.dart';

class AiNotesListPage extends ConsumerStatefulWidget {
  const AiNotesListPage({super.key});

  @override
  ConsumerState<AiNotesListPage> createState() => _AiNotesListPageState();
}

class _AiNotesListPageState extends ConsumerState<AiNotesListPage> {
  final Set<String> _collapsed = {};
  String _examTypeFilter = 'all';

  void _toggleCollapse(String key) => setState(() {
        _collapsed.contains(key) ? _collapsed.remove(key) : _collapsed.add(key);
      });

  Widget _examTypeChips(AppColors c, List<String> types) {
    final all = ['all', ...types];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final type in all)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _examTypeFilter = type),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: _examTypeFilter == type ? c.primary : c.surface2,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _examTypeFilter == type
                          ? c.primary
                          : c.inkMuted.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    type == 'all' ? 'All' : type,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _examTypeFilter == type ? Colors.white : c.inkMedium,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final notesAsync = ref.watch(notesListProvider);

    return SafeArea(
      child: notesAsync.when(
        loading: () => const NoteListSkeleton(),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load notes.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
          ),
        ),
        data: (notes) {
          // Drop notes whose linked lesson was deleted (lessonId set but lessonTitle empty)
          final valid = notes.where((n) => n.lessonExists).toList();
          final allGroups = groupNotesByCourse(valid);
          final examTypes = allGroups
              .map((g) => g.examType)
              .where((t) => t.trim().isNotEmpty)
              .toSet()
              .toList()
            ..sort();
          final courseGroups = _examTypeFilter == 'all'
              ? allGroups
              : allGroups.where((g) => g.examType == _examTypeFilter).toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Text('LESSONS',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: c.accent)),
              const SizedBox(height: 6),
              Text('Your lessons',
                  style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              if (examTypes.isNotEmpty) ...[
                const SizedBox(height: 14),
                _examTypeChips(context.c, examTypes),
              ],
              const SizedBox(height: 20),
              if (courseGroups.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No lessons available yet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                ),
              AnimationLimiter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 300),
                    childAnimationBuilder: (w) => SlideAnimation(
                      verticalOffset: 18,
                      child: FadeInAnimation(child: w),
                    ),
                    children: [
                      for (final course in courseGroups)
                        _CourseSection(
                          course: course,
                          collapsed: _collapsed,
                          onToggle: _toggleCollapse,
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
}

class _CourseSection extends StatelessWidget {
  final NoteCourseGroup course;
  final Set<String> collapsed;
  final void Function(String) onToggle;

  const _CourseSection({
    required this.course,
    required this.collapsed,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final subjectGroups = groupNotesBySubject(course.lessons);

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Course name — large section label
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Text(
              course.courseTitle,
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.3),
            ),
          ),
          // Topic / subject groups
          for (final subject in subjectGroups)
            _TopicSection(
              subject: subject,
              collapsed: collapsed,
              onToggle: onToggle,
            ),
        ],
      ),
    );
  }
}

class _TopicSection extends StatelessWidget {
  final NoteSubjectGroup subject;
  final Set<String> collapsed;
  final void Function(String) onToggle;

  const _TopicSection({
    required this.subject,
    required this.collapsed,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final key = subject.subjectName;
    final isCollapsed = collapsed.contains(key);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Topic header — tap to collapse
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onToggle(key),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8, top: 2),
              child: Row(
                children: [
                  Container(
                    width: 5,
                    height: 16,
                    decoration: BoxDecoration(
                      color: c.primary,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(subject.subjectName,
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: c.inkStrong)),
                  ),
                  Text(
                    '${subject.lessons.length}',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: c.inkSoft),
                  ),
                  const SizedBox(width: 2),
                  AnimatedRotation(
                    turns: isCollapsed ? 0 : 0.25,
                    duration: AppDur.dropdown,
                    curve: AppCurves.easeOut,
                    child: Icon(Icons.chevron_right_rounded,
                        size: 18, color: c.inkMuted),
                  ),
                ],
              ),
            ),
          ),
          // Lesson rows
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity, height: 0),
            secondChild: Column(
              children: [
                for (var i = 0; i < subject.lessons.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _LessonRow(
                        lesson: subject.lessons[i], index: i),
                  ),
              ],
            ),
            crossFadeState: isCollapsed
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            duration: AppDur.dropdown,
            sizeCurve: AppCurves.easeOut,
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _LessonRow extends StatelessWidget {
  final NoteListItem lesson;
  final int index;
  const _LessonRow({required this.lesson, required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      onTap: () => context.push('/app/study/lesson/${lesson.canvasId}'),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.surface2,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('${index + 1}',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(lesson.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: c.inkStrong)),
          ),
          const SizedBox(width: 4),
          Icon(Icons.chevron_right_rounded, size: 18, color: c.inkMuted),
        ],
      ),
    );
  }
}
