import 'package:flutter/widgets.dart';

/// Keeps a two- or three-option switch (Practice / Exam, Course decks /
/// My Flashcards, Full course / Subjects / Lessons) a compact size on iPad,
/// centred on the page, instead of each option taking half the
/// screen (2026-11-17). A phone is narrower than [maxWidth], so it is unchanged.
class CompactSwitch extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  const CompactSwitch({super.key, required this.child, this.maxWidth = 380});

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.center,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      );
}
