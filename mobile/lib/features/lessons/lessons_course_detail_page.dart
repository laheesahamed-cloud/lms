import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
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
  // Step 5 design (2026-11-15): subjects as a shelf of cards, like the Q-Bank
  // full-course series. One subject is chosen at a time and only its lessons
  // are built; the shelf starts on the subject of the lesson to continue.
  String? _subject;
  final ScrollController _shelfScroll = ScrollController();
  static const double _cardW = 112;
  static const double _cardGap = 8;
  static const double _shelfH = 124;

  @override
  void dispose() {
    _shelfScroll.dispose();
    super.dispose();
  }

  /// The lesson to continue (OPTIMIZE 10.15): the first open (not locked)
  /// lesson in the course's own order whose bit is off — finished 1, 5, 7, 10
  /// → continue 2. Worked out on the phone from the finished-lessons bitmap.
  static LessonListItem? _nextLesson(List<LessonListItem> lessons) {
    for (final l in lessons) {
      if (!l.locked && !l.lessonCompleted) return l;
    }
    return null;
  }

  Color _activeFill(BuildContext context, AppColors c) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Color.alphaBlend(
        c.primary.withValues(alpha: dark ? 0.26 : 0.14), dark ? c.card : Colors.white);
  }

  void _select(String subject, int index) {
    setState(() => _subject = subject);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_shelfScroll.hasClients) return;
      final target = (index * (_cardW + _cardGap))
          .clamp(0.0, _shelfScroll.position.maxScrollExtent)
          .toDouble();
      _shelfScroll.animateTo(target,
          duration: const Duration(milliseconds: 420), curve: Curves.easeInOutCubic);
    });
  }

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
            if (n.courseId.isNotEmpty && n.courseId == widget.courseKey) return true;
            if (n.courseId.isNotEmpty && n.courseId == decoded) return true;
            return n.courseTitle == decoded;
          }).toList();
          final courseTitle = lessons.isNotEmpty && lessons.first.courseTitle.isNotEmpty
              ? lessons.first.courseTitle
              : decoded;
          final groups = groupLessonsBySubject(lessons);
          final next = _nextLesson(lessons);
          final selected = groups.any((g) => g.subjectName == _subject)
              ? _subject!
              : (next?.subjectName ?? (groups.isNotEmpty ? groups.first.subjectName : ''));
          final group = groups.where((g) => g.subjectName == selected).toList();

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                        color: c.inkMedium,
                        onPressed: () => context.pop(),
                      ),
                      Expanded(
                        child: Text(courseTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: c.inkStrong)),
                      ),
                    ],
                  ),
                ),
              ),
              if (lessons.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 30, 16, 0),
                    child: Text('No lessons available yet.', style: TextStyle(color: c.inkSoft)),
                  ),
                )
              else ...[
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: _shelfH + 6,
                    child: ListView.separated(
                      controller: _shelfScroll,
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: groups.length,
                      separatorBuilder: (_, _) => const SizedBox(width: _cardGap),
                      itemBuilder: (context, i) => SizedBox(
                        width: _cardW,
                        height: _shelfH,
                        child: _subjectCard(c, groups[i], groups[i].subjectName == selected, i),
                      ),
                    ),
                  ),
                ),
                if (group.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: _continueCard(c, courseTitle, group.first),
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
                  sliver: SliverToBoxAdapter(
                    child: group.isEmpty ? const SizedBox.shrink() : _subjectLessons(c, group.first),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  /// Continue card (same look as the Q-Bank one): the picked subject, its next
  /// open lesson, a Continue / Start button and the subject's progress bar.
  /// Built from the lesson list already on the phone — no request.
  Widget _continueCard(AppColors c, String courseTitle, LessonSubjectGroup g) {
    final total = g.lessons.length;
    final done = g.lessons.where((l) => l.lessonCompleted).length;
    final next = _nextLesson(g.lessons);
    final p = total == 0 ? 0.0 : done / total;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _activeFill(context, c),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (courseTitle.trim().isNotEmpty)
                      Text(courseTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.inkSoft)),
                    Text(g.subjectName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
                    const SizedBox(height: 2),
                    Text(next != null ? next.title.trim() : (done >= total ? 'All lessons completed' : 'Included with a subscription'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: c.inkSoft)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              if (next != null)
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => context.push('/app/study/lesson/${next.canvasId}'),
                  child: Text(done > 0 ? 'Continue' : 'Start',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                )
              else if (done >= total)
                Icon(Icons.check_circle_rounded, color: c.success),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: p,
              minHeight: 5,
              backgroundColor: Colors.white.withValues(alpha: dark ? 0.14 : 0.75),
              valueColor: AlwaysStoppedAnimation(c.primary),
            ),
          ),
        ],
      ),
    );
  }

  /// A subject card on the shelf: progress ring, name, "x of y" done.
  Widget _subjectCard(AppColors c, LessonSubjectGroup g, bool selected, int index) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final total = g.lessons.length;
    final done = g.lessons.where((l) => l.lessonCompleted).length;
    final p = total == 0 ? 0.0 : done / total;
    final fin = total > 0 && done == total;
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            SizedBox(
              width: 38,
              height: 38,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 38,
                    height: 38,
                    child: CircularProgressIndicator(
                      value: p,
                      strokeWidth: 4,
                      strokeCap: StrokeCap.round,
                      backgroundColor: selected
                          ? Colors.white.withValues(alpha: dark ? 0.14 : 0.75)
                          : c.surface2,
                      valueColor: AlwaysStoppedAnimation(fin ? c.success : c.primary),
                    ),
                  ),
                  if (fin) Icon(Icons.check_rounded, size: 17, color: c.success),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(fin ? 'Done' : '${(p * 100).round()}%',
                  maxLines: 1,
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: c.inkStrong)),
            ),
          ],
        ),
        const Spacer(),
        Text(g.subjectName.isEmpty ? 'General' : g.subjectName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, height: 1.2, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const SizedBox(height: 2),
        Text('$done of $total', style: TextStyle(fontSize: 11.5, color: c.inkSoft)),
      ],
    );
    return GestureDetector(
      onTap: () => _select(g.subjectName, index),
      child: selected
          ? Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: _activeFill(context, c),
                borderRadius: BorderRadius.circular(AppRadius.card),
              ),
              child: body,
            )
          : GlassCard(padding: const EdgeInsets.all(11), child: body),
    );
  }

  /// The chosen subject's lessons, with a divider where the topic changes.
  Widget _subjectLessons(AppColors c, LessonSubjectGroup g) {
    final widgets = <Widget>[];
    String? shownTopic;
    var index = 0;
    for (final lesson in g.lessons) {
      final topic = lesson.topicName;
      if (topic != shownTopic) {
        final isFirstRun = shownTopic == null;
        shownTopic = topic;
        if (topic.isNotEmpty) {
          widgets.add(_TopicDivider(label: topic, c: c));
        } else if (!isFirstRun) {
          widgets.add(_TopicDivider(label: '', c: c));
        }
      }
      widgets.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: _LessonRow(lesson: lesson, index: index++),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: widgets);
  }

  Widget _backWrap(BuildContext context, AppColors c, Widget child) =>
      ListView(
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
