import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/apple_iap.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../quizzes/quizzes_repository.dart';
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
    // Q-Bank's list is a kept-alive provider (fast repeat visits), so it isn't
    // re-fetched on its own after a purchase — without this it kept showing
    // the pre-purchase locked list until the app was restarted, even though
    // the purchase and the subscription record were both already correct.
    ref.invalidate(quizListProvider);
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
  /// Title plus a short caption, so each one can sit as a tile in a 2x2 grid.
  /// Four full-width rows of small text read as fine print; four tiles read as
  /// four things you get.
  static const List<({IconData icon, String title, String caption})> _features = [
    // Short enough to sit on ONE line in half a phone's width. The longer
    // wording wrapped to two lines, and its caption to two more — four lines
    // in a tile built for two, which is most of why this still scrolled.
    (icon: Icons.menu_book_rounded,
     title: 'All courses',
     caption: 'Every lesson and note'),
    (icon: Icons.timer_rounded,
     title: 'Timed mock exams',
     caption: 'Real exam conditions'),
    (icon: Icons.quiz_rounded,
     title: 'Full question bank',
     caption: 'Explained answers'),
    (icon: Icons.insights_rounded,
     title: 'Progress analytics',
     caption: 'Track improvement'),
  ];

  /// Roughly how many days a product's billing period covers, for comparing
  /// plans of different lengths on the same footing.
  static int _periodDays(IapProduct p) {
    final n = p.unitCount <= 0 ? 1 : p.unitCount;
    switch (p.unit) {
      case 'day':
        return n;
      case 'week':
        return n * 7;
      case 'year':
        return n * 365;
      case 'month':
      default:
        return n * 30;
    }
  }

  /// "Save 40%" against the costliest plan per day, or null.
  ///
  /// Computed from the real prices rather than configured, so it cannot claim
  /// a saving that is not there — if someone reprices a plan in App Store
  /// Connect the badge follows, and it simply disappears when the discount
  /// stops being worth announcing.
  String? _savingLabel(IapProduct product, List<IapProduct> all) {
    if (product.price <= 0) return null;
    final perDay = <double>[];
    for (final p in all) {
      if (p.price <= 0) continue;
      final days = _periodDays(p);
      if (days > 0) perDay.add(p.price / days);
    }
    if (perDay.length < 2) return null;
    final dearest = perDay.reduce((a, b) => a > b ? a : b);
    final mine = product.price / _periodDays(product);
    if (dearest <= 0) return null;
    final saved = ((dearest - mine) / dearest) * 100;
    // Below ten per cent is not a reason to choose a plan, and rounding noise
    // at that end makes the badge look arbitrary.
    if (saved < 10) return null;
    return 'SAVE ${saved.round()}%';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bottom = MediaQuery.of(context).padding.bottom;
    final busy = _busyProductId != null || _restoring;
    final selected = _selectedProduct;

    return Container(
      // Never taller than the space below the status bar. The old 92% was a
      // guess that happens to be wrong on exactly the phones with a dynamic
      // island: the sheet grows upward, so 8% of the screen was not enough to
      // clear it and the title was cut in half by it.
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height -
            MediaQuery.of(context).padding.top -
            10,
      ),
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
            // Close on the left, Restore on the right — the sheet's own
            // chrome, kept off the title so neither competes with it.
            Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.of(context).maybePop(),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                        color: c.surface2, shape: BoxShape.circle),
                    child: Icon(Icons.close_rounded, size: 18, color: c.inkMedium),
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: busy ? null : _restore,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: _restoring
                        ? SizedBox(
                            width: 13,
                            height: 13,
                            child: CircularProgressIndicator(
                                strokeWidth: 1.8, color: c.inkSoft))
                        : Text('Restore',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: c.inkSoft)),
                  ),
                ),
              ],
            ),

            // The mark, then the promise. A paywall that opens on a price list
            // asks for money before it has said what for.
            const Center(child: _PremiumMark()),
            const SizedBox(height: 10),
            Text('Unlock everything',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                    color: c.inkStrong)),
            const SizedBox(height: 6),
            Text(
              'Get complete access to all courses, practice materials and premium features.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, height: 1.35, color: c.inkSoft),
            ),
            const SizedBox(height: 14),

            // 2x2 rather than four rows: it halves the vertical space the
            // features take, which is what lets the plans sit above the fold.
            Row(children: [
              Expanded(child: _FeatureTile(f: _features[0])),
              const SizedBox(width: 10),
              Expanded(child: _FeatureTile(f: _features[1])),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: _FeatureTile(f: _features[2])),
              const SizedBox(width: 10),
              Expanded(child: _FeatureTile(f: _features[3])),
            ]),
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
                  saving: _savingLabel(product, _products),
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
              // Reserve two lines' worth of height. This string wraps to two
              // lines for "3 months" but fits one for "year", so without a
              // floor the whole sheet visibly jumps as you switch plans.
              // minHeight (not a fixed height) so larger accessibility text
              // can still grow instead of being clipped.
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 32),
                child: Center(
                  child: Text(
                    '${selected.displayPrice} / ${selected.periodLabel} · ${selected.renewalNote}',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, height: 1.25, color: c.inkSoft),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 10),
            // Apple requires these terms; kept to one quiet line so they read as
            // fine print rather than a paragraph competing with the CTA.
            Text(
              'Charged to your Apple ID. Cancel any time in Settings.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10.5, height: 1.25, color: c.inkMuted),
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
  /// "SAVE 40%", or null when this plan is not meaningfully cheaper per day.
  /// Worked out by the sheet, which can see every plan; a row on its own
  /// cannot know what it is cheaper than.
  final String? saving;

  const _PlanOption({
    required this.product,
    required this.selected,
    required this.disabled,
    required this.onTap,
    this.saving,
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
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
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
                        // Only on a plan that is NOT the recommended one, so
                        // a single row never carries two competing badges.
                        if (!recommended && saving != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: c.success.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(saving!,
                                style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.7,
                                    color: c.success)),
                          ),
                        ],
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

/// One of the four things a subscription buys, as a tile.
class _FeatureTile extends StatelessWidget {
  final ({IconData icon, String title, String caption}) f;
  const _FeatureTile({required this.f});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: c.primary.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(f.icon, size: 15, color: c.primary),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(f.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 11.5,
                        height: 1.2,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Text(f.caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 10.5, height: 1.25, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The crown mark at the top of the sheet: a rounded tile with a soft glow
/// behind it. Drawn rather than an asset, so it follows the theme and stays
/// crisp — the glow is simply a wider shadow in the brand colour.
class _PremiumMark extends StatelessWidget {
  const _PremiumMark();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        gradient: kHeroGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: c.primary.withValues(alpha: dark ? 0.46 : 0.28),
            blurRadius: 26,
            spreadRadius: 1,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: const Icon(Icons.workspace_premium_rounded,
          size: 26, color: Colors.white),
    );
  }
}
