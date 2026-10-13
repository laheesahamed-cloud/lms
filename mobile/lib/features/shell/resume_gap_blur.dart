import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';

/// Blurs the screen for the moment when screenshot protection is genuinely
/// off — between tearing the native shield down on resume and getting it back.
///
/// That gap is real, about a second wide, and it is the last hole in ordinary
/// use: return to a lesson and screenshot inside it and the lesson is
/// captured. A screenshot a few seconds later blocks correctly, and missing one
/// poisons nothing, so this window is all that is left to cover.
///
/// It blurs rather than blanking. A solid cover protects just as well but reads
/// as a fault — a black screen flashing over a lesson looks like the app broke.
/// A heavy blur is unreadable in a capture while looking like a deliberate
/// transition. The sigma is high on purpose: a light blur still leaves headings
/// legible, which would defeat the point.
///
/// The blur holds at full strength for the whole gap and then dissolves to
/// nothing. That ordering is the safety property, not a style choice: easing
/// the blur off DURING the gap would bring the lesson back into focus while it
/// is still unprotected, which is precisely what this exists to prevent. So
/// the animation is the reveal, and it only starts once the shield is back.
///
/// Flutter-painted, as everything in this path must be. A UIKit cover over the
/// same window was tried and broke the blocking outright — any extra layer-tree
/// mutation near the native rebuild seems to stop the new secure layer being
/// registered.
class ResumeGapBlur extends StatefulWidget {
  const ResumeGapBlur({super.key, required this.fading});

  /// Flipped true once protection is restored, which starts the reveal.
  final ValueListenable<bool> fading;

  /// How long the dissolve takes. The overlay is removed after this.
  static const Duration fade = Duration(milliseconds: 460);

  /// Blur at full strength. High enough that body text is unrecoverable.
  static const double maxSigma = 28;

  @override
  State<ResumeGapBlur> createState() => _ResumeGapBlurState();
}

class _ResumeGapBlurState extends State<ResumeGapBlur>
    with SingleTickerProviderStateMixin {
  late final AnimationController _reveal;

  @override
  void initState() {
    super.initState();
    // Starts at 1 — full blur, immediately. There is no fade in: the cover has
    // to be at full strength from the first frame it exists.
    _reveal = AnimationController(
      vsync: this,
      duration: ResumeGapBlur.fade,
      value: 1,
    );
    widget.fading.addListener(_onFading);
  }

  void _onFading() {
    if (widget.fading.value) _reveal.reverse();
  }

  @override
  void dispose() {
    widget.fading.removeListener(_onFading);
    _reveal.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : const Color(0xFF0B1220);
    final scrim = dark ? const Color(0xFF0B1220) : const Color(0xFFFFFFFF);

    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _reveal,
        builder: (context, _) {
          final t = Curves.easeOut.transform(_reveal.value);
          return BackdropFilter(
            // Never exactly zero while mounted: an ImageFilter at 0 sigma still
            // costs a composite, so the overlay is removed instead of lingering
            // at nothing.
            filter: ImageFilter.blur(
              sigmaX: math.max(0.01, ResumeGapBlur.maxSigma * t),
              sigmaY: math.max(0.01, ResumeGapBlur.maxSigma * t),
            ),
            child: ColoredBox(
              // A faint scrim over the filter: the blur alone leaves edges
              // sharp at the margins.
              color: scrim.withValues(alpha: 0.25 * t),
              child: Center(
                child: Opacity(
                  opacity: t,
                  child: SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        ink.withValues(alpha: 0.55),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
