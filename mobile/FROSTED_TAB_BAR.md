# Frosted tab bar — experiment

Status: **EXPERIMENTAL, not accepted.** Added 2026-10-03 at the user's request,
with "if not good we will revert back to the current one".

| | |
|---|---|
| Experiment commit | `2c16abda` |
| Last commit before it | `71f7421d` |

---

## Revert it

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/lms && git revert --no-edit 2c16abda
```

Then rebuild and install:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/lms/mobile && ~/development/flutter/bin/flutter build ios --release --dart-define=API_BASE_URL=https://xyndrome.lk/api && xcrun devicectl device install app --device 00008120-001171683C82201E build/ios/iphoneos/Runner.app
```

**Revert the whole commit.** Do not just put the old `_BottomNav` back. The bar
is one of three coupled changes, and restoring it alone leaves every page
padding the bottom for a bar that no longer overlaps them — a dead strip of
background above the nav on all fifteen screens.

If the revert conflicts because later work touched these files, the three
changes to undo by hand are listed under *What changed* below.

---

## What changed

A blur needs something behind it. The bar was a `bottomNavigationBar`, so the
body stopped above it and there was nothing to frost — hence three changes, not
one.

### 1. The body paints behind the bar

`mobile/lib/features/shell/app_shell.dart` — the phone `Scaffold` gained
`extendBody: true`.

### 2. The bar became glass

`mobile/lib/features/shell/app_shell.dart` — `_BottomNav` is now a `Stack`:

- **`_ProgressiveBlur`** — a single `BackdropFilter` cannot vary its sigma
  across its own area, so this stacks six. Each is stronger than the last and
  each is masked by a `LinearGradient` through `BlendMode.dstIn`, fading in over
  its own band. The bands overlap, so what you see is a ramp rather than the
  steps it is built from: nothing 46pt above the pill, full strength at the
  screen's edge.
- **The pill** — `ClipRRect` + `BackdropFilter(sigma 24)` over `c.card` at
  0.62 alpha (dark) / 0.72 (light), with a hairline border for definition. The
  fill has to stay translucent or it hides the blur behind it.

### 3. Content has to pass underneath

`mobile/lib/widgets/shell_insets.dart` (new) — `shellNavInset(context)`.

All **15 shell pages** changed `SafeArea(bottom: false)` and moved the inset
into their scroll view's bottom padding:

```dart
padding: EdgeInsets.fromLTRB(16, 14, 16, 28 + shellNavInset(context)),
```

This is the part that is easy to miss. A `SafeArea` that reserves the bottom
shrinks the **viewport**, so content stops above the bar and nothing ever passes
under the glass — the blur would frost flat page background and look like a
faint tint. The padding has to be *inside* the scrollable: then the last item
still comes to rest clear of the bar, and everything above it slides beneath.

Pages touched: dashboard, courses, quizzes, study hub, results, notifications,
subscriptions, profile, planner, bookmarks, lessons, flashcards, ecg,
auscultation, drugs.

---

## Tune it instead of reverting

All in `mobile/lib/features/shell/app_shell.dart`.

| Want | Change |
|---|---|
| Blur starts higher / lower | `_kBlurRunUp` (currently `46`) |
| Stronger / weaker blur | `_ProgressiveBlur._maxSigma` (currently `20.0`) |
| Visible steps in the ramp | raise `_ProgressiveBlur._layers` (currently `6`) |
| Bar too see-through / too solid | the `c.card.withValues(alpha: …)` in `_pill` |
| Bar's own frosting | the `sigmaX/sigmaY: 24` in `_pill` |

Each extra blur layer is another `BackdropFilter`, which is the expensive part —
raise `_layers` only if the banding is actually visible.

---

## What to check before deciding

1. **Does the ramp read as smooth?** Scroll a long list — Lessons or Saved — and
   watch whether you can see the six bands.
2. **Does scrolling stay smooth?** `BackdropFilter` is the usual price of this
   effect. Seven of them are live at once (six bands plus the pill).
3. **Both themes.** The pill's alpha and border differ between light and dark.
4. **Nothing is stranded at the bottom of any of the 15 pages.** The last item
   of each list should come to rest clear of the bar, not under it.
