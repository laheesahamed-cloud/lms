import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/study_reminders.dart';
import '../../theme/tokens.dart';
import '../courses/courses_repository.dart';
import 'plan_generator.dart';

/// "Generate Plan" wizard: ask study-hours/date-range/content details, run a
/// short generating animation while [generateStudyPlan] actually does the
/// work, then close. Returns the created tasks' ids (null if cancelled, empty
/// if nothing matched) so the caller can badge them as "new" and toast/refresh.
Future<List<int>?> showGeneratePlanSheet(BuildContext context) {
  return showModalBottomSheet<List<int>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.c.page,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => const _GeneratePlanSheet(),
  );
}

class _GeneratePlanSheet extends ConsumerStatefulWidget {
  const _GeneratePlanSheet();
  @override
  ConsumerState<_GeneratePlanSheet> createState() => _GeneratePlanSheetState();
}

enum _Phase { details, generating }

class _GeneratePlanSheetState extends ConsumerState<_GeneratePlanSheet>
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
    );
    // Reminder time chosen here feeds the SAME prefs the Planner's own
    // Reminders sheet reads/writes — no separate reminder mechanism.
    final prefs = await StudyReminders.getPrefs();
    await StudyReminders.savePrefs(
        prefs.copyWith(customEnabled: true, customTime: _reminderTime));

    // Let the animation play its minimum length even if generation itself
    // finishes fast (cached data) — and never dismiss before generation
    // actually completes if it's slower than the animation.
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
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: _phase == _Phase.details ? _details(context) : _generating(context),
    );
  }

  Widget _details(BuildContext context) {
    final c = context.c;
    final coursesAsync = ref.watch(studentCoursesProvider);
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _grabber(c),
          Text('Generate a study plan',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 4),
          Text('Fills your Planner from what you still have left to study.',
              style: TextStyle(fontSize: 13, color: c.inkSoft)),
          const SizedBox(height: 18),

          _label(c, 'Course(s)'),
          const SizedBox(height: 8),
          coursesAsync.when(
            loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
            error: (e, _) => Text('Could not load courses.',
                style: TextStyle(color: c.inkSoft, fontSize: 13)),
            data: (courses) => Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                for (final course in courses)
                  _chip(c, course.title, _selectedCourseIds.contains(course.id),
                      () => setState(() {
                            if (!_selectedCourseIds.remove(course.id)) {
                              _selectedCourseIds.add(course.id);
                            }
                          })),
              ],
            ),
          ),
          const SizedBox(height: 16),

          _label(c, 'Include'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              _chip(c, 'Lessons', _includeLessons,
                  () => setState(() => _includeLessons = !_includeLessons)),
              _chip(c, 'Q-Bank', _includeQuizzes,
                  () => setState(() => _includeQuizzes = !_includeQuizzes)),
              _chip(c, 'Flashcards', _includeFlashcards,
                  () => setState(() => _includeFlashcards = !_includeFlashcards)),
            ],
          ),
          const SizedBox(height: 16),

          _label(c, 'Organize'),
          const SizedBox(height: 8),
          Row(
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

          // These two only mean anything when the plan is actually being
          // spread across days — hidden entirely for "By subject", where
          // nothing gets a due date at all.
          if (_organizeByDay) ...[
            const SizedBox(height: 16),
            _label(c, 'Study hours per day'),
            const SizedBox(height: 8),
            Row(
              children: [
                _stepperBtn(c, Icons.remove_rounded,
                    () => setState(() => _hoursPerDay = (_hoursPerDay - 0.5).clamp(0.5, 12))),
                Expanded(
                  child: Center(
                    child: Text('${_hoursPerDay.toStringAsFixed(_hoursPerDay % 1 == 0 ? 0 : 1)}h',
                        style: TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
                  ),
                ),
                _stepperBtn(c, Icons.add_rounded,
                    () => setState(() => _hoursPerDay = (_hoursPerDay + 0.5).clamp(0.5, 12))),
              ],
            ),
            const SizedBox(height: 16),
            _label(c, 'Study until (optional)'),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickUntilDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                decoration:
                    BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Icons.event_outlined, size: 17, color: c.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                          _until == null
                              ? 'No end date — schedule everything selected'
                              : _fmtDate(_until!),
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600, color: c.inkStrong)),
                    ),
                    if (_until != null)
                      GestureDetector(
                        onTap: () => setState(() => _until = null),
                        child: Icon(Icons.close_rounded, size: 18, color: c.inkMuted),
                      ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),

          _label(c, 'Daily study reminder'),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickReminderTime,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
              decoration:
                  BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.alarm_outlined, size: 17, color: c.primary),
                  const SizedBox(width: 8),
                  Text('At $_reminderTime',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: c.inkStrong)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: _selectedCourseIds.isEmpty ? null : _generate,
              child: const Text('Generate plan',
                  style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _generating(BuildContext context) {
    final c = context.c;
    return SizedBox(
      height: 300,
      child: AnimatedBuilder(
        animation: _animCtrl,
        builder: (_, _) {
          final t = _animCtrl.value;
          // Four staged reveals across the animation's length.
          double stage(int i) => ((t * 4) - i).clamp(0.0, 1.0);
          return Column(
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
                    Icon(Icons.check_circle_rounded, size: 40, color: c.primary),
                    const SizedBox(height: 10),
                    Text('Building your plan…',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700, color: c.inkStrong)),
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

  Widget _label(AppColors c, String t) => Text(t.toUpperCase(),
      style: TextStyle(
          fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: c.inkSoft));

  Widget _chip(AppColors c, String label, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
            color: on ? c.primary : c.surface2, borderRadius: BorderRadius.circular(9)),
        child: Text(label,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: on ? Colors.white : c.inkMedium)),
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
          color: selected ? c.primary.withValues(alpha: 0.12) : c.surface2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? c.primary : Colors.transparent, width: 1.4),
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
        decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(10)),
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

Widget _grabber(AppColors c) => Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(color: c.inkMuted, borderRadius: BorderRadius.circular(2)),
      ),
    );
