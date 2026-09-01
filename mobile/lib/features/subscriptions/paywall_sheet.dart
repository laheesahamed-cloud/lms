import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  String? _selectedProductId;
  bool _restoring = false;
  String? _error;

  /// The plan the single bottom CTA will buy.
  IapProduct? get _selectedProduct {
    if (_products.isEmpty) return null;
    for (final p in _products) {
      if (p.id == _selectedProductId) return p;
    }
    return _products.first;
  }

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
      // Pre-select the recommended plan so the CTA is immediately actionable
      // and the option we want chosen is the default.
      _selectedProductId = products
              .where((p) => p.isRecommended)
              .map((p) => p.id)
              .firstOrNull ??
          products.firstOrNull?.id;
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

  /// Turns a failure into something the user (and we) can act on. A blanket
  /// "Something went wrong" hides whether Apple refused the purchase or our own
  /// server refused to redeem it — two very different problems.
  String _detail(Object error) {
    if (error is DioException) {
      final status = error.response?.statusCode;
      final data = error.response?.data;
      final serverMessage = (data is Map && data['message'] != null)
          ? (data['message'] is List
              ? (data['message'] as List).join(', ')
              : data['message'].toString())
          : null;
      if (status != null) {
        return 'Server rejected the purchase ($status)'
            '${serverMessage != null ? ': $serverMessage' : ''}';
      }
      if (error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout) {
        return 'Could not reach the server. Check your connection and try again.';
      }
      return 'Network error while confirming the purchase.';
    }
    if (error is PlatformException) {
      // Apple-side failure: code is ours from StoreKitBridge (products_failed,
      // purchase_failed, unverified, product_not_found …).
      return 'Apple: ${error.message ?? error.code}';
    }
    return 'Something went wrong. Please try again.';
  }

  /// The backend returns 409 when a purchase is already tied to another
  /// account — worth stating clearly, since the user can act on it.
  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('409') || text.contains('another account')) {
      return 'This purchase is already linked to a different account. '
          'Sign in with that account, or contact support.';
    }
    return _detail(error);
  }

  /// What a subscription actually unlocks. The old sheet listed only prices,
  /// which gave no reason to buy.
  static const List<({IconData icon, String label})> _features = [
    (icon: Icons.menu_book_rounded, label: 'Every course, lesson and set of notes'),
    (icon: Icons.quiz_rounded, label: 'Full question bank with explained answers'),
    (icon: Icons.style_rounded, label: 'Flashcards with spaced repetition'),
    (icon: Icons.timer_rounded, label: 'Timed mock exams and progress tracking'),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bottom = MediaQuery.of(context).padding.bottom;
    final busy = _busyProductId != null || _restoring;
    final selected = _selectedProduct;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF0F121F) : const Color(0xFFFBFCFF),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 10, 20, bottom + 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                width: 36,
                height: 4,
                decoration:
                    BoxDecoration(color: c.line, borderRadius: BorderRadius.circular(2)),
              ),
            ),

            // Title row, with Restore tucked small at the top-right so it stops
            // competing with the primary action.
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text('Unlock everything',
                      style: TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w800, color: c.inkStrong)),
                ),
                GestureDetector(
                  onTap: busy ? null : _restore,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 12, top: 4, bottom: 4),
                    child: _restoring
                        ? SizedBox(
                            width: 13,
                            height: 13,
                            child: CircularProgressIndicator(strokeWidth: 1.8, color: c.inkSoft))
                        : Text('Restore',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600, color: c.inkSoft)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            for (final f in _features)
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Row(
                  children: [
                    Icon(f.icon, size: 17, color: c.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(f.label,
                          style: TextStyle(
                              fontSize: 13.5, height: 1.3, color: c.inkMedium)),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 10),

            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              for (final product in _products) ...[
                _PlanOption(
                  product: product,
                  selected: product.id == selected?.id,
                  disabled: busy,
                  onTap: () => setState(() => _selectedProductId = product.id),
                ),
                const SizedBox(height: 8),
              ],

            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Color(0xFFDC2626))),
            ],

            // One primary action for whichever plan is selected, instead of a
            // button per row (which truncated to "Subs…" and split attention).
            if (selected != null) ...[
              const SizedBox(height: 8),
              AppButton(
                'Unlock full access',
                kind: AppButtonKind.cta,
                expand: true,
                loading: _busyProductId != null,
                onPressed: busy ? null : () => _buy(selected),
              ),
              const SizedBox(height: 8),
              Text(
                '${selected.displayPrice} / ${selected.periodLabel} · ${selected.renewalNote}',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11.5, height: 1.35, color: c.inkSoft),
              ),
            ],

            const SizedBox(height: 10),
            // Apple requires these terms; kept to one quiet line so they read as
            // fine print rather than a paragraph competing with the CTA.
            Text(
              'Charged to your Apple ID. Cancel any time in Settings.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, height: 1.4, color: c.inkMuted),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _LegalLink(label: 'Terms of Use', url: _termsUrl),
                Text('  ·  ', style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
                _LegalLink(label: 'Privacy Policy', url: _privacyUrl),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// One plan row. Kept to the essentials — name, price, one button — since the
/// auto-renew terms required by Guideline 3.1.1 are stated once at the bottom
/// of the sheet rather than repeated on every card.
/// A selectable plan row. Tapping selects; the single CTA at the bottom of the
/// sheet does the buying, so nothing here competes with it.
class _PlanOption extends StatelessWidget {
  final IapProduct product;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  const _PlanOption({
    required this.product,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final recommended = product.isRecommended;

    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: disabled ? null : onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
          decoration: BoxDecoration(
            color: selected ? c.primaryTint.withValues(alpha: 0.55) : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? c.primary : c.line,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              // Radio-style indicator makes the current choice unmistakable.
              Container(
                width: 21,
                height: 21,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? c.primary : Colors.transparent,
                  border: Border.all(
                      color: selected ? c.primary : c.line, width: selected ? 0 : 1.6),
                ),
                child: selected
                    ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            product.displayName.isEmpty
                                ? product.periodLabel
                                : product.displayName,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: c.inkStrong),
                          ),
                        ),
                        if (recommended) ...[
                          const SizedBox(width: 8),
                          // Solid fill, not a tint — the old badge blended into
                          // the card and was easy to miss.
                          Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                                color: c.primary,
                                borderRadius: BorderRadius.circular(99)),
                            child: const Text('BEST VALUE',
                                style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.7,
                                    color: Colors.white)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text('${product.displayPrice} / ${product.periodLabel}',
                        style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: selected ? c.primary : c.inkSoft)),
                  ],
                ),
              ),
            ],
          ),
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
      // No underline: these are required fine print, not calls to action, and
      // underlining them pulled the eye away from the CTA.
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: c.inkSoft,
          ),
        ),
      ),
    );
  }
}
