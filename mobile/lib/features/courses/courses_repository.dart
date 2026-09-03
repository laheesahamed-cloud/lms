import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
double _d(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);

/// A course in the student library — `GET /courses/student`.
class CourseCard {
  final String id;
  final String title;
  final String code;
  final String description;
  final String examType;
  final double progressPercent;
  final int totalLessons;
  final int subjectCount;

  CourseCard({
    required this.id,
    required this.title,
    required this.code,
    required this.description,
    required this.examType,
    required this.progressPercent,
    required this.totalLessons,
    required this.subjectCount,
  });

  factory CourseCard.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return CourseCard(
      id: _s(m['id']),
      title: _s(m['courseTitle'] ?? m['course_title'] ?? m['title'] ?? 'Course'),
      code: _s(m['courseCode'] ?? m['course_code']),
      description: _s(m['description']),
      examType: _s(m['examType'] ?? m['exam_type'] ?? ''),
      progressPercent: _d(m['progressPercent']),
      totalLessons: _i(m['totalLessonsCount'] ?? m['totalLessons']),
      subjectCount: _i(m['subjectCount']),
    );
  }
}

/// One lesson inside a subject category.
class LessonItem {
  final String id;
  final String title;
  final String type;
  final bool locked;
  final String status; // not_started | in_progress | completed
  final double progressPercent;

  LessonItem({
    required this.id,
    required this.title,
    required this.type,
    required this.locked,
    required this.status,
    required this.progressPercent,
  });

  bool get done => status == 'completed';

  factory LessonItem.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return LessonItem(
      id: _s(m['id'] ?? m['lessonId']),
      title: _s(m['lessonTitle'] ?? m['lesson_title'] ?? m['title'] ?? 'Lesson'),
      type: _s(m['lessonType'] ?? 'Reading lesson'),
      locked: m['accessLocked'] == true || m['canAccess'] == false,
      status: _s(m['status'].toString().isEmpty ? 'not_started' : m['status']),
      progressPercent: _d(m['progressPercent']),
    );
  }
}

/// A subject-wise category — collapsible, holds the lessons of all its topics.
class SubjectGroup {
  final String id;
  final String name;
  final double progressPercent;
  final int completedLessons;
  final int totalLessons;
  final List<LessonItem> lessons;

  SubjectGroup({
    required this.id,
    required this.name,
    required this.progressPercent,
    required this.completedLessons,
    required this.totalLessons,
    required this.lessons,
  });

  factory SubjectGroup.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    // Flatten every topic's lessons into one list under the subject.
    final topics = (m['topics'] is List) ? m['topics'] as List : const [];
    final lessons = <LessonItem>[];
    for (final t in topics) {
      final tm = (t is Map) ? Map<String, dynamic>.from(t) : <String, dynamic>{};
      final ls = (tm['lessons'] is List) ? tm['lessons'] as List : const [];
      lessons.addAll(ls.map(LessonItem.fromJson));
    }
    // Some payloads may carry lessons directly on the subject.
    if (lessons.isEmpty && m['lessons'] is List) {
      lessons.addAll((m['lessons'] as List).map(LessonItem.fromJson));
    }
    return SubjectGroup(
      id: _s(m['id']),
      name: _s(m['subjectName'] ?? m['subject_name'] ?? m['name'] ?? 'Subject'),
      progressPercent: _d(m['progressPercent']),
      completedLessons: _i(m['completedLessonsCount']),
      totalLessons: _i(m['totalLessonsCount'] ?? lessons.length),
      lessons: lessons,
    );
  }
}

/// Course detail with its subject categories — `GET /courses/student/:id`.
class CourseDetail {
  final String title;
  final String description;
  final double progressPercent;
  final int completedLessons;
  final int totalLessons;
  final List<SubjectGroup> subjects;

  CourseDetail({
    required this.title,
    required this.description,
    required this.progressPercent,
    required this.completedLessons,
    required this.totalLessons,
    required this.subjects,
  });

  factory CourseDetail.fromJson(dynamic raw) {
    final root = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final course = (root['course'] is Map)
        ? Map<String, dynamic>.from(root['course'])
        : root;
    final subjectsRaw = (root['subjects'] is List) ? root['subjects'] as List : const [];
    return CourseDetail(
      title: _s(course['courseTitle'] ?? course['course_title'] ?? course['title'] ?? 'Course'),
      description: _s(course['description']),
      progressPercent: _d(course['progressPercent']),
      completedLessons: _i(course['completedLessonsCount']),
      totalLessons: _i(course['totalLessonsCount']),
      subjects: subjectsRaw.map(SubjectGroup.fromJson).toList(),
    );
  }
}

/// Student course library.
/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
final studentCoursesProvider = FutureProvider<List<CourseCard>>((ref) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/courses/student');
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map
          ? (data['courses'] ?? data['items'] ?? data['data'] ?? const [])
          : const []);
  return (rows as List).map(CourseCard.fromJson).toList();
});

/// One course's subject-wise detail.
final courseDetailProvider =
    FutureProvider.autoDispose.family<CourseDetail, String>((ref, courseId) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/courses/student/$courseId');
  return CourseDetail.fromJson(res.data);
});
