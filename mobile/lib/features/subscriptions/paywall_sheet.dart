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
/// links to the **Terms of Use** and **Privacy Policy**. The separate "charged
/// to your Apple ID, cancel in Settings" sentence was removed at the owner's
/// request — it is convention rather than a documented requirement, and the
/// things 3.1.2 actually asks for (price, period, auto-renewal, and both legal
/// links) are all still on screen. All of those are here
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
      // The sheet is inset from the status bar by the ROUTE, not by arithmetic
      // inside it. Two attempts at computing this from MediaQuery were wrong on
      // device — padding.top is zeroed inside a sheet, and viewPadding did not
      // match what the phone actually uses either. This is the framework's own
      // answer and it cannot drift from the real inset.
      useSafeArea: true,
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
    final mq = MediaQuery.of(context);
    final bottom = mq.viewPadding.bottom > 0
        ? mq.viewPadding.bottom
        : mq.padding.bottom;
    final busy = _busyProductId != null || _restoring;
    final selected = _selectedProduct;

    return Container(
      // No height cap of its own: useSafeArea on the route already keeps the
      // sheet below the status bar, and a second limit computed here is what
      // kept fighting it.
      decoration: BoxDecoration(
        color: dark ? c.page : _kLightGround,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _UnlockHeader(
              onClose: () => Navigator.of(context).maybePop(),
              onRestore: busy ? null : _restore,
              restoring: _restoring,
            ),
            const SizedBox(height: 14),
            // 2x2 rather than four rows: it halves the vertical space the
            // features take, which is what lets the plans sit above the fold.
            Row(children: [
              Expanded(child: _FeatureTile(f: _features[0])),
              const SizedBox(width: 10),
              Expanded(child: _FeatureTile(f: _features[1])),
            ]),
            const SizedBox(height: 6),
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
              // One line, and it shrinks rather than wraps. The two-line floor
              // this used to reserve existed to stop the sheet jumping as the
              // selected plan changed the string's length — holding it to a
              // single line removes the jump outright and gives the height
              // back. FittedBox only ever scales DOWN, so larger accessibility
              // text still renders, just fitted.
              Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    '${selected.displayPrice} / ${selected.periodLabel} · ${selected.renewalNote}',
                    maxLines: 1,
                    style: TextStyle(fontSize: 10.5, height: 1.2, color: c.inkSoft),
                  ),
                ),
              ),
            ],

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
      ),
    );
  }
}

/// One plan row. Kept to the essentials — name, price, one button — since the
/// auto-renew terms required by Guideline 3.1.1 are stated once at the bottom
/// of the sheet rather than repeated on every card.
/// A selectable plan row. Tapping selects; the single CTA at the bottom of the
/// sheet does the buying, so nothing here competes with it.
/// A selected card's fill: the CTA's colours at low strength, blended into the
/// app's own background and fading back to it.
///
/// Blended explicitly rather than left translucent. A BoxDecoration ignores its
/// `color` when a `gradient` is set, so a translucent wash was compositing over
/// whatever happened to be behind the card rather than over the page — fine
/// here by luck, wrong the moment anything sits underneath it.
///
/// It runs to the page colour at the far corner, so the card reads as the
/// background warming toward the CTA rather than a flat tinted panel.
/// The sheet's own ground: the app's black in dark, a near-white in light.
/// Named because the selected card's wash and the header's bottom fade both
/// have to run out into exactly this colour.
const Color _kLightGround = Color(0xFFFBFCFF);

/// The dark band the header artwork sits on. The picture is lit for black, so
/// it keeps its own ground in light mode rather than smearing grey over white.
const Color _kHeroGround = Color(0xFF0A0A0F);

LinearGradient _ctaWash(Color page) => LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color.alphaBlend(const Color(0xFF3B82F6).withValues(alpha: 0.26), page),
        Color.alphaBlend(const Color(0xFF6366F1).withValues(alpha: 0.15), page),
        page,
      ],
      stops: const [0.0, 0.55, 1.0],
    );

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
    final dark = Theme.of(context).brightness == Brightness.dark;
    final recommended = product.isRecommended;

    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: disabled ? null : onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          // Flutter has no gradient Border, so the outer tile IS the border: a
          // gradient-filled box with the card inset inside it by the stroke.
          padding: EdgeInsets.all(selected ? 1.6 : 1),
          decoration: BoxDecoration(
            gradient: selected ? kHeroGradient : null,
            color: selected
                ? null
                : (dark ? c.line.withValues(alpha: 0.55) : c.lineMedium),
            borderRadius: BorderRadius.circular(15),
          ),
          child: Container(
            padding: const EdgeInsets.fromLTRB(13, 7, 13, 7),
            decoration: BoxDecoration(
              // Mixed into the page's black rather than a solid fill: the card
              // reads as the background warming toward the CTA, with the
              // gradient at full strength only on its edge.
              color: selected ? null : (dark ? c.page : c.card),
              gradient: selected ? _ctaWash(dark ? c.page : _kLightGround) : null,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
            children: [
              // Radio-style indicator makes the current choice unmistakable.
              Container(
                width: 21,
                height: 21,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: selected ? kHeroGradient : null,
                  color: selected ? null : Colors.transparent,
                  border: Border.all(
                      color: selected ? Colors.transparent : c.line,
                      width: selected ? 0 : 1.6),
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
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text('${product.displayPrice} / ${product.periodLabel}',
                        style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: selected ? c.inkStrong : c.inkSoft)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // A fixed slot, so every badge starts at the same x down the
              // column and sits centred against the name and the price rather
              // than riding on the name's baseline.
              SizedBox(
                width: 86,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Only on a plan that is NOT the recommended one, so a
                      // single row never carries two competing badges.
                      if (!recommended && saving != null)
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
                      if (recommended)
                        // Solid fill, not a tint — the old badge blended into
                        // the card and was easy to miss.
                        Container(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                              gradient: kHeroGradient,
                              borderRadius: BorderRadius.circular(99)),
                          child: const Text('BEST VALUE',
                              style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.7,
                                  color: Colors.white)),
                        ),

                    ],
                  ),
                ),
              ),
            ],
          ),
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
    // No card behind it. Four bordered boxes stacked two-by-two made a grid of
    // containers rather than a list of benefits, and the borders cost height
    // this sheet does not have. The icon tile is enough of an anchor.
    return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              gradient: kHeroGradient,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(f.icon, size: 15, color: Colors.white),
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
    );
  }
}

/// The artwork at the top of the sheet.
///
/// A PNG with a real alpha channel, so the glow fades into whatever is behind
/// it rather than sitting on a plate — which is what let it keep its white
/// crown: a background removed by colour would have taken the crown with it.
///
/// Height-constrained, not width: the sheet's height is the scarce thing here,
/// and at 92pt this still comes out ~196pt wide, comfortably inside the
/// The whole top of the sheet: the artwork, a scrim, the close and Restore
/// controls, the title and the subtitle — as ONE block.
///
/// Together, deliberately. The artwork used to be positioned behind the
/// scrolling content, which meant it stayed put while the words moved: on an
/// overscroll bounce the text slid away and left the picture stranded. In one
/// block they move as a unit, and the words still sit ON the picture because
/// they are stacked over it rather than laid out after it.
class _UnlockHeader extends StatelessWidget {
  final VoidCallback onClose;
  final VoidCallback? onRestore;
  final bool restoring;
  const _UnlockHeader({
    required this.onClose,
    required this.onRestore,
    required this.restoring,
  });

  /// The picture's own proportions — height follows width, so it is stretched
  /// edge to edge and cropped in neither direction.
  static const double _aspect = 2.13;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final w = MediaQuery.of(context).size.width;
    final art = w / _aspect;
    // Where the words start: just past the crown's middle, so the title
    // crosses it rather than clearing it. Taken as a fraction of the artwork so
    // it holds at any width.
    final textTop = art * 0.46;
    // The block ends with the subtitle, which now finishes inside the picture
    // — so the header is the artwork's own height and no taller.
    final height = art;

    return SizedBox(
      height: height,
      // The sheet pads its content 20 a side; this one child steps outside
      // that so the artwork reaches both edges.
      child: OverflowBox(
        maxWidth: w,
        alignment: Alignment.topCenter,
        child: SizedBox(
      width: w,
      height: height,
      child: Stack(
        children: [
          // The artwork is lit for a black ground. On the light sheet it would
          // read as a grey smear with unreadable words over it, so the header
          // carries its own dark band in BOTH themes and everything written on
          // it stays white.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: art,
            child: const ColoredBox(color: _kHeroGround),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SizedBox(
              width: w,
              height: art,
              child: ShaderMask(
                // radius is a fraction of the SHORTEST side, so it must exceed
                // 1 to reach the corners of a wide box — at 0.8 it was erasing
                // the outer quarter of the artwork.
                shaderCallback: (rect) => const RadialGradient(
                  center: Alignment.center,
                  radius: 1.25,
                  colors: [
                    Colors.white,
                    Colors.white,
                    Color(0x88FFFFFF),
                    Colors.transparent,
                  ],
                  stops: [0.0, 0.76, 0.92, 1.0],
                ).createShader(rect),
                blendMode: BlendMode.dstIn,
                child: Opacity(
                  // Quieter again: the words sit across the crown now, and the
                  // picture has to give way to them.
                  opacity: 0.72,
                  child: Image.asset(
                    'assets/premium/unlock_hero.png',
                    width: w,
                    fit: BoxFit.fitWidth,
                    filterQuality: FilterQuality.medium,
                  ),
                ),
              ),
            ),
          ),
          // A shade rising from the bottom, so the words have something to sit
          // on rather than relying on whatever part of the picture happens to
          // fall behind each letter.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: height * 0.72,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.0),
                      Colors.black.withValues(alpha: 0.55),
                      Colors.black.withValues(alpha: 0.78),
                    ],
                    stops: const [0.0, 0.55, 1.0],
                  ),
                ),
              ),
            ),
          ),
          // In light mode the band would otherwise end in a hard dark-on-white
          // line; this runs it out into the sheet. 26 high, which clears the
          // subtitle.
          if (!dark)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 26,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        _kLightGround.withValues(alpha: 0.0),
                        _kLightGround,
                      ],
                    ),
                  ),
                ),
              ),
            ),
          // The sheet's own controls, over the top of the picture.
          Positioned(
            top: 10,
            left: 20,
            right: 20,
            child: Row(
              children: [
                GestureDetector(
                  onTap: onClose,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close_rounded,
                        size: 18, color: Colors.white),
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: onRestore,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: restoring
                        ? const SizedBox(
                            width: 13,
                            height: 13,
                            child: CircularProgressIndicator(
                                strokeWidth: 1.8, color: Colors.white70))
                        : Text('Restore',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white.withValues(alpha: 0.85),
                                shadows: const [
                                  Shadow(color: Color(0xAA000000), blurRadius: 8)
                                ])),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            top: textTop,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Unlock everything',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: Colors.white,
                        shadows: const [
                          Shadow(color: Color(0xDD000000), blurRadius: 16),
                        ])),
                const SizedBox(height: 5),
                Text(
                  'Get complete access to all courses, practice materials and premium features.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 12,
                      height: 1.35,
                      color: Colors.white.withValues(alpha: 0.78),
                      shadows: const [
                        Shadow(color: Color(0xCC000000), blurRadius: 12),
                      ]),
                ),
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
