import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:xyndrome/state/local_scope.dart';
import 'package:xyndrome/state/weak_topics.dart';

// Weak topics on the phone (OPTIMIZE 10.17): counted from each exam's marked
// answers; full papers and unanswered questions are not counted.
void main() {
  test('counts right / wrong per subject; full papers skipped', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = '972';
    Map<String, dynamic> review(List<List<Object>> qs) => {
          'questions': [for (final q in qs) {'subjectId': q[0], 'answerStatus': q[1]}],
        };
    await WeakTopics.addExam(review([[5, 'correct'], [5, 'wrong'], [5, 'wrong'], [7, 'correct'], [7, 'unanswered']]), fullPaper: false);
    await WeakTopics.addExam(review([[5, 'wrong'], [9, 'wrong']]), fullPaper: true); // ignored
    final c = await WeakTopics.counts();
    expect(c[5], [1, 2]);
    expect(c[7], [1, 0]);
    expect(c.containsKey(9), isFalse);
  });
}
