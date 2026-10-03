import 'package:flutter/material.dart';

/// EXPERIMENTAL (frosted tab bar).
///
/// The floating tab bar is glass now, and the shell sets `extendBody: true` so
/// the body paints behind it. A page therefore must NOT reserve that space with
/// `SafeArea(bottom: true)` — that shrinks the viewport and nothing ever passes
/// under the glass. It adds this to the BOTTOM PADDING OF ITS SCROLL VIEW
/// instead, which is inside the scrollable: the last item still comes to rest
/// clear of the bar, and everything above it slides beneath.
const double kShellPillHeight = 64;
const double kShellPillMargin = 10;

double shellNavInset(BuildContext context) =>
    kShellPillHeight +
    kShellPillMargin +
    MediaQuery.viewPaddingOf(context).bottom;
