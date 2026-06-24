import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// Shown in place of gated content when the user's subscription doesn't include
/// it. Access-only: it explains that the content needs a subscription, with NO
/// price, purchase button, or link — subscriptions are managed on the website,
/// outside the app (Apple 3.1.1 / Google Play billing compliant).
class LockedView extends StatelessWidget {
  final String reason;
  final String title;
  const LockedView({super.key, required this.reason, this.title = 'Locked'});

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
          ],
        ),
      ),
    );
  }
}
