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
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
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
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5)),
              const SizedBox(height: 12),
              _statusCard(c, billing.current),
              // Only offer a purchase when there is nothing active to buy over —
              // an existing subscriber seeing "Subscribe" would risk paying twice.
              if (iapSupported && !_hasAccess(billing.current)) ...[
                const SizedBox(height: 14),
                AppButton(
                  'Unlock full access',
                  kind: AppButtonKind.cta,
                  expand: true,
                  onPressed: () async {
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

              const SizedBox(height: 22),
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
                fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const SizedBox(height: 12),
        GlassCard(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
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
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(feature,
                            style: TextStyle(
                                fontSize: 13.5, height: 1.3, color: c.inkMedium)),
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
