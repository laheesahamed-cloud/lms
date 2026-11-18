import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:xyndrome/features/quizzes/quizzes_repository.dart';
import 'package:xyndrome/state/catalogue.dart';
import 'package:xyndrome/state/local_scope.dart';
import 'package:xyndrome/state/saved_first.dart';

// Quizzes on the progress row (OPTIMIZE 10.16): byte per quiz id (top bit
// passed, 7 bits best % + 1), 5 recent results, phone-only minimum time.
void main() {
  test('byte map reads best % and passed; older per-quiz shape kept', () {
    final bytes = List<int>.filled(60, 0);
    bytes[56] = 128 + 85 + 1; // passed, 85 %
    bytes[12] = 40 + 1; // sat, 40 %, not passed
    final p = StudentProgress.fromJson({'quizMarks': base64Encode(bytes)});
    expect(p.quizBest(56), 85);
    expect(p.quizPassed(56), isTrue);
    expect(p.quizBest(12), 40);
    expect(p.quizPassed(12), isFalse);
    expect(p.quizBest(3), isNull);
    expect(p.quizzes[56]?[0], 1);
  });

  test('minimum time: first try ÷10, redo ÷20, passed 1 minute', () {
    final bytes = List<int>.filled(10, 0);
    bytes[2] = 41; // sat, not passed
    bytes[3] = 128 + 91; // passed
    final p = StudentProgress.fromJson({'quizMarks': base64Encode(bytes)});
    expect(minExamTime(p, 1, 60), const Duration(minutes: 6));
    expect(minExamTime(p, 2, 60), const Duration(minutes: 3));
    expect(minExamTime(p, 3, 60), const Duration(minutes: 1));
  });

  test('after an exam: pass stays on, best only rises, 5 recent kept', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = '972';
    await seedSaved('progress', {
      'lessonsBits': '',
      'lessonsVersion': 3,
      'quizMarks': '',
      'recentResults': [
        for (var i = 1; i <= 5; i++) {'k': '$i', 'quizId': i, 'pct': 50, 'passed': true, 'reviewed': true},
      ],
    });
    await applyExamLocally(7, 80, true, 4);
    await applyExamLocally(7, 60, false, 5); // a worse redo
    final saved = await readSaved('progress') as Map;
    final p = StudentProgress.fromJson(saved);
    expect(p.quizBest(7), 80, reason: 'best only rises');
    expect(p.quizPassed(7), isTrue, reason: 'passed once stays passed');
    final keys = [for (final e in p.recentResults) e['k']];
    expect(keys, ['2', '3', '4', '5', '7'], reason: 'oldest dropped, the redo replaced its own entry');
    expect(saved['lessonsVersion'], 5);

    await markReviewedLocally(7, 6);
    final after = StudentProgress.fromJson(await readSaved('progress'));
    expect(after.recentResults.last['reviewed'], isTrue);
  });

  test('free-slot rule (10.18): any passed + reviewed result frees a slot', () {
    Map<String, dynamic> e(int k, bool p, bool r) => {'k': '$k', 'quizId': k, 'passed': p, 'reviewed': r};
    final full = [e(1, false, false), e(2, false, true), e(3, true, false), e(4, true, true), e(5, false, false)];
    expect(examBlockerIn(full, 9), isNull, reason: 'quiz 4 is passed and reviewed');
    final none = [e(1, false, false), e(2, false, true), e(3, true, false), e(4, false, false), e(5, false, false)];
    expect(examBlockerIn(none, 9), 1, reason: 'nothing free: review / pass the oldest first');
    expect(examBlockerIn(none, 3), isNull, reason: 'a redo takes its own slot');
    expect(examBlockerIn(none.sublist(1), 9), isNull, reason: 'fewer than 5 kept');
  });

  test('a new result replaces the oldest FREE result, never a failed one', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = '972';
    await seedSaved('progress', {
      'lessonsBits': '',
      'lessonsVersion': 1,
      'quizMarks': '',
      'recentResults': [
        {'k': '1', 'quizId': 1, 'pct': 20, 'passed': false, 'reviewed': true},
        {'k': '2', 'quizId': 2, 'pct': 90, 'passed': true, 'reviewed': false},
        {'k': '3', 'quizId': 3, 'pct': 80, 'passed': true, 'reviewed': true},
        {'k': '4', 'quizId': 4, 'pct': 85, 'passed': true, 'reviewed': true},
        {'k': '5', 'quizId': 5, 'pct': 10, 'passed': false, 'reviewed': false},
      ],
    });
    await applyExamLocally(9, 70, true, 2);
    final p = StudentProgress.fromJson(await readSaved('progress'));
    expect([for (final e in p.recentResults) e['k']], ['1', '2', '4', '5', '9']);
  });
}
