import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../lessons/lesson_canvas_page.dart';
import 'personal_notes_store.dart';

/// One continuous tall canvas for a personal note.
/// Pages appear stacked vertically — scroll down to reach the next page.
/// Tapping "+ Page" in the header extends the canvas downward.
class PersonalNoteCanvasPage extends StatefulWidget {
  final String noteId;
  final String title;
  final int initialPageCount;

  const PersonalNoteCanvasPage({
    super.key,
    required this.noteId,
    required this.title,
    required this.initialPageCount,
  });

  @override
  State<PersonalNoteCanvasPage> createState() => _PersonalNoteCanvasPageState();
}

class _PersonalNoteCanvasPageState extends State<PersonalNoteCanvasPage> {
  late int _pageCount;

  @override
  void initState() {
    super.initState();
    _pageCount = widget.initialPageCount;
  }

  // All pages share a single canvas ink key (no per-page suffix).
  String get _lessonId => 'pnote-${widget.noteId}';

  Future<void> _addPage() async {
    HapticFeedback.mediumImpact();
    final newTotal = await PersonalNotesStore.addPage(widget.noteId);
    setState(() => _pageCount = newTotal);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Page $newTotal added — scroll down to write'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return LessonCanvasPage(
      // Stable key — canvas persists across page additions (ink never lost).
      key: ValueKey(_lessonId),
      lessonId: _lessonId,
      isPersonal: true,
      personalTitle: widget.title,
      personalPageCount: _pageCount,
      pageNav: _AddPageButton(onAdd: _addPage),
    );
  }
}

class _AddPageButton extends StatelessWidget {
  final VoidCallback onAdd;
  const _AddPageButton({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurface;
    return GestureDetector(
      onTap: onAdd,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add_rounded, size: 14, color: color),
            const SizedBox(width: 4),
            Text('+ Page',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: color)),
          ],
        ),
      ),
    );
  }
}
