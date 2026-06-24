# AI Notes Screen — Flutter Build Spec

**Date:** 2026-06-20 · Extends `mobile/PLAN.md` §11.4 (note canvas) · Companion: `~/Desktop/OPT/native-ink.md`
**Why this doc:** the 2026-06-20 native-handwriting exploration in the Capacitor app proved that crisp
zoom + native writing + a fixed header + glued ink + an interactive note **cannot all coexist over a
WebView** — because the note is a web page and native ink can't share its zoomable surface. In Flutter
the note **is** native, so all of it comes for free. This spec captures the exact architecture.

---

## 0. The one architectural insight (the whole reason this works)
The user's own design is the blueprint: a **warm "canvas" (the paper you write + zoom)** sitting on a
**cooler, fixed background**, with the header/toolbar as fixed chrome. So:

- **Fixed chrome** (top bar, tool strip, background) → never zooms. Lives *outside* the zoom widget.
- **ONE zoomable surface** (the warm canvas) → contains the note content **and** the ink layer, together.
  Because they share one `InteractiveViewer`, zoom is crisp (vector re-paint, not bitmap stretch), the
  ink stays glued to the note, and the header never moves. This is the exact thing the WebView couldn't do.

```
Scaffold
 ├─ Fixed header (back · title · Autosaved · dark toggle · Video · MCQ · Done)   ← chrome, no zoom
 ├─ Fixed tool strip (pen · highlighter · eraser · colors · widths · undo/redo)  ← chrome, no zoom
 └─ Expanded
     └─ ColoredBox(cool background)            ← the "desk", fixed
         └─ InteractiveViewer(minScale 1, maxScale 5, panEnabled)   ← THE canvas, zoom+pan
             └─ Stack
                 ├─ NoteCanvas(noteJson)        ← warm dot-grid paper + the note widgets (crisp)
                 └─ InkLayer(strokes)           ← CustomPaint handwriting (crisp, glued, on top)
```

---

## 1. Goal / non-goals
**Goal:** the AI Notes screen, native on iOS **and** Android from one codebase — crisp zoom, native
Pencil/S-Pen writing that stays glued, the **warm-canvas design**, and the existing note content
(text, cards, quiz, flashcards, video, images) fully interactive.
**Non-goals:** changing the note's visual design (keep it as-is — see §3), changing the backend/data,
re-authoring note content (same note JSON from the API).

## 2. Make-or-break — validate FIRST (before building the screen)
The one thing Flutter does NOT give for free like zoom: **PencilKit-grade low-latency inking.** Build a
throwaway Flutter spike: a `CustomPaint` + `Listener` (pointer events, `event.pressure`) drawing layer,
run it on a real iPad + Pencil. If it feels as good as PencilKit did → proceed all-Flutter. If not →
the ink layer becomes a **platform view**: PencilKit (`PKCanvasView`) on iOS, Jetpack Ink on Android,
embedded just for the writing layer; everything else stays shared Dart. Decide this at kickoff.

## 3. Note content → Flutter widgets (data mapping)
Same note JSON (`note_data`: `{ sections, key_points, summary_box, tags, canvasStickers, layout, … }`).
Rebuild the look 1:1 (Plus Jakarta Sans, the warm canvas, pastel highlights). Widget map:

| Note element (JSON) | Flutter widget |
|---|---|
| Page / "canvas" | `NoteCanvas` — warm `Container` (`#faf3e6` light / `#17150f` dark) + dot-grid `CustomPaint`, rounded, padded |
| Title block | centered bold `Text` in a dashed-border `Container` |
| Section (full-width, e.g. "1. Definition") | `SectionCard` — tinted `Container` + a colored header pill (`Chip`-like) |
| Section (3-col cards: patho/aetiology/clinical) | `Wrap`/`GridView` of `SectionCard`, each themed (orange/red/blue) |
| Bullet | `Row(dot + RichText)` |
| Sub-bullet | indented `Row(corner-down-right icon + RichText)` |
| Highlighted term | `WidgetSpan`/`TextSpan` with a colored rounded background (pastel green/yellow/pink/blue/purple) |
| EXAM TRAP callout | bordered `Row(bolt icon + "EXAM TRAP" tag + text)` |
| Summary box | tinted `Container` with accent |
| Image / image-explained | `Image.network` + a lightbox (`showDialog` with `InteractiveViewer`) |
| Quiz option / flashcard / video | tappable widgets — **fully live** (this is the Flutter win: interactive AND zoomable, unlike the PDF) |
| Stickers (`canvasStickers`) | draggable `Positioned` widgets in the Stack |

## 4. Zoom (the crisp part)
- Wrap `NoteCanvas` + `InkLayer` in a single `InteractiveViewer(minScale: 1.0, maxScale: 5.0,
  boundaryMargin, panEnabled: true)`. Flutter re-paints widgets at the new scale → **crisp text + crisp
  ink**, no bitmap stretch, no memory wall, header fixed (it's outside the viewer).
- Stylus vs finger: two-finger / finger pinch drives `InteractiveViewer`; the pen draws on `InkLayer`.
  Gate the ink `Listener` on `event.kind == PointerDeviceKind.stylus` (the Flutter equivalent of
  `.pencilOnly`) so fingers fall through to the viewer — the clean version of the touch-separation we
  fought in UIKit.

## 5. Ink layer
- `CustomPaint` over the note, inside the same `InteractiveViewer` (so strokes zoom/scroll glued + crisp).
- Capture: `Listener(onPointerDown/Move/Up)`, stylus-only, read `position`, `pressure`, `tilt`. Build a
  `Path` per stroke; width modulated by pressure (your existing model).
- **Storage = the existing normalized stroke JSON** `{x,y(0..1),pressure,tiltX,tiltY,twist,t}` →
  saved per note via the SAME backend personal-layer endpoint the web uses. No data migration; web and
  Flutter notes interchange. Map InteractiveViewer scale/offset → note-normalized coords on commit.
- Tools: pen / highlighter (blend) / eraser — all native paint ops. Undo/redo = a stroke stack.

## 6. Warm-canvas design (matches the Capacitor change shipped 2026-06-20)
- Canvas: `#faf3e6` (light) / `#17150f` (dark) + faint dot grid (light dots `#e7dabf`, 18px), radius 18, pad 14.
- Background (the "desk"): a cooler neutral, distinct from the canvas, fixed.
- Section/highlight palette: reuse the tokens already in `lib/theme` + `mobile/PLAN.md` §4.1.

## 7. What's reused vs new
- **Reused (no change):** backend APIs, note JSON, stroke JSON, design tokens, the warm-canvas palette.
- **New (the work):** the `NoteCanvas` widget tree (§3) + `InkLayer` (§5). This is the real cost —
  re-creating the rich note as widgets. Done once, ships to iOS + Android.

## 8. Risks / open items
1. **Ink latency** (§2) — the only make-or-break; validate before building.
2. **Long notes** — `InteractiveViewer` inside a scroll: use a `SingleChildScrollView` for vertical
   scroll at 1×, InteractiveViewer for zoom; tune so both feel right (GoodNotes-style).
3. **Stroke ↔ note coordinate mapping** across zoom — straightforward in one coordinate space (unlike
   the WebView), but get the normalize-on-commit right so saved strokes land identically on web.
4. **Stickers + drag** interplay with the zoom gesture.

## 9.5 Study-tab navigation (web parity, 2026-06-20)
The Capacitor study tab (`frontend/.../study/StudentStudyPage.jsx`) is a hub of tiles; a **"Lessons"**
tile was added (tone `is-lessons`, teal `#14b8a6`) → `/app/courses` (Courses → lesson → AI Notes / Flashcards).
**Flutter must mirror this:** the study tab (`lib/features/study`) lists the same sections —
**Lessons → courses**, AI Notes, Flashcards, Planner, Saved — with the Lessons entry routing into the
courses → lesson → notes flow. Keep the AI Notes screen design as-is (§3, the warm canvas).

## 9.8 BUILD STATUS — Phase 1 DONE (2026-06-21, `flutter analyze` clean)
Built in `mobile/lib/features/ai_notes/`:
- `note_models.dart` — `NoteDoc`/`NoteSection`/`NoteListItem` (defensive JSON parse) + `parseInline`
  (`==highlight==` / `**bold**`).
- `notes_repository.dart` — `lessonNoteProvider` (`GET /student/ai-notes/lesson/:lessonId`) +
  `notesListProvider` (`GET /student/ai-notes`).
- `note_canvas_page.dart` — fetch by lesson → **warm dot-grid canvas** + title + section cards
  (heading pill + bullets + callouts) + key points + summary, inside ONE `InteractiveViewer`
  (crisp pinch-zoom + pan), with the **Pencil ink layer** (stylus-gated `Listener` + `CustomPaint`,
  pressure width, pen colours, eraser via `BlendMode.clear`, undo, clear). Header + tool strip = fixed chrome.
- `ai_notes_list_page.dart` — now fetches REAL notes → tap → `/app/study/lesson/:lessonId`.
- `app_router.dart` — added `/app/study/lesson/:lessonId` → `NoteCanvasPage`.

**Phase 2 (next):** pen-vs-pan arbitration (currently `_penDown` toggles InteractiveViewer pan/scale —
refine with `supportedDevices` gesture recognizers); section spans/masonry layout; images; exam-trap
parse; sub-bullets; cycling highlight palette; **save/load ink per note** (normalized stroke JSON to the
web's personal-layer endpoint); wire the study-hub → lessons list → lesson navigation.

## 10. Build order
1. Ink-latency spike on device (go/no-go for all-Flutter vs platform-view ink).
2. `NoteCanvas` static render from a real note JSON (no zoom/ink yet) — match the design.
3. Wrap in `InteractiveViewer` — confirm crisp zoom + fixed header.
4. `InkLayer` + stylus gating + save/load via existing endpoint.
5. Tools, undo, stickers, polish (dark mode, dot grid).
