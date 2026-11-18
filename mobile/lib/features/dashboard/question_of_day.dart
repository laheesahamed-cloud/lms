import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';
import '../../state/content_files.dart';
import '../../state/current_user.dart';
import '../../state/local_scope.dart';
import '../../state/study_days.dart';
import '../quizzes/quizzes_repository.dart';
import 'dashboard_repository.dart';

/// The Question of the Day as the card shows it (OPTIMIZE 10.31).
class QodState {
  final QuestionOfDay question;

  /// Index of the right option once the student found it; null until then.
  final int? picked;

  /// Wrong options already tried (kept until the right one is found).
  final Set<int> wrong;
  const QodState(this.question, this.picked, [this.wrong = const {}]);
  bool get answered => picked != null;
}

/// Question of the Day kept on the phone (OPTIMIZE 10.31).
///
/// One small file per account (`qod_<uid>.json`):
///   {q: question + 5 options, picked: right option once found, wrong: [tried],
///    day: answered-on day, recent: [ids]}
///
/// A wrong tap marks only that option ("try again"); the right one is never
/// shown until the student finds it. The question counts as answered then.
///
/// - Unanswered → the same question, however many days pass. No request.
/// - Answered today → stays answered until tomorrow.
/// - Answered on an earlier day → a new one, picked from the Q-Bank practice
///   sets saved on the phone (no request); only when none is saved, one
///   request: GET /student/dashboard/question (1 statement, 5 rows).
class QuestionOfDayStore {
  QuestionOfDayStore._();

  static const _keepRecent = 200;
  static String get _file => 'qod_${LocalScope.uid}.json';

  static Future<Map<String, dynamic>?> _read() async {
    final raw = await ContentFiles.read(_file);
    if (raw == null) return null;
    try {
      final m = jsonDecode(raw);
      return m is Map ? Map<String, dynamic>.from(m) : null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> _write(Map<String, dynamic> m) => ContentFiles.write(_file, jsonEncode(m));

  static List<int> _recent(Map<String, dynamic>? m) => [
        for (final v in (m?['recent'] is List ? m!['recent'] as List : const []))
          if (v is num) v.toInt(),
      ];

  /// Today's card: the saved question, or a new one when the last was
  /// answered on an earlier day.
  static Future<QodState?> current(Ref ref, ApiClient api) async {
    final saved = await _read();
    final savedQ = QuestionOfDay.fromJson(saved?['q']);
    final picked = (saved?['picked'] as num?)?.toInt();
    final wrong = <int>{
      for (final v in (saved?['wrong'] is List ? saved!['wrong'] as List : const []))
        if (v is num) v.toInt(),
    };
    if (savedQ != null && (picked == null || saved?['day'] == StudyDays.today())) {
      return QodState(savedQ, picked, wrong);
    }

    final recent = _recent(saved);
    Map<String, dynamic>? next = await pickSavedPracticeQuestion(ref, recent.toSet());
    if (next == null) {
      // Nothing saved on the phone: ask the server once.
      try {
        final res = await api.dio.get('/student/dashboard/question');
        if (res.data is Map) next = Map<String, dynamic>.from(res.data as Map);
      } catch (_) {
        // Offline: keep showing the answered one until a new one can be had.
        return savedQ == null ? null : QodState(savedQ, picked);
      }
    }
    final q = QuestionOfDay.fromJson(next);
    if (q == null) return savedQ == null ? null : QodState(savedQ, picked);
    final keep = [...recent.where((id) => id != q.id), q.id];
    await _write({
      'q': next,
      'picked': null,
      'wrong': <int>[],
      'day': null,
      'recent': keep.length > _keepRecent ? keep.sublist(keep.length - _keepRecent) : keep,
    });
    return QodState(q, null);
  }

  /// A wrong option tried: kept on the phone, nothing is sent.
  static Future<void> wrong(int index) async {
    final saved = await _read();
    if (saved == null || saved['picked'] != null) return;
    final list = [...(saved['wrong'] is List ? saved['wrong'] as List : const [])];
    if (!list.contains(index)) list.add(index);
    saved['wrong'] = list;
    await _write(saved);
  }

  /// The student found the right option [index]: kept on the phone, nothing is sent.
  static Future<void> answer(int index) async {
    final saved = await _read();
    if (saved == null || saved['picked'] != null) return;
    saved['picked'] = index;
    saved['day'] = StudyDays.today();
    await _write(saved);
  }
}

/// The Study Hub's Question of the Day card (OPTIMIZE 10.31).
final questionOfDayProvider = FutureProvider<QodState?>((ref) async {
  ref.watch(userScopeProvider);
  return QuestionOfDayStore.current(ref, ref.read(apiClientProvider));
});
