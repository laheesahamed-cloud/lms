import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

class _Saved {
  final String type; // Quiz, Exam, Note, Question
  final IconData icon;
  final String title;
  final String subject;
  const _Saved(this.type, this.icon, this.title, this.subject);
}

class BookmarksPage extends StatefulWidget {
  const BookmarksPage({super.key});
  @override
  State<BookmarksPage> createState() => _BookmarksPageState();
}

class _BookmarksPageState extends State<BookmarksPage> {
  String _filter = 'All';
  static const _filters = ['All', 'Quiz', 'Note', 'Question'];

  static const _items = [
    _Saved('Quiz', Icons.fact_check_outlined, 'Arrhythmias — rapid review',
        'Cardiology'),
    _Saved('Note', Icons.description_outlined, 'Heart failure pathophysiology',
        'Cardiology'),
    _Saved('Question', Icons.help_outline_rounded,
        'Which artery supplies the SA node?', 'Cardiology'),
    _Saved('Note', Icons.description_outlined, 'Acid–base step-by-step',
        'Renal'),
    _Saved('Quiz', Icons.fact_check_outlined, 'COPD vs asthma', 'Respiratory'),
    _Saved('Question', Icons.help_outline_rounded,
        'First-line for status epilepticus?', 'Neurology'),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final items = _filter == 'All'
        ? _items
        : _items.where((e) => e.type == _filter).toList();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('Saved',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.5)),
          const SizedBox(height: 14),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final f in _filters)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() => _filter = f),
                      child: AnimatedContainer(
                        duration: AppDur.micro,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _filter == f ? c.primaryTint : c.cardElevated,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(f,
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: _filter == f ? c.primary : c.inkSoft)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AnimationLimiter(
            child: Column(
              children: AnimationConfiguration.toStaggeredList(
                duration: const Duration(milliseconds: 320),
                childAnimationBuilder: (w) => SlideAnimation(
                    verticalOffset: 18, child: FadeInAnimation(child: w)),
                children: [
                  for (final s in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GlassCard(
                        onTap: () {},
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: c.surface2,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(s.icon, size: 20, color: c.accent),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(s.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: c.inkStrong)),
                                  const SizedBox(height: 2),
                                  Text('${s.type} · ${s.subject}',
                                      style: TextStyle(
                                          fontSize: 12, color: c.inkSoft)),
                                ],
                              ),
                            ),
                            Icon(Icons.bookmark_rounded,
                                size: 20, color: c.primary),
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
