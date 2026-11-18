import 'dart:convert';

import 'content_files.dart';
import 'local_scope.dart';
import 'practice_queue.dart';

/// One day the student studied (OPTIMIZE 10.29), kept on the phone.
class StudyDay {
  final String day; // YYYY-MM-DD, the phone's local date
  final int bits; // lesson 1 · exam 2 · practice 4 · flashcards 8
  final int marksSum; // sum of exam + practice percentages that day
  final int marksCount;
  const StudyDay(this.day, this.bits, this.marksSum, this.marksCount);

  /// That day's average marks, or null when no exam / practice was marked.
  int? get average => marksCount == 0 ? null : (marksSum / marksCount).round();

  Map<String, dynamic> toJson() => {'d': day, 'b': bits, 's': marksSum, 'n': marksCount};
  static StudyDay? fromJson(dynamic m) {
    if (m is! Map) return null;
    final d = '${m['d'] ?? ''}';
    if (d.length != 10) return null;
    int i(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
    return StudyDay(d, i(m['b']) & 15, i(m['s']), i(m['n']));
  }
}

/// Today's 4 goals and the Readiness bars, on the phone only (OPTIMIZE 10.29).
///
/// Each day the student does something gets one small entry: the goals done
/// (4 bits) and that day's exam + practice marks. Lesson done, exam finish,
/// practice and a flashcard review update today's entry here — no request.
/// The server saves the same goals inside the writes it already gets (lesson,
/// exam, and the ride-along for practice and flashcards).
///
/// Days with nothing done get no entry, so a break simply isn't shown. The
/// last [keep] study days are kept (about 1 KB per account). The first time,
/// the entries are filled from the 5 recent exams the phone holds.
class StudyDays {
  StudyDays._();

  static const lesson = 1, exam = 2, practice = 4, flashcards = 8, all = 15;
  static const keep = 14;

  static String get _file => 'study_days_${LocalScope.uid}.json';

  static Future<void> _chain = Future.value();
  static Future<T> _serial<T>(Future<T> Function() job) {
    final run = _chain.then((_) => job());
    _chain = run.then((_) {}, onError: (_) {});
    return run;
  }

  static String dayOf(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  static String today() => dayOf(DateTime.now());

  static Future<List<StudyDay>?> _readRaw() async {
    final raw = await ContentFiles.read(_file);
    if (raw == null) return null;
    try {
      final m = jsonDecode(raw);
      final list = m is Map ? m['days'] : null;
      if (list is! List) return <StudyDay>[];
      return list.map(StudyDay.fromJson).whereType<StudyDay>().toList();
    } catch (_) {
      return <StudyDay>[];
    }
  }

  static Future<void> _write(List<StudyDay> days) {
    days.sort((a, b) => a.day.compareTo(b.day));
    final kept = days.length > keep ? days.sublist(days.length - keep) : days;
    return ContentFiles.write(_file, jsonEncode({'days': [for (final d in kept) d.toJson()]}));
  }

  /// The study days, oldest first. The first read on this phone fills them
  /// from [recent] (the progress reply's 5 recent exams: `pct`, `at`).
  static Future<List<StudyDay>> read({List<Map<String, dynamic>> recent = const []}) => _serial(() async {
        final saved = await _readRaw();
        if (saved != null) return saved;
        final byDay = <String, StudyDay>{};
        for (final e in recent) {
          final at = DateTime.tryParse('${e['at'] ?? ''}')?.toLocal();
          if (at == null) continue;
          final d = dayOf(at);
          final pct = e['pct'] is num ? (e['pct'] as num).toInt() : int.tryParse('${e['pct']}') ?? 0;
          final old = byDay[d];
          byDay[d] = StudyDay(d, (old?.bits ?? 0) | exam, (old?.marksSum ?? 0) + pct, (old?.marksCount ?? 0) + 1);
        }
        final days = byDay.values.toList();
        await _write(days);
        return days;
      });

  /// A goal done today, with its marks when it was an exam or a practice.
  static Future<void> done(int bit, {int? pct}) => _serial(() async {
        final days = await _readRaw() ?? <StudyDay>[];
        final d = today();
        final i = days.indexWhere((x) => x.day == d);
        final old = i >= 0 ? days[i] : StudyDay(d, 0, 0, 0);
        final next = StudyDay(
          d,
          old.bits | bit,
          old.marksSum + (pct ?? 0).clamp(0, 100),
          old.marksCount + (pct == null ? 0 : 1),
        );
        if (i >= 0) {
          days[i] = next;
        } else {
          days.add(next);
        }
        await _write(days);
        // 10.30: the day is done the first time all 4 goals are in — its mark
        // rides along with the next request (the server moves the streak).
        if (next.bits == all && old.bits != all) await PracticeQueue.addDayDone(d);
      });

  /// Today's goals on this phone (0 when nothing yet).
  static int bitsToday(List<StudyDay> days) {
    final d = today();
    for (final x in days) {
      if (x.day == d) return x.bits;
    }
    return 0;
  }
}
