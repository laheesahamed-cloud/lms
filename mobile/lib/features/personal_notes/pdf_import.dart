import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../state/local_scope.dart';
import 'personal_notes_store.dart';

/// The outcome of a successful pick: a permanent copy of the PDF, its
/// display name, and one [PagePaper] per page — already carrying the aspect
/// ratio each page needs, so nothing has to re-open the PDF just to lay
/// itself out.
class PdfImportResult {
  final String suggestedTitle;
  final List<PagePaper> pages;
  const PdfImportResult({required this.suggestedTitle, required this.pages});
}

/// Importing a PDF into My Notes: pick a file, copy it into permanent
/// per-note storage (the picker's own path is not guaranteed to survive —
/// on iOS it can be a security-scoped or cache location), then read each
/// page's size so its aspect ratio is known up front.
///
/// Deliberately does not render any page image here — that stays lazy, done
/// by the canvas only for pages actually scrolled into view (see
/// LessonCanvasPage._ensurePdfImage). A 200-page textbook should import in
/// about the time it takes to read its page count, not the time it takes to
/// rasterise all 200 pages.
class PdfImportService {
  PdfImportService._();

  /// Opens the system document picker only — no copying, no reading the PDF.
  /// Returns null if the user cancelled.
  ///
  /// Kept separate from [process] deliberately: a caller that wants to show
  /// its own "importing…" spinner must show it *after* this returns, not
  /// before or during it. iOS presents the document picker as its own native
  /// modal, and a Flutter [showDialog] opened right as that presentation is
  /// starting fights it for the same slot — the picker never actually
  /// appears and the await here hangs, which is exactly what "spinner shows,
  /// then nothing happens" was: the earlier version opened the spinner
  /// first, immediately before calling this.
  ///
  /// Uses file_selector, not file_picker: file_picker's iOS build pulls in a
  /// full photo-picker dependency chain (DKImagePickerController →
  /// SDWebImage → SwiftyGif, several sequential git clones) for
  /// functionality this never uses — the plain "pick a document" path only
  /// needs UIDocumentPickerViewController, which is all file_selector wraps.
  static Future<XFile?> pickFile() {
    return openFile(
      // file_selector_ios does NOT derive a UTI from `extensions` the way
      // other platforms do — its own Dart wrapper throws an ArgumentError
      // synchronously if `uniformTypeIdentifiers` is empty, before the native
      // picker ever gets a chance to appear. `extensions` alone was exactly
      // "menu closes, then nothing happens": a throw with no visible effect,
      // this early into the call, before any UI could show at all.
      // 'com.adobe.pdf' is the standard system UTI for PDF (Apple's UTType.pdf).
      acceptedTypeGroups: const [
        XTypeGroup(
          label: 'PDF',
          extensions: ['pdf'],
          uniformTypeIdentifiers: ['com.adobe.pdf'],
        ),
      ],
    );
  }

  /// Copies [picked] into permanent per-note storage and reads each page's
  /// size. Safe to show a spinner around — this is pure Dart/file-IO work,
  /// nothing native-modal about it. Returns null if [picked] could not be
  /// opened as a PDF.
  static Future<PdfImportResult?> process(XFile picked) async {
    String storedPath;
    try {
      // Was outside this try/catch — a failure copying the picked file (an
      // iOS document from iCloud Drive or another app needs
      // startAccessingSecurityScopedResource() before it can be read, which
      // this does not currently call) would throw straight out of process(),
      // uncaught by any caller, and look like nothing happened at all.
      storedPath = await _copyIntoAppStorage(picked.path);
    } catch (_) {
      return null;
    }
    PdfDocument? doc;
    try {
      doc = await PdfDocument.openFile(storedPath);
      final pages = <PagePaper>[
        for (var i = 0; i < doc.pages.length; i++)
          PagePaper(
            style: PaperStyle.plain, // ruling over a scanned page rarely helps
            pdfPath: storedPath,
            pdfPageIndex: i,
            pdfAspectRatio: doc.pages[i].width / doc.pages[i].height,
          ),
      ];
      if (pages.isEmpty) {
        await File(storedPath).delete().catchError((_) => File(storedPath));
        return null;
      }
      final name = picked.name;
      final title =
          name.toLowerCase().endsWith('.pdf') ? name.substring(0, name.length - 4) : name;
      return PdfImportResult(suggestedTitle: title, pages: pages);
    } catch (_) {
      // Not a PDF we could open — clean up the copy rather than leaving a
      // dead file behind with nothing referencing it.
      await File(storedPath).delete().catchError((_) => File(storedPath));
      return null;
    } finally {
      await doc?.dispose();
    }
  }

  /// [pickFile] + [process] in one call, for a caller with no spinner of its
  /// own to show in between (a very small/fast PDF, where the gap is
  /// imperceptible either way).
  static Future<PdfImportResult?> pick() async {
    final picked = await pickFile();
    if (picked == null) return null;
    return process(picked);
  }

  /// Copies the picked file into `<app documents>/personal_pdfs/`, named by a
  /// fresh id so two imports (even of the same source file) never collide.
  static Future<String> _copyIntoAppStorage(String pickedPath) async {
    final dir = await getApplicationDocumentsDirectory();
    final pdfDir = Directory('${dir.path}/personal_pdfs/${LocalScope.uid}');
    await pdfDir.create(recursive: true);
    final id = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
    final dest = '${pdfDir.path}/$id.pdf';
    await File(pickedPath).copy(dest);
    return dest;
  }
}
