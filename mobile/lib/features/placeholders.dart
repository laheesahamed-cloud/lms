import 'package:flutter/material.dart';
import '../theme/tokens.dart';
import '../widgets/glass_card.dart';

/// Generic destination for screens being built in later phases (T5+).
class PlaceholderPage extends StatelessWidget {
  final String title;
  final IconData icon;
  const PlaceholderPage({super.key, required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong,
                    letterSpacing: -0.5)),
            const SizedBox(height: 18),
            Expanded(
              child: Center(
                child: GlassCard(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 34),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, size: 46, color: c.accent),
                      const SizedBox(height: 14),
                      Text('$title screen',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                      const SizedBox(height: 6),
                      Text('Built in the next phase — wired to the same backend.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
