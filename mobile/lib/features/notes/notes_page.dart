import 'package:flutter/material.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';

class _Note {
  String title;
  String body;
  String updated;
  _Note(this.title, this.body, this.updated);
}

class NotesPage extends StatefulWidget {
  const NotesPage({super.key});
  @override
  State<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<NotesPage> {
  final List<_Note> _notes = [
    _Note('Frank–Starling', 'Increased preload → increased stroke volume, up to a point. Links EDV to contractility.', 'Today'),
    _Note('ECG axis quick check', 'Lead I + aVF both positive → normal axis. I up, aVF down → check II.', 'Yesterday'),
    _Note('Exam to-dos', 'Redo arrhythmia set. Revise acid–base compensation. Flashcards: antibiotics.', '3 days ago'),
  ];

  Future<void> _edit({_Note? existing}) async {
    final titleC = TextEditingController(text: existing?.title ?? '');
    final bodyC = TextEditingController(text: existing?.body ?? '');
    final c = context.c;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: c.surface1,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 18,
          right: 18,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 18,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: c.lineStrong,
                    borderRadius: BorderRadius.circular(99)),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: titleC,
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong),
              decoration: const InputDecoration(hintText: 'Note title'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: bodyC,
              maxLines: 6,
              minLines: 4,
              style: TextStyle(fontSize: 14, color: c.inkMedium, height: 1.5),
              decoration: const InputDecoration(hintText: 'Write your note…'),
            ),
            const SizedBox(height: 16),
            AppButton('Save', expand: true, onPressed: () {
              setState(() {
                if (existing != null) {
                  existing.title = titleC.text.trim().isEmpty
                      ? 'Untitled'
                      : titleC.text.trim();
                  existing.body = bodyC.text.trim();
                  existing.updated = 'Just now';
                } else if (titleC.text.trim().isNotEmpty ||
                    bodyC.text.trim().isNotEmpty) {
                  _notes.insert(
                      0,
                      _Note(
                          titleC.text.trim().isEmpty
                              ? 'Untitled'
                              : titleC.text.trim(),
                          bodyC.text.trim(),
                          'Just now'));
                }
              });
              Navigator.of(ctx).pop();
            }),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 96),
            children: [
              Row(
                children: [
                  Text('My notes',
                      style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: c.inkStrong,
                          letterSpacing: -0.5)),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(
                        color: c.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(99)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                                color: c.accent, shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Text('On device',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: c.accent)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              for (final n in _notes)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GlassCard(
                    onTap: () => _edit(existing: n),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(n.title,
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: c.inkStrong)),
                        if (n.body.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(n.body,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 13, height: 1.45, color: c.inkSoft)),
                        ],
                        const SizedBox(height: 8),
                        Text(n.updated,
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: c.inkMuted)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          Positioned(
            right: 16,
            bottom: 16,
            child: FloatingActionButton.extended(
              onPressed: () => _edit(),
              backgroundColor: c.primary,
              foregroundColor:
                  Theme.of(context).brightness == Brightness.dark
                      ? const Color(0xFF04121F)
                      : Colors.white,
              icon: const Icon(Icons.edit_outlined, size: 19),
              label: const Text('New note',
                  style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}
