import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// Frosted-glass card (dark) / flat gradient card (light), matching §4.2.
/// Dark = backdrop blur(18) + cool-grey gradient over #16181F + soft shadow.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = AppRadius.card,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    final gradient = dark
        ? const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0x13C8D2DC), Color(0x0AB4C3D2), Color(0x04A0AFBE)],
          )
        // Light = solid white card (Apple grouped look), not glass.
        : const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
          );

    final inner = Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        color: dark ? const Color(0xDB1C1E26) : null,
        // Dark separates via glass + deep shadow; light via a soft neutral
        // shadow that lifts the white card off the gray page (Apple HIG).
        boxShadow: [
          dark
              ? const BoxShadow(
                  color: Color(0x8A000000),
                  blurRadius: 34,
                  spreadRadius: -26,
                  offset: Offset(0, 14),
                )
              : const BoxShadow(
                  color: Color(0x1A000000),
                  blurRadius: 20,
                  spreadRadius: -2,
                  offset: Offset(0, 6),
                ),
        ],
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          gradient: gradient,
        ),
        child: Padding(padding: padding, child: child),
      ),
    );

    Widget card = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: dark
          ? BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: inner,
            )
          : inner,
    );

    if (onTap != null) {
      card = _Pressable(onTap: onTap!, radius: radius, child: card);
    }
    return card;
  }
}

/// Subtle scale/opacity press feedback (iOS-style, no 3D).
class _Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final double radius;
  const _Pressable(
      {required this.child, required this.onTap, required this.radius});

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.98 : 1,
        duration: AppDur.micro,
        curve: AppCurves.easeOut,
        child: AnimatedOpacity(
          opacity: _down ? 0.92 : 1,
          duration: AppDur.micro,
          child: widget.child,
        ),
      ),
    );
  }
}
