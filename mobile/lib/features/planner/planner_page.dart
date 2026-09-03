import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../services/study_reminders.dart';
import 'planner_repository.dart';

class PlannerPage extends ConsumerStatefulWidget {
  const PlannerPage({super.key});

  @override
  ConsumerState<PlannerPage> createState() => _PlannerPageState();
}

class _PlannerPageState extends ConsumerState<PlannerPage> {
  String _lastSig = '';

  /// Re-schedule reminders only when the task set actually changed (web-style
  /// reconcile: cancel our prior batch, reschedule from prefs + tasks).
  void _maybeReconcile(List<PlannerTask> tasks) {
    final sig = tasks
        .map((t) => '${t.id}:${t.status}:${t.dueDate}')
        .join('|');
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
            return _list(c, tasks);
          },
        ),
      ),
    );
  }

  Widget _list(AppColors c, List<PlannerTask> tasks) {
    final today = DateTime.now();
    final todayKey = DateTime(today.year, today.month, today.day);
    final overdue = <PlannerTask>[];
    final dueToday = <PlannerTask>[];
    final upcoming = <PlannerTask>[];
    final someday = <PlannerTask>[];
    final done = <PlannerTask>[];
    for (final t in tasks) {
      if (t.done) {
        done.add(t);
        continue;
      }
      final d = t.due;
      if (d == null) {
        someday.add(t);
      } else if (d.isBefore(todayKey)) {
        overdue.add(t);
      } else if (d == todayKey) {
        dueToday.add(t);
      } else {
        upcoming.add(t);
      }
    }

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
            ],
          ),
          const SizedBox(height: 2),
          Text('Plan tasks and get a reminder before they are due.',
              style: TextStyle(fontSize: 14, color: c.inkSoft)),
          const SizedBox(height: 18),
          if (tasks.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Column(
                children: [
                  Icon(Icons.event_note_outlined, size: 40, color: c.inkMuted),
                  const SizedBox(height: 10),
                  Text('No tasks yet — add your first one.',
                      style: TextStyle(color: c.inkSoft)),
                ],
              ),
            ),
          _section(c, 'Overdue', overdue, const Color(0xFFDC2626)),
          _section(c, 'Today', dueToday, const Color(0xFF16A34A)),
          _section(c, 'Upcoming', upcoming, const Color(0xFF2563EB)),
          _section(c, 'No date', someday, c.inkSoft),
          _section(c, 'Done', done, c.inkMuted, dim: true),
        ],
      ),
    );
  }

  Widget _section(AppColors c, String label, List<PlannerTask> tasks, Color color,
      {bool dim = false}) {
    if (tasks.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, top: 6),
          child: Row(
            children: [
              Container(width: 8, height: 8,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(label,
                  style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const SizedBox(width: 6),
              Text('${tasks.length}',
                  style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: c.inkSoft)),
            ],
          ),
        ),
        for (final t in tasks)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _TaskRow(
              task: t,
              dim: dim,
              onToggle: () => _toggle(t),
              onDelete: () => _delete(t),
            ),
          ),
        const SizedBox(height: 8),
      ],
    );
  }

  Future<void> _toggle(PlannerTask t) async {
    HapticFeedback.mediumImpact();
    final api = ref.read(plannerApiProvider);
    try {
      await setPlannerTaskDone(api, t.id, !t.done);
      ref.invalidate(plannerTasksProvider); // reconcile runs on rebuild
    } catch (_) {
      _toast('Could not update the task.');
    }
  }

  Future<void> _delete(PlannerTask t) async {
    final api = ref.read(plannerApiProvider);
    try {
      await deletePlannerTask(api, t.id);
      ref.invalidate(plannerTasksProvider);
    } catch (_) {
      _toast('Could not delete the task.');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
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

class _TaskRow extends StatelessWidget {
  final PlannerTask task;
  final bool dim;
  final VoidCallback onToggle;
  final VoidCallback onDelete;
  const _TaskRow(
      {required this.task,
      required this.dim,
      required this.onToggle,
      required this.onDelete});

  static const _catColors = {
    'lesson': Color(0xFF2563EB),
    'quiz': Color(0xFF7C3AED),
    'exam': Color(0xFFDC2626),
    'review': Color(0xFF0EA5E9),
    'flashcards': Color(0xFF16A34A),
    'general': Color(0xFF6B7280),
  };

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final accent = _catColors[task.category] ?? c.inkSoft;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: onToggle,
            child: Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: task.done ? const Color(0xFF16A34A) : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(
                    color: task.done ? const Color(0xFF16A34A) : c.inkMuted,
                    width: 2),
              ),
              child: task.done
                  ? const Icon(Icons.check, size: 15, color: Colors.white)
                  : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(task.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        decoration:
                            task.done ? TextDecoration.lineThrough : null,
                        color: dim ? c.inkSoft : c.inkStrong)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(_titleCase(task.category),
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: accent)),
                    ),
                    if (task.dueDate.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Icon(Icons.event_outlined, size: 12, color: c.inkSoft),
                      const SizedBox(width: 3),
                      Text(_fmtDate(task.due),
                          style: TextStyle(fontSize: 12, color: c.inkSoft)),
                    ],
                    if (task.priority == 'high') ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.priority_high_rounded,
                          size: 13, color: Color(0xFFDC2626)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded, size: 20, color: c.inkMuted),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }

  static String _titleCase(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  static String _fmtDate(DateTime? d) {
    if (d == null) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${months[d.month - 1]} ${d.day}';
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

  static const _categories = ['general', 'lesson', 'quiz', 'exam', 'review', 'flashcards'];

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
