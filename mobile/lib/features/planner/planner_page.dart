import 'dart:async';
import 'dart:ui' show lerpDouble;

import 'package:flutter/cupertino.dart' show CupertinoPageRoute;
import 'package:flutter/material.dart';
import 'package:dio/dio.dart' show DioException;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../services/study_reminders.dart';
import 'add_task_page.dart';
import 'generate_plan_page.dart';
import 'planner_repository.dart';
import '../flashcards/flashcards_repository.dart';
import '../lessons/lessons_repository.dart';
import '../quizzes/quizzes_repository.dart';
import '../subscriptions/paywall_sheet.dart';
import '../subscriptions/subscriptions_repository.dart';
import '../../widgets/page_header.dart';
import '../../widgets/shell_insets.dart';
import '../../data/api_client.dart';
import '../../data/app_error.dart';
import '../../state/saved_first.dart';
import '../../widgets/adaptive_sheet.dart';
import '../../widgets/status_tick.dart';
import '../../widgets/time_wheel.dart';

class PlannerPage extends ConsumerStatefulWidget {
  const PlannerPage({super.key});

  @override
  ConsumerState<PlannerPage> createState() => _PlannerPageState();
}

class _PlannerPageState extends ConsumerState<PlannerPage> {
  String _lastSig = '';

  // Ids created by the last "Generate plan" run, badged "NEW" until the
  // student acts on them — session-only, not persisted.
  final Set<int> _newTaskIds = {};

  // Branch labels (day or subject) the student has collapsed — session-only.
  final Set<String> _collapsedBranches = {};
  // Set once a big plan has had its far-off days folded (see _buildBranches).
  bool _branchesSeeded = false;

  // True while a confirmed "Reset" is playing its staggered exit animation
  // and clearing tasks server-side — drives the reset button's spinner.
  bool _resetting = false;
  // True while the server is still deleting after the page has folded away.
  bool _clearing = false;
  int _clearDone = 0, _clearTotal = 0;


  /// Re-schedule reminders only when the task set actually changed (web-style
  /// reconcile: cancel our prior batch, reschedule from prefs + tasks).
  // True from the end of the fold until the server has really finished
  // clearing: the planner shows its empty state at once instead of waiting on
  // every delete.
  bool _clearedLocally = false;

  void _maybeReconcile(List<PlannerTask> tasks) {
    final sig = tasks.map((t) => '${t.id}:${t.status}:${t.dueDate}').join('|');
    if (sig == _lastSig) return;
    _lastSig = sig;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      StudyReminders.reconcile(tasks);
    });
  }

  /// A task tied to a real lesson or quiz is done when THAT is done, read from
  /// the lessons and Q-bank lists the app already holds. They are loaded once,
  /// kept for every screen, and refreshed whenever a lesson is completed or an
  /// exam submitted, so the planner asks the server for nothing extra and can
  /// never disagree with the Lessons or Q-bank screens.
  ///
  /// A list is only read when the planner actually has a task of that kind, and
  /// while one is still loading the server's own status stands in.
  List<PlannerTask> _withRealStatus(List<PlannerTask> raw, {bool watch = true}) {
    // From build the lists are watched; from a tap handler they are only read.
    T pick<T>(ProviderListenable<T> p) => watch ? ref.watch(p) : ref.read(p);
    final lessons = raw.any((t) => t.itemType == 'lesson')
        ? pick(lessonsListProvider).value
        : null;
    // A Q-bank set is done only once it has been PASSED as an exam. Practice
    // runs, and exams that were not passed, leave the task open.
    final outcomes = raw.any((t) => t.itemType == 'quiz')
        ? pick(quizOutcomesProvider)
        : null;
    final doneLessons = lessons == null
        ? null
        : {for (final l in lessons) if (l.lessonCompleted && l.lessonId.isNotEmpty) l.lessonId};

    // A deck is done when nothing in it is new, learning or due.
    final decks = raw.any((t) => t.itemType == 'flashcards')
        ? pick(flashDecksProvider).value
        : null;
    final deckLeft = decks == null ? null : _cardsLeftByNote(decks.decks);

    return [
      for (final t in raw)
        if (t.itemType == 'lesson' && doneLessons != null)
          t.withStatus(doneLessons.contains('${t.itemId}') ? 'done' : 'todo')
        else if (t.itemType == 'quiz' && outcomes != null)
          // Passed = done (green tick). Attempted but not passed = still open,
          // marked for a retry (amber). Never attempted = open, no mark.
          (outcomes[t.itemId]?.passed ?? false)
              ? t.withStatus('done')
              : t.withStatus('todo', retry: outcomes.containsKey(t.itemId))
        else if (t.itemType == 'flashcards' && deckLeft != null && deckLeft.containsKey(t.itemId))
          t.withStatus(deckLeft[t.itemId] == 0 ? 'done' : 'todo')
        else
          t,
    ];
  }

  /// For each note, how many cards are still new, learning or due in the
  /// lesson-level deck that holds it.
  Map<int, int> _cardsLeftByNote(List<DeckNode> roots) {
    final left = <int, int>{};
    void walk(DeckNode n) {
      if (n.type == 'lesson') {
        final remaining = n.newCount + n.learningCount + n.dueCount;
        for (final id in n.noteIds) {
          left[id] = remaining;
        }
      }
      for (final child in n.children) {
        walk(child);
      }
    }

    for (final root in roots) {
      walk(root);
    }
    return left;
  }

  DeckNode? _deckForNote(int noteId) {
    DeckNode? found;
    void walk(DeckNode n) {
      if (found != null) return;
      if (n.type == 'lesson' && n.noteIds.contains(noteId)) {
        found = n;
        return;
      }
      for (final child in n.children) {
        walk(child);
      }
    }

    for (final root in ref.read(flashDecksProvider).value?.decks ?? const <DeckNode>[]) {
      walk(root);
    }
    return found;
  }

  /// A Q-bank task asks how to take the set. Only PASSING it as an exam
  /// completes the task; practice is for learning and counts for nothing here.
  Future<void> _openQuiz(PlannerTask t) async {
    QuizListItem? quiz;
    for (final q in ref.read(quizListProvider).value ?? const <QuizListItem>[]) {
      if (q.id == '${t.itemId}') quiz = q;
    }
    final canPractice = quiz?.canPractice ?? true;
    final mode = await showAdaptiveSheet<String>(
      context: context,
      useRootNavigator: true,
      backgroundColor: context.c.page,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        final c = ctx.c;
        Widget option(String value, IconData icon, String title, String sub) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => Navigator.of(ctx).pop(value),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: c.line),
                  ),
                  child: Row(
                    children: [
                      Icon(icon, color: c.primary, size: 26),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title,
                                style: TextStyle(
                                    fontSize: 15.5,
                                    fontWeight: FontWeight.w800,
                                    color: c.inkStrong)),
                            const SizedBox(height: 2),
                            Text(sub,
                                style: TextStyle(fontSize: 13, color: c.inkSoft)),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: c.inkMuted),
                    ],
                  ),
                ),
              ),
            );
        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(t.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
                const SizedBox(height: 4),
                Text('How do you want to take it?',
                    style: TextStyle(fontSize: 13, color: c.inkSoft)),
                const SizedBox(height: 14),
                if (canPractice)
                  option('practice', Icons.menu_book_rounded, 'Practice',
                      'See answers as you go. Does not complete this task.'),
                option('exam', Icons.timer_outlined, 'Exam',
                    'Timed and marked. Pass it to complete this task.'),
              ],
            ),
          ),
        );
      },
    );
    if (mode == null || !mounted) return;
    context.push('/app/quizzes/${t.itemId}${mode == 'exam' ? '?exam=1' : ''}');
  }

  /// Opens the lesson, quiz or flashcard deck a linked task stands for.
  void _openLinked(PlannerTask t) {
    if (!t.isLinked) return;
    switch (t.itemType) {
      case 'lesson':
        context.push('/app/study/lesson/${t.itemId}');
      case 'quiz':
        _openQuiz(t);
      case 'flashcards':
        final deck = _deckForNote(t.itemId!);
        if (deck == null) {
          context.push('/app/flashcards'); // the decks list, if the deck is gone
        } else {
          context.push(
              '/app/flashcards/review?notes=${deck.noteIds.join(',')}&title=${Uri.encodeComponent(deck.label)}');
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tasksAsync = ref.watch(plannerTasksProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: tasksAsync.when(
          // Every change invalidates this list (a task added, a plan made, the
          // planner cleared). Without this each one swapped the whole planner
          // for a full-screen spinner until the reload landed; the old list now
          // stays up and updates in place.
          skipLoadingOnReload: true,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load your planner.\n${appError(e).display}',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.inkSoft, fontSize: 14)),
            ),
          ),
          data: (rawTasks) {
            final tasks = _clearedLocally ? const <PlannerTask>[] : _withRealStatus(rawTasks);
            if (tasks.isEmpty) _branchesSeeded = false; // a new plan folds afresh
            _maybeReconcile(tasks);
            return Stack(
              children: [
                _mindMap(c, tasks),
                Positioned.fill(
                  child: IgnorePointer(
                    ignoring: !_clearing,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: _clearing
                          ? _clearOverlay(c)
                          : const SizedBox.shrink(),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // ── Layout: a central progress hub branching into day (or subject) groups,
  // each branching into swipe-to-complete, shape-identified task cards. ──
  Widget _mindMap(AppColors c, List<PlannerTask> tasks) {
    // Watched, not stored: billingProvider is kept alive across pages. The PRO
    // marker shows only once billing is KNOWN and the student is not paid.
    // While it is still loading (or failed with nothing cached) the marker stays
    // hidden: reading "unknown" as "not paid" made it flash for every
    // subscriber on each open, then vanish when the answer arrived. `.value`
    // also keeps the last answer during a refresh, so a refresh after the app
    // resumes does not bring the flash back. The real gate is _ensureSubscribed.
    final billing = ref.watch(billingProvider);
    final showPro =
        billing.hasValue && billing.value?.current?.isPaid != true;
    final total = tasks.length;
    final doneCount = tasks.where((t) => t.done).length;

    // Tasks with a due date branch by day (chronological); tasks with none
    // branch by COURSE (the generator encodes "Course · Subject" into
    // task.description) so Cardiology and Gynaecology quizzes both land
    // under one "Medicine" branch instead of a separate small branch per
    // subject — a "By subject" generated plan reads as organized by course,
    // not fragmented into every individual topic.
    final byDate = <DateTime, List<PlannerTask>>{};
    final bySubject = <String, List<PlannerTask>>{};
    for (final t in tasks) {
      final d = t.due;
      if (d != null) {
        byDate.putIfAbsent(d, () => []).add(t);
      } else {
        final key = _courseKey(t.description);
        bySubject.putIfAbsent(key, () => []).add(t);
      }
    }
    // Oldest first inside every branch. A plan saves its tasks in lesson order,
    // so id order IS that order. The server returns a day newest-first, which
    // put the first lesson of the day last.
    for (final list in byDate.values) {
      list.sort((a, b) => a.id.compareTo(b.id));
    }
    for (final list in bySubject.values) {
      list.sort((a, b) => a.id.compareTo(b.id));
    }
    final foldStep = _foldStepMs(total);
    final sortedDates = byDate.keys.toList()..sort();
    final sortedSubjects = bySubject.keys.toList()..sort();

    return RefreshIndicator(
      onRefresh: () async {
        freshNext('planner');
        freshNext('lessons');
        freshNext('quizzes');
        ref.invalidate(lessonsListProvider);
        ref.invalidate(quizListProvider);
        ref.invalidate(plannerTasksProvider);
        await ref.read(plannerTasksProvider.future);
      },
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, 14, 16, shellScrollEnd(context)),
        children: [
          PageHeader(
            title: 'Planner',
            actions: [
              IconButton(
                tooltip: 'Reminders',
                onPressed: () => _showReminderSettings(tasks),
                icon: Icon(Icons.notifications_outlined, color: c.inkMedium),
              ),
              if (tasks.isNotEmpty)
                IconButton(
                  tooltip: 'Clear all tasks',
                  onPressed: _resetting ? null : _confirmReset,
                  icon: _resetting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.4, color: Color(0xFFDC2626)),
                        )
                      // A bin, not a refresh arrow: a red reload icon read as
                      // "reload" and sat one tap from deleting everything.
                      : const Icon(Icons.delete_sweep_rounded, color: Color(0xFFDC2626)),
                ),
              // Was a FloatingActionButton, which the glass tab bar now sits
              // under — and the page's own primary action belongs with its
              // title rather than floating over its content.
              IconButton(
                tooltip: 'New task',
                onPressed: _showAddSheet,
                icon: Icon(Icons.add_rounded, size: 24, color: c.primary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GlassCard(
            onTap: _generatePlan,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: c.primary.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.auto_awesome_rounded, size: 20, color: c.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Generate study plan',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
                      const SizedBox(height: 2),
                      Text('Fill your planner from what\'s left to study',
                          style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
                    ],
                  ),
                ),
                // Says it is paid BEFORE the tap. A feature that looks free
                // and then opens a paywall reads as a trick; a marker on the
                // card is the honest version of the same gate.
                if (showPro)
                  Container(
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: c.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('PRO',
                        style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: c.primary)),
                  ),
                Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
              ],
            ),
          ),
          const SizedBox(height: 22),
          if (tasks.isEmpty)
            _emptyState(c)
          else ...[
            // The ring and its percentage fold away with everything else, last,
            // once the tasks below it have gone.
            _FoldUp(
              exiting: _resetting,
              delayMs: (total + 1) * foldStep,
              child: Column(children: [_hub(c, total, doneCount), _stem(c)]),
            ),
            ..._buildBranches(c, sortedDates, byDate, sortedSubjects, bySubject, total, foldStep),
          ],
        ],
      ),
    );
  }

  // Threads one running index across every branch so the reset animation's
  // stagger flows as a single wave down the whole page, not a separate
  // little wave restarting inside each branch.
  List<Widget> _buildBranches(
    AppColors c,
    List<DateTime> sortedDates,
    Map<DateTime, List<PlannerTask>> byDate,
    List<String> sortedSubjects,
    Map<String, List<PlannerTask>> bySubject,
    int total,
    int foldStep,
  ) {
    final branches = <Widget>[];
    // A plan over a whole course is thousands of cards; building them all at
    // once is what made the planner slow to open. Show the days that matter
    // (anything overdue and not finished, then the next few) and leave the rest
    // folded until tapped. A small plan is left fully open.
    if (!_branchesSeeded && total > 40) {
      _branchesSeeded = true;
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      var openAhead = 0;
      for (final d in sortedDates) {
        final tasks = byDate[d]!;
        final bool keepOpen;
        if (d.isBefore(today)) {
          keepOpen = tasks.any((t) => !t.done);
        } else {
          keepOpen = openAhead < 4;
          if (keepOpen) openAhead++;
        }
        if (!keepOpen) _collapsedBranches.add(_dayLabel(d));
      }
      for (var i = 2; i < sortedSubjects.length; i++) {
        _collapsedBranches.add(sortedSubjects[i]);
      }
    }
    var index = 0;
    for (final d in sortedDates) {
      final tasks = byDate[d]!;
      branches.add(_branch(c, _dayLabel(d), tasks, startIndex: index, total: total, foldStep: foldStep));
      index += tasks.length;
    }
    for (final s in sortedSubjects) {
      final tasks = bySubject[s]!;
      branches.add(_branch(c, s, tasks, startIndex: index, total: total, foldStep: foldStep));
      index += tasks.length;
    }
    return branches;
  }

  Widget _emptyState(AppColors c) => Padding(
        padding: const EdgeInsets.only(top: 50),
        child: Column(
          children: [
            Icon(Icons.event_available_rounded, size: 46, color: c.inkMuted),
            const SizedBox(height: 12),
            Text('All clear',
                style:
                    TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: 6),
            Text('Generate a plan or add a task to get started.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, color: c.inkSoft)),
          ],
        ),
      );

  Widget _hub(AppColors c, int total, int doneCount) {
    final pct = total == 0 ? 0.0 : doneCount / total;
    return Center(
      child: Column(
        children: [
          SizedBox(
            width: 96,
            height: 96,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 96,
                  height: 96,
                  child: CircularProgressIndicator(
                    value: 1,
                    strokeWidth: 8,
                    color: c.line,
                  ),
                ),
                SizedBox(
                  width: 96,
                  height: 96,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: pct),
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOutCubic,
                    builder: (_, v, _) => CircularProgressIndicator(
                      value: v,
                      strokeWidth: 8,
                      backgroundColor: Colors.transparent,
                      valueColor: AlwaysStoppedAnimation(c.primary),
                      strokeCap: StrokeCap.round,
                    ),
                  ),
                ),
                Text('${(pct * 100).round()}%',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w800, color: c.inkStrong)),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text('$doneCount of $total complete',
              style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
        ],
      ),
    );
  }

  Widget _stem(AppColors c) => Center(
        child: Container(width: 2, height: 16, color: c.line),
      );

  Widget _branch(AppColors c, String label, List<PlannerTask> tasks,
      {required int startIndex, required int total, required int foldStep}) {
    final done = tasks.where((t) => t.done).length;
    // Folds after its own tasks have gone (they go bottom-first).
    final headerDelay = (total - startIndex) * foldStep;
    final collapsed = _collapsedBranches.contains(label);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          _FoldUp(
            exiting: _resetting,
            delayMs: headerDelay,
            child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() {
              if (collapsed) {
                _collapsedBranches.remove(label);
              } else {
                _collapsedBranches.add(label);
              }
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: c.cardElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.line),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Column(
                    children: [
                      Text(label,
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w800, color: c.inkStrong)),
                      Text('$done of ${tasks.length} done',
                          style: TextStyle(fontSize: 10.5, color: c.inkMuted)),
                    ],
                  ),
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    turns: collapsed ? -0.25 : 0,
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    child: Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: c.inkMuted),
                  ),
                ],
              ),
            ),
          )),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: collapsed
                ? const SizedBox(width: double.infinity)
                : Column(
                    children: [
                      _FoldUp(
                        exiting: _resetting,
                        delayMs: headerDelay,
                        child: Container(width: 2, height: 12, color: c.line),
                      ),
                      // No leading connector tick here — it used to sit before
                      // the card as a sibling in a Row, which ate 18px of
                      // width from the LEFT only (nothing matching on the
                      // right), pushing every card's content visibly off
                      // center. The card now takes the full row width,
                      // symmetric with the branch pill above it.
                      for (var i = 0; i < tasks.length; i++)
                        _FoldUp(
                          exiting: _resetting,
                          delayMs: (total - 1 - (startIndex + i)) * foldStep,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 9),
                            child: _SwipeIdentityCard(
                              key: ValueKey(tasks[i].id),
                              task: tasks[i],
                              isNew: _newTaskIds.contains(tasks[i].id) ||
                                  (tasks[i].ruleId != null && _newTaskIds.contains(tasks[i].ruleId)),
                              onComplete: () => _complete(tasks[i]),
                              // Lessons and Q-bank sets finish by being done,
                              // not by a swipe: tapping opens them.
                              canSwipe: !tasks[i].fromPlan,
                              onOpen: tasks[i].isLinked ? () => _openLinked(tasks[i]) : null,
                            ),
                          ),
                        ),
                      const SizedBox(height: 4),
                      Container(width: 2, height: 10, color: Colors.transparent),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  String _dayLabel(DateTime d) {
    final today = DateTime.now();
    final todayKey = DateTime(today.year, today.month, today.day);
    final diff = d.difference(todayKey).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Tomorrow';
    if (diff == -1) return 'Yesterday';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final prefix = diff < 0 ? 'Overdue · ' : '';
    return '$prefix${months[d.month - 1]} ${d.day}';
  }

  // The generator encodes "Course · Subject" into task.description — group
  // by just the course part so a branch reads as one course, not one branch
  // per individual subject/topic. Older or manually-added tasks with a plain
  // description (no separator) just group by that whole string, unchanged.
  String _courseKey(String description) {
    final trimmed = description.trim();
    if (trimmed.isEmpty) return 'Someday';
    final sep = trimmed.indexOf(' · ');
    return sep == -1 ? trimmed : trimmed.substring(0, sep).trim();
  }

  Future<void> _complete(PlannerTask t) async {
    if (t.fromPlan) return; // done by doing it, not by a swipe
    HapticFeedback.mediumImpact();
    final api = ref.read(plannerApiProvider);
    try {
      await setPlannerTaskDone(api, t.id, true);
      setState(() => _newTaskIds.remove(t.id));
      freshNext('planner');
      ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    } catch (_) {
      _toast('Could not update the task.');
    }
  }

  Future<void> _confirmReset() async {
    final tasks = ref.read(plannerTasksProvider).value ?? const <PlannerTask>[];
    if (tasks.isEmpty) return;
    final ok = await showDialog<bool>(
      useRootNavigator: true,
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear your planner?'),
        content: Text(
            'This permanently deletes all ${tasks.length} task${tasks.length == 1 ? '' : 's'} from your planner. '
            'Your lesson and Q-bank progress is not affected. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear all', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    // Let the page fold up first (see _FoldUp): the tasks close from the
    // bottom up, then the day heading, then the ring and its percentage. The spinner on
    // the reset button (driven by _resetting) gives immediate feedback that
    // the tap registered, before the wave even starts.
    setState(() => _resetting = true);
    final api = ref.read(plannerApiProvider);
    // The request starts straight away and the page folds alongside it.
    _clearDone = 0;
    _clearTotal = 0;
    final request = _clearOnServer(api, tasks, onProgress: (done, total) {
      if (!mounted) return;
      setState(() {
        _clearDone = done;
        _clearTotal = total;
      });
    });
    // Whether the server has already finished: if it has by the time the fold
    // ends, there is nothing left to show progress for.
    var requestDone = false;
    request.then((_) => requestDone = true, onError: (_) => requestDone = true);
    // Only the rows on screen fold, so the wave stays short however big the plan.
    final waveMs = ((tasks.length + 2) * _foldStepMs(tasks.length) + 420).clamp(0, 1200);
    await Future.delayed(Duration(milliseconds: waveMs));
    if (!mounted) return;

    // The fold is done. Show the empty planner NOW; the server may still be
    // working through the deletes (on a server without the one-request clear it
    // is hundreds of them), and the student should not sit watching that.
    setState(() {
      _newTaskIds.clear();
      _resetting = false;
      _clearedLocally = true;
      // Progress only if the server is still working once the fold is over, so
      // the fold, the progress and the empty planner follow one after another.
      _clearing = !requestDone;
    });

    Object? failure;
    try {
      await request;
    } catch (e) {
      failure = e;
    }
    if (mounted) {
      setState(() {
        _clearedLocally = false;
        _clearing = false;
      });
    }
    // Always re-read the list, success or not. After a failure some tasks may
    // already be gone, and showing the old list would show tasks that no longer
    // exist.
    freshNext('planner');
      ref.invalidate(plannerTasksProvider);
    if (failure != null) _toast('Could not clear every task. Pull down to refresh.');
  }

  /// One request on an up-to-date server. On an older one, the deletes run ten
  /// at a time, and one failing does not stop the rest (it used to abort the
  /// whole clear, leaving everything after it behind).
  Future<void> _clearOnServer(ApiClient api, List<PlannerTask> tasks,
      {void Function(int done, int total)? onProgress}) async {
    try {
      onProgress?.call(0, 1);
      await clearPlannerTasks(api);
      onProgress?.call(1, 1); // one request: it is 0%, then done
      return;
    } on PlannerClearUnsupported {
      // fall through to the per-task path
    }

    Future<bool> deleteOne(PlannerTask t) async {
      try {
        await deletePlannerTask(api, t.id);
        return true;
      } on DioException catch (e) {
        return e.response?.statusCode == 404; // already gone counts as cleared
      } catch (_) {
        return false;
      }
    }

    // Only saved rows can be deleted; a plan's days drawn from a rule are not rows.
    final queue = tasks.where((t) => t.id > 0).toList();
    final total = queue.length;
    var finished = 0;
    onProgress?.call(0, total);
    final failed = <PlannerTask>[];
    Future<void> worker() async {
      while (queue.isNotEmpty) {
        final t = queue.removeLast();
        if (!await deleteOne(t)) failed.add(t);
        finished++;
        if (finished % 10 == 0 || finished == total) onProgress?.call(finished, total);
      }
    }

    await Future.wait(List.generate(10, (_) => worker()));
    // One more try for any that failed, a few at a time.
    final stillFailed = <PlannerTask>[];
    for (final t in failed) {
      if (!await deleteOne(t)) stillFailed.add(t);
    }
    if (stillFailed.isNotEmpty) {
      throw StateError('${stillFailed.length} tasks could not be deleted');
    }
  }

  /// Shown over the emptied planner while the server finishes deleting.
  Widget _clearOverlay(AppColors c) {
    final total = _clearTotal < 1 ? 1 : _clearTotal;
    final value = (_clearDone / total).clamp(0.0, 1.0);
    final pct = (value * 100).round();
    return Container(
      color: c.page.withValues(alpha: 0.88),
      alignment: Alignment.center,
      child: Container(
        width: 240,
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
        decoration: BoxDecoration(
          color: c.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: c.line),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 84,
              height: 84,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 84,
                    height: 84,
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: value),
                      duration: const Duration(milliseconds: 250),
                      builder: (_, v, __) => CircularProgressIndicator(
                        value: v,
                        strokeWidth: 6,
                        backgroundColor: c.inkMuted.withValues(alpha: 0.2),
                        color: const Color(0xFFDC2626),
                      ),
                    ),
                  ),
                  Text('$pct%',
                      style: TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800, color: c.inkStrong)),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text('Clearing your planner',
                style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
            if (_clearTotal > 1) ...[
              const SizedBox(height: 4),
              Text('$_clearDone of $_clearTotal tasks',
                  style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
            ],
          ],
        ),
      ),
    );
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _generatePlan() async {
    // Generating a plan is a subscriber feature. Adding tasks by hand stays
    // free — what is being paid for is having the whole course laid out for
    // you, not the planner itself.
    if (!await _ensureSubscribed()) return;
    // One plan at a time. A plan is active while any task it made is still
    // open; tasks the student typed do not count. Finish it, or clear the
    // planner, to make a new one.
    final open = (ref.read(plannerTasksProvider).value ?? const <PlannerTask>[])
        .where((t) => t.fromPlan)
        .toList();
    final live = _withRealStatus(open, watch: false).where((t) => !t.done).length;
    if (live > 0) {
      if (!mounted) return;
      final clear = await showDialog<bool>(
        useRootNavigator: true,
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('You already have a plan'),
          content: Text(
              'Your current plan still has $live task${live == 1 ? '' : 's'} to do. '
              'Finish it, or clear the planner, before making a new one.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('OK')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Clear planner', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );
      if (clear == true && mounted) _confirmReset();
      return;
    }
    final created = await Navigator.of(context).push<List<int>>(
      CupertinoPageRoute(builder: (_) => const GeneratePlanPage()),
    );
    if (created == null) return; // cancelled
    setState(() => _newTaskIds.addAll(created));
    freshNext('planner');
      ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    // No "Added N tasks" popup on success: the new plan appearing is the
    // confirmation. Only the empty case needs a word.
    if (created.isEmpty) _toast('Nothing left to schedule for that selection.');
  }

  /// True if the student may generate — already subscribed, or subscribed
  /// just now through the paywall.
  ///
  /// Reads the billing state rather than trusting a cached flag, and treats a
  /// failed read as "not subscribed" so a network error cannot hand out the
  /// feature. The paywall's own result decides the retry: it returns true only
  /// when a purchase actually granted access.
  Future<bool> _ensureSubscribed() async {
    Billing? billing;
    try {
      billing = await ref.read(billingProvider.future);
    } catch (_) {
      billing = null;
    }
    // isPaid, NOT isActive. A free plan is an ordinary subscription row with
    // status 'active' and an unlimited end date, so isActive was true for
    // every free user and the gate let all of them straight through.
    if (billing?.current?.isPaid == true) return true;
    if (!mounted) return false;
    final granted = await PaywallSheet.show(context);
    if (granted == true) {
      // The purchase changes what the rest of the app may show, so the cached
      // billing state has to go with it.
      ref.invalidate(billingProvider);
      return true;
    }
    return false;
  }

  Future<void> _showAddSheet() async {
    final result = await Navigator.of(context).push<NewTask>(
      CupertinoPageRoute(builder: (_) => const AddTaskPage()),
    );
    if (result == null || result.title.trim().isEmpty) return;

    final api = ref.read(plannerApiProvider);
    try {
      final dueStr = result.date == null
          ? null
          : '${result.date!.year.toString().padLeft(4, '0')}-${result.date!.month.toString().padLeft(2, '0')}-${result.date!.day.toString().padLeft(2, '0')}';
      await createPlannerTask(
        api,
        title: result.title.trim(),
        dueDate: dueStr,
        category: result.category,
        priority: result.priority,
      );
      freshNext('planner');
      ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    } catch (_) {
      _toast('Could not create the task.');
    }
  }

  Future<void> _showReminderSettings(List<PlannerTask> tasks) async {
    await showAdaptiveSheet<void>(
      useRootNavigator: true,
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.page,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ReminderSettingsSheet(tasks: tasks),
    );
  }
}

/// How long to wait between one row folding and the next, so the whole page
/// folds up in about a second however long the plan is (110 ms apart for a
/// short one, down to 3 ms for hundreds of tasks).
int _foldStepMs(int taskCount) =>
    (1000 / (taskCount < 1 ? 1 : taskCount)).clamp(3, 110).round();

/// Folds its child up when the planner is cleared: the height closes to zero
/// while it fades, after [delayMs]. Rows are given later delays the nearer the
/// top they are, so the page closes from the bottom up like rows being deleted.
/// If the clear fails and [exiting] goes false again, it opens back out.
class _FoldUp extends StatefulWidget {
  final bool exiting;
  final int delayMs;
  final Widget child;
  const _FoldUp({required this.exiting, required this.delayMs, required this.child});

  @override
  State<_FoldUp> createState() => _FoldUpState();
}

class _FoldUpState extends State<_FoldUp> {
  bool _folded = false;

  @override
  void initState() {
    super.initState();
    // Built after the clear already began (it was off-screen): fold it too.
    if (widget.exiting) _scheduleFold();
  }

  void _scheduleFold() {
    Future.delayed(Duration(milliseconds: widget.delayMs), () {
      if (mounted && widget.exiting) setState(() => _folded = true);
    });
  }

  @override
  void didUpdateWidget(covariant _FoldUp old) {
    super.didUpdateWidget(old);
    if (widget.exiting && !old.exiting) {
      _scheduleFold();
    } else if (!widget.exiting && old.exiting) {
      setState(() => _folded = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: AnimatedAlign(
        alignment: Alignment.topCenter,
        heightFactor: _folded ? 0 : 1,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeInCubic,
        child: AnimatedOpacity(
          opacity: _folded ? 0 : 1,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeIn,
          child: widget.child,
        ),
      ),
    );
  }
}

/// Swipe (either direction) to complete. Content-type is shown through
/// SHAPE — a book-spine rail, a quiz "?" with option dots, a real stacked-
/// card look, a class ticket-notch — not a text label, so it reads at a
/// glance the same way the source screen (Lesson/Q-Bank/Flashcards) does.
class _SwipeIdentityCard extends StatefulWidget {
  final PlannerTask task;
  final bool isNew;
  final VoidCallback onComplete;
  // False for a task tied to a real lesson or quiz: it cannot be swiped done.
  final bool canSwipe;
  // Called when a linked task is tapped (opens the lesson or quiz).
  final VoidCallback? onOpen;
  const _SwipeIdentityCard({
    super.key,
    required this.task,
    this.isNew = false,
    required this.onComplete,
    this.canSwipe = true,
    this.onOpen,
  });

  @override
  State<_SwipeIdentityCard> createState() => _SwipeIdentityCardState();
}

class _SwipeIdentityCardState extends State<_SwipeIdentityCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  double _from = 0, _to = 0;
  double _dx = 0;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 260))
      ..addListener(() {
        setState(() => _dx = lerpDouble(_from, _to, _anim.value)!);
      });
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  void _springBack() {
    _from = _dx;
    _to = 0;
    _anim.forward(from: 0);
  }

  void _flyOff(double dir) {
    final w = MediaQuery.of(context).size.width;
    _from = _dx;
    _to = dir * w;
    _anim.forward(from: 0).then((_) {
      if (!mounted) return;
      setState(() => _dx = 0); // clean slate before the parent's data refresh
      widget.onComplete();
    });
  }

  @override
  Widget build(BuildContext context) {
    final task = widget.task;
    if (!widget.canSwipe) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onOpen,
        child: _card(context, dx: 0, interactive: false),
      );
    }
    if (task.done) {
      return _card(context, dx: 0, interactive: false);
    }
    final w = MediaQuery.of(context).size.width;
    final hint = (_dx.abs() / (w * 0.22)).clamp(0.0, 1.0);
    return Stack(
      children: [
        // Revealed track behind the card — a green "complete" background that
        // shows through on whichever side the card is being dragged away
        // from (classic swipe-list pattern), growing more solid the closer
        // the drag gets to the completion threshold.
        if (_dx.abs() > 2)
          Positioned.fill(
            child: Container(
              alignment: _dx > 0 ? Alignment.centerLeft : Alignment.centerRight,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A).withValues(alpha: 0.12 + hint * 0.16),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Opacity(
                opacity: hint,
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 26),
              ),
            ),
          ),
        GestureDetector(
          onHorizontalDragUpdate: _anim.isAnimating
              ? null
              : (d) => setState(() => _dx += d.delta.dx),
          onHorizontalDragEnd: _anim.isAnimating
              ? null
              : (_) {
                  if (_dx.abs() > w * 0.22) {
                    _flyOff(_dx > 0 ? 1 : -1);
                  } else {
                    _springBack();
                  }
                },
          child: Transform.translate(
            offset: Offset(_dx, 0),
            child: _card(context, dx: _dx, interactive: true),
          ),
        ),
      ],
    );
  }

  Widget _card(BuildContext context, {required double dx, required bool interactive}) {
    final c = context.c;
    final task = widget.task;
    final w = MediaQuery.of(context).size.width;
    final hint = (dx.abs() / (w * 0.22)).clamp(0.0, 1.0);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Swipe progress: a check that grows and fades in, centered ON the
        // card itself — kept fully within the card's own bounds (no
        // Positioned overflow above/beside it) so it never visually spills
        // into the row above while dragging.
        if (interactive && dx.abs() > 4)
          Positioned.fill(
            child: IgnorePointer(
              child: Center(
                child: Opacity(
                  opacity: hint,
                  child: Transform.scale(
                    scale: 0.7 + hint * 0.5,
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF16A34A), width: 2),
                        color: const Color(0xFF16A34A).withValues(alpha: 0.16),
                      ),
                      child: const Icon(Icons.check_rounded, color: Color(0xFF16A34A), size: 24),
                    ),
                  ),
                ),
              ),
            ),
          ),
        Opacity(
          opacity: task.done ? 0.7 : 1,
          child: Container(
            decoration: BoxDecoration(
              color: c.card,
              border: Border.all(color: c.line),
              borderRadius: BorderRadius.circular(16),
              boxShadow: interactive
                  ? [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 10,
                          offset: const Offset(0, 4)),
                    ]
                  : null,
            ),
            clipBehavior: Clip.antiAlias,
            // IntrinsicHeight: this card sits inside an Expanded in a
            // center-aligned Row (bounds width, not height), so the Row
            // below never receives a bounded height from its ancestors.
            // crossAxisAlignment.stretch needs one — without this wrapper,
            // it silently receives an unbounded (infinity) height. In debug
            // mode that throws a loud "BoxConstraints forces an infinite
            // height" assertion; in release mode that check is compiled out
            // (it's an assert()), so instead of erroring it silently
            // produces garbage layout — the whole card fails to paint while
            // still reporting a bogus height, which is why the task list
            // looked empty AND scrolled forever. IntrinsicHeight makes the
            // Row measure its own children's natural height first, then
            // stretch within that — no unbounded constraint anywhere.
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _CategoryIdentity(category: task.category),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
                      child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(task.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      decoration: task.done
                                          ? TextDecoration.lineThrough
                                          : null,
                                      color: task.done ? c.inkMuted : c.inkStrong)),
                            ),
                            if (widget.isNew && !task.done) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                decoration: BoxDecoration(
                                  color: c.primary,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text('NEW',
                                    style: TextStyle(
                                        fontSize: 8.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.3,
                                        color: Colors.white)),
                              ),
                            ],
                          ],
                        ),
                        if (task.description.trim().isNotEmpty) ...[
                          const SizedBox(height: 1),
                          Text(task.description,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 11, color: c.inkMuted)),
                        ],
                        if (task.dueDate.isEmpty) ...[
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Icon(Icons.event_outlined, size: 11, color: c.inkSoft),
                              const SizedBox(width: 3),
                              Text('No date',
                                  style: TextStyle(fontSize: 10.5, color: c.inkSoft)),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                if (task.done)
                  const Padding(
                    padding: EdgeInsets.only(right: 10),
                    child: StatusTick.done(),
                  )
                else if (task.retry)
                  const Padding(
                    padding: EdgeInsets.only(right: 10),
                    child: StatusTick.retry(),
                  )
                else if (widget.onOpen != null)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Shape-based content identity — recognizable by FORM, not a text chip:
/// a book spine for lessons, a quiz card with answer dots, real stacked
/// cards for flashcards, a ticket notch for a manually-added class.
class _CategoryIdentity extends StatelessWidget {
  final String category;
  const _CategoryIdentity({required this.category});

  static const _lesson = Color(0xFF2563EB);
  static const _quiz = Color(0xFF7C3AED);
  static const _cards = Color(0xFF16A34A);
  static const _cls = Color(0xFFDB2777);
  static const _fallback = Color(0xFF6B7280);

  @override
  Widget build(BuildContext context) {
    switch (category) {
      case 'lesson':
        return _lessonShape();
      case 'quiz':
        return _quizShape();
      case 'flashcards':
        return _cardsShape();
      case 'class':
        return _classShape();
      default:
        return _fallbackShape(context, category);
    }
  }

  Widget _lessonShape() => Container(
        width: 46,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_lesson, Color(0xFF1D4ED8)],
          ),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              left: 9,
              top: 10,
              bottom: 10,
              child: Container(width: 2, color: Colors.white.withValues(alpha: 0.35)),
            ),
            const Icon(Icons.menu_book_rounded, size: 20, color: Colors.white),
          ],
        ),
      );

  Widget _quizShape() => Container(
        width: 46,
        color: _quiz,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('?',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Colors.white)),
            const SizedBox(height: 5),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(4, (i) {
                return Container(
                  width: 4,
                  height: 4,
                  margin: const EdgeInsets.symmetric(horizontal: 1.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: i == 0 ? 1 : 0.4),
                  ),
                );
              }),
            ),
          ],
        ),
      );

  Widget _cardsShape() => SizedBox(
        width: 52,
        child: Center(
          child: SizedBox(
            width: 34,
            height: 38,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Transform.rotate(
                  angle: -0.16,
                  child: Container(
                    decoration: BoxDecoration(
                      color: _cards.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
                Transform.rotate(
                  angle: 0.1,
                  child: Container(
                    decoration: BoxDecoration(
                      color: _cards.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: _cards,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(Icons.add_rounded, size: 16, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
      );

  Widget _classShape() => Container(
        width: 46,
        color: _cls,
        child: const Icon(Icons.confirmation_number_outlined, size: 20, color: Colors.white),
      );

  Widget _fallbackShape(BuildContext context, String category) {
    const icons = {
      'exam': Icons.warning_amber_rounded,
      'review': Icons.replay_rounded,
    };
    return Container(
      width: 46,
      color: _fallback,
      child: Icon(icons[category] ?? Icons.circle_outlined, size: 19, color: Colors.white),
    );
  }
}

// ── Add-task sheet (date only — reminders come from global prefs) ──
Widget _grabber(AppColors c) => Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(bottom: 14),
        decoration:
            BoxDecoration(color: c.inkMuted, borderRadius: BorderRadius.circular(2)),
      ),
    );

// ── Reminder settings (mirrors the web StudyReminderSettingsCard) ──
class _ReminderSettingsSheet extends StatefulWidget {
  final List<PlannerTask> tasks;
  const _ReminderSettingsSheet({required this.tasks});
  @override
  State<_ReminderSettingsSheet> createState() => _ReminderSettingsSheetState();
}

class _ReminderSettingsSheetState extends State<_ReminderSettingsSheet> {
  StudyReminderPrefs _prefs = const StudyReminderPrefs();
  bool _loaded = false;

  static const _leadOptions = [1, 3, 6, 12, 24];

  @override
  void initState() {
    super.initState();
    StudyReminders.getPrefs().then((p) {
      if (!mounted) return;
      setState(() {
        _prefs = p;
        _loaded = true;
      });
    });
  }

  Future<void> _apply(StudyReminderPrefs next) async {
    setState(() => _prefs = next);
    await StudyReminders.savePrefs(next);
    await StudyReminders.reconcile(widget.tasks);
  }

  Timer? _wheelDebounce;

  @override
  void dispose() {
    _wheelDebounce?.cancel();
    super.dispose();
  }

  Widget _card(AppColors c, {required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: c.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.line),
        ),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (!_loaded) {
      return const SizedBox(
          height: 200, child: Center(child: CircularProgressIndicator()));
    }
    final parts = _prefs.customTime.split(':');
    final wheelTime = TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 18,
        minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _grabber(c),
          Text('Study reminders',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 4),
          Text('Reminders are set on your phone.',
              style: TextStyle(fontSize: 13, color: c.inkSoft)),
          const SizedBox(height: 14),

          // Task reminders
          _card(
            c,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: _prefs.plannerEnabled,
                  onChanged: (v) => _apply(_prefs.copyWith(plannerEnabled: v)),
                  title: Text('Task reminders',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, color: c.inkStrong)),
                  subtitle: Text("Before a day's tasks are due",
                      style: TextStyle(fontSize: 13, color: c.inkSoft)),
                ),
                if (_prefs.plannerEnabled) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: [
                      for (final h in _leadOptions)
                        _chip(c, h >= 24 ? '${h ~/ 24} day' : '${h}h',
                            _prefs.plannerLeadHours == h,
                            () => _apply(_prefs.copyWith(plannerLeadHours: h))),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('How long before the end of the day to remind you.',
                      style: TextStyle(fontSize: 12, color: c.inkMuted)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Daily reminder
          _card(
            c,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: _prefs.customEnabled,
                  onChanged: (v) => _apply(_prefs.copyWith(customEnabled: v)),
                  title: Text('Daily reminder',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, color: c.inkStrong)),
                  subtitle: Text('Same time every day',
                      style: TextStyle(fontSize: 13, color: c.inkSoft)),
                ),
                if (_prefs.customEnabled)
                  TimeWheel(
                    initial: wheelTime,
                    onChanged: (t) {
                      // Wait for the wheels to rest before rescheduling.
                      _wheelDebounce?.cancel();
                      _wheelDebounce = Timer(const Duration(milliseconds: 500), () {
                        if (!mounted) return;
                        final hh = t.hour.toString().padLeft(2, '0');
                        final mm = t.minute.toString().padLeft(2, '0');
                        _apply(_prefs.copyWith(customTime: '$hh:$mm'));
                      });
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(AppColors c, String label, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
            color: on ? c.primary : c.surface2,
            borderRadius: BorderRadius.circular(9)),
        child: Text(label,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: on ? Colors.white : c.inkMedium)),
      ),
    );
  }
}
