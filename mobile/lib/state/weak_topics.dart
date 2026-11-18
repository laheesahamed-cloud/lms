import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'catalogue.dart';
import 'local_scope.dart';

/// Weak topics on the phone (OPTIMIZE 10.16 decision 8 / 10.17): right and
/// wrong answers per subject, counted from each finished exam's marked answers
/// (the review the exam reply carries). Full-course papers are not counted —
/// they mix every subject. Phone only: a reinstall starts again from zero.
///
/// The "byte per subject" is the subject's score % (right ÷ answered), worked
/// out from the counts; a subject shows once it has [minAnswered] answers.
class WeakTopics {
  WeakTopics._();
  static const int minAnswered = 10;

  static String get _key => 'xyndrome.weak.${LocalScope.uid}';

  /// {subjectId: [right, wrong]}.
  static Future<Map<int, List<int>>> counts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return {};
      final m = jsonDecode(raw) as Map;
      return {
        for (final e in m.entries)
          int.parse('${e.key}'): [((e.value as List)[0] as num).toInt(), ((e.value as List)[1] as num).toInt()],
      };
    } catch (_) {
      return {};
    }
  }

  /// Add one exam's marked answers (review questions with `subjectId` and
  /// `answerStatus`). Unanswered questions count as neither.
  static Future<void> addExam(Map<String, dynamic>? review, {required bool fullPaper}) async {
    if (review == null || fullPaper) return;
    final qs = review['questions'];
    if (qs is! List) return;
    final c = await counts();
    for (final q in qs) {
      if (q is! Map) continue;
      final subject = (q['subjectId'] as num?)?.toInt() ?? 0;
      if (subject <= 0) continue;
      final status = '${q['answerStatus'] ?? ''}';
      if (status != 'correct' && status != 'wrong') continue;
      final e = c.putIfAbsent(subject, () => [0, 0]);
      if (status == 'correct') {
        e[0]++;
      } else {
        e[1]++;
      }
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, jsonEncode({for (final e in c.entries) '${e.key}': e.value}));
    } catch (_) {}
  }

  /// Subjects with enough answers, as {name, course, score %, answered},
  /// weakest first.
  static Future<List<({String subject, String course, int pct, int answered})>> ranked(Catalogue cat) async {
    final out = <({String subject, String course, int pct, int answered})>[];
    for (final e in (await counts()).entries) {
      final answered = e.value[0] + e.value[1];
      if (answered < minAnswered) continue;
      final row = cat.subjectById[e.key];
      if (row == null) continue;
      out.add((
        subject: '${row[2]}',
        course: '${cat.courseById[row[1]]?[1] ?? ''}',
        pct: (e.value[0] * 100 / answered).round(),
        answered: answered,
      ));
    }
    out.sort((a, b) => a.pct.compareTo(b.pct) != 0 ? a.pct.compareTo(b.pct) : b.answered.compareTo(a.answered));
    return out;
  }
}
