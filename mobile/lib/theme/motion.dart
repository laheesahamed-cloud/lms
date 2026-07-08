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

/// iOS-style push that keeps the native edge swipe-back gesture.
///
/// It deliberately does NOT override [buildTransitions]: CupertinoPageRoute
/// installs the interactive back-gesture detector *inside* its default
/// transition, so overriding it (as the old version did with a custom
/// slide+fade) silently removed swipe-back. Using the stock Cupertino
/// transition restores the gesture app-wide, and every pushed screen can be
/// popped one page back by dragging from the left edge.
class _SwipeableSlideRoute<T> extends CupertinoPageRoute<T> {
  _SwipeableSlideRoute({required super.builder, super.settings})
      : super(fullscreenDialog: false);

  @override
  Duration get transitionDuration => AppDur.route;

  @override
  Duration get reverseTransitionDuration => AppDur.route;
}

/// Page wrapper that creates a [_SwipeableSlideRoute] — a pushed screen with
/// the native iOS slide transition and working edge swipe-back gesture.
Page<T> slidePage<T>({
  required LocalKey key,
  required Widget child,
}) {
  return _SwipeableSlidePage<T>(pageKey: key, child: child);
}

class _SwipeableSlidePage<T> extends Page<T> {
  final Widget child;
  const _SwipeableSlidePage({required LocalKey pageKey, required this.child})
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

/// Page for the Study-hub tools (Lessons, Flashcards, ECG…): on phones they are
/// *pushed* from the Study hub, so we use the swipeable slide route (iOS
/// edge-swipe-back) and prepend a back chevron. On the tablet/desktop side-rail
/// layout the same screens are reached via `go` (no back stack), so we fall
/// back to the plain cross-fade and [StudyToolChrome] renders nothing extra.
Page<T> studyToolPage<T>(
  BuildContext context, {
  required LocalKey key,
  required Widget child,
  bool chrome = true,
}) {
  final phone = MediaQuery.sizeOf(context).width < Breakpoints.desktop;
  // Screens that already render their own back button (e.g. My Notes) pass
  // chrome: false so we don't stack a second chevron — the swipe-back still
  // works because it comes from the pushed route, not the chrome.
  final wrapped = chrome ? StudyToolChrome(child: child) : child;
  // On phones push a swipeable slide route (edge back-swipe → Study hub); on
  // the side-rail layout these are reached via `go`, so keep the plain fade.
  return phone
      ? slidePage<T>(key: key, child: wrapped)
      : fadePage<T>(key: key, child: wrapped);
}

/// Adds a leading back chevron above a study-tool screen, but only when the
/// screen was pushed (so there is somewhere to pop back to) AND we are in the
/// phone/portrait bottom-nav layout. On the side-rail layout it returns the
/// child untouched — no chevron, no shifted content.
class StudyToolChrome extends StatelessWidget {
  final Widget child;
  const StudyToolChrome({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final phone = MediaQuery.sizeOf(context).width < Breakpoints.desktop;
    final canBack = Navigator.of(context).canPop();
    if (!phone || !canBack) return child;

    final c = context.c;
    return Container(
      color: c.page,
      child: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(left: 4, top: 4),
                child: IconButton(
                  tooltip: 'Back',
                  splashRadius: 24,
                  icon: Icon(Icons.chevron_left_rounded,
                      size: 32, color: c.inkStrong),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ),
            ),
          ),
          Expanded(
            // The child screens have their own SafeArea; drop the duplicate top
            // inset now that the chevron bar has consumed it.
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}
