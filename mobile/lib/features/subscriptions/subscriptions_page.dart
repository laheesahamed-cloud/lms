import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/apple_iap.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/glass_card.dart';
import 'iap_reconciler.dart';
import 'paywall_sheet.dart';
import 'subscriptions_repository.dart';
import '../../widgets/page_header.dart';
import '../../widgets/shell_insets.dart';
import '../../data/app_error.dart';

/// Subscription screen — the user's current plan/status, what each plan
/// includes, and (on iOS) the way to subscribe.
///
/// Purchasing on iOS goes through Apple's in-app purchase only ([PaywallSheet]).
/// The app still shows no price of its own and never links to the website to
/// pay: web purchases remain valid under Guideline 3.1.3(b) *because* the same
/// subscriptions are now buyable in-app, but steering users to them from inside
/// the app is what 3.1.1 forbids.
///
/// Android has no Play Billing wired, so it stays access-only there.
class SubscriptionsPage extends ConsumerStatefulWidget {
  const SubscriptionsPage({super.key});

  @override
  ConsumerState<SubscriptionsPage> createState() => _SubscriptionsPageState();
}

class _SubscriptionsPageState extends ConsumerState<SubscriptionsPage>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // EVERY open refreshes, rather than trusting whatever this session already
    // holds. billingProvider is kept alive on purpose (so the page renders
    // instantly instead of flashing a spinner), which also means it can be
    // arbitrarily old by the time the page is reopened — a subscription that
    // lapsed while the app sat in the background would otherwise still read as
    // active here.
    //
    // Scheduled after the first frame so the cached view paints immediately and
    // the refresh lands underneath it.
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  /// Re-reads entitlement from both sources that can know about it: StoreKit's
  /// local record, replayed to the backend by the reconciler, and the backend's
  /// own view.
  ///
  /// The reconciler reads `currentEntitlements`, which is on-device and does
  /// NOT prompt for an App Store password — deliberately not `AppStore.sync()`,
  /// which would ask the user to authenticate every time this page opened.
  void _refresh() {
    if (!mounted) return;
    ref.read(iapReconcilerProvider).sync();
    ref.invalidate(billingProvider);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-check entitlement when returning to the app (e.g. after subscribing
    // on the website in a separate browser) so unlocked access appears.
    if (state == AppLifecycleState.resumed) {
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final billingAsync = ref.watch(billingProvider);

    // Render whatever we already have, even while a refresh is in flight, so
    // re-opening this page is instant instead of showing a spinner over
    // data we already hold. Only a genuinely empty cache falls through to the
    // loading and error states below.
    final cached = billingAsync.asData?.value;
    if (cached != null) {
      return SafeArea(bottom: false, child: _content(c, cached));
    }

    return SafeArea(
      bottom: false,
      child: billingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load your plan.\n${appError(e).display}',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 14)),
          ),
        ),
        data: (billing) => _content(c, billing),
      ),
    );
  }

  Widget _content(AppColors c, Billing billing) {
    return Builder(
      builder: (context) => RefreshIndicator(
          onRefresh: () async => ref.refresh(billingProvider.future),
          child: ListView(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 20 + shellNavInset(context)),
            children: [
              const PageHeader(title: 'Subscription'),
              const SizedBox(height: 10),
              _statusCard(c, billing.current),
              // Only offer a purchase when there is nothing active to buy over —
              // an existing subscriber seeing "Subscribe" would risk paying twice.
              if (iapSupported && !_hasAccess(billing.current)) ...[
                const SizedBox(height: 14),
                _UpgradeBanner(
                  onTap: () async {
                    final granted = await PaywallSheet.show(context);
                    if (granted) ref.invalidate(billingProvider);
                  },
                ),
              ],

              // Existing subscribers can still switch plans. All four products
              // live in one App Store subscription group, so Apple treats a
              // different pick as an upgrade/downgrade — it prorates and
              // credits unused time, and never charges twice. Hiding this
              // (as an earlier version did) removed the feature for no gain.
              if (iapSupported && _hasAccess(billing.current)) ...[
                const SizedBox(height: 14),
                AppButton(
                  'Change plan',
                  kind: AppButtonKind.cta,
                  expand: true,
                  onPressed: () async {
                    final granted = await PaywallSheet.show(context);
                    if (granted) ref.invalidate(billingProvider);
                  },
                ),
                const SizedBox(height: 10),
                // Apple requires an in-app route to manage/cancel an
                // auto-renewable subscription (Guideline 3.1.2).
                AppButton(
                  'Manage or cancel',
                  kind: AppButtonKind.soft,
                  expand: true,
                  onPressed: () => _openManageSubscriptions(context),
                ),
              ],

              const SizedBox(height: 16),
              _comparison(c, billing.plans),
            ],
          ),
      ),
    );
  }

  /// Free vs Premium, instead of dumping every plan with its own long feature
  /// list. Rows are derived from the actual plans so this stays in step with
  /// the catalog rather than drifting from it.
  Widget _comparison(AppColors c, List<SubPlan> plans) {
    if (plans.isEmpty) return const SizedBox.shrink();

    final free = plans.where((p) => p.isFree).toList();
    final paid = plans.where((p) => !p.isFree).toList();
    if (paid.isEmpty) return const SizedBox.shrink();

    final freeFeatures = free.isEmpty
        ? <String>{}
        : free.first.features.map((f) => f.trim()).toSet();

    // The richest paid plan defines what "Premium" means.
    paid.sort((a, b) => b.features.length.compareTo(a.features.length));
    final premiumFeatures = paid.first.features.map((f) => f.trim()).toList();

    // Union, premium order first so the list reads as "what you get".
    final rows = <String>[
      ...premiumFeatures,
      ...freeFeatures.where((f) => !premiumFeatures.contains(f)),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("What's included",
            style: TextStyle(
                fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const SizedBox(height: 8),
        GlassCard(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Column(
            children: [
              // Column headers
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    const Expanded(child: SizedBox.shrink()),
                    SizedBox(
                      width: 52,
                      child: Text('Free',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                              color: c.inkSoft)),
                    ),
                    SizedBox(
                      width: 62,
                      child: Text('PREMIUM',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.4,
                              color: c.primary)),
                    ),
                  ],
                ),
              ),
              for (final feature in rows)
                Padding(
                  // 3, not 6: this repeats twelve times, so it is worth more
                  // than any single block on the page — 72pt, which is most of
                  // what stood between this list and fitting on one screen.
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      // A leading icon per row. Twelve lines of plain text read
                      // as a wall; an icon gives the eye somewhere to land and
                      // tells you what kind of thing each row is before you
                      // read it.
                      Icon(featureIcon(feature),
                          size: 15, color: c.inkSoft),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(feature,
                            style: TextStyle(
                                fontSize: 12, height: 1.2, color: c.inkMedium)),
                      ),
                      SizedBox(
                        width: 52,
                        child: Center(
                          child: freeFeatures.contains(feature)
                              ? Icon(Icons.check_rounded, size: 15, color: c.success)
                              : Icon(Icons.close_rounded,
                                  size: 15, color: c.inkMuted.withValues(alpha: 0.6)),
                        ),
                      ),
                      SizedBox(
                        width: 62,
                        child: Center(
                          child:
                              Icon(Icons.check_circle_rounded, size: 16, color: c.primary),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _openManageSubscriptions(BuildContext context) async {
    final uri = Uri.parse('https://apps.apple.com/account/subscriptions');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Open Settings → Apple ID → Subscriptions to manage your plan.'),
        ),
      );
    }
  }

  /// True only when the user already has something worth not re-selling over:
  /// a genuinely active PAID (or manually-granted) subscription.
  ///
  /// A "Free" plan is the broad, currently-unrestricted starter tier every
  /// signup gets by default (see [CurrentSub.isFreePlan]) — it must NOT count
  /// as access here, or the purchase button would be permanently invisible for
  /// every user, since everyone starts on it.
  // One definition, on the model, so this page and the planner's premium gate
  // cannot drift apart — they already had, which is how a free user could
  // generate a study plan.
  bool _hasAccess(CurrentSub? cur) => cur?.isPaid ?? false;

  /// What a student WITHOUT a paid subscription is told, everywhere it is said.
  ///
  /// It used to read "You have full access — free of charge. Enjoy!", which
  /// promised something the product does not give: free users do not get full
  /// access, and anyone believing that line hits locked lessons moments later.
  /// "Selected" is the load-bearing word — it says there is something here
  /// without implying everything is. One constant so the three places that say
  /// it cannot drift apart again.
  static const _freeAccessNote = 'Enjoy selected premium features for free.';

  Widget _statusCard(AppColors c, CurrentSub? cur) {
    if (cur == null) {
      return _banner(c, c.inkSoft, Icons.info_outline_rounded, 'No active plan',
          _freeAccessNote);
    }
    if (cur.isFreePlan || cur.isUnlimitedAccess) {
      return _banner(
          c,
          c.primary,
          Icons.verified_outlined,
          cur.planName.isEmpty ? 'Free plan' : cur.planName,
          _freeAccessNote);
    }
    if (cur.isActive) {
      final days = cur.daysRemaining;
      final sub = cur.isExpiringSoon
          ? 'Expires in ${days ?? 0} day${days == 1 ? '' : 's'}'
          : (days != null
              ? '$days day${days == 1 ? '' : 's'} left${cur.endDate.isNotEmpty ? ' · until ${cur.endDate}' : ''}'
              : (cur.endDate.isNotEmpty ? 'Active until ${cur.endDate}' : 'Active'));
      final color = cur.isExpiringSoon ? const Color(0xFFF59E0B) : c.success;
      return _banner(
          c, color, Icons.workspace_premium_outlined, cur.planName, sub);
    }
    // Payment pending is still a live state — one banner, unchanged.
    if (cur.status == 'pending') {
      return _banner(c, const Color(0xFFDC2626), Icons.error_outline_rounded,
          cur.planName.isEmpty ? 'Payment pending' : '${cur.planName} — Payment pending',
          'Your payment is being confirmed.');
    }

    // Expired or cancelled: the student IS on free access now, so lead with
    // that rather than with a dead plan name. Showing "Complete Prep - 3
    // Months — Plan expired" as the headline described what they no longer
    // have; the free banner describes what they do.
    //
    // The ended subscription still gets said, in red underneath, because
    // silently swapping to "Free plan" would read as if the purchase had
    // vanished.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _banner(c, c.primary, Icons.verified_outlined, 'Free plan', _freeAccessNote),
        const SizedBox(height: 10),
        _banner(
          c,
          const Color(0xFFDC2626),
          Icons.error_outline_rounded,
          cur.planName.isEmpty
              ? 'Your subscription has ended'
              : 'Your ${cur.planName} subscription has ended',
          'Subscribe again to unlock premium.',
        ),
      ],
    );
  }

  Widget _banner(
      AppColors c, Color color, IconData icon, String title, String sub) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 24, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(fontSize: 13, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The pitch, as a card rather than a bare button.
///
/// A single full-width CTA says what happens but nothing about why. This says
/// what you get and keeps the button's job — one tap, same destination.
///
/// The artwork is drawn, not an asset: gradient containers and icons theme
/// themselves, stay crisp at any size and add nothing to the bundle, where a
/// raster illustration would be pinned to one theme and need regenerating to
/// change.
class _UpgradeBanner extends StatelessWidget {
  final VoidCallback onTap;
  const _UpgradeBanner({required this.onTap});

  /// The artwork is the whole card, not a decoration on one: the gradient, the
  /// crown, the cap, the sparkles and the chevron are all painted into it, with
  /// its left side deliberately left clear for the words. So the widget's only
  /// job is to lay the text into that clear space and take the tap.
  ///
  /// 2.39:1 is the image's own aspect. Pinned, so the art is never cropped and
  /// the text never drifts off the part of it that was left empty.
  /// The artwork's own aspect. 3:1, and it is drawn full bleed with square
  /// corners, so the card's own radius is the only one in play — the previous
  /// asset had corners baked in and they showed as dark wedges inside the clip.
  static const double _aspect = 2.9985;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth;
        // TYPE SCALED TO THE CARD, not fixed.
        //
        // The sizes were set for a phone, so on an iPad the card grew to three
        // times the width and kept 17pt headings — a big empty panel with
        // small writing in the corner, which is what made it read as inert.
        // Everything below is a fraction of the card's own width, clamped so
        // it stays sane at both ends.
        double k(double frac, double lo, double hi) =>
            (w * frac).clamp(lo, hi).toDouble();
        final titleSize = k(0.048, 18, 36);
        final eyebrowSize = k(0.0245, 11.5, 15);
        final bodySize = k(0.025, 11, 16);
        final ctaSize = k(0.026, 12, 16);
        final padL = w * 0.055;

        return ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: AspectRatio(
            aspectRatio: _aspect,
            child: DecoratedBox(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF4F46E5)
                        .withValues(alpha: dark ? 0.30 : 0.18),
                    blurRadius: 22,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Drawn sharp. The blur that used to be here was covering
                  // for an 1128px asset being enlarged past its own
                  // resolution; this artwork is 2000px and does not need it.
                  const Image(
                      image: AssetImage('assets/premium/upgrade_card.jpg'),
                      fit: BoxFit.cover),
                  // A wash in the artwork's OWN deep blue, heaviest where the
                  // words are. It settles the picture and the text into one
                  // surface instead of words laid over a photograph.
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [
                          Color(0xAA08026D),
                          Color(0x4408026D),
                          Color(0x0008026D),
                        ],
                        stops: [0.0, 0.42, 0.66],
                      ),
                    ),
                  ),
                  Padding(
                    // The clear part of the artwork is its left 55%; the crown
                    // and the cap live in the rest.
                    // The artwork's subject begins at 58% of its width
                    // (measured, not guessed), so the words stop before it.
                    padding: EdgeInsets.fromLTRB(padL, 0, w * 0.45, 0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.auto_awesome_rounded,
                              size: eyebrowSize * 1.1, color: Colors.white70),
                          SizedBox(width: eyebrowSize * 0.42),
                          Flexible(
                            child: Text('Upgrade to Premium',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: eyebrowSize,
                                    fontWeight: FontWeight.w800,
                                    color:
                                        Colors.white.withValues(alpha: 0.9))),
                          ),
                        ]),
                        SizedBox(height: titleSize * 0.34),
                        // TWO-TONE, so the line that names the benefit is the
                        // one that carries the colour. A single block of white
                        // gave the card one weight all through, which is most
                        // of why it read as flat.
                        Text.rich(
                          TextSpan(children: [
                            const TextSpan(text: 'Unlock your full\n'),
                            TextSpan(
                                text: 'learning potential',
                                style: TextStyle(color: _kCtaInk)),
                          ]),
                          style: TextStyle(
                              fontSize: titleSize,
                              height: 1.16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.4,
                              color: Colors.white),
                        ),
                        SizedBox(height: titleSize * 0.3),
                        // The fuller sentence on a card with room for it. One
                        // short line left most of the width empty at tablet
                        // size; a phone still gets the short one, because two
                        // lines there would crowd the title.
                        Text(
                          w >= 520
                              ? 'Get unlimited access to all courses, practice '
                                  'questions, mock exams and more. Study '
                                  'smarter. Go further.'
                              : 'All courses, practice questions, mock exams '
                                  'and more.',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: bodySize,
                              height: 1.35,
                              color: Colors.white.withValues(alpha: 0.86)),
                        ),
                        if (w >= 520) ...[
                          SizedBox(height: titleSize * 0.42),
                          _GoPremiumButton(fontSize: ctaSize),
                        ],
                      ],
                    ),
                  ),
                  // A chevron for a card too short to hold a button.
                  //
                  // At 3:1 a phone's card is about 120pt tall, which the
                  // eyebrow, title and description already fill — so the
                  // affordance is an icon at the edge instead. Drawn by the
                  // app, not baked into the artwork: a painted one cannot be
                  // moved or removed, which is exactly what went wrong with
                  // the last asset.
                  if (w < 520)
                    Align(
                      alignment: const Alignment(0.93, 0.0),
                      child: Container(
                        width: ctaSize * 2.1,
                        height: ctaSize * 2.1,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.16),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.28)),
                        ),
                        child: Icon(Icons.arrow_forward_rounded,
                            size: ctaSize * 1.1, color: Colors.white),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}

/// Sampled from the artwork: #4A73FE is the brightest blue in its clear half,
/// the light streak that sweeps under the books. The title's second line and
/// the button both take it, so the words belong to the picture rather than
/// sitting on top of it. Lifted a little for legibility — the full-strength
/// blue is a shade dark for large type on the deep indigo ground.
const Color _kCtaInk = Color(0xFF7D9DFF);
const Color _kCtaFrom = Color(0xFF4A73FE);
const Color _kCtaTo = Color(0xFF8B21FD);

/// The card's own call to action. Not an AppButton: this one sits on the
/// artwork and takes its colours from it, and the whole card is already the
/// tap target — so it is deliberately inert and purely visual.
class _GoPremiumButton extends StatelessWidget {
  final double fontSize;
  const _GoPremiumButton({required this.fontSize});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        padding: EdgeInsets.symmetric(
            horizontal: fontSize * 1.5, vertical: fontSize * 0.72),
        decoration: BoxDecoration(
          // The artwork's own two ends: its left accent and its top-right
          // violet, so the button reads as part of the same picture.
          gradient: const LinearGradient(colors: [_kCtaFrom, _kCtaTo]),
          borderRadius: BorderRadius.circular(999),
          boxShadow: [
            BoxShadow(
              color: _kCtaFrom.withValues(alpha: 0.45),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.workspace_premium_rounded,
                size: fontSize * 1.15, color: Colors.white),
            SizedBox(width: fontSize * 0.5),
            Text('Go Premium',
                style: TextStyle(
                    fontSize: fontSize,
                    fontWeight: FontWeight.w800,
                    color: Colors.white)),
            SizedBox(width: fontSize * 0.6),
            Icon(Icons.arrow_forward_rounded,
                size: fontSize * 1.05, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

/// An icon for a feature row, matched on what the feature says.
///
/// Derived rather than stored: the rows come from the plan's own feature list,
/// which is edited in the admin panel, so anything stored alongside would drift
/// the moment someone reworded a line.
IconData featureIcon(String feature) {
  final f = feature.toLowerCase();
  if (f.contains('course')) return Icons.menu_book_rounded;
  if (f.contains('randomi')) return Icons.shuffle_rounded;
  if (f.contains('exam')) return Icons.timer_outlined;
  if (f.contains('lesson') && f.contains('study')) return Icons.school_rounded;
  if (f.contains('lesson')) return Icons.play_circle_outline_rounded;
  if (f.contains('mock')) return Icons.description_outlined;
  if (f.contains('past paper') || f.contains('paper')) {
    return Icons.history_edu_outlined;
  }
  if (f.contains('analytic')) return Icons.insights_rounded;
  if (f.contains('practice')) return Icons.track_changes_rounded;
  if (f.contains('advanced') && f.contains('progress')) {
    return Icons.trending_up_rounded;
  }
  if (f.contains('progress')) return Icons.bar_chart_rounded;
  if (f.contains('question')) return Icons.layers_rounded;
  if (f.contains('flashcard')) return Icons.style_rounded;
  if (f.contains('note')) return Icons.edit_note_rounded;
  return Icons.check_circle_outline_rounded;
}
