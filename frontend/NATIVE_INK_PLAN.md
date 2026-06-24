# Native Ink Plan — PencilKit + Android Ink overlay

Goal: get Apple Pencil and S Pen handwriting to feel as accurate and low-latency
as GoodNotes/Notability/Samsung Notes, by replacing the WebView 2D canvas with a
**native inking surface** for the active drawing region of the AI Notes screen.

Decisions locked (2026-06-19):
- Tier 1 web wins shipped first (`getPredictedEvents()` live tail — done; `perfect-freehand` optional, see below).
- Tier 2 = native overlay plugin. **Both platforms at parity** (iOS PencilKit + Android Jetpack Ink).
- Storage/data format stays unified on the existing normalized stroke JSON so web, iOS, and Android all read/write the same notes.

---

## 0. Why native (the ceiling we are hitting)

Today the ink path is: pen → OS → WebView PointerEvent → JS → `<canvas>` 2D →
WebView compositor → screen. The compositor hop is the latency you feel — ink
trails the pen tip. A WebView cannot remove it.

Native inking frameworks draw into a **low-latency front buffer that sits under
the pen tip**, plus they get OS-level **palm rejection**, **motion prediction**,
and full **pressure / tilt / azimuth**. That is the entire reason native note apps
feel "stuck to the pen" and a web canvas never fully does.

Current code (for reference):
- Web canvas + all input handling: `frontend/src/surfaces/app/student/ai-notes/AiNotesPage.jsx`
  - point capture `pointFromEvent` (~L1408), pointer handlers `onPointerDown/Move/finishStroke` (~L1562–1693)
  - live render `drawFastLiveStroke` (~L1274), committed render `drawSmoothStroke` (~L762)
  - normalized stroke shape: `{ x, y, pressure, tiltX, tiltY, twist, pointerType, t }` (x/y in 0..1)
- iOS native bridge already exists: `frontend/ios/App/App/AppBridgeViewController.swift` (`lmsScribbleAudio` handler — extend this for ink messages)
- Android shell: `frontend/android/app/src/main/java/com/erpm/medical/lms/MainActivity.java`

---

## 1. Architecture — native overlay, web stays the shell

Keep the entire React notes UI (toolbar, AI features, layout, page background,
saved-note rendering) exactly as-is. Only the **active writing layer** becomes
native.

```
┌─────────────────────────────────────────┐
│  WebView (React notes screen)            │
│  ┌─────────────────────────────────────┐ │
│  │  note page background + committed    │ │  ← web <canvas>, unchanged
│  │  strokes (drawSmoothStroke)          │ │
│  │                                      │ │
│  │   ╔═══════════════════════════════╗  │ │
│  │   ║  NATIVE INK VIEW (overlay)    ║  │ │  ← PKCanvasView / Android Ink
│  │   ║  draws ONLY the in-progress   ║  │ │     positioned over canvas rect
│  │   ║  stroke, zero-latency         ║  │ │
│  │   ╚═══════════════════════════════╝  │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Flow:
1. User enters draw mode → JS tells the plugin to show the native ink view sized/positioned over the canvas rect (`getBoundingClientRect`).
2. While drawing, the native view renders the live stroke at full native speed (web canvas does nothing).
3. On lift (stroke end), native emits the finished stroke as **normalized stroke JSON** back to JS.
4. JS commits it through the **existing** `onCommitStroke` path → existing storage, undo, sync. The committed stroke is then drawn by the existing web renderer (so saved notes still render identically everywhere, including web).
5. Native ink view clears its live layer (the committed stroke is now "owned" by the web canvas underneath).

This means: **native handles only the live stroke; the web canvas remains the source of truth for committed ink.** Minimal data model churn, full backward compatibility with existing saved notes, and the web build keeps working unchanged.

### Two rendering modes to choose between
- **(A) Live-only native (recommended first):** native draws only the in-flight stroke, hands JSON to web on lift. Simplest; web renderer owns committed ink. Slight seam risk: the moment of "handoff" from native live layer to web committed layer must be flicker-free (clear native AFTER web has painted — one rAF).
- **(B) Fully native page:** native owns ALL ink for the page (PKDrawing / Ink stroke list), web canvas only draws page background. Best fidelity, but committed strokes then render differently on native vs web, and you must serialize the whole page both ways. Defer unless (A)'s handoff seam proves visible.

Plan targets (A).

---

## 2. Capacitor plugin API (JS ↔ native bridge)

New plugin `LmsInk` (custom local Capacitor plugin). Suggested surface:

```ts
LmsInk.isSupported(): Promise<{ supported: boolean; platform: 'ios'|'android'; reason?: string }>
LmsInk.attach({ rect, tool, color, width, opacity, stylusOnly, dpr }): Promise<void>   // show + position overlay
LmsInk.updateRect({ rect }): Promise<void>                                              // on scroll/resize/zoom
LmsInk.setTool({ tool: 'pen'|'highlighter'|'eraser', color, width, opacity }): Promise<void>
LmsInk.detach(): Promise<void>                                                          // leave draw mode
LmsInk.clearLive(): Promise<void>                                                       // after web commits a stroke

// events (native → JS)
LmsInk.addListener('strokeStart', () => {})
LmsInk.addListener('strokeEnd', (e: { stroke: NormalizedStroke }) => {})   // hand off to onCommitStroke
LmsInk.addListener('strokeProgress', (e) => {})   // optional: for live scribble-audio coupling
```

`rect` is in CSS px relative to the WebView viewport: `{ x, y, width, height }`
from `parentRef.current.getBoundingClientRect()`. Native converts using screen scale.

`NormalizedStroke` MUST match the existing JS shape so `onCommitStroke` is untouched:
```ts
{ id, tool, color, width, opacity,
  points: Array<{ x, y, pressure, tiltX, tiltY, twist, pointerType:'pen', t }> }  // x/y in 0..1 of rect
```
Native resamples its high-rate stroke down to the same density `simplifyStrokePoints` would (distance ≥ 0.0003 or pressure Δ ≥ 0.045) so stored size matches today's.

---

## 3. iOS — PencilKit (`PKCanvasView`)

- Add a `PKCanvasView` as a subview of the Capacitor `WKWebView`'s container, positioned with the rect from `attach`/`updateRect`. `isOpaque = false`, transparent background so web shows through.
- `drawingPolicy = .pencilOnly` when `stylusOnly`, else `.anyInput`. This gives **free palm rejection** and Apple Pencil hover/double-tap.
- We do NOT use PencilKit's own toolpicker — our React toolbar stays. Configure the active tool via `PKInkingTool(.pen, color:, width:)` / `.marker` for highlighter / `PKEraserTool`.
- On `canvasViewDrawingDidChange` / a `PKCanvasViewDelegate` lift, read the newest `PKStroke` from `canvasView.drawing.strokes`, walk `stroke.path` interpolated points → emit normalized JSON (`location` → rect-relative 0..1; `force`→pressure; `azimuth`/`altitude`→tiltX/tiltY). Then call `canvasView.drawing = PKDrawing()` to clear the live layer once web has committed.
- Pressure/tilt: `PKStrokePoint` exposes `force`, `azimuth`, `altitude`, `size`, `timeOffset` — map directly.
- Hook the existing `lmsScribbleAudio` bridge: drive scribble sound from `strokeProgress` so the paper sound you already built keeps working.
- Min target: iOS 13+ (PencilKit programmatic API). Already well within your deployment target.

Edge: PencilKit anti-aliasing/width curve differs slightly from `drawSmoothStroke`.
Because committed strokes re-render via the web path, the **live** native stroke
and the **committed** web stroke must look close enough that the handoff isn't
jarring. Tune `pressureStrokeWidth` vs PencilKit width, or adopt `perfect-freehand`
on the web side (below) so both use tapered variable-width outlines.

---

## 4. Android — Jetpack Ink + low-latency rendering

Google shipped the official answer to exactly this problem:
- **`androidx.ink`** (Jetpack Ink) — stroke geometry, brushes, rendering. Pressure/tilt from `MotionEvent` axes (`AXIS_PRESSURE`, `AXIS_TILT`, `AXIS_ORIENTATION`).
- **Low-latency front-buffered rendering** via `androidx.graphics.lowlatency` (`CanvasFrontBufferedRenderer` / `GLFrontBufferedRenderer`) so wet ink lands under the S Pen with minimal lag.
- **`MotionEventPredictor`** (`androidx.input.motionprediction`) for OS motion prediction — the native equivalent of the `getPredictedEvents()` win we just shipped on web.

Implementation:
- Add a transparent `SurfaceView`/`View` over the `WebView` (sibling in the Capacitor activity layout), positioned by `attach`/`updateRect` (convert CSS px → device px via `displayMetrics.density` and the plugin-supplied `dpr`).
- Capture stylus `MotionEvent`s on that view (filter `getToolType() == TOOL_TYPE_STYLUS` when `stylusOnly`). Palm rejection: ignore `TOOL_TYPE_FINGER` in stylus-only mode; honor `ACTION_POINTER` for palm touches.
- Wet stroke → front buffer (Ink `InProgressStrokesView` if using the high-level Ink view, which already wires front-buffered rendering + prediction). On lift, convert the finished `Stroke` to normalized JSON and emit `strokeEnd`; clear the in-progress view after web commits.
- Map S Pen button / eraser-end to eraser tool if desired.
- Min target: Ink library requires recent AndroidX; current `compileSdk` should be fine. Provide a graceful fallback: if Ink unavailable, `isSupported` returns false and JS keeps the web canvas (which now has predicted events).

---

## 5. The hard parts (call them out, budget for them)

1. **Positioning & scroll sync.** Native overlay must track the canvas rect as the
   page scrolls/zooms/resizes. Two options:
   - (a) Make the note canvas a **non-scrolling fixed region** while in draw mode
     (you already aggressively scroll-lock during a stroke — see `beginStrokeScrollLock`,
     L1477). Extend that: while draw mode is ON, lock page scroll and only allow
     scroll via an explicit "pan" gesture/button, then `updateRect` after pan.
   - (b) Stream scroll offset to native each frame (`updateRect` on scroll) — more
     plumbing, more chance of seam jitter. Prefer (a).
2. **Handoff seam (mode A).** Clearing the native live layer must happen only AFTER
   the web canvas has painted the committed stroke, or there's a 1-frame flicker.
   Sequence: native `strokeEnd` → JS `onCommitStroke` → web paints → `requestAnimationFrame` → `LmsInk.clearLive()`.
3. **Two ink data models → one.** PencilKit `PKStroke` and Android `Stroke` both get
   normalized to your existing point JSON at the native boundary. Never store native
   formats; keeps web/iOS/Android notes interchangeable and avoids a data migration.
4. **Feature parity (re-plumb through native):**
   - [ ] Pen (pressure/tilt width)
   - [ ] Highlighter (multiply blend, constant-ish width, 0.36 opacity)
   - [ ] Eraser (your eraser is destination-out on the web canvas — in mode A, eraser
         can stay **web-only** since it edits already-committed ink, not live ink.
         Decide: eraser does NOT need native. Likely keep eraser on web.)
   - [ ] Undo/redo (already JS-side via committed strokes — unaffected)
   - [ ] Scribble audio (drive from `strokeProgress`/native; reuse `lmsScribbleAudio`)
   - [ ] Zoom scale (`zoomScale`) → pass to native so width/dpr match
   - [ ] DPR / retina crispness (pass `devicePixelRatio`)
   - [ ] stylusOnly mode (native palm rejection — actually *better* than web here)
5. **Capacitor plugin packaging.** Local plugin in `frontend/ios/App` and
   `frontend/android/app` (or a small `capacitor-plugin` package). Remember the
   committed-`dist` deploy model — native changes ship via Xcode/Gradle build, not
   the server `dist`.

---

## 6. Phasing / milestones

- **M0 — Spike (per platform, ~2–3 days each):** bare overlay view over the WebView,
  draw one stroke natively, log it. Prove positioning + transparency + that the
  native ink visibly beats the web canvas latency on-device. **Go/no-go gate.**
- **M1 — Plugin contract:** implement `LmsInk` JS interface + `attach/detach/updateRect/setTool/clearLive` + `strokeStart/End` events on **both** platforms.
- **M2 — Normalized stroke handoff:** native → JSON → existing `onCommitStroke`; verify saved notes round-trip and render identically on web reopen.
- **M3 — Tool + audio parity:** pen/highlighter, stylusOnly palm rejection, scribble
  audio via `strokeProgress`, zoom/dpr correctness.
- **M4 — Scroll/zoom integration:** draw-mode scroll lock + pan-then-`updateRect`;
  kill the handoff seam.
- **M5 — Polish + fallback:** `isSupported` fallback to web canvas; device matrix
  (iPad + Pencil 1/2/Pro; Samsung S Pen; one mid Android tablet).

Rough effort: **~3 weeks** with both platforms, M0 spikes first as the kill switch.

---

## 7. Tier 1.5 — optional web upgrade: `perfect-freehand`

Independent of native; improves the web canvas (and the live/committed match for
the native handoff). Swap the **pen** rendering in `drawSmoothStroke` (L762) to
build a filled variable-width outline via `getStroke(points, { size, thinning,
smoothing, simulatePressure:false })` and `ctx.fill()` instead of `stroke()`.

- Pros: true tapered, pressure/tilt-aware nibs; closer to PencilKit look → cleaner handoff.
- Cons: **visual migration** — every existing saved note re-renders with the new
  outline (slightly different weight). Highlighter (multiply, constant width) and
  eraser stay on the current path. Needs an on-device eyeball before shipping.
- Risk: low code risk, medium "does it still look like our app" risk. Gate behind a
  quick device review; easy to revert (single function).

---

## 8. Open questions for the user

- Device mix: what % iPad+Pencil vs Samsung+S Pen vs other Android? (sets test matrix priority — currently "both equally")
- Is eraser-on-web acceptable (mode A), or must the eraser also feel native?
- Appetite for the `perfect-freehand` visual change to existing notes, or keep current ink look and rely purely on native for the live feel?

---

## Status

- [x] Tier 1: `getPredictedEvents()` live predicted tail — shipped in `AiNotesPage.jsx`
      (`drawFastLiveStroke` predicted-tail param + `onPointerMove` wiring). Synced to native shells.
- [ ] Tier 1.5: `perfect-freehand` pen outline (optional, needs device review)
- [ ] Tier 2: `LmsInk` native overlay plugin (this plan)
