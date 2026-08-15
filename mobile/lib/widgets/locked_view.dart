import 'package:flutter/material.dart';
import '../data/apple_iap.dart';
import '../features/subscriptions/paywall_sheet.dart';
import '../theme/tokens.dart';
import 'app_button.dart';

/// Shown in place of gated content the user's subscription doesn't include.
///
/// On iOS this offers a **View plans** button that opens the in-app purchase
/// sheet. That path is not optional: build 1.0.0 (1) was rejected under
/// Guideline 3.1.1 precisely because this screen was a dead end once the trial
/// ended, with no way to subscribe inside the app.
///
/// On Android (no Play Billing wired) it stays informational, and it still never
/// shows a price or a link to pay on the website.
class LockedView extends StatelessWidget {
  final String reason;
  final String title;

  /// Called after access is granted, so the host screen can reload the content
  /// that was locked.
  final VoidCallback? onUnlocked;

  const LockedView({
    super.key,
    required this.reason,
    this.title = 'Locked',
    this.onUnlocked,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 66,
              height: 66,
              decoration:
                  BoxDecoration(color: c.primaryTint, shape: BoxShape.circle),
              child: Icon(Icons.lock_outline_rounded, size: 31, color: c.primary),
            ),
            const SizedBox(height: 18),
            Text(title,
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 8),
            Text(
                reason.isEmpty
                    ? 'This is included with a subscription.'
                    : reason,
                textAlign: TextAlign.center,
                style:
                    TextStyle(fontSize: 15.5, height: 1.45, color: c.inkSoft)),
            if (iapSupported) ...[
              const SizedBox(height: 20),
              SizedBox(
                width: 200,
                child: AppButton(
                  'View plans',
                  onPressed: () async {
                    final granted = await PaywallSheet.show(context);
                    if (granted) onUnlocked?.call();
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
