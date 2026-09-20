import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../services/study_reminders.dart';
import 'generate_plan_sheet.dart';
import 'planner_repository.dart';

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
    // branch by subject (task.description, from the generator) so a
    // "By subject" generated plan still reads as organized instead of one
    // flat unsorted pile.
    final byDate = <DateTime, List<PlannerTask>>{};
    final bySubject = <String, List<PlannerTask>>{};
    for (final t in tasks) {
      final d = t.due;
      if (d != null) {
        byDate.putIfAbsent(d, () => []).add(t);
      } else {
        final key = t.description.trim().isEmpty ? 'Someday' : t.description.trim();
        bySubject.putIfAbsent(key, () => []).add(t);
      }
    }
    final sortedDates = byDate.keys.toList()..sort();
    final sortedSubjects = bySubject.keys.toList()..sort();

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(plannerTasksProvider.future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('STUDY PLANNER',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.4,
                            color: c.accent)),
                    const SizedBox(height: 5),
                    Text('Planner',
                        style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong,
                            letterSpacing: -0.5)),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Reminders',
                onPressed: () => _showReminderSettings(tasks),
                icon: Icon(Icons.notifications_outlined, color: c.inkMedium),
              ),
              if (tasks.isNotEmpty)
                IconButton(
                  tooltip: 'Reset — clear all tasks',
                  onPressed: _confirmReset,
                  icon: const Icon(Icons.refresh_rounded, color: Color(0xFFDC2626)),
                ),
            ],
          ),
          const SizedBox(height: 2),
          Text('Plan tasks and get a reminder before they are due.',
              style: TextStyle(fontSize: 14, color: c.inkSoft)),
          const SizedBox(height: 14),
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
            for (final d in sortedDates) _branch(c, _dayLabel(d), byDate[d]!),
            for (final s in sortedSubjects) _branch(c, s, bySubject[s]!),
          ],
        ],
      ),
    );
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

  Widget _branch(AppColors c, String label, List<PlannerTask> tasks) {
    final done = tasks.where((t) => t.done).length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: c.cardElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: c.line),
            ),
            child: Column(
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800, color: c.inkStrong)),
                Text('$done of ${tasks.length} done',
                    style: TextStyle(fontSize: 10.5, color: c.inkMuted)),
              ],
            ),
          ),
          Container(width: 2, height: 12, color: c.line),
          for (final t in tasks)
            Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(width: 18, height: 2, color: c.line),
                  Expanded(
                    child: _SwipeIdentityCard(
                      key: ValueKey(t.id),
                      task: t,
                      isNew: _newTaskIds.contains(t.id),
                      onComplete: () => _complete(t),
                      onDelete: () => _delete(t),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 4),
          Container(width: 2, height: 10, color: Colors.transparent),
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
              const Text('🎉', style: TextStyle(fontSize: 40)),
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

  Future<void> _delete(PlannerTask t) async {
    final api = ref.read(plannerApiProvider);
    try {
      await deletePlannerTask(api, t.id);
      setState(() => _newTaskIds.remove(t.id));
      ref.invalidate(plannerTasksProvider);
    } catch (_) {
      _toast('Could not delete the task.');
    }
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
    if (ok != true) return;
    final api = ref.read(plannerApiProvider);
    try {
      await Future.wait(tasks.map((t) => deletePlannerTask(api, t.id)));
      setState(() => _newTaskIds.clear());
      ref.invalidate(plannerTasksProvider);
    } catch (_) {
      _toast('Could not clear the planner.');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _generatePlan() async {
    final created = await showGeneratePlanSheet(context);
    if (created == null) return; // cancelled
    setState(() => _newTaskIds.addAll(created));
    ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    _toast(created.isEmpty
        ? 'Nothing left to schedule for that selection.'
        : 'Added ${created.length} task${created.length == 1 ? '' : 's'} to your planner.');
  }

  Future<void> _showAddSheet() async {
    final result = await showModalBottomSheet<_NewTask>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.page,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => const _AddTaskSheet(),
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

/// Swipe (either direction) to complete. Content-type is shown through
/// SHAPE — a book-spine rail, a quiz "?" with option dots, a real stacked-
/// card look, a class ticket-notch — not a text label, so it reads at a
/// glance the same way the source screen (Lesson/Q-Bank/Flashcards) does.
class _SwipeIdentityCard extends StatefulWidget {
  final PlannerTask task;
  final bool isNew;
  final VoidCallback onComplete;
  final VoidCallback onDelete;
  const _SwipeIdentityCard({
    super.key,
    required this.task,
    this.isNew = false,
    required this.onComplete,
    required this.onDelete,
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
    return GestureDetector(
      onHorizontalDragUpdate: _anim.isAnimating
          ? null
          : (d) => setState(() => _dx += d.delta.dx),
      onHorizontalDragEnd: _anim.isAnimating
          ? null
          : (_) {
              final w = MediaQuery.of(context).size.width;
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
        if (interactive && dx.abs() > 4)
          Positioned(
            top: -8,
            left: dx > 0 ? 12 : null,
            right: dx < 0 ? 12 : null,
            child: Opacity(
              opacity: hint,
              child: Transform.rotate(
                angle: dx > 0 ? -0.18 : 0.18,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: const Color(0xFF16A34A), width: 2),
                    color: const Color(0xFF16A34A).withValues(alpha: 0.14),
                  ),
                  child: const Text('DONE',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.6,
                          color: Color(0xFF16A34A))),
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
                if (interactive)
                  IconButton(
                    icon: Icon(Icons.close_rounded, size: 18, color: c.inkMuted),
                    onPressed: widget.onDelete,
                    tooltip: 'Delete',
                  ),
              ],
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
class _NewTask {
  final String title;
  final DateTime? date;
  final String category;
  final String priority;
  _NewTask(this.title, this.date, this.category, this.priority);
}

class _AddTaskSheet extends StatefulWidget {
  const _AddTaskSheet();
  @override
  State<_AddTaskSheet> createState() => _AddTaskSheetState();
}

class _AddTaskSheetState extends State<_AddTaskSheet> {
  final _controller = TextEditingController();
  DateTime? _date;
  String _category = 'general';
  String _priority = 'medium';

  static const _categories = ['general', 'lesson', 'quiz', 'exam', 'review', 'flashcards', 'class'];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _grabber(c),
          Text('New task',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            // Dismiss the keyboard when tapping anywhere outside the field —
            // inside a dialog the app-level tap-to-unfocus never fires.
            onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
            style: TextStyle(color: c.inkStrong),
            decoration: InputDecoration(
              hintText: 'What do you need to study?',
              filled: true,
              fillColor: c.surface2,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 12),
          _pickerTile(
            c,
            icon: Icons.event_outlined,
            label: _date == null ? 'Due date (optional)' : _fmt(_date!),
            onTap: _pickDate,
          ),
          const SizedBox(height: 12),
          _label(c, 'Category'),
          const SizedBox(height: 6),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              for (final cat in _categories)
                _chip(c, _titleCase(cat), _category == cat,
                    () => setState(() => _category = cat)),
            ],
          ),
          const SizedBox(height: 12),
          _label(c, 'Priority'),
          const SizedBox(height: 6),
          Row(
            children: [
              for (final p in const ['low', 'medium', 'high'])
                Padding(
                  padding: const EdgeInsets.only(right: 7),
                  child: _chip(c, _titleCase(p), _priority == p,
                      () => setState(() => _priority = p)),
                ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: () => Navigator.of(context)
                  .pop(_NewTask(_controller.text, _date, _category, _priority)),
              child: const Text('Add task',
                  style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(AppColors c, String t) => Text(t.toUpperCase(),
      style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
          color: c.inkSoft));

  Widget _pickerTile(AppColors c,
      {required IconData icon, required String label, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
            color: c.surface2, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Icon(icon, size: 17, color: c.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: c.inkStrong)),
            ),
          ],
        ),
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

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 3),
    );
    if (picked != null) setState(() => _date = picked);
  }

  static String _titleCase(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  static String _fmt(DateTime d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }
}

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
