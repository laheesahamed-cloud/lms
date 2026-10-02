import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/apple_iap.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/glass_card.dart';
import 'paywall_sheet.dart';
import 'subscriptions_repository.dart';

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
      ref.invalidate(billingProvider);
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
      return SafeArea(child: _content(c, cached));
    }

    return SafeArea(
      child: billingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load your plan.\n$e',
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
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
            children: [
              Text('PLAN',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: c.accent)),
              const SizedBox(height: 4),
              Text('Subscription',
                  style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5)),
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
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      // A leading icon per row. Twelve lines of plain text read
                      // as a wall; an icon gives the eye somewhere to land and
                      // tells you what kind of thing each row is before you
                      // read it.
                      Icon(featureIcon(feature),
                          size: 17, color: c.inkSoft),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(feature,
                            style: TextStyle(
                                fontSize: 12.5, height: 1.25, color: c.inkMedium)),
                      ),
                      SizedBox(
                        width: 52,
                        child: Center(
                          child: freeFeatures.contains(feature)
                              ? Icon(Icons.check_rounded, size: 17, color: c.success)
                              : Icon(Icons.close_rounded,
                                  size: 17, color: c.inkMuted.withValues(alpha: 0.6)),
                        ),
                      ),
                      SizedBox(
                        width: 62,
                        child: Center(
                          child:
                              Icon(Icons.check_circle_rounded, size: 18, color: c.primary),
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
  bool _hasAccess(CurrentSub? cur) =>
      cur != null && cur.isActive && !cur.isFreePlan && !cur.isUnlimitedAccess;

  Widget _statusCard(AppColors c, CurrentSub? cur) {
    if (cur == null) {
      return _banner(c, c.inkSoft, Icons.info_outline_rounded, 'No active plan',
          'You have free access to the app.');
    }
    if (cur.isFreePlan || cur.isUnlimitedAccess) {
      return _banner(
          c,
          c.primary,
          Icons.verified_outlined,
          cur.planName.isEmpty ? 'Free access' : cur.planName,
          cur.isFreePlan
              ? 'You have full access — free of charge. Enjoy!'
              : 'You have full access.');
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
    // expired / cancelled / pending
    final label =
        cur.status == 'pending' ? 'Payment pending' : 'Plan ${cur.status}';
    final sub = cur.status == 'pending'
        ? 'Your payment is being confirmed.'
        : 'Your premium access has ended.';
    return _banner(c, const Color(0xFFDC2626), Icons.error_outline_rounded,
        cur.planName.isEmpty ? label : '${cur.planName} — $label', sub);
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

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
        decoration: BoxDecoration(
          gradient: kHeroGradient,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4F46E5).withValues(alpha: dark ? 0.34 : 0.22),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(children: [
                    const Icon(Icons.auto_awesome_rounded,
                        size: 14, color: Colors.white70),
                    const SizedBox(width: 6),
                    Text('Upgrade to Premium',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.2,
                            color: Colors.white.withValues(alpha: 0.88))),
                  ]),
                  const SizedBox(height: 8),
                  const Text('Unlock your full\nlearning potential',
                      style: TextStyle(
                          fontSize: 18,
                          height: 1.2,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                          color: Colors.white)),
                  const SizedBox(height: 8),
                  Text(
                    'Get access to all courses, practice questions, mock exams and more.',
                    style: TextStyle(
                        fontSize: 11.5,
                        height: 1.35,
                        color: Colors.white.withValues(alpha: 0.82)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const _CrownMark(size: 50),
            const SizedBox(width: 6),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chevron_right_rounded,
                  size: 20, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

/// The crown badge: a tilted card with a crown on it, drawn from two rounded
/// rectangles and an icon. Sparkles sit at the corners so it reads as a mark
/// rather than a button.
class _CrownMark extends StatelessWidget {
  final double size;
  const _CrownMark({required this.size});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // The card behind, tilted, to give the mark some depth.
          Transform.rotate(
            angle: -0.22,
            child: Container(
              width: size * 0.62,
              height: size * 0.72,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(size * 0.14),
                border: Border.all(color: Colors.white.withValues(alpha: 0.26)),
              ),
            ),
          ),
          Transform.rotate(
            angle: 0.12,
            child: Container(
              width: size * 0.58,
              height: size * 0.68,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withValues(alpha: 0.42),
                    Colors.white.withValues(alpha: 0.18),
                  ],
                ),
                borderRadius: BorderRadius.circular(size * 0.14),
                border: Border.all(color: Colors.white.withValues(alpha: 0.42)),
              ),
              child: Icon(Icons.workspace_premium_rounded,
                  size: size * 0.32, color: Colors.white),
            ),
          ),
          Positioned(
            top: 2,
            right: 4,
            child: Icon(Icons.auto_awesome_rounded,
                size: size * 0.18,
                color: Colors.white.withValues(alpha: 0.9)),
          ),
          Positioned(
            bottom: 4,
            left: 2,
            child: Icon(Icons.auto_awesome_rounded,
                size: size * 0.13,
                color: Colors.white.withValues(alpha: 0.7)),
          ),
        ],
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
