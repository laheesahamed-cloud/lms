import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'note_models.dart';
import 'notes_repository.dart';

/// Lessons inside one course grouped by subject — `/app/ai-notes/course/:courseKey`.
/// Mirrors the Q-Bank `QuizCoursePage` pattern: collapsible subject sections
/// with numbered lesson rows inside each.
class NotesCourseDetailPage extends ConsumerStatefulWidget {
  final String courseKey;
  const NotesCourseDetailPage({super.key, required this.courseKey});

  @override
  ConsumerState<NotesCourseDetailPage> createState() =>
      _NotesCourseDetailPageState();
}

class _NotesCourseDetailPageState
    extends ConsumerState<NotesCourseDetailPage> {
  final Set<String> _collapsed = {};
  String? _subject; // null = All

  void _toggleCollapse(String key) => setState(() {
        if (_collapsed.contains(key)) {
          _collapsed.remove(key);
        } else {
          _collapsed.add(key);
        }
      });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final notesAsync = ref.watch(notesListProvider);

    return SafeArea(
      child: notesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _backWrap(
          context,
          c,
          Text('Could not load lessons.\n$e',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ),
        data: (allNotes) {
          final decoded = Uri.decodeComponent(widget.courseKey);
          final lessons = allNotes.where((n) {
            // Match by numeric courseId string or by decoded course title
            if (n.courseId.isNotEmpty && n.courseId == widget.courseKey)
              return true;
            if (n.courseId.isNotEmpty && n.courseId == decoded) return true;
            return n.courseTitle == decoded;
          }).toList();

          final courseTitle = lessons.isNotEmpty
              ? (lessons.first.courseTitle.isNotEmpty
                  ? lessons.first.courseTitle
                  : decoded)
              : decoded;

          final allGroups = groupNotesBySubject(lessons);
          final subjects = allGroups.map((g) => g.subjectName).toList();
          final groups = _subject == null
              ? allGroups
              : allGroups.where((g) => g.subjectName == _subject).toList();
          final visibleLessons =
              groups.fold<int>(0, (sum, g) => sum + g.lessons.length);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        size: 20),
                    color: c.inkMedium,
                    onPressed: () => context.pop(),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text('LESSONS',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: c.accent)),
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(courseTitle,
                        style: TextStyle(
                            fontSize: 25,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong,
                            letterSpacing: -0.5,
                            height: 1.15)),
                  ),
                  if (subjects.length > 1)
                    _SubjectDropdown(
                      value: _subject,
                      subjects: subjects,
                      onChanged: (v) => setState(() => _subject = v),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${groups.length} subject${groups.length == 1 ? '' : 's'} · $visibleLessons lesson${visibleLessons == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 14, color: c.inkSoft),
              ),
              const SizedBox(height: 20),
              if (lessons.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 30),
                  child: Text('No lessons available yet.',
                      style: TextStyle(color: c.inkSoft)),
                )
              else
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
                        for (final g in groups) _subjectSection(c, g),
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

  Widget _subjectSection(AppColors c, NoteSubjectGroup g) {
    final collapsed = _collapsed.contains(g.subjectName);

    // Group lessons by topicName to show dividers
    final topicOrder = <String>[];
    final topicMap = <String, List<NoteListItem>>{};
    for (final lesson in g.lessons) {
      final key = lesson.topicName.isNotEmpty ? lesson.topicName : '';
      if (!topicMap.containsKey(key)) {
        topicOrder.add(key);
        topicMap[key] = [];
      }
      topicMap[key]!.add(lesson);
    }

    var globalIndex = 0;
    final lessonWidgets = <Widget>[];
    for (final topicKey in topicOrder) {
      final topicLessons = topicMap[topicKey]!;
      if (topicKey.isNotEmpty) {
        lessonWidgets.add(_TopicDivider(label: topicKey, c: c));
      }
      for (final lesson in topicLessons) {
        final idx = globalIndex++;
        lessonWidgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _LessonRow(lesson: lesson, index: idx),
        ));
      }
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Subject header — tap to collapse/expand
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _toggleCollapse(g.subjectName),
            child: Padding(
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
                    child: Text(g.subjectName,
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ),
                  Text(
                    '${g.lessons.length} lesson${g.lessons.length == 1 ? '' : 's'}',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: c.inkSoft),
                  ),
                  const SizedBox(width: 4),
                  AnimatedRotation(
                    turns: collapsed ? 0 : 0.25,
                    duration: AppDur.dropdown,
                    curve: AppCurves.easeOut,
                    child: Icon(Icons.chevron_right_rounded,
                        size: 20, color: c.inkMuted),
                  ),
                ],
              ),
            ),
          ),
          // Lesson rows with topic dividers — collapse/expand
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity, height: 0),
            secondChild: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: lessonWidgets,
            ),
            crossFadeState: collapsed
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            duration: AppDur.dropdown,
            sizeCurve: AppCurves.easeOut,
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }

  Widget _backWrap(BuildContext context, AppColors c, Widget child) =>
      ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Row(children: [
            IconButton(
              icon:
                  const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
              color: c.inkMedium,
              onPressed: () => context.pop(),
            ),
          ]),
          Padding(padding: const EdgeInsets.all(24), child: child),
        ],
      );
}

class _TopicDivider extends StatelessWidget {
  final String label;
  final AppColors c;
  const _TopicDivider({required this.label, required this.c});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 8),
      child: Row(children: [
        Expanded(child: Divider(color: c.line, thickness: 1)),
        const SizedBox(width: 10),
        Text(label.toUpperCase(),
            style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: c.inkMuted)),
        const SizedBox(width: 10),
        Expanded(child: Divider(color: c.line, thickness: 1)),
      ]),
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      onTap: () => context.push('/app/study/lesson/${lesson.canvasId}'),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.surface2,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Text('${index + 1}',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(lesson.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: c.inkStrong)),
          ),
          const SizedBox(width: 4),
          if (lesson.lessonCompleted) ...[
            const _CompletedTick(),
            const SizedBox(width: 4),
          ],
          Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
        ],
      ),
    );
  }
}

/// Small green check badge — same pattern as quiz course page.
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

class _SubjectDropdown extends StatelessWidget {
  final String? value;
  final List<String> subjects;
  final ValueChanged<String?> onChanged;
  const _SubjectDropdown(
      {required this.value, required this.subjects, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTapDown: (details) async {
        final result = await showMenu<String?>(
          context: context,
          position: RelativeRect.fromLTRB(
            details.globalPosition.dx - 200,
            details.globalPosition.dy + 4,
            details.globalPosition.dx,
            0,
          ),
          color: c.surface1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          items: [
            _item(context, c, null, value),
            for (final s in subjects) _item(context, c, s, value),
          ],
        );
        if (result != null || value != null) onChanged(result);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.line, width: 1),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(
            value != null
                ? (value!.length > 14 ? '${value!.substring(0, 13)}…' : value!)
                : 'All',
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: value != null ? c.primary : c.inkMedium),
          ),
          const SizedBox(width: 4),
          Icon(Icons.keyboard_arrow_down_rounded,
              size: 18, color: value != null ? c.primary : c.inkMuted),
        ]),
      ),
    );
  }

  PopupMenuItem<String?> _item(
      BuildContext context, AppColors c, String? subject, String? selected) {
    final isSelected = subject == selected;
    final label = subject ?? 'All';
    return PopupMenuItem<String?>(
      value: subject,
      child: Row(children: [
        Icon(isSelected ? Icons.check_rounded : Icons.circle_outlined,
            size: 16, color: isSelected ? c.primary : c.inkMuted),
        const SizedBox(width: 10),
        Flexible(
          child: Text(label,
              maxLines: 2,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? c.primary : c.inkStrong)),
        ),
      ]),
    );
  }
}
