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
/// Gap under the pill, on top of the home indicator. Deliberately small —
/// the bar sits low, close to the screen's edge.
const double kShellPillMargin = 4;

/// How far above the pill the tab bar's blur begins to come in. The bar's glass
/// is this much taller than the pill itself.
const double kShellBlurRunUp = 46;

/// Bottom padding for a scroll view that runs behind the glass tab bar, so its
/// LAST item comes to rest fully clear of the pill AND of the blur above it.
/// [shellNavInset] alone only clears the pill, which left the end of a page
/// (a button, the last card) sitting in the blurred band.
double shellScrollEnd(BuildContext context) =>
    shellNavInset(context) + kShellBlurRunUp + 20;

double shellNavInset(BuildContext context) =>
    kShellPillHeight +
    kShellPillMargin +
    MediaQuery.viewPaddingOf(context).bottom;
