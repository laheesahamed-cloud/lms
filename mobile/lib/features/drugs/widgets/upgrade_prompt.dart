import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../theme/tokens.dart';

class UpgradePrompt extends StatelessWidget {
  final int freeLimit;
  const UpgradePrompt({super.key, required this.freeLimit});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          28, 32, 28, 32 + MediaQuery.of(context).padding.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🎲', style: TextStyle(fontSize: 52)),
          const SizedBox(height: 16),
          Text(
            "You've used all $freeLimit free spins",
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700,
                color: c.inkStrong, letterSpacing: -0.3),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Text(
            'Subscribe to get unlimited access to the Drug Randomizer and all study tools.',
            style: TextStyle(fontSize: 15, color: c.inkSoft, height: 1.55),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                Navigator.pop(context);
                context.go('/app/subscriptions');
              },
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('View Plans',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Students with an active subscription get unlimited spins.',
            style: TextStyle(fontSize: 12, color: c.inkMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
