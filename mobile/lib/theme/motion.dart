import 'package:flutter/cupertino.dart';
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

/// iOS-style push with our slide+fade animation AND iOS swipe-back gesture.
/// Extends CupertinoPageRoute so the pop gesture is enabled automatically.
class _SwipeableSlideRoute<T> extends CupertinoPageRoute<T> {
  _SwipeableSlideRoute({required super.builder, super.settings})
      : super(fullscreenDialog: false);

  @override
  Duration get transitionDuration => AppDur.route;

  @override
  Duration get reverseTransitionDuration => AppDur.route;

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (MediaQuery.maybeOf(context)?.disableAnimations == true) {
      return FadeTransition(opacity: animation, child: child);
    }
    final slide = Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
        .chain(CurveTween(curve: AppCurves.easeOut))
        .animate(animation);
    return SlideTransition(
      position: slide,
      child: FadeTransition(opacity: animation, child: child),
    );
  }
}

/// Page wrapper that creates a [_SwipeableSlideRoute].
/// Drop-in replacement for the old CustomTransitionPage slidePage — same API,
/// but the route now supports the iOS swipe-back edge gesture.
Page<T> slidePage<T>({
  required LocalKey key,
  required Widget child,
}) {
  return _SwipeableSlidePage<T>(pageKey: key, child: child);
}

class _SwipeableSlidePage<T> extends Page<T> {
  final Widget child;
  _SwipeableSlidePage({required LocalKey pageKey, required this.child})
      : super(key: pageKey);

  @override
  Route<T> createRoute(BuildContext context) {
    return _SwipeableSlideRoute<T>(
      settings: this,
      builder: (_) => child,
    );
  }
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
