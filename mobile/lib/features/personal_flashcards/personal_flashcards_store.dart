import 'dart:convert';
import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';

// ─── Models ──────────────────────────────────────────────────────────────────

class PersonalDeck {
  final String id;
  final String title;
  final DateTime createdAt;

  const PersonalDeck({
    required this.id,
    required this.title,
    required this.createdAt,
  });

  PersonalDeck copyWith({String? title}) => PersonalDeck(
        id: id,
        title: title ?? this.title,
        createdAt: createdAt,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PersonalDeck.fromJson(Map<String, dynamic> j) => PersonalDeck(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Untitled Deck',
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}

class PersonalCard {
  final String id;
  final String front;
  final String back;
  final DateTime createdAt;
  // Scheduling (SM-2 lite)
  final DateTime? nextReview;
  final double intervalDays; // current interval in days
  final double easeFactor;   // multiplier, starts 2.5
  final int reviewCount;

  const PersonalCard({
    required this.id,
    required this.front,
    required this.back,
    required this.createdAt,
    this.nextReview,
    this.intervalDays = 0,
    this.easeFactor = 2.5,
    this.reviewCount = 0,
  });

  bool get isDue {
    if (reviewCount == 0) return true;
    final nxt = nextReview;
    if (nxt == null) return true;
    return nxt.isBefore(DateTime.now());
  }

  PersonalCard copyWith({
    String? front,
    String? back,
    DateTime? nextReview,
    double? intervalDays,
    double? easeFactor,
    int? reviewCount,
  }) =>
      PersonalCard(
        id: id,
        front: front ?? this.front,
        back: back ?? this.back,
        createdAt: createdAt,
        nextReview: nextReview ?? this.nextReview,
        intervalDays: intervalDays ?? this.intervalDays,
        easeFactor: easeFactor ?? this.easeFactor,
        reviewCount: reviewCount ?? this.reviewCount,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'front': front,
        'back': back,
        'createdAt': createdAt.toIso8601String(),
        'nextReview': nextReview?.toIso8601String(),
        'intervalDays': intervalDays,
        'easeFactor': easeFactor,
        'reviewCount': reviewCount,
      };

  factory PersonalCard.fromJson(Map<String, dynamic> j) => PersonalCard(
        id: j['id'] as String,
        front: j['front'] as String? ?? '',
        back: j['back'] as String? ?? '',
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
        nextReview: j['nextReview'] != null
            ? DateTime.tryParse(j['nextReview'] as String)
            : null,
        intervalDays: (j['intervalDays'] as num?)?.toDouble() ?? 0,
        easeFactor: (j['easeFactor'] as num?)?.toDouble() ?? 2.5,
        reviewCount: j['reviewCount'] as int? ?? 0,
      );

  /// SM-2 lite: rating 1=Again 2=Hard 3=Good 4=Easy
  PersonalCard graded(int rating) {
    double ease = easeFactor;
    double interval;

    if (reviewCount == 0) {
      // First review — short bootstrap intervals
      interval = switch (rating) {
        1 => 1,
        2 => 1,
        3 => 3,
        _ => 4,
      };
    } else {
      interval = switch (rating) {
        1 => 1,
        2 => max(1, intervalDays * 1.2),
        3 => max(1, intervalDays * ease),
        _ => max(1, intervalDays * ease * 1.3),
      };
    }

    ease = switch (rating) {
      1 => max(1.3, ease - 0.2),
      2 => max(1.3, ease - 0.15),
      3 => ease,
      _ => ease + 0.15,
    };

    final next = DateTime.now().add(Duration(
      minutes: (interval * 24 * 60).round(),
    ));

    return copyWith(
      nextReview: next,
      intervalDays: interval,
      easeFactor: ease,
      reviewCount: reviewCount + 1,
    );
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

class PersonalFlashcardsStore {
  static const _decksKey = 'xyndrome.personal_fc_decks';

  static String _cardsKey(String deckId) => 'xyndrome.personal_fc_cards_$deckId';

  // ── Decks ──

  static Future<List<PersonalDeck>> loadDecks() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_decksKey);
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => PersonalDeck.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static Future<void> _saveDecks(List<PersonalDeck> decks) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        _decksKey, jsonEncode(decks.map((d) => d.toJson()).toList()));
  }

  static Future<PersonalDeck> createDeck(String title) async {
    final decks = await loadDecks();
    final deck = PersonalDeck(
      id: DateTime.now().millisecondsSinceEpoch.toRadixString(36),
      title: title.trim().isEmpty ? 'Untitled Deck' : title.trim(),
      createdAt: DateTime.now(),
    );
    decks.insert(0, deck);
    await _saveDecks(decks);
    return deck;
  }

  static Future<void> renameDeck(String id, String title) async {
    final decks = await loadDecks();
    final idx = decks.indexWhere((d) => d.id == id);
    if (idx == -1) return;
    decks[idx] = decks[idx].copyWith(
        title: title.trim().isEmpty ? 'Untitled Deck' : title.trim());
    await _saveDecks(decks);
  }

  static Future<void> deleteDeck(String id) async {
    final decks = await loadDecks();
    decks.removeWhere((d) => d.id == id);
    await _saveDecks(decks);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cardsKey(id));
  }

  // ── Cards ──

  static Future<List<PersonalCard>> loadCards(String deckId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cardsKey(deckId));
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => PersonalCard.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static Future<void> _saveCards(String deckId, List<PersonalCard> cards) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        _cardsKey(deckId), jsonEncode(cards.map((c) => c.toJson()).toList()));
  }

  static Future<PersonalCard> addCard(
      String deckId, String front, String back) async {
    final cards = await loadCards(deckId);
    final card = PersonalCard(
      id: DateTime.now().millisecondsSinceEpoch.toRadixString(36),
      front: front.trim(),
      back: back.trim(),
      createdAt: DateTime.now(),
    );
    cards.add(card);
    await _saveCards(deckId, cards);
    return card;
  }

  static Future<void> updateCard(
      String deckId, String cardId, String front, String back) async {
    final cards = await loadCards(deckId);
    final idx = cards.indexWhere((c) => c.id == cardId);
    if (idx == -1) return;
    cards[idx] = cards[idx].copyWith(front: front.trim(), back: back.trim());
    await _saveCards(deckId, cards);
  }

  static Future<void> deleteCard(String deckId, String cardId) async {
    final cards = await loadCards(deckId);
    cards.removeWhere((c) => c.id == cardId);
    await _saveCards(deckId, cards);
  }

  static Future<void> saveCardReview(String deckId, PersonalCard card) async {
    final cards = await loadCards(deckId);
    final idx = cards.indexWhere((c) => c.id == card.id);
    if (idx == -1) return;
    cards[idx] = card;
    await _saveCards(deckId, cards);
  }

  // ── Stats helper ──

  static Future<DeckStats> deckStats(String deckId) async {
    final cards = await loadCards(deckId);
    int newCount = 0, dueCount = 0;
    for (final c in cards) {
      if (c.reviewCount == 0) {
        newCount++;
      } else if (c.isDue) {
        dueCount++;
      }
    }
    return DeckStats(
        total: cards.length, newCount: newCount, dueCount: dueCount);
  }
}

class DeckStats {
  final int total;
  final int newCount;
  final int dueCount;
  const DeckStats(
      {required this.total, required this.newCount, required this.dueCount});
}
