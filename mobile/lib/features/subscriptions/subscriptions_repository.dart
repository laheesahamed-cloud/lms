import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
num _n(dynamic v) => v == null ? 0 : (v is num ? v : num.tryParse(v.toString()) ?? 0);
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';
List<String> _sl(dynamic v) => (v is List)
    ? v.map((e) => e?.toString() ?? '').where((e) => e.trim().isNotEmpty).toList()
    : <String>[];

/// A purchasable plan — `availablePlans` from `GET /subscriptions/me`
/// (same shape as `GET /plans` → mapPlan).
class SubPlan {
  final String id; // numeric id as string → used as the checkout :planId
  final String name;
  final String description;
  final num regularPrice;
  final num? offerPrice;
  final bool offerEnabled;
  final num effectivePrice;
  final String currency;
  final String billingPeriod; // 'month' | 'year' | ...
  final int durationDays;
  final bool recommended;
  final List<String> features;

  SubPlan({
    required this.id,
    required this.name,
    required this.description,
    required this.regularPrice,
    required this.offerPrice,
    required this.offerEnabled,
    required this.effectivePrice,
    required this.currency,
    required this.billingPeriod,
    required this.durationDays,
    required this.recommended,
    required this.features,
  });

  bool get isFree => effectivePrice <= 0;
  bool get hasOffer =>
      offerEnabled && offerPrice != null && offerPrice! < regularPrice;

  factory SubPlan.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return SubPlan(
      id: _s(m['id']),
      name: _s(m['name'] ?? 'Plan'),
      description: _s(m['description']),
      regularPrice: _n(m['regularPrice'] ?? m['price']),
      offerPrice: m['offerPrice'] == null ? null : _n(m['offerPrice']),
      offerEnabled: _b(m['offerEnabled']),
      effectivePrice: _n(m['effectivePrice'] ?? m['regularPrice'] ?? m['price']),
      currency: _s(m['currency'].toString().isEmpty ? 'LKR' : m['currency']),
      billingPeriod: _s(m['billingPeriod'].toString().isEmpty ? 'month' : m['billingPeriod']),
      durationDays: _i(m['durationDays']),
      recommended: _b(m['recommended']),
      features: _sl(m['features']),
    );
  }
}

/// The student's current subscription — `currentSubscription` from `/subscriptions/me`.
class CurrentSub {
  final String planName;
  final String status; // active | pending | expired | cancelled
  final bool isFreePlan;
  final bool isUnlimitedAccess;
  final String startDate;
  final String endDate;
  final int? daysRemaining;
  final bool isExpiringSoon;

  CurrentSub({
    required this.planName,
    required this.status,
    required this.isFreePlan,
    required this.isUnlimitedAccess,
    required this.startDate,
    required this.endDate,
    required this.daysRemaining,
    required this.isExpiringSoon,
  });

  bool get isActive => status == 'active';

  factory CurrentSub.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return CurrentSub(
      planName: _s(m['planName']),
      status: _s(m['status'].toString().isEmpty ? 'active' : m['status']),
      isFreePlan: _b(m['isFreePlan']),
      isUnlimitedAccess: _b(m['isUnlimitedAccess']),
      startDate: _s(m['startDate']),
      endDate: _s(m['endDate']),
      daysRemaining: m['daysRemaining'] == null ? null : _i(m['daysRemaining']),
      isExpiringSoon: _b(m['isExpiringSoon']),
    );
  }
}

class Billing {
  final CurrentSub? current;
  final List<SubPlan> plans;

  Billing({
    required this.current,
    required this.plans,
  });

  factory Billing.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final cur = m['currentSubscription'];
    final plansRaw =
        (m['availablePlans'] is List) ? m['availablePlans'] as List : const [];
    return Billing(
      current: (cur is Map) ? CurrentSub.fromJson(cur) : null,
      plans: plansRaw.map(SubPlan.fromJson).toList(),
    );
  }
}


/// Current subscription + available plans in one call (`GET /subscriptions/me`).
final billingProvider = FutureProvider.autoDispose<Billing>((ref) async {
  ref.watch(currentUserIdProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/subscriptions/me');
  return Billing.fromJson(res.data);
});

/// Redeem an Apple in-app purchase. Only the signed transaction is sent — the
/// backend verifies Apple's signature and decides the plan, so the app can't
/// grant itself access. Returns the refreshed billing state.
final redeemAppleTransactionProvider =
    Provider<Future<Billing> Function(String)>((ref) {
  return (String signedTransaction) async {
    final api = ref.read(apiClientProvider);
    final res = await api.dio.post(
      '/subscriptions/apple/verify',
      data: {'signedTransaction': signedTransaction},
    );
    ref.invalidate(billingProvider);
    return Billing.fromJson(res.data);
  };
});
