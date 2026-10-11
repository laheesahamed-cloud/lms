# OSCE Clinical — handover

Everything the OSCE feature is made of: the data model, the admin UI, the AI
generation, the media pipeline, and the Flutter app that students use.

Written for someone who has never opened these files. Where a decision looks
odd, the reason is given — most of them exist because something broke once.

**Scope:** `backend/src/modules/osce/`,
`frontend/src/surfaces/admin/pages/osce/`, `mobile/lib/features/osce/`.
~13,000 lines in total.

---

## 1. What it is

An OSCE station is a clinical examination case a student walks through. There
are **two kinds**, and the difference runs all the way down the stack:

| | **Short case** | **Long case** |
|---|---|---|
| Led by | Examination | History |
| Student does | Finds signs on the patient, explains them | Interviews the patient |
| Content | Scenes, signs, pathophysiology, investigations | Sections of question/answer exchanges |
| Images | ~25 per case (body, signs, diagrams) | Two shared pictures for the whole app |
| `osce_cases.station_type` | `'short'` | `'long'` |
| Flutter page | `osce_case_page.dart` | `osce_long_case_page.dart` |

Both are stored in the **same table** and the **same JSON document shape**
(`CaseDocument`). A long case leaves the short-case fields empty and fills
`sections`/`patient`/`cast` instead. One document type serves both so there is
one editor shell, one preview, one API.

---

## 2. Data model

### Tables (all created in `schema-sync.service.ts`)

**`osce_categories`** — mostly vestigial. Categories are really the course's
own subjects; see below.

**`osce_cases`** — one row per station.

| Column | Notes |
|---|---|
| `course_id`, `topic_id` | The subject it belongs to. `topic_id` IS the category. |
| `title`, `slug` | `slug` is the public id — the app fetches `/osce/cases/:slug`. |
| `summary` | One line shown on the station card. |
| `difficulty` | `core` / `intermediate` / `advanced` |
| `station_type` | `short` / `long` |
| `case_data` | **LONGTEXT holding the whole `CaseDocument` as JSON.** |
| `status` | `draft` / `published` |
| `is_public`, `is_free` | `is_free` opens the station to everyone. |
| `sort_order` | Admin-ordered within its subject. |

**`osce_media`** — one row per **filled** image slot
(`UNIQUE (case_id, slot_key)`). The document declares which slots *exist*; this
says which have been *supplied*. The difference between the two is the shot
list. A row holds either a `storage_key` (a file we store) **or** an
`external_url` (a video hosted elsewhere) — never both.

**`osce_progress`** — per user, per case: `checklist_json`, `seen_json`,
`is_favourite`, `completed_at`. `UNIQUE (user_id, case_id)`.

### Categories are the course's subjects

There is no separate taxonomy to maintain. `listSystems()` reads `topics`
(subjects) joined to `courses`, so **adding a subject in the admin panel
creates an OSCE category automatically**. This also means the existing
subscription scope (`user_subscriptions.course_ids_json`) gates OSCE for free —
there is no OSCE-specific entitlement anywhere.

### `CaseDocument`

Defined in `osce.service.ts`. Every field is optional in practice;
`parseDoc()` spreads the stored JSON over `EMPTY_DOC`, so an old case missing a
newer section simply has nothing there rather than crashing.

```ts
interface CaseDocument {
  version: number;
  scenes: Scene[];          // zoom chain: body -> chest -> heart
  signs: Sign[];            // the findings, each with its own image + explanation
  chain: [{ step, title, media?, body? }];      // pathophysiology, in order
  investigations: [{ modality, ref?, media?, findings? }];
  sounds: [{ title, ref?, compareWith?, markers? }];
  summary: { keyPoints?, osceTips?, connect? };  // connect: sign id -> chain step
  treatment?: [{ group, items }];                // added 2026-10-08
  related?: [{ rel, case, note? }];              // cause / complication / differential
  practice: { checklist: [{ section, items }], questions: [{ q, a }] };
}
```

Long cases additionally use `patient`, `cast`, `sections`, `differentials`,
`initialManagement` — read by `OsceLongCase.fromJson` on the Flutter side.

**`treatment` vs `initialManagement`** — they are not duplicates.
`initialManagement` (long case only) is the first steps at the bedside.
`treatment` (both types) is the full plan grouped by phase: Immediate,
Definitive, Long-term. Grouping is the teaching point — what you do in the
first five minutes is not what you do on discharge.

**Summary & Connect** is the piece worth understanding: `summary.connect` maps
each **sign id** to a **chain step number**. That is what turns a list of
findings into an explanation, and it is what an examiner actually tests. The
admin editor makes both ends dropdowns of things that exist in the case, so an
edge cannot be authored dangling.

---

## 3. Media and image slots

### Slot keys

A slot key names a picture the document needs: `cover`, `scene:body`,
`sign:malar-flush`, `chain:2`, `ix:ecg`. `declaredSlots(doc)` walks the
document and returns every slot it references, with a label and the author's
visual brief.

`slotToFileBase()` converts `sign:malar-flush` → `sign-malar-flush`, which is
the filename an author drops into the inbox. `slotFromFileName()` reverses it.

### Two aspect ratios, deliberately

```
BODY_SPEC     3:4   1536x2048   only scene:body
STANDARD_SPEC 4:3   1536x1152   everything else
```

Every scene in a zoom chain shares one shape so the frame does not resize as
you move body → chest → heart; a box that changed shape per image is what made
that transition jump. Both are canonical ratios so the image model renders them
natively — 3:2 and 2:1 were tried and came back approximated.

### Where files live

```
uploads/osce/<case>/…     stored images and videos
uploads/osce/_inbox/      drop zone (see below)
uploads/osce/_inbox/_used/ archive after use
```

Limits: **6 MB** per image, **60 MB** per video. Videos are stored as sent —
the WebP optimisation pass only handles stills.

### Resizing happens in the BROWSER

The backend has no image library (no `sharp`). `osceMedia.js` resizes and
re-encodes before upload, with per-slot targets:

| Slot family | Max width | Target size |
|---|---|---|
| `cover` | 1200 | 180 KB |
| `scene` | 1600 | 420 KB |
| `sign` | 1500 | 360 KB |
| `ix` | 2000 | 480 KB |
| `chain` | 800 | 140 KB |

Higher than the shared optimiser's defaults because OSCE images get
pinch-zoomed.

### The inbox

An author can drop files into `uploads/osce/_inbox/` named after their slot
(`sign-malar-flush.jpg`). The admin panel lists them, works out which slot each
belongs to, and lets you file them in one click. Used files are **archived, not
deleted** — the author's only copy might be in there.

### External video links

A slot can hold a link (YouTube, Vimeo, Drive) instead of a file. Self-hosted
clips are what got the hosting account flagged, so linking is preferred.
When `external_url` is set, `storage_key` is `''` and the client gets the URL
exactly as pasted — no cache stamp, no thumbnail.

---

## 4. AI generation

`osce-generator.service.ts`. Two separate things generate: the **case text**
and the **images**.

### Case text

```
generateCase(condition, systemKey, notes?, stationType)
  -> resolveProvider()             reads ai_provider_configs (active row)
  -> buildPrompt() | buildLongCasePrompt()
  -> callProvider(prompt, provider, maxTokens)
       short: 16384   long: 65536
  -> parseJson()
  -> normalize() | normalizeLongCase()
  -> { summary, document, warnings }
```

**Why 65536 for a long case:** seven sections of question/answer exchanges runs
far longer than a short case and was being truncated mid-JSON at 16k.

Gemini models are tried in order:
`gemini-3.1-pro-preview` → `gemini-3-flash-preview` → `gemini-2.5-flash`.

The normalisers are strict: every field is coerced, unknown enum values fall
back to a safe default, `related` entries with no case slug are dropped, and
hotspot coordinates are clamped to 0–1. **The output is always a draft** —
`warnings` is prefixed with *"Generated text is a draft — review every finding
before publishing."*

### Images

`generateImage(prompt, preferredModel?)` — Gemini only. Tries the model chosen
in the admin panel first (so models can be compared without a rebuild), then
`gemini-2.5-flash-image`, `gemini-2.0-flash-preview-image-generation`,
`gemini-2.0-flash-exp`. Token usage is logged so image spend can be tracked.

`promptForSlot()` builds the prompt, and **styling is per slot type**. A
blanket "soft clinical lighting on a neutral dark background" is right for a
patient photo and actively wrong for a diagnostic — an earlier version produced
a small ECG strip floating in grey dead space. Every prompt ends with "no text,
no letters, no numbers, no labels, no arrows, no watermarks, no borders" and
the slot's frame spec.

A `sign:` prompt uses the sign's **`brief`** field — a purely visual
description the generator is told to write ("name the exact colour, the exact
anatomical distribution, the patient context; never the mechanism, never the
diagnosis").

### Investigations are NOT generated

`canGenerateSlot()` returns false for any `ix:` slot. An image model reproduces
what ECG paper *looks like* with no model of the signal underneath, so it will
happily draw "AF" over visible P waves. **Link a real ECG or auscultation card
instead** — that is what `ContentRef { type, id }` is for, and
`listLinkableContent()` powers the picker.

---

## 5. Admin UI

`frontend/src/surfaces/admin/pages/osce/` — one page plus eight editors.

| File | What it does |
|---|---|
| `AdminOscePage.jsx` | The shell: case list, new-case panel, tab router, every simple editor |
| `SlotGrid.jsx` | The image slots — upload, generate, link, clear, inbox |
| `SceneHotspotEditor.jsx` | Place tappable hotspots on a scene image |
| `SummaryEditor.jsx` | Key points, OSCE tips, and Summary & Connect |
| `LongCaseEditor.jsx` | Patient, cast, history sections, differentials, initial management |
| `RelatedEditor.jsx` | Links to other stations |
| `ContentPicker.jsx` | Search and attach a real ECG / auscultation card |
| `CategoryManager.jsx` | Subject ordering |
| `CasePreview.jsx` | Walks the case exactly as a student sees it |
| `osceMedia.js` | Browser-side resize + upload |

### Tabs

The tab list differs by station type, because showing short-case tabs on a long
case only misleads:

```js
SHORT_TABS = Preview, Images, Scenes, Findings, Pathophysiology,
             Investigations, Sounds, Treatment, Practice, Summary, Links
LONG_TABS  = Preview, History, Cover, Treatment, Practice, Links
```

`CasePreview` walks the same steps the app does:
**Exam → Mechanism → Ix → Treatment → Summary → OSCE.**

### Publishing

`draft` → `published` via `POST cases/:id/publish`. Students only ever see
`status = 'published' AND is_public = 1`.

---

## 6. API surface

### Admin — `@Controller('admin/osce')`

```
GET    systems | cases | cases/:id | cases/:id/preview | cases/:id/shot-list
POST   cases | cases/generate | cases/:id/publish | cases/:id/unpublish
PUT    cases/:id | cases-order | categories/:id | categories-order
DELETE cases/:id | categories/:id

POST   cases/:id/media/:slot            upload a file
POST   cases/:id/media/:slot/link       attach an external video URL
POST   cases/:id/media/:slot/generate   AI image
GET    cases/:id/media/:slot/prompt     the prompt that would be used
DELETE cases/:id/media/:slot            clear

GET    settings | image-models | linkable | global-media | inbox
POST   global-media/:slot | inbox/:fileName/archive
```

### Student — `@Controller('osce')`

```
GET courses | regions | systems | cases | cases/:slug | progress
GET ecg/:cardId/image | sound/:cardId/audio | media/:caseSlug/:fileName
PUT progress/:caseId
```

**`GET cases/:slug` is the whole feature in one request.** `hydrateCase()`
resolves every image slot and every ECG/auscultation reference into a URL
before replying, so the app never has to work out where a picture lives.

---

## 7. Access control

- A station belongs to a course, so the **student's existing course scope**
  decides whether it opens. No separate OSCE entitlement.
- **Out-of-scope content is shown LOCKED, not hidden.** Filtering it out of the
  list made the `locked` flag unreachable, so a paid station silently vanished
  instead of showing a padlock.
- **Locking is per STATION, never per course or subject.** A course can hold a
  mix of free and paid stations, so locking the whole row would stop you
  browsing in to see what is there.
- Enforcement is in `hydrateCase()`, which throws `ForbiddenException` for a
  case the student cannot open. The list flags are presentation only.

---

## 8. The Flutter app

`mobile/lib/features/osce/` — ~6,000 lines.

### Routes

```
/app/osce                      hub
/app/osce/body-map             browse by body region
/app/osce/course/:courseId     subjects in a course
/app/osce/subject/:topicId     stations in a subject
/app/osce/:slug                a station  (?type=long opens the long-case page)
```

### A short case is a WALKTHROUGH, not tabs

`osce_case_page.dart` drives an enum of stops:

```dart
enum _Stop { exam, chain, investigations, treatment, summary, practice }
```

Each stop states what it is and why you are there, so "where am I / what am I
doing" is answered on screen. **A stop only appears when it has content** —
`_availableStops()` checks each section, so a case with no sounds has no sounds
step rather than an empty one.

### Body map

`osce_body_map_page.dart` + `listRegions()`. A deliberately short fixed list of
regions, head to toe: head, neck, chest, abdomen, groin, hands, legs, general.
The generator invents region words freely, and a map with fourteen zones of one
station each teaches nothing. `REGION_SYNONYMS` folds "praecordium", "apex",
"lungs" into `chest`; anything unrecognised becomes `general`, which is honest
— it means "look at the whole patient".

### Media cache

`osce_media_cache.dart` — a case is ~25 pictures. Without caching, walking the
same station twice re-downloads all of them, and on a ward with no signal it
shows nothing.

Hand-rolled on `dio` + `path_provider` rather than `cached_network_image`,
**which drags in `sqflite` — a native plugin, and native plugin additions are
what break the iOS build on this machine** (see the Flutter iOS build notes).
Files live under application support, not temp, so the OS does not reclaim them
between sessions, keyed by a hash of the full URL. The server's `?v=` stamp is
part of that URL, so refilling a slot changes the key and the stale copy ages
out by itself.

`prefetch()` runs **once per station** — re-running it on every rebuild queued
the same downloads repeatedly.

### Progress

`saveProgress()` sends **only the fields passed**, so favouriting a station
cannot wipe its ticked checklist. Checklist ticks are fire-and-forget — a
dropped tick is not worth interrupting the student for.

---

## 9. Gotchas

**Never trim the `GROUP BY` clauses.** They list every non-aggregated selected
column, which looks redundant. Production runs MySQL with `ONLY_FULL_GROUP_BY`
and local XAMPP does not, so the short form worked in dev and 500'd every OSCE
list query in production.

**Table creation order matters in `schema-sync`.** An `ALTER` on `osce_media`
used to sit before the `CREATE`, so on a fresh database it threw and aborted
the rest of the method — leaving `osce_media` and `osce_progress` uncreated
while the server happily served OSCE routes against missing tables.

**`osce_cases.system_id` is dropped explicitly.** `CREATE TABLE IF NOT EXISTS`
leaves the old `NOT NULL` column in place on installs that ran the earlier
shape, and it then rejects every insert.

**The app silently drops section types it does not know.** The Flutter canvas
and the web renderer must be updated together when the document shape gains a
section — there is no fallback for an unknown type, so content just does not
appear. This is how `branch` cards and embedded flows were invisible on the
phone for a while.

**Long cases share two global images** (`global:doctor`, `global:patient`,
under `GLOBAL_CASE_ID = 0`) rather than carrying their own. The conversation is
the content; the faces are staging.

---

## 10. Adding a new section to a case

The path that has caught people out. All five steps, or the content will not
appear:

1. `CaseDocument` in `osce.service.ts` — add the field, and add it to
   `EMPTY_DOC`.
2. `osce-generator.service.ts` — add it to **both** prompt schemas and **both**
   normalisers, or generated cases arrive with it empty.
3. `AdminOscePage.jsx` — add a tab to `SHORT_TABS` / `LONG_TABS` and an editor.
4. `CasePreview.jsx` — add it to `STEPS` and render it.
5. Flutter — parse it in `osce_repository.dart` (**both `OsceCase` and
   `OsceLongCase`**) and render it in `osce_case_page.dart` and
   `osce_long_case_page.dart`.

`treatment` (commit `80fb2d8c`) is a complete worked example of all five.
