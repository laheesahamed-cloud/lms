import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:xyndrome/features/courses/courses_repository.dart';
import 'package:xyndrome/features/flashcards/flashcards_repository.dart';
import 'package:xyndrome/features/lessons/lesson_models.dart';
import 'package:xyndrome/features/lessons/lessons_repository.dart';
import 'package:xyndrome/features/planner/plan_generator.dart';
import 'package:xyndrome/features/planner/planner_repository.dart';
import 'package:xyndrome/features/quizzes/quizzes_repository.dart';

Map<String, dynamic> lesson(int id, String subject) => {
      'id': id,
      'lessonId': id,
      'lessonTitle': 'Lesson $id',
      'courseId': '3',
      'courseTitle': 'Medicine',
      'topicName': subject,
    };

Map<String, dynamic> quiz(int id, {String lessonId = '', String subject = 'A', bool general = false}) => {
      'id': id,
      'courseId': '3',
      'courseTitle': 'Medicine',
      'quizTitle': 'Quiz $id',
      'displayTitleMode': 'title',
      'subjectName': subject,
      'lessonId': lessonId,
      'isGeneral': general,
    };

Map<String, dynamic> deck(int noteId) => {
      'key': 'd$noteId',
      'label': 'Cards $noteId',
      'type': 'lesson',
      'depth': 2,
      'noteIds': [noteId],
      'cardCount': 5,
      'newCount': 5,
    };

PlannerTask rule(int id, String kind, {String order = 'lesson', String course = '3'}) => PlannerTask.fromJson({
      'id': id,
      'title': 'r',
      'dueDate': '2030-01-01',
      'rule': {'kind': kind, 'courseId': course, 'hours': 2, 'byDay': true, 'order': order},
    });

ProviderContainer makeContainer() => ProviderContainer(overrides: [
      lessonsListProvider.overrideWith((ref) async => [
            LessonListItem.fromJson(lesson(11, 'A')),
            LessonListItem.fromJson(lesson(12, 'A')),
            LessonListItem.fromJson(lesson(13, 'B')),
          ]),
      quizListProvider.overrideWith((ref) async => [
            QuizListItem.fromJson(quiz(199, general: true)),
            QuizListItem.fromJson(quiz(103)), // subject A's own set
            QuizListItem.fromJson(quiz(102, lessonId: '12')),
            QuizListItem.fromJson(quiz(101, lessonId: '11')),
          ]),
      resultsListProvider.overrideWith((ref) async => [
            ResultListItem.fromJson({'attemptId': 1, 'quizId': 101, 'passStatus': 'pass'}),
            ResultListItem.fromJson({'attemptId': 2, 'quizId': 102, 'passStatus': 'fail'}),
          ]),
      flashDecksProvider.overrideWith((ref) async => DecksResult.fromJson({
            'decks': [
              {
                'key': 'c', 'label': 'Medicine', 'type': 'course', 'depth': 0,
                'children': [deck(12), deck(11)],
              }
            ]
          })),
      studentCoursesProvider.overrideWith((ref) async => [
            CourseCard.fromJson({'id': '3', 'title': 'Medicine'}),
          ]),
]);

void main() {
  test('lesson, then its Q-bank, then its flashcards; full papers last', () async {
    final container = makeContainer();
    addTearDown(container.dispose);

    final tasks = await expandPlanRules(container.read, [
      rule(7, 'flashcards'),
      rule(5, 'lesson'),
      rule(6, 'quiz'),
    ]);
    tasks.sort((a, b) => a.id.compareTo(b.id));
    final order = [for (final t in tasks) '${t.itemType}:${t.itemId}'];
    expect(order, [
      'lesson:11', 'quiz:101', 'flashcards:11',
      'lesson:12', 'quiz:102', 'flashcards:12',
      'quiz:103',
      'lesson:13',
      'quiz:199',
    ]);
    // 101 was passed, 102 was only failed.
    expect(tasks.firstWhere((t) => t.itemId == 101 && t.itemType == 'quiz').done, true);
    expect(tasks.firstWhere((t) => t.itemId == 102 && t.itemType == 'quiz').done, false);
  });

  test('subject by subject: all lessons, then the subject Q-bank, then cards', () async {
    final container = makeContainer();
    addTearDown(container.dispose);
    final tasks = await expandPlanRules(container.read, [
      rule(5, 'lesson', order: 'subject'),
      rule(6, 'quiz', order: 'subject'),
      rule(7, 'flashcards', order: 'subject'),
    ]);
    tasks.sort((a, b) => a.id.compareTo(b.id));
    final order = [for (final t in tasks) '${t.itemType}:${t.itemId}'];
    expect(order, [
      'lesson:11', 'lesson:12', // subject A's lessons
      'quiz:101', 'quiz:102', 'quiz:103', // then its Q-bank
      'flashcards:11', 'flashcards:12', // then its cards
      'lesson:13', // subject B
      'quiz:199', // full papers last
    ]);
  });

  test('two courses are woven together, each keeping its own order', () async {
    Map<String, dynamic> les(int id, String course) => {
          'id': id, 'lessonId': id, 'lessonTitle': 'L$id', 'courseId': course,
          'courseTitle': 'C$course', 'topicName': 'S',
        };
    final container = ProviderContainer(overrides: [
      lessonsListProvider.overrideWith((ref) async => [
            for (final id in [11, 12, 13, 14]) LessonListItem.fromJson(les(id, '3')),
            for (final id in [21, 22, 23, 24]) LessonListItem.fromJson(les(id, '4')),
          ]),
      quizListProvider.overrideWith((ref) async => <QuizListItem>[]),
      resultsListProvider.overrideWith((ref) async => <ResultListItem>[]),
      flashDecksProvider.overrideWith((ref) async => DecksResult.fromJson({'decks': []})),
      studentCoursesProvider.overrideWith((ref) async => <CourseCard>[]),
    ]);
    addTearDown(container.dispose);
    final tasks = await expandPlanRules(container.read, [
      rule(5, 'lesson', course: '3'),
      rule(6, 'lesson', course: '4'),
    ]);
    tasks.sort((a, b) => a.id.compareTo(b.id));
    final ids = [for (final t in tasks) t.itemId];
    // Alternates between the courses; each course still runs 11,12,13,14 / 21,22,23,24.
    expect(ids, [11, 21, 12, 22, 13, 23, 14, 24]);
  });
}
