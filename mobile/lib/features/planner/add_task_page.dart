import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import 'planner_form_kit.dart';

/// What the form hands back to the Planner.
class NewTask {
  final String title;
  final DateTime? date;
  final String category;
  final String priority;
  const NewTask(this.title, this.date, this.category, this.priority);
}

/// "New task" — a full screen rather than the bottom sheet it used to be. The
/// sheet had to share the viewport with the keyboard, which left the category
/// and priority rows scrolling in a few hundred points of space.
class AddTaskPage extends StatefulWidget {
  const AddTaskPage({super.key});
  @override
  State<AddTaskPage> createState() => _AddTaskPageState();
}

class _AddTaskPageState extends State<AddTaskPage> {
  final _controller = TextEditingController();
  DateTime? _date;
  String _category = 'general';
  String _priority = 'medium';

  static const _categories = [
    'general', 'lesson', 'quiz', 'exam', 'review', 'flashcards', 'class',
  ];

  /// Priority keeps its own colours — green/amber/red carry meaning the hero
  /// gradient would throw away.
  static const _priorities = ['low', 'medium', 'high'];

  @override
  void initState() {
    super.initState();
    // Repaints the CTA as the title goes from empty to not.
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color _priorityColor(AppColors c, String p) => switch (p) {
        'low' => c.success,
        'high' => c.error,
        _ => c.warning,
      };

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

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final ready = _controller.text.trim().isNotEmpty;

    return PlannerFormPage(
      titleTop: 'Create',
      titleAccent: 'New Task',
      subtitle: 'Plan your study and stay consistent',
      heroIcon: Icons.task_alt_rounded,
      cta: AppButton(
        'Add task',
        kind: AppButtonKind.cta,
        expand: true,
        leading: const Icon(Icons.add_rounded, size: 19, color: Colors.white),
        onPressed: ready
            ? () => Navigator.of(context)
                .pop(NewTask(_controller.text, _date, _category, _priority))
            : null,
      ),
      children: [
        PlannerSection(
          icon: Icons.description_outlined,
          label: 'Task title',
          child: TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.done,
            onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
            style: TextStyle(
                color: c.inkStrong, fontSize: 15, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: 'What do you need to study?',
              hintStyle: TextStyle(
                  color: c.inkMuted, fontSize: 15, fontWeight: FontWeight.w500),
              filled: true,
              fillColor: c.surface2,
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
              suffixIcon: _controller.text.isEmpty
                  ? null
                  : IconButton(
                      icon: Icon(Icons.cancel_rounded,
                          size: 19, color: c.inkMuted),
                      onPressed: () => _controller.clear(),
                    ),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(13),
                  borderSide: BorderSide(color: c.line)),
              focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(13),
                  borderSide: BorderSide(color: c.primary, width: 1.4)),
            ),
          ),
        ),
        PlannerSection(
          icon: Icons.grid_view_rounded,
          label: 'Category',
          child: Wrap(
            spacing: 8,
            runSpacing: 10,
            children: [
              for (final cat in _categories)
                PlannerChoice(
                  icon: plannerCategoryIcon(cat),
                  label: plannerTitleCase(cat),
                  selected: _category == cat,
                  onTap: () => setState(() => _category = cat),
                ),
            ],
          ),
        ),
        PlannerSection(
          icon: Icons.flag_outlined,
          label: 'Priority',
          child: Row(
            children: [
              for (final p in _priorities) ...[
                Expanded(
                  child: PlannerChoice(
                    icon: Icons.flag_rounded,
                    label: plannerTitleCase(p),
                    selected: _priority == p,
                    accent: _priorityColor(c, p),
                    onTap: () => setState(() => _priority = p),
                  ),
                ),
                if (p != _priorities.last) const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        PlannerSection(
          icon: Icons.event_outlined,
          label: 'Due date',
          trailing: Text('optional',
              style: TextStyle(fontSize: 12, color: c.inkMuted)),
          child: PlannerFieldRow(
            icon: Icons.calendar_today_rounded,
            label: _date == null ? 'Select a date' : _fmt(_date!),
            placeholder: _date == null,
            onTap: _pickDate,
            trailing: _date == null
                ? null
                : GestureDetector(
                    onTap: () => setState(() => _date = null),
                    child:
                        Icon(Icons.close_rounded, size: 18, color: c.inkMuted),
                  ),
          ),
        ),
      ],
    );
  }

  static String _fmt(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }
}
