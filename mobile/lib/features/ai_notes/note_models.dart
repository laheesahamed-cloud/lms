/// Note document model — parses the JSON from `GET /student/ai-notes/lesson/:lessonId`.
/// Defensive: the canvas content can be at the top level, under `noteData`/`note_data`,
/// or wrapped in `pages[]` (web `normalizeNoteData`). Mirrors the web NoteCanvas shape:
/// sections[{heading, bullets, accentColor, span, type, callout}], key_points, summary_box.
library;

String _str(dynamic v) => v == null ? '' : v.toString();

List<String> _strList(dynamic v) => (v is List)
    ? v.map((e) => e?.toString() ?? '').where((e) => e.trim().isNotEmpty).toList()
    : <String>[];

class NoteDoc {
  final String title;
  final String subtitle;
  final String layout; // '1col' | '2col' | '3col'
  final List<String> tags;
  final List<NoteSection> sections;
  final List<String> keyPoints;
  final String summaryBox;
  final bool locked; // subscription doesn't include this lesson
  final String lockReason;
  final int noteId; // ai_illustrated_notes id (for bookmarking); 0 if unknown

  NoteDoc({
    required this.title,
    required this.subtitle,
    required this.layout,
    required this.tags,
    required this.sections,
    required this.keyPoints,
    required this.summaryBox,
    this.locked = false,
    this.lockReason = '',
    this.noteId = 0,
  });

  /// No note generated for an accessible lesson.
  factory NoteDoc.empty() => NoteDoc(
        title: '',
        subtitle: '',
        layout: '1col',
        tags: const [],
        sections: const [],
        keyPoints: const [],
        summaryBox: '',
      );

  factory NoteDoc.fromApi(dynamic raw) {
    final note = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final data =
        note['noteData'] ?? note['note_data'] ?? note['data'] ?? note['canvas'] ?? note;
    final dataMap = (data is Map) ? Map<String, dynamic>.from(data) : <String, dynamic>{};

    // A note can hold several pages (web `normalizeNoteData` → `pages[]`). Merge
    // them ALL like the web's `mergeStudentCanvasPages`: flatten every page's
    // sections + key_points, join summaries — otherwise only page 1 shows.
    final pages = (dataMap['pages'] is List && (dataMap['pages'] as List).isNotEmpty)
        ? (dataMap['pages'] as List)
        : [dataMap];
    final pageMaps = pages
        .map((p) => (p is Map) ? Map<String, dynamic>.from(p) : <String, dynamic>{})
        .toList();
    final first = pageMaps.first;

    final sections = <NoteSection>[];
    final keyPoints = <String>[];
    final summaries = <String>[];
    for (final p in pageMaps) {
      if (p['sections'] is List) {
        sections.addAll((p['sections'] as List).map(NoteSection.fromJson));
      }
      keyPoints.addAll(_strList(p['key_points']));
      final sb = _str(p['summary_box']).trim();
      if (sb.isNotEmpty) summaries.add(sb);
    }

    // Subscription gating: the backend sets accessLocked/canAccess and strips
    // noteData when the lesson isn't in the user's plan.
    final locked = note['accessLocked'] == true || note['canAccess'] == false;
    final lockReason = _str(_str(note['lockReason']).isNotEmpty
        ? note['lockReason']
        : note['upgradeLabel']);

    return NoteDoc(
      title: _str(first['title'] ?? note['lessonTitle'] ?? note['title'] ?? 'Note'),
      subtitle: _str(first['subtitle'] ?? first['subject'] ?? note['courseTitle'] ?? ''),
      layout: _str(first['layout'] ?? '2col'),
      tags: _strList(first['tags']),
      sections: sections,
      keyPoints: keyPoints,
      summaryBox: summaries.join('   ·   '),
      locked: locked,
      lockReason: lockReason,
      noteId: int.tryParse(
              '${note['id'] ?? note['noteId'] ?? note['aiNoteId'] ?? ''}') ??
          0,
    );
  }

  /// True when the API returned nothing meaningful to render.
  bool get isEmpty =>
      sections.isEmpty && keyPoints.isEmpty && summaryBox.trim().isEmpty;

}

/// A row in the AI-notes list (`GET /student/ai-notes`).
class NoteListItem {
  final String id;
  final String lessonId;
  final String title;
  final String subtitle;
  NoteListItem(
      {required this.id,
      required this.lessonId,
      required this.title,
      required this.subtitle});

  factory NoteListItem.fromJson(dynamic raw) {
    final n = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return NoteListItem(
      id: _str(n['id'] ?? n['noteId']),
      lessonId: _str(n['lessonId'] ?? n['lesson_id'] ?? n['id']),
      title: _str(n['lessonTitle'] ?? n['title'] ?? 'Untitled note'),
      subtitle: _str(n['courseTitle'] ?? n['subjectName'] ?? n['subject'] ?? ''),
    );
  }
}

class NoteSection {
  final String heading;
  final List<String> bullets;
  final String? accentColor; // hex like '#2563eb'
  final String span; // 'half' | 'wide' | 'full'
  final String type; // 'text' | 'image' | 'image-explained'
  final String callout;
  final String? imageSrc;

  NoteSection({
    required this.heading,
    required this.bullets,
    required this.accentColor,
    required this.span,
    required this.type,
    required this.callout,
    required this.imageSrc,
  });

  factory NoteSection.fromJson(dynamic raw) {
    final s = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final ac = s['accentColor'];
    final img = s['src'] ?? (s['sectionImage'] is Map ? (s['sectionImage'] as Map)['src'] : null);
    return NoteSection(
      heading: _str(s['heading'] ?? s['title']),
      bullets: _strList(s['bullets']),
      accentColor: (ac is String && ac.isNotEmpty) ? ac : null,
      span: _str(s['span'].toString().isEmpty ? 'half' : s['span']),
      type: _str((s['type'] ?? 'text').toString().isEmpty ? 'text' : s['type']),
      callout: _str(s['callout']),
      imageSrc: (img is String && img.isNotEmpty) ? img : null,
    );
  }

  bool get isImage => type == 'image' || type == 'image-explained';
}

/// One run of inline text — `==highlight==` or `**bold**` or plain.
class InlineRun {
  final String text;
  final bool highlight;
  final bool bold;
  const InlineRun(this.text, {this.highlight = false, this.bold = false});
}

/// Parse the web inline markers (`==…==` highlight, `**…**` bold) into runs.
List<InlineRun> parseInline(String input) {
  final runs = <InlineRun>[];
  var s = input;
  while (s.isNotEmpty) {
    final hi = s.indexOf('==');
    final bd = s.indexOf('**');
    final next = [
      if (hi != -1) hi,
      if (bd != -1) bd,
    ].fold<int>(-1, (a, b) => a == -1 ? b : (b < a ? b : a));
    if (next == -1) {
      runs.add(InlineRun(s));
      break;
    }
    if (next > 0) {
      runs.add(InlineRun(s.substring(0, next)));
      s = s.substring(next);
      continue;
    }
    if (s.startsWith('==')) {
      final e = s.indexOf('==', 2);
      if (e == -1) {
        runs.add(InlineRun(s));
        break;
      }
      runs.add(InlineRun(s.substring(2, e), highlight: true));
      s = s.substring(e + 2);
    } else {
      final e = s.indexOf('**', 2);
      if (e == -1) {
        runs.add(InlineRun(s));
        break;
      }
      runs.add(InlineRun(s.substring(2, e), bold: true));
      s = s.substring(e + 2);
    }
  }
  return runs;
}
