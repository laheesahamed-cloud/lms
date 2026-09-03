import 'package:file_selector/file_selector.dart' show XFile;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/tokens.dart';
import 'pdf_import.dart';
import 'personal_notes_store.dart';

/// Remembered on-device, not scoped per-user: it's a display preference, not
/// content, so there's no reason a second account on the same phone shouldn't
/// see whichever layout was last chosen.
const String _viewPrefKey = 'xyndrome.personal_notes.grid_view';

class PersonalNotesPage extends StatefulWidget {
  /// Null = root ("All Notes" + folder tiles). Set = one folder's contents —
  /// a genuinely separate pushed route, not a same-page state swap, so
  /// opening a folder gets the native slide-in and edge swipe-back that
  /// every other detail screen in the app has. Flat folders only, so this
  /// is the only nesting depth there is.
  final String? folderId;
  const PersonalNotesPage({super.key, this.folderId});

  @override
  State<PersonalNotesPage> createState() => _PersonalNotesPageState();
}

class _PersonalNotesPageState extends State<PersonalNotesPage> {
  List<PersonalNote> _notes = [];
  List<PersonalFolder> _folders = [];
  bool _loading = true;
  bool _gridView = false;
  PersonalFolder? _folder;

  @override
  void initState() {
    super.initState();
    _load();
    _loadViewPref();
  }

  Future<void> _loadViewPref() async {
    final prefs = await SharedPreferences.getInstance();
    final grid = prefs.getBool(_viewPrefKey) ?? false;
    if (mounted && grid != _gridView) setState(() => _gridView = grid);
  }

  Future<void> _toggleView() async {
    HapticFeedback.selectionClick();
    setState(() => _gridView = !_gridView);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_viewPrefKey, _gridView);
  }

  Future<void> _load() async {
    final notes = await PersonalNotesStore.load();
    final folders = await PersonalNotesStore.loadFolders();
    if (!mounted) return;
    PersonalFolder? folder;
    for (final f in folders) {
      if (f.id == widget.folderId) folder = f;
    }
    setState(() {
      _notes = notes;
      _folders = folders;
      _folder = folder;
      _loading = false;
    });
    // This route names a specific folder — if it was deleted (from here, or
    // another session on the same device) there's nothing left to show, so
    // pop back rather than rendering an empty page with no context for why.
    if (widget.folderId != null && folder == null && mounted) {
      Navigator.of(context).maybePop();
    }
  }

  List<PersonalNote> get _visibleNotes => widget.folderId == null
      ? _notes.where((n) => n.folderId == null).toList()
      : _notes.where((n) => n.folderId == widget.folderId).toList();

  Future<void> _createNote() async {
    final title = await _showTextDialog(context, title: 'New note', hint: 'Note title', initial: '');
    if (title == null) return;
    final note = await PersonalNotesStore.create(title);
    if (widget.folderId != null) {
      await PersonalNotesStore.moveNote(note.id, widget.folderId);
    }
    if (!mounted) return;
    await _load();
    _openNote(note);
  }

  Future<void> _createFolder() async {
    final name = await _showTextDialog(context, title: 'New folder', hint: 'Folder name', initial: '');
    if (name == null) return;
    await PersonalNotesStore.createFolder(name);
    await _load();
  }

  /// Pick a PDF and create a new note whose pages are its pages, ready to
  /// annotate — the "New note" / "New folder" counterpart for a PDF import.
  Future<void> _importPdf() async {
    // This runs from the "+" PopupMenuButton's onSelected, which fires the
    // instant its menu is *popped* — not once its 300ms close animation has
    // actually finished on screen (Navigator.pop's Future resolves on
    // removal from the route stack, the reverse transition is a separate,
    // still-running animation). Calling the native document picker while
    // that overlay is still animating away is what made this hang with
    // nothing appearing to happen — this is the fix that finished the one
    // before it (removing our own showDialog from in front of the picker
    // closed one such conflict; this closes the other).
    await Future<void>.delayed(const Duration(milliseconds: 350));
    if (!mounted) return;

    // The native document picker first, with nothing of ours on screen while
    // it's up. A Flutter showDialog opened before or during that
    // presentation fights it for the same modal slot — the picker never
    // actually appears and everything just hangs, which is exactly the
    // "spinner shows, nothing happens" this used to do.
    XFile? picked;
    try {
      picked = await PdfImportService.pickFile();
    } catch (e) {
      // Nothing was surfacing when this failed silently — an exception here
      // (e.g. a PlatformException from the picker) was an unhandled async
      // error with no try/catch anywhere above it, so Flutter's default
      // error zone just logged it and moved on: exactly "menu closes,
      // nothing happens", with no visible sign anything went wrong at all.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open the file picker: $e')),
        );
      }
      return;
    }
    if (picked == null || !mounted) return;

    // Only now — pure Dart/file-IO from here, nothing native-modal to
    // conflict with — show a spinner for the copy + page-count read, which
    // can take a moment for a large file.
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const AlertDialog(
        content: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
                width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 16),
            Text('Importing PDF…'),
          ],
        ),
      ),
    );
    final result = await PdfImportService.process(picked);
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop(); // dismiss the spinner
    if (result == null || !mounted) return;

    final note =
        await PersonalNotesStore.createFromPdf(result.suggestedTitle, result.pages);
    if (widget.folderId != null) {
      await PersonalNotesStore.moveNote(note.id, widget.folderId);
    }
    if (!mounted) return;
    await _load();
    _openNote(note);
  }

  Future<void> _renameNote(PersonalNote note) async {
    final title = await _showTextDialog(context, title: 'Rename note', hint: 'Note title', initial: note.title);
    if (title == null || !mounted) return;
    await PersonalNotesStore.rename(note.id, title);
    await _load();
  }

  Future<void> _renameFolder(PersonalFolder folder) async {
    final name = await _showTextDialog(context, title: 'Rename folder', hint: 'Folder name', initial: folder.name);
    if (name == null || !mounted) return;
    await PersonalNotesStore.renameFolder(folder.id, name);
    await _load();
  }

  Future<void> _deleteNote(PersonalNote note) async {
    final ok = await _confirm(context,
        title: 'Delete note?', message: 'This will permanently delete "${note.title}" and all its pages.');
    if (ok != true || !mounted) return;
    await PersonalNotesStore.delete(note.id);
    await _load();
  }

  Future<void> _deleteFolder(PersonalFolder folder) async {
    final ok = await _confirm(context,
        title: 'Delete folder?',
        message: 'This deletes "${folder.name}" only — its notes move back to All Notes.');
    if (ok != true || !mounted) return;
    await PersonalNotesStore.deleteFolder(folder.id);
    if (!mounted) return;
    // Deleting the folder this very route is showing — there's nothing left
    // to display, so leave instead of reloading into an empty page.
    if (widget.folderId == folder.id) {
      Navigator.of(context).maybePop();
    } else {
      await _load();
    }
  }

  Future<void> _openFolder(PersonalFolder folder) async {
    await context.push('/app/my-notes/folder/${folder.id}');
    // Refresh on return: a note may have moved in or out while that route
    // was open, or the folder itself renamed.
    if (mounted) _load();
  }

  Future<void> _moveNote(PersonalNote note, String? folderId) async {
    if (note.folderId == folderId) return;
    await PersonalNotesStore.moveNote(note.id, folderId);
    HapticFeedback.selectionClick();
    await _load();
  }

  Future<void> _pickFolderFor(PersonalNote note) async {
    final target = await showModalBottomSheet<Object?>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.notes_rounded),
              title: const Text('All Notes'),
              trailing: note.folderId == null ? const Icon(Icons.check_rounded) : null,
              onTap: () => Navigator.pop(sheetCtx, _kNoFolder),
            ),
            for (final f in _folders)
              ListTile(
                leading: const Icon(Icons.folder_outlined),
                title: Text(f.name),
                trailing: note.folderId == f.id ? const Icon(Icons.check_rounded) : null,
                onTap: () => Navigator.pop(sheetCtx, f),
              ),
          ],
        ),
      ),
    );
    if (target == null) return;
    await _moveNote(note, target == _kNoFolder ? null : (target as PersonalFolder).id);
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
    final folder = _folder;
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
              child: Row(
                children: [
                  // Root and folder are both real routes now, so both pop —
                  // the special-case branch this used to need (setState back
                  // to root vs. Navigator.pop) is gone along with the state
                  // it was branching on.
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkMedium),
                  ),
                  Expanded(
                    child: Text(folder?.name ?? 'My Notes',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
                  ),
                  IconButton(
                    tooltip: _gridView ? 'List view' : 'Grid view',
                    onPressed: _toggleView,
                    icon: Icon(
                        _gridView ? Icons.view_list_rounded : Icons.grid_view_rounded,
                        size: 20,
                        color: c.inkMuted),
                  ),
                  if (folder != null)
                    PopupMenuButton<String>(
                      onSelected: (v) {
                        if (v == 'rename') {
                          _renameFolder(folder);
                        } else if (v == 'delete') {
                          _deleteFolder(folder);
                        }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(value: 'rename', child: Text('Rename folder')),
                        const PopupMenuItem(value: 'delete', child: Text('Delete folder', style: TextStyle(color: Colors.red))),
                      ],
                      icon: Icon(Icons.more_vert_rounded, size: 20, color: c.inkMuted),
                    )
                  else
                    PopupMenuButton<String>(
                      onSelected: (v) {
                        if (v == 'note') {
                          _createNote();
                        } else if (v == 'folder') {
                          _createFolder();
                        } else if (v == 'pdf') {
                          _importPdf();
                        }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(value: 'note', child: Text('New note')),
                        const PopupMenuItem(value: 'folder', child: Text('New folder')),
                        const PopupMenuItem(value: 'pdf', child: Text('Import PDF')),
                      ],
                      icon: Icon(Icons.add_rounded, size: 24, color: c.primary),
                    ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _buildBody(c),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AppColors c) {
    final showFolders = widget.folderId == null && _folders.isNotEmpty;
    final notes = _visibleNotes;

    if (!showFolders && notes.isEmpty) return _empty(c);

    // Grid tiles are built the same way regardless of layout — only the
    // container around them (a full-width column vs a 2-up grid) differs.
    Widget folderItem(PersonalFolder f) => _gridView
        ? _FolderGridTile(
            folder: f,
            count: _notes.where((n) => n.folderId == f.id).length,
            onTap: () => _openFolder(f),
            onRename: () => _renameFolder(f),
            onDelete: () => _deleteFolder(f),
            onAcceptNote: (n) => _moveNote(n, f.id),
          )
        : _FolderCard(
            folder: f,
            count: _notes.where((n) => n.folderId == f.id).length,
            onTap: () => _openFolder(f),
            onRename: () => _renameFolder(f),
            onDelete: () => _deleteFolder(f),
            onAcceptNote: (n) => _moveNote(n, f.id),
          );

    Widget noteItem(PersonalNote n) => _gridView
        ? _DraggableNoteGridTile(
            note: n,
            onTap: () => _openNote(n),
            onRename: () => _renameNote(n),
            onDelete: () => _deleteNote(n),
            onMove: () => _pickFolderFor(n),
          )
        : _DraggableNoteCard(
            note: n,
            onTap: () => _openNote(n),
            onRename: () => _renameNote(n),
            onDelete: () => _deleteNote(n),
            onMove: () => _pickFolderFor(n),
          );

    // A grid section is its own non-scrolling GridView, shrink-wrapped inside
    // the outer scroll — that keeps "Folders" / "Notes" as plain full-width
    // headers between two grids without hand-rolling a sliver layout.
    Widget grid(List<Widget> items) => GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.95,
          ),
          itemBuilder: (_, i) => items[i],
        );

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        // Dragging a note here (from the folder view) moves it back out to
        // "All Notes" — the drag counterpart to opening a folder tile below.
        if (widget.folderId != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _BackToAllNotesTarget(onAccept: (n) => _moveNote(n, null)),
          ),
        if (showFolders) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, left: 2),
            child: Text('Folders', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.inkMuted)),
          ),
          if (_gridView)
            grid([for (final f in _folders) folderItem(f)])
          else
            for (final f in _folders)
              Padding(padding: const EdgeInsets.only(bottom: 10), child: folderItem(f)),
          if (notes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 14, bottom: 8, left: 2),
              child: Text('Notes', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.inkMuted)),
            ),
        ],
        if (_gridView)
          grid([for (final n in notes) noteItem(n)])
        else
          for (final n in notes)
            Padding(padding: const EdgeInsets.only(bottom: 10), child: noteItem(n)),
      ],
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

  Future<String?> _showTextDialog(BuildContext ctx,
      {required String title, required String hint, required String initial}) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(hintText: hint),
          textCapitalization: TextCapitalization.sentences,
          // Dismiss the keyboard when tapping anywhere outside the field —
          // inside a dialog the app-level tap-to-unfocus never fires.
          onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
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

  Future<bool?> _confirm(BuildContext ctx, {required String title, required String message}) => showDialog<bool>(
        context: ctx,
        builder: (dialogCtx) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx, true),
              child: const Text('Delete', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );
}

/// Sentinel distinguishing "user picked All Notes" from "sheet dismissed with
/// nothing picked" in the bottom-sheet `Future<Object?>` result.
const Object _kNoFolder = Object();

class _DraggableNoteCard extends StatelessWidget {
  final PersonalNote note;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;
  final VoidCallback onMove;
  const _DraggableNoteCard({
    required this.note,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
    required this.onMove,
  });

  @override
  Widget build(BuildContext context) {
    return LongPressDraggable<PersonalNote>(
      data: note,
      // childDragAnchorStrategy (Flutter's default) anchors the feedback to
      // the exact point touched, so the ghost starts where the real card was
      // and tracks the finger from there. pointerDragAnchorStrategy instead
      // snaps the feedback's top-left corner to the finger the instant the
      // drag starts, regardless of where on the card you pressed — felt like
      // the card jumping away, worse the bigger the tile (hence more visible
      // in the grid than the list).
      dragAnchorStrategy: childDragAnchorStrategy,
      feedback: Material(
        color: Colors.transparent,
        child: Opacity(opacity: 0.85, child: SizedBox(width: 260, child: _NoteCard(note: note))),
      ),
      childWhenDragging: Opacity(opacity: 0.35, child: _NoteCard(note: note)),
      child: _NoteCard(note: note, onTap: onTap, onRename: onRename, onDelete: onDelete, onMove: onMove),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final PersonalNote note;
  final VoidCallback? onTap;
  final VoidCallback? onRename;
  final VoidCallback? onDelete;
  final VoidCallback? onMove;
  const _NoteCard({required this.note, this.onTap, this.onRename, this.onDelete, this.onMove});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap == null ? null : () { HapticFeedback.selectionClick(); onTap!(); },
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
            if (onRename != null || onDelete != null || onMove != null)
              PopupMenuButton<String>(
                onSelected: (v) {
                  if (v == 'rename') { onRename?.call(); }
                  else if (v == 'move') { onMove?.call(); }
                  else if (v == 'delete') { onDelete?.call(); }
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'rename', child: Text('Rename')),
                  const PopupMenuItem(value: 'move', child: Text('Move to folder…')),
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

class _FolderCard extends StatelessWidget {
  final PersonalFolder folder;
  final int count;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;
  final ValueChanged<PersonalNote> onAcceptNote;
  const _FolderCard({
    required this.folder,
    required this.count,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
    required this.onAcceptNote,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return DragTarget<PersonalNote>(
      onWillAcceptWithDetails: (details) => details.data.folderId != folder.id,
      onAcceptWithDetails: (details) => onAcceptNote(details.data),
      builder: (dragCtx, candidates, rejects) {
        final hovering = candidates.isNotEmpty;
        return GestureDetector(
          onTap: () { HapticFeedback.selectionClick(); onTap(); },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
            decoration: BoxDecoration(
              color: hovering ? c.primaryTint : c.cardElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: hovering ? c.primary : c.line, width: hovering ? 1.5 : 1),
            ),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: c.primaryTint,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.folder_outlined, size: 20, color: c.primary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(folder.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.inkStrong)),
                ),
                Text('$count', style: TextStyle(fontSize: 13, color: c.inkMuted)),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right_rounded, size: 18, color: c.inkMuted),
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
      },
    );
  }
}

class _DraggableNoteGridTile extends StatelessWidget {
  final PersonalNote note;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;
  final VoidCallback onMove;
  const _DraggableNoteGridTile({
    required this.note,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
    required this.onMove,
  });

  @override
  Widget build(BuildContext context) {
    return LongPressDraggable<PersonalNote>(
      data: note,
      // childDragAnchorStrategy (Flutter's default) anchors the feedback to
      // the exact point touched, so the ghost starts where the real card was
      // and tracks the finger from there. pointerDragAnchorStrategy instead
      // snaps the feedback's top-left corner to the finger the instant the
      // drag starts, regardless of where on the card you pressed — felt like
      // the card jumping away, worse the bigger the tile (hence more visible
      // in the grid than the list).
      dragAnchorStrategy: childDragAnchorStrategy,
      feedback: Material(
        color: Colors.transparent,
        child: Opacity(
            opacity: 0.85,
            child: SizedBox(width: 150, height: 150, child: _NoteGridTile(note: note))),
      ),
      childWhenDragging: Opacity(opacity: 0.35, child: _NoteGridTile(note: note)),
      child: _NoteGridTile(
          note: note, onTap: onTap, onRename: onRename, onDelete: onDelete, onMove: onMove),
    );
  }
}

/// Compact tile for the grid layout: same actions as [_NoteCard], smaller
/// footprint — no created-date, a two-line title cap, menu tucked into the
/// corner instead of a full row.
class _NoteGridTile extends StatelessWidget {
  final PersonalNote note;
  final VoidCallback? onTap;
  final VoidCallback? onRename;
  final VoidCallback? onDelete;
  final VoidCallback? onMove;
  const _NoteGridTile({required this.note, this.onTap, this.onRename, this.onDelete, this.onMove});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap == null ? null : () { HapticFeedback.selectionClick(); onTap!(); },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: c.cardElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: c.primaryTint,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.sticky_note_2_outlined, size: 22, color: c.primary),
                ),
                const Spacer(),
                if (onRename != null || onDelete != null || onMove != null)
                  PopupMenuButton<String>(
                    padding: EdgeInsets.zero,
                    onSelected: (v) {
                      if (v == 'rename') { onRename?.call(); }
                      else if (v == 'move') { onMove?.call(); }
                      else if (v == 'delete') { onDelete?.call(); }
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'rename', child: Text('Rename')),
                      const PopupMenuItem(value: 'move', child: Text('Move to folder…')),
                      const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
                    ],
                    icon: Icon(Icons.more_vert_rounded, size: 18, color: c.inkMuted),
                  ),
              ],
            ),
            const Spacer(),
            Text(note.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.inkStrong)),
            const SizedBox(height: 3),
            Text('${note.pageCount} page${note.pageCount == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
          ],
        ),
      ),
    );
  }
}

/// Grid counterpart of [_FolderCard] — same drag-target behaviour, compact
/// layout to match [_NoteGridTile].
class _FolderGridTile extends StatelessWidget {
  final PersonalFolder folder;
  final int count;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;
  final ValueChanged<PersonalNote> onAcceptNote;
  const _FolderGridTile({
    required this.folder,
    required this.count,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
    required this.onAcceptNote,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return DragTarget<PersonalNote>(
      onWillAcceptWithDetails: (details) => details.data.folderId != folder.id,
      onAcceptWithDetails: (details) => onAcceptNote(details.data),
      builder: (dragCtx, candidates, rejects) {
        final hovering = candidates.isNotEmpty;
        return GestureDetector(
          onTap: () { HapticFeedback.selectionClick(); onTap(); },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: hovering ? c.primaryTint : c.cardElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: hovering ? c.primary : c.line, width: hovering ? 1.5 : 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: c.primaryTint,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.folder_outlined, size: 22, color: c.primary),
                    ),
                    const Spacer(),
                    PopupMenuButton<String>(
                      padding: EdgeInsets.zero,
                      onSelected: (v) {
                        if (v == 'rename') { onRename(); } else if (v == 'delete') { onDelete(); }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(value: 'rename', child: Text('Rename')),
                        const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
                      ],
                      icon: Icon(Icons.more_vert_rounded, size: 18, color: c.inkMuted),
                    ),
                  ],
                ),
                const Spacer(),
                Text(folder.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.inkStrong)),
                const SizedBox(height: 3),
                Text('$count note${count == 1 ? '' : 's'}',
                    style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Drop target shown at the top of a folder's note list so dragging a note
/// onto it releases the note back to "All Notes" — the reverse of dragging a
/// note onto a folder tile from the root view.
class _BackToAllNotesTarget extends StatelessWidget {
  final ValueChanged<PersonalNote> onAccept;
  const _BackToAllNotesTarget({required this.onAccept});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return DragTarget<PersonalNote>(
      onAcceptWithDetails: (details) => onAccept(details.data),
      builder: (dragCtx, candidates, rejects) {
        final hovering = candidates.isNotEmpty;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: hovering ? c.primaryTint : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: hovering ? c.primary : c.line, style: BorderStyle.solid),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_upward_rounded, size: 16, color: hovering ? c.primary : c.inkMuted),
              const SizedBox(width: 8),
              Text('Drag here to move out of this folder',
                  style: TextStyle(fontSize: 12.5, color: hovering ? c.primary : c.inkMuted)),
            ],
          ),
        );
      },
    );
  }
}
