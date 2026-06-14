import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

/// Library of AI-generated lessons / notes.
class AiNotesListPage extends StatelessWidget {
  const AiNotesListPage({super.key});

  static const List<_Note> _notes = [
    _Note(
      title: 'Heart failure — pathophysiology',
      meta: '12 min read · Cardiology',
      icon: Icons.favorite_outline,
      tint: _Tint.rose,
    ),
    _Note(
      title: 'Acid–base balance & the ABG',
      meta: '9 min read · Nephrology',
      icon: Icons.science_outlined,
      tint: _Tint.teal,
    ),
    _Note(
      title: 'Antibiotics — mechanisms & cover',
      meta: '15 min read · Pharmacology',
      icon: Icons.medication_outlined,
      tint: _Tint.violet,
    ),
    _Note(
      title: 'The cranial nerves, simplified',
      meta: '11 min read · Neurology',
      icon: Icons.psychology_outlined,
      tint: _Tint.amber,
    ),
    _Note(
      title: 'Asthma vs COPD — the spirometry',
      meta: '8 min read · Respiratory',
      icon: Icons.air_outlined,
      tint: _Tint.sky,
    ),
    _Note(
      title: 'Type 2 diabetes — first-line care',
      meta: '13 min read · Endocrinology',
      icon: Icons.bloodtype_outlined,
      tint: _Tint.green,
    ),
    _Note(
      title: 'Reading the 12-lead ECG',
      meta: '17 min read · Cardiology',
      icon: Icons.monitor_heart_outlined,
      tint: _Tint.rose,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return SafeArea(
      child: AnimationLimiter(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
          children: AnimationConfiguration.toStaggeredList(
            duration: const Duration(milliseconds: 375),
            childAnimationBuilder: (w) => SlideAnimation(
              verticalOffset: 22,
              child: FadeInAnimation(child: w),
            ),
            children: [
              Text(
                'AI NOTES',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  color: c.accent,
                ),
              ),
              const SizedBox(height: AppSpace.x2),
              Text(
                'Lessons',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  color: c.inkStrong,
                ),
              ),
              const SizedBox(height: AppSpace.x4),
              TextField(
                style: TextStyle(color: c.inkStrong, fontSize: 15),
                cursorColor: c.primary,
                decoration: InputDecoration(
                  hintText: 'Search lessons & notes',
                  prefixIcon: Icon(Icons.search, color: c.inkSoft, size: 20),
                ),
              ),
              const SizedBox(height: AppSpace.x5),
              for (final note in _notes) ...[
                _NoteCard(note: note),
                const SizedBox(height: AppSpace.x3),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Subject palette key — resolves to a context color at build time.
enum _Tint { rose, teal, violet, amber, sky, green }

class _Note {
  final String title;
  final String meta;
  final IconData icon;
  final _Tint tint;

  const _Note({
    required this.title,
    required this.meta,
    required this.icon,
    required this.tint,
  });
}

class _NoteCard extends StatelessWidget {
  final _Note note;
  const _NoteCard({required this.note});

  Color _tintColor(AppColors c) {
    switch (note.tint) {
      case _Tint.rose:
        return c.error;
      case _Tint.teal:
        return c.accent;
      case _Tint.violet:
        return c.primary;
      case _Tint.amber:
        return c.warning;
      case _Tint.sky:
        return c.primaryHover;
      case _Tint.green:
        return c.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = _tintColor(c);

    return GlassCard(
      padding: const EdgeInsets.all(AppSpace.x4),
      onTap: () => context.push('/app/ai-notes/lesson-1'),
      child: Row(
        children: [
          Container(
            width: AppSpace.touch,
            height: AppSpace.touch,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(AppRadius.inner),
            ),
            child: Icon(note.icon, color: tint, size: 22),
          ),
          const SizedBox(width: AppSpace.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  note.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                    height: 1.25,
                    letterSpacing: -0.2,
                    color: c.inkStrong,
                  ),
                ),
                const SizedBox(height: AppSpace.x1),
                Text(
                  note.meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: c.inkSoft,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpace.x2),
          Icon(Icons.bookmark_border, color: c.inkMuted, size: 22),
        ],
      ),
    );
  }
}
