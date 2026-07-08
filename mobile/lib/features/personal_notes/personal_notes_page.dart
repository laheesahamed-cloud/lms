import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'personal_notes_store.dart';

class PersonalNotesPage extends StatefulWidget {
  const PersonalNotesPage({super.key});

  @override
  State<PersonalNotesPage> createState() => _PersonalNotesPageState();
}

class _PersonalNotesPageState extends State<PersonalNotesPage> {
  List<PersonalNote> _notes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final notes = await PersonalNotesStore.load();
    if (mounted) setState(() { _notes = notes; _loading = false; });
  }

  Future<void> _createNote() async {
    final title = await _showTitleDialog(context, '');
    if (title == null) return;
    final note = await PersonalNotesStore.create(title);
    if (!mounted) return;
    setState(() => _notes.insert(0, note));
    _openNote(note);
  }

  Future<void> _rename(PersonalNote note) async {
    final title = await _showTitleDialog(context, note.title);
    if (title == null || !mounted) return;
    await PersonalNotesStore.rename(note.id, title);
    await _load();
  }

  Future<void> _delete(PersonalNote note) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Delete note?'),
        content: Text('This will permanently delete "${note.title}" and all its pages.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await PersonalNotesStore.delete(note.id);
    setState(() => _notes.removeWhere((n) => n.id == note.id));
  }

  Future<void> _openNote(PersonalNote note) async {
    await context.push(
        '/app/my-notes/${note.id}?title=${Uri.encodeComponent(note.title)}&pages=${note.pageCount}');
    // Refresh on return so a page added inside the note (or a rename) shows
    // immediately instead of staying stale until the app restarts.
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkMedium),
                  ),
                  Expanded(
                    child: Text('My Notes',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
                  ),
                  IconButton(
                    onPressed: _createNote,
                    icon: Icon(Icons.add_rounded, size: 24, color: c.primary),
                    tooltip: 'New note',
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _notes.isEmpty
                      ? _empty(c)
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                          itemCount: _notes.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => _NoteCard(
                            note: _notes[i],
                            onTap: () => _openNote(_notes[i]),
                            onRename: () => _rename(_notes[i]),
                            onDelete: () => _delete(_notes[i]),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _empty(AppColors c) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.edit_note_rounded, size: 48, color: c.inkMuted),
            const SizedBox(height: 14),
            Text('No notes yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.inkStrong)),
            const SizedBox(height: 8),
            Text('Tap + to create your first note', style: TextStyle(fontSize: 14, color: c.inkSoft)),
          ],
        ),
      );

  Future<String?> _showTitleDialog(BuildContext ctx, String initial) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: Text(initial.isEmpty ? 'New note' : 'Rename note'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Note title'),
          textCapitalization: TextCapitalization.sentences,
          onSubmitted: (v) => Navigator.pop(dialogCtx, v),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx, controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final PersonalNote note;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;
  const _NoteCard({required this.note, required this.onTap, required this.onRename, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: () { HapticFeedback.selectionClick(); onTap(); },
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
        decoration: BoxDecoration(
          color: c.cardElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.line),
        ),
        child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: c.primaryTint,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.sticky_note_2_outlined, size: 20, color: c.primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(note.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.inkStrong)),
                  const SizedBox(height: 3),
                  Text(
                    '${note.pageCount} page${note.pageCount == 1 ? '' : 's'} · ${_formatDate(note.createdAt)}',
                    style: TextStyle(fontSize: 12, color: c.inkMuted),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'rename') { onRename(); } else if (v == 'delete') { onDelete(); }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'rename', child: Text('Rename')),
                const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
              ],
              icon: Icon(Icons.more_vert_rounded, size: 20, color: c.inkMuted),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inDays == 0) return 'Today';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.day}/${d.month}/${d.year}';
  }
}
