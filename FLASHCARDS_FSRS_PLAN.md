# Anki-style Flashcards with FSRS — Build Plan (Xyndrome)

> Status: **All four phases implemented (2026-06-16).** Not yet committed/pushed/deployed — see "Deploy" below.
> Last updated: 2026-06-16

This rebuilds the student flashcard experience into a faithful Anki-style,
FSRS-scheduled system. Card **content** stays in the existing `lesson_flashcards`
table. Per-user **scheduling state** moves server-side into **one** new per-user
table so progress syncs across web / iOS / PWA. Student-created personal cards
stay **local** on device.

---

## Locked decisions (from product owner)

| Question | Decision |
|---|---|
| New tables? | **No new content tables.** Card content stays in `lesson_flashcards`. **One** new per-user table allowed for review state/sync. |
| Card source | **Both** — admin-curated lesson decks (server, synced) **and** student-created personal cards (**local** on device). |
| Delete scope | **Only** the student page + its client-side scheduling. **Keep** admin generation in `ai-notes` (AI Notes depends on it). |
| FSRS library | **Add `ts-fsrs`** (official, do not hand-roll the math). Runs on backend for synced cards; also on frontend for local cards + optimistic previews. |
| Progress storage | **One** new per-user table `lesson_flashcard_reviews` for FSRS state + full review log → enables cross-device sync. |

### Design correction
The pasted brief named *DM Serif Display + pastel cream*. **This repo does not use
that.** Actual system = **Plus Jakarta Sans** (+ Patrick Hand accent),
glassmorphism / dark-elevation ladder, Apple HIG semantic colors. The feature
**matches the real tokens**: `--surface-card`, `--line-soft`, `--ds-card-radius`
(22px), `--ds-card-shadow`, the `--sa-surface` dark ladder. No DM Serif, no cream.

---

## Stack found (so we extend, not reinvent)

- **Backend:** NestJS 11 + raw `mysql2` (no ORM). `this.db.execute(sql, params)`.
- **Schema/migrations:** no migration tool — idempotent
  [`schema-sync.service.ts`](backend/src/modules/schema/schema-sync.service.ts)
  runs on boot (`CREATE TABLE IF NOT EXISTS`, `ensureColumn`, `ensureIndex`).
  New table is added there.
- **Deploy:** live backend runs **committed `backend/dist`** (no server build).
  Must compile TS→JS and commit **both** `.ts` and `dist/*.js`. Schema-sync
  creates the new table on next boot.
- **Frontend:** React **(JavaScript `.jsx`, not TS)** + Vite + Capacitor 8.
  `framer-motion` is installed but **must NOT be used** for the flip/transitions
  (iOS jank). Flip = GPU CSS transforms only.
- **Existing flashcard code:**
  - Content API: `GET /student/ai-notes/:id/flashcards` →
    [`ai-notes.controller.ts:273`](backend/src/modules/ai-notes/ai-notes.controller.ts),
    `studentFlashcards()` in
    [`ai-notes.service.ts`](backend/src/modules/ai-notes/ai-notes.service.ts).
    **Reused as the card-content source. Untouched.**
  - Client: `getStudentLessonFlashcards`, `listStudentAiNotesAcrossEngines` in
    [`aiNotes.api.js`](frontend/src/shared/api/aiNotes.api.js). **Reused.**
  - Page being **replaced:**
    [`StudentFlashcardsPage.jsx`](frontend/src/surfaces/app/student/flashcards/StudentFlashcardsPage.jsx)
    (2014 lines, localStorage-owned scheduling). Deleted in Phase 2.
  - Route: `/app/flashcards` in [`router.jsx`](frontend/src/app/router.jsx).

---

## Data model

### `lesson_flashcards` (existing — UNCHANGED)
Shared card content, one row per card: `id, note_id, lesson_id, question,
answer, source_hint, image_url, image_fit, status, sort_order, generated_by,
reviewed_by, created_at, updated_at`. Decks are derived from the
course→subject→topic→lesson hierarchy (same as today).

### `lesson_flashcard_reviews` (NEW — the one allowed table) — AS BUILT
**One row per `(user_id, card_id)`** holding the current FSRS state (fast
queue/due/count queries) **plus** an append-only review history in `log_json`
(undo + later FSRS weight optimization). This is the (c) compromise: a pure
append-only log would make due-queues a groupwise-max; a pure state row would
lose the log FSRS optimization needs — one row + JSON log gives both in one
table. See [schema-sync.service.ts](backend/src/modules/schema/schema-sync.service.ts) `ensureLessonFlashcardReviewsTable`.

```
id BIGINT PK · user_id · card_id (→lesson_flashcards.id)
state TINYINT (0 New 1 Learning 2 Review 3 Relearning) · due DATETIME
stability · difficulty · elapsed_days · scheduled_days · reps · lapses · learning_steps
last_review DATETIME NULL · suspended · buried
log_json LONGTEXT   -- [{uid,rating,ts,priorState,state,due,stability,…}] (last 200)
created_at · updated_at
UNIQUE KEY (user_id, card_id) · INDEX (user_id, due) · INDEX (user_id, state) · INDEX (card_id)
```

- **Current state** = the row itself (no row ⇒ New). **Undo** = pop the last
  `log_json` entry, restore prior state (or delete row if empty).
- **Idempotency** = each `log_json` entry carries a client `uid`; a replayed
  offline grade with a seen `uid` is skipped, so grades never double-apply.
- **Settings**: `flashcard_fsrs` key in `system_settings` (no extra table).

### Settings (NO new table)
Global defaults + per-deck overrides stored as JSON in the existing
`system_settings` table: desired retention `0.90`, max interval `36500`,
interval fuzz `on`, FSRS weights = `ts-fsrs` published defaults (stored so they
can be re-optimized from logs later).

### Student-created cards (LOCAL — no server table)
Stored on device via Capacitor Preferences / `localStorage`. Note types: Basic
(Front/Back), Basic+reversed (2 cards), Cloze (`{{c1::…}}` → one card per index).
FSRS state for these runs client-side with `ts-fsrs`. Schema mirrors the server
card shape so the UI is identical.

---

## API (new `flashcards` module; existing `ai-notes` API untouched)

New Nest module `backend/src/modules/flashcards/` (service + controller) reading
content from `lesson_flashcards`, writing state to `lesson_flashcard_reviews`.

| Method | Route | Purpose |
|---|---|---|
| GET  | `/student/flashcards/decks` | Deck tree w/ live **New / Learning / Due** counts per node |
| GET  | `/student/flashcards/queue?scope=…` | Next review queue for a deck scope; order = learning-due → review-due → new; respects per-deck new/day + reviews/day limits; each card carries **interval previews** for all 4 ratings |
| POST | `/student/flashcards/reviews` | Submit `{card_id, rating, review_uid, review_time}` (or batch `reviews:[…]` for offline sync). Loads state → runs FSRS → writes log row → returns updated card + new previews. Dedup by `review_uid`. |
| POST | `/student/flashcards/reviews/undo` | Undo last review for a card |
| GET  | `/student/flashcards/stats` | Reviews/day, retention (+ true retention), due forecast, counts by state, mature vs young, time studied |
| GET/PATCH | `/student/flashcards/settings` | Desired retention, max interval, per-deck limits/overrides |

FSRS math lives in `FlashcardSchedulerService` wrapping `ts-fsrs` — never
hand-rolled. Interval previews computed via `ts-fsrs` `repeat()` for the queued
card's current state.

---

## Frontend

- **API client:** `frontend/src/shared/api/flashcards.api.js` (decks, queue,
  submit, batch sync, undo, stats, settings).
- **Local layer:** `frontend/src/shared/flashcards/localDeckStore.js`
  (student-created cards) + `offlineReviewQueue.js` (queue grades offline, flush
  on reconnect, idempotent via `review_uid`).
- **Page (replaces old):** `frontend/src/surfaces/app/student/flashcards/`
  - `StudentFlashcardsPage.jsx` — deck list, 3 counts per deck (Anki-style)
  - `ReviewSession.jsx` — front → CSS-flip → 4 grade buttons labeled with their
    predicted interval (`Again <10m / Hard 4d / Good 9d / Easy 21d`); undo;
    learning steps (1m,10m); cloze + image render; done-for-today empty state.
    **Web:** space/enter flip, `1–4` grade, `u` undo. **Mobile:** big tap
    targets + tap zones, haptics via `@capacitor/haptics`. **Flip = CSS
    `transform`/`opacity` only; no framer-motion.**
  - `CardBrowser.jsx` — searchable / filterable / **virtualized** list; bulk
    select; edit, delete, move deck, tags, suspend
  - `AddCardFlow.jsx` — note-type picker, live cloze preview, image attach
    (local cards)
  - `flashcards.css` — Plus Jakarta + card tokens + dark ladder
- **Capacitor:** same React app wrapped; the page must hold **60fps in the iOS
  WebView**. After any frontend edit, run `npm run cap:sync`.
- **Virtualization (Phase 3):** no windowing lib installed yet — decide then
  between adding `@tanstack/react-virtual` or a light hand-rolled windower.

---

## Phased delivery — all implemented

- [x] **Phase 1 — Backend.** `ts-fsrs` added; schema-sync creates
      `lesson_flashcard_reviews`; `flashcards` module (controller + service +
      `FlashcardSchedulerService`); endpoints decks / queue / reviews / undo /
      flags / stats / settings; gateway route in `main.ts`; `dist` compiled.
      FSRS intervals smoke-tested (new card → Again 1m / Hard 6m / Good 10m / Easy 7d).
- [x] **Phase 2 — Review session UI.** Rebuilt `StudentFlashcardsPage.jsx`
      (deleted the 2014-line localStorage version): deck list with New/Learning/Due,
      CSS-only 3D flip, four grade buttons with live interval previews, undo,
      keyboard (Space/1-4/U) + tap, done-for-today. `flashcards.css`, `cloze.js`.
- [x] **Phase 3 — Management + local decks.** On-device store
      (`shared/flashcards/localStore.js` + `fsrsClient.js`): Basic / Basic+reversed /
      Cloze note types, deck CRUD, tags, suspend, client-side FSRS. Add-card flow
      with live cloze preview + image attach; virtualized card browser with
      search/filter/bulk. Driver abstraction (`drivers.js`) shares one session UI
      across server + local. Logic smoke-tested in Node.
- [x] **Phase 4 — Stats + offline + perf.** `StatsModal` (state mix, retention,
      reviews/day + due forecast, server + local). Offline buffer
      (`shared/flashcards/offlineQueue.js`): failed grades queue locally, flush on
      reconnect, idempotent via `uid`; pending-sync banner. Virtualized list +
      GPU-only transforms for iOS 60fps.

## Deploy (NOT done — user controls)

1. **Backend needs `npm install` on the server** — `ts-fsrs` is a new runtime
   dependency. Committed `dist` alone is not enough; without it in `node_modules`
   the API will fail to boot. Run `npm install` (or `npm ci`) in `backend/` on deploy.
2. Commit **both** `backend/src/**` and the recompiled `backend/dist/**`.
3. `lesson_flashcard_reviews` is created automatically by schema-sync on next boot.
4. Frontend: `dist` + native `ios/` `android/` already synced via `cap copy`
   (used instead of `cap:sync` to avoid a CocoaPods/network step — no native
   plugins were added, so `copy` is sufficient).
5. Nothing has been committed or pushed.

## Out of scope for v1 (leave architectural room)
- Image-occlusion cards.
- Auto-generating flashcards from Q-Bank.

## Acceptance
- Scheduling matches `ts-fsrs` exactly (server-side, fully logged).
- State syncs across devices; offline grades reconcile, never double-apply.
- Grade buttons show correct interval previews.
- 60fps flips on iOS; no framer-motion in this feature.
- `ai-notes` admin generation and all other features untouched and working.
