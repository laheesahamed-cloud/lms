import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../bookmarks/bookmark_button.dart';
import 'quizzes_repository.dart';
import '../../widgets/page_header.dart';
import '../../data/app_error.dart';

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
  // null until the data is in, then it defaults to the first kind of set this
  // course actually has (full course, else subjects, else lessons).
  QuizScope? _scope;
  String? _seriesKey; // the selected full-course series; null = pick for them
  String? _activeGroup; // null = show every group
  final Set<String> _collapsed = <String>{};
  final ScrollController _shelfScroll = ScrollController();
  // Which series sit on the shelf, in order. Kept as it is while the student
  // works, so the cards never reshuffle under their finger; only the strip
  // scrolls.
  List<String>? _shelfKeys;

  bool get _exam => widget.examMode;

  @override
  void dispose() {
    _shelfScroll.dispose();
    super.dispose();
  }

  /// Choosing a series slides the whole row of cards to the left, together,
  /// until the chosen card is the first one in view.
  void _selectSeries(String key) {
    setState(() => _seriesKey = key);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final i = _shelfKeys?.indexOf(key) ?? -1;
      if (i < 0 || !_shelfScroll.hasClients) return;
      final target = (i * (_cardW + _cardGap))
          .clamp(0.0, _shelfScroll.position.maxScrollExtent)
          .toDouble();
      _shelfScroll.animateTo(target,
          duration: const Duration(milliseconds: 460),
          curve: Curves.easeInOutCubic);
    });
  }

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
          Text('Could not load this course.\n${appError(e).display}',
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
          // Which kinds of set this course has. The slider only offers those,
          // so a course with no lesson sets never shows an empty "Lessons".
          int countOf(QuizScope s) =>
              mine.where((q) => q.scopeKey == s.key).length;
          final available = <QuizScope>[
            // Subjects first (and so the default), then Full course.
            for (final s in const [
              QuizScope.subject,
              QuizScope.fullCourse,
              QuizScope.lesson,
            ])
              if (countOf(s) > 0) s,
          ];
          final scope = (_scope != null && available.contains(_scope))
              ? _scope!
              : (available.isNotEmpty ? available.first : QuizScope.subject);
          final isFull = scope == QuizScope.fullCourse;
          final scoped = filterQuizzesByScope(mine, scope);
          final series = isFull ? _buildSeries(scoped) : const <_Series>[];
          final groups = isFull
              ? const <QuizScopeGroup>[]
              : groupQuizzesByScope(scoped, scope, courseName);
          final visibleGroups = _activeGroup == null
              ? groups
              : groups.where((g) => g.label == _activeGroup).toList();

          // The filter chips are a pinned sliver, so they stay on screen while
          // the sets scroll underneath — a student deep in a long list can
          // switch subject without scrolling back to the top.
          final showChips = !isFull && mine.isNotEmpty && groups.length > 1;
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                  child: PageHeader(title: courseName),
                ),
              ),
              if (available.length > 1)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: _scopeSlider(c, available, scope, countOf),
                  ),
                ),
              if (showChips)
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _PinnedChipsDelegate(
                    child: _filterChips(c, groups, scope),
                  ),
                ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, showChips ? 6 : 0, 16, 28),
                sliver: SliverToBoxAdapter(
                  child: mine.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.only(top: 30),
                          child: Text('No quiz sets in this course yet.',
                              style: TextStyle(color: c.inkSoft)),
                        )
                      : isFull
                          ? _fullCourseView(c, series)
                      : visibleGroups.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.only(top: 24),
                              child: Text('No sets match your filters.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: c.inkSoft)),
                            )
                          : AnimationLimiter(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children:
                                    AnimationConfiguration.toStaggeredList(
                                  duration: const Duration(milliseconds: 320),
                                  childAnimationBuilder: (w) => SlideAnimation(
                                    verticalOffset: 20,
                                    child: FadeInAnimation(child: w),
                                  ),
                                  children: [
                                    for (final g in visibleGroups)
                                      _groupSection(c, g),
                                  ],
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

  /// The Full course / Subjects / Lessons slider. Only the kinds of set this
  /// course really has are offered.
  Widget _scopeSlider(AppColors c, List<QuizScope> available, QuizScope current,
      int Function(QuizScope) countOf) {
    String labelOf(QuizScope s) => switch (s) {
          QuizScope.fullCourse => 'Full course',
          QuizScope.subject => 'Subjects',
          QuizScope.lesson => 'Lessons',
          QuizScope.all => 'All',
        };
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (final s in available)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _onScopeChanged(s),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: s == current ? c.card : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                        color: s == current ? c.lineMedium : Colors.transparent),
                  ),
                  alignment: Alignment.center,
                  child: Text.rich(
                    TextSpan(
                      text: labelOf(s),
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: s == current ? c.inkStrong : c.inkSoft,
                      ),
                      children: [
                        TextSpan(
                          text: '  ${countOf(s)}',
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: c.inkMuted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ---- Full course: series shelf + continue card + the selected series ----

  _Series _selectedSeries(List<_Series> series) {
    for (final s in series) {
      if (s.key == _seriesKey) return s;
    }
    // Nothing chosen yet: start the student where they left off.
    return series.firstWhere((s) => s.status == _SeriesStatus.inProgress,
        orElse: () => series.firstWhere(
            (s) => s.status == _SeriesStatus.notStarted,
            orElse: () => series.first));
  }

  /// A short shelf however many series there are: the open one first, then
  /// the ones in progress, then the next ones to start. Finished series stay
  /// off it; the "All series" card still reaches every one. The order is
  /// fixed once chosen, and a series picked from the full list is added to
  /// the end so there is a card to slide to.
  List<_Series> _shelf(List<_Series> series, _Series sel) {
    final byKey = {for (final s in series) s.key: s};
    var keys = _shelfKeys;
    if (keys == null || keys.any((k) => !byKey.containsKey(k))) {
      keys = [
        sel.key,
        ...series
            .where((s) => s != sel && s.status == _SeriesStatus.inProgress)
            .map((s) => s.key),
        ...series
            .where((s) => s != sel && s.status == _SeriesStatus.notStarted)
            .map((s) => s.key),
      ].take(6).toList();
    }
    if (!keys.contains(sel.key)) keys = [...keys, sel.key];
    _shelfKeys = keys;
    return [for (final k in keys) byKey[k]!];
  }

  static const double _cardW = 112;
  static const double _cardGap = 8;
  static const double _shelfH = 132;
  static const double _allW = 100;

  /// The solid, opaque "active" colour: a light wash of the brand colour laid
  /// over the card colour, so it reads as a filled card, not an outline.
  Color _activeFill(BuildContext context, AppColors c) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Color.alphaBlend(
        c.primary.withValues(alpha: dark ? 0.26 : 0.14), dark ? c.card : Colors.white);
  }

  Widget _fullCourseView(AppColors c, List<_Series> series) {
    if (series.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Text('No full-course sets yet.',
            textAlign: TextAlign.center, style: TextStyle(color: c.inkSoft)),
      );
    }
    final sel = _selectedSeries(series);
    final shelf = _shelf(series, sel);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (context, box) {
            // Enough empty space after the last card that any card, even the
            // last, can slide all the way to the left edge.
            final trailing = (box.maxWidth - _cardW - _cardGap - _allW)
                .clamp(0.0, double.infinity)
                .toDouble();
            return SizedBox(
              height: _shelfH + 6,
              child: SingleChildScrollView(
                controller: _shelfScroll,
                scrollDirection: Axis.horizontal,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final s in shelf)
                      Padding(
                        padding: const EdgeInsets.only(right: _cardGap),
                        child: SizedBox(
                          width: _cardW,
                          height: _shelfH,
                          child: _ringCard(c, s, s == sel),
                        ),
                      ),
                    SizedBox(
                      width: _allW,
                      height: _shelfH,
                      child: _allSeriesCard(c, series, sel),
                    ),
                    SizedBox(width: trailing),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        _continueCard(c, sel),
        const SizedBox(height: 12),
        for (var i = 0; i < sel.sets.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _QuizRow(quiz: sel.sets[i], index: i, exam: _exam),
          ),
      ],
    );
  }

  Widget _ringCard(AppColors c, _Series s, bool selected) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final p = s.total == 0 ? 0.0 : s.done / s.total;
    final fin = s.status == _SeriesStatus.done;
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
                      valueColor:
                          AlwaysStoppedAnimation(fin ? c.success : c.primary),
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
                  style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
            ),
          ],
        ),
        const Spacer(),
        if (s.prefix.isNotEmpty)
          Text(s.prefix,
              maxLines: 1,
              style: TextStyle(
                  fontSize: 11,
                  height: 1.1,
                  fontWeight: FontWeight.w700,
                  color: c.inkSoft)),
        Text(s.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 12.5,
                height: 1.2,
                fontWeight: FontWeight.w800,
                color: c.inkStrong)),
        const SizedBox(height: 2),
        Text('${s.done} of ${s.total}',
            style: TextStyle(fontSize: 11.5, color: c.inkSoft)),
      ],
    );

    // Not chosen: the same GlassCard the rest of the app uses. Chosen: the
    // same shape filled with the solid active colour, with no border or stroke.
    return GestureDetector(
      onTap: () => _selectSeries(s.key),
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

  Widget _allSeriesCard(AppColors c, List<_Series> series, _Series sel) {
    return GlassCard(
      padding: const EdgeInsets.all(11),
      onTap: () async {
        final picked = await Navigator.of(context).push<String>(
          MaterialPageRoute(
            builder: (_) => _SeriesPicker(series: series, selectedKey: sel.key),
          ),
        );
        if (picked != null && mounted) _selectSeries(picked);
      },
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.apps_rounded, size: 26, color: c.inkMedium),
          const SizedBox(height: 6),
          Text('All series',
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
          Text('${series.length} total',
              style: TextStyle(fontSize: 11.5, color: c.inkSoft)),
        ],
      ),
    );
  }

  Widget _continueCard(AppColors c, _Series s) {
    final next = s.next;
    final p = s.total == 0 ? 0.0 : s.done / s.total;
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
                    if (s.prefix.isNotEmpty)
                      Text(s.prefix,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: c.inkSoft)),
                    Text(s.name,
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                    const SizedBox(height: 2),
                    // The set that comes next, by its own name, instead of a
                    // "0 of 15 done" count (the cards already show the count).
                    Text(next != null ? next.title.trim() : 'All sets completed',
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
                    padding:
                        const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => _openQuiz(context, next, _exam),
                  child: Text(s.done > 0 ? 'Continue' : 'Start',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                )
              else
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

  /// Horizontal "All {noun}s" + per-group filter chips.
  Widget _filterChips(AppColors c, List<QuizScopeGroup> groups, QuizScope scope) {
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
          chip('All ${scope.groupingNoun}s', _activeGroup == null,
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _groupRows(c, g),
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

  /// The quizzes inside one section, with a topic divider wherever the topic
  /// changes — the same shape the Lessons course page uses, so a subject reads
  /// the same way in both places.
  ///
  /// The numbering runs straight through the section rather than restarting at
  /// each topic, so scanning the whole subject reads as one list.
  List<Widget> _groupRows(AppColors c, QuizScopeGroup g) {
    // Which field actually holds the topic depends on the server build. The
    // list endpoint had topicName reading the SUBJECT's name, so it came back
    // a duplicate of subjectName and was useless to group on; subtopicName
    // carries the real one. Reading subtopic first works against both the old
    // server and the fixed one, and the topicName fallback is ignored when it
    // is still just the subject repeated.
    String topicOf(QuizListItem q) {
      final sub = q.subtopicName.trim();
      if (sub.isNotEmpty) return sub;
      final t = q.topicName.trim();
      return t == q.subjectName.trim() ? '' : t;
    }

    final order = <String>[];
    final byTopic = <String, List<QuizListItem>>{};
    for (final q in g.quizzes) {
      final key = topicOf(q);
      if (!byTopic.containsKey(key)) {
        order.add(key);
        byTopic[key] = [];
      }
      byTopic[key]!.add(q);
    }

    final rows = <Widget>[];
    for (final key in order) {
      // Restarts at every heading. Running straight through made the chip
      // disagree with the row beside it — "3" next to "Quiz 1" — now that the
      // topics are visibly separate groups.
      var index = 0;
      // Nothing to separate when there is only one topic and it is what the
      // section is already called.
      if (key.isNotEmpty && !(order.length == 1 && key == g.label)) {
        rows.add(_TopicDivider(label: key, c: c));
      }
      for (final quiz in byTopic[key]!) {
        rows.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _QuizRow(quiz: quiz, index: index++, exam: _exam),
        ));
      }
    }
    return rows;
  }

  Widget _back(BuildContext context, AppColors c, Widget child) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          const PageHeader(title: 'Q-Bank'),
          Padding(padding: const EdgeInsets.all(24), child: child),
        ],
      );
}

/// The topic a run of quizzes belongs to. Just the label: flanking rules left
/// it a narrow column in the middle of the row, which broke long names across
/// lines mid-word ("UROGYNAECOLOG / Y").
class _TopicDivider extends StatelessWidget {
  final String label;
  final AppColors c;
  const _TopicDivider({required this.label, required this.c});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 10, left: 2),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10.5,
          height: 1.35,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
          color: c.inkMuted,
        ),
      ),
    );
  }
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

/// Holds the subject filter chips at the top of the screen while the sets
/// scroll beneath. Painted on the page colour, with a hairline that appears
/// once content is actually sliding under it.
class _PinnedChipsDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  const _PinnedChipsDelegate({required this.child});

  static const double _height = 56;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    final c = context.c;
    return Container(
      height: _height,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: c.page,
        border: Border(
          bottom: BorderSide(
            color: overlapsContent ? c.line : Colors.transparent,
          ),
        ),
      ),
      child: child,
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedChipsDelegate oldDelegate) => true;
}


// ---------------------------------------------------------------------------
// Full-course series.
//
// The full-course sets are named "<series> - <number>" ("Revision paper - 4"),
// so a series is simply the title without its trailing number. Series appear
// on their own when new sets are added; nothing has to be set up in the admin.
// ---------------------------------------------------------------------------

enum _SeriesStatus { notStarted, inProgress, done }

class _Series {
  final String key;
  final String name;
  final List<QuizListItem> sets;
  // The word every series shares ("Medicine"), shown small above the name.
  final String prefix;
  const _Series(this.key, this.name, this.sets, {this.prefix = ''});

  String get fullName => prefix.isEmpty ? name : '$prefix $name';

  int get total => sets.length;
  int get done => sets.where((q) => q.isCompleted).length;

  QuizListItem? get next {
    for (final q in sets) {
      if (!q.isCompleted) return q;
    }
    return null;
  }

  _SeriesStatus get status => done == 0
      ? _SeriesStatus.notStarted
      : done >= total
          ? _SeriesStatus.done
          : _SeriesStatus.inProgress;
}

final _seriesTail = RegExp(r'\s*[-–—:]*\s*\d+\s*$');

String _capital(String s) =>
    s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// "Revision paper" -> "Revision papers": a series holds many sets, so its
/// name reads as a plural.
String _plural(String s) {
  final t = s.trim();
  if (t.isEmpty) return t;
  final lw = t.toLowerCase();
  if (lw.endsWith('s')) return t;
  if (lw.length > 1 &&
      lw.endsWith('y') &&
      !'aeiou'.contains(lw[lw.length - 2])) {
    return '${t.substring(0, t.length - 1)}ies';
  }
  if (lw.endsWith('ch') || lw.endsWith('sh') || lw.endsWith('x') || lw.endsWith('z')) {
    return '${t}es';
  }
  return '${t}s';
}

List<_Series> _buildSeries(List<QuizListItem> general) {
  final order = <String>[];
  final names = <String, String>{};
  final map = <String, List<QuizListItem>>{};
  // sortQuizzesByHierarchy sorts numerically, so "- 2" comes before "- 10".
  for (final q in sortQuizzesByHierarchy(general)) {
    var base = q.title.trim().replaceFirst(_seriesTail, '').trim();
    if (base.isEmpty) base = 'Other';
    final key = base.toLowerCase();
    if (!map.containsKey(key)) {
      order.add(key);
      names[key] = base;
      map[key] = [];
    }
    map[key]!.add(q);
  }

  // When every series starts with the same word (the course name, as in
  // "Medicine paper", "Medicine mock paper"), drop it from the label.
  var strip = false;
  if (order.length > 1) {
    final firsts = order.map((k) {
      final parts = names[k]!.split(RegExp(r'\s+'));
      return parts.length > 1 ? parts.first.toLowerCase() : '';
    }).toSet();
    strip = firsts.length == 1 && firsts.first.isNotEmpty;
  }

  final prefix = strip
      ? _capital(names[order.first]!.split(RegExp(r'\s+')).first)
      : '';

  return [
    for (final k in order)
      _Series(
        k,
        _capital(_plural(strip
            ? names[k]!.split(RegExp(r'\s+')).skip(1).join(' ')
            : names[k]!)),
        map[k]!,
        prefix: prefix,
      ),
  ];
}

/// Opens one set, with the same locked check the rows use.
void _openQuiz(BuildContext context, QuizListItem quiz, bool exam) {
  if (quiz.locked) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          content: Text('This question bank is included with a subscription.')),
    );
    return;
  }
  context.push('/app/quizzes/${quiz.id}${exam ? '?exam=1' : ''}');
}

/// The "All series" page: search, filters, and every series with its ring.
/// It opens as a normal page from the shelf's last card, not as a popup.
class _SeriesPicker extends StatefulWidget {
  final List<_Series> series;
  final String selectedKey;
  const _SeriesPicker({required this.series, required this.selectedKey});

  @override
  State<_SeriesPicker> createState() => _SeriesPickerState();
}

class _SeriesPickerState extends State<_SeriesPicker> {
  _SeriesStatus? _filter; // null = all
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final words = _query
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    final rank = {
      _SeriesStatus.inProgress: 0,
      _SeriesStatus.notStarted: 1,
      _SeriesStatus.done: 2,
    };
    final list = widget.series.where((s) {
      if (_filter != null && s.status != _filter) return false;
      final n = s.fullName.toLowerCase();
      return words.every(n.contains);
    }).toList()
      ..sort((a, b) => rank[a.status]!.compareTo(rank[b.status]!));

    Widget chip(String label, _SeriesStatus? f) {
      final on = _filter == f;
      return GestureDetector(
        onTap: () => setState(() => _filter = f),
        child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: on ? c.primary : c.surface2,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: on ? c.primary : c.line),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: on ? Colors.white : c.inkMedium)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: PageHeader(title: 'All series (${widget.series.length})'),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                  hintText: 'Search series',
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  isDense: true,
                  filled: true,
                  fillColor: c.surface2,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: c.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: c.line),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    chip('All', null),
                    chip('In progress', _SeriesStatus.inProgress),
                    chip('Not started', _SeriesStatus.notStarted),
                    chip('Done', _SeriesStatus.done),
                  ],
                ),
              ),
            ),
            Expanded(
              child: list.isEmpty
                  ? Center(
                      child: Text('No series match.',
                          style: TextStyle(color: c.inkSoft)))
                  : ListView.builder(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemCount: list.length,
                      itemBuilder: (_, i) {
                        final s = list[i];
                        final p = s.total == 0 ? 0.0 : s.done / s.total;
                        final fin = s.status == _SeriesStatus.done;
                        return InkWell(
                          onTap: () => Navigator.of(context).pop(s.key),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            decoration: BoxDecoration(
                              border: Border(top: BorderSide(color: c.line)),
                            ),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 32,
                                  height: 32,
                                  child: CircularProgressIndicator(
                                    value: p,
                                    strokeWidth: 3.5,
                                    strokeCap: StrokeCap.round,
                                    backgroundColor: c.surface2,
                                    valueColor: AlwaysStoppedAnimation(
                                        fin ? c.success : c.primary),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(s.fullName,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: c.inkStrong)),
                                      Text('${s.done} of ${s.total} done',
                                          style: TextStyle(
                                              fontSize: 12.5, color: c.inkSoft)),
                                    ],
                                  ),
                                ),
                                if (s.key == widget.selectedKey)
                                  Text('Selected',
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: c.primary))
                                else if (fin)
                                  Icon(Icons.check_circle_rounded,
                                      size: 20, color: c.success),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
