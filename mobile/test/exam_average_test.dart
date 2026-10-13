import 'package:flutter_test/flutter_test.dart';
import 'package:xyndrome/features/quizzes/quizzes_repository.dart';

ResultListItem attempt({
  required int id,
  required num percentage,
  String submittedAt = '',
}) =>
    ResultListItem(
      attemptId: id,
      quizId: 1,
      quizTitle: 'Quiz',
      displayTitleMode: 'number',
      quizNumber: id,
      courseTitle: 'Course',
      topicDisplay: '',
      score: percentage,
      percentage: percentage,
      correctAnswers: 0,
      wrongAnswers: 0,
      passStatus: 'pass',
      submittedAt: submittedAt,
      reviewed: false,
    );

void main() {
  test('no attempts — nothing to average', () {
    final r = computeExamAverage(const []);
    expect(r.hasData, isFalse);
    expect(r.attempts, 0);
    expect(r.delta, isNull);
  });

  test('one attempt — average is that mark, no comparison yet', () {
    final r = computeExamAverage([attempt(id: 1, percentage: 50)]);
    expect(r.average, 50);
    expect(r.attempts, 1);
    expect(r.previous, isNull);
    expect(r.delta, isNull);
  });

  test('50 and 60 average to 55', () {
    final r = computeExamAverage([
      attempt(id: 1, percentage: 50, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 60, submittedAt: '2026-10-02T10:00:00Z'),
    ]);
    expect(r.average, 55);
    // Before the newest attempt the average was just the 50.
    expect(r.previous, 50);
    expect(r.delta, 5); // 60 pulled the average up
  });

  test('a bad latest attempt pulls the average down', () {
    final r = computeExamAverage([
      attempt(id: 1, percentage: 80, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 90, submittedAt: '2026-10-02T10:00:00Z'),
      attempt(id: 3, percentage: 10, submittedAt: '2026-10-03T10:00:00Z'),
    ]);
    expect(r.average, closeTo(60, 0.001));
    expect(r.previous, closeTo(85, 0.001));
    expect(r.delta! < 0, isTrue);
  });

  test('newest is found by date, not by list order', () {
    // Deliberately out of order: the 10% attempt is newest but listed first.
    final r = computeExamAverage([
      attempt(id: 3, percentage: 10, submittedAt: '2026-10-03T10:00:00Z'),
      attempt(id: 1, percentage: 80, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 90, submittedAt: '2026-10-02T10:00:00Z'),
    ]);
    expect(r.previous, closeTo(85, 0.001));
  });

  test('unparseable timestamps fall back to attemptId order', () {
    final r = computeExamAverage([
      attempt(id: 1, percentage: 40, submittedAt: 'not a date'),
      attempt(id: 2, percentage: 80, submittedAt: ''),
    ]);
    expect(r.average, 60);
    expect(r.previous, 40); // id 2 treated as the newest
  });

  test('23 and 16 average to 19.5 and display as 19 — floored, not rounded', () {
    final r = computeExamAverage([
      attempt(id: 1, percentage: 23, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 16, submittedAt: '2026-10-02T10:00:00Z'),
    ]);
    expect(r.average, 19.5);
    expect(r.displayAverage, 19); // NOT 20
  });

  test('19.9 still displays as 19', () {
    // 20 + 20 + 19.7 = 59.7 / 3 = 19.9
    final r = computeExamAverage([
      attempt(id: 1, percentage: 20, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 20, submittedAt: '2026-10-02T10:00:00Z'),
      attempt(id: 3, percentage: 19.7, submittedAt: '2026-10-03T10:00:00Z'),
    ]);
    expect(r.average, closeTo(19.9, 0.0001));
    expect(r.displayAverage, 19);
  });

  test('delta is between the floored averages, so it matches the screen', () {
    // raw: now 19.9, before 20.0 -> floored: 19 vs 20 -> -1
    final r = computeExamAverage([
      attempt(id: 1, percentage: 20, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 20, submittedAt: '2026-10-02T10:00:00Z'),
      attempt(id: 3, percentage: 19.7, submittedAt: '2026-10-03T10:00:00Z'),
    ]);
    expect(r.displayAverage, 19);
    expect(r.previous!.floor(), 20);
    expect(r.displayDelta, -1);
  });

  test('a raw move that both floors away reports no change', () {
    // raw: now 19.75, before 19.5 -> both floor to 19 -> 0, not "+1%"
    final r = computeExamAverage([
      attempt(id: 1, percentage: 19.5, submittedAt: '2026-10-01T10:00:00Z'),
      attempt(id: 2, percentage: 20, submittedAt: '2026-10-02T10:00:00Z'),
    ]);
    expect(r.average, 19.75);
    expect(r.previous, 19.5);
    expect(r.displayAverage, 19);
    expect(r.displayDelta, 0);
  });

  test('displayDelta is null with a single attempt', () {
    final r = computeExamAverage([attempt(id: 1, percentage: 50)]);
    expect(r.displayDelta, isNull);
  });

  test('average is over attempts, not over 100', () {
    final r = computeExamAverage([
      for (var i = 1; i <= 4; i++) attempt(id: i, percentage: 25),
    ]);
    expect(r.average, 25);
    expect(r.attempts, 4);
  });
}
