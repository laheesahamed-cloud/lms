import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/subject_pills.dart';
import 'lesson_models.dart';
import 'lessons_repository.dart';
import '../../data/app_error.dart';

/// Lessons inside one course grouped by subject — `/app/ai-notes/course/:courseKey`.
/// Mirrors the Q-Bank `QuizCoursePage` pattern: collapsible subject sections
/// with numbered lesson rows inside each.
class LessonsCourseDetailPage extends ConsumerStatefulWidget {
  final String courseKey;
  const LessonsCourseDetailPage({super.key, required this.courseKey});

  @override
  ConsumerState<LessonsCourseDetailPage> createState() =>
      _NotesCourseDetailPageState();
}

class _NotesCourseDetailPageState
    extends ConsumerState<LessonsCourseDetailPage> {
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
    final notesAsync = ref.watch(lessonsListProvider);

    return SafeArea(
      child: notesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _backWrap(
          context,
          c,
          Text('Could not load lessons.\n${appError(e).display}',
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

          final allGroups = groupLessonsBySubject(lessons);
          final subjects = allGroups.map((g) => g.subjectName).toList();
          final groups = _subject == null
              ? allGroups
              : allGroups.where((g) => g.subjectName == _subject).toList();

          // Each row's numbered badge counts across every visible subject —
          // not reset back to 1 at the top of each subject section — so
          // scanning down the whole course reads as one continuous list
          // instead of several lists that all start over at "1".
          final sectionWidgets = <Widget>[];
          var runningIndex = 0;
          for (final g in groups) {
            sectionWidgets.add(_subjectSection(c, g, startIndex: runningIndex));
            runningIndex += g.lessons.length;
          }

          // The subject pills are a pinned sliver, as on the Q-bank, so a
          // student deep in a long course can switch subject without
          // scrolling back up.
          final showPills = subjects.length > 1;
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
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
                      Text(courseTitle,
                          style: TextStyle(
                              fontSize: 25,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong,
                              letterSpacing: -0.5,
                              height: 1.15)),
                    ],
                  ),
                ),
              ),
              if (showPills)
                SliverPersistentHeader(
                  pinned: true,
                  delegate: PinnedPillsDelegate(
                    child: SubjectPills(
                      allLabel: 'All subjects',
                      labels: subjects,
                      selected: _subject,
                      // Tapping the chosen pill again goes back to all.
                      onTap: (s) =>
                          setState(() => _subject = (s == _subject) ? null : s),
                    ),
                  ),
                ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, showPills ? 6 : 0, 16, 28),
                sliver: SliverToBoxAdapter(
                  child: lessons.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.only(top: 30),
                          child: Text('No lessons available yet.',
                              style: TextStyle(color: c.inkSoft)),
                        )
                      : AnimationLimiter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: AnimationConfiguration.toStaggeredList(
                              duration: const Duration(milliseconds: 320),
                              childAnimationBuilder: (w) => SlideAnimation(
                                verticalOffset: 20,
                                child: FadeInAnimation(child: w),
                              ),
                              children: sectionWidgets,
                            ),
                          ),
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _subjectSection(AppColors c, LessonSubjectGroup g,
      {required int startIndex}) {
    final collapsed = _collapsed.contains(g.subjectName);

    // A divider WHERE THE TOPIC CHANGES, walking the list in the order the
    // server sent it — not a bucket per topic name.
    //
    // Bucketing pulled every lesson sharing a topic back together wherever it
    // sat, so a topic placed between two other lessons in the admin collapsed
    // back to one block here and the move looked like it had done nothing.
    // Walking in order means the server's order is what shows, and a topic
    // that genuinely appears in two runs gets a heading for each.
    var globalIndex = startIndex;
    final lessonWidgets = <Widget>[];
    String? shownTopic;
    for (final lesson in g.lessons) {
      final topic = lesson.topicName;
      if (topic != shownTopic) {
        final isFirstRun = shownTopic == null;
        shownTopic = topic;
        if (topic.isNotEmpty) {
          lessonWidgets.add(_TopicDivider(label: topic, c: c));
        } else if (!isFirstRun) {
          // Lessons with no topic that FOLLOW one need a rule of their own, or
          // they read as part of the topic above them.
          lessonWidgets.add(_TopicDivider(label: '', c: c));
        }
      }
      final idx = globalIndex++;
      lessonWidgets.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: _LessonRow(lesson: lesson, index: idx),
      ));
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
        // An empty label is a deliberate case: a plain rule closing off the
        // topic above, with no text and no gaps around it.
        if (label.isNotEmpty) ...[
          const SizedBox(width: 10),
          Text(label.toUpperCase(),
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: c.inkMuted)),
          const SizedBox(width: 10),
        ],
        Expanded(child: Divider(color: c.line, thickness: 1)),
      ]),
    );
  }
}

class _LessonRow extends StatelessWidget {
  final LessonListItem lesson;
  final int index;
  const _LessonRow({required this.lesson, required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final locked = lesson.locked;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      onTap: () {
        if (locked) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(lesson.lockReason.isNotEmpty
                    ? lesson.lockReason
                    : 'This lesson is included with a subscription.')),
          );
          return;
        }
        context.push('/app/study/lesson/${lesson.canvasId}');
      },
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
                    color: locked ? c.inkSoft : c.inkStrong)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(lesson.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: locked ? c.inkSoft : c.inkStrong)),
          ),
          const SizedBox(width: 4),
          // Locked rows show only the lock; otherwise: pdf/completed badges,
          // then the chevron sits at the very end of the row.
          if (locked)
            Icon(Icons.lock_outline_rounded, size: 20, color: c.inkMuted)
          else ...[
            if (lesson.hasPdf && !lesson.hasNote)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Icon(Icons.picture_as_pdf_outlined, size: 18, color: c.inkMuted),
              ),
            if (lesson.lessonCompleted) ...[
              const _CompletedTick(),
              const SizedBox(width: 4),
            ],
            Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
          ],
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
