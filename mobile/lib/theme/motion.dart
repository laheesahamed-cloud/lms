import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'tokens.dart';

/// Honors the OS "reduce motion" setting (§4.6/§4.7).
class Motion {
  static bool reduced(BuildContext c) =>
      MediaQuery.maybeOf(c)?.disableAnimations ?? false;

  static Duration of(BuildContext c, Duration full) =>
      reduced(c) ? const Duration(milliseconds: 1) : full;
}

/// iOS-style push (slide-from-right + fade) with back-swipe; reduced → fade.
CustomTransitionPage<T> slidePage<T>({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<T>(
    key: key,
    transitionDuration: AppDur.route,
    reverseTransitionDuration: AppDur.route,
    child: child,
    transitionsBuilder: (context, animation, secondary, child) {
      if (Motion.reduced(context)) {
        return FadeTransition(opacity: animation, child: child);
      }
      final slide = Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
          .chain(CurveTween(curve: AppCurves.easeOut))
          .animate(animation);
      return SlideTransition(
        position: slide,
        child: FadeTransition(opacity: animation, child: child),
      );
    },
  );
}

/// Cross-fade page for root/tab switches.
CustomTransitionPage<T> fadePage<T>({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<T>(
    key: key,
    transitionDuration: AppDur.modal,
    child: child,
    transitionsBuilder: (context, animation, secondary, child) =>
        FadeTransition(opacity: animation, child: child),
  );
}
