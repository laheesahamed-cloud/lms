import '../../state/content_files.dart';
import 'dart:convert';
import 'dart:async';
import '../../core/perf_log.dart';
import '../../state/catalogue.dart';
import '../../state/study_days.dart';
import '../../state/weak_topics.dart';
import '../../services/xp_gain.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import '../../state/saved_first.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';
List<String> _sl(dynamic v) => (v is List)
    ? v.map((e) => e?.toString() ?? '').where((e) => e.trim().isNotEmpty).toList()
    : <String>[];

/// A quiz in the Q-Bank / exam list — `GET /quiz-attempts/quizzes`.
class QuizListItem {
  final String id;
  final String courseId;
  final String title;
  final String description;
  final String subjectName;
  final String courseTitle;
  final String examType;
  final String lessonTitle;
  final String lessonId;
  // Hierarchy fields used for categorization + ordering (mirror the web LMS).
  final String topicName;
  final String subtopicName;
  final int quizNumber;
  final String displayTitleMode; // 'number' → "Quiz N", else show the title
  final bool isGeneral;
  final int totalQuestions;
  final int timeLimit;
  final int passingMarks;
  final bool locked;
  final bool canPractice;
  final bool canExam;
  final bool examModeOnly;
  final bool isFree;
  bool isCompleted; // mutable: optimistic "finished practice" mark

  QuizListItem({
    required this.id,
    required this.courseId,
    required this.title,
    required this.description,
    required this.subjectName,
    required this.courseTitle,
    required this.examType,
    required this.lessonTitle,
    required this.lessonId,
    required this.topicName,
    required this.subtopicName,
    required this.quizNumber,
    required this.displayTitleMode,
    required this.isGeneral,
    required this.totalQuestions,
    required this.timeLimit,
    required this.passingMarks,
    required this.locked,
    required this.canPractice,
    required this.canExam,
    required this.examModeOnly,
    required this.isFree,
    required this.isCompleted,
  });

  factory QuizListItem.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return QuizListItem(
      id: _s(m['id']),
      courseId: _s(m['courseId'] ?? m['course_id']),
      title: _s(m['studentTitle'] ?? m['quizTitle'] ?? m['title'] ?? 'Quiz'),
      description: _s(m['quizDescription']),
      subjectName: _s(m['subjectName'] ?? m['subtopicName']),
      courseTitle: _s(m['courseTitle']),
      examType: _s(m['examType']),
      lessonTitle: _s(m['lessonTitle']),
      lessonId: _s(m['lessonId'] ?? m['lesson_id']),
      topicName: _s(m['topicName']),
      subtopicName: _s(m['subtopicName']),
      quizNumber: _i(m['quizNumber'] ?? m['quiz_number']),
      // Backend defaults anything that isn't explicitly 'title' to number mode.
      displayTitleMode: m['displayTitleMode'] == 'title' ? 'title' : 'number',
      isGeneral: _b(m['isGeneral'] ?? m['is_general']),
      totalQuestions: _i(m['totalQuestions']),
      timeLimit: _i(m['timeLimit']),
      passingMarks: _i(m['passingMarks']),
      locked: _b(m['accessLocked']),
      canPractice: _b(m['canPracticeMode']),
      canExam: _b(m['canExamMode']),
      examModeOnly: _b(m['examModeOnly']),
      isFree: _b(m['isFree']),
      isCompleted: _b(m['isCompleted']),
    );
  }

  /// The student-facing name shown consistently everywhere a quiz is named
  /// (Q-Bank list, the dashboard "Continue" card, …): its one name (10.25).
  String get displayName {
    return title.trim().isNotEmpty ? title.trim() : 'Quiz';
  }

  /// The row label, mirroring the web `getQuizRowLabel`: [displayName] with a
  /// positional fallback ("Practice set N") when a set has no title.
  String rowLabel(int index) {
    return title.trim().isNotEmpty ? title.trim() : 'Practice set ${index + 1}';
  }

  /// Which categorization bucket this quiz falls into (mirror web
  /// `getQuizScopeKey`): a lesson set, a full-course revision set, or a subject.
  String get scopeKey {
    if (lessonId.trim().isNotEmpty || lessonTitle.trim().isNotEmpty) return 'lesson';
    if (isGeneral) return 'full-course';
    return 'subject';
  }
}

/// One answer option (practice mode carries isCorrect + whyIncorrect).
class QOption {
  final int id;
  final String label;
  final String text;
  final bool isCorrect;
  final String whyIncorrect;
  QOption({
    required this.id,
    required this.label,
    required this.text,
    required this.isCorrect,
    required this.whyIncorrect,
  });

  factory QOption.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return QOption(
      id: _i(m['id']),
      label: _s(m['optionLabel'] ?? m['label']),
      text: _s(m['optionText'] ?? m['text']),
      isCorrect: _b(m['isCorrect']),
      whyIncorrect: _s(m['whyIncorrect'] ?? m['why_incorrect']),
    );
  }
}

/// Quick theory recap shown on reveal.
class TheoryRecap {
  final String conceptName;
  final String course;
  final String subject;
  final String topic;
  final String lesson;
  final List<String> etiology;
  final List<String> pathophysiology;
  final List<String> clinicalFeatures;
  final List<String> investigations;
  final List<String> treatment;
  final List<String> keyPoints;
  final String mnemonic;

  TheoryRecap({
    required this.conceptName,
    required this.course,
    required this.subject,
    required this.topic,
    required this.lesson,
    required this.etiology,
    required this.pathophysiology,
    required this.clinicalFeatures,
    required this.investigations,
    required this.treatment,
    required this.keyPoints,
    required this.mnemonic,
  });

  bool get isEmpty =>
      etiology.isEmpty &&
      pathophysiology.isEmpty &&
      clinicalFeatures.isEmpty &&
      investigations.isEmpty &&
      treatment.isEmpty &&
      keyPoints.isEmpty &&
      mnemonic.trim().isEmpty;

  static TheoryRecap? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final m = Map<String, dynamic>.from(raw);
    final h = (m['hierarchy'] is Map)
        ? Map<String, dynamic>.from(m['hierarchy'])
        : <String, dynamic>{};
    final r = TheoryRecap(
      conceptName: _s(m['conceptName']),
      course: _s(h['course']),
      subject: _s(h['subject']),
      topic: _s(h['topic']),
      lesson: _s(h['lesson']),
      etiology: _sl(m['etiology']),
      pathophysiology: _sl(m['pathophysiology']),
      clinicalFeatures: _sl(m['clinicalFeatures']),
      investigations: _sl(m['investigations']),
      treatment: _sl(m['treatment']),
      keyPoints: _sl(m['keyPoints']),
      mnemonic: _s(m['mnemonic']),
    );
    return r.isEmpty && r.conceptName.isEmpty ? null : r;
  }
}

/// A practice question with everything needed for the answer reveal.
class PracticeQuestion {
  final int id;
  final String type; // 'sba' | 'true_false'
  final String text;
  final String explanation;
  final String explanationImageUrl;
  final String questionApproach;
  final List<String> questionApproachHighlights;
  final List<QOption> options;
  final Set<int> correctOptionIds;
  final TheoryRecap? recap;

  PracticeQuestion({
    required this.id,
    required this.type,
    required this.text,
    required this.explanation,
    required this.explanationImageUrl,
    required this.questionApproach,
    required this.questionApproachHighlights,
    required this.options,
    required this.correctOptionIds,
    required this.recap,
  });

  factory PracticeQuestion.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final options = (m['options'] is List)
        ? (m['options'] as List).map(QOption.fromJson).toList()
        : <QOption>[];
    // Correct ids: prefer answerKey, else derive from options' isCorrect.
    final correct = <int>{};
    final ak = m['answerKey'];
    if (ak is Map) {
      for (final co in (ak['correctOptions'] is List ? ak['correctOptions'] as List : const [])) {
        if (co is Map && co['optionId'] != null) correct.add(_i(co['optionId']));
      }
    }
    for (final o in options) {
      if (o.isCorrect) correct.add(o.id);
    }
    return PracticeQuestion(
      id: _i(m['id']),
      type: _s(m['questionType'].toString().isEmpty ? 'sba' : m['questionType']),
      text: _s(m['questionText'] ?? m['text']),
      explanation: _s(m['explanation']),
      explanationImageUrl: _s(m['explanationImageUrl']),
      questionApproach: _s(m['questionApproach']),
      questionApproachHighlights: _sl(m['questionApproachHighlights']),
      options: options,
      correctOptionIds: correct,
      recap: TheoryRecap.fromJson(m['theoryRecap']),
    );
  }
}

class PracticeQuiz {
  final String title;
  final int totalQuestions;
  final int timeLimit; // minutes (exam mode)
  final int passingMarks; // % needed to pass (10.28: a passed practice pays 1 XP)
  final List<PracticeQuestion> questions;
  PracticeQuiz(
      {required this.title,
      required this.totalQuestions,
      required this.timeLimit,
      this.passingMarks = 45,
      required this.questions});

  factory PracticeQuiz.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final quiz = (m['quiz'] is Map) ? Map<String, dynamic>.from(m['quiz']) : <String, dynamic>{};
    final qs = (m['questions'] is List)
        ? (m['questions'] as List).map(PracticeQuestion.fromJson).toList()
        : <PracticeQuestion>[];
    return PracticeQuiz(
      title: _s(quiz['studentTitle'] ?? quiz['quizTitle'] ?? 'Quiz'),
      totalQuestions: _i(quiz['totalQuestions'] ?? qs.length),
      timeLimit: _i(quiz['timeLimit']),
      passingMarks: _i(quiz['passingMarks']) > 0 ? _i(quiz['passingMarks']) : 45,
      questions: qs,
    );
  }
}

/// Quizzes grouped under one course (web CoursePicker structure).
class QuizCourseGroup {
  final String courseName;
  final String examType;
  final List<QuizListItem> quizzes;
  QuizCourseGroup(this.courseName, this.examType, this.quizzes);

  int get subjectCount =>
      quizzes.map((q) => q.subjectName.isEmpty ? 'General' : q.subjectName).toSet().length;
}

/// Group a flat quiz list into course-wise categories, preserving order.
List<QuizCourseGroup> groupQuizzesByCourse(List<QuizListItem> quizzes) {
  final order = <String>[];
  final map = <String, List<QuizListItem>>{};
  final examTypeMap = <String, String>{};
  for (final q in quizzes) {
    final key = q.courseTitle.trim().isEmpty ? 'General' : q.courseTitle.trim();
    if (!map.containsKey(key)) {
      order.add(key);
      map[key] = [];
      examTypeMap[key] = q.examType;
    }
    map[key]!.add(q);
  }
  return order.map((k) => QuizCourseGroup(k, examTypeMap[k] ?? '', map[k]!)).toList();
}

// ---------------------------------------------------------------------------
// CATEGORIZATION — the course-detail "view by" scopes (mirror the web LMS
// QUIZ_SCOPE_OPTIONS + getQuizScopeKey + sortQuizzesByHierarchy).
// ---------------------------------------------------------------------------

/// How the course-detail page groups/filters its quiz sets.
enum QuizScope { all, lesson, subject, fullCourse }

extension QuizScopeMeta on QuizScope {
  /// Matches `QuizListItem.scopeKey` for filtering.
  String get key => switch (this) {
        QuizScope.all => 'all',
        QuizScope.lesson => 'lesson',
        QuizScope.subject => 'subject',
        QuizScope.fullCourse => 'full-course',
      };

  /// Dropdown label.
  String get label => switch (this) {
        QuizScope.all => 'All',
        QuizScope.lesson => 'Lesson-wise',
        QuizScope.subject => 'Subject-wise',
        QuizScope.fullCourse => 'Full course-wise',
      };

  /// Singular noun for the "All {x}s" filter chip.
  String get groupingNoun => switch (this) {
        QuizScope.lesson => 'lesson',
        QuizScope.fullCourse => 'revision group',
        _ => 'subject',
      };
}

/// One categorized group of quizzes shown under a header.
class QuizScopeGroup {
  final String label;
  final List<QuizListItem> quizzes;
  QuizScopeGroup(this.label, this.quizzes);
}

String? _firstNonEmpty(List<String> values) {
  for (final v in values) {
    if (v.trim().isNotEmpty) return v.trim();
  }
  return null;
}

/// Numeric-aware compare so "Quiz 2" sorts before "Quiz 10" (mirrors the web
/// `localeCompare(..., {numeric: true, sensitivity: 'base'})`).
int _naturalCompare(String a, String b) {
  final chunk = RegExp(r'\d+|\D+');
  final pa = chunk.allMatches(a).map((m) => m.group(0)!).toList();
  final pb = chunk.allMatches(b).map((m) => m.group(0)!).toList();
  final n = pa.length < pb.length ? pa.length : pb.length;
  for (var i = 0; i < n; i++) {
    final x = pa[i], y = pb[i];
    final nx = int.tryParse(x), ny = int.tryParse(y);
    final cmp = (nx != null && ny != null)
        ? nx.compareTo(ny)
        : x.toLowerCase().compareTo(y.toLowerCase());
    if (cmp != 0) return cmp;
  }
  return pa.length.compareTo(pb.length);
}

/// Order quizzes by hierarchy then quiz number (mirror sortQuizzesByHierarchy).
List<QuizListItem> sortQuizzesByHierarchy(List<QuizListItem> items) {
  String key(QuizListItem q) => [
        q.topicName,
        q.subtopicName,
        q.lessonTitle,
        q.quizNumber > 0 ? '${q.quizNumber}' : '',
        q.title,
      ].where((s) => s.trim().isNotEmpty).join('');
  final copy = [...items]..sort((a, b) => _naturalCompare(key(a), key(b)));
  return copy;
}

/// Keep only the quizzes that belong to the selected scope.
List<QuizListItem> filterQuizzesByScope(
    List<QuizListItem> quizzes, QuizScope scope) {
  if (scope == QuizScope.all) return quizzes;
  return quizzes.where((q) => q.scopeKey == scope.key).toList();
}

String _scopeGroupLabel(QuizListItem q, QuizScope scope, String courseName) {
  switch (scope) {
    case QuizScope.lesson:
      return _firstNonEmpty([q.subjectName, q.topicName, q.lessonTitle]) ??
          'Lesson practice';
    case QuizScope.fullCourse:
      return _firstNonEmpty([q.courseTitle, courseName]) ??
          'Full course revision';
    case QuizScope.subject:
    case QuizScope.all:
      if (q.subjectName.trim().isNotEmpty) return q.subjectName.trim();
      return q.isGeneral ? 'General / Full Course Revision' : 'General';
  }
}

/// Group quizzes for the selected scope, preserving hierarchy order.
List<QuizScopeGroup> groupQuizzesByScope(
    List<QuizListItem> quizzes, QuizScope scope, String courseName) {
  final order = <String>[];
  final map = <String, List<QuizListItem>>{};
  for (final q in sortQuizzesByHierarchy(quizzes)) {
    final label = _scopeGroupLabel(q, scope, courseName);
    if (!map.containsKey(label)) {
      order.add(label);
      map[label] = [];
    }
    map[label]!.add(q);
  }
  return order.map((l) => QuizScopeGroup(l, map[l]!)).toList();
}

/// The Q-Bank / exam quiz list.
/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
/// Every active quiz set with this student's done / lock state. Built on the
/// phone from the shared catalogue and the student's progress (step 5): no
/// quiz-list request.
final quizListProvider = FutureProvider<List<QuizListItem>>((ref) async {
  ref.watch(userScopeProvider);
  final cat = await ref.watch(quizCatalogueProvider.future);
  final prog = await ref.watch(studentProgressProvider.future);
  final items = buildQuizItems(cat, prog);
  PerfLog.mark('quiz list built (${items.length})');
  return items;
});

const _generalLabel = 'General / Full Course Revision';

List<QuizListItem> buildQuizItems(Catalogue cat, StudentProgress prog) {
  final out = <QuizListItem>[];
  for (final q in cat.quizzes) {
    final id = q[0] as int, courseId = q[1] as int;
    final course = cat.courseById[courseId];
    final subject = '${cat.subjectById[q[2]]?[2] ?? ''}';
    final topic = '${cat.topicById[q[3]]?[2] ?? ''}';
    final isGeneral = q[5] == 1, isFree = q[7] == 1, isDynamic = q[15] == 1;
    final general = isGeneral && subject.isEmpty ? _generalLabel : '';
    final can = prog.canOpenQuiz(courseId, isFree);
    final canDynamic = !isDynamic || isFree || prog.features;
    final p = prog.quizzes[id];
    final studentTitle = '${q[8]}'.isNotEmpty ? '${q[8]}' : '${q[9]}';
    out.add(QuizListItem.fromJson(<String, dynamic>{
      'id': id,
      'courseId': courseId,
      'topicId': q[2],
      'subtopicId': q[3] == 0 ? null : q[3],
      'lessonId': q[4] == 0 ? null : q[4],
      'isGeneral': isGeneral,
      'examModeOnly': q[6] == 1,
      'quizTitle': '${q[9]}',
      'studentTitle': studentTitle,
      'displayTitleMode': q[10] == 1 ? 'number' : 'title',
      'quizNumber': q[11] == 0 ? null : q[11],
      'quizDescription': '',
      'totalQuestions': q[12],
      'timeLimit': q[13],
      'passingMarks': q[14],
      'courseTitle': '${course?[1] ?? ''}',
      'examType': '${course?[3] ?? ''}',
      'subjectName': subject.isNotEmpty ? subject : general,
      'topicName': topic.isNotEmpty ? topic : (general.isNotEmpty ? '\u3000$general' : ''),
      'subtopicName': topic,
      'lessonTitle': '${cat.lessonById[q[4]]?[4] ?? ''}',
      'isCompleted': p != null && (p[0] > 0 || p[1] > 0),
      'isFree': isFree,
      'accessLocked': !(can && canDynamic),
      'canPracticeMode': can && canDynamic && (prog.features || isFree),
      'canExamMode': can && canDynamic && (prog.features || isFree),
    }));
  }
  return out;
}

/// Load a quiz in practice mode (answers + explanations inline for the reveal).
/// Step 5: a downloaded practice quiz is kept on the phone (a file) and reused
/// until the catalogue version changes (any admin content save), so practising
/// it again or reopening it costs no request. Only quizzes this student may
/// open are kept/used.
final practiceQuizProvider =
    FutureProvider.autoDispose.family<PracticeQuiz, String>((ref, quizId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final info = await _quizInfo(_readerOf(ref), quizId);
  final file = 'quiz_$quizId.json';
  if (info.canOpen) {
    final saved = await _savedPracticeData(quizId, info.stamp);
    if (saved != null) return PracticeQuiz.fromJson(saved);
  }
  final res = await api.dio.get(
    '/quiz-attempts/quiz/$quizId',
    queryParameters: const {'mode': 'practice'},
  );
  if (info.canOpen && res.data is Map) {
    unawaited(ContentFiles.write(file, jsonEncode({'s': info.stamp, 'v': catalogueVersion, 'data': res.data})));
  }
  return PracticeQuiz.fromJson(res.data);
});

/// The two lists a quiz check needs, read through a provider [Ref] or a
/// widget's [WidgetRef] (both already loaded; no request).
typedef _Read = ({Future<Catalogue> Function() cat, Future<StudentProgress> Function() prog});
_Read _readerOf(Ref ref) => (cat: () => ref.read(quizCatalogueProvider.future), prog: () => ref.read(studentProgressProvider.future));
_Read _readerOfWidget(WidgetRef ref) => (cat: () => ref.read(quizCatalogueProvider.future), prog: () => ref.read(studentProgressProvider.future));

/// What the phone knows about a quiz from the Q-Bank list (no request):
/// whether this student can open it, its content stamp (10.27 R3) and whether
/// it is a dynamic set (a new mix of questions each open).
Future<({bool canOpen, int? stamp, bool dynamic})> _quizInfo(_Read read, String quizId) async {
  try {
    final cat = await read.cat();
    final prog = await read.prog();
    final id = int.tryParse(quizId) ?? 0;
    for (final q in cat.quizzes) {
      if (q[0] == id) {
        final canOpen = prog.canOpenQuiz(q[1] as int, q[7] == 1) && (q[15] == 0 || q[7] == 1 || prog.features);
        final stamp = q.length > 16 ? (q[16] as num?)?.toInt() : null;
        return (canOpen: canOpen, stamp: stamp, dynamic: q[15] == 1);
      }
    }
  } catch (_) {}
  return (canOpen: false, stamp: null, dynamic: false);
}

/// The saved practice quiz when it is still this quiz's current content:
/// same quiz stamp (10.27 R3: kept until THIS quiz changes), or — from a
/// server without stamps — the same list version.
Future<Map<String, dynamic>?> _savedPracticeData(String quizId, int? stamp) async {
  final saved = await ContentFiles.read('quiz_$quizId.json');
  if (saved == null) return null;
  try {
    final m = jsonDecode(saved) as Map;
    final ok = stamp != null
        ? (m['s'] as num?)?.toInt() == stamp
        : catalogueVersion != null && (m['v'] as num?)?.toInt() == catalogueVersion;
    return ok && m['data'] is Map ? Map<String, dynamic>.from(m['data'] as Map) : null;
  } catch (_) {
    return null;
  }
}

/// 10.31: a Question of the Day picked from the practice sets already saved
/// on this phone — no request. Only sets this student can open and that are
/// still current; single-best-answer questions with exactly 5 options and one
/// right. Sets with the lowest best mark come first (revision), questions in
/// [skip] (recently shown) are left out. Null when nothing is saved.
Future<Map<String, dynamic>?> pickSavedPracticeQuestion(Ref ref, Set<int> skip) async {
  final read = _readerOf(ref);
  final files = await ContentFiles.names('quiz_');
  final ids = <int>[
    for (final f in files)
      if (RegExp(r'^quiz_(\d+)\.json$').firstMatch(f) case final m?) int.parse(m.group(1)!),
  ];
  if (ids.isEmpty) return null;
  StudentProgress? prog;
  try {
    prog = await read.prog();
  } catch (_) {}
  // Lowest best mark first; not-yet-marked sets after; ties shuffled.
  ids.shuffle();
  int rank(int id) => prog?.quizBest(id) ?? 101;
  ids.sort((a, b) => rank(a).compareTo(rank(b)));
  for (final id in ids) {
    final info = await _quizInfo(read, '$id');
    if (!info.canOpen) continue;
    final data = await _savedPracticeData('$id', info.stamp);
    if (data == null) continue;
    final quiz = PracticeQuiz.fromJson(data);
    final pool = quiz.questions
        .where((q) => q.type == 'sba' && q.options.length == 5 && q.correctOptionIds.length == 1 && !skip.contains(q.id))
        .toList()
      ..shuffle();
    if (pool.isEmpty) continue;
    final q = pool.first;
    return {
      'id': q.id,
      'questionType': q.type,
      'questionText': q.text,
      'courseTitle': '',
      'subjectName': quiz.title,
      'topicName': '',
      'options': [
        for (final o in q.options)
          {'id': o.id, 'optionLabel': o.label, 'optionText': o.text, 'isCorrect': q.correctOptionIds.contains(o.id)},
      ],
    };
  }
  return null;
}

/// 10.27 R4: a full review carries the practice header — keep its questions
/// as this quiz's practice copy too, so they're never downloaded twice.
Future<void> _keepPracticeFromReview(_Read read, String quizId, Map<String, dynamic> m) async {
  final header = m['practiceQuiz'];
  final questions = (m['review'] is Map) ? (m['review'] as Map)['questions'] : null;
  if (header is! Map || questions is! List || questions.isEmpty) return;
  final info = await _quizInfo(read, quizId);
  if (!info.canOpen || info.dynamic || info.stamp == null) return;
  const keys = ['id', 'questionType', 'questionText', 'explanation', 'explanationImageUrl',
    'questionApproach', 'questionApproachHighlights', 'options', 'theoryRecap'];
  final practice = {
    'mode': 'practice',
    'quiz': header,
    'questions': [
      for (final q in questions)
        if (q is Map) {for (final k in keys) if (q.containsKey(k)) k: q[k]},
    ],
  };
  await ContentFiles.write('quiz_$quizId.json', jsonEncode({'s': info.stamp, 'v': catalogueVersion, 'data': practice}));
}

// ---------------------------------------------------------------------------
// EXAM MODE — real exam sessions submitted to the DB (mirrors the web LMS).
// ---------------------------------------------------------------------------

/// The exam in progress, built from the start reply (`POST /quiz-attempts/exam/:id/start`).
class ExamSession {
  final int id;
  final String status; // in_progress | submitted | expired
  final int? secondsRemaining;
  final int lastQuestionIndex;
  final Map<String, dynamic> answers;
  final int? submittedAttemptId;

  ExamSession({
    required this.id,
    required this.status,
    required this.secondsRemaining,
    required this.lastQuestionIndex,
    required this.answers,
    required this.submittedAttemptId,
  });

  factory ExamSession.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return ExamSession(
      id: _i(m['id']),
      status: _s(m['status'].toString().isEmpty ? 'in_progress' : m['status']),
      secondsRemaining: m['secondsRemaining'] == null
          ? null
          : _i(m['secondsRemaining']),
      lastQuestionIndex: _i(m['lastQuestionIndex']),
      answers: (m['answers'] is Map)
          ? Map<String, dynamic>.from(m['answers'])
          : <String, dynamic>{},
      submittedAttemptId:
          m['submittedAttemptId'] == null ? null : _i(m['submittedAttemptId']),
    );
  }
}

/// The full payload for an exam attempt: quiz meta, session, and questions
/// (no answer keys — this is a live exam).
class ExamLoad {
  final String title;
  final int totalQuestions;
  final int timeLimit; // minutes
  final ExamSession session;
  final List<PracticeQuestion> questions;
  /// The signed exam token (OPTIMIZE 10.16) and when the exam started.
  final String examToken;
  final DateTime? startedAt;

  ExamLoad({
    required this.title,
    required this.totalQuestions,
    required this.timeLimit,
    required this.session,
    required this.questions,
    this.examToken = '',
    this.startedAt,
  });

  /// From the start reply (`POST /quiz-attempts/exam/:id/start`), new or kept on the phone.
  factory ExamLoad.fromStart(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final quiz = (m['quiz'] is Map) ? Map<String, dynamic>.from(m['quiz']) : <String, dynamic>{};
    final qs = (m['questions'] is List)
        ? (m['questions'] as List).map(PracticeQuestion.fromJson).toList()
        : <PracticeQuestion>[];
    final started = DateTime.tryParse('${m['startedAt'] ?? ''}');
    final deadline = DateTime.tryParse('${m['deadlineAt'] ?? ''}');
    final limit = _i(quiz['timeLimit']);
    return ExamLoad(
      title: _s(quiz['studentTitle'] ?? quiz['quizTitle'] ?? 'Exam'),
      totalQuestions: _i(quiz['totalQuestions'] ?? qs.length),
      timeLimit: limit,
      session: ExamSession(
        id: 0,
        status: 'in_progress',
        secondsRemaining: limit > 0 && deadline != null
            ? deadline.difference(DateTime.now()).inSeconds.clamp(0, limit * 60)
            : null,
        lastQuestionIndex: 0,
        answers: const {},
        submittedAttemptId: null,
      ),
      questions: qs,
      examToken: _s(m['examToken']),
      startedAt: started,
    );
  }

  factory ExamLoad.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final quiz =
        (m['quiz'] is Map) ? Map<String, dynamic>.from(m['quiz']) : <String, dynamic>{};
    final qs = (m['questions'] is List)
        ? (m['questions'] as List).map(PracticeQuestion.fromJson).toList()
        : <PracticeQuestion>[];
    return ExamLoad(
      title: _s(quiz['studentTitle'] ?? quiz['quizTitle'] ?? 'Exam'),
      totalQuestions: _i(quiz['totalQuestions'] ?? qs.length),
      timeLimit: _i(quiz['timeLimit']),
      session: ExamSession.fromJson(m['examSession']),
      questions: qs,
    );
  }
}

// ── Exams on the progress row (OPTIMIZE 10.16) ──────────────────────────────
// Start = 1 request (1 statement on the server), answering / resuming = on the
// phone, submit = 1 request (1 statement). The running exam is kept on the
// phone (`exam_<id>.json`) until it is submitted or its time is up.

String _examFile(String quizId) => 'exam_$quizId.json';
String _resultFile(String quizId) => 'result_$quizId.json';

/// This quiz's questions from the practice file on the phone (current quiz
/// stamp only, 10.27 R3), by question id — or null when the phone doesn't have it.
Future<Map<int, Map<String, dynamic>>?> _practiceQuestions(_Read read, String quizId) async {
  final info = await _quizInfo(read, quizId);
  final data = await _savedPracticeData(quizId, info.stamp);
  if (data == null) return null;
  final qs = (data['questions'] as List?) ?? const [];
  return {
    for (final q in qs)
      if (q is Map) _i(q['id']): Map<String, dynamic>.from(q),
  };
}

/// A lean review (10.26 P2: answer states only) joined with the question
/// text, options, explanation and recap from the practice file. Null when a
/// question isn't in the file (the caller then asks for the full review).
Map<String, dynamic>? _widenReview(Map<String, dynamic> m, Map<int, Map<String, dynamic>>? practice) {
  if (m['lean'] != true) return m;
  if (practice == null) return null;
  final review = Map<String, dynamic>.from(m['review'] as Map? ?? const {});
  final merged = <Map<String, dynamic>>[];
  for (final q in (review['questions'] as List? ?? const [])) {
    final answer = Map<String, dynamic>.from(q as Map);
    final question = practice[_i(answer['id'])];
    if (question == null) return null;
    merged.add({...question, ...answer});
  }
  review['questions'] = merged;
  return {...m, 'review': review}..remove('lean');
}

/// Starting this exam would push out a recent result that is not yet reviewed
/// and passed (the 5-result rule): the screen shows the lock card instead.
class ExamLockedException implements Exception {
  final int blockingQuizId;
  final String blockingTitle;
  /// The blocking result is passed: reviewing it is all that is needed.
  final bool reviewOnly;
  const ExamLockedException(this.blockingQuizId, this.blockingTitle, {this.reviewOnly = false});
  @override
  String toString() => 'Review and pass $blockingTitle first';
}

/// The recent result that blocks a new exam, or null (phone only, no request).
Future<({int quizId, String title, bool reviewOnly})?> examLockFor(Ref ref, int quizId) async {
  final prog = await ref.read(studentProgressProvider.future);
  final id = prog.examBlocker(quizId); // free-slot rule (10.18)
  if (id == null) return null;
  Catalogue? cat;
  try {
    cat = await ref.read(quizCatalogueProvider.future);
  } catch (_) {}
  return (quizId: id, title: examBlockerTitle(cat, id), reviewOnly: prog.examBlockerPassed(id));
}

/// The blocking result's quiz name for the lock card.
String examBlockerTitle(Catalogue? cat, int id) {
  for (final q in cat?.quizzes ?? const <List>[]) {
    if (q[0] == id) return '${q[8]}'.isNotEmpty ? '${q[8]}' : '${q[9]}';
  }
  return 'your oldest result';
}

/// Load a quiz in exam mode: the exam already running on this phone (until its
/// time is up), else a new one from the server.
final examQuizProvider =
    FutureProvider.autoDispose.family<ExamLoad, String>((ref, quizId) async {
  ref.watch(userScopeProvider);
  final saved = await ContentFiles.read(_examFile(quizId));
  if (saved != null && saved.isNotEmpty) {
    try {
      final m = jsonDecode(saved) as Map;
      final deadline = DateTime.tryParse('${(m['start'] as Map?)?['deadlineAt'] ?? ''}');
      if (deadline != null && DateTime.now().isBefore(deadline)) return ExamLoad.fromStart(m['start']);
    } catch (_) {}
  }
  final lock = await examLockFor(ref, int.tryParse(quizId) ?? 0);
  if (lock != null) throw ExamLockedException(lock.quizId, lock.title, reviewOnly: lock.reviewOnly);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.post('/quiz-attempts/exam/$quizId/start');
  await ContentFiles.write(_examFile(quizId), jsonEncode({'start': res.data}));
  return ExamLoad.fromStart(res.data);
});

/// Minimum time before an exam can be submitted (phone only, user rule):
/// first try = quiz time ÷ 10, redo of a failed quiz = ÷ 20, passed = 1 minute.
Duration minExamTime(StudentProgress? prog, int quizId, int timeLimitMinutes) {
  final total = Duration(minutes: timeLimitMinutes);
  if (prog == null || timeLimitMinutes <= 0) return Duration.zero;
  if (prog.quizPassed(quizId)) return const Duration(minutes: 1);
  if (prog.quizBest(quizId) != null) return total ~/ 20;
  return total ~/ 10;
}

/// Submit an exam (`POST /quiz-attempts/exam/:id/finish` with the token).
/// The result and the review come back in the reply and are kept on the phone;
/// the quiz byte and the recent entry are updated locally. Returns the id the
/// result screen opens with (the quiz id: one recent entry per quiz).
Future<int> submitExam(
  WidgetRef ref,
  String quizId,
  Map<String, dynamic> answers,
) async {
  final api = ref.read(apiClientProvider);
  final id = int.tryParse(quizId) ?? 0;
  String token = '';
  final saved = await ContentFiles.read(_examFile(quizId));
  if (saved != null && saved.isNotEmpty) {
    try {
      token = _s(((jsonDecode(saved) as Map)['start'] as Map)['examToken']);
    } catch (_) {}
  }
  // 10.26 P2: with the practice file on the phone, the reply carries only
  // the answers; the questions are joined here.
  final practice = await _practiceQuestions(_readerOfWidget(ref), quizId);
  final res = await api.dio.post(
    '/quiz-attempts/exam/$quizId/finish',
    data: {'examToken': token, 'answers': answers, if (practice != null) 'lean': true},
  );
  final reply = (res.data is Map) ? Map<String, dynamic>.from(res.data) : <String, dynamic>{};
  await ContentFiles.delete(_examFile(quizId));
  if (reply['duplicate'] == true) return id; // already saved: keep what the phone has
  final m = _widenReview(reply, practice) ?? reply;
  if (m['lean'] == true) {
    // A question wasn't in the practice file: the result is saved, so fetch
    // the full review once when it's opened (no result file written now).
    await ContentFiles.delete(_resultFile(quizId));
  } else {
    await ContentFiles.write(_resultFile(quizId), jsonEncode({'result': m['result'], 'review': m['review']}));
    if (practice == null) await _keepPracticeFromReview(_readerOfWidget(ref), quizId, m);
  }
  final resultMap = m['result'] is Map ? m['result'] as Map : const {};
  final correct = m['correct'] ?? resultMap['correctAnswers'];
  final total = m['total'] ?? resultMap['totalQuestions'];
  final wrong = resultMap['wrongAnswers'] ?? (correct != null && total != null ? _i(total) - _i(correct) : null);
  await applyExamLocally(id, _i(m['percentage']), m['passed'] == true, (m['progressVersion'] as num?)?.toInt(),
      correct: correct == null ? null : _i(correct), wrong: wrong == null ? null : _i(wrong));
  await StudyDays.done(StudyDays.exam, pct: _i(m['percentage']));
  // Weak topics are counted on the phone from the marked answers (10.17);
  // full-course papers are left out.
  bool fullPaper = false;
  try {
    final cat = await ref.read(quizCatalogueProvider.future);
    for (final q in cat.quizzes) {
      if (q[0] == id) {
        fullPaper = q[5] == 1;
        break;
      }
    }
  } catch (_) {}
  await WeakTopics.addExam(m['review'] is Map ? Map<String, dynamic>.from(m['review']) : null, fullPaper: fullPaper);
  ref.invalidate(studentProgressProvider);
  // The result screen shows what this exam paid. The server decides it.
  final gain = XpGain.fromJson(m['xp']);
  if (gain != null && gain.worthShowing) XpGains.exams[id] = gain;
  return id;
}

/// Whether a saved result file matches the student's latest attempt at this
/// quiz (the recent entry on the progress row: % and correct count).
Future<bool> _savedResultIsCurrent(Ref ref, String quizId, Map result) async {
  try {
    final prog = await ref.read(studentProgressProvider.future);
    for (final e in prog.recentResults) {
      if ('${e['k']}' != quizId) continue;
      final samePct = _i(e['pct']) == _i(result['percentage']);
      final sameCorrect = e['c'] == null || _i(e['c']) == _i(result['correctAnswers']);
      return samePct && sameCorrect;
    }
  } catch (_) {}
  return true; // not in the recent list (or offline): keep what the phone has
}

/// One recent entry's result + review: kept on the phone after the exam, else
/// fetched once (`GET /quiz-attempts/recent/:id/review`) and kept.
Future<Map<String, dynamic>> _recentPayload(Ref ref, String quizId) async {
  final saved = await ContentFiles.read(_resultFile(quizId));
  if (saved != null && saved.isNotEmpty) {
    try {
      final m = Map<String, dynamic>.from(jsonDecode(saved) as Map);
      // 2026-11-18: use the saved copy only when it is the LATEST attempt —
      // a retake on another phone left an old copy here (0 % shown for 60 %).
      if (m['result'] is Map && m['review'] is Map && await _savedResultIsCurrent(ref, quizId, m['result'] as Map)) {
        return m;
      }
    } catch (_) {}
  }
  final api = ref.read(apiClientProvider);
  // 10.26 P2: the questions are already on the phone (practice file) → ask
  // only for the answers; else (or a question missing) the full review.
  final practice = await _practiceQuestions(_readerOf(ref), quizId);
  Map<String, dynamic>? m;
  if (practice != null) {
    final res = await api.dio.get('/quiz-attempts/recent/$quizId/review', queryParameters: const {'lean': '1'});
    m = _widenReview((res.data is Map) ? Map<String, dynamic>.from(res.data) : <String, dynamic>{}, practice);
  }
  if (m == null) {
    final res = await api.dio.get('/quiz-attempts/recent/$quizId/review');
    m = (res.data is Map) ? Map<String, dynamic>.from(res.data) : <String, dynamic>{};
    await _keepPracticeFromReview(_readerOf(ref), quizId, m);
  }
  await ContentFiles.write(_resultFile(quizId), jsonEncode({'result': m['result'], 'review': m['review']}));
  return m;
}

/// One recent result (`GET /quiz-attempts/recent/:quizId/review`).
class AttemptResult {
  final int attemptId;
  final int quizId;
  final String quizTitle;
  final String displayTitleMode;
  final int quizNumber;
  final String courseTitle;
  final String topicDisplay;
  final String passStatus; // pass | fail
  final int totalQuestions;
  final int totalMarks;
  final int correctAnswers;
  final int wrongAnswers;
  final int unansweredQuestions;
  final num score;
  final num percentage;
  final num passingMarks;

  String get displayName {
    return quizTitle.trim().isNotEmpty ? quizTitle.trim() : 'Quiz';
  }

  AttemptResult({
    required this.attemptId,
    required this.quizId,
    required this.quizTitle,
    required this.displayTitleMode,
    required this.quizNumber,
    required this.courseTitle,
    required this.topicDisplay,
    required this.passStatus,
    required this.totalQuestions,
    required this.totalMarks,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.unansweredQuestions,
    required this.score,
    required this.percentage,
    required this.passingMarks,
  });

  bool get passed => passStatus.toLowerCase() == 'pass';

  factory AttemptResult.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    num n(dynamic v) => v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
    return AttemptResult(
      attemptId: _i(m['attemptId']),
      quizId: _i(m['quizId']),
      quizTitle: _s(m['quizTitle']),
      displayTitleMode: m['displayTitleMode'] == 'title' ? 'title' : 'number',
      quizNumber: _i(m['quizNumber'] ?? m['quiz_number']),
      courseTitle: _s(m['courseTitle']),
      topicDisplay: _s(m['topicDisplay']),
      passStatus: _s(m['passStatus'].toString().isEmpty ? 'fail' : m['passStatus']),
      totalQuestions: _i(m['totalQuestions']),
      totalMarks: _i(m['totalMarks']),
      correctAnswers: _i(m['correctAnswers']),
      wrongAnswers: _i(m['wrongAnswers']),
      unansweredQuestions: _i(m['unansweredQuestions']),
      score: n(m['score']),
      percentage: n(m['percentage']),
      passingMarks: n(m['passingMarks']),
    );
  }
}

/// [attemptId] is the quiz id (one recent entry per quiz, 10.16).
final attemptResultProvider =
    FutureProvider.autoDispose.family<AttemptResult, String>((ref, attemptId) async {
  ref.watch(userScopeProvider);
  return AttemptResult.fromJson((await _recentPayload(ref, attemptId))['result']);
});

/// One row in the results history (`GET /quiz-attempts/results`).
class ResultListItem {
  final int attemptId;
  final int quizId;
  final String quizTitle;
  final String displayTitleMode;
  final int quizNumber;
  final String courseTitle;
  final String topicDisplay;
  final num score;
  final num percentage;
  final int correctAnswers;
  final int wrongAnswers;
  final String passStatus;
  final String submittedAt;
  final bool reviewed;

  /// Display name matching the quiz list: the quiz's one name (10.25).
  String get displayName {
    return quizTitle.trim().isNotEmpty ? quizTitle.trim() : 'Quiz';
  }

  ResultListItem({
    required this.attemptId,
    required this.quizId,
    required this.quizTitle,
    required this.displayTitleMode,
    required this.quizNumber,
    required this.courseTitle,
    required this.topicDisplay,
    required this.score,
    required this.percentage,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.passStatus,
    required this.submittedAt,
    required this.reviewed,
  });

  bool get passed => passStatus.toLowerCase() == 'pass';

  factory ResultListItem.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    num n(dynamic v) => v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
    return ResultListItem(
      attemptId: _i(m['attemptId']),
      quizId: _i(m['quizId']),
      quizTitle: _s(m['quizTitle']),
      displayTitleMode: m['displayTitleMode'] == 'title' ? 'title' : 'number',
      quizNumber: _i(m['quizNumber'] ?? m['quiz_number']),
      courseTitle: _s(m['courseTitle']),
      topicDisplay: _s(m['topicDisplay']),
      score: n(m['score']),
      percentage: n(m['percentage']),
      correctAnswers: _i(m['correctAnswers']),
      wrongAnswers: _i(m['wrongAnswers']),
      passStatus: _s(m['passStatus'].toString().isEmpty ? 'fail' : m['passStatus']),
      submittedAt: _s(m['submittedAt']),
      reviewed: _b(m['reviewedAt'] != null && m['reviewedAt'] != ''),
    );
  }
}

/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
final resultsListProvider = FutureProvider<List<ResultListItem>>((ref) async {
  ref.watch(userScopeProvider);
  // The 5 recent results from the progress row (10.16), newest first, named
  // from the catalogue — no request.
  final prog = await ref.watch(studentProgressProvider.future);
  final cat = await ref.watch(quizCatalogueProvider.future);
  final byId = {for (final q in cat.quizzes) q[0] as int: q};
  final out = <ResultListItem>[];
  // Order (user, 10.18): failed and not reviewed first, then failed and
  // reviewed, then passed at the bottom; newest first inside each group.
  int group(Map e) => e['passed'] == true ? 2 : (e['reviewed'] == true ? 1 : 0);
  final newestFirst = prog.recentResults.reversed.toList();
  final ordered = [
    for (final g in const [0, 1, 2]) ...newestFirst.where((e) => group(e) == g),
  ];
  for (final e in ordered) {
    final id = _i(e['quizId']);
    final q = byId[id];
    final subject = q == null ? '' : '${cat.subjectById[q[2]]?[2] ?? ''}';
    out.add(ResultListItem.fromJson({
      'attemptId': id,
      'quizId': id,
      'quizTitle': q == null ? 'Quiz' : ('${q[8]}'.isNotEmpty ? '${q[8]}' : '${q[9]}'),
      'displayTitleMode': q != null && q[10] == 1 ? 'number' : 'title',
      'quizNumber': q == null || q[11] == 0 ? null : q[11],
      'courseTitle': q == null ? '' : '${cat.courseById[q[1]]?[1] ?? ''}',
      'topicDisplay': q != null && q[5] == 1 && subject.isEmpty ? _generalLabel : subject,
      'score': e['pct'],
      'percentage': e['pct'],
      // The saved correct / wrong counts (2026-11-17: they were never read,
      // so every result said "0 correct").
      'correctAnswers': e['c'],
      'wrongAnswers': e['w'],
      'passStatus': e['passed'] == true ? 'pass' : 'fail',
      'submittedAt': e['at'] ?? '',
      'reviewedAt': e['reviewed'] == true ? 'yes' : null,
    }));
  }
  return out;
});

/// How a student has done on one Q-bank set, from their exam attempts.
class QuizOutcome {
  final int best; // best score, 0-100
  final bool passed; // passed at least once
  const QuizOutcome(this.best, this.passed);
}

/// Per quiz id. A set is COMPLETED only when it has been passed; an attempt
/// that did not reach the pass mark is shown as "give it another go". Practice
/// leaves no entry here.
final quizOutcomesProvider = Provider<Map<int, QuizOutcome>>((ref) {
  // From the quiz byte map (10.16): best whole % and passed-once per quiz.
  final prog = ref.watch(studentProgressProvider).value;
  final out = <int, QuizOutcome>{};
  if (prog == null) return out;
  for (final e in prog.quizMarks.entries) {
    out[e.key] = QuizOutcome((e.value & 127) - 1, (e.value & 128) != 0);
  }
  return out;
});

/// Mean mark across every exam/quiz attempt, plus what that mean was before
/// the most recent attempt — so the dashboard can show which way it moved.
///
/// Computed entirely on the device from the attempts the Results page already
/// loads. No new endpoint, and nothing here asks the backend for an average.
class ExamAverage {
  /// Mean of every attempt's percentage.
  final double average;

  /// Mean excluding the most recent attempt. Null with fewer than two
  /// attempts, where there is no earlier average to compare against.
  final double? previous;

  final int attempts;

  const ExamAverage({
    required this.average,
    required this.previous,
    required this.attempts,
  });

  static const empty = ExamAverage(average: 0, previous: null, attempts: 0);

  bool get hasData => attempts > 0;

  /// How much the latest attempt moved the average. Null when there is
  /// nothing to compare against.
  double? get delta => previous == null ? null : average - previous!;

  /// The average as shown to the student: FLOORED, never rounded. 19.5 and
  /// 19.9 both read as 19 — a displayed average must never sit higher than the
  /// marks actually earned.
  int get displayAverage => average.floor();

  /// The change between the two FLOORED averages, so it can only ever describe
  /// the numbers on screen. Comparing the raw means instead would allow "19%"
  /// to follow "19%" with a "+1%" beside it. Null with nothing to compare.
  int? get displayDelta =>
      previous == null ? null : average.floor() - previous!.floor();
}

/// Averages [attempts] by percentage, newest attempt first.
///
/// Percentage, not raw score: attempts carry different question counts, so
/// summing raw marks across them would compare unlike things. Percentage is
/// already normalised, which is also what the chip's "%" claims to show.
ExamAverage computeExamAverage(List<ResultListItem> attempts) {
  if (attempts.isEmpty) return ExamAverage.empty;

  // The API's order is not guaranteed, and "the average before the latest
  // attempt" is only meaningful once the latest is known. An unparseable
  // timestamp sorts to the epoch and tie-breaks on attemptId, which grows
  // over time — this keeps the comparator total rather than merely usually
  // right.
  DateTime stamp(ResultListItem r) =>
      DateTime.tryParse(r.submittedAt) ??
      DateTime.fromMillisecondsSinceEpoch(0);

  final sorted = <ResultListItem>[...attempts]..sort((a, b) {
    final byDate = stamp(b).compareTo(stamp(a));
    return byDate != 0 ? byDate : b.attemptId.compareTo(a.attemptId);
  });

  double mean(List<ResultListItem> xs) {
    var total = 0.0;
    for (final x in xs) {
      total += x.percentage.toDouble();
    }
    return total / xs.length;
  }

  final rest = sorted.sublist(1);
  return ExamAverage(
    average: mean(sorted),
    previous: rest.isEmpty ? null : mean(rest),
    attempts: sorted.length,
  );
}

/// AVG MARKS (10.29): the average of the best % of every exam taken, from the
/// quiz marks on the phone (one byte per exam) — no request.
final examAverageProvider = Provider<AsyncValue<ExamAverage>>((ref) {
  return ref.watch(studentProgressProvider).whenData((prog) {
    var n = 0, sum = 0;
    prog.quizMarks.forEach((id, b) {
      if (b == 0) return;
      n++;
      sum += (b & 127) - 1;
    });
    return n == 0 ? ExamAverage.empty : ExamAverage(average: sum / n, previous: null, attempts: n);
  });
});

/// A reviewed question — the practice question plus the student's answer.
class ReviewQuestion {
  final PracticeQuestion question;
  final Set<int> selectedOptionIds; // SBA picks (and T/F statements marked True)
  final Map<int, bool> tfMarks; // T/F: optionId -> markedTrue (all answered)
  final String status; // correct | wrong | unanswered

  ReviewQuestion({
    required this.question,
    required this.selectedOptionIds,
    required this.tfMarks,
    required this.status,
  });

  bool get isTrueFalse => question.type == 'true_false';

  factory ReviewQuestion.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final selected = <int>{};
    final tfMarks = <int, bool>{};
    final st = m['answerState'];
    if (st is Map) {
      for (final v in (st['selectedIds'] is List ? st['selectedIds'] as List : const [])) {
        selected.add(_i(v));
      }
      if (st['tfMap'] is Map) {
        (st['tfMap'] as Map).forEach((k, v) {
          final isTrue = _i(v) == 1;
          tfMarks[_i(k)] = isTrue;
          if (isTrue) selected.add(_i(k));
        });
      }
    }
    return ReviewQuestion(
      question: PracticeQuestion.fromJson(m),
      selectedOptionIds: selected,
      tfMarks: tfMarks,
      status: _s(m['answerStatus'].toString().isEmpty ? 'unanswered' : m['answerStatus']),
    );
  }
}

class AttemptReview {
  final String quizTitle;
  final num score;
  final num percentage;
  final String passStatus;
  final List<ReviewQuestion> questions;

  AttemptReview({
    required this.quizTitle,
    required this.score,
    required this.percentage,
    required this.passStatus,
    required this.questions,
  });

  factory AttemptReview.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final a = (m['attempt'] is Map)
        ? Map<String, dynamic>.from(m['attempt'])
        : <String, dynamic>{};
    num n(dynamic v) => v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
    final qs = (m['questions'] is List)
        ? (m['questions'] as List).map(ReviewQuestion.fromJson).toList()
        : <ReviewQuestion>[];
    return AttemptReview(
      quizTitle: _s(a['quizTitle']),
      score: n(a['score']),
      percentage: n(a['percentage']),
      passStatus: _s(a['passStatus'].toString().isEmpty ? 'fail' : a['passStatus']),
      questions: qs,
    );
  }
}

final attemptReviewProvider =
    FutureProvider.autoDispose.family<AttemptReview, String>((ref, attemptId) async {
  ref.watch(userScopeProvider);
  // Kept on the phone from the exam's reply (10.16), else fetched once.
  return AttemptReview.fromJson((await _recentPayload(ref, attemptId))['review']);
});
