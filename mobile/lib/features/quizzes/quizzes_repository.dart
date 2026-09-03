import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';

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
  /// (Q-Bank list, the dashboard "Continue" card, …) — mirrors the web
  /// frontend label: "Quiz N" in number mode, otherwise the real title.
  String get displayName {
    if (displayTitleMode == 'number' && quizNumber > 0) return 'Quiz $quizNumber';
    return title.trim().isNotEmpty ? title.trim() : 'Quiz';
  }

  /// The row label, mirroring the web `getQuizRowLabel`: [displayName] with a
  /// positional fallback ("Practice set N") when a set has no title.
  String rowLabel(int index) {
    if (displayTitleMode == 'number' && quizNumber > 0) return 'Quiz $quizNumber';
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
  final List<QOption> options;
  final Set<int> correctOptionIds;
  final TheoryRecap? recap;

  PracticeQuestion({
    required this.id,
    required this.type,
    required this.text,
    required this.explanation,
    required this.explanationImageUrl,
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
  final List<PracticeQuestion> questions;
  PracticeQuiz(
      {required this.title,
      required this.totalQuestions,
      required this.timeLimit,
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
final quizListProvider = FutureProvider<List<QuizListItem>>((ref) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/quiz-attempts/quizzes');
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map ? (data['quizzes'] ?? data['items'] ?? data['data'] ?? const []) : const []);
  return (rows as List).map(QuizListItem.fromJson).toList();
});

/// Load a quiz in practice mode (answers + explanations inline for the reveal).
final practiceQuizProvider =
    FutureProvider.autoDispose.family<PracticeQuiz, String>((ref, quizId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get(
    '/quiz-attempts/quiz/$quizId',
    queryParameters: const {'mode': 'practice'},
  );
  return PracticeQuiz.fromJson(res.data);
});

// ---------------------------------------------------------------------------
// EXAM MODE — real exam sessions submitted to the DB (mirrors the web LMS).
// ---------------------------------------------------------------------------

/// One server-side exam session (`GET /quiz-attempts/quiz/:id?mode=exam`).
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

  ExamLoad({
    required this.title,
    required this.totalQuestions,
    required this.timeLimit,
    required this.session,
    required this.questions,
  });

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

/// Load a quiz in exam mode — creates/returns the server exam session.
final examQuizProvider =
    FutureProvider.autoDispose.family<ExamLoad, String>((ref, quizId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get(
    '/quiz-attempts/quiz/$quizId',
    queryParameters: const {'mode': 'exam'},
  );
  return ExamLoad.fromJson(res.data);
});

/// Submit an exam attempt. `answers` is `{questionId: optionId | {optId:0|1}}`.
/// Returns the created attempt id.
Future<int> submitExam(
  WidgetRef ref,
  String quizId,
  Map<String, dynamic> answers,
) async {
  final api = ref.read(apiClientProvider);
  final res = await api.dio.post(
    '/quiz-attempts/exam/$quizId/submit',
    data: {'answers': answers},
  );
  final m = (res.data is Map) ? Map<String, dynamic>.from(res.data) : {};
  return _i(m['attemptId']);
}

/// Record that the student finished a practice quiz. This writes an isolated
/// study-activity event (NOT a quiz attempt), so it counts toward the daily
/// streak without touching avg score / results / weak topics. Fire-and-forget.
Future<void> recordPracticeCompletion(WidgetRef ref, int quizId) async {
  final api = ref.read(apiClientProvider);
  await api.dio.post(
    '/student/dashboard/activity',
    data: {'activityType': 'practice_completed', 'itemId': quizId},
  );
}

/// The result of a single attempt (`GET /quiz-attempts/result/:attemptId`).
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
    if (displayTitleMode == 'number' && quizNumber > 0) return 'Quiz $quizNumber';
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

final attemptResultProvider =
    FutureProvider.autoDispose.family<AttemptResult, String>((ref, attemptId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/quiz-attempts/result/$attemptId');
  return AttemptResult.fromJson(res.data);
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

  /// Display name matching the quiz list: "Quiz N" in number mode, else the title.
  String get displayName {
    if (displayTitleMode == 'number' && quizNumber > 0) return 'Quiz $quizNumber';
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
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/quiz-attempts/results');
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map ? (data['results'] ?? data['items'] ?? const []) : const []);
  return (rows as List).map(ResultListItem.fromJson).toList();
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
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/quiz-attempts/review/$attemptId');
  return AttemptReview.fromJson(res.data);
});
