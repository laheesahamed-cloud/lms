import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/apple_iap.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import 'subscriptions_repository.dart';

/// In-app subscription purchase (iOS / StoreKit 2).
///
/// App Review checks this screen closely — Guideline 3.1.1 and 3.1.2 require it
/// to show, for each option: the name, the duration, the localized price, and
/// that it auto-renews until cancelled; plus a **Restore Purchases** action and
/// links to the **Terms of Use** and **Privacy Policy**. All of those are here
/// deliberately; removing any one of them is a rejection.
///
/// Everything money-related happens through Apple. There is no price we compute
/// and no link to pay on the website — that combination is exactly what got
/// build 1.0.0 (1) rejected.
const String _termsUrl = 'https://xyndrome.lk/lms/frontend/dist/terms';
const String _privacyUrl = 'https://xyndrome.lk/lms/frontend/dist/privacy-policy';

class PaywallSheet extends ConsumerStatefulWidget {
  const PaywallSheet({super.key});

  /// Opens the paywall. Resolves to true when access was granted, so callers
  /// can refresh the content the user was blocked from.
  static Future<bool> show(BuildContext context) async {
    if (!iapSupported) return false;
    final granted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const PaywallSheet(),
    );
    return granted ?? false;
  }

  @override
  ConsumerState<PaywallSheet> createState() => _PaywallSheetState();
}

class _PaywallSheetState extends ConsumerState<PaywallSheet> {
  List<IapProduct> _products = const [];
  bool _loading = true;
  String? _busyProductId;
  bool _restoring = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final products = await loadIapProducts();
    if (!mounted) return;
    setState(() {
      _products = products;
      _loading = false;
      // Products come back empty when StoreKit can't reach the App Store or the
      // products aren't approved yet. Say so plainly instead of showing an
      // empty sheet the user can't act on.
      _error = products.isEmpty ? 'Plans are unavailable right now. Please try again later.' : null;
    });
  }

  /// Hand the Apple-signed transaction to the backend, which verifies the
  /// signature and grants access. Only once that succeeds do we tell StoreKit
  /// the purchase is delivered.
  Future<bool> _redeem(String transactionId, String jws) async {
    await ref.read(redeemAppleTransactionProvider)(jws);
    await finishIapTransaction(transactionId);
    ref.invalidate(billingProvider);
    return true;
  }

  Future<void> _buy(IapProduct product) async {
    if (_busyProductId != null || _restoring) return;
    setState(() {
      _busyProductId = product.id;
      _error = null;
    });
    try {
      final purchase = await purchaseIapProduct(product.id);

      if (purchase.status == IapStatus.cancelled) return;

      if (purchase.status == IapStatus.pending) {
        if (mounted) {
          setState(() => _error =
              'Your purchase needs approval. Access unlocks automatically once it is approved.');
        }
        return;
      }

      if (!purchase.isPurchased) {
        if (mounted) setState(() => _error = 'That purchase could not be completed.');
        return;
      }

      await _redeem(purchase.transactionId ?? '', purchase.jws!);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = _friendly(e));
    } finally {
      if (mounted) setState(() => _busyProductId = null);
    }
  }

  Future<void> _restore() async {
    if (_busyProductId != null || _restoring) return;
    setState(() {
      _restoring = true;
      _error = null;
    });
    try {
      final entitlements = await restoreIapPurchases();
      if (entitlements.isEmpty) {
        if (mounted) setState(() => _error = 'No previous purchase was found for this Apple ID.');
        return;
      }
      for (final entitlement in entitlements) {
        await _redeem(entitlement.transactionId, entitlement.jws);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = _friendly(e));
    } finally {
      if (mounted) setState(() => _restoring = false);
    }
  }

  /// The backend returns 409 when a purchase is already tied to another
  /// account — worth stating clearly, since the user can act on it.
  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('409') || text.contains('another account')) {
      return 'This purchase is already linked to a different account. '
          'Sign in with that account, or contact support.';
    }
    return 'Something went wrong. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bottom = MediaQuery.of(context).padding.bottom;
    final busy = _busyProductId != null || _restoring;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF0F121F) : const Color(0xFFFBFCFF),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 10, 20, bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(bottom: 16),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: c.line,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text('Unlock everything',
                style: TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: 6),
            Text(
              'Full access to all courses, lessons, flashcards, and question banks.',
              style: TextStyle(fontSize: 14, height: 1.4, color: c.inkSoft),
            ),
            const SizedBox(height: 18),

            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              for (final product in _products) ...[
                _PlanOption(
                  product: product,
                  busy: _busyProductId == product.id,
                  disabled: busy && _busyProductId != product.id,
                  onTap: () => _buy(product),
                ),
                const SizedBox(height: 10),
              ],

            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Color(0xFFDC2626))),
            ],

            const SizedBox(height: 8),
            // Required by Guideline 3.1.1 — a user who reinstalls or switches
            // device must be able to get their subscription back.
            TextButton(
              onPressed: busy ? null : _restore,
              child: _restoring
                  ? const SizedBox(
                      width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text('Restore Purchases',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: c.primary)),
            ),

            const SizedBox(height: 4),
            Text(
              'Payment is charged to your Apple ID at confirmation. Subscriptions renew '
              'automatically unless auto-renew is turned off at least 24 hours before the '
              'end of the current period. Manage or cancel any time in your Apple ID settings.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, height: 1.45, color: c.inkSoft),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _LegalLink(label: 'Terms of Use', url: _termsUrl),
                Text('  ·  ', style: TextStyle(fontSize: 12, color: c.inkSoft)),
                _LegalLink(label: 'Privacy Policy', url: _privacyUrl),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanOption extends StatelessWidget {
  final IapProduct product;
  final bool busy;
  final bool disabled;
  final VoidCallback onTap;

  const _PlanOption({
    required this.product,
    required this.busy,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: c.primaryTint.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.displayName.isEmpty ? product.periodLabel : product.displayName,
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong),
                  ),
                  const SizedBox(height: 2),
                  // Price + duration + renewal terms, all required on screen.
                  Text('${product.displayPrice} / ${product.periodLabel}',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: c.primary)),
                  const SizedBox(height: 2),
                  Text(product.renewalNote,
                      style: TextStyle(fontSize: 11, color: c.inkSoft)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 104,
              child: AppButton(
                'Subscribe',
                loading: busy,
                onPressed: disabled ? null : onTap,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegalLink extends StatelessWidget {
  final String label;
  final String url;
  const _LegalLink({required this.label, required this.url});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: () async {
        final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        if (!ok && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not open $url')),
          );
        }
      },
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: c.primary,
          decoration: TextDecoration.underline,
        ),
      ),
    );
  }
}
