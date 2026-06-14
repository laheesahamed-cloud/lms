import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

class _Note {
  final IconData icon;
  final Color Function(AppColors) tint;
  final String title;
  final String body;
  final String time;
  final bool unread;
  const _Note(this.icon, this.tint, this.title, this.body, this.time,
      {this.unread = false});
}

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  static final List<_Note> _items = [
    _Note(Icons.local_fire_department_rounded, (c) => c.warning, 'Streak alert',
        'You have 8 flashcards due today. Keep your 14-day streak!', 'Just now',
        unread: true),
    _Note(Icons.fact_check_outlined, (c) => c.accent, 'New quiz added',
        'Cardiology — Heart failure (20 questions) is now live.', '2h ago',
        unread: true),
    _Note(Icons.workspace_premium_outlined, (c) => c.primary, 'Exam reminder',
        'Renal mock exam closes tomorrow at 9:00 PM.', 'Yesterday'),
    _Note(Icons.school_outlined, (c) => c.success, 'Result ready',
        'Your Endocrine practice was graded — 64%.', '2 days ago'),
    _Note(Icons.campaign_outlined, (c) => c.inkSoft, 'Announcement',
        'New AI-notes for Respiratory have been published.', '3 days ago'),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('Notifications',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.5)),
          const SizedBox(height: 18),
          AnimationLimiter(
            child: Column(
              children: AnimationConfiguration.toStaggeredList(
                duration: const Duration(milliseconds: 360),
                childAnimationBuilder: (w) => SlideAnimation(
                    verticalOffset: 20, child: FadeInAnimation(child: w)),
                children: [
                  for (final n in _items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GlassCard(
                        onTap: () {},
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: n.tint(c).withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(n.icon, size: 20, color: n.tint(c)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(n.title,
                                            style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w800,
                                                color: c.inkStrong)),
                                      ),
                                      if (n.unread)
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                              color: c.primary,
                                              shape: BoxShape.circle),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(n.body,
                                      style: TextStyle(
                                          fontSize: 12.5,
                                          height: 1.4,
                                          color: c.inkSoft)),
                                  const SizedBox(height: 5),
                                  Text(n.time,
                                      style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: c.inkMuted)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
