import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../bookmarks/bookmark_button.dart';
import 'quizzes_repository.dart';

/// One course's quiz sets — `/app/qbank/course/:courseId`.
///
/// Mirrors the web Q-Bank detail screen: a "view by" categorization dropdown
/// (All / Lesson-wise / Subject-wise / Full course-wise), per-group filter
/// chips, collapsible group sections, and numbered "Quiz N" rows.
class QuizCoursePage extends ConsumerStatefulWidget {
  final String courseId;
  final bool examMode;
  const QuizCoursePage(
      {super.key, required this.courseId, this.examMode = false});

  @override
  ConsumerState<QuizCoursePage> createState() => _QuizCoursePageState();
}

class _QuizCoursePageState extends ConsumerState<QuizCoursePage> {
  QuizScope _scope = QuizScope.all;
  String? _activeGroup; // null = show every group
  final Set<String> _collapsed = <String>{};

  bool get _exam => widget.examMode;

  void _onScopeChanged(QuizScope s) {
    setState(() {
      _scope = s;
      _activeGroup = null; // a new scope re-groups, so clear the chip filter
      _collapsed.clear();
    });
  }

  void _onChipTap(String? label) {
    setState(() {
      _activeGroup = _activeGroup == label ? null : label;
      _collapsed.clear();
    });
  }

  void _toggleCollapse(String key) {
    setState(() {
      if (_collapsed.contains(key)) {
        _collapsed.remove(key);
      } else {
        _collapsed.add(key);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
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
              .where((q) => q.courseId == widget.courseId)
              .where((q) => _exam ? true : !q.examModeOnly)
              .toList();
          final courseName =
              mine.isNotEmpty ? mine.first.courseTitle : 'Course';
          final scoped = filterQuizzesByScope(mine, _scope);
          final groups = groupQuizzesByScope(scoped, _scope, courseName);
          final visibleGroups = _activeGroup == null
              ? groups
              : groups.where((g) => g.label == _activeGroup).toList();

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
              Text(_exam ? 'EXAM SETS' : 'PRACTICE SETS',
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
                  '${groups.length} ${_scope.groupingNoun}${groups.length == 1 ? '' : 's'} · ${mine.length} ${_exam ? 'exam' : 'set'}${mine.length == 1 ? '' : 's'}',
                  style: TextStyle(fontSize: 14, color: c.inkSoft)),
              const SizedBox(height: 14),
              if (mine.isNotEmpty) _scopeBar(c),
              const SizedBox(height: 14),
              if (mine.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 30),
                  child: Text('No quiz sets in this course yet.',
                      style: TextStyle(color: c.inkSoft)),
                )
              else ...[
                if (groups.length > 1) ...[
                  _filterChips(c, groups),
                  const SizedBox(height: 14),
                ],
                if (visibleGroups.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: Text('No sets match your filters.',
                        textAlign: TextAlign.center,
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
                          for (final g in visibleGroups) _groupSection(c, g),
                        ],
                      ),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }

  /// The "view by" categorization dropdown (mirrors the web `<select>`).
  Widget _scopeBar(AppColors c) {
    return Row(
      children: [
        Icon(Icons.tune_rounded, size: 16, color: c.inkSoft),
        const SizedBox(width: 6),
        Text('View by',
            style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w700, color: c.inkSoft)),
        const Spacer(),
        Container(
          decoration: BoxDecoration(
            color: c.surface2,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(color: c.line),
          ),
          padding: const EdgeInsets.only(left: 14, right: 8),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<QuizScope>(
              value: _scope,
              isDense: true,
              borderRadius: BorderRadius.circular(AppRadius.compact),
              dropdownColor: c.cardElevated,
              icon: Icon(Icons.expand_more_rounded, color: c.inkSoft, size: 18),
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong),
              items: [
                for (final s in QuizScope.values)
                  DropdownMenuItem(
                    value: s,
                    child: Text(s.label,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ),
              ],
              onChanged: (v) {
                if (v != null) _onScopeChanged(v);
              },
            ),
          ),
        ),
      ],
    );
  }

  /// Horizontal "All {noun}s" + per-group filter chips.
  Widget _filterChips(AppColors c, List<QuizScopeGroup> groups) {
    Widget chip(String label, bool active, VoidCallback onTap) => GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: AppDur.hover,
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: active ? c.primary : c.surface2,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: active ? c.primary : c.line),
            ),
            child: Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: active ? Colors.white : c.inkMedium)),
          ),
        );

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          chip('All ${_scope.groupingNoun}s', _activeGroup == null,
              () => _onChipTap(null)),
          for (final g in groups)
            chip(g.label, _activeGroup == g.label, () => _onChipTap(g.label)),
        ],
      ),
    );
  }

  /// A collapsible group with its header and numbered quiz rows.
  Widget _groupSection(AppColors c, QuizScopeGroup g) {
    final collapsed = _collapsed.contains(g.label);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _toggleCollapse(g.label),
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
                    child: Text(g.label,
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ),
                  Text(
                      '${g.quizzes.length} ${_exam ? 'exam' : 'set'}${g.quizzes.length == 1 ? '' : 's'}',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: c.inkSoft)),
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
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity, height: 0),
            secondChild: Column(
              children: [
                for (var i = 0; i < g.quizzes.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _QuizRow(quiz: g.quizzes[i], index: i, exam: _exam),
                  ),
              ],
            ),
            crossFadeState:
                collapsed ? CrossFadeState.showFirst : CrossFadeState.showSecond,
            duration: AppDur.dropdown,
            sizeCurve: AppCurves.easeOut,
          ),
          const SizedBox(height: 6),
        ],
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

class _QuizRow extends StatelessWidget {
  final QuizListItem quiz;
  final int index;
  final bool exam;
  const _QuizRow({required this.quiz, required this.index, required this.exam});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final locked = quiz.locked;
    final label = quiz.rowLabel(index);
    final meta = '${quiz.totalQuestions} questions'
        '${exam && quiz.timeLimit > 0 ? ' · ${quiz.timeLimit} min' : ''}'
        '${quiz.isFree ? ' · Free' : ''}'
        '${quiz.isCompleted ? ' · Attempted' : ''}';

    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      onTap: () {
        if (locked) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text(
                    'This question bank is included with a subscription.')),
          );
          return;
        }
        context.push('/app/quizzes/${quiz.id}${exam ? '?exam=1' : ''}');
      },
      child: Row(
        children: [
          // Order position — the "Quiz 1, Quiz 2…" sequence number.
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: locked ? c.inkSoft : c.inkStrong)),
                const SizedBox(height: 3),
                Text(meta, style: TextStyle(fontSize: 13, color: c.inkSoft)),
              ],
            ),
          ),
          const SizedBox(width: 4),
          if (quiz.isCompleted && !locked) ...[
            const _CompletedTick(),
            const SizedBox(width: 6),
          ],
          // Locked rows show only the lock; otherwise: save button, then the
          // chevron sits at the very end of the row.
          if (locked)
            Icon(Icons.lock_outline_rounded, size: 20, color: c.inkMuted)
          else ...[
            BookmarkButton(
                itemType: 'quiz', itemId: int.tryParse(quiz.id) ?? 0),
            Icon(Icons.chevron_right, size: 20, color: c.inkMuted),
          ],
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
