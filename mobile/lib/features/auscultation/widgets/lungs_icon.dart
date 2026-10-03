import 'package:flutter/material.dart';

/// A lungs glyph, drawn rather than picked.
///
/// Flutter's bundled Material set has no lungs icon — the nearest candidates
/// are `air` (wind lines), `masks` (PPE) and `coronavirus`, none of which is an
/// organ. This matches the filled weight of `Icons.favorite_rounded` beside it
/// so Heart and Lung read as a pair.
class LungsIcon extends StatelessWidget {
  final double size;
  final Color color;
  const LungsIcon({super.key, this.size = 16, required this.color});

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _LungsPainter(color)),
      );
}

class _LungsPainter extends CustomPainter {
  final Color color;
  const _LungsPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    // Authored on a 24-unit grid, like the Material icons themselves.
    final s = size.width / 24.0;
    canvas.save();
    canvas.scale(s);

    final paint = Paint()
      ..color = color
      ..isAntiAlias = true;

    // Trachea, running down to where the lobes meet it.
    canvas.drawRRect(
      RRect.fromLTRBR(11.1, 3.0, 12.9, 10.8, const Radius.circular(0.9)),
      paint,
    );

    // Each lobe: nearly straight where it meets the trachea, round everywhere
    // else, and deeper than it is wide — the shape of the organ rather than a
    // symmetric blob.
    RRect lobe({required bool left}) => RRect.fromLTRBAndCorners(
          left ? 4.6 : 12.6,
          8.4,
          left ? 11.4 : 19.4,
          20.6,
          topLeft: Radius.circular(left ? 3.4 : 0.9),
          topRight: Radius.circular(left ? 0.9 : 3.4),
          bottomLeft: const Radius.circular(3.2),
          bottomRight: const Radius.circular(3.2),
        );

    // The lobes go into a layer of their own so the notch between them can be
    // cut back out — BlendMode.clear only erases within the layer it is drawn
    // into, so painting them straight onto the canvas would leave the notch
    // with nothing to bite and the three shapes would fuse into one mass.
    canvas.saveLayer(const Rect.fromLTRB(0, 0, 24, 24), Paint());
    canvas.drawRRect(lobe(left: true), paint);
    canvas.drawRRect(lobe(left: false), paint);
    canvas.drawRRect(
      RRect.fromLTRBR(11.0, 11.4, 13.0, 21.4, const Radius.circular(1.0)),
      Paint()..blendMode = BlendMode.clear,
    );
    canvas.restore();

    canvas.restore();
  }

  @override
  bool shouldRepaint(_LungsPainter old) => old.color != color;
}
