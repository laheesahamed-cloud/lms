import 'dart:convert';
import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';
import '../../state/local_scope.dart';

/// Ruling drawn on the page. Stored per note rather than per page: GoodNotes
/// varies it per page, but that forces every paint to look up which band it is
/// in, for a choice users rarely make mid-notebook.
enum PaperStyle { plain, dotted, ruled, grid }

/// Paper colour. [dark] exists because the sheet was previously hardcoded
/// white — a glaring white rectangle in dark mode.
enum PaperTint { white, cream, dark }

PaperStyle _styleFrom(String? v) => PaperStyle.values.firstWhere(
    (e) => e.name == v,
    orElse: () => PaperStyle.dotted);
PaperTint _tintFrom(String? v) =>
    PaperTint.values.firstWhere((e) => e.name == v, orElse: () => PaperTint.white);

/// Paper for one page. Per page, not per note: a reader may want page 1 white
/// and page 2 cream, and switching should not restyle everything behind them.
class PagePaper {
  final PaperStyle style;
  final PaperTint tint;

  /// When set, this page's background is a rendered PDF page rather than a
  /// plain paper fill — [pdfPath] + [pdfPageIndex] (0-based) locate it.
  /// [pdfAspectRatio] (width/height, in the PDF's own points) is captured
  /// once at import time so the page's own height can be computed
  /// synchronously during layout, without re-opening the PDF file on every
  /// frame just to ask how tall its page is. [tint] is unused for a
  /// PDF-backed page — the rendered image supplies its own colour — but
  /// [style] still applies, so ruling can be drawn over a scanned page.
  final String? pdfPath;
  final int? pdfPageIndex;
  final double? pdfAspectRatio;

  const PagePaper({
    this.style = PaperStyle.dotted,
    this.tint = PaperTint.white,
    this.pdfPath,
    this.pdfPageIndex,
    this.pdfAspectRatio,
  });

  bool get isPdfBacked => pdfPath != null && pdfPageIndex != null;

  Map<String, dynamic> toJson() => {
        'style': style.name,
        'tint': tint.name,
        if (pdfPath != null) 'pdfPath': pdfPath,
        if (pdfPageIndex != null) 'pdfPageIndex': pdfPageIndex,
        if (pdfAspectRatio != null) 'pdfAspectRatio': pdfAspectRatio,
      };

  /// Value equality — the painter's shouldRepaint compares lists of these, and
  /// with identity equality every rebuild would repaint the whole document.
  @override
  bool operator ==(Object other) =>
      other is PagePaper &&
      other.style == style &&
      other.tint == tint &&
      other.pdfPath == pdfPath &&
      other.pdfPageIndex == pdfPageIndex &&
      other.pdfAspectRatio == pdfAspectRatio;

  @override
  int get hashCode =>
      Object.hash(style, tint, pdfPath, pdfPageIndex, pdfAspectRatio);

  factory PagePaper.fromJson(Map<String, dynamic> j) => PagePaper(
        style: _styleFrom(j['style'] as String?),
        tint: _tintFrom(j['tint'] as String?),
        pdfPath: j['pdfPath'] as String?,
        pdfPageIndex: j['pdfPageIndex'] as int?,
        pdfAspectRatio: (j['pdfAspectRatio'] as num?)?.toDouble(),
      );
}

/// A flat (non-nested) group of notes, like an Apple Notes / Google Keep
/// folder. A note with no [PersonalNote.folderId] simply sits ungrouped at
/// the top level — folders are an optional layer, not a required home.
class PersonalFolder {
  final String id;
  final String name;
  final DateTime createdAt;

  const PersonalFolder({required this.id, required this.name, required this.createdAt});

  PersonalFolder copyWith({String? name}) =>
      PersonalFolder(id: id, name: name ?? this.name, createdAt: createdAt);

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PersonalFolder.fromJson(Map<String, dynamic> j) => PersonalFolder(
        id: j['id'] as String,
        name: j['name'] as String? ?? 'Folder',
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
      );
}

class PersonalNote {
  final String id;
  final String title;
  final int pageCount;
  final DateTime createdAt;
  /// One entry per page. Kept the same length as [pageCount] by [pages].
  final List<PagePaper> paper;
  /// Which [PersonalFolder] this note lives in, or null for ungrouped
  /// ("All Notes"). Notes saved before folders existed decode to null.
  final String? folderId;

  const PersonalNote({
    required this.id,
    required this.title,
    required this.pageCount,
    required this.createdAt,
    this.paper = const <PagePaper>[],
    this.folderId,
  });

  /// Paper for every page, padded so a note saved before this feature (or one
  /// whose pageCount grew elsewhere) still yields an entry per page.
  List<PagePaper> get pages => [
        for (var i = 0; i < pageCount; i++)
          i < paper.length ? paper[i] : const PagePaper(),
      ];

  PersonalNote copyWith({
    String? title,
    int? pageCount,
    List<PagePaper>? paper,
    // Sentinel-free nullable update: pass a value to set it, or the
    // dedicated [clearFolder] flag to explicitly move the note to "All
    // Notes" (copyWith(folderId: null) would be indistinguishable from
    // "leave it alone" otherwise).
    String? folderId,
    bool clearFolder = false,
  }) =>
      PersonalNote(
        id: id,
        title: title ?? this.title,
        pageCount: pageCount ?? this.pageCount,
        createdAt: createdAt,
        paper: paper ?? this.paper,
        folderId: clearFolder ? null : (folderId ?? this.folderId),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'pageCount': pageCount,
        'createdAt': createdAt.toIso8601String(),
        'paper': [for (final p in pages) p.toJson()],
        'folderId': folderId,
      };

  factory PersonalNote.fromJson(Map<String, dynamic> j) => PersonalNote(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Untitled',
        pageCount: j['pageCount'] as int? ?? 1,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
        folderId: j['folderId'] as String?,
        // Reads both shapes: the per-page list, and the single style/tint an
        // earlier build wrote, which is expanded across every page.
        paper: switch (j['paper']) {
          final List<dynamic> l => [
              for (final e in l)
                PagePaper.fromJson(Map<String, dynamic>.from(e as Map))
            ],
          _ => [
              for (var i = 0; i < (j['pageCount'] as int? ?? 1); i++)
                PagePaper(
                  style: _styleFrom(j['paperStyle'] as String?),
                  tint: _tintFrom(j['paperTint'] as String?),
                )
            ],
        },
      );
}

class PersonalNotesStore {
  // Per-user key so a different account on the same device gets its own notes.
  static String get _key => 'xyndrome.personal_notes.${LocalScope.uid}';
  static String get _foldersKey => 'xyndrome.personal_folders.${LocalScope.uid}';

  static Future<List<PersonalFolder>> loadFolders() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_foldersKey);
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => PersonalFolder.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static Future<void> _saveFolders(List<PersonalFolder> folders) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_foldersKey, jsonEncode(folders.map((f) => f.toJson()).toList()));
  }

  static Future<PersonalFolder> createFolder(String name) async {
    final folders = await loadFolders();
    final folder = PersonalFolder(
      id: DateTime.now().millisecondsSinceEpoch.toRadixString(36),
      name: name.trim().isEmpty ? 'Untitled Folder' : name.trim(),
      createdAt: DateTime.now(),
    );
    folders.insert(0, folder);
    await _saveFolders(folders);
    return folder;
  }

  static Future<void> renameFolder(String id, String name) async {
    final folders = await loadFolders();
    final idx = folders.indexWhere((f) => f.id == id);
    if (idx == -1) return;
    folders[idx] = folders[idx].copyWith(name: name.trim().isEmpty ? 'Untitled Folder' : name.trim());
    await _saveFolders(folders);
  }

  /// Deletes the folder itself only — its notes are released back to "All
  /// Notes" rather than deleted, matching Apple Notes/Google Keep.
  static Future<void> deleteFolder(String id) async {
    final folders = await loadFolders();
    folders.removeWhere((f) => f.id == id);
    await _saveFolders(folders);
    final notes = await load();
    var changed = false;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].folderId == id) {
        notes[i] = notes[i].copyWith(clearFolder: true);
        changed = true;
      }
    }
    if (changed) await _save(notes);
  }

  /// Moves a note into [folderId], or back to "All Notes" when null.
  static Future<void> moveNote(String noteId, String? folderId) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == noteId);
    if (idx == -1) return;
    notes[idx] = folderId == null
        ? notes[idx].copyWith(clearFolder: true)
        : notes[idx].copyWith(folderId: folderId);
    await _save(notes);
  }

  static Future<List<PersonalNote>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => PersonalNote.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static Future<void> _save(List<PersonalNote> notes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(notes.map((n) => n.toJson()).toList()));
  }

  static Future<PersonalNote> create(String title) async {
    final notes = await load();
    final note = PersonalNote(
      id: DateTime.now().millisecondsSinceEpoch.toRadixString(36),
      title: title.trim().isEmpty ? 'Untitled' : title.trim(),
      pageCount: 1,
      createdAt: DateTime.now(),
    );
    notes.insert(0, note);
    await _save(notes);
    return note;
  }

  /// A new note whose pages are already PDF-backed — the "Import PDF" entry
  /// point in My Notes' + menu. [pages] is normally the output of
  /// [PdfImportService], one [PagePaper] per PDF page in order.
  static Future<PersonalNote> createFromPdf(
      String title, List<PagePaper> pages) async {
    final notes = await load();
    final note = PersonalNote(
      id: DateTime.now().millisecondsSinceEpoch.toRadixString(36),
      title: title.trim().isEmpty ? 'Untitled' : title.trim(),
      pageCount: pages.isEmpty ? 1 : pages.length,
      createdAt: DateTime.now(),
      paper: pages,
    );
    notes.insert(0, note);
    await _save(notes);
    return note;
  }

  static Future<void> rename(String id, String title) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return;
    notes[idx] = notes[idx].copyWith(title: title.trim().isEmpty ? 'Untitled' : title.trim());
    await _save(notes);
  }

  static Future<void> delete(String id) async {
    final notes = await load();
    final removedIdx = notes.indexWhere((n) => n.id == id);
    final removedPdfPaths = removedIdx == -1
        ? const <String>{}
        : {
            for (final p in notes[removedIdx].pages)
              if (p.pdfPath != null) p.pdfPath!
          };
    notes.removeWhere((n) => n.id == id);
    await _save(notes);
    // Drop this note's ink too. The old pattern here was 'pnote-$id-page-',
    // which never matched anything: the canvas writes a single key per note,
    // 'lms.ink.<uid>.pnote-<id>' (see LessonCanvasPage._inkKey). Every deleted
    // note left its strokes behind in SharedPreferences forever.
    final prefs = await SharedPreferences.getInstance();
    final keys =
        prefs.getKeys().where((k) => k.contains('pnote-$id')).toList();
    for (final k in keys) {
      await prefs.remove(k);
    }
    // And any PDF this note imported — each import copies the file into
    // per-note storage (see PdfImportService), so nothing else needs it
    // unless another note happens to reference the exact same path.
    if (removedPdfPaths.isNotEmpty) {
      final stillReferenced = <String>{
        for (final n in notes)
          for (final p in n.pages)
            if (p.pdfPath != null) p.pdfPath!
      };
      for (final path in removedPdfPaths) {
        if (stillReferenced.contains(path)) continue;
        try {
          final f = File(path);
          if (await f.exists()) await f.delete();
        } catch (_) {
          // Best-effort — an orphaned file is no worse than the state before
          // this cleanup existed.
        }
      }
    }
  }

  /// Drop a page from the note. The caller is responsible for the ink — see
  /// PersonalPageOps.deletePage, which removes that page's strokes and shifts
  /// the ones below it up.
  static Future<int> deletePage(String id, int pageIndex) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return 1;
    final note = notes[idx];
    if (note.pageCount <= 1) return note.pageCount; // never leave a note empty
    if (pageIndex < 0 || pageIndex >= note.pageCount) return note.pageCount;
    final pages = note.pages..removeAt(pageIndex);
    notes[idx] = note.copyWith(pageCount: note.pageCount - 1, paper: pages);
    await _save(notes);
    return note.pageCount - 1;
  }

  /// Insert a new page at [index] (0-based; [index] == pageCount inserts at
  /// the end, same as [addPage]). The mirror of [deletePage] — the caller is
  /// responsible for the ink shift first, via PersonalPageOps.insertPage.
  static Future<int> insertPage(String id, int index, PagePaper paper) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return 1;
    final note = notes[idx];
    final at = index.clamp(0, note.pageCount);
    final pages = note.pages..insert(at, paper);
    notes[idx] = note.copyWith(pageCount: note.pageCount + 1, paper: pages);
    await _save(notes);
    return note.pageCount + 1;
  }

  /// Insert several pages at once, starting at [index]. Used to drop an
  /// entire imported PDF in at a chosen position in one store write, rather
  /// than one [insertPage] call per page. The caller is responsible for the
  /// ink shift first — see PersonalPageOps.insertPages.
  static Future<int> insertPages(
      String id, int index, List<PagePaper> pages) async {
    if (pages.isEmpty) return 1;
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return 1;
    final note = notes[idx];
    final at = index.clamp(0, note.pageCount);
    final current = note.pages..insertAll(at, pages);
    notes[idx] = note.copyWith(
        pageCount: note.pageCount + pages.length, paper: current);
    await _save(notes);
    return note.pageCount + pages.length;
  }

  /// Restyle a single page. [pageIndex] is 0-based.
  static Future<void> setPagePaper(
      String id, int pageIndex, PaperStyle style, PaperTint tint) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return;
    final pages = notes[idx].pages;
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    pages[pageIndex] = PagePaper(style: style, tint: tint);
    notes[idx] = notes[idx].copyWith(paper: pages);
    await _save(notes);
  }

  static Future<PersonalNote?> byId(String id) async {
    final notes = await load();
    for (final n in notes) {
      if (n.id == id) return n;
    }
    return null;
  }

  /// Append a page. [paper] sets its ruling and colour; omitted, the new page
  /// inherits the last one's, which is what you usually want mid-notebook.
  static Future<int> addPage(String id, {PagePaper? paper}) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return 1;
    final pages = notes[idx].pages;
    final next =
        paper ?? (pages.isEmpty ? const PagePaper() : pages.last);
    final updated = notes[idx]
        .copyWith(pageCount: notes[idx].pageCount + 1, paper: [...pages, next]);
    notes[idx] = updated;
    await _save(notes);
    return updated.pageCount;
  }
}
