# Optimize Rule

In this project, **optimize** means improving performance, reliability, and workflow smoothness **without changing the current UI design**.

Optimization should protect the existing look and feel. Do not redesign screens, change the visual style, replace layouts, or alter the user experience unless the user specifically asks for a design change.

## What Optimize Means

- Fix bugs without changing the current UI.
- Make pages, animations, and workflows feel smoother.
- Reduce lag on low-resolution and low-RAM devices.
- Reduce heavy GPU usage from expensive animations, shadows, filters, canvas effects, and large repaints.
- Keep touch interactions responsive on mobile and tablets.
- Make scrolling smoother and avoid janky layout shifts.
- Minimize unnecessary re-renders, timers, intervals, observers, and animation loops.
- Keep image, asset, and bundle usage reasonable.
- Preserve all existing features unless the user asks to remove something.

## What Optimize Does Not Mean

- Do not redesign the dashboard, lessons, results, courses, or bottom navigation.
- Do not change colors, spacing, typography, icons, cards, or component style just because code is being optimized.
- Do not remove visible features unless they are broken, unused, or explicitly requested.
- Do not replace the current UI with a simpler UI unless the user asks.
- Do not make desktop better by making mobile worse.

## Device Targets

Every optimized page should still work smoothly on:

- Small mobile screens.
- Low-resolution Android phones.
- Older iPhones.
- Tablets and iPads.
- Desktop browsers.
- Devices with low RAM.
- Devices with weaker GPUs.

## Animation Rules

Animations should be light and purposeful.

Prefer:

- `transform` and `opacity`.
- Short transitions.
- CSS-only effects where possible.
- Reduced animation on touch devices when hover is not useful.
- Respecting `prefers-reduced-motion`.

Avoid:

- Infinite heavy animation loops.
- Large animated shadows.
- Large animated blurs.
- Constant layout-changing animation.
- Expensive SVG/canvas effects when simple CSS can do the job.
- Hover effects that get stuck after long press on touch devices.

## Bug Fixing Rules

When optimizing bugs:

1. Keep the current UI.
2. Find the smallest safe fix.
3. Test desktop and mobile behavior.
4. Check dark mode and light mode.
5. Check low-width screens.
6. Run the relevant build or smoke check.

## Verification

After optimization work, run the checks that match the changed area:

```bash
npm test
npm run build:frontend
npm run build:backend
```

For mobile/native changes:

```bash
npm run mobile:cap:sync
```

For API health:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
```

