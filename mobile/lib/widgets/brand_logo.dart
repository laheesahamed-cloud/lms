import 'package:flutter/material.dart';

/// The xyndrome mark — dark-mode logo (the student app runs dark by default).
class BrandLogo extends StatelessWidget {
  final double size;
  const BrandLogo({super.key, this.size = 44});

  @override
  Widget build(BuildContext context) {
    return Image.asset('assets/brand/xyndrome-logo-mark-dark.webp',
        width: size, height: size, fit: BoxFit.contain);
  }
}

class BrandWordmark extends StatelessWidget {
  final double logoSize;
  const BrandWordmark({super.key, this.logoSize = 30});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        BrandLogo(size: logoSize),
        const SizedBox(width: 9),
        const Text(
          'xyndrome',
          style: TextStyle(
              fontWeight: FontWeight.w800, fontSize: 18, letterSpacing: -0.4),
        ),
      ],
    );
  }
}
