import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';

// ── defensive coercion helpers (match app convention) ──
String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);

// ── models ──────────────────────────────────────────────────────────────────

class EcgTopic {
  final int id;
  final String title;
  final String description;
  final int position;
  final int cardCount;

  EcgTopic({
    required this.id,
    required this.title,
    required this.description,
    required this.position,
    required this.cardCount,
  });

  factory EcgTopic.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return EcgTopic(
      id: _i(m['id']),
      title: _s(m['title']),
      description: _s(m['description']),
      position: _i(m['position']),
      cardCount: _i(m['cardCount']),
    );
  }
}

class EcgCard {
  final int id;
  final String title;
  final String imageUrl;
  final String explanation;

  EcgCard({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.explanation,
  });

  factory EcgCard.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return EcgCard(
      id: _i(m['id']),
      title: _s(m['title']),
      imageUrl: _s(m['image_url']),
      explanation: _s(m['explanation']),
    );
  }
}

class EcgTopicDetail {
  final EcgTopic? topic;
  final List<EcgCard> cards;
  const EcgTopicDetail({required this.topic, required this.cards});
}

class EcgQuizQuestion {
  final int id;
  final String questionText;
  final String imageUrl;
  final List<String> options;
  final String answer;
  final String explanation;

  EcgQuizQuestion({
    required this.id,
    required this.questionText,
    required this.imageUrl,
    required this.options,
    required this.answer,
    required this.explanation,
  });

  factory EcgQuizQuestion.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final opts = (m['options'] is List)
        ? (m['options'] as List).map(_s).where((s) => s.isNotEmpty).toList()
        : <String>[];
    return EcgQuizQuestion(
      id: _i(m['id']),
      questionText: _s(m['question_text']).isEmpty
          ? 'What does this ECG show?'
          : _s(m['question_text']),
      imageUrl: _s(m['image_url']),
      options: opts,
      answer: _s(m['answer']),
      explanation: _s(m['explanation']),
    );
  }
}

// ── repository ────────────────────────────────────────────────────────────────

class EcgRepository {
  final ApiClient _client;
  EcgRepository(this._client);

  Future<List<EcgTopic>> topics() async {
    final res = await _client.dio.get('/student/ecg/topics');
    final data = res.data as Map<String, dynamic>;
    final list = (data['topics'] as List?) ?? const [];
    return list.map(EcgTopic.fromJson).toList();
  }

  Future<EcgTopicDetail> topic(int id) async {
    final res = await _client.dio.get('/student/ecg/topics/$id');
    final data = res.data as Map<String, dynamic>;
    final topic = data['topic'] == null ? null : EcgTopic.fromJson(data['topic']);
    final cards = (data['cards'] as List?)?.map(EcgCard.fromJson).toList() ?? <EcgCard>[];
    return EcgTopicDetail(topic: topic, cards: cards);
  }

  Future<List<EcgQuizQuestion>> quiz({int count = 10}) async {
    final res = await _client.dio.get(
      '/student/ecg/quiz',
      queryParameters: {'count': count},
    );
    final data = res.data as Map<String, dynamic>;
    final list = (data['questions'] as List?) ?? const [];
    return list.map(EcgQuizQuestion.fromJson).toList();
  }
}

final ecgRepositoryProvider = Provider<EcgRepository>(
  (ref) => EcgRepository(ref.read(apiClientProvider)),
);

/// Topics list — cached, refreshable.
final ecgTopicsProvider = FutureProvider.autoDispose<List<EcgTopic>>(
  (ref) => ref.read(ecgRepositoryProvider).topics(),
);

/// Topic detail by id.
final ecgTopicProvider = FutureProvider.autoDispose.family<EcgTopicDetail, int>(
  (ref, id) => ref.read(ecgRepositoryProvider).topic(id),
);
