import 'package:file_selector/file_selector.dart' show XFile;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../lessons/lesson_canvas_page.dart';
import 'pdf_import.dart';
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
  List<PagePaper> _paper = const <PagePaper>[];
  int _page = 0; // page under the middle of the viewport
  final PersonalPageOps _ops = PersonalPageOps();

  @override
  void initState() {
    super.initState();
    _pageCount = widget.initialPageCount;
    _loadPaper();
  }

  Future<void> _loadPaper() async {
    final note = await PersonalNotesStore.byId(widget.noteId);
    if (note == null || !mounted) return;
    setState(() => _paper = note.pages);
  }

  PagePaper get _current =>
      _page < _paper.length ? _paper[_page] : const PagePaper();

  Future<void> _openMenu() async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _PageMenuSheet(pageNumber: _page + 1,
          canDelete: _pageCount > 1),
    );
    if (action == null || !mounted) return;
    switch (action) {
      case 'template':
        await _pickPaper(addNew: false);
      case 'insertBefore':
        await _insertPageFlow(atIndex: _page);
      case 'insertAfter':
        await _insertPageFlow(atIndex: _page + 1);
      case 'importBefore':
        await _importPdfFlow(atIndex: _page);
      case 'importAfter':
        await _importPdfFlow(atIndex: _page + 1);
      case 'clear':
        await _clearPage();
      case 'delete':
        await _deletePage();
    }
  }

  /// Insert a new page at [atIndex] (0-based). Mirrors [_deletePage]'s
  /// ordering: the canvas makes ink-space room for it first, then the store
  /// records the page — so `_pageCount` never briefly disagrees with what has
  /// already been drawn.
  Future<void> _insertPageFlow({required int atIndex}) async {
    final result = await showModalBottomSheet<(PaperStyle, PaperTint)>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _PaperSheet(
        style: _current.style,
        tint: _current.tint,
        pageNumber: atIndex + 1,
        intent: _PaperIntent.insertPage,
      ),
    );
    if (result == null || !mounted) return;
    final paper = PagePaper(style: result.$1, tint: result.$2);
    HapticFeedback.mediumImpact();
    _ops.insertPage?.call(atIndex);
    final newTotal =
        await PersonalNotesStore.insertPage(widget.noteId, atIndex, paper);
    if (!mounted) return;
    setState(() {
      _pageCount = newTotal;
      _page = atIndex; // land on the page just inserted
    });
    await _loadPaper();
  }

  /// Import every page of a picked PDF at [atIndex] — the mirror of
  /// [_insertPageFlow] for a whole document instead of one blank page. No
  /// paper picker here: ruling/tint make no sense over a scanned page, so
  /// each imported page just carries the plain style PdfImportService gives
  /// it (see PagePaper.isPdfBacked).
  Future<void> _importPdfFlow({required int atIndex}) async {
    // This runs after the ☰ bottom sheet is popped, which happens the
    // instant Navigator.pop removes it from the route stack — not once its
    // own ~300ms close animation has actually finished on screen. Calling
    // the native document picker while that overlay is still animating away
    // is what made this hang with nothing appearing to happen, the same
    // class of conflict as the showDialog issue below, one level up.
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
      builder: (ctx) => const _ImportingDialog(),
    );
    final result = await PdfImportService.process(picked);
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop(); // dismiss the spinner
    if (result == null || !mounted) return;

    HapticFeedback.mediumImpact();
    _ops.insertPages?.call(atIndex, result.pages);
    final newTotal = await PersonalNotesStore.insertPages(
        widget.noteId, atIndex, result.pages);
    if (!mounted) return;
    setState(() {
      _pageCount = newTotal;
      _page = atIndex; // land on the first imported page
    });
    await _loadPaper();
  }

  Future<void> _clearPage() async {
    // Confirmed even though the reference app doesn't: there is no trash and
    // no redo here, so an accidental tap destroys handwriting outright.
    final ok = await _confirm(
      title: 'Clear page ${_page + 1}?',
      body: 'Everything written on this page will be erased. '
          "This can't be undone.",
      action: 'Clear page',
    );
    if (!ok || !mounted) return;
    _ops.clearPage?.call(_page);
  }

  Future<void> _deletePage() async {
    if (_pageCount <= 1) return;
    final ok = await _confirm(
      title: 'Delete page ${_page + 1}?',
      body: 'The page and everything written on it will be removed, and the '
          "pages after it move up. This can't be undone.",
      action: 'Delete page',
    );
    if (!ok || !mounted) return;
    final removed = _page;
    _ops.deletePage?.call(removed);
    final newTotal =
        await PersonalNotesStore.deletePage(widget.noteId, removed);
    if (!mounted) return;
    setState(() {
      _pageCount = newTotal;
      if (_page >= newTotal) _page = newTotal - 1;
    });
    await _loadPaper();
  }

  Future<bool> _confirm(
      {required String title,
      required String body,
      required String action}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style:
                FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(action),
          ),
        ],
      ),
    );
    return ok == true;
  }

  /// Choose paper, then either add a page with it or restyle the current one.
  Future<void> _pickPaper({required bool addNew}) async {
    final result = await showModalBottomSheet<(PaperStyle, PaperTint)>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _PaperSheet(
        style: _current.style,
        tint: _current.tint,
        pageNumber: _page + 1,
        intent: addNew ? _PaperIntent.appendPage : _PaperIntent.restyle,
      ),
    );
    if (result == null || !mounted) return;
    final chosen = PagePaper(style: result.$1, tint: result.$2);
    if (addNew) {
      await _addPage(paper: chosen);
      return;
    }
    // Only the page being looked at changes; the rest keep their own paper.
    final next = [
      for (var i = 0; i < _pageCount; i++)
        i == _page
            ? chosen
            : (i < _paper.length ? _paper[i] : const PagePaper()),
    ];
    setState(() => _paper = next);
    await PersonalNotesStore.setPagePaper(
        widget.noteId, _page, result.$1, result.$2);
  }

  // All pages share a single canvas ink key (no per-page suffix).
  String get _lessonId => 'pnote-${widget.noteId}';

  Future<void> _addPage({PagePaper? paper}) async {
    HapticFeedback.mediumImpact();
    final newTotal =
        await PersonalNotesStore.addPage(widget.noteId, paper: paper);
    await _loadPaper(); // the new page inherits the last one's paper
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
      paper: _paper,
      onVisiblePage: (i) {
        if (i != _page && mounted) setState(() => _page = i);
      },
      pageOps: _ops,
      pageNav: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _AddPageButton(onAdd: () => _pickPaper(addNew: true)),
          const SizedBox(width: 4),
          _MenuButton(onTap: _openMenu),
        ],
      ),
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
            // Label is just "Page": the add_rounded icon beside it already
            // supplies the plus, and having both rendered "＋ + Page".
            Text('Page',
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


/// Opens the page menu. A plain button, not a PopupMenuButton: the menu is a
/// bottom sheet so it arrives the same way the paper picker does.
class _MenuButton extends StatelessWidget {
  final VoidCallback onTap;
  const _MenuButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurface;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(Icons.menu_rounded, size: 16, color: color),
      ),
    );
  }
}

/// Page actions, titled with the page they act on so there is no doubt which
/// one is about to be cleared or deleted.
class _PageMenuSheet extends StatelessWidget {
  final int pageNumber;
  final bool canDelete;
  const _PageMenuSheet({required this.pageNumber, required this.canDelete});

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    const danger = Color(0xFFDC2626);
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Page $pageNumber',
                style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: onSurface)),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.grid_on_rounded),
            title: const Text('Change Template'),
            onTap: () => Navigator.pop(context, 'template'),
          ),
          ListTile(
            leading: const Icon(Icons.vertical_align_top_rounded),
            title: const Text('Insert Page Before'),
            onTap: () => Navigator.pop(context, 'insertBefore'),
          ),
          ListTile(
            leading: const Icon(Icons.vertical_align_bottom_rounded),
            title: const Text('Insert Page After'),
            onTap: () => Navigator.pop(context, 'insertAfter'),
          ),
          ListTile(
            leading: const Icon(Icons.picture_as_pdf_outlined),
            title: const Text('Import PDF Before'),
            onTap: () => Navigator.pop(context, 'importBefore'),
          ),
          ListTile(
            leading: const Icon(Icons.picture_as_pdf_outlined),
            title: const Text('Import PDF After'),
            onTap: () => Navigator.pop(context, 'importAfter'),
          ),
          ListTile(
            leading: const Icon(Icons.cancel_outlined, color: danger),
            title: const Text('Clear Page', style: TextStyle(color: danger)),
            onTap: () => Navigator.pop(context, 'clear'),
          ),
          ListTile(
            enabled: canDelete,
            leading: Icon(Icons.delete_outline_rounded,
                color: canDelete ? danger : onSurface.withValues(alpha: 0.3)),
            title: Text('Delete Page',
                style: TextStyle(
                    color:
                        canDelete ? danger : onSurface.withValues(alpha: 0.3))),
            subtitle: canDelete ? null : const Text('A note keeps one page'),
            onTap: canDelete ? () => Navigator.pop(context, 'delete') : null,
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// What the paper picker's result will be used for — only changes the
/// wording, the style/colour choice underneath is identical either way.
enum _PaperIntent { restyle, appendPage, insertPage }

/// Ruling + colour picker. Applies to the whole note (see [PaperStyle]).
class _PaperSheet extends StatefulWidget {
  final PaperStyle style;
  final PaperTint tint;
  final int pageNumber;
  final _PaperIntent intent;
  const _PaperSheet(
      {required this.style,
      required this.tint,
      required this.pageNumber,
      required this.intent});

  @override
  State<_PaperSheet> createState() => _PaperSheetState();
}

class _PaperSheetState extends State<_PaperSheet> {
  late PaperStyle _style = widget.style;
  late PaperTint _tint = widget.tint;

  static const _styleLabels = {
    PaperStyle.plain: 'Plain',
    PaperStyle.dotted: 'Dotted',
    PaperStyle.ruled: 'Ruled',
    PaperStyle.grid: 'Grid',
  };
  static const _tintLabels = {
    PaperTint.white: 'White',
    PaperTint.cream: 'Cream',
    PaperTint.dark: 'Dark',
  };
  static const _tintSwatch = {
    PaperTint.white: Colors.white,
    PaperTint.cream: Color(0xFFFAF4E6),
    PaperTint.dark: Color(0xFF1C1C20),
  };

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                switch (widget.intent) {
                  _PaperIntent.appendPage => 'New page',
                  _PaperIntent.insertPage => 'Insert page',
                  _PaperIntent.restyle => 'Paper · page ${widget.pageNumber}',
                },
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: onSurface)),
            const SizedBox(height: 2),
            Text(
                switch (widget.intent) {
                  _PaperIntent.appendPage =>
                    'Choose the paper for the page you are adding',
                  _PaperIntent.insertPage =>
                    'Choose the paper for the new page ${widget.pageNumber}',
                  _PaperIntent.restyle => 'Applies to page ${widget.pageNumber} only',
                },
                style: TextStyle(
                    fontSize: 12.5,
                    color: onSurface.withValues(alpha: 0.6))),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              children: [
                for (final s in PaperStyle.values)
                  ChoiceChip(
                    label: Text(_styleLabels[s]!),
                    selected: _style == s,
                    onSelected: (_) => setState(() => _style = s),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: [
                for (final t in PaperTint.values)
                  ChoiceChip(
                    avatar: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: _tintSwatch[t],
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: onSurface.withValues(alpha: 0.25)),
                      ),
                    ),
                    label: Text(_tintLabels[t]!),
                    selected: _tint == t,
                    onSelected: (_) => setState(() => _tint = t),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, (_style, _tint)),
                child: Text(switch (widget.intent) {
                  _PaperIntent.appendPage => 'Add page',
                  _PaperIntent.insertPage => 'Insert page',
                  _PaperIntent.restyle => 'Apply to page ${widget.pageNumber}',
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shown for the moment PdfImportService.pick() spends copying the picked
/// file into permanent storage and reading its page count — after the native
/// document picker has already closed, so without this the screen would look
/// briefly frozen on a large PDF.
class _ImportingDialog extends StatelessWidget {
  const _ImportingDialog();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      content: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          SizedBox(
              width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
          SizedBox(width: 16),
          Text('Importing PDF…'),
        ],
      ),
    );
  }
}
