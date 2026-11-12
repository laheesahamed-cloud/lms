import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The two flashcard sections side by side: the course decks and the
/// student's own. Sits at the top of both pages so each is one tap from the
/// other, however long either list gets.
class FlashcardsSwitch extends StatelessWidget {
  /// true = "My Flashcards" is the open side.
  final bool mine;
  final ValueChanged<bool> onChanged;
  const FlashcardsSwitch({super.key, required this.mine, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget tab(String label, bool on, VoidCallback onTap) => Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: on ? null : onTap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              padding: const EdgeInsets.symmetric(vertical: 9),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: on ? c.card : Colors.transparent,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: on ? c.lineMedium : Colors.transparent),
              ),
              child: Text(label,
                  style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: on ? c.inkStrong : c.inkSoft)),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          tab('Course decks', !mine, () => onChanged(false)),
          tab('My Flashcards', mine, () => onChanged(true)),
        ],
      ),
    );
  }
}
