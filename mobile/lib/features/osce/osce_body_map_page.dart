import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'osce_repository.dart';
import 'widgets/osce_shell.dart';

/// The second way into a station: start from the body, not the syllabus.
///
/// Course → subject → station is how content is *filed*; it isn't how a patient
/// presents. Here you start where the abnormality is — something odd in this
/// neck — and get the stations whose findings sit there. Regions come from each
/// sign's own `region`, so this needs no separate authoring.
///
/// The figure is drawn, not an asset: it has to work in both themes and at any
/// size, and a schematic body is clearer for tapping than an illustration.
class OsceBodyMapPage extends ConsumerStatefulWidget {
  const OsceBodyMapPage({super.key});

  @override
  ConsumerState<OsceBodyMapPage> createState() => _OsceBodyMapPageState();
}

class _OsceBodyMapPageState extends ConsumerState<OsceBodyMapPage> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(osceRegionsProvider);

    return OsceScaffold(
      eyebrow: 'BODY MAP',
      title: 'Where is the finding?',
      children: [
        async.when(
          loading: () => const OsceLoading(),
          error: (err, _) => OsceErrorNote(
            message: 'Could not load the body map.',
            onRetry: () => ref.invalidate(osceRegionsProvider),
          ),
          data: (regions) {
            if (regions.isEmpty) {
              return const OsceEmptyNote(
                title: 'Nothing to map yet',
                body: 'Examination stations appear here once they are published.',
              );
            }

            final byKey = {for (final r in regions) r.key: r};
            final selected = _selected != null ? byKey[_selected] : null;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tap a region to see the stations with findings there. '
                  'A station appears under every region it touches.',
                  style: TextStyle(fontSize: 13, height: 1.5, color: c.inkSoft),
                ),
                const SizedBox(height: 16),

                Center(
                  child: _BodyFigure(
                    regions: byKey,
                    selected: _selected,
                    onTap: (key) {
                      HapticFeedback.selectionClick();
                      setState(() => _selected = _selected == key ? null : key);
                    },
                  ),
                ),
                const SizedBox(height: 18),

                // Regions with no zone on the figure ("whole patient") still need
                // a way in, and the row doubles as a legend for what's populated.
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    for (final region in regions)
                      _RegionChip(
                        label: region.label,
                        count: region.caseCount,
                        selected: _selected == region.key,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() =>
                              _selected = _selected == region.key ? null : region.key);
                        },
                      ),
                  ],
                ),

                if (selected != null) ...[
                  const SizedBox(height: 20),
                  Text(selected.label.toUpperCase(),
                      style: TextStyle(
                          fontSize: 10.5,
                          letterSpacing: 1.1,
                          fontWeight: FontWeight.w800,
                          color: c.accent)),
                  const SizedBox(height: 10),
                  for (final item in selected.cases)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: OsceRow(
                        icon: Icons.medical_information_outlined,
                        title: item.title,
                        subtitle: item.summary.isEmpty
                            ? 'Examination station'
                            : item.summary,
                        locked: item.locked,
                        onTap: () => context.push(
                            '/app/osce/${item.slug}?type=${item.stationType}'),
                      ),
                    ),
                ] else ...[
                  const SizedBox(height: 18),
                  Text('Pick a region above to list its stations.',
                      style: TextStyle(fontSize: 13, color: c.inkMuted)),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}

/// The tappable figure. Zones are fractions of the drawing, so the same layout
/// holds at any width.
class _BodyFigure extends StatelessWidget {
  final Map<String, OsceRegion> regions;
  final String? selected;
  final ValueChanged<String> onTap;
  const _BodyFigure({
    required this.regions,
    required this.selected,
    required this.onTap,
  });

  // key, centre x, centre y, radius — all as fractions of the box.
  static const List<(String, double, double, double)> _zones = [
    ('head', 0.50, 0.075, 0.085),
    ('neck', 0.50, 0.165, 0.055),
    ('chest', 0.50, 0.290, 0.115),
    ('abdomen', 0.50, 0.450, 0.105),
    ('groin', 0.50, 0.565, 0.070),
    ('hands', 0.175, 0.430, 0.080),
    ('legs', 0.395, 0.810, 0.090),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      width: 210,
      height: 420,
      child: LayoutBuilder(
        builder: (context, box) {
          final w = box.maxWidth;
          final h = box.maxHeight;
          return Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _BodyPainter(
                    outline: c.lineMedium,
                    fill: c.surface2,
                  ),
                ),
              ),
              for (final (key, fx, fy, fr) in _zones)
                if (regions.containsKey(key))
                  Positioned(
                    left: fx * w - fr * w,
                    top: fy * h - fr * w,
                    width: fr * 2 * w,
                    height: fr * 2 * w,
                    child: _Zone(
                      count: regions[key]!.caseCount,
                      selected: selected == key,
                      onTap: () => onTap(key),
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }
}

class _Zone extends StatelessWidget {
  final int count;
  final bool selected;
  final VoidCallback onTap;
  const _Zone({required this.count, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Same convention as the long case's next bar: the primary fill is light in
    // dark mode, so text on it flips rather than always being white.
    final onPrimary = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF04121F)
        : Colors.white;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: AppDur.micro,
        curve: AppCurves.standard,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected
              ? c.primary.withValues(alpha: 0.85)
              : c.primary.withValues(alpha: 0.18),
          border: Border.all(
            color: selected ? c.primary : c.primary.withValues(alpha: 0.40),
            width: selected ? 2 : 1.5,
          ),
        ),
        child: Text('$count',
            style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: selected ? onPrimary : c.primary)),
      ),
    );
  }
}

/// A schematic front-facing figure — head, torso, arms, legs. Deliberately plain:
/// it's a target for tapping and a sense of place, not an illustration.
class _BodyPainter extends CustomPainter {
  final Color outline;
  final Color fill;
  _BodyPainter({required this.outline, required this.fill});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final body = Paint()..color = fill..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = outline
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;

    void draw(Path path) {
      canvas.drawPath(path, body);
      canvas.drawPath(path, stroke);
    }

    // head
    draw(Path()..addOval(Rect.fromCircle(
        center: Offset(w * 0.5, h * 0.075), radius: w * 0.105)));

    // neck
    draw(Path()..addRRect(RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(w * 0.5, h * 0.155), width: w * 0.10, height: h * 0.05),
        Radius.circular(w * 0.02))));

    // torso — shoulders tapering to the waist
    draw(Path()
      ..moveTo(w * 0.29, h * 0.205)
      ..lineTo(w * 0.71, h * 0.205)
      ..lineTo(w * 0.66, h * 0.520)
      ..lineTo(w * 0.34, h * 0.520)
      ..close());

    // arms
    for (final side in [-1, 1]) {
      final x = w * (0.5 + side * 0.225);
      draw(Path()..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(
              center: Offset(x, h * 0.345), width: w * 0.105, height: h * 0.30),
          Radius.circular(w * 0.05))));
    }

    // legs
    for (final side in [-1, 1]) {
      final x = w * (0.5 + side * 0.105);
      draw(Path()..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(
              center: Offset(x, h * 0.760), width: w * 0.145, height: h * 0.44),
          Radius.circular(w * 0.06))));
    }
  }

  @override
  bool shouldRepaint(_BodyPainter old) =>
      old.outline != outline || old.fill != fill;
}

class _RegionChip extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  const _RegionChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? c.primary.withValues(alpha: 0.14) : c.card,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: selected ? c.primary.withValues(alpha: 0.45) : c.line),
        ),
        child: Text('$label · $count',
            style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: selected ? c.primary : c.inkMedium)),
      ),
    );
  }
}
