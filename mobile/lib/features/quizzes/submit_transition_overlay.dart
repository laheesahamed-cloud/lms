import 'dart:ui';

import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The phase that drives the submit transition. [idle] renders nothing.
enum SubmitPhase { idle, submitting, complete }

/// Two-screen submit transition — "Badge verify" morph, ported verbatim from the
/// web app (frontend SubmitTransitionOverlay / desktop/opt/quizanim.md).
///
/// One floating card stays mounted; [phase] drives the morph: a blue spinner
/// cross-fades/scales into a green verified badge, and the two labels cross-fade,
/// so it reads as a single card transforming rather than two cards swapping.
///
///   phase = submitting → spinner + "…is submitting" label
///   phase = complete   → verified badge + done label
///   phase = idle       → nothing rendered
///
/// Non-blocking by design: the real submit/save runs while this plays. The
/// caller holds each phase for a minimum duration so the moment never flashes.
class SubmitTransitionOverlay extends StatelessWidget {
  final SubmitPhase phase;
  final String submittingLabel;
  final String completeLabel;
  const SubmitTransitionOverlay({
    super.key,
    required this.phase,
    this.submittingLabel = 'Your quiz is submitting…',
    this.completeLabel = 'Submission complete!',
  });

  @override
  Widget build(BuildContext context) {
    if (phase == SubmitPhase.idle) return const SizedBox.shrink();
    final c = context.c;
    final complete = phase == SubmitPhase.complete;

    return Positioned.fill(
      child: TweenAnimationBuilder<double>(
        // Scrim fade-in (mirrors qsubmit-fade 0.2s).
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        tween: Tween(begin: 0, end: 1),
        builder: (context, scrim, child) => Opacity(
          opacity: scrim,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              color: const Color(0x8C080A10), // rgba(8,10,16,.55)
              alignment: Alignment.center,
              padding: const EdgeInsets.all(24),
              child: child,
            ),
          ),
        ),
        child: TweenAnimationBuilder<double>(
          // Card rise (mirrors qsubmit-rise 0.32s — translateY 8→0 + fade).
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOut,
          tween: Tween(begin: 0, end: 1),
          builder: (context, rise, child) => Opacity(
            opacity: rise,
            child: Transform.translate(
              offset: Offset(0, (1 - rise) * 8),
              child: child,
            ),
          ),
          child: _panel(c, complete),
        ),
      ),
    );
  }

  Widget _panel(AppColors c, bool complete) {
    return Container(
      constraints: const BoxConstraints(minWidth: 260, maxWidth: 360),
      padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 34),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: c.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x73000000), // rgba(0,0,0,.45)
            blurRadius: 60,
            offset: Offset(0, 24),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon slot — fixed 64×64 so the card never resize-jumps between
          // phases. Spinner and badge are stacked; only opacity/scale change.
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Spinner: only fades out on complete (keeps size — no stutter).
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 300),
                  opacity: complete ? 0 : 1,
                  child: SizedBox(
                    width: 34,
                    height: 34,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      color: c.primary,
                      backgroundColor: c.line,
                    ),
                  ),
                ),
                // Verified badge: springy "stamp" pop on complete.
                AnimatedScale(
                  duration: const Duration(milliseconds: 450),
                  curve: const Cubic(0.2, 0.9, 0.3, 1.35),
                  scale: complete ? 1 : 0.55,
                  child: AnimatedRotation(
                    duration: const Duration(milliseconds: 450),
                    curve: const Cubic(0.2, 0.9, 0.3, 1.35),
                    turns: complete ? 0 : -0.05, // ~ -18deg
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 400),
                      opacity: complete ? 1 : 0,
                      child: Icon(Icons.verified_rounded,
                          size: 60, color: c.success),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Labels cross-fade + slide (mirrors qsubmit-text morph).
          SizedBox(
            height: 22,
            child: Stack(
              alignment: Alignment.center,
              children: [
                _label(
                  text: submittingLabel,
                  color: c.inkStrong,
                  visible: !complete,
                  slideUp: true, // submitting label slides UP on exit
                ),
                _label(
                  text: completeLabel,
                  color: c.success,
                  visible: complete,
                  slideUp: false, // done label slides UP into rest
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _label({
    required String text,
    required Color color,
    required bool visible,
    required bool slideUp,
  }) {
    // submitting (slideUp): rest at 0, exits to -6. done: enters from +6 to 0.
    final dy = visible ? 0.0 : (slideUp ? -6.0 : 6.0);
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOut,
      opacity: visible ? 1 : 0,
      child: AnimatedSlide(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOut,
        offset: Offset(0, dy / 22), // fraction of the 22px slot height
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            height: 1.4,
            color: color,
          ),
        ),
      ),
    );
  }
}
