import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';

// ── one drug shown in a spin (its text + 3 wrong classes) ──
class DrugItem {
  final Map<String, dynamic> drug;
  final List<String> distractors;
  final String questionType;

  const DrugItem({
    required this.drug,
    required this.distractors,
    required this.questionType,
  });

  factory DrugItem.fromJson(Map<String, dynamic> j) => DrugItem(
        drug: j['drug'] as Map<String, dynamic>,
        distractors: (j['distractors'] as List? ?? []).map((e) => e.toString()).toList(),
        questionType: (j['questionType'] as String?) ?? 'drug_class',
      );
}

class DrugRandomizerRepository {
  final ApiClient _client;
  const DrugRandomizerRepository(this._client);

  /// 10.19: the light list (id, name, class) + free-spin state. With [have]
  /// (the list version on the phone) an unchanged list isn't sent again.
  Future<Map<String, dynamic>> list({int? have}) async {
    final res = await _client.dio.get('/student/drugs/list', queryParameters: {'have': ?have});
    return Map<String, dynamic>.from(res.data as Map);
  }

  /// 10.19: one drug's full text (kept on the phone afterwards).
  Future<Map<String, dynamic>> item(int id) async {
    final res = await _client.dio.get('/student/drugs/item/$id');
    return Map<String, dynamic>.from((res.data as Map)['drug'] as Map);
  }

  /// 10.19: one visit's spins in one request (free users only).
  Future<void> recordSpins(int count) async {
    await _client.dio.post('/student/drugs/record', data: {'count': count});
  }
}

final drugRandomizerRepositoryProvider = Provider(
  (ref) => DrugRandomizerRepository(ref.read(apiClientProvider)),
);
