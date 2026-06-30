import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

class AuscTopic {
  final int id;
  final String category;
  final String title;
  final String description;
  final int cardCount;
  AuscTopic({required this.id, required this.category, required this.title, required this.description, required this.cardCount});
  factory AuscTopic.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return AuscTopic(
      id: _i(m['id']), category: _s(m['category']).isEmpty ? 'heart' : _s(m['category']),
      title: _s(m['title']), description: _s(m['description']), cardCount: _i(m['cardCount']),
    );
  }
}

class AuscCard {
  final int id;
  final String title;
  final String explanation;
  final bool hasAudio;
  AuscCard({required this.id, required this.title, required this.explanation, required this.hasAudio});
  factory AuscCard.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return AuscCard(id: _i(m['id']), title: _s(m['title']), explanation: _s(m['explanation']), hasAudio: _b(m['hasAudio']));
  }
}

class AuscTopicDetail {
  final AuscTopic? topic;
  final List<AuscCard> cards;
  const AuscTopicDetail({required this.topic, required this.cards});
}

class AuscQuizQuestion {
  final int id;
  final String questionText;
  final bool hasAudio;
  final List<String> options;
  final String answer;
  final String explanation;
  AuscQuizQuestion({required this.id, required this.questionText, required this.hasAudio, required this.options, required this.answer, required this.explanation});
  factory AuscQuizQuestion.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final opts = (m['options'] is List) ? (m['options'] as List).map(_s).where((s) => s.isNotEmpty).toList() : <String>[];
    return AuscQuizQuestion(
      id: _i(m['id']),
      questionText: _s(m['question_text']).isEmpty ? 'What is this sound?' : _s(m['question_text']),
      hasAudio: _b(m['hasAudio']), options: opts, answer: _s(m['answer']), explanation: _s(m['explanation']),
    );
  }
}

class AuscultationRepository {
  final ApiClient _client;
  AuscultationRepository(this._client);

  Future<List<AuscTopic>> topics(String category) async {
    final res = await _client.dio.get('/auscultation/topics', queryParameters: {'category': category});
    final list = ((res.data as Map)['topics'] as List?) ?? const [];
    return list.map(AuscTopic.fromJson).toList();
  }

  Future<AuscTopicDetail> topic(int id) async {
    final res = await _client.dio.get('/auscultation/topics/$id');
    final data = res.data as Map;
    final topic = data['topic'] == null ? null : AuscTopic.fromJson(data['topic']);
    final cards = (data['cards'] as List?)?.map(AuscCard.fromJson).toList() ?? <AuscCard>[];
    return AuscTopicDetail(topic: topic, cards: cards);
  }

  Future<List<AuscQuizQuestion>> quiz(String category, {int count = 10}) async {
    final res = await _client.dio.get('/auscultation/quiz', queryParameters: {'category': category, 'count': count});
    final list = ((res.data as Map)['questions'] as List?) ?? const [];
    return list.map(AuscQuizQuestion.fromJson).toList();
  }

  /// Fetch an audio clip's raw bytes + mime (auth handled by the dio interceptor).
  Future<({Uint8List bytes, String mime})> audioBytes(String kind, int id) async {
    final res = await _client.dio.get<List<int>>(
      '/auscultation/$kind/$id/audio',
      options: Options(responseType: ResponseType.bytes),
    );
    final mime = (res.headers.value('content-type') ?? 'audio/mpeg').split(';').first.trim();
    return (bytes: Uint8List.fromList(res.data ?? const []), mime: mime);
  }
}

final auscultationRepositoryProvider = Provider<AuscultationRepository>(
  (ref) => AuscultationRepository(ref.read(apiClientProvider)),
);

final auscTopicsProvider = FutureProvider.autoDispose.family<List<AuscTopic>, String>(
  (ref, category) => ref.read(auscultationRepositoryProvider).topics(category),
);

final auscTopicProvider = FutureProvider.autoDispose.family<AuscTopicDetail, int>(
  (ref, id) => ref.read(auscultationRepositoryProvider).topic(id),
);
