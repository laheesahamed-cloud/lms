import 'dart:ui' show lerpDouble;

import 'package:flutter/cupertino.dart' show CupertinoPageRoute;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../services/study_reminders.dart';
import 'add_task_page.dart';
import 'generate_plan_page.dart';
import 'planner_repository.dart';
import '../../widgets/page_header.dart';
import '../../widgets/shell_insets.dart';

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

  // True while a confirmed "Reset" is playing its staggered exit animation
  // and clearing tasks server-side — drives the reset button's spinner.
  bool _resetting = false;

  static const _celebrations = [
    'Nice work!',
    'Great job — one step closer!',
    'Boom! Keep the streak going.',
    'Well done! On to the next one.',
  ];

  /// Re-schedule reminders only when the task set actually changed (web-style
  /// reconcile: cancel our prior batch, reschedule from prefs + tasks).
  void _maybeReconcile(List<PlannerTask> tasks) {
    final sig = tasks.map((t) => '${t.id}:${t.status}:${t.dueDate}').join('|');
    if (sig == _lastSig) return;
    _lastSig = sig;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      StudyReminders.reconcile(tasks);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tasksAsync = ref.watch(plannerTasksProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSheet,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add task'),
      ),
      body: SafeArea(
        bottom: false,
        child: tasksAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load your planner.\n$e',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.inkSoft, fontSize: 14)),
            ),
          ),
          data: (tasks) {
            _maybeReconcile(tasks);
            return _mindMap(c, tasks);
          },
        ),
      ),
    );
  }

  // ── Layout: a central progress hub branching into day (or subject) groups,
  // each branching into swipe-to-complete, shape-identified task cards. ──
  Widget _mindMap(AppColors c, List<PlannerTask> tasks) {
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
    final sortedDates = byDate.keys.toList()..sort();
    final sortedSubjects = bySubject.keys.toList()..sort();

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(plannerTasksProvider.future),
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, 14, 16, 28 + shellNavInset(context)),
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
                  tooltip: 'Reset — clear all tasks',
                  onPressed: _resetting ? null : _confirmReset,
                  icon: _resetting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.4, color: Color(0xFFDC2626)),
                        )
                      : const Icon(Icons.refresh_rounded, color: Color(0xFFDC2626)),
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
                Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
              ],
            ),
          ),
          const SizedBox(height: 22),
          if (tasks.isEmpty)
            _emptyState(c)
          else ...[
            _hub(c, total, doneCount),
            _stem(c),
            ..._buildBranches(c, sortedDates, byDate, sortedSubjects, bySubject),
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
  ) {
    final branches = <Widget>[];
    var index = 0;
    for (final d in sortedDates) {
      final tasks = byDate[d]!;
      branches.add(_branch(c, _dayLabel(d), tasks, startIndex: index));
      index += tasks.length;
    }
    for (final s in sortedSubjects) {
      final tasks = bySubject[s]!;
      branches.add(_branch(c, s, tasks, startIndex: index));
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

  Widget _branch(AppColors c, String label, List<PlannerTask> tasks, {required int startIndex}) {
    final done = tasks.where((t) => t.done).length;
    final collapsed = _collapsedBranches.contains(label);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          InkWell(
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
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: collapsed
                ? const SizedBox(width: double.infinity)
                : Column(
                    children: [
                      Container(width: 2, height: 12, color: c.line),
                      // No leading connector tick here — it used to sit before
                      // the card as a sibling in a Row, which ate 18px of
                      // width from the LEFT only (nothing matching on the
                      // right), pushing every card's content visibly off
                      // center. The card now takes the full row width,
                      // symmetric with the branch pill above it.
                      for (var i = 0; i < tasks.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 9),
                          child: _StaggeredExit(
                            index: startIndex + i,
                            exiting: _resetting,
                            child: _SwipeIdentityCard(
                              key: ValueKey(tasks[i].id),
                              task: tasks[i],
                              isNew: _newTaskIds.contains(tasks[i].id),
                              onComplete: () => _complete(tasks[i]),
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
    HapticFeedback.mediumImpact();
    final api = ref.read(plannerApiProvider);
    try {
      await setPlannerTaskDone(api, t.id, true);
      setState(() => _newTaskIds.remove(t.id));
      ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
      _celebrate(t);
    } catch (_) {
      _toast('Could not update the task.');
    }
  }

  Future<void> _celebrate(PlannerTask t) async {
    if (!mounted) return;
    final msg = (List.of(_celebrations)..shuffle()).first;
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (ctx) => Dialog(
        backgroundColor: context.c.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(26, 28, 26, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _AnimatedCheckBadge(size: 56),
              const SizedBox(height: 8),
              Text(msg,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800, color: context.c.inkStrong)),
              const SizedBox(height: 4),
              Text(t.title,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, color: context.c.inkSoft)),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: FilledButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Keep going', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmReset() async {
    final tasks = ref.read(plannerTasksProvider).value ?? const <PlannerTask>[];
    if (tasks.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear your planner?'),
        content: Text(
            'This permanently deletes all ${tasks.length} task${tasks.length == 1 ? '' : 's'}. This cannot be undone.'),
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

    // Let every card play its staggered swipe-away exit first (see
    // _StaggeredExit) so clearing the planner feels like watching each task
    // get swept away, not an instant swap to the empty state. The spinner on
    // the reset button (driven by _resetting) gives immediate feedback that
    // the tap registered, before the wave even starts.
    setState(() => _resetting = true);
    final waveMs = 260 + (tasks.length.clamp(0, 24) * 45) + 260;
    await Future.delayed(Duration(milliseconds: waveMs));
    if (!mounted) return;

    final api = ref.read(plannerApiProvider);
    try {
      await Future.wait(tasks.map((t) => deletePlannerTask(api, t.id)));
      if (!mounted) return;
      setState(() {
        _newTaskIds.clear();
        _resetting = false;
      });
      ref.invalidate(plannerTasksProvider);
    } catch (_) {
      if (!mounted) return;
      setState(() => _resetting = false);
      _toast('Could not clear the planner.');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _generatePlan() async {
    final created = await Navigator.of(context).push<List<int>>(
      CupertinoPageRoute(builder: (_) => const GeneratePlanPage()),
    );
    if (created == null) return; // cancelled
    setState(() => _newTaskIds.addAll(created));
    ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    _toast(created.isEmpty
        ? 'Nothing left to schedule for that selection.'
        : 'Added ${created.length} task${created.length == 1 ? '' : 's'} to your planner.');
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
      ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    } catch (_) {
      _toast('Could not create the task.');
    }
  }

  Future<void> _showReminderSettings(List<PlannerTask> tasks) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.page,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ReminderSettingsSheet(tasks: tasks),
    );
  }
}

/// Wraps a task card so a Reset can sweep every card off-screen with the
/// same slide + fade language as swiping one away by hand, staggered by
/// [index] so the whole page clears as one wave instead of all at once.
/// Purely a start-delay + implicit-animation combo (AnimatedSlide/Opacity
/// flipping once the delay elapses) — no AnimationController needed since
/// nothing here ever plays in reverse.
/// A green check that pops in with a bounce — used wherever the app tells
/// the student "done", instead of an emoji.
class _AnimatedCheckBadge extends StatelessWidget {
  final double size;
  const _AnimatedCheckBadge({required this.size});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 480),
      curve: Curves.elasticOut,
      builder: (_, v, child) => Transform.scale(scale: v, child: child),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: const Color(0xFF16A34A).withValues(alpha: 0.14),
          shape: BoxShape.circle,
        ),
        child: Icon(Icons.check_rounded, size: size * 0.6, color: const Color(0xFF16A34A)),
      ),
    );
  }
}

class _StaggeredExit extends StatefulWidget {
  final int index;
  final bool exiting;
  final Widget child;
  const _StaggeredExit({required this.index, required this.exiting, required this.child});

  @override
  State<_StaggeredExit> createState() => _StaggeredExitState();
}

class _StaggeredExitState extends State<_StaggeredExit> {
  bool _gone = false;

  @override
  void didUpdateWidget(covariant _StaggeredExit old) {
    super.didUpdateWidget(old);
    if (widget.exiting && !old.exiting) {
      Future.delayed(Duration(milliseconds: (widget.index.clamp(0, 24)) * 45), () {
        if (mounted) setState(() => _gone = true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // No clipping wrapper here, matching the existing swipe-to-complete
    // gesture on the card itself — that also lets the card translate past
    // its own bounds while flying off, uninterrupted.
    return AnimatedSlide(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeInCubic,
      offset: _gone ? const Offset(1.35, 0) : Offset.zero,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeIn,
        opacity: _gone ? 0 : 1,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            widget.child,
            if (_gone)
              Positioned(
                top: -8,
                right: 12,
                child: Transform.rotate(
                  angle: 0.18,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(7),
                      border: Border.all(color: const Color(0xFFDC2626), width: 2),
                      color: const Color(0xFFDC2626).withValues(alpha: 0.14),
                    ),
                    child: const Text('REMOVED',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                            color: Color(0xFFDC2626))),
                  ),
                ),
              ),
          ],
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
  const _SwipeIdentityCard({
    super.key,
    required this.task,
    this.isNew = false,
    required this.onComplete,
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
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: Icon(Icons.check_circle_rounded,
                        size: 18, color: const Color(0xFF16A34A).withValues(alpha: 0.45)),
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

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (!_loaded) {
      return const SizedBox(
          height: 200, child: Center(child: CircularProgressIndicator()));
    }
    return Padding(
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
          Text('On-device reminders, scheduled locally.',
              style: TextStyle(fontSize: 13, color: c.inkSoft)),
          const SizedBox(height: 16),

          // Planner reminders
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _prefs.plannerEnabled,
            onChanged: (v) => _apply(_prefs.copyWith(plannerEnabled: v)),
            title: Text('Task reminders',
                style: TextStyle(
                    fontWeight: FontWeight.w700, color: c.inkStrong)),
            subtitle: Text('Remind me before each task is due',
                style: TextStyle(fontSize: 13, color: c.inkSoft)),
          ),
          if (_prefs.plannerEnabled) ...[
            const SizedBox(height: 4),
            Text('REMIND ME',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: c.inkSoft)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 7,
              children: [
                for (final h in _leadOptions)
                  _chip(c, h >= 24 ? '${h ~/ 24}d before' : '${h}h before',
                      _prefs.plannerLeadHours == h,
                      () => _apply(_prefs.copyWith(plannerLeadHours: h))),
              ],
            ),
          ],
          const Divider(height: 28),

          // Daily reminder
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _prefs.customEnabled,
            onChanged: (v) => _apply(_prefs.copyWith(customEnabled: v)),
            title: Text('Daily reminder',
                style: TextStyle(
                    fontWeight: FontWeight.w700, color: c.inkStrong)),
            subtitle: Text('A nudge to study at the same time each day',
                style: TextStyle(fontSize: 13, color: c.inkSoft)),
          ),
          if (_prefs.customEnabled)
            Align(
              alignment: Alignment.centerLeft,
              child: GestureDetector(
                onTap: _pickCustomTime,
                child: Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                      color: c.surface2,
                      borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.alarm_outlined, size: 17, color: c.primary),
                      const SizedBox(width: 8),
                      Text('At ${_prefs.customTime}',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, color: c.inkStrong)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _pickCustomTime() async {
    final parts = _prefs.customTime.split(':');
    final init = TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 18,
        minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
    final picked = await showTimePicker(context: context, initialTime: init);
    if (picked != null) {
      final hh = picked.hour.toString().padLeft(2, '0');
      final mm = picked.minute.toString().padLeft(2, '0');
      await _apply(_prefs.copyWith(customTime: '$hh:$mm'));
    }
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
