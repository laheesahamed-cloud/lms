import 'dart:ui' as ui;

import 'package:file_selector/file_selector.dart' show XFile;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/tokens.dart';
import 'pdf_import.dart';
import 'personal_notes_store.dart';

/// Remembered on-device, not scoped per-user: it's a display preference, not
/// content, so there's no reason a second account on the same phone shouldn't
/// see whichever layout was last chosen.
const String _viewPrefKey = 'xyndrome.personal_notes.grid_view';

/// Cover-colour palette for the grid's notebook/folder illustrations — cycled
/// by a stable hash of each item's id, so a note or folder always gets the
/// same colour across rebuilds/relaunches instead of a random one each time,
/// without needing to persist a colour choice anywhere.
const _kCoverPalette = <Color>[
  Color(0xFF5E7CA6), Color(0xFFB0685F), Color(0xFF5B93A5), Color(0xFFA8895A),
  Color(0xFF8878A8), Color(0xFF7E9BC2), Color(0xFFB0728F), Color(0xFFBE7E5A),
  Color(0xFF6C9B77), Color(0xFF9E9057),
];

String _formatDate(DateTime d) {
  final now = DateTime.now();
  final diff = now.difference(d);
  if (diff.inDays == 0) return 'Today';
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${d.day}/${d.month}/${d.year}';
}

Color _coverColorFor(String id) {
  var hash = 0;
  for (final unit in id.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  return _kCoverPalette[hash % _kCoverPalette.length];
}

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

  // Multi-select: entered via the header's checklist button, exited via its
  // "Cancel" or after a bulk action completes. Notes and folders are tracked
  // separately since only notes can be bulk-moved (folders are flat, nothing
  // to move them into).
  bool _selecting = false;
  final Set<String> _selectedNotes = {};
  final Set<String> _selectedFolders = {};
  int get _selectionCount => _selectedNotes.length + _selectedFolders.length;

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

  void _enterSelection() {
    HapticFeedback.selectionClick();
    setState(() {
      _selecting = true;
      _selectedNotes.clear();
      _selectedFolders.clear();
    });
  }

  void _exitSelection() {
    setState(() {
      _selecting = false;
      _selectedNotes.clear();
      _selectedFolders.clear();
    });
  }

  void _toggleNoteSelected(String id) {
    HapticFeedback.selectionClick();
    setState(() {
      if (!_selectedNotes.add(id)) _selectedNotes.remove(id);
    });
  }

  void _toggleFolderSelected(String id) {
    HapticFeedback.selectionClick();
    setState(() {
      if (!_selectedFolders.add(id)) _selectedFolders.remove(id);
    });
  }

  Future<void> _bulkDelete() async {
    final noteCount = _selectedNotes.length;
    final folderCount = _selectedFolders.length;
    if (noteCount + folderCount == 0) return;
    final parts = [
      if (noteCount > 0) '$noteCount note${noteCount == 1 ? '' : 's'}',
      if (folderCount > 0) '$folderCount folder${folderCount == 1 ? '' : 's'}',
    ];
    final ok = await _confirm(
      context,
      title: 'Delete ${parts.join(' and ')}?',
      message: folderCount > 0
          ? 'This permanently deletes the selected notes. Selected folders are deleted too — their notes move back to All Notes first.'
          : 'This permanently deletes the selected notes and all their pages.',
    );
    if (ok != true || !mounted) return;
    // Folders first: deleteFolder() only clears folderId off notes still
    // pointing at it, so a note that's ALSO individually selected for
    // deletion just gets removed outright on its own turn right after —
    // no different from doing it in the other order, just avoids a note
    // briefly existing in a about-to-be-deleted folder mid-loop.
    for (final id in _selectedFolders) {
      await PersonalNotesStore.deleteFolder(id);
    }
    for (final id in _selectedNotes) {
      await PersonalNotesStore.delete(id);
    }
    if (!mounted) return;
    // If the folder route currently on screen was itself just deleted,
    // there's nothing left here to show — leave instead of reloading into
    // an empty page (same rule as the single-folder _deleteFolder path).
    final droppedCurrentFolder =
        widget.folderId != null && _selectedFolders.contains(widget.folderId);
    _exitSelection();
    if (droppedCurrentFolder) {
      Navigator.of(context).maybePop();
    } else {
      await _load();
    }
  }

  Future<void> _bulkMove() async {
    if (_selectedNotes.isEmpty) return;
    final target = await showModalBottomSheet<Object?>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.notes_rounded),
              title: const Text('All Notes'),
              onTap: () => Navigator.pop(sheetCtx, _kNoFolder),
            ),
            for (final f in _folders)
              ListTile(
                leading: const Icon(Icons.folder_outlined),
                title: Text(f.name),
                onTap: () => Navigator.pop(sheetCtx, f),
              ),
          ],
        ),
      ),
    );
    if (target == null || !mounted) return;
    final folderId = target == _kNoFolder ? null : (target as PersonalFolder).id;
    for (final id in _selectedNotes) {
      await PersonalNotesStore.moveNote(id, folderId);
    }
    if (!mounted) return;
    HapticFeedback.selectionClick();
    _exitSelection();
    await _load();
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
              child: _selecting
                  ? Row(
                      children: [
                        IconButton(
                          onPressed: _exitSelection,
                          icon: Icon(Icons.close_rounded, size: 20, color: c.inkMedium),
                        ),
                        Expanded(
                          child: Text(
                            _selectionCount == 0 ? 'Select items' : '$_selectionCount selected',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong),
                          ),
                        ),
                      ],
                    )
                  : Row(
                      children: [
                        // Root and folder are both real routes now, so both
                        // pop — the special-case branch this used to need
                        // (setState back to root vs. Navigator.pop) is gone
                        // along with the state it was branching on.
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
                        if (_notes.isNotEmpty || _folders.isNotEmpty)
                          IconButton(
                            tooltip: 'Select',
                            onPressed: _enterSelection,
                            icon: Icon(Icons.checklist_rounded, size: 20, color: c.inkMuted),
                          ),
                        IconButton(
                          tooltip: _gridView ? 'List view' : 'Grid view',
                          onPressed: _toggleView,
                          icon: Icon(
                              _gridView ? Icons.view_list_rounded : Icons.grid_view_rounded,
                              size: 20,
                              color: c.inkMuted),
                        ),
                        // These used to be an if/else — only ever ONE of
                        // "add new" or "folder options" could show, so being
                        // inside a folder (which needs both: manage the
                        // folder itself, and still add notes to it) had no
                        // way to create a note at all. "New folder" is
                        // dropped from the menu while already inside one —
                        // folders are flat, no nesting.
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
                            if (folder == null)
                              const PopupMenuItem(value: 'folder', child: Text('New folder')),
                            const PopupMenuItem(value: 'pdf', child: Text('Import PDF')),
                          ],
                          icon: Icon(Icons.add_rounded, size: 24, color: c.primary),
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
                          ),
                      ],
                    ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _buildBody(c),
            ),
            if (_selecting) _buildSelectionBar(c),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectionBar(AppColors c) {
    final hasSelection = _selectionCount > 0;
    final canMove = _selectedNotes.isNotEmpty;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 10),
        decoration: BoxDecoration(
          color: c.cardElevated,
          border: Border(top: BorderSide(color: c.line)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            TextButton.icon(
              onPressed: canMove ? _bulkMove : null,
              icon: const Icon(Icons.drive_file_move_rounded, size: 19),
              label: const Text('Move to folder'),
            ),
            TextButton.icon(
              onPressed: hasSelection ? _bulkDelete : null,
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              icon: const Icon(Icons.delete_outline_rounded, size: 19),
              label: const Text('Delete'),
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
    Widget folderItem(PersonalFolder f) => _SelectionOverlay(
          selecting: _selecting,
          selected: _selectedFolders.contains(f.id),
          onToggle: () => _toggleFolderSelected(f.id),
          child: _gridView
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
                ),
        );

    Widget noteItem(PersonalNote n) => _SelectionOverlay(
          selecting: _selecting,
          selected: _selectedNotes.contains(n.id),
          onToggle: () => _toggleNoteSelected(n.id),
          child: _gridView
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
                ),
        );

    // A grid section is its own non-scrolling GridView, shrink-wrapped inside
    // the outer scroll — that keeps "Folders" / "Notes" as plain full-width
    // headers between two grids without hand-rolling a sliver layout.
    Widget grid(List<Widget> items) => GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          // A FIXED column count (2, always) is what was leaving huge gaps
          // on an iPad: the same 2 columns just get much wider on a bigger
          // screen, so a small icon centred in an oversized cell reads as
          // empty space around it. MaxCrossAxisExtent instead fits as many
          // ~170-wide columns as the screen allows — 2 on a phone, 4-6+ on
          // an iPad — so cells stay a sensible, consistent size and the grid
          // actually gets denser on a bigger screen instead of just wider,
          // matching how Files/GoodNotes-style grids behave.
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 130,
            mainAxisSpacing: 40,
            crossAxisSpacing: 32,
            // Tall enough for the thumbnail (its own 0.78 ratio) plus the
            // title row below it, with real margin to spare — a tighter
            // ratio here (0.7, tried first) overflowed by 37px on an iPad's
            // narrower grid columns: the title row's actual height is set
            // by the menu button's own tap-target box (~32px even after
            // shrinking it), not by the shorter title text next to it, and
            // that fixed-pixel overhead eats a bigger fraction of a
            // narrower column than a wider one.
            childAspectRatio: 0.55,
          ),
          itemBuilder: (_, i) => items[i],
        );

    // One combined list — folders first, then notes — instead of two
    // separately-headed sections. Folders still sort first (the standard
    // Files/Drive-style convention: folders before files), just as part of
    // the same continuous grid/list rather than under its own "Folders"
    // label with a second "Notes" label below it.
    final items = [
      if (showFolders) ..._folders.map(folderItem),
      ...notes.map(noteItem),
    ];

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
        if (_gridView)
          grid(items)
        else
          for (final item in items)
            Padding(padding: const EdgeInsets.only(bottom: 10), child: item),
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

/// Wraps a note/folder tile with multi-select behaviour, identical for every
/// tile shape (list card or grid tile, note or folder) so selection mode
/// doesn't need its own copy of each tile widget.
///
/// While not selecting, this is a no-op: the overlay ignores pointer events
/// entirely, so [child]'s own tap/long-press-drag/menu all behave exactly as
/// before. While selecting, an opaque layer on TOP of [child] catches every
/// tap first and turns it into a selection toggle — which also means the
/// tile's own onTap (open note/folder) and its drag handle are inert for as
/// long as selection mode is on, without either needing a `selecting` flag
/// threaded through every tile class.
class _SelectionOverlay extends StatelessWidget {
  final bool selecting;
  final bool selected;
  final VoidCallback onToggle;
  final Widget child;
  const _SelectionOverlay({
    required this.selecting,
    required this.selected,
    required this.onToggle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    // While NOT selecting, hand back [child] completely unwrapped — no
    // Stack, no IgnorePointer, nothing extra in the tree at all. An earlier
    // version always built the Stack+IgnorePointer overlay and relied on
    // `ignoring: true` to make it invisible to hit-testing, which broke a
    // real device's ability to tap the tile's own popup-menu chevron even
    // though that overlay was supposed to be a no-op. Only building the
    // overlay when selection mode is actually on removes any chance of
    // that interference during normal, non-selecting use.
    if (!selecting) return child;

    final c = context.c;
    return Stack(
      children: [
        // The tile itself is inert while selecting — a plain tap anywhere
        // on it should toggle selection, not open the note/folder or pop
        // its menu, so its own gestures are disabled here rather than left
        // to compete with the toggle overlay below.
        IgnorePointer(child: child),
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onToggle,
            child: selected
                ? DecoratedBox(
                    decoration: BoxDecoration(
                      color: c.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                  )
                : null,
          ),
        ),
        Positioned(
          top: 6,
          right: 6,
          child: Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? c.primary : Colors.white.withValues(alpha: 0.9),
              border: Border.all(color: selected ? c.primary : c.inkMuted, width: 1.5),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 3, offset: Offset(0, 1))],
            ),
            child: selected ? const Icon(Icons.check_rounded, size: 15, color: Colors.white) : null,
          ),
        ),
      ],
    );
  }
}

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
    final cover = _coverColorFor(note.id);
    // .pages (not .paper directly) pads to pageCount, so a note saved before
    // per-page paper existed still yields a real entry instead of an
    // out-of-range access.
    final firstPage = note.pages.first;
    final isPdf = firstPage.isPdfBacked;
    // TEMPORARY: diagnosing why the thumbnail wasn't showing up on device.
    debugPrint('[NoteGridTile] "${note.title}" isPdf=$isPdf pdfPath=${firstPage.pdfPath} pdfPageIndex=${firstPage.pdfPageIndex}');
    // Every tile — PDF-backed or not — uses the SAME thumbnail sizing (an
    // Expanded slot below, not its own aspect ratio), so the grid stays
    // uniformly sized and aligned. An earlier version let a PDF's own real
    // page ratio size its tile, which broke alignment against the regular
    // notebook-cover tiles next to it (different heights inside the same
    // grid row) and risked overflow for an unusually tall/wide PDF. The
    // PDF's actual portrait/landscape character still comes through in the
    // rendered page image itself (BoxFit.cover inside this same frame), it
    // just no longer resizes the tile to match.
    // "Open" taps live on the thumbnail and the title text ONLY, not on a
    // single GestureDetector wrapping the whole tile (including the menu
    // button) — the chevron sat inside that outer tap zone before, and even
    // though nested taps are SUPPOSED to resolve to the innermost widget,
    // that's exactly what broke on device: the chevron stopped opening its
    // menu. Giving the button a completely separate, non-overlapping tap
    // region removes the ambiguity outright instead of relying on gesture-
    // arena resolution order.
    void openTile() {
      if (onTap == null) return;
      HapticFeedback.selectionClick();
      onTap!();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: onTap == null ? null : openTile,
          // No card/background behind the tile itself — the cover
          // thumbnail below IS the visual weight, the way a GoodNotes/
          // Files-style library tile looks, rather than a boxed card
          // wrapping a small icon. Fixed aspect ratio (not Expanded — tried
          // that, it stretched the cover into a near-square instead of the
          // tall book-cover shape) — folder tiles use this exact same
          // ratio, so their bottoms already line up without needing the
          // thumbnail to stretch and fill leftover space.
          child: AspectRatio(
            aspectRatio: 0.78,
            child: isPdf
                ? _PdfThumbnail(
                    pdfPath: firstPage.pdfPath!,
                    pageIndex: firstPage.pdfPageIndex!,
                    placeholderColor: cover,
                  )
                : _NotebookCover(color: cover),
          ),
        ),
        const SizedBox(height: 9),
        Row(
          // center, not start: PopupMenuButton's own tap-target box is
          // taller than the title text's single line, so aligning tops
          // left the chevron's actual icon (centred within that taller
          // box) sitting visibly below the title instead of level with it.
          // Centring both against the row's height lines their visual
          // centres up instead.
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onTap == null ? null : openTile,
                child: Text(note.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.inkStrong)),
              ),
            ),
            if (onRename != null || onDelete != null || onMove != null)
              PopupMenuButton<String>(
                padding: EdgeInsets.zero,
                // Shrinks the button's own layout box from IconButton's
                // ~40px default down to something closer to the 18px icon
                // it actually shows — that default box (not just its
                // padding, which was already zeroed) was the real cause of
                // both the earlier "chevron sits below the title" alignment
                // issue and this tile overflowing its grid cell.
                style: IconButton.styleFrom(minimumSize: const Size(32, 32)),
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
                icon: Icon(Icons.expand_more_rounded, size: 18, color: c.inkMuted),
              ),
          ],
        ),
      ],
    );
  }
}

/// Renders the actual first page of a PDF-backed note as its grid thumbnail
/// — a real content preview, not a generic cover — the same way
/// LessonCanvasPage._ensurePdfImage renders pages inside the canvas, just
/// standalone here for the library grid. Falls back to the plain notebook
/// cover while the page is still rendering, or if it fails to load (a
/// missing/legacy path, a corrupt file) — the tile should never look broken.
class _PdfThumbnail extends StatefulWidget {
  final String pdfPath;
  final int pageIndex;
  final Color placeholderColor;
  const _PdfThumbnail({required this.pdfPath, required this.pageIndex, required this.placeholderColor});

  @override
  State<_PdfThumbnail> createState() => _PdfThumbnailState();
}

class _PdfThumbnailState extends State<_PdfThumbnail> {
  ui.Image? _image;

  @override
  void initState() {
    super.initState();
    _render();
  }

  Future<void> _render() async {
    PdfDocument? doc;
    try {
      final resolvedPath = await PersonalNotesStore.resolvePdfPath(widget.pdfPath);
      doc = await PdfDocument.openFile(resolvedPath);
      if (widget.pageIndex < 0 || widget.pageIndex >= doc.pages.length) return;
      final page = doc.pages[widget.pageIndex];
      final dpr = mounted ? MediaQuery.of(context).devicePixelRatio : 2.0;
      // A grid thumbnail is small on screen — no need for the full canvas
      // render resolution, just enough to look crisp at typical tile size.
      const targetWidth = 220.0;
      final w = (targetWidth * dpr).round().clamp(1, 900);
      final h = (w / (page.width / page.height)).round();
      final pdfImage = await page.render(fullWidth: w.toDouble(), fullHeight: h.toDouble());
      if (pdfImage == null) return;
      final image = await pdfImage.createImage();
      pdfImage.dispose();
      if (!mounted) {
        image.dispose();
        return;
      }
      setState(() => _image = image);
    } catch (e, st) {
      // Leave _image null — build() falls back to the plain cover.
      // TEMPORARY: diagnosing why the thumbnail wasn't showing up on device.
      debugPrint('[PdfThumbnail] render failed for ${widget.pdfPath}#${widget.pageIndex}: $e\n$st');
    } finally {
      await doc?.dispose();
    }
  }

  @override
  void dispose() {
    _image?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final image = _image;
    if (image == null) return _NotebookCover(color: widget.placeholderColor);
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.16), blurRadius: 6, offset: const Offset(0, 3))],
        ),
        child: RawImage(image: image, fit: BoxFit.cover, alignment: Alignment.topCenter),
      ),
    );
  }
}

/// The grid tile's illustration for a note: a stylised closed notebook — a
/// coloured cover with a darker spine strip down the left edge and a couple
/// of faint binding rings on it, plus a page-stack sliver peeking out from
/// behind the trailing edge, the way a physical notebook's pages show
/// through. Fills the tile's whole thumbnail area (an AspectRatio box sized
/// by the caller), not a small icon centred in empty space.
class _NotebookCover extends StatelessWidget {
  final Color color;
  const _NotebookCover({required this.color});

  @override
  Widget build(BuildContext context) {
    final spine = Color.lerp(color, Colors.black, 0.28)!;
    final ringColor = Color.lerp(color, Colors.white, 0.55)!.withValues(alpha: 0.8);
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [color, Color.lerp(color, Colors.black, 0.12)!],
          ),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.16), blurRadius: 6, offset: const Offset(0, 3))],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Page-stack sliver behind the cover's trailing edge.
            Positioned(
              right: -3,
              top: 10,
              bottom: 10,
              width: 6,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFFFBF8F0),
                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(2)),
                  border: Border.all(color: Colors.black.withValues(alpha: 0.08)),
                ),
              ),
            ),
            // Spine down the left edge.
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 16,
              child: Container(
                decoration: BoxDecoration(
                  color: spine,
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 3, offset: const Offset(1, 0))],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (i) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 5),
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(color: ringColor, shape: BoxShape.circle),
                        ),
                      )),
                ),
              ),
            ),
            Center(
              child: Icon(Icons.edit_note_rounded,
                  size: 30, color: Colors.white.withValues(alpha: 0.85)),
            ),
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
        // Same fix as _NoteGridTile: "open" taps live on the thumbnail and
        // title text only, never on a single detector wrapping the whole
        // tile including the menu button — that's what let the chevron
        // stop opening its menu on device.
        void openTile() {
          HapticFeedback.selectionClick();
          onTap();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: openTile,
              // Only a light highlight while a dragged note is actually
              // hovering over this tile, so it's clear where a drop would
              // land, without every folder permanently sitting in a box.
              // Same fixed 0.78 ratio as _NoteGridTile's cover — that's what
              // keeps folder and note tile bottoms lined up, not stretching
              // the thumbnail to fill leftover space (that read as a
              // near-square instead of a book-cover shape).
              child: AspectRatio(
                aspectRatio: 0.78,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 120),
                  decoration: BoxDecoration(
                    color: hovering ? c.primaryTint : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: hovering ? Border.all(color: c.primary, width: 1.5) : null,
                  ),
                  // The folder keeps its own natural (unstretched) shape —
                  // width-filling with height derived from its design
                  // aspect ratio, same as before — but now bottom-aligned
                  // instead of centred. Centring was the actual problem:
                  // it floated the folder shape in the middle of the box
                  // with empty space above AND below, so its bottom edge
                  // sat above where a note cover's bottom edge (which fills
                  // its box edge-to-edge) landed, reading as visibly
                  // shorter. Bottom-aligning puts both on the same line
                  // without touching the folder's own proportions.
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: AnimatedScale(
                      duration: const Duration(milliseconds: 120),
                      scale: hovering ? 1.04 : 1.0,
                      child: const _FolderIcon(),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 9),
            Row(
              // center: see _NoteGridTile's identical title row for why —
              // PopupMenuButton's tap-target box is taller than the title
              // text, so top-aligning left the chevron sitting below it.
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: openTile,
                    child: Text(folder.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.inkStrong)),
                  ),
                ),
                PopupMenuButton<String>(
                  padding: EdgeInsets.zero,
                  // See _NoteGridTile's identical chevron for why.
                  style: IconButton.styleFrom(minimumSize: const Size(32, 32)),
                  onSelected: (v) {
                    if (v == 'rename') { onRename(); } else if (v == 'delete') { onDelete(); }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'rename', child: Text('Rename')),
                    const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
                  ],
                  icon: Icon(Icons.expand_more_rounded, size: 18, color: c.inkMuted),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// The grid tile's illustration for a folder: a classic manila-folder
/// silhouette (a small tab on the top-left of a rounded body) rendered with
/// CustomPaint, not a generic Material folder glyph — closer to how Files/
/// Drive-style apps actually draw a folder tile. One consistent colour for
/// every folder (like Files/GoodNotes always draw folders the same colour
/// regardless of contents) rather than the per-item hash palette notes use —
/// sizing/hover-scale is handled by the caller (FractionallySizedBox +
/// AnimatedScale), this just fills whatever box it's given.
const _kFolderColor = Color(0xFF5B93C7);

class _FolderIcon extends StatelessWidget {
  const _FolderIcon();

  // Design aspect ratio (60×47) preserved at any size — the folder keeps
  // its original drawn proportions rather than being stretched to fill a
  // taller box (that read as a distorted, oddly-tall folder shape).
  static const double _aspect = 47 / 60;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final width = constraints.maxWidth;
      return CustomPaint(
        size: Size(width, width * _aspect),
        painter: _FolderShapePainter(_kFolderColor),
      );
    });
  }
}

class _FolderShapePainter extends CustomPainter {
  final Color color;
  _FolderShapePainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    // Design was drawn at width 60 — everything below scales off that so the
    // tab, corner radii and shadow all grow/shrink together with [size].
    final scale = size.width / 60;
    final body = Color.lerp(color, Colors.black, 0.06)!;
    final tabPath = Path()
      ..moveTo(0, 8 * scale)
      ..lineTo(0, 4 * scale)
      ..arcToPoint(Offset(4 * scale, 0), radius: Radius.circular(4 * scale))
      ..lineTo(size.width * 0.32, 0)
      ..lineTo(size.width * 0.32 + 8 * scale, 8 * scale)
      ..close();
    canvas.drawPath(tabPath, Paint()..color = Color.lerp(color, Colors.white, 0.18)!);

    final bodyRect = RRect.fromRectAndCorners(
      Rect.fromLTWH(0, 8 * scale, size.width, size.height - 8 * scale),
      topLeft: Radius.circular(2 * scale),
      topRight: Radius.circular(8 * scale),
      bottomLeft: Radius.circular(8 * scale),
      bottomRight: Radius.circular(8 * scale),
    );
    canvas.drawShadow(Path()..addRRect(bodyRect), Colors.black, 3 * scale, false);
    canvas.drawRRect(bodyRect, Paint()..color = body);
    // Highlight seam along the top edge of the body, under the tab.
    canvas.drawRRect(
      bodyRect.deflate(0.5 * scale),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1 * scale
        ..color = Colors.white.withValues(alpha: 0.14),
    );
  }

  @override
  bool shouldRepaint(_FolderShapePainter old) => old.color != color;
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
