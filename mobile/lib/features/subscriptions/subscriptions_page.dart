import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../theme/tokens.dart';
import '../../config/app_config.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../state/auth_controller.dart';

class _Plan {
  final String id;
  final String name;
  final String price;
  final String period;
  final List<String> perks;
  final bool popular;
  const _Plan(this.id, this.name, this.price, this.period, this.perks,
      {this.popular = false});
}

class SubscriptionsPage extends ConsumerWidget {
  const SubscriptionsPage({super.key});

  static const _plans = [
    _Plan('free', 'Free', 'Rs 0', 'forever', [
      'Practice mode (limited)',
      'Sample AI notes',
      'Basic progress',
    ]),
    _Plan('pro-monthly', 'Pro', 'Rs 1,490', 'per month', [
      'Unlimited Q-Bank & exams',
      'All AI notes & flashcards',
      'Full analytics & planner',
      'Offline notes',
    ], popular: true),
    _Plan('pro-annual', 'Pro Annual', 'Rs 12,900', 'per year', [
      'Everything in Pro',
      'Save 28% vs monthly',
      'Priority new content',
    ]),
  ];

  Future<void> _checkout(BuildContext context, String planId) async {
    final uri = Uri.parse(AppConfig.checkoutUrl(planId));
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open the checkout page.')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final current = (ref.watch(authControllerProvider).user?.plan ?? 'free')
        .toLowerCase();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('PLANS',
              style: TextStyle(
                  fontSize: 11.5,
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
          const SizedBox(height: 6),
          Text('Upgrade unlocks the full question bank, AI notes and analytics.',
              style: TextStyle(fontSize: 13.5, color: c.inkSoft)),
          const SizedBox(height: 18),
          for (final p in _plans) ...[
            _PlanCard(
              plan: p,
              isCurrent: current.contains(p.id.split('-').first) &&
                  (p.id == 'free') == (current == 'free'),
              onChoose: () => _checkout(context, p.id),
            ),
            const SizedBox(height: 14),
          ],
          const SizedBox(height: 4),
          Text(
            'Payments are handled securely in your browser via PayHere.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11.5, color: c.inkMuted),
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final _Plan plan;
  final bool isCurrent;
  final VoidCallback onChoose;
  const _PlanCard(
      {required this.plan, required this.isCurrent, required this.onChoose});

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
              Text(plan.name,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const SizedBox(width: 8),
              if (plan.popular)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                      color: c.primaryTint,
                      borderRadius: BorderRadius.circular(99)),
                  child: Text('MOST POPULAR',
                      style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                          color: c.primary)),
                ),
              const Spacer(),
              if (isCurrent)
                Text('Current',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: c.success)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(plan.price,
                  style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5)),
              const SizedBox(width: 6),
              Text(plan.period,
                  style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
            ],
          ),
          const SizedBox(height: 12),
          for (final perk in plan.perks)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                children: [
                  Icon(Icons.check_circle_rounded,
                      size: 17, color: c.success),
                  const SizedBox(width: 9),
                  Expanded(
                      child: Text(perk,
                          style:
                              TextStyle(fontSize: 13, color: c.inkMedium))),
                ],
              ),
            ),
          if (plan.id != 'free') ...[
            const SizedBox(height: 8),
            AppButton(
              isCurrent ? 'Manage' : 'Upgrade',
              kind: plan.popular
                  ? AppButtonKind.primary
                  : AppButtonKind.soft,
              expand: true,
              onPressed: onChoose,
            ),
          ],
        ],
      ),
    );
  }
}
