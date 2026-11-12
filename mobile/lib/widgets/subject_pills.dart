import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The row of pill filters used on the Q-bank and Lesson course screens: one
/// "All ..." pill, then one pill per subject. The chosen pill is solid blue.
///
/// One widget for both screens, so they cannot drift apart.
///
/// [onTap] gets the tapped subject, or null for the "All" pill. It does not
/// decide what tapping the chosen pill again means; each screen toggles.
class SubjectPills extends StatelessWidget {
  /// Text of the first pill, for example "All subjects".
  final String allLabel;
  final List<String> labels;

  /// The chosen subject, or null when "All" is chosen.
  final String? selected;
  final ValueChanged<String?> onTap;
  const SubjectPills({
    super.key,
    required this.allLabel,
    required this.labels,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget pill(String label, bool active, VoidCallback onTap) => GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: AppDur.hover,
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: active ? c.primary : c.surface2,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: active ? c.primary : c.line),
            ),
            child: Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: active ? Colors.white : c.inkMedium)),
          ),
        );

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          pill(allLabel, selected == null, () => onTap(null)),
          for (final label in labels)
            pill(label, selected == label, () => onTap(label)),
        ],
      ),
    );
  }
}

/// Holds a [SubjectPills] row at the top of the screen while the content
/// scrolls beneath. Painted on the page colour, with a hairline that appears
/// once content is actually sliding under it.
class PinnedPillsDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  const PinnedPillsDelegate({required this.child});

  static const double _height = 56;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final c = context.c;
    return Container(
      height: _height,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: c.page,
        border: Border(
          bottom: BorderSide(
            color: overlapsContent ? c.line : Colors.transparent,
          ),
        ),
      ),
      child: child,
    );
  }

  @override
  bool shouldRebuild(covariant PinnedPillsDelegate oldDelegate) => true;
}
