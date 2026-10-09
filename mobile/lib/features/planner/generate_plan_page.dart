import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/study_reminders.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../courses/courses_repository.dart';
import 'plan_generator.dart';
import 'planner_form_kit.dart';

/// "Generate Plan" wizard: ask study-hours/date-range/content details, run a
/// short generating animation while [generateStudyPlan] actually does the
/// work, then pop. Returns the created tasks' ids (null if cancelled, empty
/// if nothing matched) so the caller can badge them as "new" and toast/refresh.
///
/// A full screen, not a sheet: the form has six groups of controls and a
/// course list of unknown length, which a sheet could only ever show a slice
/// of at a time.
class GeneratePlanPage extends ConsumerStatefulWidget {
  const GeneratePlanPage({super.key});
  @override
  ConsumerState<GeneratePlanPage> createState() => _GeneratePlanPageState();
}

enum _Phase { details, generating }

class _GeneratePlanPageState extends ConsumerState<GeneratePlanPage>
    with SingleTickerProviderStateMixin {
  _Phase _phase = _Phase.details;

  final Set<String> _selectedCourseIds = {};
  bool _includeLessons = true;
  bool _includeQuizzes = true;
  bool _includeFlashcards = true;
  bool _organizeByDay = true;
  double _hoursPerDay = 2;
  DateTime? _until;
  String _reminderTime = '18:00';

  late final AnimationController _animCtrl;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    StudyReminders.getPrefs().then((p) {
      if (mounted) setState(() => _reminderTime = p.customTime);
    });
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  // How much of the plan has actually been saved. -1 total means the work has
  // not reported yet: it is still reading courses and deciding what to
  // schedule, with no number to show.
  int _saved = 0;
  int _toSave = -1;

  Future<void> _generate() async {
    if (_selectedCourseIds.isEmpty) return;
    HapticFeedback.mediumImpact();
    setState(() => _phase = _Phase.generating);
    _animCtrl.forward(from: 0);

    final work = generateStudyPlan(
      ref,
      courseIds: _selectedCourseIds.toList(),
      includeLessons: _includeLessons,
      includeQuizzes: _includeQuizzes,
      includeFlashcards: _includeFlashcards,
      hoursPerDay: _hoursPerDay,
      untilDate: _until,
      organizeByDay: _organizeByDay,
      onProgress: (done, total) {
        if (!mounted) return;
        setState(() { _saved = done; _toSave = total; });
      },
    );
    // Reminder time chosen here feeds the SAME prefs the Planner's own
    // Reminders sheet reads/writes — no separate reminder mechanism.
    final prefs = await StudyReminders.getPrefs();
    await StudyReminders.savePrefs(
        prefs.copyWith(customEnabled: true, customTime: _reminderTime));

    // The delay is a MINIMUM, not a limit: Future.wait returns when the slower
    // of the two finishes, so a long upload keeps the screen up for as long as
    // it takes. The animation used to run out after 1.8s and sit frozen on a
    // green tick while a few hundred tasks were still uploading, which read as
    // finished-but-stuck; the screen now counts them instead.
    var createdIds = <int>[];
    await Future.wait<void>([
      work.then((ids) => createdIds = ids),
      Future.delayed(const Duration(milliseconds: 1800)),
    ]);
    if (!mounted) return;
    Navigator.of(context).pop(createdIds);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // While it generates there is nothing to fill in and nothing to confirm,
    // so the form chrome steps aside entirely.
    if (_phase == _Phase.generating) {
      return Scaffold(
        backgroundColor: c.page,
        body: SafeArea(child: Center(child: _generating(context))),
      );
    }
    return _details(context);
  }

  Widget _details(BuildContext context) {
    final c = context.c;
    final coursesAsync = ref.watch(studentCoursesProvider);

    return PlannerFormPage(
      titleTop: 'Generate',
      titleAccent: 'Study Plan',
      subtitle: 'Fills your Planner from what you still have left to study',
      heroIcon: Icons.auto_awesome_rounded,
      cta: AppButton(
        'Generate plan',
        kind: AppButtonKind.cta,
        expand: true,
        leading: const Icon(Icons.auto_awesome_rounded,
            size: 18, color: Colors.white),
        onPressed: _selectedCourseIds.isEmpty ? null : _generate,
      ),
      children: [
        PlannerSection(
          icon: Icons.school_outlined,
          label: 'Courses',
          trailing: Text(
              _selectedCourseIds.isEmpty
                  ? 'Pick at least one'
                  : '${_selectedCourseIds.length} selected',
              style: TextStyle(fontSize: 12, color: c.inkMuted)),
          child: coursesAsync.when(
            loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
            error: (e, _) => Text('Could not load courses.',
                style: TextStyle(color: c.inkSoft, fontSize: 13)),
            data: (courses) => Wrap(
              spacing: 8,
              runSpacing: 10,
              children: [
                for (final course in courses)
                  PlannerChoice(
                    label: course.title,
                    selected: _selectedCourseIds.contains(course.id),
                    onTap: () => setState(() {
                      if (!_selectedCourseIds.remove(course.id)) {
                        _selectedCourseIds.add(course.id);
                      }
                    }),
                  ),
              ],
            ),
          ),
        ),
        PlannerSection(
          icon: Icons.layers_outlined,
          label: 'Include',
          // One row of three equal tiles — they are one choice made three
          // times, so they should not wrap into ragged widths.
          child: Row(
            children: [
              Expanded(
                child: PlannerChoice(
                    expand: true,
                    icon: Icons.menu_book_rounded,
                    label: 'Lessons',
                    selected: _includeLessons,
                    onTap: () =>
                        setState(() => _includeLessons = !_includeLessons)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: PlannerChoice(
                    expand: true,
                    icon: Icons.rule_rounded,
                    label: 'Q-Bank',
                    selected: _includeQuizzes,
                    onTap: () =>
                        setState(() => _includeQuizzes = !_includeQuizzes)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: PlannerChoice(
                    expand: true,
                    icon: Icons.style_outlined,
                    label: 'Flashcards',
                    selected: _includeFlashcards,
                    onTap: () => setState(
                        () => _includeFlashcards = !_includeFlashcards)),
              ),
            ],
          ),
        ),
        PlannerSection(
          icon: Icons.tune_rounded,
          label: 'Organize',
          child: Row(
            children: [
              Expanded(
                child: _toggleTile(c,
                    icon: Icons.calendar_month_rounded,
                    label: 'Day by day',
                    sub: 'Spread across days',
                    selected: _organizeByDay,
                    onTap: () => setState(() => _organizeByDay = true)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _toggleTile(c,
                    icon: Icons.folder_copy_outlined,
                    label: 'By subject',
                    sub: 'No due dates',
                    selected: !_organizeByDay,
                    onTap: () => setState(() => _organizeByDay = false)),
              ),
            ],
          ),
        ),
        // Both of these only mean anything when the plan is actually being
        // spread across days — hidden entirely for "By subject", where nothing
        // gets a due date at all.
        if (_organizeByDay)
          PlannerSection(
            icon: Icons.schedule_rounded,
            label: 'Schedule',
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Study hours per day',
                          style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: c.inkMedium)),
                    ),
                    _stepperBtn(c, Icons.remove_rounded,
                        () => setState(() => _hoursPerDay =
                            (_hoursPerDay - 0.5).clamp(0.5, 12))),
                    SizedBox(
                      width: 54,
                      child: Center(
                        child: Text(
                            '${_hoursPerDay.toStringAsFixed(_hoursPerDay % 1 == 0 ? 0 : 1)}h',
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: c.inkStrong)),
                      ),
                    ),
                    _stepperBtn(c, Icons.add_rounded,
                        () => setState(() => _hoursPerDay =
                            (_hoursPerDay + 0.5).clamp(0.5, 12))),
                  ],
                ),
                const SizedBox(height: 10),
                PlannerFieldRow(
                  icon: Icons.event_outlined,
                  label: _until == null
                      ? 'Study until — no end date'
                      : 'Study until ${_fmtDate(_until!)}',
                  placeholder: _until == null,
                  onTap: _pickUntilDate,
                  trailing: _until == null
                      ? null
                      : GestureDetector(
                          onTap: () => setState(() => _until = null),
                          child: Icon(Icons.close_rounded,
                              size: 18, color: c.inkMuted),
                        ),
                ),
              ],
            ),
          ),
        PlannerSection(
          icon: Icons.alarm_outlined,
          label: 'Daily study reminder',
          child: PlannerFieldRow(
            icon: Icons.notifications_active_outlined,
            label: 'At $_reminderTime',
            onTap: _pickReminderTime,
          ),
        ),
      ],
    );
  }

  Widget _generating(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: AnimatedBuilder(
        animation: _animCtrl,
        builder: (_, _) {
          final t = _animCtrl.value;
          // Four staged reveals across the animation's length.
          double stage(int i) => ((t * 4) - i).clamp(0.0, 1.0);
          return Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _stageIcon(c, Icons.menu_book_rounded, stage(0)),
                  const SizedBox(width: 14),
                  _stageIcon(c, Icons.rule_rounded, stage(1)),
                  const SizedBox(width: 14),
                  _stageIcon(c, Icons.style_rounded, stage(2)),
                ],
              ),
              const SizedBox(height: 24),
              Opacity(
                opacity: stage(3),
                child: Column(
                  children: [
                    // A SPINNER, not a tick. The tick was drawn the moment the
                    // reveal finished, so the screen announced success while
                    // the tasks were still being uploaded — the one thing a
                    // progress screen must never do.
                    SizedBox(
                      width: 34,
                      height: 34,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        // Determinate once the count is known, so a long upload
                        // shows how far along it is rather than spinning
                        // forever at the same speed.
                        value: _toSave > 0 ? (_saved / _toSave).clamp(0.0, 1.0) : null,
                        valueColor: AlwaysStoppedAnimation(c.primary),
                        backgroundColor: c.primary.withValues(alpha: 0.16),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                        _toSave > 0
                            ? 'Saving your plan…'
                            : 'Building your plan…',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700, color: c.inkStrong)),
                    if (_toSave > 0) ...[
                      const SizedBox(height: 4),
                      Text('$_saved of $_toSave task${_toSave == 1 ? '' : 's'}',
                          style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: c.inkSoft)),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _stageIcon(AppColors c, IconData icon, double reveal) {
    return Opacity(
      opacity: reveal,
      child: Transform.scale(
        scale: 0.7 + 0.3 * reveal,
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: c.primary.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, size: 24, color: c.primary),
        ),
      ),
    );
  }

  Widget _toggleTile(AppColors c,
      {required IconData icon,
      required String label,
      required String sub,
      required bool selected,
      required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? c.primaryTint : c.surface2,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
              color: selected ? c.primary : c.line, width: selected ? 1.4 : 1.2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: selected ? c.primary : c.inkMuted),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: selected ? c.primary : c.inkStrong)),
            Text(sub, style: TextStyle(fontSize: 10.5, color: c.inkMuted)),
          ],
        ),
      ),
    );
  }

  Widget _stepperBtn(AppColors c, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
            color: c.surface2,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: c.line)),
        child: Icon(icon, size: 20, color: c.inkStrong),
      ),
    );
  }

  Future<void> _pickUntilDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _until ?? now.add(const Duration(days: 14)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) setState(() => _until = picked);
  }

  Future<void> _pickReminderTime() async {
    final parts = _reminderTime.split(':');
    final init = TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 18,
        minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
    final picked = await showTimePicker(context: context, initialTime: init);
    if (picked != null) {
      final hh = picked.hour.toString().padLeft(2, '0');
      final mm = picked.minute.toString().padLeft(2, '0');
      setState(() => _reminderTime = '$hh:$mm');
    }
  }

  static String _fmtDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }
}
