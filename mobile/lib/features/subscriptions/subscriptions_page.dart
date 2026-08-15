import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
        data: (billing) => RefreshIndicator(
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
                  'View plans',
                  expand: true,
                  onPressed: () async {
                    final granted = await PaywallSheet.show(context);
                    if (granted) ref.invalidate(billingProvider);
                  },
                ),
              ],
              const SizedBox(height: 18),
              if (billing.plans.isNotEmpty)
                Text("What's included",
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
              const SizedBox(height: 10),
              for (final p in billing.plans.take(4)) ...[
                _PlanCard(
                  plan: p,
                  isCurrent: billing.current != null &&
                      billing.current!.isActive &&
                      billing.current!.planName.trim().toLowerCase() ==
                          p.name.trim().toLowerCase(),
                ),
                const SizedBox(height: 14),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// True when the user already has something that unlocks content, so the
  /// paywall should stay hidden.
  bool _hasAccess(CurrentSub? cur) =>
      cur != null && (cur.isActive || cur.isFreePlan || cur.isUnlimitedAccess);

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

/// Informational plan card — name, description, and feature bullets only.
/// Deliberately shows NO price and NO purchase button (access-only).
class _PlanCard extends StatelessWidget {
  final SubPlan plan;
  final bool isCurrent;
  const _PlanCard({required this.plan, required this.isCurrent});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Flexible(
                child: Text(plan.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
              ),
              const SizedBox(width: 8),
              if (plan.recommended)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                      color: c.primaryTint,
                      borderRadius: BorderRadius.circular(99)),
                  child: Text('RECOMMENDED',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                          color: c.primary)),
                ),
              const Spacer(),
              if (isCurrent)
                Text('Current',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: c.success)),
            ],
          ),
          if (plan.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(plan.description,
                style: TextStyle(fontSize: 13, color: c.inkSoft)),
          ],
          const SizedBox(height: 12),
          for (final feat in plan.features.take(8))
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                children: [
                  Icon(Icons.check_circle_rounded, size: 17, color: c.success),
                  const SizedBox(width: 9),
                  Expanded(
                      child: Text(feat,
                          style:
                              TextStyle(fontSize: 14, color: c.inkMedium))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
