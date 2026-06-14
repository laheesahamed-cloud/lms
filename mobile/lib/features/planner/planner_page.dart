import 'package:flutter/material.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

class _Task {
  final String title;
  final String tag;
  final Color Function(AppColors) tint;
  bool done;
  _Task(this.title, this.tag, this.tint, {this.done = false});
}

class _Group {
  final String day;
  final List<_Task> tasks;
  _Group(this.day, this.tasks);
}

class PlannerPage extends StatefulWidget {
  const PlannerPage({super.key});
  @override
  State<PlannerPage> createState() => _PlannerPageState();
}

class _PlannerPageState extends State<PlannerPage> {
  late final List<_Group> _groups = [
    _Group('Today', [
      _Task('Cardiology Q-Bank — 20 questions', 'Quiz', (c) => c.accent),
      _Task('Review 8 due flashcards', 'Flashcards', (c) => c.primary,
          done: true),
      _Task('Read: Heart failure pathophysiology', 'Lesson', (c) => c.success),
    ]),
    _Group('Tomorrow', [
      _Task('Renal mock exam', 'Exam', (c) => c.error),
      _Task('Acid–base notes', 'Lesson', (c) => c.success),
    ]),
    _Group('This week', [
      _Task('Respiratory module', 'Course', (c) => c.warning),
      _Task('Endocrine flashcards deck', 'Flashcards', (c) => c.primary),
    ]),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('TODAY’S AGENDA',
              style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  color: c.accent)),
          const SizedBox(height: 4),
          Text('Planner',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.5)),
          const SizedBox(height: 18),
          for (final g in _groups) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 8),
              child: Text(g.day,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: c.inkMedium)),
            ),
            GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Column(
                children: [
                  for (int i = 0; i < g.tasks.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: c.line),
                    _TaskRow(
                      task: g.tasks[i],
                      onToggle: () =>
                          setState(() => g.tasks[i].done = !g.tasks[i].done),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ],
      ),
    );
  }
}

class _TaskRow extends StatelessWidget {
  final _Task task;
  final VoidCallback onToggle;
  const _TaskRow({required this.task, required this.onToggle});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = task.tint(c);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Row(
          children: [
            AnimatedContainer(
              duration: AppDur.micro,
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: task.done ? c.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(7),
                border: task.done
                    ? null
                    : Border.all(color: c.lineStrong, width: 1.5),
              ),
              child: task.done
                  ? const Icon(Icons.check, size: 15, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Text(task.title,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      decoration:
                          task.done ? TextDecoration.lineThrough : null,
                      color: task.done ? c.inkMuted : c.inkStrong)),
            ),
            const SizedBox(width: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(task.tag,
                  style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: tint)),
            ),
          ],
        ),
      ),
    );
  }
}
