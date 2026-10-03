import 'package:flutter/material.dart';

import '../../../theme/tokens.dart';

/// Shared chrome for the drill-down screens, so course, subject and station
/// lists are visibly the same kind of page rather than three different designs.
class OsceScaffold extends StatelessWidget {
  final String eyebrow;
  final String title;
  final List<Widget> children;
  const OsceScaffold({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 16, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: Icon(Icons.chevron_left_rounded, size: 30, color: c.inkStrong),
                  ),
                  Expanded(
                    child: Text(eyebrow,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 11,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w800,
                            color: c.accent)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
                children: [
                  Text(title,
                      style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                          color: c.inkStrong)),
                  const SizedBox(height: 16),
                  ...children,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One tappable row in the drill-down.
class OsceRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool locked;
  final VoidCallback onTap;
  const OsceRow({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.locked = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: locked ? () => showLockedNote(context) : onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: c.card,
          borderRadius: BorderRadius.circular(AppRadius.inner),
          border: Border.all(color: c.line),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: c.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, size: 20, color: c.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: c.inkStrong)),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
                ],
              ),
            ),
            if (locked)
              Icon(Icons.lock_outline_rounded, size: 17, color: c.warning)
            else
              Icon(Icons.chevron_right_rounded, color: c.inkMuted),
          ],
        ),
      ),
    );
  }
}

/// Why something is locked, said plainly. The server refuses these anyway —
/// letting a student tap through to an error told them nothing.
void showLockedNote(BuildContext context) {
  final c = context.c;
  showModalBottomSheet<void>(
    useRootNavigator: true,
    context: context,
    backgroundColor: c.surface1,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.lock_outline_rounded, size: 20, color: c.warning),
              const SizedBox(width: 9),
              Text('Not in your plan',
                  style: TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'This station belongs to a course your current subscription '
            'doesn\'t cover. Upgrading or enrolling in that course unlocks it.',
            style: TextStyle(fontSize: 14, height: 1.55, color: c.inkMedium),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Close'),
            ),
          ),
        ],
      ),
    ),
  );
}

class OsceLoading extends StatelessWidget {
  const OsceLoading({super.key});
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(top: 50),
        child: Center(child: CircularProgressIndicator()),
      );
}

class OsceEmptyNote extends StatelessWidget {
  final String title;
  final String body;
  const OsceEmptyNote({super.key, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Column(
        children: [
          Icon(Icons.medical_services_outlined, size: 46, color: c.inkMuted),
          const SizedBox(height: 12),
          Text(title,
              style: TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w700, color: c.inkStrong)),
          const SizedBox(height: 6),
          Text(body,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, color: c.inkSoft)),
        ],
      ),
    );
  }
}

class OsceErrorNote extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const OsceErrorNote({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Column(
        children: [
          Text(message, style: TextStyle(fontSize: 14, color: c.inkMedium)),
          const SizedBox(height: 10),
          TextButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
