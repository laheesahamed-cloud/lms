/// Note document model — parses the JSON from `GET /student/ai-notes/lesson/:lessonId`.
/// Defensive: the canvas content can be at the top level, under `noteData`/`note_data`,
/// or wrapped in `pages[]` (web `normalizeNoteData`). Mirrors the web NoteCanvas shape:
/// sections[{heading, bullets, accentColor, span, type, callout}], key_points, summary_box.
library;

String _str(dynamic v) => v == null ? '' : v.toString();

List<String> _strList(dynamic v) => (v is List)
    ? v.map((e) => e?.toString() ?? '').where((e) => e.trim().isNotEmpty).toList()
    : <String>[];

double? _numOrNull(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.trim());
  return null;
}

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
  final bool lessonCompleted;
  final String lessonProgressStatus; // 'not_started' | 'in_progress' | 'completed'

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
    this.lessonCompleted = false,
    this.lessonProgressStatus = 'not_started',
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
      lessonCompleted: note['lessonCompleted'] == true || note['lesson_progress_status'] == 'completed',
      lessonProgressStatus: _str(note['lessonProgressStatus'] ?? note['lesson_progress_status'] ?? 'not_started'),
    );
  }

  /// True when the API returned nothing meaningful to render.
  bool get isEmpty =>
      sections.isEmpty && keyPoints.isEmpty && summaryBox.trim().isEmpty;

}

/// A row in the AI-notes list (`GET /student/ai-notes`).
class NoteListItem {
  final String id;          // note's own id — always set
  final String lessonId;    // linked lesson id — empty for topic-level notes
  final String lessonTitle; // raw lesson title from API — empty when lesson was deleted
  final String title;       // display title (lessonTitle ?? note title)
  final String courseTitle;
  final String courseId;
  final String examType;
  final String subjectName; // topicName from API (subject grouping)
  final String topicName;   // subtopicName from API (divider within subject)

  NoteListItem({
    required this.id,
    required this.lessonId,
    required this.lessonTitle,
    required this.title,
    required this.courseTitle,
    required this.courseId,
    required this.examType,
    required this.subjectName,
    required this.topicName,
  });

  String get subtitle => courseTitle;

  // True when this note's linked lesson still exists (or it's a topic-level note)
  bool get lessonExists => lessonId.isEmpty || lessonTitle.isNotEmpty;

  // Best id for canvas navigation: real lessonId when present, else note's own id
  String get canvasId => lessonId.isNotEmpty ? lessonId : id;

  factory NoteListItem.fromJson(dynamic raw) {
    final n = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final rawLessonTitle = _str(n['lessonTitle'] ?? n['lesson_title'] ?? '');
    return NoteListItem(
      id: _str(n['id'] ?? n['noteId']),
      lessonId: _str(n['lessonId'] ?? n['lesson_id'] ?? ''),
      lessonTitle: rawLessonTitle,
      title: rawLessonTitle.isNotEmpty ? rawLessonTitle : _str(n['title'] ?? 'Untitled note'),
      courseTitle: _str(n['courseTitle'] ?? ''),
      courseId: _str(n['courseId'] ?? n['course_id'] ?? ''),
      examType: _str(n['examType'] ?? ''),
      subjectName: _str(n['topicName'] ?? n['topic_name'] ?? n['subjectName'] ?? n['subject'] ?? ''),
      topicName: _str(n['subtopicName'] ?? n['subtopic_name'] ?? ''),
    );
  }
}

/// Notes grouped by course — used for the course-card list view.
class NoteCourseGroup {
  final String courseTitle;
  final String courseId;
  final String examType;
  final List<NoteListItem> lessons;
  const NoteCourseGroup({
    required this.courseTitle,
    required this.courseId,
    required this.examType,
    required this.lessons,
  });
  int get lessonCount => lessons.length;
}

/// Notes grouped by subject — used inside a course detail page.
class NoteSubjectGroup {
  final String subjectName;
  final List<NoteListItem> lessons;
  const NoteSubjectGroup({required this.subjectName, required this.lessons});
}

/// Groups a flat list of notes into per-course buckets, preserving order.
List<NoteCourseGroup> groupNotesByCourse(List<NoteListItem> items) {
  final map = <String, NoteCourseGroup>{};
  final order = <String>[];
  for (final item in items) {
    final key = item.courseId.isNotEmpty ? item.courseId : item.courseTitle;
    if (!map.containsKey(key)) {
      order.add(key);
      map[key] = NoteCourseGroup(
        courseTitle: item.courseTitle.isNotEmpty ? item.courseTitle : 'General',
        courseId: item.courseId,
        examType: item.examType,
        lessons: [],
      );
    }
    map[key]!.lessons.add(item);
  }
  return order.map((k) => map[k]!).toList();
}

/// Groups lessons within a course by subject, preserving order.
List<NoteSubjectGroup> groupNotesBySubject(List<NoteListItem> lessons) {
  final map = <String, List<NoteListItem>>{};
  final order = <String>[];
  for (final item in lessons) {
    final key = item.subjectName.isNotEmpty ? item.subjectName : 'General';
    if (!map.containsKey(key)) {
      order.add(key);
      map[key] = [];
    }
    map[key]!.add(item);
  }
  return order.map((k) => NoteSubjectGroup(subjectName: k, lessons: map[k]!)).toList();
}

/// An image attached to a TEXT section (`section.sectionImage`). Mirrors the web
/// nested object: { src, caption, position, imageWidth, imageHeight, imageFit }.
class SectionImage {
  final String src; // URL or base64 data: URI
  final String caption;
  final String position; // 'top'|'bottom'|'left'|'right' (default 'bottom')
  final double? imageWidth;
  final double? imageHeight;
  final String imageFit; // 'contain'|'cover'

  const SectionImage({
    required this.src,
    required this.caption,
    required this.position,
    required this.imageWidth,
    required this.imageHeight,
    required this.imageFit,
  });

  static SectionImage? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final m = Map<String, dynamic>.from(raw);
    final src = _str(m['src']);
    if (src.isEmpty) return null;
    var pos = _str(m['position']);
    if (pos.isEmpty) pos = 'bottom';
    var fit = _str(m['imageFit']);
    if (fit.isEmpty) fit = 'contain';
    return SectionImage(
      src: src,
      caption: _str(m['caption']),
      position: pos,
      imageWidth: _numOrNull(m['imageWidth']),
      imageHeight: _numOrNull(m['imageHeight']),
      imageFit: fit,
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
  final String? imageSrc; // direct src for type 'image'/'image-explained'
  final String caption; // image / image-explained title
  final String explanation; // image-explained body (\n-separated paragraphs)
  final double? imageWidth;
  final double? imageHeight;
  final String imageFit; // 'contain'|'cover'
  final SectionImage? sectionImage; // image embedded inside a text section

  NoteSection({
    required this.heading,
    required this.bullets,
    required this.accentColor,
    required this.span,
    required this.type,
    required this.callout,
    required this.imageSrc,
    required this.caption,
    required this.explanation,
    required this.imageWidth,
    required this.imageHeight,
    required this.imageFit,
    required this.sectionImage,
  });

  factory NoteSection.fromJson(dynamic raw) {
    final s = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final ac = s['accentColor'];
    final directSrc = _str(s['src']);
    var fit = _str(s['imageFit']);
    if (fit.isEmpty) fit = 'contain';
    return NoteSection(
      heading: _str(s['heading'] ?? s['title']),
      bullets: _strList(s['bullets']),
      accentColor: (ac is String && ac.isNotEmpty) ? ac : null,
      span: _str(s['span'].toString().isEmpty ? 'half' : s['span']),
      type: _str((s['type'] ?? 'text').toString().isEmpty ? 'text' : s['type']),
      callout: _str(s['callout']),
      imageSrc: directSrc.isNotEmpty ? directSrc : null,
      caption: _str(s['caption']),
      explanation: _str(s['explanation']),
      imageWidth: _numOrNull(s['imageWidth']),
      imageHeight: _numOrNull(s['imageHeight']),
      imageFit: fit,
      sectionImage: SectionImage.fromJson(s['sectionImage']),
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
