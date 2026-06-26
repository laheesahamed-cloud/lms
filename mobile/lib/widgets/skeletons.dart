import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/tokens.dart';

/// Theme-aware shimmer wrapper. The placeholder shapes inside are opaque; the
/// shimmer sweeps a base→highlight gradient across them.
class _Shimmer extends StatelessWidget {
  final Widget child;
  const _Shimmer({required this.child});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Shimmer.fromColors(
      baseColor: c.surface2,
      highlightColor: c.cardElevated,
      child: child,
    );
  }
}

Widget _bar({double? width, double height = 12, double radius = 6}) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(radius)),
    );

/// Skeleton for a single lesson / AI note while its content loads.
class NoteSkeleton extends StatelessWidget {
  const NoteSkeleton({super.key});
  @override
  Widget build(BuildContext context) {
    return _Shimmer(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
        children: [
          _bar(width: 210, height: 24, radius: 8), // title
          const SizedBox(height: 10),
          _bar(width: 130, height: 13, radius: 6), // subtitle
          const SizedBox(height: 22),
          for (int i = 0; i < 5; i++) ...[
            _bar(height: 12),
            const SizedBox(height: 11),
          ],
          _bar(width: 240, height: 12),
          const SizedBox(height: 22),
          _bar(height: 150, radius: 14), // a content block (image/diagram)
          const SizedBox(height: 22),
          for (int i = 0; i < 4; i++) ...[
            _bar(height: 12),
            const SizedBox(height: 11),
          ],
          _bar(width: 180, height: 12),
        ],
      ),
    );
  }
}

/// Skeleton rows for the AI notes list while it loads.
class NoteListSkeleton extends StatelessWidget {
  final int count;
  const NoteListSkeleton({super.key, this.count = 6});
  @override
  Widget build(BuildContext context) {
    return _Shimmer(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          for (int i = 0; i < count; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _bar(height: 78, radius: 16),
            ),
        ],
      ),
    );
  }
}
