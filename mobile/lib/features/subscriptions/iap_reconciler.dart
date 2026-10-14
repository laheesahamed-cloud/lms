import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/apple_iap.dart';
import '../../state/auth_controller.dart';
import 'subscriptions_repository.dart';

/// Keeps the server's view of a subscription in step with StoreKit's.
///
/// The backend normally learns about purchases two ways: the app redeems them
/// straight after checkout, and Apple's server notifications report renewals.
/// Both can miss:
///
///  * the app was killed, or the network dropped, between paying and redeeming;
///  * the user reinstalled, or signed in on a new device;
///  * our notification endpoint was unreachable when Apple called it.
///
/// StoreKit still holds the entitlement locally in all of those cases, so on
/// launch and on resume we replay whatever it has. Redemption is idempotent
/// server-side (`UNIQUE(transaction_id)`), so replaying costs nothing.
class IapReconciler {
  IapReconciler(this._ref);

  final Ref _ref;

  /// Transactions already sent this session — avoids re-posting the same
  /// entitlement on every single resume.
  final Set<String> _redeemed = <String>{};
  bool _running = false;
  bool _listening = false;

  /// Begin watching for renewals and Ask-to-Buy approvals that arrive outside a
  /// purchase flow. Safe to call more than once.
  void start() {
    if (_listening || !iapSupported) return;
    _listening = true;
    listenForIapUpdates((entitlement, revoked) async {
      // A revoked (refunded) transaction still goes to the backend: that is how
      // access gets removed promptly rather than waiting for expiry.
      if (revoked) _redeemed.remove(entitlement.transactionId);
      await _redeem(entitlement.transactionId, entitlement.jws, force: revoked);
    });
  }

  /// Replay any local entitlement the backend may not know about.
  Future<void> sync() async {
    if (!iapSupported || _running) return;
    if (!_ref.read(authControllerProvider).isAuthenticated) return;

    _running = true;
    try {
      final entitlements = await currentIapEntitlements();
      for (final entitlement in entitlements) {
        // _redeem refreshes the billing view itself — see the note there.
        await _redeem(entitlement.transactionId, entitlement.jws);
      }
    } catch (_) {
      // Best-effort: a failed sync must never block the app or surface an error.
      // The next launch or resume tries again.
    } finally {
      _running = false;
    }
  }

  Future<bool> _redeem(String transactionId, String jws, {bool force = false}) async {
    if (jws.isEmpty) return false;
    if (!force && _redeemed.contains(transactionId)) return false;
    if (!_ref.read(authControllerProvider).isAuthenticated) return false;

    try {
      await _ref.read(redeemAppleTransactionProvider)(jws);
      _redeemed.add(transactionId);

      // REFRESH HERE, not in the callers.
      //
      // This is why a plan change sometimes left the subscription page showing
      // the old package. StoreKit 2 delivers a subscription change through
      // `Transaction.updates` rather than as the return value of `purchase()`,
      // and that path lands in start()'s listener, which redeemed the
      // transaction and refreshed nothing. The backend was right and the page
      // was stale — so the student saw the old plan while Apple said "you are
      // already subscribed to this".
      //
      // Resuming the app did not rescue it either: sync() only invalidated when
      // a redemption returned true, and this transaction was already in
      // `_redeemed`, so it returned false and nothing refreshed for the rest of
      // the session. Only a full restart cleared it.
      //
      // Doing it here means every path that successfully redeems — purchase,
      // renewal, Ask-to-Buy approval, refund, launch/resume replay — refreshes,
      // and no future caller can forget to.
      _ref.invalidate(billingProvider);

      // Only now is the purchase safe to finish: Apple keeps replaying an
      // unfinished transaction, which is exactly the recovery we want if the
      // backend never confirmed it.
      await finishIapTransaction(transactionId);
      return true;
    } catch (_) {
      // 409 (already owned by another account) or a transient failure. Leave it
      // unfinished so StoreKit offers it again later.
      return false;
    }
  }

  /// Forget the session cache when the signed-in user changes, so the next
  /// account re-checks its own entitlements.
  void reset() => _redeemed.clear();
}

final iapReconcilerProvider = Provider<IapReconciler>((ref) => IapReconciler(ref));
