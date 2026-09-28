# OSCE Clinical — Full Implementation Plan

## Overview

An image-first, interactive OSCE station trainer. A student picks a body system
(CVS, Respiratory, …), opens a station/case (e.g. **Mitral Stenosis**), and walks a
guided **head-to-toe clinical examination** built out of medical images with tappable
hotspots:

> full patient → lean into the face (malar flush) → down to chest → cardiac exam →
> into the heart → mitral valve → pathophysiology chain → investigations
> (ECG / CXR / Echo) → auscultation with sound timing → summary → OSCE practice

Tapping a finding doesn't open a popup — it **fills the screen with the close-up**, the
way you'd step toward the patient. Inside that view you step sideways through every
other finding in the scene ("2 of 6") with a mini-map keeping your place on the body.
Findings with nothing to look at — a murmur, a loud P2 — use the same frame but lead
with the sound. The case ends in **OSCE Practice Mode**: a tickable examination
checklist plus viva questions with model answers.

## Locked decisions (from product owner)

| Decision | Choice |
|---|---|
| Authoring | **AI writes the text; the owner supplies the images.** Everything is also manually creatable and editable |
| Imagery source | **Owner-supplied** — uploaded in the panel or bulk-dropped into the folder. No AI-generated anatomy in v1 |
| v1 scope | **One system deep — CVS**, 3–4 complete cases |
| Platforms | **Flutter app (student) + web admin panel (authoring) only.** No student web UI in v1 |
| Sounds / ECG | **Reuse existing Auscultation + ECG content by reference**, don't duplicate media |
| Image storage | **Files on disk**, DB stores only the key. Never base64 in MySQL |

Why text-only generation: an LLM writes reliable findings, checklists and viva answers
that you verify by *reading*. Image models invent anatomy — this project already dropped
auto AI diagrams from the notes canvas for exactly that reason. It also deletes the
largest subsystem in the build (see below) and makes generation nearly free.

## Information architecture

The mockups contain two entry paths into the *same* content:

- **Case-first** — System → Case → guided journey. This matches how the feature is
  actually used ("go to CVS station → Mitral Stenosis") and is the **v1 spine**.
- **Body-first** — System → body map → tap organ → conditions. This is just a second
  *index* into identical content. Deferred; it needs no new content model, only a new
  entry screen.

Journey stops inside a case: `Presentation → Scenes (head-to-toe) → Pathophysiology →
Investigations → Auscultation → Summary → Practice`.

## The content model — five primitives

Everything in all 12 mockup steps reduces to five shapes:

1. **Scene** — an image plus hotspots. A hotspot does one of three things: *zoom* to a
   child scene, *open* a sign, or simply *label* a structure. This is the head-to-toe
   journey (body → chest → heart → valve).
2. **Sign** — a clinical finding: close-up image, short + long description, narration
   audio, exam category (`inspection` / `palpation` / `percussion` / `auscultation` /
   `symptom`), and the body region it belongs to.
3. **Panel** — investigations and sounds. May **reference existing content**
   (`ecg_card:45`, `auscultation_card:12`) instead of carrying its own media.
4. **Chain** — the numbered pathophysiology cause→effect steps.
5. **Practice** — checklist sections + viva Q&A.

Three things the concept boards rely on that fall out of these primitives, and which the
model must carry explicitly or authors will fake them:

- **Label-only hotspots.** Board 1 step 6 names "Left atrium (enlarged)", "Left ventricle"
  on the heart. Those are *structures*, not findings — they need a name on the image and
  nothing behind them. Hence the third hotspot action.
- **Compare pairs.** Boards 1 and 3 both put normal beside abnormal — normal vs stenotic
  valve, normal vs mitral-stenosis heart sounds. You cannot teach "stenotic" without
  "normal" next to it, so `compare` belongs on scenes and signs, not only on sounds.
- **Front / back body.** Board 3 toggles the body view. That is simply two sibling scenes
  (`scene:body-front`, `scene:body-back`) — no new mechanism, but it should be the
  authoring convention rather than something each case reinvents.

## Cases link to other cases

Board 3 step 5 is the most under-rated screen in the whole concept: from **pulmonary
oedema**, tap the underlying cause and land on **mitral stenosis**. Cases are not islands
— they form a small clinical graph, and every link multiplies the value of content already
authored.

```jsonc
"related": [
  { "rel": "cause",        "case": "mitral-stenosis",  "note": "Cardiac cause" },
  { "rel": "complication", "case": "atrial-fibrillation" },
  { "rel": "differential", "case": "mitral-regurgitation" }
]
```

Cheap to build (a slug reference plus a section in the case page), and it's what turns
four CVS cases into a connected map instead of four dead ends. The same field powers the
"Causes" list on that screen.

## AI case generation — one call, no job queue

Type "Mitral Stenosis", pick the system, press **Generate**. A single call to the
existing AI provider returns the whole case document as structured JSON: signs with
categories and descriptions, the scene chain, approximate hotspot positions,
pathophysiology steps, investigation findings, checklist sections and viva questions —
**plus an image brief for every image slot it declares**.

This is a normal request with a spinner (~15–30s), not a background job. Generating
images would have meant 20+ calls at 10–40s each, forcing a job table, per-step state,
polling and restart-resumability on a host that cold-boots. Text-only removes all of it.

The result lands as an **editable draft**. AI output is pre-filled form state and nothing
more — every field, sign, step and question can be added, rewritten, reordered or deleted
by hand, and a case can equally be built from an empty skeleton with no AI at all.

Provider: reuse the resolution in `ai.service.ts:981` (Gemini or OpenAI key from
**Admin → Settings → AI**, env as fallback), not a new integration.

## Image slots and the shot list

The generated case declares every image it needs as a **slot** with a brief and a spec.
Slots are what make the case tell you what to go and photograph or draw.

| Slot | Ratio | Recommended | Why |
|---|---|---|---|
| `cover` | 16:9 | 1200×675 | The station card in the list |
| `scene:body` | 2:3 | 1400×2100 | Tall enough to read a standing figure without eating the screen |
| `scene:<region>` (chest, neck) | 4:3 | 1600×1200 | Regions are wider than tall |
| `scene:<organ>` (heart, valve) | 1:1 | 1400×1400 | Centres a compact subject, survives pinch-zoom |
| `sign:<id>` | 3:2 | 1500×1000 | Leaves vertical room for the explanation beneath |
| `ix:ecg` | 2:1 | 2000×1000 | Rhythm strips are horizontal |
| `ix:cxr` | 4:5 | 1400×1750 | Matches a PA film |
| `ix:echo` | 4:3 | 1400×1050 | Matches the sector frame |
| `chain:<n>` | 1:1 | 800×800 | Shown small beside its text |

Upload the best quality available and **don't pre-compress** — the pipeline produces
WebP and the three delivery widths.

**Shot list export.** A case exports its unfilled slots as a list with the exact filename
to use — `mitral-stenosis/sign-malar-flush.jpg`, `mitral-stenosis/scene-chest.jpg`. Fill
a folder, drop it in, hit **Scan**, and every file matches its slot by name. Authoring a
case becomes: generate text → export shot list → fill the folder → scan → nudge hotspots.

**Hotspot placement always needs you.** The model can say malar flush sits on the cheeks,
but placing the dot on *your* image is a visual judgement. Generated coordinates are a
starting guess; the editor is where they're made right.

## Data model

Four tables. The case body itself is a **JSON document**, mirroring the proven
`lessons.note_data` pattern — one atomic save from the editor, no 8-table join to render
a case, and the only queries needed are "by system" and "by slug".

```sql
osce_systems   (id, key, name, icon_key, sort_order, is_active)

osce_cases     (id, system_id, title, slug UNIQUE, summary, difficulty,
                case_data LONGTEXT /* JSON */,
                status ENUM('draft','published'), is_public TINYINT,
                created_by, created_at, updated_at)

osce_media     (id, case_id, slot_key VARCHAR(120), storage_key VARCHAR(255),
                mime, bytes, width, height, blur_hash, created_at,
                UNIQUE KEY (case_id, slot_key))

osce_progress  (id, user_id, case_id, checklist_json, seen_json,
                completed_at, updated_at, UNIQUE KEY (user_id, case_id))
```

`osce_media` is keyed by **(case, slot)** — one row per filled slot. The case document
says which slots exist; `osce_media` says which have been supplied. The difference
between those two *is* the shot list, and **publish is blocked while a required slot is
empty**.

`case_data` shape:

```jsonc
{
  "version": 1,
  "scenes": [
    { "id": "body", "title": "Full patient", "media": "scene:body-front", "parent": null,
      "flip": { "label": "Back", "media": "scene:body-back" },
      "hotspots": [
        { "x": 0.50, "y": 0.115, "label": "Malar flush",
          "action": { "type": "sign", "id": "malar-flush" } },
        { "x": 0.50, "y": 0.40, "label": "Chest",
          "action": { "type": "scene", "id": "chest" } }
      ] },
    { "id": "chest", "parent": "body", "media": "scene:chest", "hotspots": [ … ] },
    { "id": "valve", "parent": "heart", "media": "scene:valve",
      "compare": { "label": "Normal valve", "media": "scene:valve-normal" },
      "hotspots": [
        { "x": 0.46, "y": 0.38, "label": "Left atrium (enlarged)",
          "action": { "type": "label" } }
      ] }
  ],
  "signs": [
    { "id": "malar-flush", "name": "Malar flush", "category": "inspection",
      "region": "face", "media": "sign:malar-flush", "audio": null,
      "short": "Reddish-purple discolouration over the cheeks.",
      "body": "Reflects a low cardiac output with peripheral vasoconstriction and chronic pulmonary congestion.",
      "brief": "Close-up of the face, front on, flushed malar area both cheeks, neutral background." }
  ],
  "chain": [ { "step": 1, "title": "Narrowed mitral valve", "media": "chain:1", "body": "…" } ],
  "investigations": [
    { "modality": "ecg", "ref": { "type": "ecg_card", "id": 45 },
      "findings": ["P mitrale", "Atrial fibrillation", "Right axis deviation"] },
    { "modality": "cxr", "media": "ix:cxr",
      "findings": ["Left atrial enlargement", "Kerley B lines"] }
  ],
  "sounds": [
    { "title": "Mitral Stenosis", "ref": { "type": "auscultation_card", "id": 12 },
      "compareWith": { "type": "auscultation_card", "id": 3 },
      "markers": [ { "label": "S1", "from": 0, "to": 120 },
                   { "label": "Opening snap", "from": 460, "to": 520 },
                   { "label": "Mid-diastolic rumble", "from": 520, "to": 880 } ] }
  ],
  "summary": {
    "keyPoints": ["…"], "osceTips": ["…"],
    /* Board 1 step 11 — ties each sign you examined back to the mechanism.
       Edges between things that already exist, so it costs no new content. */
    "connect": [
      { "from": "sign:malar-flush",     "to": "chain:3" },
      { "from": "sign:murmur",          "to": "chain:1" },
      { "from": "chain:2",              "to": "sign:dyspnoea" }
    ]
  },
  "related": [ { "rel": "cause", "case": "rheumatic-fever" } ],
  "practice": {
    "checklist": [ { "section": "history", "items": ["Dyspnoea — grade the NYHA class"] } ],
    "questions": [ { "q": "What causes the opening snap?", "a": "…" } ]
  }
}
```

**Table creation must be unconditional** (`ensureOsceTables()` alongside
`ensureAuscultationTables`, `schema-sync.service.ts:929`). Write-path tables must never
depend on `SCHEMA_SYNC=1` — that exact mistake caused the live "create lesson 500".

## Media storage

Files on disk, named by case and slot, DB holds only `storage_key`:

```
backend/uploads/osce/_inbox/                              # bulk drop zone, scanned then emptied
backend/uploads/osce/mitral-stenosis/scene-body.webp      # canonical, slot-named
backend/uploads/osce/mitral-stenosis/scene-body@480.webp  # derivatives made on ingest
backend/uploads/osce/mitral-stenosis/scene-body@1080.webp
```

- `backend/uploads/` is already gitignored and already in production use (21 MB today:
  `pdf/`, `sound-clips/`, `marketing-popups/`, `payment-proofs/`).
- Slot-named files (not content hashes) are what make **bulk file-manager drops** work —
  you can't hash a file by hand, but you can name it. Cache-busting uses a `?v=`
  timestamp from `updated_at` since the name is stable.
- **Both upload routes share one ingest path** — panel upload and inbox scan run the same
  optimise → derivatives → register pipeline, so nothing ever reaches a student
  unoptimised.
- Copy the hardened serving path from `uploads.controller.ts:43-78` (filename allowlist +
  path-traversal check + immutable cache headers).
- All media URLs resolve through one `mediaUrl(key)` helper returning an **absolute** URL —
  both so a future move to R2/Bunny is a one-function change, and because `ContentImage`
  (Flutter) only handles `data:` and `http` prefixes and renders **nothing** for a
  relative `/uploads/...` path (`mobile/lib/widgets/content_image.dart:30`).
- Operational consequence to accept: **a DB dump is no longer a full backup** —
  `backend/uploads/` must join the backup routine.

## Stack found (so we extend, not reinvent)

| Need | Already exists | Verdict |
|---|---|---|
| AI text generation | `ai.service.ts:981` — provider resolution, Gemini/OpenAI keys from Admin → Settings → AI | **Reuse** for case generation |
| AI image generation | `SmartNotesImageApiService.generateIllustration()` | **Not used in v1** — images are owner-supplied. Available if that ever changes |
| Audio playback (Flutter) | `audioplayers ^6.1.0`, `audio_player_card.dart` | **Reuse** the player, replace the visualizer |
| Audio storage/serving | Auscultation writes to `uploads/sound-clips/`, DB stores filename | **Reuse pattern.** Add HTTP Range support — the current controller re-downloads the whole clip on seek (`auscultation.controller.ts:43`) |
| Waveform + timing markers | **Nothing.** Both existing "visualizers" are fake clock-driven bars | **Build.** Precompute peaks server-side on ingest |
| Hotspots over an image | `EcgInteractiveStrip.jsx` — percentage-positioned markers + tap callout | **Adapt** for the admin editor. Web-only, no zoom |
| Zoomable image widget | **Nothing reusable.** `lesson_canvas_page.dart:332` hand-rolls Matrix4 + cached inverse, entangled with ink | **Build** a clean reusable widget |
| Image upload | Disk pattern: lesson PDF (`lessons.controller.ts:130`), marketing popups | **Reuse.** Avoid the base64 pattern used by ECG/flashcards/questions |
| Video / animation | **Nothing** — no `video_player`, `lottie`, `rive`; only a YouTube iframe | See risks |

## Backend — `backend/src/modules/osce/`

`osce.service.ts`, `osce.controller.ts` (student), `osce-admin.controller.ts`,
`osce.module.ts`; register in `app.module.ts`; `ensureOsceTables()` in schema-sync.

**Student endpoints** (consumed by Flutter only):

```
GET  /student/osce/systems              → systems + published case counts
GET  /student/osce/cases?system=cvs     → case list
GET  /student/osce/cases/:slug          → HYDRATED case document
GET  /student/osce/progress             → all progress rows for the user
PUT  /student/osce/progress/:caseId     → checklist + seen state
```

**Hydration is the key API decision.** Because sounds/ECG are stored *by reference* and
images by *slot*, the server resolves both into ready-to-render objects with absolute
URLs before responding — so the app draws an entire case from **one** request.

**Admin endpoints** (`AdminGuard` + `@RequirePermissions('content.manage')`):

```
GET/POST/PUT/DELETE  /admin/osce/systems
GET/POST/PUT/DELETE  /admin/osce/cases            case_data saved atomically
POST                 /admin/osce/cases/generate   AI → draft case document (~15–30s)
GET   /admin/osce/cases/:id/shot-list             unfilled slots + briefs + filenames
POST  /admin/osce/cases/:id/media/:slot           upload one slot
POST  /admin/osce/media/scan                      ingest _inbox, match by filename
DELETE /admin/osce/cases/:id/media/:slot          clear a slot
POST  /admin/osce/cases/:id/publish               rejects while a required slot is empty
```

## Admin panel — `frontend/src/surfaces/admin/pages/osce/`

- **AdminOscePage** — systems + case list, publish state, "New case".
- **CaseGenerator** — title + system + **Generate** (or "Start empty"). Spinner while the
  model writes, then everything lands as editable fields.
- **OsceCaseEditor** — tabs: Overview │ Scenes │ Signs │ Pathophysiology │ Investigations │
  Sounds │ Practice. Every item addable, editable, reorderable, deletable by hand.
- **SlotGrid** — one tile per image slot showing the brief, the required ratio, and either
  the supplied image or a drop zone. Per tile: **Upload**, **Replace**, **Clear**, copy
  the expected filename. This is the shot list as a UI.
- **SceneHotspotEditor** — *the hard part.* Click to drop a hotspot, drag to reposition,
  set its label and action (zoom to child scene / open a sign). Coordinates stored as
  **0–1 fractions** so they survive every screen size. Percentage math is already solved
  in `EcgInteractiveStrip.jsx:69`.
- **Reference pickers** — search existing ECG and Auscultation cards to attach.

Wiring (per the Auscultation template): `frontend/src/shared/api/osce.api.js`, admin route
in `router.jsx` (lazy import + admin route + title map) and admin nav in `AppSidebar.jsx`.
**No student web route or student sidebar entry in v1.**

## Flutter app — `mobile/lib/features/osce/`

```
osce_page.dart               systems grid → case list
osce_case_page.dart          journey shell, stop-to-stop navigation
osce_detail_view.dart        full-screen sign view + sideways stepping + mini-map
osce_repository.dart         dio client + disk media cache
widgets/zoomable_hotspot_image.dart
widgets/sound_player_markers.dart
widgets/chain_view.dart
widgets/practice_checklist.dart
```

Routing, following the convention audited this session: `/app/osce` registered with
**`studyToolPage`** (slide + back chevron + edge swipe-back), detail routes with
`slidePage` — *not* `fadePage`. Add a `_ToolEntry` to `study_hub_page.dart:46`.

### Two new reusable components

**1. `ZoomableHotspotImage`** — pan/zoom via `Matrix4` with a cached inverse so taps map
from screen space back to image space for hit-testing percentage-anchored hotspots. The
maths exists inside `lesson_canvas_page.dart:332` but is welded to ink handling; this
extracts it as a clean widget. **Bonus:** it also finally renders
`ecg_cards.annotations_json` on mobile — a column the backend reads (`ecg.service.ts:67`)
that has never been displayed in the app and has no authoring UI.

**2. `SoundPlayerWithMarkers`** — `audioplayers` + server-precomputed peaks + labelled
segments (S1 / S2 / opening snap / murmur) that highlight as playback crosses them, with a
normal-vs-abnormal toggle. Replaces the fake visualizer with something real.

## Authoring a case, end to end

1. **Generate** — title + system → the model writes signs, findings, pathophysiology,
   investigations, checklist, viva questions, and declares every image slot with a brief.
2. **Read it.** You are the medical reviewer; the text is plausible until you've checked it.
3. **Export the shot list** — every unfilled slot with its ratio and expected filename.
4. **Fill the images** — upload in the panel, or drop the folder into `_inbox/` and Scan.
5. **Place the hotspots** — the one step that always needs a human.
6. **Attach** existing ECG / Auscultation cards; set the sound timing markers.
7. **Publish** — blocked while a required slot is empty.

## Implementation order

| Phase | Deliverable | Status |
|---|---|---|
| **P0 Foundation** | Tables + module + ingest pipeline (upload, inbox scan, derivatives, `mediaUrl()`), fix `ContentImage` to accept relative paths | Done |
| **P1 Generation** | AI case generation wired to the existing provider + the case editor with full manual create/edit | Done — short and long |
| **P2 Authoring** | Slot grid / shot list, hotspot editor, reference pickers, publish gate | Done — pickers preview before linking |
| **P3 Flutter spine** | Systems → cases → scene journey, `ZoomableHotspotImage`, full-screen sign view with sideways stepping + mini-map | Done |
| **P4 Panels** | Investigations (ECG by reference), sounds with markers, pathophysiology chain, compare pairs | Done |
| **P5 Practice** | Checklist, viva Q&A, progress sync, Summary & Connect, cross-case links | Done |
| **P6 Content** | Author 4 CVS cases: Mitral Stenosis, Mitral Regurgitation, Aortic Stenosis, Heart Failure | **Open** — 4 published of 8; 4 drafts unfinished |
| **P7 Polish** | Favourites, search, offline media cache, body-map entry screen | Favourites + search done; **cache and body-map open** |

Beyond the original plan, also built: long cases as a separate history-led UI with its
own editor, admin-named categories with their own ordering, per-case free/locked, and
shared long-case art.

Two decisions the build settled that the plan did not anticipate:

- **Generated slugs are not links.** The generator invents `related` slugs for cases that
  may never exist — all 34 authored links were dead. The server now resolves them and
  shows students only what opens; the admin Links tab surfaces the rest to repoint.
  The same guard applies to Summary & Connect edges.
- **Generated images skip the optimiser.** The backend has no image library by design,
  so generation is the one path that wrote full-size PNGs (~1.3 MB each, 47 MB on disk).
  Generation now returns the image and the panel optimises it like an upload.

Cross-case links land in P5 rather than P7 deliberately: they only become visible once
several cases exist, but the **field must be in the document from P1** or every case
authored before then has to be revisited.

Build the renderer generically from P3, but author case #1 from a seeded JSON file so the
schema is proven *before* the editor is finished — avoids building an editor for a shape
that then changes.

## Risks / gotchas

- **Generated medicine is plausible before it is correct.** The model will produce
  confident, well-formed findings that are subtly wrong — a sign attributed to the wrong
  lesion, an interval quoted loosely. The text is a *draft for a doctor to correct*, and
  the workflow should never imply otherwise.
- **The boards promise far more audio than v1 delivers.** Nearly every card in the concept
  art carries a play button — narration on each sign, on each symptom row, on the summary.
  v1 only has the **real** clinical audio reused from the Auscultation library; there is no
  narration track, because that means either recording every sign yourself or adding TTS.
  Decide deliberately: ship v1 with play buttons only where real audio exists (honest, and
  auscultation is the audio that actually teaches), or add TTS narration as its own phase.
  What must not happen is a play button that plays nothing.
- **Animations need a dependency decision.** There is no video or animation library in the
  app today. `video_player` and `rive` add **native** code, and native plugin additions are
  exactly what breaks iOS builds on this machine (CocoaPods is broken; SPM fetches hang).
  **Recommendation: animated WebP or a frame-sequence scrubber — zero new deps.** `lottie`
  (pure Dart, no native plugin) is the upgrade path.
- **Flutter image disk cache**: do *not* add `cached_network_image` — it pulls in `sqflite`
  (native). Hand-roll with `dio` + `path_provider`, both already present, exactly as
  auscultation already caches audio.
- **`/uploads` is served unauthenticated** (`main.ts:426`). Fine and desirable for cacheable
  medical images, but make it a deliberate decision — unauthenticated file serving has
  already been a real bug here once (payment proofs).
- **Images are the bottleneck, not code.** ~25 images per case, sourced and checked by you.
  This is why v1 is one system deep.
- **Deploy**: the live backend runs the committed `backend/dist`, so compiled output must be
  committed, and `backend/uploads/` must survive deploys.

## Out of scope (this plan)

- AI-generated medical imagery (the generator exists if this is ever revisited).
- Student web UI (Flutter-only by decision).
- Body-map entry screen (P7 — the content model already supports it).
- Narration audio / TTS for signs (slot is in the schema, unfilled in v1).
- Station types beyond examination + data interpretation (history-taking, procedures,
  communication) — leave `station_type` room in the schema.
- Timed/scored mock exams and peer marking.
