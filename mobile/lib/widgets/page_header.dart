import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// One title, on the chevron's own row — the header My Notes has always used.
///
/// The study tools each carried a stacked eyebrow ("STUDY TOOL") above a 28pt
/// title, under a separate chevron bar, which spent three rows saying what one
/// row says. [actions] keeps a screen's own controls — a filter dropdown, a
/// reminders bell — in that same row rather than below it.
class PageHeader extends StatelessWidget {
  final String title;
  final List<Widget> actions;
  const PageHeader({super.key, required this.title, this.actions = const []});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Reached from the side rail there is nothing to pop, and a dead chevron is
    // worse than none.
    final canBack = Navigator.of(context).canPop();
    return Row(
      children: [
        if (canBack)
          IconButton(
            tooltip: 'Back',
            onPressed: () => Navigator.of(context).maybePop(),
            icon: Icon(Icons.arrow_back_ios_new_rounded,
                size: 18, color: c.inkMedium),
          ),
        Expanded(
          child: Text(title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
        ),
        ...actions,
      ],
    );
  }
}
