# AI Notes — Server-Side Optimization & DB Storage Fix Plan

**Scope:** the AI-notes lesson read path (server + database only). No new features.
**Goal:** make a lesson open fast and cheap by **deleting / replacing / fixing existing code** — not by dumping new code.
**Status:** plan only. Every item below was verified by re-reading the actual code (22 confirmed findings, 2 rejected).

---

## 0. Guiding principles

1. **Delete > replace > add.** Prefer removing redundant work over writing new machinery.
   Net effect of this whole plan: **~270 lines removed, ~40 added.**
2. **Minimal diff.** Each fix is a few lines in a known location, with exact `file:line` anchors.
3. **Behavior-preserving** unless a fix is explicitly a bug fix (DB3, the `raw_text` leak).
4. **Measure the headline fix.** Capture one real cold-load time before/after the `lesson_id` index.

### ⚠️ Deployment constraint (applies to every backend change)
The live backend runs the **committed `backend/dist`** (no server-side build). So for each `.ts` edit you **must** mirror the change in the compiled `backend/dist/.../*.js` (and `.d.ts` where a signature/interface changes), then **commit + push `v4` + pull/restart** on the server. Preferred: run `cd backend && npm run build` to regenerate `dist` consistently, then commit the whole `dist`. Items below marked **[dist]** require this. Frontend-only items are marked **[fe]** and need `npm run cap:sync`.

---

## 1. What's actually slow (root causes, confirmed)

| Cause | Evidence | Fixed by |
|---|---|---|
| **Missing `lesson_id` index** → full-table scan on every lesson open | `studentFindByLesson` `WHERE n.lesson_id = ?` ([ai-notes.service.ts:534](src/modules/ai-notes/ai-notes.service.ts)); only indexes are `user_id` + `(is_public,status,course_id,topic_id)` | **F1** |
| **Wasted DB round-trips per open** (5 sequential) — flashcards bundled in, access checked twice | `studentFindOne` 483-511, `studentFindByLesson` 513-547 | **F2, F3** |
| **Over-fetch + data leak** — `SELECT n.*` ships `raw_text` (admin source, ~16–50 KB) to students | lines 487/518; mapper spreads it to client | **F4** |
| **Re-parse 900 KB every request** (no memoization) | `deserialize` JSON.parse at line 1530 | **F9 (optional)** |
| **Re-download 900 KB on every refresh** (no ETag/Cache-Control) | controller 263-281 returns plain objects | **F8** |
| **Dead payload fields** (`diagram_prompt`, duplicated `visual_style`) | reader never reads them | **F6, F7** |
| ~~Raw uncompressed payload~~ | **Not a risk** — gzip is on (main.ts:419-453) and the app uses browser `fetch` which always sends `Accept-Encoding` | — (rejected) |

---

## 2. The plan — ordered by impact ÷ risk

### Phase 1 — Headline DB fix + zero-risk waste removal

#### F1 · Add the missing `lesson_id` index  🔥 highest impact, 1 line **[dist]**
- **Why:** the hottest student query (`studentFindByLesson`) scans the entire `ai_illustrated_notes` table; with `note_data` LONGTEXT (~900 KB/row) the scan is very expensive and grows with note count.
- **Change (ADD 1 line):** in [schema-sync.service.ts](src/modules/schema/schema-sync.service.ts) right after the existing `idx_ai_notes_public_status_course` entry (~line 181), inside `onModuleInit`:
  ```ts
  await this.ensureIndex(connection, 'ai_illustrated_notes', 'idx_ai_notes_lesson_pub_status', 'lesson_id, is_public, status, engine_key');
  ```
  `ensureIndex` is idempotent (checks `INFORMATION_SCHEMA`, `ALTER TABLE ... ADD INDEX` only if absent) → auto-applies on next boot. Mirror in `dist/.../schema-sync.service.js` (~line 193).
- **Fix style:** add-line · **+1 / 0** · **Risk: low**
- **Verify:** `SHOW INDEX FROM ai_illustrated_notes` shows the index with `lesson_id` as `Seq_in_index=1`; `EXPLAIN` the query → `type: ref`, not `ALL`.

#### F2 · Delete flashcard bundling from lesson reads  🔥 removes a query + payload, pure delete **[dist]**
- **Why:** `studentFindOne`/`studentFindByLesson` eagerly fetch **all** approved flashcards on every lesson open, but the reader (`AiNotesPage.jsx` / `NoteCanvas.jsx`) **never reads `note.flashcards`** (0 grep hits). The flashcard screen already loads them lazily via the dedicated `GET /student/ai-notes/:id/flashcards`.
- **Change (DELETE 2 lines):** in [ai-notes.service.ts](src/modules/ai-notes/ai-notes.service.ts)
  - line **509** (`studentFindOne`): delete `flashcards: mapped.canAccess ? await this.findApprovedFlashcardsForNote(rows[0].id) : [],` → `return mapped;`
  - line **545** (`studentFindByLesson`): same → `return mapped;`
  - **Keep** the private helper `findApprovedFlashcardsForNote` (694) — `studentFlashcards` still uses it.
  - Mirror in `dist/.../ai-notes.service.js` (~lines 384, 420).
- **Interaction:** **keep** the `approved_flashcard_count` COUNT subquery (lines 496/526) — once flashcards are unbundled it's the cheap source for the deck-size badge (`mapStudentNote` already returns `approvedFlashcardCount`). *(This supersedes the alternative "delete the COUNT" idea — do not delete it.)*
- **Fix style:** delete · **0 / −2** · **Risk: low**

#### F3 · Merge the two duplicate subscription lookups into one round-trip **[dist]**
- **Why:** every read calls `plansService.hasFeatureAccess(id,'notes_canvas_study_mode')` **and** `getLessonAccessProfile(id)` back-to-back — the **same** `user_subscriptions ⋈ plan_features ⋈ features` join, differing only in the `feature_key` filter. Two sequential DB hits for overlapping rows.
- **Change (REPLACE, +6/−4):** widen `getLessonAccessProfile` ([ai-notes.service.ts:1557-1600](src/modules/ai-notes/ai-notes.service.ts)) `feature_key IN (...)` to also include `'notes_canvas_study_mode'`, set a `hasNotesCanvas` flag on the returned profile (exclude that key from `hasAnyPaidLessonAccess`), then drop the separate `hasFeatureAccess` call in `studentFindOne` (485), `studentFindByLesson` (515) and `studentFlashcards` (554), reading the merged flag instead. Leave `plansService.hasFeatureAccess` intact for other callers.
- **Fix style:** replace-in-place · **+6 / −4** · **Risk: medium** (touches access gating — test entitled vs non-entitled).

#### F4 · Stop `SELECT n.*` shipping `raw_text` to students  🔒 also closes a data leak **[dist]**
- **Why:** both detail reads use `SELECT n.*`, which pulls `raw_text` (admin authoring source). `mapStudentNote` spreads it (`...note`) into the response, so **students actually receive the admin source text** (up to ~16–50 KB) on every open. `studentList` already avoids this by listing columns explicitly.
- **Change (REPLACE, preferred):** replace `SELECT n.*,` in `studentFindOne` (line **488**) and `studentFindByLesson` (line **518**) with an explicit column list that includes `n.note_data` but omits `raw_text`:
  ```sql
  SELECT n.id, n.title, n.note_data, n.engine_key, n.course_id, n.topic_id, n.subtopic_id, n.lesson_id, n.video_url, n.is_free, n.status, n.created_at, n.updated_at,
  ```
  Mirror in `dist/.../ai-notes.service.js` (~lines 362, 392). *(Alternative one-liner: add `rawText: null,` in `mapStudentNote` before line 1657 — closes the leak but still fetches the column. The explicit list is strictly better.)*
  Do **not** touch `deserialize` (1534) or the flashcard-generation path — those legitimately use `raw_text` server-side.
- **Fix style:** replace-in-place · **+4 / −2** · **Risk: low**

#### F5 · Log corrupt `note_data` instead of silently blanking the lesson  🐛 storage safety **[dist]**
- **Why:** `deserialize` (1530) and `extractFlashcardSourceText` (886) both do `catch { noteData = null; }` — a truncated/corrupt blob silently renders a **blank lesson** with no log, no signal. Silent data loss.
- **Change (EDIT 2 lines):** use the file's existing `console.warn('[AiNotes] …')` idiom:
  ```ts
  catch { console.warn(`[AiNotes] corrupt note_data for note id ${row.id}`); noteData = null; }
  ```
  Apply at **line 1530** and **line 886**. Behavior unchanged (still null fallback) → no UX regression. Mirror in `dist` (~1295, ~698).
- **Fix style:** edit-line · **+2 / 0** · **Risk: none**

---

### Phase 2 — Payload trim (delete dead fields)

#### F6 · Strip `diagram_prompt` (dead payload + dead generation tokens) **[dist]**
- **Why:** every section stores `diagram_prompt` (≤200 chars) and it's serialized to students, but **0 references** anywhere in `frontend/src`. The AI prompt also instructs the model to produce it → wasted tokens.
- **Change (DELETE, 5 spots — interface field is required, so all needed to compile):** in [ai-notes.service.ts](src/modules/ai-notes/ai-notes.service.ts)
  - line **30** — remove `diagram_prompt: string;` from the `NoteSection` interface
  - line **1711** — remove the `- diagram_prompt:` prompt instruction
  - line **1739** — remove the `"diagram_prompt": …` JSON-schema example line (fix the trailing comma on the line above)
  - line **1802** — remove `diagram_prompt: String(sec?.diagram_prompt || '')...` from `validate()`
  - Mirror in `dist` `.js` (1465, 1493, 1554) and `.d.ts` (line 10).
- **Note:** existing stored notes keep a harmless dead value; new notes drop it. No migration.
- **Fix style:** delete · **0 / −5** · **Risk: none** (verify `tsc` passes — the interface edit is what makes it compile).

#### F7 · Stop duplicating `visual_style` onto every page **[dist]**
- **Why:** the page-splitter writes `visual_style` on **every** page (line 1773), but the reader only reads it from the merged first page → pages 2+ are redundant.
- **Change (REPLACE 1 line):** at [ai-notes.service.ts:1773](src/modules/ai-notes/ai-notes.service.ts):
  ```ts
  ...(i === 0 ? { visual_style: result.visual_style } : {}),
  ```
  Mirror in `dist` (~1524). If `tsc` complains that pages 1+ miss a required field, keep the property always-present or relax `NoteResult.visual_style` to optional — decide from the build output.
- **Note:** only saves payload on **new** notes; old notes keep duplicates harmlessly (reader ignores them).
- **Fix style:** replace-in-place · **+1 / −1** · **Risk: low**

---

### Phase 3 — Pure dead-code deletion (no behavior change, big LOC win)

> All verified to have **zero callers** (grep-confirmed). These align directly with "delete codes." Easiest to do as one batch, then a single `npm run build`.

| ID | Delete | Location | LOC removed |
|---|---|---|---|
| **F-DC1** | Legacy generation chain: `generateWithGemini` (1065-1115 — **stop before 1116**, keep `generateWithGeminiProvider`), `generateWithOpenAi` (1160-1208), `sendOpenAiCanvasPrompt` (1210-1250) | ai-notes.service.ts | ~120 |
| **F-DC2** | `resolveOpenAiConfig` (1400-1433) — orphaned once DC1 lands | ai-notes.service.ts | ~34 |
| **F-DC3** | `resolveGeminiKey` (1377-1398) — orphaned once DC1 lands | ai-notes.service.ts | ~22 |
| **F-DC4** | `requireStudentAiNotesAccess` (155-181) + unused `SubscriptionFeatureRow` type (48) | ai-notes.service.ts | ~27 |
| **F-DC5** | `GET admin/lesson-canvases` handler (controller 162-166) + `getLessonCanvases` (service 601-609) | ai-notes.* | ~14 |
| **F-DC6** | `GET admin/hierarchy/lessons` handler (controller 238-242) + `getLessons` (service 611-620) | ai-notes.* | ~12 |

- **Keep:** `isUnsupportedOpenAiJsonModeError` (1370) — still used by live paths (1022, 1262); `HierarchyRow` (73) — used by `getCourses/Topics/Subtopics`.
- **All [dist]:** regenerate `dist` `.js` + `.d.ts` + `.js.map`. **Risk: low** (the live path `generate → generateWithProvider → generateWithGeminiProvider/generateWithChatProvider` is untouched — smoke-test admin note generation after).

#### F-DUP1 · Collapse duplicated SELECT projection + mapping tail (optional cleanup) **[dist]**
- **Why:** `studentFindOne` and `studentFindByLesson` share a byte-identical projection fragment (493-497 == 523-527) and tail (506-510 == 542-546).
- **Change (REPLACE):** extract one private `STUDENT_DETAIL_PROJECTION` string const + one `mapStudentDetailRow(row, hasNotesAccess, accessProfile)` helper; call from both. Keep the per-method `effective_*`/JOIN/WHERE blocks (they genuinely differ).
- **Fix style:** replace-in-place · **+12 / −28** · **Risk: medium** (preserve exact column order/aliases). Do this **after** F2/F4 to avoid re-editing the same lines twice.

---

### Phase 4 — HTTP conditional requests (kills repeat downloads)

#### F8 · ETag + `304 Not Modified` + `Cache-Control: private` on the two heavy GETs **[dist, rebuild]**
- **Why:** no validator headers today → every refresh/revisit re-downloads the full ~900 KB even when unchanged. The note already carries a perfect cheap validator: `updatedAt` (mapper line 1553).
- **Change (REPLACE the two handler bodies, ~+14):** in [ai-notes.controller.ts](src/modules/ai-notes/ai-notes.controller.ts) for `studentFindOne` (278-281) and `studentFindByLesson` (268-271):
  - add imports `Res`, `Headers` (from `@nestjs/common`) and `createHash` (from `crypto`)
  - take `@Res({ passthrough: true }) res` and `@Headers('if-none-match') inm`
  - `const etag = 'W/"'+createHash('sha1').update(`${id}:${engineKey}:${result.updatedAt}:${result.approvedFlashcardCount}`).digest('base64url')+'"';`
  - if `inm === etag` → `res.status(304).end(); return undefined;` else `res.setHeader('ETag', etag); res.setHeader('Cache-Control','private, no-cache'); return result;`
- **Notes:** fold `approvedFlashcardCount` into the ETag so a newly-approved card invalidates the cache (avoids stale 304). `passthrough:true` keeps gzip working on the 200; `res.status(304).end()` bypasses gzip cleanly (empty body). The new `@Res`/`@Headers` params require emitted decorator metadata → **regenerate dist via `npm run build`** (don't hand-edit). Confirm the client reuses its cached body on 304 (browser `fetch` does this automatically; verify the Capacitor app doesn't treat 304 as empty/error).
- **Fix style:** replace-in-place · **+14 / −2** · **Risk: low**

#### F-FE1 · Stop CourseDetailPage downloading the 900 KB canvas just to read a title  **[fe]**
- **Why:** `handleOpenLesson` calls `getLessonAiNote(lesson.id)` (`CourseDetailPage.jsx:956`) only to read `courseTitle` + `id`, then **discards `noteData`** — so tapping a lesson downloads the full canvas **twice** (here, discarded; again on the reader route).
- **Change (DELETE/REPLACE, frontend only):** promote the existing catch-branch fallback to the primary path:
  ```js
  const noteRows = await listAiNotes().catch(() => []);
  let matchingNote = resolveLessonCanvas(noteRows, course, lesson);
  if (matchingNote && !noteMatchesCourse(matchingNote, course)) matchingNote = null;
  ```
  `listAiNotes` uses the slim `NULL AS note_data` payload and already exposes `id` + `courseTitle`. Keep `getLessonAiNote` only as a null-fallback if `resolveLessonCanvas` returns nothing (covers a just-published lesson not yet in the 30 s list cache). Leave `AiNotesPage.jsx:2413` untouched (it genuinely needs the canvas).
- **Fix style:** replace-in-place · **Risk: low** · saves ~900 KB per lesson tap. Run `npm run cap:sync`.

---

### Phase 5 — Optional, do after measuring

#### F9 · In-memory parsed-`note_data` cache (the "save it parsed" idea, in RAM) **[dist]**
- **Why:** `JSON.parse` of up to 900 KB runs on every read producing an identical object (note_data only changes on admin save). A tiny memoization skips repeat parses of hot lessons. *(Note: gzip + the index already address most latency, and this adds the most new code — hence optional.)*
- **Change (ADD ~10 lines):** a `Map` keyed by `${id}:${engine_key}:${updated_at}` holding the parsed object, checked in `deserialize` before `JSON.parse`; FIFO-capped (~50 entries). **Invalidate explicitly** in `adminUpdate` (after the successful UPDATE) by deleting keys starting with `${id}:` — required because MySQL `TIMESTAMP` is 1-second resolution and two saves in the same second can collide on the key.
- **Security:** cache the **shared** parsed content only; **always** keep the per-request access check (`canAccess`) and per-user progress fresh — never serve cached content without re-verifying permission. The cache lives in server RAM (same trust boundary as the DB) → no new attack surface.
- **Fix style:** add-small-helper · **+~10 / −1** · **Risk: medium**

#### F-DB2 · Add an `engine_key`-leading index **[dist]**
- **Why:** every query filters `engine_key = ?` but it's unindexed / non-leading.
- **Change (ADD 1 line):** after F1's index, add `ensureIndex(... 'idx_ai_notes_engine_pub_status', 'engine_key, is_public, status, updated_at')` (also satisfies `ORDER BY updated_at DESC` in the list queries). Don't edit the existing index entry (ensureIndex matches by name). · **+1 / 0** · **Risk: low**

#### F-DB4 · Explicit `utf8mb4` charset (hardening only) — **prefer DB-level**
- CREATE TABLE statements declare no charset. Don't patch only 2 of 32 tables (creates inconsistency). **Preferred:** run once at the DB level — `ALTER DATABASE <db> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` — covers all current + future tables, zero code churn. Only fires for fresh installs otherwise. **Risk: low, low urgency.**

---

## 3. LOC ledger (delete-heavy, as requested)

| Bucket | Added | Removed |
|---|---:|---:|
| DB indexes (F1, F-DB2) | +2 | 0 |
| Read-path waste (F2, F3, F4, F5) | +12 | −8 |
| Payload trim (F6, F7) | +1 | −6 |
| Dead code (F-DC1…6) | 0 | ~−229 |
| Dedup refactor (F-DUP1) | +12 | −28 |
| HTTP caching (F8) | +14 | −2 |
| Parse cache (F9, optional) | +10 | −1 |
| **Total** | **~+51** | **~−274** |

➡️ **Net ≈ −223 lines.** The plan mostly **removes** code.

---

## 4. Expected before → after

| Scenario | Before | After | From |
|---|---|---|---|
| **First open of a lesson (cold)** | ~1,000 ms (table scan + 5 queries + raw_text + flashcards) | ~300–450 ms | F1, F2, F3, F4 |
| **Refresh / revisit (unchanged)** | ~1,000 ms (full 900 KB) | ~30–80 ms (`304`) | F8 |
| **Tap lesson from course page** | downloads 900 KB twice | downloads once | F-FE1 |
| **Repeat open of a hot lesson** | re-parses 900 KB each time | parse once, reuse | F9 (optional) |

> Numbers are estimates from the code (no index, 900 KB blob, 5 uncached queries). **Measure one real cold-load before/after F1** to confirm.

---

## 5. Security & data-safety notes

- **F4 is also a fix:** students currently receive admin `raw_text`. The explicit column list closes that exposure.
- **F9 caching is safe** *if* access is re-checked on every hit and only **shared** content is cached (never per-user progress, never tokens). RAM cache sits inside the same trust boundary as the DB → no new attack surface.
- **F8 must use `Cache-Control: private`** (never `public`) so no shared proxy/CDN mixes one user's response into another's.
- No fix caches secrets, tokens, or payment data.

---

## 6. Recommended rollout order

1. **F1** (index) — measure cold-load before/after. *Headline.*
2. **F2 + F4 + F5** — pure delete/replace, low risk, immediate payload + query savings.
3. **F3** — merge access queries (test gating).
4. **F6 + F7** — payload trim.
5. **F-DC1…6 (+ F-DUP1)** — one dead-code batch + `npm run build`.
6. **F8 + F-FE1** — conditional requests + frontend over-fetch.
7. **F9 + F-DB2 + F-DB4** — optional, after measuring.

**Per batch:** edit `.ts` → `cd backend && npm run build` (regenerates `dist`) → `grep` to confirm `dist` updated → commit `.ts` + `dist` → push `v4` → pull + restart on server. Run the per-fix verify steps above.

---

## 7. Rejected (do not pursue)

- **Gzip "raw payload" concern** — gzip is correctly wired (main.ts:419-453) and the app uses browser `fetch` (always sends `Accept-Encoding: gzip`); the uncompressed path doesn't exist here.
- **Removing the `approved_flashcard_count` COUNT subquery** — keep it; once F2 unbundles flashcards it's the cheap source for the deck-size badge.
- **`lesson_flashcards(note_id,status)` index** — already exists (inline in CREATE TABLE).
