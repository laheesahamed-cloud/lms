import 'dart:io' show Platform;
import 'package:flutter/services.dart';

/// Native StoreKit 2 in-app purchases, bridged to `StoreKitBridge.swift` via a
/// MethodChannel (no plugin/pod — uses Apple's own StoreKit framework).
///
/// This layer only moves Apple-signed transactions around. Entitlement is never
/// decided here: the `jws` is posted to `/subscriptions/apple/verify`, and the
/// backend verifies Apple's signature before granting access.
const MethodChannel _channel = MethodChannel('app.xyndrome.lk/storekit');

/// StoreKit product ids, matching App Store Connect and `plans.apple_product_id`.
/// Order here is the paywall's display order: shortest to longest commitment.
const List<String> kIapProductIds = <String>[
  'app.xyndrome.lk.weekly',
  'app.xyndrome.lk.monthly',
  'app.xyndrome.lk.quarterly',
  'app.xyndrome.lk.yearly',
];

/// In-app purchase exists on iOS only. Android would need Play Billing, which
/// is not wired; on Android the app stays access-only.
bool get iapSupported => Platform.isIOS;

/// A purchasable subscription as StoreKit describes it. The price is always
/// Apple's localized string — never formatted locally, which would be wrong in
/// every storefront that isn't the developer's own.
class IapProduct {
  final String id;
  final String displayName;
  final String description;
  final String displayPrice;
  final String unit; // day | week | month | year
  final int unitCount;

  const IapProduct({
    required this.id,
    required this.displayName,
    required this.description,
    required this.displayPrice,
    required this.unit,
    required this.unitCount,
  });

  /// "week" / "month" / "year", or "3 months" when the count isn't 1.
  String get periodLabel =>
      unitCount == 1 ? unit : '$unitCount ${unit}s';

  /// Apple requires the renewal terms to be stated on the paywall.
  String get renewalNote => 'Auto-renews every $periodLabel until cancelled.';

  /// The 3-month plan is the best-value option the business wants to steer
  /// people toward — derived from shape (not a hardcoded product id) so it
  /// still works if the underlying App Store Connect product id ever changes.
  bool get isRecommended => unitCount == 3 && unit == 'month';

  factory IapProduct.fromMap(Map<dynamic, dynamic> raw) {
    final m = Map<String, dynamic>.from(raw);
    return IapProduct(
      id: (m['id'] ?? '').toString(),
      displayName: (m['displayName'] ?? '').toString(),
      description: (m['description'] ?? '').toString(),
      displayPrice: (m['displayPrice'] ?? '').toString(),
      unit: (m['unit'] ?? 'period').toString(),
      unitCount: (m['unitCount'] is int) ? m['unitCount'] as int : 1,
    );
  }
}

enum IapStatus { purchased, cancelled, pending, unknown }

/// Outcome of a purchase attempt. [jws] is Apple's signed transaction, present
/// only when [status] is [IapStatus.purchased].
class IapPurchase {
  final IapStatus status;
  final String? transactionId;
  final String? jws;

  const IapPurchase(this.status, {this.transactionId, this.jws});

  bool get isPurchased => status == IapStatus.purchased && (jws ?? '').isNotEmpty;
}

/// An entitlement StoreKit already holds — from a renewal, another device, or a
/// reinstall. Used to re-sync access without the user buying again.
class IapEntitlement {
  final String transactionId;
  final String productId;
  final String jws;

  const IapEntitlement({
    required this.transactionId,
    required this.productId,
    required this.jws,
  });

  factory IapEntitlement.fromMap(Map<dynamic, dynamic> raw) {
    final m = Map<String, dynamic>.from(raw);
    return IapEntitlement(
      transactionId: (m['transactionId'] ?? '').toString(),
      productId: (m['productId'] ?? '').toString(),
      jws: (m['jws'] ?? '').toString(),
    );
  }
}

/// Load the subscription options. Returns an empty list off-iOS, or when the
/// products aren't configured yet — callers must treat "no products" as "hide
/// the paywall" rather than an error state.
Future<List<IapProduct>> loadIapProducts({List<String>? productIds}) async {
  if (!iapSupported) return const <IapProduct>[];
  try {
    final res = await _channel.invokeMethod('products', {
      'productIds': productIds ?? kIapProductIds,
    });
    if (res is! List) return const <IapProduct>[];
    return res
        .whereType<Map<dynamic, dynamic>>()
        .map(IapProduct.fromMap)
        .where((p) => p.id.isNotEmpty)
        .toList();
  } on PlatformException {
    return const <IapProduct>[];
  }
}

/// Run the system purchase sheet for [productId].
Future<IapPurchase> purchaseIapProduct(String productId) async {
  if (!iapSupported) {
    return const IapPurchase(IapStatus.unknown);
  }
  final res = await _channel.invokeMethod('purchase', {'productId': productId});
  final m = Map<String, dynamic>.from(res as Map);
  final status = switch ((m['status'] ?? '').toString()) {
    'purchased' => IapStatus.purchased,
    'cancelled' => IapStatus.cancelled,
    'pending' => IapStatus.pending,
    _ => IapStatus.unknown,
  };
  return IapPurchase(
    status,
    transactionId: (m['transactionId'] ?? '').toString(),
    jws: (m['jws'] ?? '').toString(),
  );
}

/// Restore purchases made on another device or before a reinstall.
/// Apple requires this to be reachable from the paywall.
Future<List<IapEntitlement>> restoreIapPurchases() => _entitlements('restore');

/// Entitlements StoreKit already holds locally — no App Store round trip, so
/// this is cheap enough to run on launch and on resume.
Future<List<IapEntitlement>> currentIapEntitlements() => _entitlements('currentEntitlements');

Future<List<IapEntitlement>> _entitlements(String method) async {
  if (!iapSupported) return const <IapEntitlement>[];
  try {
    final res = await _channel.invokeMethod(method);
    if (res is! List) return const <IapEntitlement>[];
    return res
        .whereType<Map<dynamic, dynamic>>()
        .map(IapEntitlement.fromMap)
        .where((e) => e.jws.isNotEmpty)
        .toList();
  } on PlatformException {
    return const <IapEntitlement>[];
  }
}

/// Tell StoreKit the purchase is fully delivered. Call this only after the
/// backend has granted access — finishing earlier would drop the transaction if
/// redemption failed, and Apple would never resend it.
Future<void> finishIapTransaction(String transactionId) async {
  if (!iapSupported || transactionId.isEmpty) return;
  try {
    await _channel.invokeMethod('finish', {'transactionId': transactionId});
  } on PlatformException {
    // Non-fatal: StoreKit replays unfinished transactions on next launch.
  }
}

/// Renewals, Ask-to-Buy approvals, and refunds arrive outside any purchase call.
/// [onUpdate] receives the signed transaction so it can be redeemed server-side.
void listenForIapUpdates(void Function(IapEntitlement entitlement, bool revoked) onUpdate) {
  if (!iapSupported) return;
  _channel.setMethodCallHandler((call) async {
    if (call.method != 'transactionUpdate') return null;
    final m = Map<String, dynamic>.from(call.arguments as Map);
    final entitlement = IapEntitlement.fromMap(m);
    if (entitlement.jws.isEmpty) return null;
    onUpdate(entitlement, m['revoked'] == true);
    return null;
  });
}
