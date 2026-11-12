import 'package:flutter/material.dart';

/// A bottom sheet on phones, a centred card on big screens (iPad).
///
/// A sheet rising from the bottom edge of a 13" screen is a long way from the
/// button that opened it and stretches across the whole width. Same signature
/// as [showModalBottomSheet] for the arguments the app uses, so call sites only
/// change the function name.
Future<T?> showAdaptiveSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = false,
  bool useRootNavigator = false,
  bool isDismissible = true,
  bool enableDrag = true,
  bool showDragHandle = false,
  bool useSafeArea = false,
  Color? backgroundColor,
  ShapeBorder? shape,
}) {
  final wide = MediaQuery.sizeOf(context).shortestSide >= 600;
  if (!wide) {
    return showModalBottomSheet<T>(
      context: context,
      builder: builder,
      isScrollControlled: isScrollControlled,
      useRootNavigator: useRootNavigator,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      showDragHandle: showDragHandle,
      useSafeArea: useSafeArea,
      backgroundColor: backgroundColor,
      shape: shape,
    );
  }
  final scheme = Theme.of(context).colorScheme;
  return showDialog<T>(
    context: context,
    useRootNavigator: useRootNavigator,
    barrierDismissible: isDismissible,
    builder: (ctx) {
      final maxH = MediaQuery.sizeOf(ctx).height * 0.85;
      return Dialog(
        backgroundColor: backgroundColor ?? scheme.surface,
        surfaceTintColor: Colors.transparent,
        clipBehavior: Clip.antiAlias,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 540, maxHeight: maxH),
          // The dialog already lifts itself above the keyboard; the sheet
          // content would add that gap a second time.
          child: MediaQuery.removeViewInsets(
            context: ctx,
            removeBottom: true,
            child: builder(ctx),
          ),
        ),
      );
    },
  );
}
