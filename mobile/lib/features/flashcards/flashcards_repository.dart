import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';

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
          ? (m['cards'] as List).map(QueueCard.fromJson).toList()
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

/// Deck tree with New / Learning / Due counts.
/// Not autoDispose: these list screens are navigated away from and back to
/// constantly. Disposing on exit meant every return was a cold fetch behind
/// a spinner. Kept alive, AppShell.didPopNext still invalidates them, so the
/// data refreshes in the background while the last result stays on screen.
/// Safe to retain: resetUserScopedData() invalidates all of these on
/// login/logout/account switch.
final flashDecksProvider = FutureProvider<DecksResult>((ref) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/student/flashcards/decks');
  return DecksResult.fromJson(res.data);
});

/// The review queue for a deck scope (comma-separated note ids).
final flashQueueProvider =
    FutureProvider.autoDispose.family<QueueResult, String>((ref, noteIdsCsv) async {
  ref.watch(userScopeProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get(
    '/student/flashcards/queue',
    queryParameters: {'noteIds': noteIdsCsv},
  );
  return QueueResult.fromJson(res.data);
});

/// Submit a single FSRS grade (idempotent via reviewUid).
final flashcardsApiProvider = Provider((ref) => ref.read(apiClientProvider));

Future<void> submitFlashcardReview(
  ApiClient api, {
  required int cardId,
  required int rating,
  required String reviewUid,
  required String reviewTimeIso,
}) async {
  await api.dio.post('/student/flashcards/reviews', data: {
    'reviews': [
      {
        'cardId': cardId,
        'rating': rating,
        'reviewUid': reviewUid,
        'reviewTime': reviewTimeIso,
      }
    ],
  });
}
