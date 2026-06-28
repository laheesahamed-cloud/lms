import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';

// ── single drug item returned from batch endpoint ──
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

// ── response from GET /student/drugs/batch ──
class DrugBatchResult {
  final List<DrugItem> drugs;
  final int useCount;
  final int freeLimit;
  final bool hasSubscription;
  final bool blocked;
  final String? reason;

  const DrugBatchResult({
    required this.drugs,
    required this.useCount,
    required this.freeLimit,
    required this.hasSubscription,
    required this.blocked,
    this.reason,
  });

  factory DrugBatchResult.fromJson(Map<String, dynamic> j) => DrugBatchResult(
        blocked: j['blocked'] == true,
        reason: j['reason'] as String?,
        drugs: (j['drugs'] as List? ?? [])
            .map((e) => DrugItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        useCount: (j['useCount'] as num?)?.toInt() ?? 0,
        freeLimit: (j['freeLimit'] as num?)?.toInt() ?? 5,
        hasSubscription: j['hasSubscription'] == true,
      );
}

class DrugRandomizerRepository {
  final ApiClient _client;
  const DrugRandomizerRepository(this._client);

  Future<DrugBatchResult> batch(int count) async {
    final res = await _client.dio.get(
      '/student/drugs/batch',
      queryParameters: {'count': count},
    );
    return DrugBatchResult.fromJson(res.data as Map<String, dynamic>);
  }

  // Fire-and-forget — never awaited by caller
  Future<void> recordSpin() async {
    try {
      await _client.dio.post('/student/drugs/record');
    } catch (_) {}
  }
}

final drugRandomizerRepositoryProvider = Provider(
  (ref) => DrugRandomizerRepository(ref.read(apiClientProvider)),
);
