import 'dart:async';
import '../../core/perf_log.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import 'package:fsrs/fsrs.dart' as fsrs;
import '../../state/catalogue.dart';
import '../../state/flash_store.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

/// Interval preview for one of the 4 grade buttons (Again/Hard/Good/Easy).
class IntervalPreview {
  final int rating; // 1..4
  final String label; // "<10m", "4d", "3mo"
  IntervalPreview(this.rating, this.label);

  factory IntervalPreview.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return IntervalPreview(_i(m['rating']), _s(m['label']));
  }
}

/// Card content.
class FlashCard {
  final int id;
  final String question;
  final String answer;
  final String imageUrl;
  final String imageFit;
  FlashCard({
    required this.id,
    required this.question,
    required this.answer,
    required this.imageUrl,
    required this.imageFit,
  });

  factory FlashCard.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return FlashCard(
      id: _i(m['id']),
      question: _s(m['question']),
      answer: _s(m['answer']),
      imageUrl: _s(m['imageUrl']),
      imageFit: _s(m['imageFit'].toString().isEmpty ? 'contain' : m['imageFit']),
    );
  }
}

/// One queued card with its FSRS state + 4 grade previews.
class QueueCard {
  final FlashCard card;
  final String state; // new | learning | review | relearning
  final List<IntervalPreview> previews;
  QueueCard({required this.card, required this.state, required this.previews});

  IntervalPreview? previewFor(int rating) {
    for (final p in previews) {
      if (p.rating == rating) return p;
    }
    return null;
  }

  factory QueueCard.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return QueueCard(
      card: FlashCard.fromJson(m['card']),
      state: _s(m['state'].toString().isEmpty ? 'new' : m['state']),
      previews: (m['previews'] is List)
          ? (m['previews'] as List).map(IntervalPreview.fromJson).toList()
          : <IntervalPreview>[],
    );
  }
}

/// Cards in one study session. The rest wait for the next tap on Study.
const int kFlashSessionSize = 20;

class QueueResult {
  final List<QueueCard> cards;
  final int newCount;
  final int learning;
  final int due;
  QueueResult(
      {required this.cards,
      required this.newCount,
      required this.learning,
      required this.due});

  factory QueueResult.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final counts =
        (m['counts'] is Map) ? Map<String, dynamic>.from(m['counts']) : <String, dynamic>{};
    return QueueResult(
      cards: (m['cards'] is List)
          ? (m['cards'] as List).take(kFlashSessionSize).map(QueueCard.fromJson).toList()
          : <QueueCard>[],
      newCount: _i(counts['new']),
      learning: _i(counts['learning']),
      due: _i(counts['due']),
    );
  }
}

/// A deck node (course → subject → topic → lesson) with live counts.
class DeckNode {
  final String key;
  final String label;
  final String type; // course | subject | topic | lesson
  final int depth;
  final List<int> noteIds;
  final int newCount;
  final int learningCount;
  final int dueCount;
  final int cardCount;
  final bool locked;
  final List<DeckNode> children;

  DeckNode({
    required this.key,
    required this.label,
    required this.type,
    required this.depth,
    required this.noteIds,
    required this.newCount,
    required this.learningCount,
    required this.dueCount,
    required this.cardCount,
    required this.locked,
    required this.children,
  });

  factory DeckNode.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return DeckNode(
      key: _s(m['key']),
      label: _s(m['label']),
      type: _s(m['type']),
      depth: _i(m['depth']),
      noteIds: (m['noteIds'] is List)
          ? (m['noteIds'] as List).map(_i).toList()
          : <int>[],
      newCount: _i(m['newCount']),
      learningCount: _i(m['learningCount']),
      dueCount: _i(m['dueCount']),
      cardCount: _i(m['cardCount']),
      locked: _b(m['locked']),
      children: (m['children'] is List)
          ? (m['children'] as List).map(DeckNode.fromJson).toList()
          : <DeckNode>[],
    );
  }
}

class DecksResult {
  final List<DeckNode> decks;
  final int totalNew;
  final int totalLearning;
  final int totalDue;
  DecksResult(
      {required this.decks,
      required this.totalNew,
      required this.totalLearning,
      required this.totalDue});

  factory DecksResult.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final totals =
        (m['totals'] is Map) ? Map<String, dynamic>.from(m['totals']) : <String, dynamic>{};
    return DecksResult(
      decks: (m['decks'] is List)
          ? (m['decks'] as List).map(DeckNode.fromJson).toList()
          : <DeckNode>[],
      totalNew: _i(totals['newCount']),
      totalLearning: _i(totals['learningCount']),
      totalDue: _i(totals['dueCount']),
    );
  }
}

/// Deck tree with New / Learning / Due counts — built on the phone (step 5):
/// lessons with flashcards from the shared catalogue, locks from the student's
/// plan, counts from the review progress kept on the phone. No server read
/// (10.36: progress is phone-only; the old history import was removed).
final flashDecksProvider = FutureProvider<DecksResult>((ref) async {
  ref.watch(userScopeProvider);
  final cat = await ref.watch(catalogueProvider.future);
  final prog = await ref.watch(studentProgressProvider.future);
  // 10.36: flashcard progress is phone-only — no history import request.
  final reviews = await FlashStore.reviews();
  final decks = buildDecks(cat, prog, reviews, DateTime.now());
  PerfLog.mark('flashcard decks built');
  return decks;
});

DateTime _endOfDay(DateTime now) => DateTime(now.year, now.month, now.day, 23, 59, 59, 999);

DecksResult buildDecks(Catalogue cat, StudentProgress prog, Map<int, List<dynamic>> reviews, DateTime now) {
  // Review counts per lesson, as the server counted them.
  final byLesson = <int, List<int>>{}; // lessonId → [reviewed, learning, due]
  final eod = _endOfDay(now);
  reviews.forEach((cardId, r) {
    final lessonId = r.length > 8 ? (r[8] as num).toInt() : 0;
    final e = byLesson.putIfAbsent(lessonId, () => [0, 0, 0]);
    e[0]++;
    if (r[6] == 1 || r[7] == 1) return; // suspended / buried
    final state = (r[0] as num).toInt();
    final due = DateTime.tryParse('${r[4]}')?.toLocal();
    if (due == null) return;
    if ((state == 1 || state == 3) && !due.isAfter(now)) {
      e[1]++;
    } else if (state == 2 && !due.isAfter(eod)) {
      e[2]++;
    }
  });

  final roots = <_Node>[];
  final index = <String, _Node>{};
  _Node node(List<_Node> siblings, String key, String label, String type, int depth) {
    return index.putIfAbsent(key, () {
      final n = _Node(key, label, type, depth);
      siblings.add(n);
      return n;
    });
  }

  for (final l in cat.lessons) {
    final cards = l.length > 9 ? (l[9] as num).toInt() : 0;
    if (cards <= 0) continue;
    final id = l[0] as int, courseId = l[1] as int, subjectId = l[2] as int, topicId = l[3] as int;
    final canAccess = prog.canOpenLesson(id, courseId, l[5] == 1);
    final r = byLesson[id] ?? const [0, 0, 0];
    final newCount = (cards - r[0]).clamp(0, cards);
    final cKey = 'c:$courseId';
    final sKey = '$cKey/s:${subjectId == 0 ? 'general-subject' : subjectId}';
    final tKey = '$sKey/t:${topicId == 0 ? 'general-topic' : topicId}';
    final lKey = '$tKey/l:$id';
    final course = node(roots, cKey, '${cat.courseById[courseId]?[1] ?? 'General'}', 'course', 0);
    final subject = node(course.children, sKey, '${cat.subjectById[subjectId]?[2] ?? 'General subject'}', 'subject', 1);
    final topic = node(subject.children, tKey, '${cat.topicById[topicId]?[2] ?? 'General topic'}', 'topic', 2);
    final lesson = node(topic.children, lKey, '${l[4]}'.isEmpty ? 'Untitled lesson' : '${l[4]}', 'lesson', 3);
    for (final n in [course, subject, topic, lesson]) {
      if (!n.noteIds.contains(id)) n.noteIds.add(id);
      n.newCount += newCount;
      n.learning += r[1];
      n.due += r[2];
      n.cards += cards;
      if (!canAccess) n.locked = true;
    }
  }
  final decks = roots.map((n) => n.toDeck()).toList();
  return DecksResult(
    decks: decks,
    totalNew: decks.fold(0, (a, d) => a + d.newCount),
    totalLearning: decks.fold(0, (a, d) => a + d.learningCount),
    totalDue: decks.fold(0, (a, d) => a + d.dueCount),
  );
}

class _Node {
  final String key, label, type;
  final int depth;
  final List<int> noteIds = [];
  final List<_Node> children = [];
  int newCount = 0, learning = 0, due = 0, cards = 0;
  bool locked = false;
  _Node(this.key, this.label, this.type, this.depth);
  DeckNode toDeck() => DeckNode(
        key: key,
        label: label,
        type: type,
        depth: depth,
        noteIds: noteIds,
        newCount: newCount,
        learningCount: learning,
        dueCount: due,
        cardCount: cards,
        locked: locked,
        children: children.map((c) => c.toDeck()).toList(),
      );
}

/// Card id → its lesson, for reviews (filled when a queue is built).
final Map<int, int> _cardLesson = <int, int>{};

/// The review queue for a deck scope (comma-separated lesson ids), built on
/// the phone: cards from the phone's copy (downloaded once per lesson, again
/// only if changed), FSRS state and button intervals from the phone.
final flashQueueProvider =
    FutureProvider.autoDispose.family<QueueResult, String>((ref, noteIdsCsv) async {
  ref.watch(userScopeProvider);
  final cat = await ref.read(catalogueProvider.future);
  final prog = await ref.read(studentProgressProvider.future);
  final ids = noteIdsCsv.split(',').map((v) => int.tryParse(v.trim()) ?? 0).where((v) => v > 0).toSet();
  // The deck's lessons the student may open and that have cards, in study order.
  final lessons = <int>[];
  final stamps = <int, int>{};
  final cardCount = <int, int>{};
  for (final id in ids) {
    final l = cat.lessonById[id];
    if (l == null || l.length < 11 || (l[9] as num) <= 0) continue;
    if (!prog.canOpenLesson(id, l[1] as int, l[5] == 1)) continue;
    lessons.add(id);
    stamps[id] = (l[10] as num).toInt();
    cardCount[id] = (l[9] as num).toInt();
  }
  final api = ref.read(apiClientProvider);
  final reviews = await FlashStore.reviews();
  final settings = await FlashStore.settings();
  final scheduler = FlashStore.schedulerFrom(settings);
  final newLimit = (settings['newPerDay'] as num?)?.toInt() ?? 20;
  final reviewLimit = ((settings['reviewsPerDay'] as num?)?.toInt() ?? 200).clamp(0, 500);
  final now = DateTime.now().toUtc();
  final eod = _endOfDay(DateTime.now()).toUtc();

  // 10.23 F1/F3: plan the session from what the phone already holds — the
  // review records say which lessons have due / learning cards; the catalogue
  // says how many cards each lesson has. Only the lessons this batch needs are
  // downloaded (once; kept on the phone), never the whole deck.
  final reviewed = <int, int>{};
  final dueLessons = <int>{};
  var learningCount = 0, dueCount = 0;
  for (final row in reviews.values) {
    final lid = row.length > 8 ? (row[8] as num?)?.toInt() ?? 0 : 0;
    if (!stamps.containsKey(lid)) continue;
    reviewed[lid] = (reviewed[lid] ?? 0) + 1;
    if (row[6] == 1 || row[7] == 1) continue;
    final state = (row[0] as num).toInt();
    final due = DateTime.tryParse('${row[4]}')?.toUtc() ?? now;
    if ((state == 1 || state == 3) && !due.isAfter(now)) {
      learningCount++;
      dueLessons.add(lid);
    } else if (state == 2 && !due.isAfter(eod)) {
      dueCount++;
      dueLessons.add(lid);
    }
  }
  int newLeft(int lid) => ((cardCount[lid] ?? 0) - (reviewed[lid] ?? 0)).clamp(0, 1 << 30);
  final totalNew = lessons.fold<int>(0, (sum, lid) => sum + newLeft(lid));
  final picked = <int>[];
  var i = 0, newFound = 0;
  for (; i < lessons.length && newFound < newLimit; i++) {
    final left = newLeft(lessons[i]);
    if (left <= 0) continue;
    picked.add(lessons[i]);
    newFound += left;
  }
  final cardsByLesson = await FlashStore.cardsFor(api, {for (final id in {...dueLessons, ...picked}) id: stamps[id]!});
  // F2: the next 20 new cards' lessons download quietly now, so "Study 20 more"
  // opens with no wait (nothing is fetched for lessons already on the phone).
  final next = <int>[];
  var nextFound = 0;
  for (; i < lessons.length && nextFound < newLimit; i++) {
    final left = newLeft(lessons[i]);
    if (left <= 0) continue;
    next.add(lessons[i]);
    nextFound += left;
  }
  if (next.isNotEmpty) {
    unawaited(FlashStore.cardsFor(api, {for (final id in next) id: stamps[id]!}).then((_) {}, onError: (_) {}));
  }

  final learning = <(DateTime, QueueCard)>[], due = <(DateTime, QueueCard)>[], fresh = <QueueCard>[];
  for (final id in ids) {
    for (final c in cardsByLesson[id] ?? const <List<dynamic>>[]) {
      final cardId = (c[0] as num).toInt();
      _cardLesson[cardId] = id;
      final row = reviews[cardId];
      if (row != null && (row[6] == 1 || row[7] == 1)) continue;
      final card = FlashStore.toCard(cardId, row);
      final previews = <IntervalPreview>[];
      for (final rating in fsrs.Rating.values) {
        final next = scheduler.reviewCard(card, rating, reviewDateTime: now).card;
        final minutes = next.due.difference(now).inMinutes;
        previews.add(IntervalPreview(rating.value, FlashStore.intervalLabel(minutes < 0 ? 0 : minutes)));
      }
      final images = c[5] is List ? (c[5] as List) : const [];
      final qc = QueueCard(
        card: FlashCard(
          id: cardId,
          question: '${c[2]}',
          answer: '${c[3]}',
          imageUrl: images.isEmpty ? '' : '${images.first}',
          imageFit: '${c[6]}',
        ),
        state: row == null ? 'new' : const {1: 'learning', 2: 'review', 3: 'relearning'}[(row[0] as num).toInt()] ?? 'learning',
        previews: previews,
      );
      if (row == null) {
        fresh.add(qc);
      } else {
        final state = (row[0] as num).toInt();
        if ((state == 1 || state == 3) && !card.due.isAfter(now)) {
          learning.add((card.due, qc));
        } else if (state == 2 && !card.due.isAfter(eod)) {
          due.add((card.due, qc));
        }
      }
    }
  }
  learning.sort((a, b) => a.$1.compareTo(b.$1));
  due.sort((a, b) => a.$1.compareTo(b.$1));
  final queue = <QueueCard>[
    ...learning.map((e) => e.$2),
    ...due.take(reviewLimit).map((e) => e.$2),
    ...fresh.take(newLimit < 0 ? 0 : newLimit),
  ];
  return QueueResult(
    cards: queue.take(kFlashSessionSize).toList(),
    // F3: the deck's counts from the catalogue and the review records, so they
    // are right before every card has been downloaded.
    newCount: totalNew,
    learning: learningCount,
    due: dueCount,
  );
});

final flashcardsApiProvider = Provider((ref) => ref.read(apiClientProvider));

/// A grade, scheduled and kept on the phone (no server request).
Future<void> submitFlashcardReview(
  ApiClient api, {
  required int cardId,
  required int rating,
  required String reviewUid,
  required String reviewTimeIso,
}) async {
  await FlashStore.review(
    cardId: cardId,
    lessonId: _cardLesson[cardId] ?? 0,
    rating: rating,
    at: DateTime.tryParse(reviewTimeIso)?.toUtc() ?? DateTime.now().toUtc(),
  );
}
