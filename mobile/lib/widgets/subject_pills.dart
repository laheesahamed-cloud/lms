import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The row of pill filters used on the Q-bank and Lesson course screens: one
/// "All ..." pill, then one pill per subject. The chosen pill is solid blue.
///
/// One widget for both screens, so they cannot drift apart.
///
/// [onTap] gets the tapped subject, or null for the "All" pill. It does not
/// decide what tapping the chosen pill again means; each screen toggles.
class SubjectPills extends StatefulWidget {
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
  State<SubjectPills> createState() => _SubjectPillsState();
}

class _SubjectPillsState extends State<SubjectPills> {
  // One key per pill, so a chosen pill can be slid into view.
  final Map<String, GlobalKey> _keys = {};
  final ScrollController _scroll = ScrollController();
  final GlobalKey _rowKey = GlobalKey();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }
  GlobalKey _keyFor(String label) => _keys.putIfAbsent(label, GlobalKey.new);

  @override
  void didUpdateWidget(covariant SubjectPills old) {
    super.didUpdateWidget(old);
    // Choosing a subject slides the row left until the chosen pill is the
    // first one in view, like the series cards on the full-course shelf
    // (2026-11-17).
    if (widget.selected != old.selected && widget.selected != null) {
      final key = _keyFor(widget.selected!);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // Only the pill row moves — not the page around it.
        final pill = key.currentContext?.findRenderObject() as RenderBox?;
        final row = _rowKey.currentContext?.findRenderObject() as RenderBox?;
        if (pill == null || row == null || !mounted || !_scroll.hasClients) return;
        final x = pill.localToGlobal(Offset.zero, ancestor: row).dx;
        _scroll.animateTo(x.clamp(0.0, _scroll.position.maxScrollExtent).toDouble(),
            duration: const Duration(milliseconds: 420), curve: Curves.easeInOutCubic);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget pill(String label, bool active, VoidCallback onTap, {Key? key}) => GestureDetector(
          key: key,
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
      controller: _scroll,
      scrollDirection: Axis.horizontal,
      child: Row(
        key: _rowKey,
        children: [
          // An empty allLabel = no "All" pill (one group at a time).
          if (widget.allLabel.isNotEmpty)
            pill(widget.allLabel, widget.selected == null, () => widget.onTap(null)),
          for (final label in widget.labels)
            pill(label, widget.selected == label, () => widget.onTap(label),
                key: _keyFor(label)),
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
