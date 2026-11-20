# Database and Performance Optimisation Plan

A living document. **Update it every time** something is measured, planned, built, committed or deployed.
We plan everything here first, then implement it together.

- **Last updated:** 2026-11-15
- **Branch:** v6.5
- **Pushed:** `c777b58a`
- ⚠️ **The live server still runs `1a010762` (12 Nov).** It has none of the fixes in section 2. Pull them first.
- **Why this exists:** the shared host (MariaDB 11.4, CloudLinux Governor) restricts the account when queries use too much CPU or disk. A restricted account drops to **1 database connection**, which caused errors and sign-outs.

---

## Background: what we know about the server overload

Collected from earlier investigations, kept here so the plan stands on its own.

**The host and the restriction**
- Shared cPanel hosting (WebHostNode, `node44`), **MariaDB 11.4 `cll-lve`**, which is CloudLinux with the **MySQL Governor**.
- The app's database user is `xyndrome_xynapp`. Its real connection cap is **25** (`@@max_user_connections`, measured 13 Nov). The old "8 connections" belief was a misreading.
- **Host email (13 Nov):** the drop to **1 connection** is an automatic, temporary restriction applied when database **queries use too much server resource**. It lifts after a while and comes back if the load continues. So the trigger is query load, not connection count, and pool size alone isn't the fix. The host gave no threshold or duration.
- The restriction hits the **whole cPanel account**: phpMyAdmin's `cpses_…` user got the same "current value: 1". Big phpMyAdmin exports and imports count as load too.
- **cPanel Resource Usage doesn't show it.** The Governor is separate from the account's CPU, memory and I/O limits.
- **Per database user: at most 7 concurrent connections** (user, 14 Nov). One Node.js process runs the app.
  - The pool size comes from `.env` (`DB_CONNECTION_LIMIT`; code default 4 if unset). Nothing is hard-coded.
  - During a restart the old and new process overlap for a moment, so two pools must fit under the cap with one spare: **pool ≤ floor((cap − 1) / 2) = 3 for a cap of 7**. A pool of 7 would let one restart overlap reach 14.
  - New optional `.env` setting **`DB_MAX_USER_CONNECTIONS`** (the host cap, e.g. 7). When set, `database.config.ts` lowers the pool to that safe size and logs a warning if `DB_CONNECTION_LIMIT` is higher.
  - **Rule for all code: one request uses at most one connection at a time.** No parallel database calls (`Promise.all` of queries), and never ask for a second connection while holding a transaction one. Long jobs run as small sequential requests (see "Fix counts").

**How the app runs on live**
- Repo at `/home/xyndrome/repositories/lms`, run by LiteSpeed Node (`lsnode`) through cPanel Setup Node.js App (`backend/app.js` → `dist/main.js`).
- Restart with `touch backend/tmp/restart.txt`. Errors go to `backend/stderr.log`.
- **The host restarts the app about every 295 s**, so every in-memory cache empties and the app cold-starts about 290 times a day.
- **Deploy = the committed `backend/dist`** (no build on the server): git pull + restart. Edit `.ts` **and** compile into `dist`, then commit both.
  - Build trap: with `incremental: true`, a stale `tsconfig.build.tsbuildinfo` makes `tsc` emit nothing while exiting 0. Delete it, or compile with `--incremental false`.
  - A watching dev server (`nest start --watch`) rewrites `.d.ts` files in `dist`; restore the ones whose `.js` didn't change before committing.
- `SCHEMA_SYNC=0` on live: the full schema sync is skipped, and only the critical steps run, **once per `CRITICAL_SCHEMA_VERSION`**. **Bump it whenever a step is added**, or live never runs the new step.
- **Cloudflare** sits in front and can cache a `Cache-Control: public` reply after a deploy (use `?v=` to bypass).
- The **old keep-warm cron is gone** (crontab empty on 13 Nov). `public_html/keepwarm.php` still exists; check whether anything calls it.
- **Don't probe the live site with repeated requests:** the host firewall blocks the source IP. Reproduce locally (backend on port 3200 or 3000 with the local `lms_db`), and for live facts ask for one command on the server.

**Incident timeline and causes found**
- **12 Nov:** limit errors, and admins signed out. The cause was the server answering **401** when the database refused a connection, so the web cleared the login. Exam submit could deadlock the pool, because it held a connection while asking for another.
- **8–10 Nov:** a Q-bank import (active SBA questions ≈1,360 → 5,852) made the old daily question's two full scans about 4× heavier (≈160k row reads per student dashboard load).
- **13 Nov:** fixes committed (`4d7d149a`, `c073c950`, `c777b58a`), then confirmed **not pulled** on live, which still ran `1a010762` on 14 Nov.
- **14 Nov 00:06–00:08:** limit errors with **zero traffic**. The likely cause is the old per-restart startup maintenance: ≈80 queries including ≈30 `INFORMATION_SCHEMA` lookups, an `ALTER TABLE` and an `UPDATE`, about 290 times a day.
- Other heavy spots found:
  - admin dashboard ≈31,500 rows per open
  - Assessments ≈38,000 rows per open
  - notifications ≈1,100 rows per app open
  - drug spin `ORDER BY RAND()` with a disk scratch table
  - push sending 2 settings reads per phone, all at once
  - lesson reorder: 1 update per lesson, all at once
- **Older history (June):** slow cold boots of about 20 s from 241 schema checks on every boot (fixed by `SCHEMA_SYNC=0`); about 1 s of API latency per call dominated the app's speed.

**Measuring:** see section 7 and the before → after rule in section 0. Local slow log at 0 s with logging on **before** the backend starts, then restored. Index tests on temporary copies use `ANALYZE` `r_rows`.

---

## 0. The goal for the whole app

> **Exact queries, no waste, no repeats.** Every query reads only what it returns (**examined = returned**), runs **once** per need, and only when a screen actually needs it. The only exceptions are cases that really need more, and those are handled carefully.

**The three targets**

| Target | Meaning |
|---|---|
| **1. Exact** | Each query asks for exactly the rows and columns the screen shows. No `SELECT *`, no lesson body in lists, no "load everything and filter in the app". |
| **2. No waste** | **Rows examined = rows returned.** The database never reads rows it then throws away (no full scans, no sorting without an index, no hidden counting). |
| **3. No repeats** | The same question isn't asked twice: not twice in one request, not on every page open when the answer hasn't changed, not once per phone or lesson when once is enough, and not again after every restart. |

**Repeats and waste already found (fix them all)**

| Repeat or waste | Where | Fix |
|---|---|---|
| The same subscription check run 3× in one request | `/quiz-attempts/quizzes` (measured) | Check once per request and pass the result on |
| Session looked up twice per request | Old server code (entrance + service) | 10-second session memory (`c777b58a`, not on live) |
| Student web Lessons requested twice (gemini + openai) | `aiNotes.api.js` | One request (4.4) |
| Notifications list (≈1,100 rows) rebuilt on every app open | Web boot, Flutter dashboard | Last 5 by id, load on open, device copy (4.8) |
| All lessons downloaded to show one subject | Admin Structure | Per subject (4.9, done locally) |
| All 8 editor lists loaded to show folders | Admin Assessments | Courses + subjects only (4.2) |
| 11 dashboard queries for 4 numbers | Admin dashboard | 4 totals, stored or cached (4.1) |
| ≈80 maintenance queries on every restart | Old startup code | Once per version (`c777b58a`, not on live) |
| Push settings read twice **per phone** | Publish → push | Read once per publish (section 5) |
| One `UPDATE` per lesson, all at once | Lesson reorder | ✅ **Fixed locally 2026-11-14:** gap ranks, 1 statement per move (4.9 "Gap ranks") |
| Drug settings/subscription/spin count read per spin | Drug randomizer | From memory and the sign-in check (section 5) |
| Same catalog built per student | Lessons, courses, quizzes | Shared cache, built once (done in new code) |
| `SELECT *` in 12 queries (whole rows incl. long text, never index-only) | flashcards ×2, drugs, announcements ×2, ECG ×3, OSCE ×2, auscultation, lesson row loader | ✅ **Fixed locally 2026-11-14:** each lists exactly the columns its code uses. Raw-row endpoints list every table column, so replies are unchanged (verified: drug, ECG, auscultation, announcements, notifications, flashcard stats, OSCE case). No `SELECT *` left in `backend/src` |
| Lessons code re-checked the session token after the API entrance | `lessons.service.ts` `resolveToken` | ✅ **Fixed locally:** reuses the 10-second session memory |
| Structure page counting on every open | Admin Structure | ✅ **Fixed locally:** stored counts (4.9 phase 2) |

**Target per query (rows examined)**

| Query kind | Examined, per query | Ratio examined : returned |
|---|---|---|
| Lookup by id / key (lesson, session, plan, setting) | **1–3** | 1 : 1 |
| A student's own data (progress, attempts, bookmarks) | **≤ 50** | ≈ 1 : 1 |
| A list on screen (one subject's lessons, a page of quizzes, last 5 notifications) | **≤ 50**, one page | ≈ 1 : 1 (up to 2 : 1 with a small join) |
| Shared lists (catalogs, course tree) | Any size, but **built once and cached** | ≈ 1 : 1 when built |
| Counts and totals | **1** (stored) or **0** (cached) | 1 : 1 when stored |
| Allowed exceptions (below) | As needed | Only with the listed handling |

Per request: a student request should total about **≤ 100 rows examined**, an admin page request about **≤ 200**.

**Hard rule (user, 2026-11-14): only lists may read many rows**

| Query | Rows examined | Rows returned |
|---|---|---|
| **List or page load** (a subject's lessons, a page of quizzes) | as many as the list shows | **= examined** |
| **Everything else** (lookups, checks, saves, moves, counts) | **under 5** | **= examined** (writes: rows changed instead) |

A list may be big, but it never reads rows it doesn't show. Anything that isn't a list stays under 5 rows. Writes have no "returned"; they show rows changed.

Allowed exceptions, each rare and listed: the gap-rank **respread** (≈ one topic's lessons, only when a gap runs out), the manual **"Fix counts"** recount (only when an admin presses it), and the **3 history inserts** on create (0 rows examined each). There is no automatic recount any more (removed 2026-11-14).

**Allowed exceptions (examined > returned), and how each is handled**

Some answers truly need more rows read than returned. These are allowed **only** when listed here with their handling:

| Case | Why it can't be 1:1 | Required handling |
|---|---|---|
| **Counts and totals** (lessons per course, totals on the dashboard) | Must read every counted row | **Store the count** (updated in the same transaction as the change) or **cache** it; never recount on every open |
| **Grouped stats / reports** (per day, per topic averages, Reports page) | Must read the whole range | Admin only, cached, ideally precomputed; never on a student path |
| **Search** (text search across lessons/questions) | Must check many rows | Use an index that fits (prefix match or full-text), with limits, and on demand only |
| **Random pick** (drug spin, question of the day) | Must choose from the whole set | Shuffle **ids only** (small, in memory), then fetch the chosen rows by id; cache the pick (daily question) |
| **Small lookup joins** (lesson + its topic name) | +1 row per joined name | Fine when it's by primary key and small (e.g. 29 lessons → about 34 rows) |
| **Small tables** (a handful of courses/plans) | The database may scan instead of using an index | Acceptable while tiny; check again as they grow |

Any new exception must be added to this table with its handling **before** it goes live.

**How every change is checked against the goal**
1. **Measure BEFORE, before touching anything.** Capture the real SQL for the screen or action (local slow log at 0 s, with logging switched on before the backend restarts, then restored). Record per request: queries, rows examined → returned, reply KB, SQL ms, cold and warm.
2. For each query: is it **needed**? Is it the **only** time it runs for this need? Is **examined ≈ returned**?
3. If not, fix it (index, rewrite, cache, store, or remove), or add it to the exceptions table with its handling.
4. **Measure AFTER the same way** (same steps, same data, cold and warm).
5. **Compare side by side** in a table: step | before | after. Add a third column (earlier → current → proposed) when an earlier version matters. Include the whole-visit total, and mark estimates with ≈.
6. Record the before → after table in this file.

**Reporting format (always):** every number shown is labelled as **Requests · Queries · Rows examined · Rows returned**.
- Writes (UPDATE / DELETE / INSERT) show **Requests · Queries · Rows examined**; "returned" doesn't apply.
- Background work (for example the structure recount after a save) gets its own line, never folded into a total.
- Never write a bare "4 → 4".

---

## 1. Rules for every query

| Query type | Budget |
|---|---|
| A student opening something (lesson, progress, quiz) | ≤ 1,000 rows examined, ≤ 50 returned, using an index |
| Lists | Up to about 200 short rows at once; beyond that, or for lists that keep growing, pages of 50 |
| Shared data (catalogs, totals, lists that are the same for everyone) | Run once and cache, never per user |
| Big scans (reports, exports, analytics) | Admin only, cached, or at quiet times |
| Full content (lesson body, PDFs) | Only when the item is opened, never in lists |

**Notes**
- These are review guidelines, **not limits enforced in code**. Never cut results silently, and never use `LIMIT ROWS EXAMINED`: it returns partial results with only a warning.
- The Governor measures **total load over time**: rows examined × how often the query runs.
- **Cold start counts most.** The host restarts the app about every 5 minutes, which empties every in-memory cache. Measure and plan the cold case first.
- **Check every new query with `ANALYZE`.** `type = ALL` on a big table (questions, lessons, quiz_attempts) must be fixed before going live.

---

## 1A. Target: maximum optimisation (rows examined → returned)

The goal for every frequent query is **examined ≈ returned**: the database reads only what it sends back. Counts can't be 1:1, so they are **stored** (or cached).

**"Maximum" means all of these together:**
- matching indexes
- **stored counts** (updated on every add, move or delete)
- pages of 50 using "after id X" (keyset), not `OFFSET`
- slim lists (no lesson body)
- nothing loaded that the screen doesn't show

Today's figures are measured locally; the maximum figures are estimates from those measurements.

**Admin**

| Action | Today: examined → returned | Maximum | Needs |
|---|---|---|---|
| Dashboard (4 requests) | ≈31,500 → 149 | **≈70 → 70** | Only the 4 totals, from stored counts (4 → 4); subscriptions index `created_at` + features once (≈55 → 55); pending requests with a limit (≈7 → 7); users summary from stored counts + date range (≈5 → 5) |
| Structure, open | 9,398 → 1,530 (now 1,543 → 14 cold, 9 → 5 warm) | **≈4 → 4** | `courses.sort_order` + index; stored `lesson_count`, `subject_count` on courses |
| Structure, click a course | 228 → 16 (now 781 → 33 cold) | **≈16 → 16** | Stored `subtopic_count`, `lesson_count` on topics (subjects) |
| Structure, click a subject | 5 → 5 (now 93 → 35) | **≈34 → 34** | Already near minimum (topics + that subject's lessons) |
| Admin Lessons, open | 8,966 → 1,486 (951 KB) | **≈50 → 50** | Course and subject summary from stored counts; lessons per subject on click (≈29 → 29) |
| Assessments, open | 38,280 → 9,075 | **≈51 → 51** | Courses + subjects only; folder counts stored |
| Assessments, a subject page | 386 → 50 | **≈50 → 50** | Index matching the filter + sort |
| Assessments, next page | 436 → 50 | **≈50 → 50** | Keyset paging ("after id X") instead of `OFFSET` |
| Assessments, one assessment | 41 → 21 | **≈21 → 21** | Existing quiz-question index |
| Questions, Users, Subscriptions lists | not measured | **≈50 → 50 per page** | Pages + filter indexes; counts stored or cached |

**Students** (these run most, so they matter most)

| Action | Maximum | Source |
|---|---|---|
| App restart (startup check) | 1 → 1 | Measured design (2 tiny queries) |
| Sign-in check, every request | 2 → 2 | With index 4.7 step 2b |
| Open the app, notifications (device copy + "anything new?") | 2 → 0 | Measured |
| Notifications list (last 5) | ≈12 → ≈7 | Measured parts |
| Open a lesson | 2–3 → 2–3 | Measured, already ideal |
| Open a course (tree cached) | ≈0–50 | Only the student's own progress |
| Drug batch (5 drugs, ids in memory) | ≈6 → 6 | Estimate |
| Premium check (active plan) | 1 → 1 | Measured with index 4.7 step 2b |

**Visits, today → maximum**

| Visit | Today | Maximum |
|---|---|---|
| Admin dashboard | ≈31,500 | ≈70 |
| Admin Structure (open + course + subject) | 9,631 (2,417 after 4.9) | ≈54 |
| Admin Lessons (open + subject) | ≈8,966 | ≈80 |
| Admin Assessments (open + subject + next + one) | ≈39,000 | ≈170 |

**Stored counts: the trade-off.** Cached counts are usually cold on this host, because restarts happen every ~5 minutes. Stored counts give the minimum every time, but every add, move or delete of a lesson, topic, subject or question must also update the numbers, in the **same transaction**. A small "recount everything" admin tool or startup step should be able to fix the numbers if they ever drift. Decide per count; start with the ones read on every admin open (course cards, subject rows, Assessments folders).

---

## 1B. Careful index work (how to do it safely)

Indexes are the main tool for examined ≈ returned, but a wrong or extra index costs every write and may not be used at all. For every index change:

1. **Start from a real query.** Capture the actual SQL (slow log at 0 s locally). Never add an index without a query that needs it.
2. **Column order:**
   - exact-match columns first (`user_id = ?`, `status = 'active'`)
   - then the sort or range column (`end_date`, `created_at`, `sort_order`)
   - then `id` as a tie-breaker
   - An index on `(a, b, c)` serves searches on `a`, `a + b` and `a + b + c`, **not** `b` alone.
3. **One combined index beats two single ones** when the query filters on both (measured: 5–6 → 1 rows for subscriptions).
4. **Keep the column bare in the query.**
   - `DATE(created_at) = today`, `COALESCE(a, b) >= …` and `ORDER BY RAND()` can't use an index.
   - Rewrite instead: a date range, `ORDER BY id`, or shuffle ids instead of rows.
5. **Indexes don't fix counts or wide ranges.** `COUNT(*)` and "per day over 90 days" still read every matching row. Use stored counts, caching, or remove the query.
6. **Small tables ignore indexes.** With a few hundred rows MariaDB often scans and sorts anyway (seen on courses, users, subscriptions). Such indexes are for growth, so judge them at expected size.
7. **Test on a temporary copy, measure with `ANALYZE`.**
   - Use `CREATE TEMPORARY TABLE x LIKE t; INSERT … SELECT`, add the index, then compare `ANALYZE` `r_rows` × loops before and after.
   - The `Rows_read` counter ignores temporary tables, so don't use it for these tests.
   - Keep the index only if a real query reads fewer rows or skips a sort.
8. **Compare with live first.** Run the index-list query (4.7 step 1); live and local can differ.
9. **Change live with one idempotent SQL file**: check before adding or dropping, run at a quiet time in phpMyAdmin, one batch at a time. Tables here are small, so each change takes seconds.
10. **Don't over-index.**
    - Every index slows inserts and updates.
    - Drop exact duplicates and left-prefix duplicates (4.7 steps 3–4).
    - Never drop `PRIMARY` or `UNIQUE` indexes.
    - Before dropping an index that backs a foreign key, make sure another index starts with that column (error 1553).
11. **Re-check after deploy.** `ANALYZE` the target query on live (read-only) to confirm the new index is used.

**Index and schema work needed for the maximum (to plan in detail before building)**

| Table | Change | Serves |
|---|---|---|
| `user_subscriptions` | `(user_id, status, end_date)` | Premium checks, sign-in plan lookup (4.7 step 2b, approved) |
| `users`, `user_subscriptions` | `(created_at, id)` | Dashboard sign-ups and subscriptions list (4.7 step 2c, approved) |
| `courses` | `sort_order` + `(sort_order, id)`; stored `lesson_count`, `subject_count` | Structure, Lessons, course pickers |
| `topics` (subjects) | Stored `subtopic_count`, `lesson_count` | Structure and Lessons subject rows |
| `quizzes` / `questions` | Index matching the Assessments filter + sort; keyset paging | Assessments subject pages |
| Schema steps | Add the columns in the once-per-version startup checklist and **bump `CRITICAL_SCHEMA_VERSION`** | All of the above |

---

## 2. Committed and pushed (⚠️ not on the live server yet)

| Commit | What |
|---|---|
| `4d7d149a` | A busy database answers **503 instead of 401**, so students aren't signed out (`main.ts`, `database-exception.filter.ts` with `ER_USER_LIMIT_REACHED`). Exam submit: questions loaded **before** the transaction connection is taken; XP awarded after `release()`; same in `finalizeExpiredExamSession`. The web and Flutter clients treat `DATABASE_UNAVAILABLE` as busy. |
| `c073c950` | About 62% fewer database reads on cold start; Reports completions fixed. |
| `c777b58a` | Idle connections close (maxIdle 1, idleTimeout 10 s, pool ended on shutdown). Startup schema steps run once per `CRITICAL_SCHEMA_VERSION`. Daily question cached until midnight, about 7 rows. |

**Live check, corrected 14 Nov:**
- The server still runs `1a010762`: `git log` on the server, and `ER_USER_LIMIT_REACHED` count 0 in the deployed filter. The 13 Nov "no errors since the fixes" reading was wrong; it was just a quiet day.
- New limit errors at 14 Nov 00:06–00:08 with **zero traffic** in the access log, and again around 00:38. The account was restricted to 1 connection.
- **Most likely cause:** the old code's startup maintenance (`ensureCriticalTables`, ≈80 queries including about 30 `INFORMATION_SCHEMA` lookups, an `ALTER TABLE` and an `UPDATE`) runs on **every** restart, about every 295 s, around 290 times a day.
- `c777b58a` runs it once per version. Only the host's Governor log can confirm the cause.

---

## 3. Written, not committed (the pending batch)

| File | Change |
|---|---|
| `backend/src/common/utils/admin-read-cache.ts` (new) | `cachedAdminRead()`, cleared on every content write (`main.ts`) |
| `dashboard.service.ts` | Admin dashboard growth charts use the admin cache |
| `questions.service.ts`, `quizzes.service.ts` | Counts and editor meta use the admin cache |
| `quiz-attempts.service.ts` | Shared active-quiz catalog |
| `courses.*`, `plans.*` | Public pages: `Cache-Control` headers + 60 s memory |
| `frontend/.../StructurePage.jsx` | Earlier topic-divider change (**review before committing**), plus the 4.9 rework: per-subject lessons, collapsed subjects, one-line rows |
| `lessons.controller.ts`, `lessons.service.ts`, `aiNotes.api.js` (+ `backend/dist/modules/lessons/*`) | 4.9: `structure` endpoint (the `structure-counts` one was removed in phase 2) |
| `structure-counts.ts` (new), `main.ts`, `schema-sync.service.ts` (version `2026-11-14.2`), `courses.service.ts`, `topics.service.ts` | 4.9 phase 2: stored counts, course order, two indexes, no repeated sign-in lookup |
| `flashcards`, `drugs`, `workspace`, `ecg` (×3), `osce` (×2), `auscultation`, `lessons` services | Section 0: all 12 `SELECT *` replaced with exact columns |
| `frontend/dist` | Rebuilt locally, not committed; the web "busy, retry" handling isn't live until it is |

**Limitation:** these caches only help **warm** opens. After each restart (about every 5 minutes) the first open is cold again.

---

## 4. Plan per page (not started)

Figures are from the local copy of the database unless marked live.
- **Rows read** is the session counter (the true cost, including `COUNT(*)`).
- **Cold** means the first open after the app starts.
- **(est.)** means estimated, not measured.

### 4.1 Admin Dashboard

The page sends **4 requests at once**:
- `/admin/dashboard`
- `/subscriptions/admin`
- `/subscriptions/admin/requests`
- `/admin/users/summary`

It displays only the **4 totals**. The 6 "added per day" charts, insights, recommendations and activity feed are computed but shown nowhere (web and Flutter were searched). Re-check before removing them.

**Cold start (the case that matters)**

| | Now | After steps 1–2 | After all steps |
|---|---|---|---|
| Queries | 21 (+10 Prepare) | ≈11 | ≈11 (cold is the same; caches are empty) |
| Rows read | ≈32,000 (`/admin/dashboard` alone: 30,830 live) | ≈16,500 | ≈16,500 |
| SQL time | 99.7 ms | ≈65 ms (est.) | ≈65 ms (est.) |
| Pool wait | 36.6 ms | lower (est.) | lower (est.) |
| API time | 107 ms | ≈75 ms (est.) | ≈75 ms (est.) |
| Reply | 263 KB | ≈55 KB (est.) | ≈55 KB (est.) |

**Warm (repeat opens before the next restart, or after content changes)**

| | Now, live (no batch) | After all steps |
|---|---|---|
| Rows read | ≈32,000 every open | **0** |
| Queries | 21 | ≈0 |

**Steps**
1. `/admin/dashboard` builds only the 4 totals: 1 query instead of 11. Rows read for this request go from 30,929 to 15,248, with identical totals (measured), in 5–6 ms.
2. `/subscriptions/admin`: send each plan's feature list once per plan instead of in every row. Today `enabledFeatures` is 164 KB of the 236 KB reply.
3. Cache the totals, cleared automatically on content writes.
4. Cache the subscription and user lists for 60 s, cleared when a subscription or user changes.

**Floor:** about 15,000 rows is the minimum for a cold open, because counting questions reads all ~13,100 index entries. Going lower would need a counter table maintained on every insert and delete. That's not planned.

**Files:**
- `backend/src/modules/dashboard/dashboard.service.ts` (`getAdminDashboard`)
- `backend/src/modules/subscriptions/subscriptions.service.ts`

**Rewrites on the dashboard page** ✅ approved 2026-11-14

The 18 queries the page runs were captured locally and checked with `EXPLAIN`/`ANALYZE`. Indexes can't fix the main cost (`COUNT(*)` totals and the per-day charts); steps 1–4 above do. Two queries need rewrites:

1. **Today's sign-ups** (`/admin/users/summary`, users controller/service):
   - Change `WHERE DATE(created_at) = '<today>'` to `WHERE created_at >= '<today>' AND created_at < '<today>' + INTERVAL 1 DAY`.
   - `DATE()` around the column stops any index from being used. With the range form plus `users (created_at, id)` (4.7 step 2c), only today's rows are read.
2. **Pending subscription requests** (`subscriptions.service.ts` `findAdminRequests`):
   - Today it loads **every request ever** (no `LIMIT`), filtered with `OR` conditions and sorted with `FIELD(sr.status, …)`. No index can help that, and it grows with history (≈54 rows read locally).
   - Change it to load pending requests first, then recent ones, with a `LIMIT` or pages. The page shows the latest anyway.

### 4.2 Admin Assessments

| Stage | Cold now | Cold planned |
|---|---|---|
| Open the page (meta + summary) | 11 queries, 38,280 rows examined, 245 ms SQL, 308 KB | Courses + subjects only: ≈750 rows, ≈7 ms |
| Open a subject (50 per page) | 386 rows, ~5 ms | unchanged ✅ |
| Next page | 436 rows | unchanged ✅ |

- The page uses only courses and subjects from `/admin/quizzes/meta`. The quiz editor and import page fetch their own meta.
- Categories query (`quizzes.service.ts` near line 252): rewrite with 2 indexed `DISTINCT`s, identical result, 132 → 10 ms.
- **Files:** `QuizzesPage.jsx` (`loadMeta`), `quizzes.controller.ts`, `quizzes.service.ts`.

### 4.3 Admin Lessons

| | Cold now | Planned |
|---|---|---|
| Open | 6 queries, 8,966 rows, 199–521 ms SQL, 687 ms API, 951 KB | Summary first, then one subject at a time: 2–4 ms per subject |

- **Bug:** every lesson shows "Draft". The list selects `NULL AS note_data`. Fix: return `(l.note_data IS NOT NULL) AS has_note`.
- Not cached today: every open reads about 9,000 rows.
- **Files:** `lessons.service.ts` (`canvasLessonSelect`, `canvasAdminList`, `deserializeCanvas`), `lessons.controller.ts`, `AdminAiNotesListPage.jsx`.

### 4.4 Student Web Lessons

| | Cold now | Planned |
|---|---|---|
| Open | 11 queries, 8,958 rows, 146 ms SQL, 285 ms API, **2,447 KB (2 × 1,223 KB)** | 1 request: half the reply and half the Node CPU |

- The web asks for `engine=gemini` and `engine=openai`, but the server reads `engineKey`, so both replies are identical. There are no OpenAI lessons.
- **File:** `frontend/src/shared/api/aiNotes.api.js` (`STUDENT_AI_NOTE_ENGINES`, `listStudentAiNotesAcrossEngines`). **Rank 1: smallest change, every web student benefits.**

### 4.5 Flutter Lessons

| | Cold now | Planned |
|---|---|---|
| Open | 4 queries, 8,955 rows, 90–179 ms SQL, 290 ms API, 1,202 KB | ETag / 304 when unchanged; drop unread fields |

- **Keep the full list.** Nine app features use it (search, planner, Flashcards, and others).
- **Files:** `lessons.controller.ts` / `lessons.service.ts` (`canvasStudentList`), `mobile/lib/data/api_client.dart`, `lessons_repository.dart`, `saved_first.dart`.

### 4.6 Student catalog SQL (cold only)

- Replace the per-row flashcard count with a grouped join (identical result, measured), and add a `has_content` column.
- Needs a schema step, so bump `CRITICAL_SCHEMA_VERSION`.

### 4.7 Database indexes (review and optimise)

Reviewed on the local copy, 2026-11-13, read-only. **The live index set may differ.** For example, live `questions` has no `created_at` index, but local does. So step 1 is to compare.

**How we change indexes**
- One idempotent SQL file per batch, like `backend/sql/2026-11-13_perf_indexes.sql`, which checks before adding or dropping.
- Run it on live in phpMyAdmin at a quiet time.
- Measure with `ANALYZE` before and after on the local copy, and keep an index only if a real query uses it.
- All tables here are small (the largest is 65k rows), so each change takes seconds.
- Never drop a `PRIMARY` or `UNIQUE` index: unique ones enforce data rules.

**Step 1: get the live index list** (phpMyAdmin, LMS database selected; reads metadata only, cheap)

```sql
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;
```

Export the result and compare it with local before writing the SQL file.

**Step 2: notifications, fixed in code with no new index** (now part of the full notifications plan in 4.8)

`workspace.service.ts` `listNotifications`: change `ORDER BY a.created_at DESC` to **`ORDER BY a.id DESC`**.

The primary key is already sorted, so the database reads from the newest and stops at 80. Measured locally, same 80 results:

| User | `ORDER BY created_at DESC` (now) | `ORDER BY id DESC` |
|---|---|---|
| Older user (80 notifications) | 1,019 rows read + sort, 15.7 ms | **81 rows, 2.9 ms**, identical ids |
| Newest user (0 notifications) | 1,019 rows, 3.2 ms | 1,019 rows, 3.0 ms (nothing to stop at; no sort) |

- **Safe because** id order matches `created_at` order today (0 out-of-order rows). Ids are auto-increment, so this holds as long as an announcement's `created_at` is never edited or backfilled. It also fixes the order of announcements that share the same `created_at`.
- **An index `announcements (status, created_at)` isn't needed** with this change.
- The table grows with every published quiz, lesson or flashcard set (auto-notify), so this matters more over time. This was the "notifications full scan" open item.

**Step 2b: add `user_subscriptions (user_id, status, end_date)`** ✅ approved 2026-11-14

```sql
ALTER TABLE user_subscriptions ADD INDEX idx_us_user_status_end (user_id, status, end_date);
```

- **Query it serves:** "this student's active plan, still within its dates, newest end date first". It runs in about 11 places:
  - premium checks for lessons, quizzes, exams, courses, the question bank, the planner and the drug tool
  - the sign-in check that loads the plan (`getStudentAccessProfile`)
- **Measured** on a temporary copy of the table, for the student with 28 subscription records (1 active):

  | | Rows examined | Rows returned |
  |---|---|---|
  | Now (`idx_user_subscriptions_user` merged with `idx_user_subscriptions_status`) | 5–6 | 1 |
  | With `idx_us_user_status_end` | **1** | 1 |

- Typical students go from 1–2 to 1. It stays at about 1 as subscription history grows, and needs no sort.
- **Old indexes:**
  - `idx_user_subscriptions_user (user_id)` becomes redundant, because the new index starts with `user_id`. Drop it only after testing.
  - Keep `idx_user_subscriptions_status`, since other queries may search by status alone.
- **Cost:** slightly slower subscription saves (rare) and a little disk.
- **Value:** small today (the table has ≈223 rows locally), but it grows with history.

**Step 2c: growth indexes for the admin dashboard page** ✅ approved 2026-11-14

```sql
ALTER TABLE users ADD INDEX idx_users_created (created_at, id);
ALTER TABLE user_subscriptions ADD INDEX idx_us_created (created_at, id);
```

| Index | Serves | Today | At ≈5,000 students (est.) |
|---|---|---|---|
| `users (created_at, id)` | Today's sign-ups (with the range rewrite in 4.1), latest users | No change (111 rows; the database scans small tables anyway) | ≈5,000 rows → ≈4–10 |
| `user_subscriptions (created_at, id)` | Admin subscriptions list, newest 50 (`ORDER BY us.created_at DESC, us.id DESC LIMIT 50`) | No change (≈223 rows) | Thousands → ≈50. Check with `ANALYZE` after adding; the optimizer currently starts from `plans` and may need `STRAIGHT_JOIN` to read `us` in index order |

**Measurement note:** the `Rows_read` counter doesn't count temporary tables. Index tests on temporary copies must use `ANALYZE` (`r_rows` × loops). Step 2b was re-checked that way: 1 subscription row read.

**Step 3: drop exact duplicates** (two indexes on the same columns; keep the `UNIQUE` one)

| Table | Drop | Keep (identical columns) | Why |
|---|---|---|---|
| `question_options` (65k rows) | `idx_question_options_question_label` | `unique_question_option_label (question_id, option_label)` | Every question save writes both; 4.5 MB of indexes on this table |
| `question_quizzes` (13k) | `idx_question_quizzes_question_quiz` | `unique_question_quiz (question_id, quiz_id)` | Same |
| `payment_transactions` | `idx_payment_transactions_order_id` | `uniq_payment_transactions_order_id (order_id)` | Same |
| `subscription_features` | `idx_subscription_features_key` | `uniq_subscription_features_feature_key (feature_key)` | Same |

**Step 4 (optional, low value): redundant left-prefix indexes**

An index on `(a)` is unneeded when another index starts with `(a, …)`. 19 found locally. Only these are on tables that are big or growing:

| Table | Redundant | Covered by |
|---|---|---|
| `question_keyword_map` (31k) | `idx_question_keyword_map_question_id (question_id)` | `uniq_question_keyword_map_question_keyword (question_id, keyword_id)` |
| `content_versions` (20k) | `idx_content_versions_entity (entity_type, entity_id)` | `uniq_content_versions_entity_version (…, version_number)` |
| `quiz_attempts` (grows with every exam) | `fk_attempts_quiz (quiz_id)`, `fk_attempts_user (user_id)` | `idx_quiz_attempts_quiz_user_dates`, `idx_quiz_attempts_user_status_dates` |

- Most of the others are single-column foreign-key indexes on small tables. Leave them.
- Dropping an index that backs a foreign key works only if another index starts with that column; otherwise MariaDB refuses (error 1553). Test locally first.

**Step 5: find unused indexes**

- `questions` has 12 indexes on 13k rows. Some may never be used.
- Locally, turn on MariaDB `userstat` and run the measured workflows. Then `information_schema.INDEX_STATISTICS` lists every index that was read, and any index not in that list is a drop candidate.
- This can't be done on live: it needs a privilege the host doesn't give.

**Considered and not planned**

| Candidate | Why not |
|---|---|
| `questions(created_at)`, `lessons(created_at)` (in `2026-11-13_perf_indexes.sql`, not on live) | Only the dashboard "added per day" charts use them, and the dashboard plan (4.1) removes those queries. Most rows are recent, so the index would barely help anyway |
| `content_audit_events (entity_type, entity_id, created_at)` | The evidence page's per-entity lookup already uses `idx_content_audit_entity`; the busiest entity has 40 rows |

**Already well indexed (verified)**
- Assessments subject page: 386 rows for 50 returned.
- Session-token sign-in check: `idx_users_session_token_expires`.
- Per-student lesson progress: `uniq_student_lesson_progress`.
- Exam sessions: `idx_exam_sessions_user_quiz_status`.
- Flashcard reviews: `uq_flashcard_review_user_card`, `idx_flashcard_review_user_due`.
- Question options by question.
- The question-of-the-day pick.

### 4.8 Notifications (last 5, load only when opened, subscription-expired fix)

**How it works today**

`GET /student/notifications` (`workspace.service.ts` `listNotifications`) runs 4 queries every time it's called:

| # | Query | Rows read (measured, local) |
|---|---|---|
| 1 | All of the student's dismissed keys (`notification_dismissals`) | grows forever; one user already has 180 |
| 2 | Newest 80 announcements (`ORDER BY created_at DESC LIMIT 80`) | **1,099 + sort**, 24 KB |
| 3 | Latest 3 subscription rows | 2 |
| 4 | Worst topic below 55% | 15 |

Then: merge, sort by date, keep 80.

**When it's called today, even if nobody opens notifications**
- **Web:**
  - Every session start: `/student/boot` includes it (`boot.service.ts`).
  - The header bell loads it on mount (`AppHeader.jsx`).
  - `announcementLocalSync.js` re-checks every 60 s (served from a 1-hour browser cache; it refetches when the cache expires or after "mark read").
- **Flutter:** every dashboard open. `dashboard_page.dart` watches `unreadCountProvider`, which fetches the whole list just to count unread items for the badge.

**Planned changes**

1. **Show the last 5, not 80.** `ORDER BY a.id DESC LIMIT 5`, and keep 5 after the merge. Measured: **6 rows read, 1.5 KB**, the same newest 5 as today.
2. **Check dismissals only for the items being shown.** Query 1 becomes `… WHERE user_id = ? AND notification_key IN (<the ≤6 shown keys>)`: at most 6 rows, using the existing `uniq_notification_dismissal`. Measured for the user with 180 dismissals: 180 → **5 rows**.
2a. **Subscription item: latest 1 row, read through an index.** Use `LIMIT 1` and add the index `user_subscriptions (user_id, updated_at, id)`. Today it reads all of a student's subscription rows to sort them: measured **29 rows** for the user with 28 subscriptions. After: about 1 (est.).
2b. **"Review weak topic" item: decision.** It isn't a real notification; it's a study tip computed from all of the student's exam attempts (15 rows today, growing with every attempt). Recommended: remove it from notifications. The Dashboard and Reports are better places for it.
3. **Don't load at app start; load only when the student opens the bell or the Notifications page.**
   - Web:
     - Remove `notifications` from `/student/boot` (`boot.service.ts`, `boot.api.js` seed).
     - Remove the on-mount load in `AppHeader.jsx`. The bell already loads on open (`if (!current) loadNotifications()`).
     - `StudentNotificationsPage.jsx` loads when opened (unchanged).
   - Flutter:
     - The dashboard badge must not trigger a fetch. Load in `notifications_popup.dart` (bell tap) and `notifications_page.dart` only.
     - Push notifications are unaffected (sent by the server on publish).
4. **Subscription-expired notification (bug fix).** When building the subscription item:
   - If `status = 'active'`, the plan isn't free, and `end_date < today` (or `access_expires_at` has passed), show "**<Plan> expired**".
   - Use `createdAt = end_date` and `id = subscription-expired-<end_date>`, so it sorts at the moment it lapsed and can be dismissed once.
   - It reads the same rows (no extra query) and needs no cron job and no database write. It uses the same rule as the subscriptions page's computed status.
   - Optional later: an "expires in 3 days" item using the same method.

**Option (c): cache notifications on the device** (Flutter: `SharedPreferences` via `saved_first.dart`; web: the existing browser cache)

The server stays the source of truth: the web has no APNs, pushes can be missed, and read/dismiss state is shared between devices. But the app keeps its own copy:

1. On open, the app shows the cached 5 and the badge **immediately, with no request**.
2. Then it asks only `GET /student/notifications?afterId=<newest cached id>`, which runs `WHERE a.id > ? … ORDER BY a.id DESC LIMIT 5`. Measured: **nothing new = 2 rows read, 0 rows sent**; 2 new = 4 rows read, 0.05 KB. Do this at most every 15 minutes or so, not on every dashboard open.
3. When a push (APNs or FCM) arrives, the app adds that announcement to its cache and raises the badge, with no server call. This needs the announcement id in the push payload.
4. Reading and dismissing still go to the server (writes) and update the cache at the same moment.
5. Once a day, or on pull-to-refresh, it reloads the full 5. That picks up announcements an admin deleted, and reads done on another device. After a reinstall the cache is empty and the first load gets 5.
6. The subscription item can be built from the subscription data the app already loads, so it needs no extra query.

Why the app can't rely on Apple or Google alone: APNs and FCM don't keep a history. If the phone is offline they hold only the latest notification (or a few), and iOS lets an app see only the notifications still sitting in Notification Center. Ones the student swiped away are gone. So the app has to keep its own copy.

**Decisions to make before implementing**

| Decision | Trade-off |
|---|---|
| Unread badge on the bell | With no load at start, the badge can't show a count until the student opens the bell once. Options: (a) no badge until opened (zero load); (b) a tiny unread-count query at start (≈6–11 rows); **(c) recommended: cache on the device + "only newer" check**, described below |
| "Review weak topic" item | Remove it from notifications (recommended; saves the only query that grows per student) or keep it (≈15+ rows) |
| Students with fewer than 5 notifications since signup (new students) | The query can't stop early because there aren't 5 to find, so it reads to the end: measured **1,019 rows** for the newest user (≈3 ms, no sort). It only happens when they open the bell, and stops once 5 announcements arrive after signup. Optional fix: rewrite the signup condition as `(a.created_at >= signup OR a.publish_at >= signup)` with an index on `announcements(created_at)` (`publish_at` already has one), so only rows after signup are read. Test it at implementation |
| Web `announcementLocalSync` (browser pop-ups for new announcements, only for users who allowed browser notifications) | It needs the list to detect new announcements. Options: (a) turn it off on web; (b) keep it, but it then loads the list hourly for those users |

**What students see**

| Situation | What happens (today and after) |
|---|---|
| Student **clears all** | One dismissal row per item shown (today up to 80, after up to 5). The list is empty. **Old notifications don't come back**: dismissals are applied after picking the newest 5, so the query keeps finding those same 5, all hidden. A new announcement appears on top as usual |
| Student dismisses **one** | 4 are shown; the list isn't refilled from the 6th. That's the same as today (79 of 80) |
| Student **reads** (opens or "mark all read") | One `announcement_reads` row per item. Read items **stay in the list** marked as read, until newer ones push them out of the top 5. The badge counts unread items among the 5 (today up to 80) |
| Plan ran out by date | Today: no notification; still says "active · Valid until <past date>". After: "<Plan> expired" at the date it lapsed |

**Before vs after**

| | Before | After |
|---|---|---|
| Rows read per load | ≈1,116 typical; up to ≈1,330 for a student with many subscriptions and dismissals (1,099 + 29 + 180 + 15) | **≈12** (6 announcements + ≈1 subscription + ≤5 dismissals; weak topic removed). New students with fewer than 5 notifications: ≈1,025 until the optional fix |
| Announcements | 1,099 rows + sort, 16–60 ms | **6 rows**, no sort |
| Payload | 24 KB (80 items) | **≈1.5 KB** (5 items) |
| Loaded when | Web: every session start, plus hourly cache refresh and after marking read. Flutter: every dashboard open | **Only when the student opens the bell or the Notifications page** |
| Dismissal rows added by "clear all" | up to 80 | up to 5 |
| Subscription expired by date | not shown | shown |

**Files**
- `backend/src/modules/workspace/workspace.service.ts` (`listNotifications`, `loadDismissedKeys`)
- `backend/src/modules/boot/boot.service.ts`
- `frontend/src/shared/api/boot.api.js`, `frontend/src/shared/api/workspace.api.js`, `frontend/src/shared/layout/AppHeader.jsx`, `frontend/src/shared/notifications/announcementLocalSync.js` (decision)
- `mobile/lib/features/dashboard/dashboard_page.dart`, `mobile/lib/features/notifications/notifications_popup.dart` (`unreadCountProvider`)

**Release:** the Flutter change needs an app release. The server and web changes work with the current app: it simply receives 10 items, and old app versions still fetch on dashboard open until they update.

**Related, not an index issue:** the biggest tables are `content_audit_events` (110 MB) and `content_versions` (81 MB). That size is data, not indexes. A retention rule (for example, keep 12 months of audit events and the last N versions per item) would shrink backups and memory use. That's a separate decision.

### 4.9 Admin Structure page (`/admin/structure`; admin `/courses` redirects here) ✅ implemented locally 2026-11-14, not committed

**Problem:** opening the page downloaded **every lesson** (`/admin/ai-notes`: 8,955 rows examined, 951 KB) just to show the lesson lists and counts under subjects and topics.

**What changed**

| Level | Loads |
|---|---|
| Open the page | Courses + one counts request: lessons and subjects per course |
| Click a course | Its subjects (with topic counts, unchanged) + lessons per subject (one counts request) |
| Click a subject | Its topics (unchanged) + **only that subject's lessons**: titles, order, topic, status, has-content flag, no lesson body, no flashcard counts |
| Click a lesson | That lesson's content (unchanged) |

- **Subject rows are collapsed:** they show only "N topics · N lessons". Lesson lists appear only after opening a subject, under its topic rows.
- Each subject's lessons are fetched **once per visit**. After deleting a lesson, only that subject and the counts are re-read.
- **Row layout:** everything on one line: [number] title/meta … [counts] [status] [edit delete] [›]. Very narrow screens drop the buttons to a second line.
- **Sort button:** the ↑ ↓ reorder arrows are hidden until **Sort** is pressed in the subjects or topics toolbar (it becomes **Done**). Leaving the level turns it off. The button shows only when there are 2 or more items.
- **New endpoints:**
  - `GET /admin/ai-notes/structure?topicId=` (`canvasAdminStructureLessons`)
  - ~~`GET /admin/ai-notes/structure-counts`~~: replaced in phase 2 by stored counts returned with the course and subject lists
  - Both are admin-only: no `topicId` → 400, not signed in or a student → 401.
- **Correctness:** checked for all 47 subjects and 4 courses. Same lesson ids, order, titles, topics and statuses as the old filtered full list; the counts are identical.
- **Indexes:** none needed. The per-subject list uses `fk_lessons_topic`. A tested `(topic_id, engine_key, is_public, sort_order, id)` index gave no gain.

**Measured locally** (Peadiatrics course 12, subject 52 with 29 lessons; slow log; counts include topic and lesson count queries)

| Step | Before: requests · queries · examined · returned · data | After, cold (first open after restart) | After, warm (counts cached) |
|---|---|---|---|
| **Open page** | 3 · 4 · **9,398** · 1,530 · **960.9 KB** | 2 · 5 · **1,543** · 14 · **0.7 KB** | 2 · 2 · **9** · 5 · 0.7 KB |
| Click course (subjects + "5 topics · 29 lessons" counts) | 1 · 1 · 228 · 16 · 3.0 KB | 2 · 3 · 781 · 33 · 3.2 KB | 2 · 2 · 229 · 17 · 3.2 KB |
| Click subject (topics + its lessons) | 1 · 1 · 5 · 5 · 0.6 KB | 2 · 3 · 93 · 35 · 7.1 KB | 2 · 3 · 93 · 35 · 7.1 KB |
| **Whole visit** | **5 req · 9,631 examined · 964.5 KB** | **6 req · 2,417 examined · 11.0 KB** | **6 req · 331 examined · 11.0 KB** |

Breakdown of the cold counts:
- **Open page:** lessons per course reads 1,478 index entries, subjects per course reads 47.
- **Click course:** topic counts come from `/admin/topics?courseId` (228 rows, the same as before). Lessons per subject reads 520 rows.

On live, restarts every ~5 minutes mean the counts are usually cold. That's still **6× fewer rows and 87× less data** than before.

#### Phase 2: examined = returned ✅ implemented locally 2026-11-14, not committed

**What changed**
- **Stored counts:**
  - New columns `courses.lesson_count`, `courses.subject_count`, `topics.lesson_count`, `topics.subtopic_count`.
  - Recounted by `common/utils/structure-counts.ts` after any write under `/api/(admin/)?(courses|topics|subtopics|lessons|ai-notes|setup)` (hook in `main.ts`).
  - A read waits for a recount that is running or due, so an admin always sees their own save.
  - Edits made outside the app (phpMyAdmin, SQL scripts) are picked up by the next content write.
- **Course order:** `courses.sort_order` (backfilled from title order, so the order is unchanged) + index `idx_courses_sort (sort_order, id)`. New courses go to the end. The admin list uses `FORCE INDEX`, because otherwise MariaDB scans and sorts this tiny table.
- **Subject list (`/admin/topics?courseId`):** reads the stored counts. No join, no `COUNT`; the course title is read once. The all-subjects list (no `courseId`) keeps its course join.
- **Lesson list per subject:** no subtopic join (the page already holds the topic names) and a new index `idx_lessons_topic_engine_pub_sort (topic_id, engine_key, is_public, sort_order, id)`, so lessons are read already in order with no sort pass.
- **Removed:** the `structure-counts` endpoint and its two page requests.
- **No repeated sign-in lookup:** the lessons code's `resolveToken` reuses the session the API entrance just looked up (10-second session memory).
- **Schema:** the once-per-version startup step `structure counts and course order`. **`CRITICAL_SCHEMA_VERSION` = `2026-11-14.2`.** On live it runs once on the first start after deploy; the tables are small, so it takes seconds.

**Verified locally:**
- Course counts = live `COUNT` for all 4 courses.
- Course order = the previous title order.
- Subject lists (ids, order, topic counts, course title) = the old join for every course.
- Each subject's stored lesson count = its lesson list length (all 47 subjects).
- A deliberately wrong stored count (999) corrected itself after a write request.
- The page in the browser shows the same numbers.

**Measured locally (slow log)**

| Step | Before 4.9 | 4.9, cold | **Phase 2, cold** | **Phase 2, warm** |
|---|---|---|---|---|
| Open page | 3 req · 9,398 → 1,530 · 960.9 KB | 2 req · 1,543 → 14 | **1 req · 5 → 5** · 0.8 KB | **4 → 4** |
| Click course | 228 → 16 | 781 → 33 | **17 → 17** · 3.3 KB | **17 → 17** |
| Click subject | 5 → 5 | 93 → 35 | **34 → 34** · 6.1 KB | **34 → 34** |
| **Whole visit** | **9,631 → 1,551 · 964.5 KB** | 2,417 → 82 · 11.0 KB | **56 → 56 · 10.2 KB** | **55 → 55** |

**Examined = returned at every step.** The only extras are the sign-in row on a cold request, and the course title (the 17th row on a course click).

**Files**
- `backend/src/common/utils/structure-counts.ts` (new)
- `main.ts`
- `schema-sync.service.ts`
- `courses.service.ts`
- `topics.service.ts`
- `lessons.controller.ts`, `lessons.service.ts`
- compiled `backend/dist/*`
- `frontend/src/shared/api/aiNotes.api.js`
- `StructurePage.jsx`

**Depends on** the uncommitted `admin-read-cache.ts` (section 3, still imported by other services). **Web `dist` not rebuilt.**

#### Phase 3: no repeats, lesson by id ✅ implemented locally 2026-11-14, not committed

**What changed**
1. **Course page (e.g. Medicine):** the subject list no longer re-reads the course name. The page already has it from the course card it opened. `topics.service.ts` `findAll(courseId)` is one query on `idx_topics_sort`.
2. **Opening a lesson from the Structure page:**
   - The page passes its course list, the course's subjects and the subject's topics (`structureContext` in the navigation state, active items only, `{ id, name }`) to the editor, which fills its dropdowns from them instead of fetching.
   - The server reads the lesson **alone by id** (`canvasAdminFindOne`: no course, subject or topic joins, no flashcard-count subquery). The editor never used those fields.
   - **Fallback:** opened any other way (refresh, a link, the Lessons page), or for a lesson outside the passed course or subject, the editor fetches the dropdowns as before.
3. **Remembered per visit:** each course's subjects and each subject's topics, like the lessons already were. Going back and forth inside the page doesn't ask the server again; every change (add, edit, delete, reorder) re-reads or updates the remembered list.

**Measured locally** (Medicine → Cardiology → lesson 975 / 261; slow log; rows are examined → returned; "req · q" = requests · queries)

| Page | Earlier (original) | Before (phase 2) | **After (phase 3)** |
|---|---|---|---|
| Courses | 3 req · 9,398 → 1,530 · 961 KB | 1 req · 1 q · 4 → 4 | **1 req · 1 q · 4 → 4** |
| Medicine (11 subjects) | 1 req · 78 → 11 | 1 req · 2 q · 12 → 12 | **1 req · 1 q · 11 → 11** |
| Cardiology (7 topics + 30 lessons) | 1 req · 7 → 7 | 2 req · 2 q · 37 → 37 | **2 req · 2 q · 37 → 37** |
| Open a lesson | 5 req · 6 q · 29 → 25 | 5 req · 6 q · 29 → 25 | **2 req · 3 q · 2 → 2** (lesson 1 → 1, flashcards 1 → 1) |
| **Whole visit** | **10 req · 9,512 → 1,573 · ≈979 KB** | **9 req · 82 → 78 · ≈25 KB** | **6 req · 54 → 54 · ≈24 KB** |
| Back to Medicine again (same visit) | 1 req · 78 rows | 1 req · 12 rows | **0 req · 0 rows** (verified in the browser) |
| Back to Cardiology again (same visit) | 1 req · 7 rows | 1 req · 7 rows | **0 req · 0 rows** |

- Cold runs add 1 sign-in row on the first request.
- The editor still sends `POST /admin/ai-notes/source/preview` on open; that's text processing, not this table.
- The flashcards request does a 1-row lesson-exists check before listing; it's the only check left, and dropping it would save 1 row.

**Verified in the browser:**
- Opening a lesson from Cardiology made only 2 API calls (the lesson and its flashcards), with no course, subject or topic list requests, and the Cardiology dropdown was filled.
- Going back to the courses and into Medicine twice sent no new subjects request.
- Lint and backend type-check are clean.

**Files**
- `topics.service.ts`, `lessons.service.ts` (`canvasAdminFindOne`) + compiled `dist`
- `StructurePage.jsx` (`lessonNavState`, `subjectsCacheRef`, `topicsCacheRef`)
- `AdminAiNotesEditorPage.jsx` (`structureContext`)

#### Writes on the Structure page (save, reorder, delete), measured 2026-11-14

**Bug found and fixed (my phase 2 code).**
- The background recount used `UPDATE … LEFT JOIN (derived table)`. MariaDB switched the topics-per-subject statement to a plan that re-read every topic of the table for each subject: **384 → 19,035 rows** on the second run.
- Rewritten as correlated `COUNT(*)` subqueries on parent-id indexes, the plan is stable.

| Background recount after a save | Before the fix | After the fix |
|---|---|---|
| After reordering Medicine's subjects | 4 queries · 3,607 rows | 4 queries · **3,409 rows** |
| After saving Cardiology | 4 queries · **22,258 rows** | 4 queries · **3,409 rows** |
| Repeated runs | Varied | Always 3,409 (3 runs checked), 0 wrong counts |

**What each write costs today** (the save itself, rows examined; every write is then followed by the 3,409-row recount):

| Action | Queries · rows | Notes |
|---|---|---|
| Reorder subjects (Medicine, 11) | 12 · 12 (1 sign-in + **11 single-row `UPDATE`s fired at once**) | Same pattern for topics; lessons do 1 update per lesson in the course (up to 520) |
| Save a subject (edit) | 10 · 16 | Pre-read with the old topic-count join (7 rows) + topic names (7) + course check (1), then a transaction: `UPDATE` + version (next-number read + insert) + workflow + audit |
| Create a subject or topic | ≈7 | Highest `sort_order`, `INSERT`, version, workflow, audit |
| Delete a subject | ≈5 | `DELETE` its topics + `DELETE` subject + audit. Its lessons are not deleted (no foreign keys to lessons) |
| Delete a topic | ≈3 | `DELETE` + audit |
| Delete a lesson (soft) | ≈2 | `UPDATE lessons SET note_data = NULL, raw_text = NULL, is_public = 0` + audit |

**Proposed write improvements.** Items 1–3 were replaced by gap ranks (next section), now built. Item 4 is still open.
1. **Reorder in one statement** (`UPDATE … SET sort_order = CASE id … END WHERE id IN (…)`): 11–520 queries fired at once → **1 query**, no burst.
2. **Recount only when counts can change** (create, delete, move to another course or subject, publish or unpublish), not on reorder, rename or text edits: 3,409 rows → **0** for most saves.
3. **Recount only the affected course and subjects:** 3,409 → **≈50–600 rows** when needed.
4. **Pre-read by id only** before saving a subject (no topic-count join): 7 → 1 row.

#### Gap ranks: reorder, add and delete ✅ implemented locally 2026-11-14, not committed

**Approved 2026-11-14** ("yes build"). Reordering lives only on the Structure page. The lesson list page's "Reorder lessons" panel is removed.

**How it works**

| Level | Ordered inside | Table | Index (already existed) |
|---|---|---|---|
| Courses | the whole list | `courses` | `idx_courses_sort (sort_order, id)` |
| Subjects | their course | `topics` | `idx_topics_sort (course_id, sort_order)` |
| Topics | their subject | `subtopics` | `idx_subtopics_sort (topic_id, sort_order)` |
| Lessons | their topic | `lessons` | `idx_lessons_sort (topic_id, subtopic_id, sort_order)` |

- **Ranks are spaced 1000 apart inside each parent.** Lessons in different topics may share a rank, and ties are broken by id.
- **A move** sends "X goes between A and B". One statement reads A and B by id and sets X halfway between them (`common/utils/structure-order.ts`). At the top or bottom it uses 1 neighbour ± 1000.
- **When no whole number is left between A and B**, only that one parent's items are respread to 1000 spacing, in the same order, and the move is retried. 14 moves into the same spot caused 1 respread.
- **Stale screen** (the neighbours are no longer in the item's parent): the move is refused with 409, nothing changes, and the page re-reads that list ("The order changed on another screen").
- **Two admins at once:** each statement locks the rows it reads, so both moves land and none is lost (tested).
- **Counts:** a move changes no count, so no recount. Delete and add adjust their course and subject counts in the same transaction, and also skip the full recount (`structure-counts.ts` `SELF_COUNTING`). Other structure writes still recount.
- **New items** go to the end of their parent (+1000), read from the index (1 row). Moving a lesson to another topic in the editor puts it at the end of that topic.
- **Course-wide lesson lists** (student catalog, admin list, `/lessons`, student list) now sort by subject → topic → lesson rank.
- **One-time conversion** (startup step `structure gap ranks`, schema version `2026-11-14.3`): topics are ranked where their first visible lesson sat, lessons ranked inside their topic. The visible order of every course is compared before and after, and if anything would differ the whole conversion rolls back. Tested on a scratch copy: it keeps the order on flat data (1,478 lessons identical) and refuses with nothing changed when a topic is split. The old one-time "flatten across the course" step is removed.
- **Local effect:** in 2 subjects (ids 33, 73), the admin topic order (`subtopics.sort_order`) differed from the order students see. Both now follow the student order, so the Structure page and course detail page show those topics in the students' order.
- **Lessons with no topic** (none visible locally, 4 hidden) sort first in their subject as a "No topic" group.

**Measured, Peds (520 lessons), local slow log, same script before and after (`measure-reorder.js`)**

| Action | | Requests | Queries | Rows examined | Rows returned | Rows changed |
|---|---|---|---|---|---|---|
| **Move a lesson** | Before (lesson page, whole course) | 1 | 105, then **failed: 503 "database unavailable" after 104 of 520 updates (half-saved order)** | 105 | 1 | 104 |
| | After (Structure page) | 1 | **2** (sign-in check + 1 move) | **2** | 1 | **1** |
| | Background recount before → after | — | 0 → 0 (the request failed) | — | — | — |
| **Add a lesson** | Before | 1 | 12 | **524** (520 = highest rank in the course) | 6 | 4 |
| | After, first pass | 1 | 13 (+1 count statement) | 5 (highest rank in the topic = 0, index only) | 6 | 6 |
| | After, trimmed | 1 | 9 (7 queries + start/commit) | 3 logged · ≈7 actually read | 2 | 6 |
| | **After, final** | 1 | **8** (6 queries + start/commit) | 2 logged · **5 actually read** (4 when the notification setting is cached) | 1 | 6 |
| | Background recount before → after | — | 4 → **0** | 3,411 → **0** | — | 102 → 0 |
| **Delete a lesson** | Before (hide + 3 list reloads) | 4 | 4 | 67 | 66 | 1 |
| | After (hide + counts in 1 statement, no reloads) | **1** | **1** | **1** logged (3 rows by id) | 0 | **3** (lesson, course, subject) |
| | Background recount before → after | — | 4 → **0** | 3,425 → **0** | — | 102 → 0 |

**Add lesson, trimmed (13 → 9 statements):**
- The 3 existence checks (course, subject, topic) are now 1 query, joined by primary key.
- The "highest rank in the topic" read and the insert are now 1 `INSERT … SELECT`. It also locks that spot, so two lessons added at the same moment get different ranks.
- The version-number read is skipped for a brand-new lesson (always version 1).
- What's left: the 3 history inserts (0 rows each), the count update (2 rows by id), and the new-content notification setting read (1 row by key, after the save).

**Add lesson, final (9 → 8 statements, ≈7 → 5 rows actually read):**
- **No separate existence check.** The count update reads the course, subject and topic by id anyway. It now joins all three, so a missing topic changes nothing and the save rolls back. A missing course or subject is refused by the lessons table's foreign keys. Only on such a failure does the server look up which one is missing, for the same 400 message as before (tested: all three cases return 400 and leave nothing behind).
- **The new-content notification setting is kept in memory** (cleared when the admin changes it, 10-minute expiry for outside edits), so it costs 1 row only after a restart.

| # | Statement | Rows actually read (all by id or index) |
|---|---|---|
| 1 | `START TRANSACTION` | 0 |
| 2 | `INSERT INTO lessons … SELECT …, MAX(sort_order) + 1000` (end of its topic) | 1 (index `idx_lessons_sort`) |
| 3 | `UPDATE courses JOIN topics JOIN subtopics SET lesson_count + 1` (counts + existence check) | 3 (primary keys) |
| 4–6 | History: version, workflow state, audit | 0 each |
| 7 | `COMMIT` | 0 |
| 8 | Notification setting (after the save) | 1 (primary key), 0 when cached |

Every read already uses a primary key or an index. A new index can't lower this further; only reading fewer rows can.

The slow log reports multi-table `UPDATE`s with only the first table's rows. The move and the delete each touch 3 rows, all by primary key.

**Checked**
- Counts after add, delete and a repeated delete match a real count exactly (course 520 → 521 → 520, subject 46 → 47 → 46).
- In the browser: Sort → move "Neonatal cholestasis" up and back. One POST each, no reloads; ranks 6000 → 4500 → 6000.
- Backend unit, regression and security e2e suites all pass.

**Live check before deploy (read only):** run the split-topics query from this conversation again (0 on 2026-11-14). The conversion refuses by itself if the live order would change.

**Open:** removing up to 3 duplicate indexes (`lessons.fk_lessons_topic`, `subtopics.idx_subtopics_topic_id`, `topics.fk_topics_course`) needs the live index list and a foreign-key check first. Courses have no Sort button on the page yet (the backend supports it). The old bulk reorder endpoints remain, unused by the app.

#### Counters without recounts ✅ implemented locally 2026-11-14, not committed

**Approved 2026-11-14** after a read-only audit ("yes build"; 5A: keep topic ids; 5B: strong warning).

**What changed**
- **No automatic full recount.** The trigger after saves (`main.ts`), the read-wait on the Structure page, and the startup recount are all gone. The startup step still fills the columns once, when they are first created.
- **Every save that changes a count adjusts only those rows, by primary key, in the same transaction** (`structure-counts.ts` `bumpCounts`, `moveLessonCounts`):

| Save | Counter rows changed |
|---|---|
| Lesson text, flashcards, AI, status, PDF/video, reorder, student open/complete | **0** |
| Add lesson / hide lesson | 2 |
| Move lesson to another subject (same course) | 2 (both subjects) |
| Move lesson to another course | 4 |
| Hard delete of a counted lesson (no button calls it) | 2 |
| Add or delete a subject | 1 (course; delete also takes off the lessons the cascade deletes) |
| Move a subject to another course | 2 courses; its lessons' `course_id` move with it |
| Add or delete a topic | 1 (subject) |
| Move a topic to another subject | up to 2 subjects + 2 courses; its lessons move with it |
| Subject edit (topic names) | 1 (subject), only by the number of topics added or removed |
| "General lessons" subject created automatically | 1, now inside the lesson save's transaction |

- **Counting rule everywhere:** `is_public = 1 AND engine_key = 'gemini'`; status doesn't matter.
- **Concurrency:**
  - The lesson row is locked (`FOR UPDATE`) before its old place's counts are adjusted.
  - Every save locks in the same order: lessons → subjects → courses, with `IN (…)` lists in ascending id.
  - A save that still loses a deadlock is retried automatically (`DeadlockRetryInterceptor`, writes only, up to 2 more tries). MariaDB undoes the losing transaction completely, so a retry is safe.
  - The "last rank in the topic" read on lesson create is a plain read again. As `INSERT … SELECT` it locked that spot, and two lessons added to one topic at the same moment deadlocked. Add lesson is therefore **9 statements** (5 rows read), not 8.
- **Fix counts** (admin, Courses level of the Structure page):
  - `POST /admin/ai-notes/structure/counts/fix` recounts from the lessons, subjects and topics, corrects only the wrong rows, and lists what was wrong.
  - It takes the same lock order as saves and retries once on a deadlock.
  - `GET /admin/ai-notes/structure/counts` is the cheap check: it compares each course with its own subjects and reads no lessons.
- **5A fixed:** editing a subject used to delete and recreate all its topics (new ids, order lost, lessons dropped out of their topic). It now keeps existing topics (id and place), deletes only the names removed, and adds new names at the end.
- **5B:** deleting a course or a subject that has lessons asks the admin to **type DELETE**. The prompt states that its N lessons (plus hidden ones) are permanently deleted by the database cascade.
- **Bug fixed before it shipped:** the recount trigger matched the Flutter app's `/courses/student/lessons/:id/opened` and `/progress`, so every student lesson open or complete set off the full recount. That trigger is gone.

**Measured (throwaway test course, local slow log, same script before and after: `measure-counters.js`)**

| Save | Before: statements · rows examined | Before: recount | After: statements · rows examined | After: recount |
|---|---|---|---|---|
| Lesson text edit | 2 · 2 | 4 q · 3,439 | 2 · 2 | **0** |
| Flashcard add | 4 · 2 | 4 q · 3,439 | 4 · 2 | **0** |
| Flutter: student opens a lesson | 3 · 1 | 4 q · 3,439 | 3 · 1 | **0** |
| Move lesson to another subject | 3 · 2 | 4 q · 3,439 | 7 · 5 (lock + 2 subject counts) | **0** |
| Add subject | 11 · 2 | 4 q · 3,442 | 12 · 3 (+1 course count) | **0** |
| Add topic | 9 · 1 | 4 q · 3,443 | 10 · 2 (+1 subject count) | **0** |
| Delete topic | 5 · 2 | 4 q · 3,442 | 7 · 4 | **0** |
| Delete subject (1 lesson) | 7 · 4 | 4 q · 3,436 | 11 · 10 (locks its lessons, 2 course counts) | **0** |

All requests were 1 each. The recount reads every lesson, subject and topic, so it grows with the data. Each save's own cost now depends only on what it changes.

**Tested** (`test-counters.js`, two throwaway courses, 5 runs, all passed): stored = real after every step. The steps covered:
- setup and text edit
- lesson moves (same course, other course, back via the old edit endpoint)
- a failed move (400, lesson and counts unchanged)
- subject edit adding and removing a topic (topic id kept, lessons stay)
- subject move to another course (lessons follow)
- topic move to another subject and course (lessons follow)
- add and delete a topic
- hiding a lesson twice
- 10 saves at the same moment, including two moving the same lesson
- Fix counts finding and repairing 2 corrupted counts, then finding nothing
- Fix counts during saves
- deleting a subject with 5 lessons

Gap-rank tests (17) and add/delete count checks still pass. Backend unit, regression and security e2e suites pass.

**Needed before importing outside SQL files:** the reorganise prompt (`docs/LESSON_REORGANISE_PROMPT.md`) now says lessons rank inside their topic and to press "Fix counts" after an import. SQL files made before 2026-11-14 use the old flat numbers.

#### Fix counts in small steps ✅ implemented locally 2026-11-14, not committed

**Approved 2026-11-14:** each request examines under 1,000 rows, one request at a time with a pause, a progress bar, as few requests and statements as possible ("OK build the plan"). Built with the 7-connection cap in mind.

**How it runs** (the page drives it; `structure-counts.ts` `startCountFix` / `runCountFixSet` / `finishCountFix`):

| Request | What it does | Statements |
|---|---|---|
| 1. `POST /admin/ai-notes/structure/counts/fix/start` | Plan (courses + subjects with stored counts) **and** the first set; also the finish when everything fits in one request | 2 (+ sign-in check) |
| 2… `POST …/fix/set` | The next set; the **last** one also does the finish (course totals) | 1 per set, +1 on the last |
| `POST …/fix/finish` | Only when the last set had no room for the finish | 1 |

- **A set is whole subjects, counted in ONE statement:** each subject row (primary key) with its real lesson count and topic count as correlated subqueries, both **index-only** (`idx_lessons_topic_engine_pub_sort`, `unique_topic_subtopic`). Rows examined = exactly that set's lessons + topics + subjects. No lesson row is read and no `SELECT *` is used.
- **Packing:** fewest requests that fit 980 rows each (the sign-in check and the rare writes keep it under 1,000). Request 1 keeps room for the plan rows and the last request for the finish rows. Subjects are packed biggest first into the first set with room.
- **The plan has no `ORDER BY`** (it's sorted in the app), which cut it from 146 rows to 51.
- **No locks while counting.** Writes are compare-and-set; a number changed by a save meanwhile is reported as "changed during the fix" and left alone (tested: an admin added a Peds lesson mid-fix, Peds was skipped, and the count stayed exact, 520 / 520).
- **One Fix at a time** (second start → 409), then a **cooldown** (`FIX_COUNTS_COOLDOWN_MS`, default 60 s; an immediate second Fix → 409 "try again in 60 s").
- **Progress:** "Fixing 1/2…" with a bar, then a summary (checked in the browser).
- **Tried and rejected for a hard row cap:**
  - A `LIMIT` inside a derived table or `UNION` made MariaDB scan the whole lesson index instead of jumping to the set's subjects (1,493 rows for a 700-lesson set).
  - `EXPLAIN` estimates were too rough for whole sets (770 estimated vs 700 and 689 real).
  - So sets are sized from the stored counts. After a very large outside import (stored counts far too low), one request can exceed 1,000 rows once; the next run is sized correctly. A single subject over ~950 lessons is always its own request.

**Measured on local data (1,493 lessons, 47 subjects, 301 topics, 4 courses):**

| Fix counts | Requests | Statements | Rows examined | Rows returned | Largest request |
|---|---|---|---|---|---|
| Original (one request, locked everything) | 1 | 9 | 3,406 | 154 | 3,406, all lessons locked |
| Steps v1 (grouped by course) | 5 | 15 | 4,319 | 198 | 1,711 ❌ |
| Steps v2 | 5 | 15 | 2,014 | 198 | 859 |
| **Final** | **2** | **5** (incl. 1 sign-in check) | **1,919** | ≈ 99 | **973**, no locks |

Final, per request:
- **Request 1:** sign-in 1 + plan 51 + set 921 = 973 rows, 6 ms.
- **Request 2:** set 895 + finish 51 = 946 rows, 3 ms.

**As data grows:** requests ≈ total rows ÷ 980, so ≈ 55 requests at 50,000 lessons. Each is still under 1,000 rows, with one connection and about 1 statement, 0.3 s apart (≈ 20 s in total).

---

## 5. Other open items

| Item | Status | Note |
|---|---|---|
| Exam submit: rare reload while holding the transaction connection | Agreed to fix in the next batch | Pass the transaction connection into `loadQuestionsForExamSession` → `loadQuestionsForQuiz` for the fallback path (session changed mid-submit) |
| Duplicate subscription checks per request | Open | The same user's subscription is read more than once per request |
| Subscription notification when a plan runs out by date (not optimisation, found while checking) | Planned in 4.8 step 4 | The list builds the subscription item from the stored `user_subscriptions.status`. A plan that lapses by `end_date` keeps `status = 'active'` (only the subscriptions page computes "expired"), so no "expired" notification appears; it still says "active · Valid until <past date>". Rows only become `expired` when a new plan replaces them or Apple reports expiry |
| Notifications: full scan | Planned in 4.8 | Reads all 1,018 announcements + sort per load; last 10 with `ORDER BY a.id DESC` → 11 rows (measured), no index needed |
| `execute()` Prepare round trips | Open | Each new connection prepares statements again; consider `query()` for one-off statements |
| Host restarts the app about every 5 minutes | Open | Empties all caches, so every 5 minutes is a cold start; ask the host |
| Does production see real client IPs? | Open | Logs show `127.0.0.1`. If the app does too, every per-IP rate limit treats all users as one visitor. Check locally and trust `X-Forwarded-For` / `CF-Connecting-IP` if needed |
| `created_at` indexes (`backend/sql/2026-11-13_perf_indexes.sql`) | Not planned (see 4.7) | Low value while most rows are recent; the dashboard plan removes the queries that need them |
| `public_html/keepwarm.php` | Check | The crontab is empty; confirm whether anything still calls it |
| **Pull the fixes onto the live server** | ⚠️ First step | The server runs `1a010762`. Pull v6.5 (`git pull --ff-only origin v6.5` after checking the branch and status), then `touch backend/tmp/restart.txt` |
| Push on publish reads push settings twice **per phone**, all at once | Open | `native-push.sender.ts`: `sendApns`/`sendFcm` call `resolve*Settings` + `is*Configured` per token inside `Promise.all`, so 5 + 2×phones queries. Read the settings once per publish and send in small groups |
| Lesson reorder runs one `UPDATE` per lesson at once | ✅ Fixed locally 2026-11-14 | Replaced by gap ranks on the Structure page (4.9). Measured before: the burst failed with 503 after 104 of 520 updates. The old endpoint remains but the app no longer calls it |
| Old reorganise-kit SQL files (≈45 in Downloads) | ⚠️ Before importing | Made with the old flat lesson numbers (steps of 5 per course). After the gap-rank change they would sort wrongly inside topics. Renumber to per-topic ranks first, then press "Fix counts" after importing |
| Duplicate indexes on structure tables | Open | `lessons.fk_lessons_topic`, `subtopics.idx_subtopics_topic_id`, `topics.fk_topics_course` are covered by longer indexes. **`fk_lessons_topic` and `fk_topics_course` back real foreign keys** (checked locally); dropping them is only allowed because a longer index starts with the same column. Compare with the live index and foreign-key list first |
| Flutter cold-start sign-out on any error | Open (bug) | `auth_controller.dart` `_hydrate`: if `/auth/me` fails for **any** reason (busy, timeout, offline), it wipes the saved login. Sign out only on a real 401; needs an app release |
| Drug randomizer spin | Discussed | Old code: `ORDER BY RAND()` over all drug text (disk scratch table, ≈158 ms); `c777b58a` shuffles ids (≈7 ms). Proposed: 1 query, 5 random drugs (ids-only shuffle), settings and premium from memory and sign-in, no per-spin query for paid students |

---

## 6. Implementation order (when we do it all together)

0. **Pull the committed fixes onto the live server** (section 2), then commit and deploy the pending batch + 4.9
1. Student web Lessons: one request (4.4)
2. Assessments: light meta + categories rewrite (4.2)
3. Admin Lessons Draft bug (4.3)
4. Admin Dashboard steps 1–4 (4.1), plus the two rewrites: today's sign-ups range form and pending requests with a limit
5. Exam submit fallback connection (section 5)
6. Notifications (4.8): last 5, dismissals for shown items only, subscription index, weak-topic decision, load only when opened, subscription-expired fix. The Flutter part needs an app release
7. Indexes (4.7): compare live, add `user_subscriptions (user_id, status, end_date)` (step 2b), `users (created_at, id)` and `user_subscriptions (created_at, id)` (step 2c), drop the 4 exact duplicates. Steps 4–5 are optional
8. Admin Lessons per subject (4.3)
9. Flutter ETag / 304 (4.5), which needs an app release
10. Student catalog SQL + `has_content` (4.6)
11. Toward the maximum (1A/1B): stored counts (courses, subjects), `courses.sort_order`, Assessments index + keyset paging, push settings once per publish, single-query lesson reorder. Plan each in detail, with its index tested on a copy, before building

Then for each change:
- run the backend tests
- measure cold and warm locally
- update this file
- commit, push and deploy only when approved

---

## 7. How to measure

**Local (full detail):** the scripts in the session scratchpad (`measure5.js`, `bench-proposed.js`). These use the slow log at 0 s plus session counters. Always restore the MySQL settings afterwards.

**Live, read-only (phpMyAdmin):**
1. Click the LMS database in the left sidebar.
2. Run `ANALYZE <the SELECT>` for one query.
3. Add up the `r_rows` column.

`FLUSH STATUS` doesn't work on this host (it needs the RELOAD privilege).

**Live check: did the database limit come back?** (cPanel Terminal) Any date after 13 Nov in the output means it did:

```bash
grep -B12 "ER_USER_LIMIT_REACHED" ~/repositories/lms/backend/stderr.log | grep -Eo '\[Nest\] [0-9]+ +- [0-9/]+' | awk '{print $NF}' | sort | uniq -c
```

**Live check: today's API errors** (cPanel Terminal):

```bash
grep "$(date +%d/%b/%Y)" ~/access-logs/xyndrome.lk-ssl_log | grep '"[A-Z]* /api/' | awk '{print $9}' | sort | uniq -c
```

The app doesn't log limit errors itself. It answers 503, so 503s in the access log are the signal.

---

## 9. Admin optimisation programme (page by page, 10/10 target)

**Asked for 2026-11-14:** use the Structure page as the model and plan every admin page, query by query, with frontend changes where needed. Targets: examined = returned, no heavy queries, no server overload, near-total caching, pages where lists grow, indexes checked, and every save (create, update, delete) measured. Work goes **one page at a time**, and every step follows sections 0, 1, 1A and 1B and the before → after rule.

### 9.1 The Structure page recipe (what made it 10/10)

Every admin page is rebuilt to these rules. A page is 10/10 only when every box is ticked and measured.

| # | Rule | How the Structure page does it |
|---|---|---|
| 1 | **Show only what's on screen** | Course cards, then subjects on click, then lessons on click. Nothing loads for folders that aren't open. |
| 2 | **Examined = returned** | One indexed query per level (courses 4 → 4, subjects 16 → 16, lessons 46 → 46) |
| 3 | **No counting on open** | Stored counts (`courses.lesson_count`, …), adjusted by each save in its own transaction. No automatic recount (section 4.9). |
| 4 | **Exact columns, never `SELECT *`** | Lists carry no lesson body or notes |
| 5 | **Pages where lists grow** | 50 per page, "after id X" (keyset), never `OFFSET` |
| 6 | **Indexes that match filter + order** | `idx_courses_sort`, `idx_topics_sort`, `idx_lessons_topic_engine_pub_sort`; checked with `ANALYZE` |
| 7 | **No repeats** | Per-visit caches on the page; context passed to the next page (`structureContext`); the lesson editor loads by id only |
| 8 | **One request at a time, one connection per request** | No `Promise.all` of queries; no second connection while holding a transaction (section Background, 7-connection cap) |
| 9 | **Minimal saves** | Move = 1 statement, 3 rows; add lesson = 9 statements, 5 rows; delete = 1 statement, 3 rows; counts adjusted by id |
| 10 | **Long jobs in small steps** | Fix counts: under 1,000 rows per request, paced, progress bar, no locks |
| 11 | **Caching only where it survives** | The host restarts every ~5 min, so memory caches are often cold. Prefer stored counts and light queries; cache only shared, slow-changing data, and clear it on writes (`admin-read-cache.ts`). |
| 12 | **Frontend does its part** | Loads lazily (tabs and folders on open), shows cached data instantly, never sends the same request twice, and updates itself after a save instead of re-reading |

### 9.2 Measured inventory (before), local, 2026-11-14

Captured by opening every admin page in the browser (requests made), then each endpoint measured cold (first call after restart) and warm. Local data: 1,493 lessons, ≈13,100 questions, 4 courses.

| Page | Requests on open | Queries (cold) | Rows examined (cold) | Rows returned | Reply | Warm examined | Status |
|---|---|---|---|---|---|---|---|
| **Structure** | 1 (+1 per folder) | 1 per level | 4 / 16 / 6 / 46 | same | ≤ 8 KB | same | ✅ 10/10 (4.9) |
| Lesson editor (one lesson) | 2 | 3 | 2 | 2 | 8 KB | same | ✅ |
| Dashboard | 4 | 19 | **16,843** (live ≈30,830) | 252 | 263 KB | 1,499 | ❌ |
| Assessments (open) | 2 | 9 | **38,280** | 9,074 | 308 KB | 875 | ❌ |
| Assessments: subject page / next page / one quiz | 1 each | 1 / 1 / 2 | 57 / 57 / 41 | 14 / 0 / 21 | ≤ 9 KB | same | ⚠️ |
| Questions (open) | 2 | 7 | **12,197** | 9,226 | 538 KB | 1,000 | ❌ |
| Questions: counts | 1 | 1 | **38,939** | 1 | — | 0 (cached) | ❌ worst single query |
| Questions: one question | 1 | 2 | 11 | 6 | 2 KB | same | ✅ |
| Lessons list (`/admin/ai-notes`) | 1 | 1 | **8,960** | 1,479 | 952 KB | 8,960 (no cache) | ❌ |
| Subscriptions | 7 | 21 | **≈6,945** | ≈2,325 | ≈830 KB | same | ❌ |
| Finance | 6 | 25 | **≈10,650** | ≈2,090 | ≈750 KB | same | ❌ |
| Reports | 3 | 13 | 4,620 | 152 | 21 KB | same | ❌ |
| Setup | 1 | 14 | **15,957** | 86 | 1 KB | same | ❌ |
| Users | 2 | 3 | 433 | 101 | 15 KB | same | ⚠️ |
| Announcements | 1 | 1 | 1,118 | 100 | 29 KB | same | ⚠️ |
| Drugs | 2 | 3 | 745 | 32 | 5 KB | same | ⚠️ 78 ms SQL |
| Roles | 1 | 1 | 117 | 6 | 2 KB | same | ⚠️ |
| OSCE | 2 | 3 | 93 | 12 | 4 KB | same | ⚠️ |
| ECG / Auscultation / Settings / Question reports / Student detail | 1 | 1–5 | 0–23 | 0–11 | ≤ 2 KB | same | ✅ small |

**Saves measured** (throwaway draft rows, no student notifications, all removed afterwards):

| Save | Statements | Rows examined | Rows changed | Note |
|---|---|---|---|---|
| Announcement create / update / delete | 2 / 1 / 2 | 1 / 1 / 1 | 1 / 1 / 1 | ✅ |
| Question create (5 options) | 16 | 2 | 9 | 3 separate existence checks, version read |
| Question update | 18 | 19 | 15 | Re-reads and rewrites all options |
| Question delete | 6 | 12 | 2 | |
| Assessment create (1 question) | 10 | 2 | 5 | |
| Assessment update / delete | 11 / 7 | 5 / 5 | 7 / 3 | |
| Drug create | ❌ **500** | — | — | Bug: optional fields arrive as `undefined` and crash the insert |
| Structure moves, lesson add / delete, Fix counts | see 4.9 | | | ✅ |

### 9.3 Plan per page (query by query)

Each page: **measure before → change → measure after → record here**. Estimates are marked ≈. A page moves to ✅ only with measured after-numbers.

#### P1. Assessments + Questions shared lists (biggest cost: 37,405 + 11,197 rows)

Both pages call a "meta" endpoint that loads 8 editor lists. The pages only need courses and subjects; the editor needs the rest, and only when it opens.

| Query today | Rows examined → returned | Change | Target |
|---|---|---|---|
| `DISTINCT category FROM questions` | 13,105 → few | Fixed list in code (the categories are an enum: past, past_paper, mock, ai), or a tiny `question_categories` table | **0** |
| `DISTINCT question_type FROM questions` | 13,103 → 2 | Fixed list in code (sba, true_false) | **0** |
| `keyword_name FROM question_keywords` (all) | 7,192 → 7,192 | **Search as you type:** `WHERE keyword_name LIKE 'abc%' ORDER BY keyword_name LIMIT 20` on an index (prefix) | ≈20 → 20 |
| `lessons` for pickers (all) | 2,986 → 1,479 | Load per subject when the picker opens (Structure endpoint) | ≈30 → 30 |
| `subtopics` join (all) | 917 → 301 | Per subject on open | ≈6 → 6 |
| Courses, subjects | small | Keep; from stored counts | ≈51 → 51 |
| Assessments summary (folder counts) | 875 → 45 | **Stored `quiz_count` per course and subject**, adjusted by quiz create, delete or move (same pattern as 4.9) | ≈51 → 51 |
| Assessments subject page | 57 → 14 | Index `quizzes (course_id, topic_id, status, id)`; keyset paging | 14 → 14 |
| Next page (`OFFSET`) | 57 → 0 | Keyset "after id X" | ≤ 50 → 50 |

**Frontend:** `QuizzesPage.jsx` / `QuestionsPage.jsx` load the light meta; the editors (`QuizBuilderPage.jsx`, question form) fetch keyword search and per-subject lessons on demand, with a per-visit cache.

**Saves:**
- **Question create:** 16 → ≈10 statements: one existence check, no version read for a new question, options in one multi-row `INSERT`.
- **Question update:** 18 → ≈8, writing only the options that changed.
- **Assessment saves:** adjust the stored quiz counts.

**Target:** open ≈ 51 → 51 rows, 1–2 requests.

**✅ Step 1 implemented locally 2026-11-14 (not committed).** Measured on the local copy, same scripts before and after:

| Action | Before: requests · queries · rows examined → returned · reply | After |
|---|---|---|
| **Open Assessments** (lists + folder counts) | 2 · 10 · **38,281 → 9,075** · 308 KB | 2 · 5 · **102 → 102** · 8.6 KB |
| Open a subject folder (page 1) | 1 · 1 · 57 → 14 | 1 · 1 · **14 → 14** (slim list + subject index) |
| General folder, page 1 | 1 · 1 · 306 → 50 | 1 · 1 · **50 → 50** |
| General folder, page 2 | 1 · 1 · 356 → 50 (`OFFSET`) | 1 · 1 · **50 → 50** ("after id") |
| **Open Questions** (lists; the question list itself is step 2) | 1 · 6 · **11,197 → 9,026** · 303 KB | 1 · 3 · **51 → 51** · 3 KB |
| Questions: pick a subject (topics + lessons) | part of the above | 1 · 2 · **52 → 52** |
| Questions: keyword suggestions while typing | all 7,192 keywords up front | 1 · 1 · **20 → 20** per lookup |
| Folder counts with a title search | 875 → 45 | 665 → 2 (search has to scan titles; listed exception) |

**What changed**
- **Lists:** `GET /admin/quizzes/meta?scope=folders` and `GET /admin/questions/meta?scope=folders` return courses and subjects (and papers) only. The Assessments and Questions pages use them; the editors keep the full lists (cached until a content save).
- **Per subject:** `GET /admin/questions/meta/subject?topicId=`: one subject's topics and lessons, loaded when a subject is picked and remembered for the visit.
- **Keywords:** `GET /admin/questions/keywords?q=`: prefix search on the unique index, at most 20 (`%` and `_` are treated literally). The Questions page suggests while typing instead of loading every keyword.
- **Sorting moved into the app** (utf8mb4_general_ci order, ties by id): a database sort counted every row twice (102 → 51).
- **Stored assessment counts:** `topics.quiz_total/quiz_active`, `courses.quiz_general_total/active`, `courses.quiz_unfiled_total/active`. `common/utils/quiz-counts.ts` adjusts them in every assessment save (create, update, delete, bulk status, bulk delete, single status, version rollback) and when a subject is deleted (its assessments lose their subject → "no subject" bucket) or moved (its assessments move with it). Lock order: quizzes → topics → courses. The folder summary reads them (2 queries) unless there is a title search.
- **Slim list and indexes:** the Assessments page asks for `slim=1` (no name joins; the page fills course and subject names from its own lists). Paging is "after id" (`after=`) instead of `OFFSET`. New indexes `quizzes (topic_id, is_general, id, status)` and `(course_id, is_general, id, status)`, with a forced index per folder type (MariaDB otherwise merged two indexes and sorted: 28 rows for 14). Schema version `2026-11-14.4`, counts filled once when the columns are created.
- **Fix counts** also checks and repairs the assessment counts. Each subject's numbers come from one pass over its own index range: a grouped join made MariaDB scan every assessment in every set. Now 3 requests (969 / 980 / 631 rows), each under 1,000.

**Saves (after, measured):** assessment create 10 → 12 statements (2 → 4 rows examined), update 11 → 13 (5 → 7), delete 7 → 10 (5 → 8). The 2–3 extra statements adjust the folder counts by id.

**Checked:**
- **Identical results:** courses, subjects, papers, all 47 subjects' topics and lessons, keyword searches, the folder summary for 6 filter combinations and its order, page 2 "after id" = page 2 by offset, and slim = full list for 45 folders (532 assessments) with identical filled names.
- **Counts exact after every save path,** including 3 saves at the same moment and a subject delete. Fix counts repairs corrupted assessment counts.
- **Other suites:** structure counter tests, 17 gap-rank tests, and backend unit and security suites all pass.
- **Not yet checked in the browser** (the local admin session had expired).

**Left for later steps:**
- The editors (quiz builder, bulk import, set import, AI generator) still load the full lists. Their cost is categories/types (13,103 rows each: MariaDB here does no loose index scan, tested) and keywords/lessons. Step 2's stored question counters replace the categories/types scans; the editors move to per-subject lists and keyword search after that.
- The Questions list (1,000 → 200) is step 2.

#### P2. Questions page

| Query today | Rows | Change | Target |
|---|---|---|---|
| Counts (total / unused / per status) | **38,939 → 1** | **Stored counters** (a `question_stats` row per course: total, active, unused), adjusted by question create, delete and status change, and by assessment add/remove. Fix counts covers drift. | ≈4 → 4 |
| List, `limit=200` | 1,000 → 200, 235 KB | **50 per page, keyset**, index matching the default filter and order (e.g. `questions (course_id, status, id)`), exact list columns (no explanation text) | 50 → 50 |
| One question | 11 → 6 | Keep | ✅ |

**Frontend:** paged table with "Load more"; filters change the request and don't fetch everything.

**✅ Step 2 implemented locally 2026-11-14 (not committed).**

**Correction to the plan:** the 38,939-row "counts" query does **not** run when the Questions page opens. Only the **quiz builder** calls it, to count matching questions for each section of a random (blueprint) assessment, filtered by any mix of course, subject, topic, lesson, category, type and keyword. A per-course stats table could not answer arbitrary filters. The real waste was that every call re-read all ≈13,000 assessment links, whatever the filter.

**Measured on the local copy, same scripts before and after (cold):**

| Action | Before: requests · queries · rows examined → returned · reply | After |
|---|---|---|
| **Open Questions** (list) | 1 · 1 · 601 → 201 (first 200 only, no paging) · 236 KB | 1 · 1 · **50 → 50** · 32 KB |
| Next page | none (first 200 only) | 1 · 1 · **50 → 50** ("after id") |
| A subject's questions (Peds GIT, 40) | 1 · 1 · 240 → 40 | 1 · 1 · **40 → 40** |
| Names for a page (subjects on it) | in the list's joins | 1 · 3 · 182 → 138 (the 44 extra are inactive lessons the database skips; no index has status) |
| Builder count: one subject (40 questions) | 1 · 1 · **12,998 → 1** | 1 · 1 · **40 → 1** |
| Builder count: course 10 (3,458 questions) | 1 · 1 · 19,769 → 1 | 1 · 1 · 3,458 → 1 (every matching question once) |
| Builder count: whole bank | 1 · 1 · 38,939 → 1 | 1 · 1 · 13,103 → 1 (every question once; cached until a content save) |
| Fix link counts (new, manual) | — | ≈33 requests of 400 questions, 780 rows each |

**What changed**
- **Stored "used in N assessments":** `questions.quiz_count` (schema `2026-11-14.5`, filled once). It's adjusted where assessment links are written: links replaced (assessment create, update, rollback), one assessment deleted, several deleted. Only the questions added or removed change. The list's "N quiz links", the **used / unused** filters and the builder's counts read it.
- **List:** `slim=1` (no name joins, no long explanation or approach text, no unused version lookup); 50 per page newest first; `after=<id>` paging; the narrowest index forced per filter (lesson, topic, subject, course). The page fills course, subject, topic, lesson and paper names from its folders list and from one batch request for the subjects on the page (`/admin/questions/meta/subject?topicIds=…`, remembered for the visit). A **Load more** button replaces the hard limit of 200.
- **Builder count:** `COUNT(*)` with `SUM(quiz_count = 0)`; joins only when searching text.
- **"Fix link counts"** button on the Questions page: recounts the stored numbers 400 questions per request, writes only wrong ones (compare-and-set), with progress. For use after an SQL import of assessment links.

**Saves (after, measured):**

| Save | Before | After (statements · rows examined) |
|---|---|---|
| Assessment create | 10 · 2 | 14 · 5 |
| Assessment update | 11 · 5 | 14 · 10 |
| Assessment delete | 7 · 5 | 12 · 12 |

The extra statements adjust folder and link counts by id.

**Checked:**
- **Stored link counts exact** for all 13,103 questions after the fill, and after create, a shared question, replacing questions, 2 saves at the same moment, delete and bulk delete. The numbers are right (questions used in 0, 1, 2, 1 assessments). Fix link counts repairs 2 corrupted counts.
- **Identical results:** slim list = full list in 6 filter combinations (incl. search, usage, status and type); "unused" = no links (185 both ways); page 2 "after id" = page 2 by offset; builder counts identical to the old query for 3 filter sets.
- **Browser:** opens with 3 requests and 50 rows; Load more gives 100 unique rows; names identical to the database joins for the newest 100 and for 50 questions with topics (Obstetrics).
- **Other suites:** structure and assessment counter tests, step 1 checks, 17 gap-rank tests, and backend unit and security suites all pass.

**Left open:**
- The quiz builder's **random pick** uses `ORDER BY RAND()` over the filtered questions. Plan it with the editor step.
- Categories and question types for the editors still scan all questions (13,103 each, cached). Stored link counts don't cover them. Options: fixed lists from the allowed values (0 rows), or a small per-category/type counter table. Decide at the editor step.

#### P3. Dashboard (16,843 rows, live ≈30,830; 4 requests)

| Query today | Rows | Change | Target |
|---|---|---|---|
| 6 "added per day" chart queries (questions 13,139, lessons 1,523, quizzes 677, …) | ≈15,500 | **Remove**: no screen shows them (web and Flutter checked, 4.1) | 0 |
| 4 totals (`COUNT(*)`) | ≈15,000 | **Read the stored counters** (P2 question stats, 4.9 course counts, users and subscriptions counters) | ≈8 → 8 |
| Users summary, `DATE(created_at)` | 222 → 1 | Range on `created_at` + index `users (created_at, id)` (4.7 step 2c) | ≈1 → 1 |
| Subscriptions list (whole) | 869 → 155, 236 KB | Not needed for 4 totals; drop from this page | 0 |
| Pending requests (all, ever) | 70 → 7 | Not needed for totals; drop (or pending only, `LIMIT 5`) | 0–5 |

**Frontend:** `AdminDashboardPage.jsx`: **1 request** (`/admin/dashboard` returns the 4 totals).

**Apple in-app purchases (must not break):** subscription totals change through the admin (assign, extend, cancel) **and** through Apple (`POST /subscriptions/apple/verify`, `POST /subscriptions/apple/notifications`: purchase, renewal, expiry, refund, in `subscriptions.service.ts`). Stored subscription counters must be adjusted in **both** paths, or Apple renewals and expiries would leave the dashboard wrong. Tests for this step must include an Apple purchase, a renewal and an expiry (`test/apple-iap-regression.ts` plus a counter check). The Apple flow itself (verify, notifications, `/subscriptions/me`) is not changed by any step; checked 2026-11-14: Apple saves are repeat-safe (`ON DUPLICATE KEY` on the transaction id, an existing active plan is checked first), so the deadlock retry can't create duplicates.

**Target:** 1 request, ≈ 8 → 8 rows (from 16,843).

**✅ Step 3 implemented locally 2026-11-14 (not committed).** Decisions: lessons total = published only; questions = stored count; user numbers = indexed count now.

**Measured on the local copy, same script before and after (cold, slow log at 0 s):**

| Open the dashboard | Requests | Statements | Rows examined → returned | Reply |
|---|---|---|---|---|
| Before | 4 | 19 | **16,893 → 302** | ≈519 KB |
| ↳ `/admin/dashboard` (charts, activity feed, 6 `COUNT(*)`) | 1 | 12 | 15,682 → 89 | 21.7 KB |
| ↳ subscriptions list (first 100) | 1 | 4 | 919 → 205 | 491 KB |
| ↳ payment requests (all, ever) | 1 | 1 | 70 → 7 | 5.6 KB |
| ↳ users summary | 1 | 2 | 222 → 1 | 0.1 KB |
| **After** (`/admin/dashboard?today=`) | **1** | **9** | **314 → 16** | **1.7 KB** |

After, statement by statement: totals from the 4 course rows (4 → 4); user counts, one index-only pass over `(role, status)` (111 → 3, the agreed indexed count); today's sign-ups by `(created_at)` range (0 → 0); active subscriptions, index count (96) plus a check that the student still exists (90) = 186 → 1; expiring in 7 days by `(status, end_date)` (0 → 0); the 4 newest payments with names (8 → 4); today's payments (0 → 0); pending requests waiting for the admin, with names (2 → 1); plan names by id (3 → 3).

**What changed**
- **One endpoint, one connection:** `GET /admin/dashboard?today=YYYY-MM-DD` returns `totals`, `users` and `finance`. Money numbers only for staff with `subscriptions.manage` (others get `finance: null` and the page hides the money cards; before, their dashboard failed to load). The old charts, activity feed, recommendations and insights are removed (no screen showed them).
- **Stored totals:** `courses.question_total` (all questions) and `courses.quiz_total` (all assessments), filled once (schema `2026-11-14.7`). Hooks: question create, edit (locked read; moves only if the course changes), version rollback, delete, bulk delete, and assessment bulk delete with its questions; every assessment save through `applyQuizCountChanges`, and a subject moved to another course (its assessments move with it). The Structure page's **Fix counts** now also checks `courses.quiz_total` (same rows: the finish reads the subjects' fixed counts). The Questions page's **Fix link counts** adds up questions per course in the steps it already runs and checks `courses.question_total` in one last request (course rows only; skips a course whose total changed during the run).
- **Money over all rows:** the page used to work out active, expiring, today's earnings and recent payments from the **first 100 subscriptions only** (wrong once there are more; there are 223 locally). Now SQL over all rows, by index.
- **Indexes:** `users (role, status)`, `users (created_at, id)`, `user_subscriptions (status, end_date)`. Two **VIRTUAL** flags (nothing stored, no app write changes, Apple purchase paths untouched), each with an index: `user_subscriptions.is_collected` (confirmed payment with an amount) → `(is_collected, created_at, id)` and `(is_collected, payment_date, updated_at)`; `subscription_requests.admin_visible` (not an abandoned online checkout, the Subscriptions list's rule) → `(admin_visible, status, requested_at, id)`. Without them, "recent payments" scanned every subscription (5 of 223 are payments) and "pending" read 31 abandoned checkouts for 1 real request.
- **Users summary** (Users page too): the same two index reads instead of `SUM(CASE …)` over every user and `DATE(created_at)`.
- **Frontend:** `AdminDashboardPage.jsx` makes 1 request; 30-second cache (pending approvals stay fresh; the old 1-hour dashboard cache is gone).

**Saves (measured on throwaway courses):** question create +1 statement (1 row); edit with no course change +1 (1 row, the locked read); move or rollback +2 (3 rows); delete or bulk delete +2 (2 rows); assessment create +1 (1 row); assessment edit in the same course +0; subject moved to another course +1 (2 rows); assessment bulk delete with questions +3. Fix link counts' last step: 2 statements · 7 rows.

**Checked:**
- **Identical numbers:** every dashboard number equals the old page's rules applied to **all** rows (active, expiring, today's earnings on 2 dates, pending count and amount, the 5-item queue, the 3 pending payments, the 4 recent payments, all user numbers, totals vs `COUNT(*)`).
- **Counters exact** after 4 creates, an edit, a move to another course, a rollback, single and bulk delete, 2 assessment creates, an edit, a subject move and an assessment bulk delete with its questions; both Fix flows repaired deliberately broken totals; every real course exact.
- **Suites:** structure counters, steps 1–2 checks, backend unit and security suites, Apple IAP 31/31, security e2e. The access-control test for the removed activity feed was replaced by one that checks money stays hidden (and its queries don't run) without `subscriptions.manage`.
- **Browser:** the dashboard opens with 1 data request; all sections render; Fix link counts runs to the end, including the new last step.

**Left open:**
- **Orphan rows (for P9):** deleting a user is a hard `DELETE FROM users` that leaves their subscriptions and requests behind (6 subscriptions and 3 requests locally). The old page hid them through its join, so the new queries join too (+90 rows on the active count). When P9 makes user delete clean up (or soft-delete), drop the join: active count 186 → 96.
- **Deploy check:** VIRTUAL generated columns with an index need MySQL 5.7+ or MariaDB 10.2+ (local is MariaDB 10.4). Confirm the live version before deploying; if the step fails it is logged and retried at the next start, but the dashboard's money queries need it.

#### P4. Lessons list (`/admin/ai-notes`: 8,960 rows, 952 KB, no cache)

| Today | Change | Target |
|---|---|---|
| Every lesson with joins and per-lesson flashcard counts on each open | Same model as Structure: course → subject → that subject's lessons (reuse `GET /admin/ai-notes/structure?topicId=`); title search with a `LIMIT` | open ≈ 51 → 51; subject ≈ 30–50 → same |
| "Draft" bug (`NULL AS note_data`) | Return `has_note` (already done in the Structure endpoint) | ✅ |
| Per-lesson flashcard count subquery | Stored or dropped from the list | 0 |

**Frontend:** `AdminAiNotesListPage.jsx` becomes folders plus a search box, or redirects to Structure (decision below).

**✅ P4 + P14 implemented locally 2026-11-14 (not committed).** Decision: merge the Lessons page into Structure.

| Action | Before: requests · statements · rows examined → returned · reply | After |
|---|---|---|
| Open the admin Lessons page | 1 · 2 · **8,961 → 1,480** · 952 KB | page removed; `/admin/ai-notes` opens Structure |
| A subject's lessons on Structure | 1 · 1 · 90 → 90 | 1 · 1 · 90 → 90 (now also Free) |
| Open the header search (staff) | 4 · 5 · **10,727 → 1,684** · 1,035 KB, then filter in the browser (only the first 100 assessments and 100 students could be found) | 0 requests on open |
| Header search, per query (250 ms after typing stops) | — | 1 · 4 · 4–33 rows (e.g. "asthma" 21 → 5, "acute asth" 12 → 2, no match 4 → 0); a query of only 2-letter words scans with a limit (968 → 4) |
| Structure lesson search, per query | — | 1 · 1 · 20 → 5 ("asthma") |

**What changed**
- **Lessons page removed** (`AdminAiNotesListPage.jsx` deleted; menu item gone; `/admin/ai-notes` → `/admin/structure`; the editor's Back goes to Courses). Its features moved to Structure:
  - **+ Lesson** opens a small form in the open topic (title, Free), creates the lesson and opens the editor. (Before, "+ Lesson" sent you to the Lessons page to create it.)
  - **Hide / Publish** button on each lesson row (status only; counts don't change).
  - Row markers: Published / Hidden, **Free**, **Draft (no notes yet)**.
  - **Search lessons by title** across all courses (up to 10, with course › subject › topic); opening one returns to its folder on Back.
  - Not carried over: the old page's filters over all lessons (status / free / draft); the markers show these per topic.
- **Header search for staff** asks the server per query: `GET /admin/dashboard/search?q=` (≥ 2 characters, 4 per group, only groups the staff member may open). Lessons, assessments and students match by word start on **FULLTEXT indexes** (`lessons(lesson_title)`, `quizzes(quiz_title, student_title)`, `users(full_name, email)`, schema `2026-11-14.8`; the first one on lessons rebuilt the 28 MB table in 0.6 s). Words under 3 letters and the index's stop words ("for", "the" …) are checked with a word-start pattern on the rows the index found. Courses (4 rows) use "contains". It now finds every assessment and student, not just the first 100.
- **Removed:** the every-lesson admin endpoint (`GET /admin/ai-notes`, `canvasAdminList`) and the three old bulk reorder endpoints (P14: `PATCH /admin/ai-notes/reorder`, `/admin/topics/reorder`, `/admin/subtopics/reorder`, one UPDATE per item with no transaction; the topic and subtopic ones had no sign-in check of their own). Their unused frontend helpers are gone too. Nothing called them (web and Flutter searched).

**Checked:** create → editor → Back lists it with its markers; Hide / Publish saves status only (placement unchanged); search finds it; delete keeps counts exact (521/30 → 520/29 = real); FULLTEXT results equal a word-start match for 7 of 9 test queries (the 2 differences were the fixed one-letter word and one 2-letter word); backend unit and security suites, Apple IAP 31/31, security e2e (the removed list replaced by the two new staff-only routes), structure counter tests (33) and a frontend build pass. Browser check of the search click and delete buttons is left for the next sign-in (the session expired).

#### P5. Subscriptions page (7 requests, ≈6,945 rows, ≈830 KB)

| Request | Rows | Change | Target |
|---|---|---|---|
| `/subscriptions/admin/meta` | 4,925 → 1,743 (lessons 4,483 for a course picker) | Courses only; lessons searched on demand | ≈10 → 10 |
| `/subscriptions/admin?limit=100` | 919 → 205, **491 KB** | **50 per page, keyset** on `(created_at, id)` (4.7 step 2c); plan features sent **once per plan**, not in every row | 50 → 50, ≈20 KB |
| `/subscriptions/admin/audit` | 331 → 80 | Keyset 50 on `id DESC` | 50 → 50 |
| `/subscriptions/apple/transactions` | 554 → 100 | Keyset 50 on `(created_at, id)` | 50 → 50 |
| Requests / coupons / plans | 70 / 0 / 146 | Pending first + `LIMIT`; plans keep | small |

**Frontend:** `AdminSubscriptionsPage.jsx`: **load each tab only when it's opened** (open = 1–2 requests, not 7).

**✅ P5 implemented locally 2026-11-14 (not committed).**

| Action | Before: requests · statements · rows examined → returned · reply | After |
|---|---|---|
| **Open the page** | **7 · 19 · 6,946 → 2,241 · 838 KB** | **3 · 10 · 636 → 125 · 45 KB** (overview, plans, the tab shown) |
| ↳ meta (every student + every lesson title + features twice) | 7 · 4,925 → 1,743 · 201 KB | replaced by the overview (counts + 4 courses): 6 · 333 → 13 · 0.3 KB |
| ↳ subscriptions list (newest 100 only, plan features in every row) | 4 · 919 → 205 · 491 KB | Subscriptions tab, when opened: **3 · 140 → 140** · 95 KB, **all** 108 paid subscriptions |
| ↳ requests | 1 · 70 → 7 | 1 · 42 → 7 (abandoned checkouts skipped by index) |
| ↳ audit (80, all read and sorted) | 1 · 331 → 80 · 42 KB | Audit tab, when opened: 1 · 69 → 24 · 12 KB |
| ↳ Apple purchases (100, all read and sorted) | 1 · 554 → 100 · 60 KB | Apple tab, when opened: 1 · 160 → 50 · 29 KB |
| ↳ coupons | 1 · 0 → 0 | Manage view, when opened |
| Assign form: pick a student | (all students in meta) | 1 · 2 → 2 per search |
| Assign form: lesson scope | (all lessons in meta) | 1 · 1,497 → 1,479, only when "lessons" is picked |
| After an action (approve, assign, extend …) | all 7 requests again | overview + plans + the tabs already opened |

**What changed**
- `GET /subscriptions/admin/overview`: students, pending requests, paid total, active, expiring soon (index counts, the page's own rules, deleted students left out like the lists) + the 4 courses.
- `GET /subscriptions/admin/paid`: every subscription except the free plan (the free-plan row every student has is skipped by the new index `user_subscriptions (payment_status, id)`), no plan features per row, names by id. Fixed: the page only ever saw the **newest 100** subscriptions (counts, filters and pages were over those).
- Student picker searches the server (`GET /subscriptions/admin/students?q=`, FULLTEXT word start, 20). Lesson titles on demand (`GET /subscriptions/admin/lessons[?ids=]`).
- Audit `?limit=` and newest-first by primary key (order verified identical); requests read through the `admin_visible` index; Apple list walks the primary key backwards, its plan join uses the new index `plans (apple_product_id)`. Schema `2026-11-14.9`.
- Tabs load the first time they are opened; empty states say "Loading…" until then.

**Checked:** the new list equals the old endpoint (all pages) field for field for all 108 paid subscriptions (plan features aside); all 5 counts equal the page's rules over all rows; unit and security suites, Apple IAP 31/31, security e2e (the 4 new routes are staff-only), frontend build. Apple purchase paths (verify, notifications) unchanged. Browser check left for the next sign-in.

#### P6. Finance (6 requests, ≈10,650 rows)

Reuses the P5 endpoints, plus `/admin/reports` (4,405 rows).
- Lazy tabs.
- Money totals from a cached aggregate cleared on payment and subscription writes, or a small daily totals table.

**Target:** open ≈ 1–2 requests, ≈ 50 → 50 rows.

**✅ P6 implemented locally 2026-11-14 (not committed).**

| Open Finance | Requests · statements · rows examined → returned · reply |
|---|---|
| Before (subscriptions 100, requests, coupons, audit, meta, Reports) | 6 · 26 · **10,645 → 2,084** · ≈745 KB |
| **After** (all paid subscriptions, requests, gateway totals) | **3 · 6 · 214 → 151** · 101 KB |
| PDF button (coupons + audit 80, only when clicked) | 2 · 2 · 224 → 80 |

**What changed**
- Uses the P5 paid list (all paid subscriptions, sorted newest first like before) instead of the newest 100. Fixed: **every Finance total was computed from the newest 100 subscriptions only** (217 locally).
- Plan table built from the subscription rows (no meta request: 4,925 rows to get plan names).
- "Gateway totals" from `GET /subscriptions/admin/payment-totals` (the one grouped read Reports used, 31 rows) instead of the whole Reports request (12 statements, 4,400 rows).
- Coupons and the audit log appear only in the PDF, so they load when the PDF is created.

**Checked:** with the page's own helper functions (taken from the file), old inputs over **all** rows vs new inputs give identical summary totals, payment-status breakdown, recent payment records (order included), monthly revenue and gateway totals. One intended difference: subscriptions **given free** (payment status "free plan") are not finance and no longer appear; locally that is subscription 76 (cancelled, given free on Quick Revision), so that plan's row shows 14 subscriptions / expected 16,660 instead of 15 / 17,850, and the 109 free-plan rows leave the payment-status table. Collected money is unchanged. Suites, Apple IAP 31/31, security e2e (new route staff-only), frontend build pass. Browser check left for the next sign-in.

#### P7. Reports (11 queries, 4,405 → 48)

- These are grouped statistics (an allowed exception in section 0). Make them admin-only, **cached** (cleared on attempts or subscription writes), with a date range.
- The students list (211 → 100) goes to keyset 50.

**Target:** cold ≈ 4,405 once per cache period; warm 0. Precomputed daily stats if it grows.

**✅ P7 implemented locally 2026-11-14 (not committed).**

| Action | Before | After |
|---|---|---|
| Open Reports (first time / same filters again within a minute) | 12 statements · 4,400 → 49, every time | first: same · repeat: **1 statement (the audit-log insert) · 0 rows** |
| Student filter list | 1 · 205 → 100 (first 100 students only) | search: 1 · 2 → 2 per query, finds every student |

- The grouped statistics are cached for 60 s per filter set (and per "can see learner details"), via `cachedAdminRead`; the permission check and the audit-log entry still run on every view.
- The student filter is a search box (`/admin/dashboard/search?only=students`, up to 10).
- Not done (not approved yet, 9.7 A7): a running tally per question so "hardest questions" stops scanning all answers. Worth it when attempts grow; the cache covers today's size.

#### P8. Setup page (14 queries, 15,957 rows) → ✅ decided: remove the page (9.6)

- Use the stored counters from P2 / 4.9, or approximate counts from the table statistics (`information_schema.TABLES.TABLE_ROWS`: 0 rows examined, approximate).
- Load only the panel that's opened.

**Target:** ≈ 14 → 14.

**✅ P8 done locally 2026-11-14 (not committed): Setup page removed.** Before: 1 request · 15 statements · 15,853 → 87 rows on every open. Removed the page (`AdminSetupPage.jsx`), its menu item and routes, `setup.api.js`, the backend `SetupModule` (`GET /setup`, read-only status counts) and its URL mapping; the security e2e no longer lists it. Status is checked in cPanel / phpMyAdmin instead (decision 9.6).

#### P9. Users, Roles, Announcements

**From P3:** the users summary already uses index reads (counts over `(role, status)`, today's sign-ups by `(created_at)`). Open: user delete is a hard delete that leaves subscriptions and requests behind; fix it here (clean up or soft-delete), then remove the dashboard's student-exists join.

| Page | Today | Change | Target |
|---|---|---|---|
| Users list | 211 → 100 | Keyset 50, index `users (role, created_at, id)` | 50 → 50 |
| Users summary | 222 → 1 | Stored counters or a range query | ≈1 → 1 |
| Roles (staff) | 117 → 6 | Index `users (role)` (or the role index above) | 6 → 6 |
| Announcements | 1,118 → 100 | Keyset 50 by `id DESC` (primary key) | 50 → 50 |

**✅ P9 implemented locally 2026-11-14 (not committed).**

| Action | Before | After |
|---|---|---|
| Users page open | 1 · 212 → 101 (first 100 only; 11 of 111 unreachable without a search) | 1 · **52 → 52**, pages of 50 by index ("after" = status:id), same order (inactive first, newest first) |
| Users next page | (browser pages over the 100) | 1 · 11 → 11 |
| Users search | 1 · 113 → 2 (contains, full scan) | 1 · 2 → 2 (word start, FULLTEXT) |
| Users summary | 2 · 222 → 1 | done in P3 (index counts) |
| Roles (staff) | 1 · 12 → 6 | unchanged (already served by the P3 `(role, status)` index) |
| Announcements | 1 · **1,118 → 100** (read and sorted all) | 1 · **51 → 50**, newest first by id (order verified identical), "Load more" |

- New index `users (status, id)`; `(role, status)` already ends in the primary key. Schema `2026-11-14.10`.
- `GET /admin/users?paged=1[&after=]` returns `{ items, next }`; without `paged` the old list still answers (nothing else calls it now). `GET /admin/announcements[?after=]` returns `{ items, next }` (only the admin page uses it).
- Search is now word start (like the header search), not "contains": "fiyaz" finds fiyaz2326@gmail.com; a fragment from the middle of a word no longer matches.
- **✅ User delete is now a soft delete (decision 2026-11-14).** An admin delete runs the same code as a student's own account deletion (`AuthService.softDeleteUser`, audit reason `admin`): the row and its history stay, name and e-mail are anonymized, the login is locked and sessions end, active subscriptions are cancelled, the payer's e-mail stays on payment rows. Before, it was a hard `DELETE` that left subscriptions and requests behind (6 and 3 locally, still hidden by the existing joins).
- **Deleted accounts are left out of user counts and lists** (Users page and search, Users summary / dashboard, Subscriptions "Students" and student picker, header search, Reports user counts). Before, the 52 accounts students had deleted themselves still counted: locally **Students 105 → 53, Active users 110 → 58, Total 111 → 59**. Indexes redefined (never deployed): `users (role, status, deleted_at)` and `users (status, deleted_at)`, so counts stay index-only (summary 111 rows, Users page 51 → 51). Schema `2026-11-14.13`.
- Checked end to end on a throwaway student with a subscription: delete keeps the row, anonymizes, cancels both subscriptions, keeps the payer e-mail, writes the audit row; student count 53 → 54 → 53; gone from the list; a second delete is 404; the old login is refused. Suites pass.

**Checked:** every user page together equals the old order over all users for 4 filter combinations (all, students, active, inactive students); announcements pages 1+2 equal the old first 100; suites, Apple IAP 31/31, security e2e pass.

#### P10. Drugs

- Page query: 745 → 32, 78 ms. Check with `ANALYZE` at its step (search and sort likely unindexed), then keyset plus an index on the sort/search column.
- **Bug:** create returns 500 when optional fields are missing. Default them to `null`.

**✅ P10 implemented locally 2026-11-14 (not committed).**

| Action | Before | After |
|---|---|---|
| Drugs page 1 | 2 · 745 → 32 (count + sort of all) | 2 · 387 → 31 (30 rows by the `(name, id)` index + the total, an index count) |
| Drugs page 5 | 2 · 864 → 31 (OFFSET reads every earlier page; count again) | **1 · 30 → 30** ("after" the last drug shown; no count) |
| Drugs search | 2 · 716 → 3 (count + rows, two scans) | 1 · ≈357 → matches (one read, "contains" kept) |
| Create / update with only a name | **500** (undefined fields) | 201 / 200 (empty optional fields saved as NULL) |
| "Select all" | page of 10,000 full rows | ids only (`?idsOnly=1`) |

- New index `drugs (name, id)` (schema `2026-11-14.12`). Search stays "contains": tried word start (FULLTEXT) but drug names are compounds ("penicillin" must find "Benzylpenicillin"), and the table is small.
- Moved the collation-order sort helper (`sortByName`, utf8mb4_general_ci emulation) to `common/utils/general-ci-sort.ts` (Assessments, Questions, Drugs use it).

**Checked:** all 12 pages together equal `ORDER BY name, id` for all 357 drugs; 4 searches equal the old results and order; select all = 357 ids; create and update with only a name work; suites pass.

#### P11. Small pages (ECG, Auscultation, OSCE, Settings, Question reports, Student detail)

Already small. Check examined = returned at each page's turn (OSCE systems 67 → 6, ECG topics 23 → 11), and fix with indexes where it's off.

**✅ P11 checked locally 2026-11-14: no change needed.** Measured (cold): OSCE systems 3 · 68 → 7, OSCE cases 1 · 26 → 6, OSCE case 3 · 3 → 3, ECG topics 1 · 23 → 11, ECG topic 1 · 1 → 1, Auscultation 1 · 0, Question reports 1 · 0, Settings 2 · 2 → 2, Student detail 5 · 4 → 3. Every page reads ≤ 68 rows from tiny tables. The OSCE subject count (59 of the 68) was left as is: it counts **active** subjects, while `courses.subject_count` counts all, so swapping would change its meaning once a subject is hidden.

**✅ P12 done locally 2026-11-14 (not committed): evidence API removed** (decision confirmed). Removed `ContentGovernanceModule` (`GET /content-governance/evidence`: 41,006 rows per open, and `/evidence/export`), its cache-clearing path, and the medical content QA suite's `checkAuditabilitySurface` check that required it. The governance tables (versions, workflow states, audit events) stay: every lesson, question and assessment save still writes them. Suites pass.

### 9.4 Shared building blocks (built once, used by every page)

1. **Keyset paging helper** (`after` id + `limit` 50, plus total from a stored counter), with the frontend's "Load more" or infinite scroll.
2. **Stored counters**, the 4.9 pattern: adjusted in the save's transaction, lock order lessons → topics → courses, plus Fix counts. New: question stats (P2), quiz counts per course and subject (P1), users and subscriptions totals (P3).
3. **Admin read cache** (`admin-read-cache.ts`) for shared, slow-changing lists (plans, categories), cleared on writes. Not relied on for cold opens.
4. **Lazy tabs and folders** in the frontend, per-visit caches, no duplicate requests, and local updates after saves.
5. **Index batch per page** (1B method): `ANALYZE` before and after on local; one idempotent SQL file; compare with the live index list first.

### 9.5 Order (one page at a time)

| Step | Page | Why this order | Before → target (rows on open) |
|---|---|---|---|
| 1 | P1 Assessments + Questions shared lists | Biggest; also speeds both editors | 38,280 + 12,197 → ≈51 |
| 2 | P2 Questions counts and list | Worst single query (38,939) | 38,939 + 1,000 → ≈54 |
| 3 | P3 Dashboard (charts removed) | First page every admin sees | 16,843 (live ≈30,830) → ≈8 · ✅ done locally: 16,893 → 314 (1 request, 1.7 KB) |
| 4 | P4 Lessons list: merge into Structure | 952 KB every open; the pages repeat each other | 8,960 → ≈51 (Structure's numbers) · ✅ done locally: page removed, search 4–33 rows per query |
| 5 | P5 Subscriptions | 7 requests, 830 KB | ≈6,945 → ≈60 · ✅ done locally: open 636 → 125 (3 requests, 45 KB) |
| 6 | P6 Finance | Shares P5 | ≈10,650 → ≈50 · ✅ done locally: open 214 → 151 (3 requests) |
| 7 | P8 Setup: remove the page | Admin checks in cPanel instead | 15,957 → **0** · ✅ removed locally |
| 8 | P7 Reports | Allowed exception; cache | 4,620 → cached · ✅ done locally: cached 60 s, repeat 0 rows |
| 9 | P9 Users, Roles, Announcements | Grow with time | 433 / 117 / 1,118 → ≤ 50 · ✅ done locally: 52 → 52 and 51 → 50 |
| 10 | P10 Drugs (+ bug) | | 745 → ≈32 · ✅ done locally |
| 11 | P11 Small pages | Check only | already small · ✅ checked, no change |

**Every page step is done when:**
- before and after are measured (cold and warm)
- every save on that page is measured
- examined = returned for every list, or is a listed exception with its handling
- no query over 1,000 rows on open
- one request per open where possible
- frontend updated
- backend tests pass
- this section is updated

### 9.6 Decisions (2026-11-14)

1. **Questions counts:** ✅ **stored counters** (P2), the 4.9 pattern: adjusted in each save's transaction, plus Fix counts.
2. **Lessons list page:** ✅ **merge it into the Structure page.** The user feels the two pages repeat each other. The Lessons page's own features (create a lesson, open in the editor, title search) move into Structure, and `/admin/ai-notes` redirects there. P4 becomes "merge into Structure": no separate 8,960-row list any more.
3. **Dashboard:** ✅ **remove the unused "added per day" charts** (P3). The dashboard becomes 1 request with the 4 totals from stored counters.
4. **Setup page:** ✅ **remove the whole page.** It was a health check (database connected, tables present, settings filled in, row count per table = 15,957 rows per open). The admin checks these in cPanel / phpMyAdmin instead. P8 becomes: remove the admin route, menu item, frontend page and `GET /admin/setup` (backend `modules/setup`), with 0 queries left.

### 9.8 Admin re-measure and next round (2026-11-16) — 📝 decisions settled; runs after the 10.16 website phase (9.9 T3) — ➡️ approved and carried into 10.57 (2026-11-20)

Measured with the live monitor (all clients) on the local copy. The admin website ran on `localhost:5175` against the traced backend on `:3200`. Each page was opened from the menu, the way an admin moves around. Requests · Statements · Rows examined → returned.

#### Before (measured 2026-11-16)

| Page | Requests | Statements | Rows | Notes |
|---|---|---|---|---|
| Structure | 1 | 1–2 | 5 → 5 | ✅ |
| Questions | 3 | 7 | 150 → 150 | ✅ |
| Assessments | 2 | 4 | 102 → 102 | ✅ |
| Question reports | 1 | 2 | 1 → 1 | `SELECT qr.*` |
| Roles | 1 | 1 | 12 → 6 | ✅ |
| Announcements | 1 | 1 | 1 → 1 | ✅ |
| Settings | 1 | 3 | 3 → 3 | 2 separate setting reads |
| ECG | 1 | 1 | 23 → 11 | ECG count per topic as a subquery |
| OSCE | 2 | 3 | 93 → 12 | subject count joins every topic (59 → 4) |
| Users | 2 | 4 | 163 → 54 | user summary counts every user (112 → 3) |
| Finance | 3 | 5 | 216 → 153 | ✅ (allowed: 1 row per paid subscription) |
| Drugs | 2 | 4 | 389 → 33 | `COUNT(*)` over all 357 drugs on every open |
| Dashboard | 1 | 10 | 318 → 17 | users by role 112 → 3, subscriptions count 188 → 1 |
| Subscriptions | 3 | 11 | 525 → 126 | students 106 → 1, subscription totals 218 → 1; plan features read 72 → 36 |
| **Reports** | 2 | **14** | **9,644 → 3,038** | ❌ see below |
| Full reload of any admin page | +4 | +12 | +323 | the shell also loads the **Dashboard** (10 statements) on every page, plus `auth/me` and availability |
| Every admin request | — | +1 (often) | +1 | the admin's own user row is re-read to check the session |

**Reports (the worst):**
- the lessons list is read twice (1,493 → 1,493 each time);
- the summary rows are read twice;
- an audit row is written on every open;
- "hardest questions" scans every submitted answer (2,721 → 8);
- "inactive students" (1,722 → 10) and lessons per course (1,509 → 4) are also heavy.

**Wrong data:** Reports counts exams from `quiz_attempts` / `student_answers`. Since 10.16, exams are no longer written there, so these Reports numbers have stopped moving.

#### Aims
- Every admin page open: ≤ 1–2 requests, rows examined ≈ rows returned, nothing over 1,000 rows.
- 0 statements for the session check.
- No page loads another page's data.
- Reports shows current numbers from the same summary row the app uses.

#### Plan
1. ~~Session check = 0 statements~~ — dropped by D3 (the session check stays).
2. **The shell stops loading the Dashboard** on other pages. The Dashboard loads only when it is opened.
3. **Stored admin counters** (one small row, adjusted in the same statement that changes them; Fix counts rebuilds it):
   - students, staff, pending by role / status;
   - active / expired subscriptions;
   - drugs total.

   These serve the Dashboard (10 → about 4 statements, 318 → about 20 rows), the Users summary (112 → 1), the Subscriptions overview (336 → about 10) and the Drugs total (357 → 1).
4. **Reports rebuilt on the summary row:**
   - totals, passes and average % come from `student_study_summary` (attempts_total, passed_total, percentage_sum) — one indexed read per student;
   - lessons per course from the stored `courses.lesson_count`;
   - each list is read once, and there is no audit row per open;
   - target ≤ 1,000 rows (cached 60 s as now).
5. **Small fixes:**
   - ECG and OSCE use stored counts (`courses.subject_count`, a count column on ECG topics) in place of joins;
   - Settings reads both keys in one statement;
   - Question reports name their columns instead of `qr.*`;
   - plan features are read with exact rows.
6. **Saves** (question / assessment create · update · delete, plan and subscription actions) are measured before and after, as in 9.2.

#### Decisions (user, 2026-11-16)
- **D1 "hardest questions":** ✅ work it out from each student's 5 recent results (the summary row).
- **D3 admin session:** ✅ **keep the session check** (a removed admin is cut off at once). Plan step 1 is therefore dropped: it stays 1 statement, cached briefly as now.
- **D2 "inactive students":** the user asked whether daily activity still works. Checked 2026-11-16:
  - `student_daily_activity` is **no longer complete**. Since 10.15 / 10.16, the phone's lesson Done and exam finish write only the summary row (streak, `last_active_day`, 14-day ring).
  - Day rows still come only from practice finished, older-style exam submits (website) and XP.
  - Local proof: on 2026-11-16 the day rows show 0 exams and 0 lessons, while the summary row has the real activity.
  - The Reports "active students per day" card (from `study_activity_events`) is stale for the same reason.
  - ✅ **Decided:** inactive students and active-per-day both come from the summary row (`last_active_day`, 14-day ring). The user also asked for a check of which tables are really used, so unused ones can be deleted (see 9.9).

#### Changes (files)
- Backend:
  - `admin/dashboard`, `users` summary, `subscriptions` overview, `drugs` (counters);
  - `reports` service;
  - `ecg`, `osce`, `settings`, `question-reports` services;
  - schema step for the counters row (version bump).
- Frontend:
  - admin shell (no Dashboard prefetch);
  - the API client keeps the admin access token.

#### Targets

| Page | Before | Target |
|---|---|---|
| Reports | 2 · 14 · 9,644 → 3,038 | **1 · ≤ 6 · ≤ 1,000** |
| Dashboard | 1 · 10 · 318 | **1 · ≤ 5 · ≈ 20** |
| Subscriptions | 3 · 11 · 525 | **3 · ≤ 7 · ≈ 130** |
| Drugs | 2 · 4 · 389 | **2 · 2 · ≈ 32** |
| Users | 2 · 4 · 163 | **2 · 2 · ≈ 52** |
| OSCE / ECG | 3 · 93 / 1 · 23 | **≈ returned** |
| Full reload of an admin page | +4 · +12 · +323 | **+3 · +2 · +2** |
| Session check per request | +1 statement (often) | +1 (kept, D3) |

### 9.9 Which tables are really used (audit 2026-11-16) — 📝 for the user's decision, nothing dropped

**Method:** every backend source file outside the schema step was searched for each of the 71 tables, looking for reads (`FROM` / `JOIN`) and writes (`INSERT` / `UPDATE` / `DELETE`). The student website's API calls were checked as well. Row counts and sizes are from the local copy.

**Do students use the new tables? Yes — the phone app does.** Its progress lives in `student_study_summary`: lesson bitmap, quiz marks, 5 recent results, streak, XP and the 14-day ring. Alongside it:
- the planner is 1 row per student in `study_planner_tasks`;
- flashcard reviews are in `lesson_flashcard_reviews`;
- the phone also uses `study_bookmarks`, `smart_notes` and `native_push_tokens`.

**The student website does not yet.** Its exams still use the old flow (`/student/quiz-attempts/exam/:id/save` and `/submit`, results, review), so the old exam tables stay until the 10.16 website phase is done.

| Group | Tables (local rows) | Status | Can delete when |
|---|---|---|---|
| **1. Not used at all** (no code reads or writes them) | `announcements` (1,018: notices are a JSON feed since 2026-11-15), `announcement_reads` (325), `notification_dismissals` (414), `lesson_doubts`, `practice_answers`, `practice_sessions`, `question_review_items`, `schema_migrations` | dead | **now**, after a backup |
| **2. Old, no longer written** (only the one-time fills read them) | `student_lesson_progress` (58), `student_xp` (0), `xp_events` (22) | replaced by the summary row (10.12 / 10.15) | after the live server has run the fills (next deploy start-up); then remove the fill code too |
| **3. Written on every save, never read** | `content_audit_events` (19,039 rows, **111 MB**), `content_workflow_states` (20,462), `admin_audit_events` (178) | extra write on each admin save; their only reader (the evidence API) was removed in 9.7 A1 | decision **T1** below |
| **4. Old exam flow, still used by the student website** | `exam_sessions` (196), `quiz_attempts` (34), `student_answers` (910), `study_activity_events` (1,309), `student_daily_activity` (partial since 10.15), `student_quiz_progress`, `student_area_daily`, `student_area_stats`, `lesson_opens` (older app builds) | the phone no longer writes them | after the **10.16 website phase** (website on the summary row) and once old app builds are gone |
| **5. In use** | content: courses, topics, subtopics, lessons, quizzes, questions + options / links / keywords / recaps, papers, flashcards, OSCE / ECG / auscultation, drugs; users, plans, subscriptions, payments, IAP, settings, push tokens, planner, bookmarks, smart notes, summary | keep | — |

**Also noticed:** `content_versions` (19,866 rows, 85 MB) is read for version stamps but keeps every old version. Pruning it is a separate check.

**Decisions (user, 2026-11-16):**
- **T1:** ✅ keep writing `admin_audit_events` only. Stop writing `content_audit_events` and `content_workflow_states`, then drop them (backup first).
- **T2:** ✅ drop group 1 with a backup, through a guarded `.sql` the user runs on live.
- **T3:** ✅ **website phase first.** Order:
  1. the 10.16 website phase (student website on the summary row);
  2. the 9.8 admin round (Reports on the summary row, with D1 (a) / D2 summary row / D3 keep session);
  3. drop groups 1, 2 and 4 and the two content audit tables, each with a backup.

### 9.7 Added from the Desktop audits (`~/Desktop/databse load audits`, 13 Nov, local measurements)

Six files were read (SQL execution, capacity, SQL performance, dashboards and reports, five workflows, admin dashboard on live). Their findings already in this plan (dashboard 30,830 rows and unused charts, Assessments lists 37k, admin lessons 9k and the "Draft" bug, notifications scan, web double lessons request, Questions counts 38,939, Flutter many requests) are not repeated. **New for the admin programme:**

| # | Item | Measured (13 Nov) | Plan | Step |
|---|---|---|---|---|
| A1 | **Evidence API** `GET /content-governance/evidence` (`content-governance.service.ts` `getEvidence`) | **41,006 rows**, 353 KB, 0.2–0.4 s; full scan of `content_workflow_states` (~20k) + filesort + 7 subqueries per row | **No admin page calls it** (web and Flutter searched 14 Nov), so it costs nothing unless opened directly. Decision needed: remove it (and `evidence/export`), or keep with pages of 100 + index `content_workflow_states (updated_at, entity_type, entity_id)` | P12 (new) |
| A2 | **Publishing → push to every phone** (lesson, quiz, flashcards, announcement) | `push-notifications.service.ts` sends to every token at once (`Promise.all`) and writes 1 row per failed token; then many phones open the app together (the 14 Nov load test: 25 Flutter opens at once → 503s) | Send pushes **in small batches spread over a few minutes**, and write failed tokens in one statement. Admin saves stay instant; students get the notice within minutes | P13 (new) |
| A3 | **Old bulk reorder endpoints** (`PATCH /admin/ai-notes/reorder`, `/admin/topics/reorder`, `/admin/subtopics/reorder`) | One `UPDATE` per item, all at once, no transaction: 300 items → 196 failed (13 Nov); 520 → 503 after 104 (14 Nov) | The app no longer calls them (moves use gap ranks). **Remove them**, or turn each into one statement in a transaction | P14 (new) |
| A4 | **Prepare round trips** | 27–42 % of all statements are "Prepare": each new connection prepares statements again, and connections close after 10 s idle | Shared building block: use `query()` for one-off admin reads, keep `execute()` only on hot repeated paths; measure the share before and after | 9.4 |
| A5 | **Pool safety** | No limit on how long a request waits for a connection; the line of 100 overflows into 503s under bursts | Shared building block: a bounded wait for a connection and a log of long waits; consider `DB_QUEUE_LIMIT` 50 (fail fast with 503 + Retry-After). Keep the pool from `.env` with the cap rule (`DB_MAX_USER_CONNECTIONS`) | 9.4 |
| A6 | **Per-request query counter** | Real queries per request on live are unknown | Shared building block: count queries and time per request in one place around the pool, log requests over 1 s with route and query count (no parameters). Used to confirm every page's after-numbers on live | 9.4 |
| A7 | **Reports grow with students and answers** | "Hardest questions" scans every submitted answer, "inactive students" reads every student's activity (≈4,600 rows/open today, no cache) | P7: cache 1 min (cleared on attempt writes), and a running tally per question for "hardest questions" so it stops scanning all answers; the student filter list gets search + pages (today only the first 100 students appear) | P7 |

**Order update (9.5):** P13 (push spreading) goes right after P3, because it protects the server from the biggest burst source; P14 (remove old reorder endpoints) with P4 (merge Lessons into Structure); P12 after P11 once decided.

**Decisions (14 Nov):**
- **A1:** ✅ **remove the evidence API** (`GET /content-governance/evidence` and `/evidence/export`; nothing calls them).
- **A2:** ✅ **spread "new content" pushes over about 3 minutes.** Also: the push settings are read **once per publish, not once per phone** (today 5 + 2 × phones queries: 10 phones ≈ 25 queries → target **1–2 queries for all phones**), and failed tokens are written in one statement.
- **A3:** ✅ **remove the old bulk reorder endpoints** (lessons, topics, subtopics).

**✅ P13 implemented locally 2026-11-14 (not committed).** Measured with the real service and database; only the network call to Apple was replaced, so no phone got a push (the local copy has real tokens). Slow log at 0 s, one "new content" publish:

| Phones | Before: statements · rows examined | After: statements · rows examined | Sending |
|---|---|---|---|
| 9 | 24 · 146 (21 settings reads) | **4 · 26** | 1 batch, now |
| 49 | 106 · 703 (100 settings reads) | **7 · 109** | 5 batches |
| 199 | **failed: "Queue limit reached", 0 pushes sent** (≈400 parallel settings reads overflowed the pool's queue of 100, which every other request also waits in) | **19 · 424** | 17 batches over **160 s** (default window, measured) |
| 999 | (not run) | **21 · 1,389** | 18 batches |

After, per broadcast whatever the number of phones: the announcement row (new content only), **1 settings read** (APNs + FCM together), **1 token read**, and 1 write per batch **only if** some tokens failed (failed tokens recorded in one statement per batch instead of one per phone). The publish call returns in ≈20 ms; phones get the notice within 3 minutes.

**What changed**
- `NativePushSender.loadSettings()` reads both platforms once; `send()` and `isConfigured()` take that snapshot (before: 2 reads per phone, plus 4 for the "configured?" checks). `SettingsService.getRawPushSettings()` = one `system_settings` read.
- `sendToAudience(…, { spread: true })` for broadcasts nobody waits on (new content, published announcements): batches of max(10, phones ÷ 18) every 10 s (`PUSH_SPREAD_MS`, default 180000). The admin's own "Send notification" still sends now (25 at a time) and shows sent / failed.
- Like the existing flashcard debounce, batches not yet sent are lost if the server restarts during those 3 minutes.

**Checked:** pushes reach every phone (9 / 49 / 199 / 999), dead tokens (410) are disabled and others keep their error, the immediate send returns correct counts (54 sent, 5 failed), backend unit and security suites and Apple IAP 31/31 pass, no test rows left.

---

## 10. Student app optimisation (Flutter + student website, 10/10 target) — ✅ approved 2026-11-15

**Decisions (asked and answered 2026-11-15):** server and app together, released after (no live users yet); the student website gets the same design; Android (FCM) too. Every Flutter screen change: 3 phone-size mockups in the browser first, wait for approval, keep the app consistent. Lists folder by folder. Phone cache about a day, lists browsable offline, pull-to-refresh reloads only that screen. Freshness per screen decided with the numbers.

### 10.1 How it is measured

Live load monitor: `tools/dev-monitor` (backend on :3200 with `DEV_QUERY_TRACE=1` tags every SQL statement with its API request; the monitor reads the MariaDB slow log and counts only the phone app, `X-App-Client: xyndrome-mobile-app`). The app is built to the iPhone against the Mac (`API_BASE_URL=http://172.20.10.6:3200/api`). A fixed 12-step route is walked before and after:

1. Open the app (Study Hub) · 2. Courses · 3. Medicine · 4. Respiratory Medicine → Asthma, scroll · 5. back to Courses → Peadiatrics · 6. Q-Bank · 7. first quiz, look, back (no submit) · 8. Study → Lessons · 9. Flashcards · 10. first deck, one card, back (no answer) · 11. Planner · 12. Study Hub again.

**Before (2026-11-15):** 23 requests · 174 statements · **34,492 rows read** · 9,482 returned · 157 KB (`tools/dev-monitor/runs/before-*`).

| Screen | Calls | Rows read | Why |
|---|---|---|---|
| Flashcard decks | 2 | 9,064 | reads every lesson (8,955) to list decks |
| Lessons list | 1 | 8,958 (57 KB) | every lesson with joins |
| Q-Bank list | 2 | 4,230 | every quiz with joins |
| Study Hub | 1 | 4,144 (23 statements) | every lesson + subtopic to count progress |
| Courses list | 2 | 4,000 | same reads again |
| Course detail | 2 | 2,157 | the course's lessons + subtopics |
| Notifications | 1 | 1,048 | scans all 1,019 announcements to return none |
| Subscription details | 1 | 427 | plans, features, payment settings read twice each |
| Every request | — | 4–7 extra statements | session lookup + repeated subscription reads |

### 10.2 Shared foundations

1. **Signed access token, 1 hour**, verified by signature on every protected request (no session SQL); carries user, role and a small access summary (plan, scope, until). The session token becomes the renewal token (renewal = one indexed user row = the cold-open check). **Payments / subscriptions and account / security always check the database.** Sign-out blocks the token at once in the server process. The website uses the same model via cookies. One session per account stays as today.
2. **One start-up request**: user, access summary, Study Hub summary, list version numbers, new-content notices newer than the phone's last id, active announcements. Target < 10 rows.
3. **Phone cache**: lists saved ~1 day, offline browsing; re-download only when a version number changed or on pull-to-refresh (that screen only).
4. **Stored numbers**: quiz and flashcard counts per subject / topic (lesson counts exist); a **per-student summary row + per-topic stats** updated in the same save (quiz submit, lesson progress, flashcard review). Student-id + index reads, no `SELECT *`, ≈ ≤ 10 rows per request except real lists, examined = returned.
5. **Notifications without MySQL**: APNs + FCM + a local inbox on the phone (read / unread / bell count local); a shared JSON feed of the last ~30 new-content notices (atomic writes, survives restarts, audience filter) sent in the start-up response as "newer than id N"; personal reminders (subscription ending, weak topics) scheduled locally; admin announcement popups in a separate JSON file (start / end, priority, once per device, offline). No per-student notification rows, no polling; announcement SQL removed.

### 10.3 Screen targets

| Screen | Before | Plan | Target rows |
|---|---|---|---|
| App open / Study Hub | 4,144 + checks | start-up request; summary row + top topic stats | ≈ 10 |
| Courses list | 4,000 | stored counts + per-course progress of the student | ≈ 8 (cache: 0) |
| Course detail | 1,040–2,157 | subjects with stored counts; a topic's lessons on open | ≈ 20 + topic lessons |
| Lessons list | 8,958 | folder by folder | ≈ 10–30 per level |
| Q-Bank list | 4,230 | folder by folder, stored quiz counts, student's attempts for the folder | ≈ 10–40 per level |
| Quiz open | 348 | drop the unused version lookup (156) | ≈ 140 (needed content) |
| Flashcard decks | 9,064 | stored card counts; student's due / new counts by index | ≈ 10–40 per level |
| Notifications | 1,048 | start-up feed + local inbox | 0 |
| Subscription details | 427 | once a day + after changes; plans / features cached | ≈ 5 when fetched |

**Route estimate:** 34,492 → roughly 500–900 rows cold, much less from the phone cache. Confirmed by the after-run on the phone.

**Mockups needed (3 each):** Lessons tab, Q-Bank list, Flashcard decks, Study Hub, Notifications inbox + announcement popup. Courses list / course detail / quiz screens keep their look (ask first if that changes).

### 10.5 Step 2a: signed access tokens ✅ implemented locally 2026-11-15 (not committed)

- **Server:** `common/auth/access-token.ts` (HS256 JWT, 1 h or until the student's access ends; secret `ACCESS_TOKEN_SECRET`, else derived from `SETTINGS_ENCRYPTION_KEY`) and `common/auth/token-user.ts`. Every sign-in path returns `accessToken` + `accessExpiresIn` (the session token still comes as the `lms_session` cookie). `POST /auth/token` renews with the session token (one indexed user row + the access profile). All token lookups accept the signed token first with no SQL (AuthService, the student guard and API-boundary middleware through it, and the own lookups in quiz-attempts, dashboard, lessons, smart-notes). The access profile now needs 1 statement, not 2 (the second re-checked the same subscription).
- **Database still checked (sensitive):** all student subscription / payment endpoints (`requireFreshStudent` / `requireFreshUser`), profile edit, profile setup, password change, account delete. They verify the token and then the session row by user id + session hash.
- **Revocation:** sign-out (with either token), a new sign-in elsewhere, password change, deactivate and delete revoke issued access tokens at once in this process (`forgetUserSessions` / `forgetSessionToken`). An expired or revoked token answers 401 `ACCESS_TOKEN_EXPIRED`; a tampered one a plain 401.
- **App:** `ApiClient` keeps the saved session token as the renewal token and the access token in memory; it renews before expiry (one at a time), retries once on `ACCESS_TOKEN_EXPIRED`, and signs out only when renewal is refused. Older app builds that send the session token keep working.
- **Checked:** 12 flow checks pass (sign-in gives both tokens; courses list with the access token runs no session or account SQL, 9 → 6 statements; subscriptions/me re-checks the session row; renewal works and refuses an access token; tampered → 401; after sign-out the old access token gets `ACCESS_TOKEN_EXPIRED` and renewal fails; old session-token clients still work). Backend unit and security suites, Apple IAP 31/31, security e2e pass; `flutter analyze` clean.

### 10.6 Step 2b: start-up request + phone cache ✅ implemented locally 2026-11-15 (not committed)

- `POST /app/start` (session token): renews the access token (the cold-open account check) and returns user, access, `contentVersion` and Study Hub in one reply. The app's cold open now makes only this request (was `/auth/me` + dashboard prefetch + list refreshes).
- **Catalogue version** (`common/utils/content-version.ts`): +1 on every admin/staff catalogue save (student actions excluded), kept in memory (0 reads) and persisted in `system_settings.content_version`. Tested: a lesson open leaves it, an admin save raises it.
- **Phone cache** (`savedFirst`): a saved list is trusted up to a day (Study Hub 30 min) and re-fetched only when the catalogue version changed (courses, course pages, lessons, Q-Bank, decks), after the student's own change (`freshNext`, already in place), or on pull-to-refresh. Subscription details once a day (+ after a purchase / redeem / pull-to-refresh); course pages saved and cleared after a purchase.

### 10.7 Step 3a: courses screens ✅ implemented locally 2026-11-15 (not committed)

- **Course structure snapshot** (`modules/courses/course-structure.service.ts`, decision 2026-11-15): active courses, subjects, topics and ready lessons are the same for every student, so ONE background worker builds them per catalogue version, reading each table in id order **≤ 1,000 rows per read with a 250 ms pause between reads** (measured: 4, 47, 301, 1,000, 493). A save during a build makes it run once more afterwards (never two at once); requests keep the current snapshot meanwhile. Kept in memory and in `backend/storage/cache/course-structure.json` (atomic write, not committed), so a restart reads the file.
- **Subscription scopes in the token:** the student's active subscription scopes are read once at token issue and carried in the token; courses, lessons (2), quiz-attempts and quizzes read them from the request's token (each still applies its own rule), else the database (older app / website). A per-request context (`common/auth/subscription-scope.ts`) holds them.
- **Measured (signed token, test student):** courses list 9 statements · 4,000 rows → **1 · 1**; course page 8 · 1,350 → **1 · 1** (the student's own progress rows).
- **Checked:** byte-identical answers for 2 students on the list and all 4 course pages; every app screen returns the same body with the token as with the session token (only the clock and the random drug batch differ); suites, Apple IAP 31/31, e2e (fake database taught the new reads; e2e snapshot file goes to a temp folder).
- **Noted for step 5:** a course page still sends the whole course (158 KB); loading a subject on open is checked then (mockups first if the screen changes).

### 10.8 Step 3b: Study Hub (design A) ✅ implemented locally 2026-11-15 (not committed)

- **Design A** (mockups `tools/mockups/study-hub.html`, picked 2026-11-15): same 13 sections, order and look. The top part (greeting, goals line, continue card, chips, course progress, streak, level) comes with the start-up request; the lower cards (plan, analytics, question of the day, weak areas, recent results) come with **one** request, `GET /student/dashboard/more`, made when the list first builds them (Flutter `ListView` builds lazily, so that is when they scroll near). Placeholders hold their space. `GET /student/dashboard/top` refreshes the top; `GET /student/dashboard` (whole) stays for the website and older builds.
- **Stored per student** (`modules/study-stats/study-stats.service.ts`, schema `2026-11-15.2`):
  - `student_study_summary`: one row; attempts, passes, percentage sum, the streak worked out for the day, 45-day trim marker.
  - `student_daily_activity`: one row per day; exams (+ percentage sum), practice, lessons read, results opened, subjects touched, XP earned; stored `active` + index `(user_id, active, day)` for the streak and 7/14-day windows.
  - `student_area_stats`: 45-day running totals per course (1), subject (2) and deepest area (3: topic, else subject, else course, so course-only questions count); stored `eligible` (≥ 10 answered) and `wrong_rate` + index `(user_id, level, eligible, wrong_rate, answered)`: the weakest/strongest are read straight off the index.
  - `student_area_daily`: per-day copies, only to take days out after 45 days (once per student per day, one `UPDATE … JOIN`, then the day rows are deleted).
- **Rules agreed:** every attempt counts (retakes too); pruned old attempts keep their numbers; answers count as marked at submit time (no re-marking after key fixes or topic moves); an area ranks with ≥ 10 answered questions; unanswered = neither right nor wrong; weak areas ranked by wrong-answer %, not by count.
- **Writes:** inside the exam submit transaction, 4 multi-row statements whatever the number of questions (summary, today, area totals, area days). Lesson read / practice / result opened: 1 statement on today's row. XP: today's XP read from today's row (was a SUM over the day's events) and added after paying.
- **First use per existing student:** built once from history (attempts, activity events, last 45 days of answers, XP per day), measured 23 statements · 1,104 rows for the test student; new students start empty.
- **Question of the day (app):** a random point from the date + student hash, then `LIMIT 1` off `idx_questions_status_type_id` (1 row) + its 5 options; the id range is kept per catalogue version, the answer per student per day. Website keeps the free-quiz pool (step 6).
- **XP index:** `exam_sessions (submitted_attempt_id)`: XP's read after a submit scanned every exam session (178 → 2 rows).
- **Measured (test student, signed token):**

| | Before | After |
|---|---|---|
| Study Hub open (cold start) | 13 statements · 169 examined · 17 returned (grows with every answer) | top in start-up: **8 · 9 · 9** |
| Lower cards (on scroll) | (inside the above) | **8 · 12 · 12** (first open of the day 11 · 18 · 19: question of the day picked) |
| Exam submit (20 questions) | 12 statements · 210 examined · 57 written | 16 · **34** · 61 (4 batched stats writes) |
| Lesson read logged | 1 statement | 2 statements · 0 examined |

- **Checked:** stats written by a submit equal a fresh rebuild from history (summary, days, areas, area days); lesson read adds today's lesson and its subject; results opened counted; an expired day leaves the totals and its rows are deleted, once a day; the streak is read from the summary row after the first open of the day; the whole answer matches the old one except the weak-area numbers (new rules) and the dropped unused smart-note totals; suites pass (unit, access control, security e2e, Apple IAP 31/31). Flutter analyzer clean; **not yet run on the phone** (full phone check at step 7).
- **Website:** "missed questions" is now per deepest area (course › subject › topic) with miss % and answered count, instead of per lesson and question type.

### 10.9 Step 4: notifications without MySQL ✅ implemented locally 2026-11-15 (not committed)

- **Notices feed** (`modules/notices/notices.service.ts`): `backend/storage/notices/feed.json` (not in git) keeps the last 30 notices (new content, admin in-app messages) with an audience. New-content publishing and admin "Send notification" (in-app) add to it instead of inserting `announcements` rows. Writes are atomic (temp file + rename); another server process's write is picked up by the file's modification time. Started **empty** (old 1,018 announcements not imported; tables kept, no longer read).
- **Phone inbox:** the start-up reply carries the notices newer than the phone's last id (`POST /app/start {lastNoticeId}`); `GET /app/notices?after=` (0 SQL) is used after a fresh sign-in and on the inbox's pull-to-refresh. Read and cleared are kept on the phone (`mobile/lib/state/notice_store.dart`); the bell badge needs no request. Pushes carry `noticeId`.
- **In-app announcements** (decision 2026-11-15, mockups `tools/mockups/announcement-popup.html`): the admin Announcements page now manages `popups.json`. Per announcement the admin picks **centre card** (optional https picture) or **Study Hub banner**, plus start/end, priority (0–100), audience, button text and app path. The app shows **one at a time**, highest priority first, once per device, offline from the saved copy; a centre card shows at most once per app session. Saving one that overlaps other live ones for the same audience shows advice to keep just one.
- **Personal reminders on the phone** (`mobile/lib/services/plan_reminders.dart`): plan ends in 3 days / today (10 AM; not for Apple plans that renew), weekly weakest-subject reminder (Sunday 6 PM). The user reply now carries `accessUntil` / `accessRenews` (0 extra SQL). The server no longer derives subscription or weak-topic notices.
- **Website:** the notifications list comes from the feed (0 SQL); read state is kept in the browser (`xyndrome.notices.read`). Mark read / read all / clear / dismiss endpoints answer OK and write nothing.
- **Content version:** announcement, notice and push saves no longer raise the catalogue version (they had made every phone re-download its lists).
- **Android (FCM):** server sending already exists (FCM HTTP v1 in `native-push.sender.ts`, configured in admin Settings with a service-account key). Still needed when Firebase is set up: `android/app/google-services.json`, the Firebase Messaging plugin + a token hand-off to `POST /push/native-token` with `platform: android`. Until then Android gets notices and announcements with the start-up reply.
- **Measured:** notifications list 1 request · 4 statements · 1,059 rows → **0 statements** (website) and **0 requests** on the phone (the bell used to load it on every Study Hub open); start-up adds 0 statements; new-content publish and admin in-app send 1 INSERT → 0 (file write).
- **Checked:** feed newest-first, "newer than last id", audience filter; popups by priority, drafts/ended/admin-only hidden from students; end-before-start refused; outside links dropped; files written; content version unchanged by notice saves; admin page saves, shows live/scheduled/ended and the overlap advice (browser); unit suites, access control, security e2e (now pins "no notification tables"), Apple IAP 31/31; website builds; Flutter analyzer clean on the changed files. **Not yet run on the phone.**

### 10.10 Step 5: screens, catalogue on the phone, less data ✅ implemented locally 2026-11-15 (not committed)

- **Shared student catalogue** (`modules/courses/student-catalogue.service.ts`, `GET /student/catalogue`): courses, subjects, topics, ready lessons (with flashcard count + card stamp + lesson stamp) and quiz sets, built once per catalogue version by the existing single worker, compact arrays, gzipped once (≈35 KB on the wire, 0 database rows), `ETag` → 304 when unchanged. Kept on the phone **as a file** for every account, refreshed only when the start-up / sign-in reply carries a newer version.
- **Student progress** (`GET /student/progress`): plan access from the signed token (0 SQL), lesson progress and the new stored `student_quiz_progress` (exam attempts, practice runs, newest attempt, best mark; written in the submit transaction / practice event; built from history once) — all by user id (2 statements · 3 → 3 rows for the test student). Shared access rules in `common/auth/content-access.ts`.
- **Lists built on the phone** from catalogue + progress: lessons list, Q-Bank list, Courses tab, course pages, Lessons pages, flashcard decks. Checked identical to the old server lists for 2 students (1,478 lessons, 649 sets: order, names, completed, locks; decks: tree, counts, due, locks).
- **Designs** (mockups `tools/mockups/lessons-qbank.html`): Lessons = subject **shelf** like the Q-Bank full-course series, one subject at a time, Continue-learning card under it (next unfinished lesson after the last finished); Q-Bank = original look, one subject / one series at a time.
- **Flashcards fully on the phone:** decks from the catalogue; a lesson's cards downloaded once (`GET /student/flashcards/cards`) and again only when its stamp changes; FSRS scheduling with the official Dart `fsrs` package (FSRS-6, same settings); review progress kept per account on the phone; the server history imported once (`GET /student/flashcards/reviews/export`). No request per review.
- **Lesson open (phone):** one `lessons` row by primary key, 7 columns (`id, lesson_title, is_free, course_id, video_url, pdf_url, note_data`), no joins; reply = id, title, isFree, accessLocked, noteData, pdf/video only when present (17.6 → 9.4 KB for Asthma; the unused `raw_text` was 41%). Kept on the phone until the lesson's stamp changes.
- **Practice quiz (phone):** unused content trace / answer key left out; kept on the phone until the catalogue version changes.
- **Sign-in = 1 request:** the phone sign-in reply carries Study Hub top, notices, announcements, catalogue version (was sign-in + token renewal + notices + Study Hub). The app keeps the sign-in reply's access token.
- **Smaller access token:** the 1 KB feature list became one word ("all" / "none"), rebuilt on read (checked identical to the database list) — token 1.9 → 0.76 KB, on every request.
- **Smaller reply headers:** phone JSON replies get the short API security policy (`default-src 'none'; frame-ancestors 'none'`) instead of the 765-byte page policy — reply headers 1,222 → 526 bytes, on every request.
- **Server fixes on the route:** flashcard decks 9,001 → 44 rows (catalogue instead of the full lesson list ×2), quiz open 337 → 181 (unused content-version lookup removed), results 44 → 13 (by id lookups), planner 14 → 7 (sorted in code), `/subscriptions/me` repeat 429 → 76 (plan list cached per save, payment settings read once); website lesson / Q-Bank catalogues now kept per catalogue version instead of 30 s (8,956 / 2,118 → 1 / 12 rows between saves).
- **Phone behaviour:** saved data kept on sign-out (per account), removed only by deleting the account or the app; no requests while signed out and 401s never retried (the ~9 s of 401 retries after sign-out); bookmarks kept on the phone, re-read only after a change; timing marks (`--dart-define=PERF_LOG=true`).
- **Route measured on the phone (build before the last round):** 21 requests · 56 statements · 324 rows · 71 KB, against the baseline 23 · 174 · 34,492 · 157 KB. Final comparison after the next build.
- **Round 3 (less data, fewer rows):** start-up and sign-in replies carry the student's progress (no separate request); the phone's Study Hub top is "lite" (no course progress / latest attempt — built on the phone from catalogue, progress and results): 8 · 9 → 5 · 6 rows; **two-level catalogue**: index (202 B) + one part per course by fingerprint (`/student/catalogue/index`, `/student/catalogue/parts?courses=`), so a content edit re-downloads only that course (Medicine ≈ 8 KB instead of 35.5 KB), assembled identically on the phone; the catalogue is built in the background on content change / start-up and kept in `backend/storage/cache/student-catalogue.json` (never built inside a request); sign-in reads the student's subscriptions once per request (was 3 queries); the active-quiz count comes from the catalogue (was a 649-row count after each restart). **Sign-in after a restart: 12 statements · 664 rows → 11 · 15 → 12.**
- **Round 4 (exam flow):** newest exam session read off a new index `exam_sessions (user_id, quiz_id, id)` (11–12 rows → 1); submit reuses the session and questions it already read (3 session reads → 1 + the locked one); old attempts trimmed only when the stored attempt count passes the cap (count returned with the write via `LAST_INSERT_ID`, no read); plan checks from the signed token (0 SQL; Q-Bank list 3 identical checks → 1); quiz questions in order off `question_quizzes (quiz_id, sort_order, question_id)` (60 → 40 rows). **Exam open 19 statements · 220 rows → 7 · 162; submit 21 · 58 → 19 · 23** (with a trim; ≈ 15 · 11 without). Schema `2026-11-15.5`.
- **Round 5 (fewer statements):** Study Hub summary, today's row and XP total in one read by primary keys (3 → 1); lower cards' weakest / strongest / missed areas in one `UNION ALL` statement (each part off `idx_area_rank`, 3 → 1); the phone skips the lesson "opened" XP-timer ping for lessons already completed. **Study Hub top 5 · 6 → 3 · 4; lower cards 8 → 3 statements (6 on the day's first open); sign-in 11 · 15 → 8 · 12.**
- **Open:** student website moves to catalogue + progress later (decided 2026-11-15); `PATCH /flashcards/settings` (global FSRS settings) is allowed for any student — to fix separately.

### 10.11 Phone fixes: Planner spinner, lesson open in one request ✅ implemented locally 2026-11-15 (not committed)

**Planner spun forever (bug, found on the iPhone).** `savedFirst` (step 5 "share one request") wrapped each fetch as `original().whenComplete(() => _inFlight.remove(key))`. `remove` returns the removed future — the request itself — and `whenComplete` waits for a returned future, so the request waited on itself and never finished.
- Hit every list with **no saved copy** (first load after install or sign-in): the Planner showed a spinner with no error. Lists that had a saved copy looked fine, but their quiet background refresh never finished either, so saved copies were never updated.
- **Found with:** dev-only timing marks the phone sends to the load monitor (`PerfLog` → `GET /api/__dev/mark/<ms>/<label>`, recorded by the request trace; PERF_LOG builds only, release builds print nothing). Phone: `GET /student/planner` 200 in 10 ms, Dio got the reply, `savedFirst` never resumed. Reproduced on the Mac with the real `plannerTasksProvider` against the local backend.
- **Fix:** the callback returns nothing (`whenComplete(() { _inFlight.remove(key); })`). Regression test `mobile/test/saved_first_first_load_test.dart`.
- **Measured (test student, cold, no saved planner):** before: provider still loading after 25 s, server work 1 request · 1 statement. After: done (775 planner rows from 6 saved plan rules), same 1 request.

**Lesson open: 2 requests → 1.** The phone sent `GET /lessons/:id/note` and then `POST /courses/student/lessons/:id/opened` (starts the 60 s XP clock).
- Now the phone adds `?opened=1` to the lesson request when the lesson is not completed; the server runs the same one-row `lesson_opens` upsert inside that request (`LessonsService.canvasStudentFindNote` → `XpService.markLessonOpened`, only when the lesson is open to the student). A lesson shown from the phone's saved copy still sends the small POST (no lesson request then). Completed lessons send neither.
- **Measured (Requests · Statements · Rows examined · Rows returned), uncompleted lesson fetched from the server:** before 2 · 2 · 1 · 1 → after **1 · 2 · 1 · 1** (the upsert examines nothing).
- **Deploy together:** the new app against an old server would skip the opened time (the old server ignores `?opened=1`). Website and older app builds keep using `POST …/opened`.

### 10.12 Lesson timer on the phone, XP in one place, planner in one row ✅ implemented locally 2026-11-15 (not committed)

#### Decisions (user, 2026-11-15)
1. **The lesson timer runs on the phone: 2 minutes.** "Done" sends nothing before 2 minutes (a "not so fast" note shows the time left), so only a lesson actually studied reaches the server; "Done" then sends the seconds and the server pays XP only at ≥ 120 s. Trust the phone: a tampered app could claim the time (lesson XP is 6, under the daily cap) — accepted. Server rule `LESSON_MIN_SECONDS` = 120 for every client.
2. **XP has ONE home: the student's summary row** (`student_study_summary`, by user id). Every XP event (lesson, exam, streak) updates that row only; what was already paid is marked on the row the reward belongs to (a lesson's progress row, an exam's quiz progress row). `student_xp` and `xp_events` are no longer written. Streaks stay only in the summary row.
3. **"Done" = option B** (picked from A / B / C): lesson open reads only the lesson; the first "Done" writes the completion, then pays XP in the summary row; a repeat "Done" is one statement. (A — create the row at open — and C — a database trigger — were not taken; a join UPDATE can't create the lesson's progress row, which does not exist before the first "Done".)
4. **Planner = one row per student behind the OLD endpoints.** No new endpoints; phone, website and older builds use `/student/planner` as before; only the storage changed.
5. **No clash with live or older builds.** Old rows kept (add/update only), older builds keep their own paths, schema changes in the critical list with the version bumped.
6. **Everything as close to 1 · 1 · 1 as possible**, by primary / unique keys and user id.

#### Aims
- Lesson open: only the lesson row. "Done": the fewest statements, one row each; no request before 2 minutes.
- XP and streak numbers written in one place, read in one row.
- Planner: one row read, one statement per write, whatever the plan size (old per-item plans had up to 256 rows).

#### Before (measured 2026-11-15, test student · Requests · Statements · Rows examined → returned)

| Action | Before | Statements |
|---|---|---|
| Lesson open (after 10.11) | 1 · 2 · 1 → 1 | lesson row by PK; `lesson_opens` upsert |
| Lesson "Done" | **2** requests · 8 + 2 statements · 4 → 4 | lesson read; progress upsert; `lesson_opens` read; streak `xp_events` check; today's row read; `xp_events` insert; `student_xp` upsert; today's row upsert — plus the separate `POST /dashboard/student/activity` (activity event insert + today's row) |
| Exam XP (after submit) | 1 · ≈ 9 | attempt read; `xp_events` marker; take check; retake count; inserts per reward; `student_xp`; today's row |
| Planner open | 1 · 1 · 7 → 7 | every row of the student (up to **256**) |
| Planner add own task | 1 · 1 · 0 | insert |
| Planner swipe done | 1 · 2 · 2 → 1 | ownership read; update |
| Planner delete task | 1 · 1 · 1 | delete |
| Planner generate | 1 · 2+ | paid check (SQL); multi-row insert |

#### Plan (as built)

**A. Lesson timer + "Done"**
1. Phone (`lesson_canvas_page.dart`): the screen's own clock; "Done" before 2 min shows the time left and sends nothing; after, `PATCH /courses/student/lessons/:id/progress` with `readSeconds` and the lesson's `subjectId` (from the catalogue). The old "opened" ping and the separate activity request are gone. Lesson open is the lesson request only (10.11's `?opened=1` removed).
2. Server, statement 1 (`CoursesService.completeLesson`): `INSERT … SELECT … FROM lessons l WHERE l.id = ? AND l.status = 'active' AND (<plan access from the signed token>) ON DUPLICATE KEY UPDATE …` on the unique `(user_id, lesson_id)` row. Its first update assignment hands back through `LAST_INSERT_ID` (row unchanged) whether the lesson was already completed — no read. No lesson → 404.
3. New completion from the new app: statement 2, today's Study Hub row (`recordActivity`: lessons + 1, subject, active day) — what the old activity request did.
4. New completion ≥ 120 s: statement 3, the XP payment (below). Repeat "Done": statement 1 only. Older builds (no `readSeconds`): the same statement 1, then their `lesson_opens` read as before; they still send their own activity request (not counted twice).

**B. XP in the summary row (`XpService.pay`)**
- New columns on `student_study_summary`: `xp_total`, `xp_today` + `xp_day`, `streak_xp_day`, `streak7_paid`, `streak30_paid`. One `UPDATE … WHERE user_id = ?` adds the base XP, today's streak-day XP once, the 7 / 30-day bonuses once, never past the daily cap — all worked out inside the statement from the row's own columns (single-table assignments run left to right, so each still sees the old values) — and returns the amount through `LAST_INSERT_ID`, so the app still shows "+6 XP" with no read. A student without a summary row gets it built once, then the payment is made.
- Exams (`onExamSubmitted`): attempt read (score, time) → ONE `UPDATE student_quiz_progress` on `(user_id, quiz_id)` works out take / retake / pass XP from the marks there (`xp_take_paid`, `xp_retakes_paid`, `xp_pass_paid`) and records the attempt (`xp_attempt_id`, so a second look pays nothing) → `pay()`.
- Reads: the Study Hub's one primary-key read takes `xp_total` and today's XP from the summary row (no `student_xp` join); `getSummary` the same.
- One-time copy (schema step): `student_xp.total_xp` → `xp_total`; today's XP; today's streak mark; 7/30 bonuses; each quiz's paid marks from `xp_events`. History rows stay.

**C. Planner in one row (old endpoints)**
- `study_planner_tasks`: `category` ENUM gains `'plan'`; `rule_json` → MEDIUMTEXT; generated `plan_owner = IF(category = 'plan', user_id, NULL)` PERSISTENT with **UNIQUE** `uniq_planner_plan_owner`. `rule_json` = `{ v, items: [...] }`, each item = what a row was (rule or own task), ids as strings.
- `GET` reads the row by `plan_owner` and answers the old list (same ids, order, fields — checked identical: 7 of 7). `POST` / `POST /bulk`: one upsert with `JSON_MERGE_PRESERVE` (creates the row the first time; new ids made on the server from the time, no read). `PATCH /:id`: one `JSON_SET` at the path `JSON_SEARCH` finds for that id (none → 404). `DELETE /:id`: `JSON_REMOVE` the same way. `DELETE` (clear): one `UPDATE`, count back through `LAST_INSERT_ID`. The website agenda reads its own tasks from the same row. Generate's paid check reads the signed token's subscriptions (no SQL; free plan excluded).
- One-time fold (schema step): each student's old rows → their plan row (14 students locally); old rows kept, unread.

#### Changes (files)
- Backend: `common/utils/planner-doc.ts` (new); `workspace.service.ts`; `courses.service.ts` + `dto/update-student-lesson-progress.dto.ts` (`readSeconds`, `subjectId`); `xp.service.ts`, `xp.rules.ts` (120 s); `study-stats.service.ts` (XP read from the summary row; new summary rows start from the old total); `lessons.service.ts` / `lessons.controller.ts` (`?opened=1` removed); `schema-sync.service.ts` steps "xp in the summary row" + "planner one row", **`CRITICAL_SCHEMA_VERSION` 2026-11-15.6**; `test/security.e2e.ts` (fake DB taught the plan row and the one-statement "Done"; ownership asserted on `plan_owner`); compiled `dist`.
- App: `lesson_canvas_page.dart` (2-min gate, seconds + subject sent, no activity request), `lessons_repository.dart` (`markLessonComplete(readSeconds, subjectId)`, no opened ping); planner files unchanged.

#### Targets → measured after (local, monitor, test student · Requests · Statements · Rows examined → returned)

| Action | Before | Target | After (measured) |
|---|---|---|---|
| Lesson open | 1 · 2 · 1 → 1 | 1 · 1 · 1 → 1 | **1 · 1 · 1 → 1** |
| Lesson "Done", new, ≥ 2 min | 2 · 10 · 4 → 4 | 1 · 2 | **1 · 3 · 2 → 0** (progress upsert; today's row; XP) — +6 XP paid, 22 → 28 |
| Lesson "Done" again | 2 · 10 | 1 · 1 | **1 · 1 · 1 → 0** (`nothing_new`) |
| Lesson "Done" before 2 min | 2 · 10 | 0 | **0 requests** (phone shows the time left) |
| Exam XP | 1 · ≈ 9 | — | **3 statements, 1 row each** (take 4 + pass 16 = 20; retake 2; second look 0 — checked) |
| Planner open | 1 · 1 · 7 → 7 (up to 256) | 1 · 1 · 1 → 1 | **1 · 1 · 1 → 1** |
| Planner add | 1 · 1 · 0 | 1 · 1 · ≤ 1 | **1 · 1 · 0** |
| Planner swipe done | 1 · 2 · 2 → 1 | 1 · 1 · ≤ 1 | **1 · 1 · 1** |
| Planner delete | 1 · 1 · 1 | 1 · 1 · ≤ 1 | **1 · 1 · 1** |

"Done" is 3 statements on a first completion (target was 2) because it now also counts the lesson on today's Study Hub row, the work of the removed activity request (1 request · 2 statements saved there). **Checked:** backend unit suites (SQL injection, auth, access control, medical content, secrets, OWASP, Apple IAP 31/31) and security e2e pass; Flutter tests pass, analyzer clean on the changed files. **Not yet checked on the phone** (build installed for the after-run).

### 10.13 Quiz / exam submit: fewer statements, XP inside the submit, no topic stats for full papers ✅ implemented locally 2026-11-15 (not committed)

#### Decisions (user, 2026-11-15)
1. **Quiz submit gets the highest optimisation** ("especially the quiz submit"), then lesson "Done", then everything else.
2. **Full-course papers are not used to find weak topics.** A full paper mixes every subject, so its questions are not counted into the topic stats; only topic quizzes feed the weak-areas cards.
3. XP stays in ONE place (10.12): the submit pays it into the summary row; the quiz's own progress row holds the paid marks.

#### Aims
- One request, the fewest statements, every write one row (or one multi-row insert), no read-after-write.
- Exam XP paid inside the submit's own statements (no extra round after it).

#### Before (measured 2026-11-15, test student, monitor · Requests · Statements · Rows examined → returned)

| Submit | Before |
|---|---|
| Topic quiz (20 questions) | 1 · **14** · 8 → 3 |
| Full paper (25 questions) | 1 · **14** · 8 → 3 |

The 14: session read; session locked re-read; save answers into the session; insert attempt (zeros); insert answers; update the attempt's scores; summary upsert; today's row; quiz progress upsert; topic stats; topic stats per day; mark the session submitted; then, after commit, XP: re-read the attempt; quiz progress XP marks; summary XP payment.

#### Plan (as built)
- **Mark first, insert once:** `createExamAttempt` marks the answers before the insert, so the attempt row is written with its scores (the follow-up `UPDATE quiz_attempts` is gone). Answers stay one multi-row insert (Results / Review read them).
- **Quiz row does the XP marks** (`StudyStatsService.recordExam`): one upsert on `(user_id, quiz_id)` adds the attempt and works out the exam XP from `xp_take_paid` / `xp_retakes_paid` / `xp_pass_paid`; both the new attempt count and the XP come back in one `LAST_INSERT_ID` (count × 1000 + XP). First attempt at a quiz: the row is created with its marks and the XP is known in code.
- **Summary row pays it:** the existing summary upsert (attempts, passes) also runs the shared XP payment (`xp/xp-pay-sql.ts`, the same expression lesson "Done" uses: daily cap, streak-day XP, 7/30-day bonuses), amount back through `LAST_INSERT_ID`.
- **The XP rules are checked in code** from what the submit already has: score ≥ 30 % and not faster than 2 s per question (from the session's `started_at`; an expired exam used the full time). The re-read of the attempt is gone; `XpService.onExamSubmitted` removed.
- **Full papers skip the topic stats** (both statements); topic quizzes keep them.
- **One session update:** the final answers (when still accepted) and the submitted state in the same `UPDATE exam_sessions`.
- The expired-exam auto-submit uses the same path.
- **Round 2 — one session read:** a normal quiz's questions are the quiz's own (kept in memory), so the session is read ONCE, locked, inside the transaction (the read before it is gone). A dynamic (blueprint) quiz, a submit with no open session, or a session that froze its own question set falls back to the full path (checked: no-session submit still works, 14 statements as before).

#### Changes (files)
`quiz-attempts.service.ts` (`createExamAttempt`, `submitExam`, `finalizeExpiredExamSession`; XpService no longer injected), `study-stats.service.ts` (`recordExam`), `xp/xp-pay-sql.ts` (new, shared payment), `xp.service.ts` (`pay` uses it; `onExamSubmitted` removed); tests: `access-control-regression.ts`, `medical-content-quality-regression.ts` (constructor), `security.e2e.ts` (older-build `lesson_opens` read). App: no change (same request and reply).

#### Targets → measured after (same steps)

| Submit | Before | Target | After (measured) |
|---|---|---|---|
| Full paper (25 q) | 1 · 14 · 8 → 3 | 1 · 7 | round 1: 1 · 8 · 3 → 2 → **round 2: 1 · 7 · 2 → 1** (locked session read; attempt with scores; answers; quiz row + XP marks; summary + XP; today's row; session update) |
| Topic quiz (20 q) | 1 · 14 · 8 → 3 | 1 · 9 | round 1: 1 · 10 · 3 → 2 (checked on the iPhone, 53 ms) → **round 2: 1 · 9 · 2 → 1** (the same + the 2 topic-stats writes) |

Targets met in round 2 (7 / 9). **XP checked:** first pass +20 (take 4 + pass 16), retake +2, low score 0 (`low_score`), all written inside the submit; quiz row marks and best score correct. **Checked:** backend unit suites (all, Apple IAP 31/31) and security e2e pass.

**Next (proposed, not built):** sign-in 8 → 4 statements (user + summary + weakest area in one SELECT by user id; lesson + quiz progress in one `UNION ALL`; streak kept current on writes), Study Hub lower cards 6 → 2 (no repeated summary read; areas + note title in one `UNION ALL`; question of the day with its options in one JOIN), and the two session reads at submit → 1 (questions loaded on the transaction's own connection).

### 10.14 Finished lessons as one bitmap, cached on the phone, with a version ✅ implemented locally 2026-11-15 (not committed)

#### Decisions (user, 2026-11-15)
1. **Lessons first** (quizzes later). Finished lessons are kept as a **bitmap**: one bit per lesson id, all lessons together in ONE row per student (not course by course — a course's part would save ≈ 150 bytes but add a request each time; ids are mixed across courses).
2. **Cached on the phone with a version**: the phone keeps the bitmap and its version; the server sends the bitmap only when the version changed.
3. Bits are keyed by **lesson id, never by list position**, so adding / hiding / reordering lessons never moves anyone's ticks.
4. **Finished only, and finished stays finished** (bits only turn on). The older "in progress / not started" path no longer turns a completed lesson back.
5. The per-lesson rows (`student_lesson_progress`) are **kept and still written** by "Done": the website, the "continue" card, admin reports read them. Only what the phone downloads changes.
6. Percentages stay on the phone (already: catalogue + progress).

#### Aims
- App open / sign-in: lesson ticks from **1 row**, and **0 bytes** when nothing changed.
- After "Done": **no re-download**; the phone flips the bit itself.
- No extra statement on "Done".

#### Before (measured 2026-11-15, test student · Requests · Statements · Rows examined → returned)

| When | Before |
|---|---|
| Every app open / sign-in / `GET /student/progress` | 2 statements: **every lesson-progress row** (7 here, ≈ 1,479 for a student who finished everything) + every quiz-progress row (7) · 338 B |
| After every "Done" | the phone re-downloads the whole progress list (same 2 statements) to add one tick |

#### Plan
- **Server storage** (critical schema step, version bump): `student_study_summary.lessons_done` (BLOB, bit *n* = lesson id *n*, lowest bit first; 192 B for ids ≤ 1,534) and `progress_version` (INT). Filled once from the existing completed rows (and for students whose summary row is built later).
- **"Done"**: a new completion's summary statement (the one that already pays the XP) also sets the lesson's bit and raises `progress_version`, and hands the new version back with the XP amount in one `LAST_INSERT_ID` — the statement count does not change. The reply carries `progressVersion`.
- **Progress replies** (start-up, sign-in, `GET /student/progress`): a phone that sends `progressFormat=bits` and its version gets `lessonsVersion` + either `lessonsBits` (base64) or `lessonsUnchanged: true`, read from the summary row (1 row) instead of the lesson rows. Older builds keep the old row list.
- **Phone**: decodes the bits; keeps the merged copy (bits + version) as its saved progress; sends its version on start-up, sign-in and progress requests; after "Done" flips the bit and stores the version from the reply (if the reply's version is not its own + 1, something else changed: it asks once for the fresh bitmap) — no more full re-download after "Done".

#### Changes (files)
Backend: `schema-sync.service.ts` (columns, one-time fill, version bump), `study-stats.service.ts` (fill for new summary rows), `xp-pay-sql.ts` (payment without capture), `xp.service.ts` / `courses.service.ts` ("Done" sets the bit + version; older path keeps completed), `student-catalogue.service.ts` + controllers (bits / unchanged replies), `app-start` + `auth.controller.ts` (version in). App: `catalogue.dart` (decode, merge, version), `auth_controller.dart` / start request (send version), `lessons_repository.dart` + `lesson_canvas_page.dart` (flip the bit after "Done", no re-download).

- **Version belongs to an account:** the phone sends `"userId:version"` (at sign-in it still holds the last account's copy, and two accounts can be at the same number); the server answers "unchanged" only when both match (checked: another account's version 2 gets the full bitmap).

#### Targets → measured after (local, monitor, test student · Requests · Statements · Rows examined → returned)

| When | Before | Target | After (measured) |
|---|---|---|---|
| App open / progress, nothing changed | 2 statements · lesson rows (7 here, ≈ 1,479 max) + quiz rows · 338 B | lessons: 1 row, 0 bytes | **1 summary row for lessons, whatever the number finished** + quiz rows (7) · reply 288 B, no ticks sent |
| App open after a change elsewhere (website) | same | lessons: 1 row, ≈ 192 B | **1 row**, bitmap 104 base64 chars (ids up to 614) |
| After "Done" | full re-download | 0 requests for progress | **0**: the phone flips the bit and keeps the returned version |
| "Done" statements | 1–3 | unchanged | **unchanged**: new completion 3 (bit + version + XP in the one summary statement; reply `progressVersion`), repeat 1 |

**Checked:** one-time fill (test student: 7 finished → 34-byte bitmap, version 1); the bitmap decodes to exactly the finished-lesson rows (61, 84, 85, 120, 143, 260, 264, 614); "Done" raises the version 1 → 2 and sets bit 614; older builds still get the row list; the older "in progress" path no longer un-finishes a lesson. Backend unit suites (Apple IAP 31/31) and security e2e pass; Flutter tests pass (new `test/lesson_bits_test.dart`: server byte layout, bit set / grow, "unchanged" merge, local "Done"). **Not yet checked on the phone** (build installed for the after-run). Quizzes still send their rows (next step).

### 10.15 All lesson progress in ONE table: "Done" = 1 statement ✅ implemented locally 2026-11-15 (not committed)

#### Decisions (user, 2026-11-15)
1. **A student's progress lives in `student_study_summary` only** ("from now student all progresses will be inside this table only"): the finished-lessons bitmap + version (10.14), XP (10.12), and the **streak**.
2. **"Done" = 1 statement**: it updates only that row (bit, version, XP, streak). `student_lesson_progress` and `student_daily_activity` are **no longer written by "Done"** ("this is a waste of data").
3. **The phone works out progress**: ticks, percentages, and **"continue"** = the first lesson in the course's own order whose bit is off (finished 1, 5, 7, 10 → continue 2).
4. **The website reads the bitmap** for its ticks (yes). **The streak moves into the summary row**, counted in the same statement (yes). **Completion dates / admin "finished on" are not kept** (yes).
5. Plan rated 8/10 with two risks; to make it 10/10: **streak date tests** (same day, next day, a gap, a grace day, a second grace inside 7 days) and the **website ticks checked against the bitmap** in the same change. Trusting the phone's timer stays accepted.

#### Aims
- "Done": 1 request · **1 statement · 1 row** (2 after a server restart: the summary row's one-time "exists" check).
- One place for lesson progress and the streak; nothing written that no screen uses.
- The streak gives exactly the same numbers as today's rule (one missed day forgiven, not twice within 7 days; two missed days break it).

#### Before (measured 2026-11-15, test student, monitor)
- "Done", new completion: **1 · 3 statements · 2 → 0** (`student_lesson_progress` upsert; `student_daily_activity` upsert; summary: bit + version + XP).
- Streak: recomputed from day rows on the first Study Hub read of a day (a page of up to 32 active-day rows).
- Readers of `student_lesson_progress`: website course pages (`courses.service`), website lesson list / lesson page (`lessons.service`), older app builds (`student-catalogue`), website planner agenda + admin reports (`workspace.service`), admin user page (`users.service`).

#### Plan
- **Streak in the summary row** — new columns `last_active_day`, `streak_forgiven_day`, `streak_after_forgiven`; `streak` becomes the running count. On an active day T (lesson finished, exam, practice), in the same statement:
  - last active = T → unchanged; = T−1 → streak + 1;
  - = T−2 (one missed day) → forgiven if no other forgiven day within 7 days: streak + 1; otherwise the streak restarts after the older forgiven day (= days since it + 1); either way the forgiven day becomes T−1;
  - older / never → streak = 1.
  - Shown on day D: active today or yesterday → streak; last active D−2 → streak (or the days since the older forgiven day) with "grace" on; older → 0. Identical to `computeStreak`, without reading day rows. Filled once from the existing day rows.
- **"Done"**: the lesson and the plan check come from the catalogue snapshot and the signed token (0 SQL); ONE `UPDATE student_study_summary … WHERE user_id = ? AND <lesson's bit is off>` sets the streak, the version, the XP and the bit. Bit already on → nothing changes (no XP, no version). No progress row, no day row.
- **Exams and practice** set the streak in the summary statement they already run (exam: the summary upsert; practice: its day-row write + the streak).
- **Readers move to the bitmap**: website course pages and lesson list / page, older builds' row list (built from the bits), planner agenda, admin reports (completed lessons and course funnel counted from bitmaps + the catalogue; last activity = `last_active_day`), admin user page. The old rows stay as history (never deleted).
- **Phone**: "continue" from the bitmap in course order; "lessons today" counted on the phone from its own finishes.

#### Changes (files)
Backend: `schema-sync.service.ts` (streak columns, one-time fill, version bump), new `common/utils/streak-sql.ts`, `xp.service.ts` / `courses.service.ts` (one-statement "Done"), `study-stats.service.ts` (streak read from the row; exam / practice streak), `lessons.service.ts`, `student-catalogue.service.ts`, `workspace.service.ts`, `users.service.ts` (bitmap readers); tests for the streak dates. App: "continue" and "lessons today" from the bitmap.

- **As built, also:** today's finished-lesson count (`lessons_today` + `lessons_day`) lives on the summary row and is raised in the same "Done" statement (the Study Hub goal line reads it there); the website's "in progress / not started" call no longer writes anything (nothing reads a started state); the old day-row streak recount (`computeAndStoreStreak`, `streakFor`) is removed; grace stays 1 per 7 days (user).

#### Targets → measured after (local, test student · Requests · Statements · Rows examined)

| When | Before | Target | After (measured, slow log) |
|---|---|---|---|
| "Done", new completion | 1 · 3 · 2 | 1 · 1 · 1 | **1 · 1 · 1** — `UPDATE student_study_summary …` (bit 615 set, version 3 → 4, +6 XP, today's lessons 8 → 9, streak kept); no `student_lesson_progress` row, no day row |
| "Done", already finished | 1 · 1 · 1 | 1 · 1 · 1 | **1 · 1 · 1**, nothing changes (bit already on) — and the phone doesn't send it |
| Streak on the Study Hub | up to 32 day rows once a day | 0 extra rows | **0** (read with the summary row) |
| Website course page ticks | every progress row of the course | 1 row | **1 row** (course 11: 84, 85, 614, 615 ticked, 4 of 501) |

**10/10 checks:** the streak update run in MariaDB against today's `computeStreak` for 6 named cases (every day, one gap, two gaps 6 and 7 days apart, two missed days, the chat example) and 400 random 45-day patterns, a second activity the same day included — **18,069 day checks, 0 mismatches**; the one-time fill from day rows followed by live updates over 400 random histories — **10,093 checks, 0 mismatches**. Backend unit suites (Apple IAP 31/31) and security e2e pass (the e2e asserts "Done" updates only the signed-in student's summary row and writes no per-lesson row; its snapshot cache is cleared each run). Flutter tests pass; "continue" = first unfinished lesson in course order. Schema `2026-11-15.8`. **Not yet checked on the phone.**

### 10.16 Quizzes in the progress row: byte-map marks, 5 recent results, signed exam, server marking 🔨 approved 2026-11-16 — server + phone done (local), website next

#### Decisions (user, 2026-11-15 / 16)
1. **All quiz progress in the progress row** (`student_study_summary`), like lessons.
2. **Q-Bank marks = 1 byte per quiz id**: top bit = passed (once passed, stays), 7 bits = best whole % + 1, 0 = not done. Serves both list designs (with or without the %).
3. **5 recent results**, one entry per *different* quiz: redoing a quiz updates its entry; a new quiz takes the next entry. Each entry keeps its answers so Review works as today. Older results are not kept.
4. **Lock rule (phone only):** a 6th different quiz needs the oldest entry to be **reviewed and passed**; until then new exams are blocked.
5. **Server marks (option A)** — no fake passes, the answer key never reaches the phone before submit — but optimised: **start = 1 statement, answering / resuming = 0, submit = as few as possible**; running exam kept in the progress row + a **signed exam token** + phone storage + **duplicate-submit protection**.
6. **Questions load as 1 row per question**: options joined in by question id and packed into the row (20 questions → 20 rows, 1 statement), kept in server memory after the first load.
7. **Minimum time before submit (exams; practice has no time limit), phone only, no server check:** first try = quiz time ÷ 10; redo of a failed quiz = quiz time ÷ 20; already passed = 1 minute. Submit stays disabled with the time left; nothing is sent early.
8. **Weak topics on the phone**: 1 byte per subject (like the quiz marks), worked out from each quiz's marked answers; phone only.
9. **Admin attempt-level parts dropped** (attempt counts per quiz, "hardest questions", a student's attempt list).
10. **Website uses the same data** as the phone.

#### Aims
- Exam: start **1** statement, answering **0**, submit **1** (+ questions from server memory, 0 when warm).
- Results / Review: **0 requests** on the phone (kept from the submit reply); website reads the progress row.
- No per-attempt or per-answer rows; marks, results, XP, streak in one row.

#### Before (measured 2026-11-15, test student · Requests · Statements · Rows examined → returned)

| Action | Before |
|---|---|
| Exam open | 1 · 7 · 161 → 141 (questions + options as separate rows, session) |
| Exam submit, topic quiz / full paper | 1 · 9 · 2 → 1 / 1 · 7 · 2 → 1 (session, attempt, ≈ 20–100 answer rows, quiz row, summary, today, 2 topic writes, session) |
| Q-Bank ticks | quiz progress rows (up to ≈ 650) on every app open |
| Results / Review | results list + review request (attempt + answers + questions) |

#### Plan
- **Storage (progress row):** `quiz_marks` (BLOB, byte per quiz id), `recent_results` (JSON, ≤ 5 entries: quiz id, %, passed, reviewed, submitted at, question ids, answers, correct options), `exam_nonce` + `exam_quiz_id` (the running exam), `exams_today` / `exam_pct_today` / `exams_day` (Study Hub "today"), reusing `progress_version`.
- **Start** (`POST /student/exam/:quizId/start`): plan check from the token (0 SQL); questions from server memory (cold: ONE joined statement, 1 row per question, **no correct answers**); ONE `UPDATE` of the progress row stores a new exam nonce + quiz id; reply = questions + a **signed exam token** (user, quiz, nonce, started at, question ids, deadline). Dynamic (blueprint) quizzes: the chosen ids travel in the token.
- **Answering / resume:** on the phone only (0 requests); the deadline and minimum time come from the token, checked on the phone.
- **Submit** (`POST /student/exam/:quizId/submit` with token + answers): token signature checked (0 SQL); marked with the questions in memory; ONE `UPDATE … WHERE user_id = ? AND exam_nonce = ?` writes the quiz byte (best % = max, passed = OR), replaces / adds the quiz's entry in `recent_results` (oldest dropped past 5), attempts / passes / today's counts, XP, streak, `progress_version + 1`, and clears the nonce — a second submit of the same exam matches no row (**duplicate protection**). Reply = %, pass, correct options, XP, new version.
- **Review completed:** ONE statement setting the entry's `reviewed` flag (rare; needed for the lock rule across devices).
- **Phone:** byte map + recent results cached with the version (like lessons); Q-Bank ticks / %, Results, Review, lock rule, minimum-time gate and weak-topic bytes all worked out on the phone.
- **Website:** Results / Review / Q-Bank ticks read the same progress row; Review loads its questions in ONE joined statement by id.
- **Kept / dropped:** older builds keep the old endpoints until updated (no live users); `quiz_attempts`, `student_answers`, `student_quiz_progress`, topic-stat tables are no longer written by the new flow (old rows kept as history); admin attempt-level parts removed.

#### Settled (user, 2026-11-16, "ok go ahead with the plan A")
- **Retake XP = Option 1:** first try ≥ 30 % +4; first pass +16 (once); a repeat pays +2 **only when it raises the best %** (no counter; no XP farming); daily cap unchanged.
- **Weak topics stay phone-only** (decision 8), so the website's Study Hub shows no weak areas from them.

#### Changes (files) — outline
Backend: schema step (progress-row columns, version bump), new exam start / submit / review endpoints (`quiz-attempts` module), joined question loader + memory cache, signed exam token (same secret as the access token), shared JSON slot update, XP / streak assignments reused; website: Results / Review / Q-Bank from the progress row. App: start / submit flow with token, phone gates (minimum time, lock rule), byte-map + recent results cache, weak-topic bytes, Review from local data.

#### Targets

| Action | Before | Target |
|---|---|---|
| Exam start | 1 · 7 · 161 → 141 | **1 · 1** (+ 1 statement · 20 rows only on a cold question load) |
| Answering / resume | autosave requests | **0** |
| Exam submit | 1 · 7–9 | **1 · 1 · 1** (+ 0 when questions are warm) |
| Q-Bank ticks on app open | up to ≈ 650 rows | **1 row** / 0 bytes when unchanged |
| Results / Review (phone) | 1–2 requests | **0** |
| Rows written per submit | ≈ 25–105 | **1** |

#### Server phase — measured (local, test student, slow log · Statements · Rows examined → returned)

| Action | Before | After |
|---|---|---|
| Exam start, warm | 7 · 161 → 141 | **1 · 1** (exam nonce on the progress row) |
| Exam start, cold (first after a restart) | 7 · 161 → 141 | 3: quiz row (then cached) + **questions in ONE joined statement: 160 → 20** (1 row per question, options packed as JSON, recap joined) + nonce |
| Exam finish (submit) | 7–9 · 2 → 1, ≈ 25–105 rows written | **1 · 1** — streak, version, XP (4 + 16 + streak day = 22 on the test), totals, today's exam counts, the quiz byte (`E5` = passed + 100 %), the recent entry (oldest of 5 dropped), nonce cleared |
| Same exam submitted again / an older token | — | 1 statement matching nothing, **nothing written** ("duplicate"); a tampered token → 400 |
| Review finished | 1 · several | **1 · 1** (entry's `reviewed` flag) |
| Progress (lessons + quizzes) | 2 · lesson rows + quiz rows | **1 · 1** — lesson bitmap, quiz byte map (664 chars), 5 recent results (≈ 4.6 KB, 1.4 KB gzipped; nothing when unchanged) |

- Exam start sends the questions **without** correct answers; the finish reply carries the result, what the student chose, and the review questions (answers + explanations) for the phone to keep.
- One-time fill (schema `2026-11-16.1`): each student's best % + passed per quiz and their latest 5 different quizzes (answers, reviewed) from the existing attempts; old rows kept.
- Backend unit suites (Apple IAP 31/31) and security e2e pass (fake databases taught the joined question load).
#### Phone phase (user picks from the mockups, 2026-11-16)
- **Submit gate:** nothing shown during the exam; tapping Submit before the minimum time opens the same "Not so fast" popup as the lesson Done button, with the time left (first try ÷ 10, redo ÷ 20, passed 1 minute). Phone only.
- **Lock:** centre card (A), only when an exam is opened and the 5 recent results are full with the oldest not reviewed **and** passed; "Review <quiz>" goes straight to its review. Everything else looks as before.
- **Results:** the list looks as now, filled from the 5 recent results (newest first, named from the catalogue) — no request.
- **As built:** the start reply is kept on the phone (`exam_<id>.json`) until submitted or out of time, so reopening an exam costs 0 requests; submit sends the token + answers, keeps the reply's result + review (`result_<id>.json`, same layouts as the old result / review endpoints, id = quiz id), sets the quiz byte and recent entry locally and keeps the returned version (no progress re-download); Result and Review open from that copy (else ONE `GET /quiz-attempts/recent/:id/review`, kept); "reviewed" = `POST /quiz-attempts/recent/:id/reviewed` + the local flag. Q-Bank % / ✓ / ↻ and the planner's "passed" come from the byte map.
- **Checked:** Flutter tests 26/26 (new `test/quiz_marks_test.dart`: byte map best % / passed, minimum time ÷10 / ÷20 / 1 min, local update — pass stays, best only rises, redo replaces its entry, oldest dropped past 5, reviewed flag); analyzer clean; recent review endpoint returns 100 % · 20/20 · 20 questions for quiz 56; backend suites + e2e pass.
- **Next:** the student website on the same data (Results / Review / Q-Bank marks from the progress row), then the after-run on the phone.


### 10.16-W Website phase: student website on the progress row ✅ implemented locally 2026-11-16 (not committed)

#### Decisions
- The user asked for the website to use the same data as the phone (10.16 decision 10), before the admin round (9.9 T3).
- The same rules apply in the browser as on the phone:
  - the 5-result free-slot lock (10.18);
  - the minimum time before submit (first try ÷ 10, redo ÷ 20, passed 1 minute).
- Premium reviews stay app-only, as today.
- The screens look as now; only what is behind them changes.

#### Aims
- Exam: open = 1 request · 1 statement (the exam nonce); answering / autosave = **0 requests**; submit = **1 statement**.
- Results / Result / Review / Reviewed read the one progress row.
- Each website request identifies the student once (cached), not 3 times.

#### Before (measured 2026-11-16, local, test student, free quiz 151 with 10 questions · Statements · Rows examined → returned)

| Action | Before |
|---|---|
| Q-Bank list | 8 · 2,139 → 676 · 510 KB (attempt rows, practice events, catalogue when cold) |
| Results list | 7 · 38 → 36 (every attempt row, then quizzes, courses, topics) |
| Exam open | 9 · 79 → 16 (an exam_sessions row inserted and read back) |
| Autosave (each answer change) | 7 · 10 → 6 per save |
| Submit | 13 · 9 → 5 (attempt row, 10 answer rows, quiz progress, summary, day row, 2 topic-stat writes, session) |
| Result | 4 · 6 → 4 |
| Review | 6 · 84 → 32 |
| Review complete | 4 · 6 → 3 |
| **Identification on every request** | **3 of the above**: the admin check in the rate limiter reads the user row, the student check reads the subscription, and the exam service reads the user row again |

#### Plan
1. **Identify once.**
   - The rate limiter tries the admin check only on admin paths.
   - The exam service reuses the student the boundary already resolved (request context).
   - The resolved student, subscription included, is kept in the 10-second session cache.
2. **Exam open** uses `POST exam/:id/start` (the phone's): 1 statement plus the signed exam token. The browser keeps the start reply until it is submitted or out of time, so reopening costs 0 requests.
3. **Autosave** stays in the browser (the page already keeps a local draft): 0 requests.
4. **Submit** uses `POST exam/:id/finish` with the token: 1 statement. The reply carries the result and the review, so the Result page needs no request.
5. **Results list** comes from the 5 recent results on the progress row (1 statement). Result / Review use `GET recent/:id/review`; "review complete" uses `POST recent/:id/reviewed`. The id is the quiz id.
6. **Q-Bank list** takes best % / passed / sat from the quiz byte map (summary row) in place of every attempt row.
7. **Browser gates** come from data it already has:
   - the free-slot lock (a message when no slot is free);
   - the minimum time before submit.

#### Changes (files)
- Backend:
  - `main.ts` (rate limiter);
  - `auth.service.ts` / session cache;
  - `quiz-attempts.service.ts` (requireStudent reuse; `listResults` and `listQuizzes` from the summary row).
- Website:
  - `shared/api/quizAttempts.api.js` (start / finish / local save / recent result + review);
  - `TakeQuizPage.jsx` (lock and minimum-time messages).

#### Targets

| Action | Before | Target |
|---|---|---|
| Exam open | 9 statements | **1–2** |
| Autosave | 7 per save | **0 requests** |
| Submit | 13 | **1–2** |
| Results list | 7 | **1–2** |
| Result (after submit) | 4 | **0 requests** |
| Review / Review complete | 6 / 4 | **≤ 3 / 1–2** |
| Q-Bank list | 8 | **≤ 5** |
| Identification per request | 3 | **0–1** |

#### Measured after (2026-11-16, local, test student, free quiz 152 with 15 questions · Statements · Rows examined → returned)

| Action | Before | After |
|---|---|---|
| Q-Bank list | 8 · 2,139 → 676 | **2 · 5 → 2** (summary row + practice count) |
| Results list | 7 · 38 → 36 | **1 · 1 → 1** |
| Exam open | 9 · 79 → 16 | **1 write** (exam nonce) + questions only when cold (1 joined statement, 105 → 15) + identification |
| Autosave (each answer change) | 7 per save | **0 requests** (kept in the browser) |
| Submit | 13 · 9 → 5, ≈ 15 rows written | **1 · 1** (one UPDATE of the summary row) + identification |
| Submit sent twice | (a new attempt) | 1 statement matching nothing, nothing written |
| Result after submit | 4 · 6 → 4 | **0 requests** (the reply carries it) |
| Result on page refresh | 4 · 6 → 4 | 1–2 (entry + questions if cold) |
| Review | 6 · 84 → 32 | 2 (entry + quiz row) + identification · or **0** when kept from the submit |
| Review complete | 4 · 6 → 3 | **1 · 1** + identification |
| Identification per request | 3 (user, subscription, user again) | **0** while the 10-second session cache is warm (a page's burst of requests); **2** (user + subscription) after it expires; the exam service's own user read is gone |

**Notes**
- The measuring script waits on the slow log between calls, so some calls landed after the 10-second cache window and show the 2 identification statements. In a real page load, the calls come within seconds.
- The Q-Bank reply is still 534 KB (the whole quiz catalogue). The browser keeps it for 1 hour, and its size is a separate item.
- Each recent result now also keeps its correct and wrong counts (`c`, `w`) for the results list. Older entries are worked out **once** and saved back in one guarded UPDATE. Measured: first open 6 statements (596 rows, the one-time fill), every open after that **1 · 1 → 1**.
- **Browser check (2026-11-16, test student, free quiz 153, 30 minutes):**
  - the exam opened (1 start request);
  - an early submit showed "Not so fast … You can submit in 3 minutes" and sent nothing;
  - a reload kept the deadline and the answers (local draft; a bug that deleted the draft after the local "save" was fixed in `TakeQuizPage.jsx`);
  - submit went to the result page with no extra request (2 correct, 1 wrong, 7 unanswered, 20 %);
  - the review matched the result;
  - the results list showed the new attempt first.
- **Found while testing (next item, not in this phase):** the website's start-up request `GET /student/boot` costs **26 statements · 19,974 → 2,448 rows · 75 KB** on every full page load. It reads the whole quiz catalogue, the whole lessons list and the free-question pool, and the Study Hub still reads `quiz_attempts`, which is stale since 10.16.
- Premium reviews stay app-only on the website. The result part (`?part=result`) stays open, as the old result endpoint was.

**Changed files**
- Backend:
  - `auth.service.ts` and `session-cache.ts` (the resolved student and plan scopes kept with the session; `rememberStudent`);
  - `subscription-scope.ts` (request context `student`);
  - `quiz-attempts.service.ts` (`requireStudent` reuse, `listQuizzes` / `listResults` from the summary row, entry counts, `recentReview` result part);
  - `quiz-attempts.controller.ts` (`part`).
- Website:
  - `shared/api/quizAttempts.api.js` (start / finish, start reply kept in the browser, no autosave requests, recent result / review, 5-result lock, minimum time).

### 10.21 Light student website: free samples from files, premium in the app — ✅ implemented locally 2026-11-16 (not committed)

Replaces 10.20 W1–W5 (building every list in the browser). The 10.20 C1–C4 clean-up and W6 (signed token) still stand.

#### Decisions (user, 2026-11-16)
1. **Purpose of the website:** show free sample lessons, quizzes and flashcards, take payments, and manage the account. Premium study happens in the app.
2. **Premium lessons, quizzes and flashcards are hidden on the website.** In their place is a "more in the app" card. Nothing premium is loaded, so there is nothing to load and then block.
3. **Free samples are ready files on the server**, written whenever content is published. Opening one = **0 database statements**, and quizzes are marked in the browser.
4. **Results on free samples stay in the browser** (0 database writes).
5. **Lessons, Q-Bank and Flashcards** (student side) are rebuilt free-only from those files.
6. **Planner:** uses the data the way the app does (1 plan row) for now.
7. **Study Hub:** kept as it is for now, with light data; the question of the day comes from the free quiz list. It gets optimised later.
8. **Results:** next, after the Study Hub.
9. **Payment, account and profile:** stay as they are; optimised later.
10. **Public page (no sign-in):** a very light page with **one** sample of each — 1 practice quiz, 1 lesson, 1 flashcard set — and none of the student interface. Mockups first; the user picks.

#### Aims
- A student opening Lessons, Q-Bank or Flashcards on the website: **0 database statements**. Files are cached by the browser and Cloudflare, and change only when content is published.
- Website replies hold only free content: no 534 KB catalogue, no premium titles.
- No requests that the server refuses (premium pre-loads).

#### Before (from 10.20, measured 2026-11-16)

| Screen | Before |
|---|---|
| Open the site → Study Hub | 4 · 24 statements · 76 KB (cold 26 · 19,974 rows) |
| Q-Bank | list 534 KB (all 649 quizzes) + 4 refused premium pre-loads |
| Lessons | 1 · 3 · 57.7 KB (all 1,478 lessons) |
| Open a lesson | 2 · 7 |
| Flashcards | 1 · 1 · 44 rows |

#### Plan (outline; screens follow the chosen mockups)
- **Files** (`backend/storage/public-samples/`, served at `/api/samples/...` with long caching and a version in the name):
  - `index.v<N>.json`: free lessons, quizzes and flashcard decks per course (titles and ids only);
  - one file per free lesson (the canvas);
  - one file per free quiz (questions, options, answer key and explanations — free content only);
  - one file per free flashcard deck.
  - Written by the publish step (lesson, quiz or flashcard save and Fix counts) and on start-up if missing, through one builder.
- **Website:**
  - Lessons, Q-Bank and Flashcards read the index file and open item files;
  - quizzes are marked in the browser and results kept in browser storage;
  - each course shows an "N more in the app" card;
  - the Study Hub's question of the day is picked from the free quiz index.
- **Public page:** one lesson, one practice quiz and one flashcard set from the same files, with no sign-in.
- **Removed** (C1, once live): the premium pre-loads, the full lists (`/student/ai-notes`, the website Q-Bank list), and the lesson-open ping.

#### Targets

| Screen | Before | Target |
|---|---|---|
| Lessons / Q-Bank / Flashcards list | 1–5 requests · up to 534 KB | **1 file request, 0 statements** (cached) |
| Open a free lesson / quiz / deck | 2 · 7 | **1 file, 0 statements** |
| Submit a free quiz | 1 statement | **0 requests** (marked in the browser) |
| Public sample page | — | **≤ 3 files, 0 statements** |

#### Mockup choices (user, 2026-11-16)
- **Public page:** **B, a scrolling story**: read a lesson, then answer 3 questions, then flip a card, with a "get the app" card at the end. No sign-in and none of the student interface.
- **Signed-in free Lessons, Q-Bank and Flashcards:** the user said "A or C, whichever is best"; **A is chosen, by course**. The free items show under each course with a "+ N more in the app" line, so a free item is one tap away (C needs an extra tap per course and the free lists are short).
- **Who sees what:** visitors get the public page (one of each); signed-in students get every free lesson, quiz and deck.

#### Built and measured (2026-11-16, local, test student, monitor reset before each step · Requests · Statements · Rows · Size)

| Step | Before | After |
|---|---|---|
| Lessons list (20 free of 1,478) | 1 · 3 · 57.7 KB | **0 requests** (samples index already held; the index itself is 2.5 KB compressed, 0 statements, 304 when unchanged) |
| Open a free lesson | 2 · 7 | **1 · 0** (3.6 KB file) |
| Mark a free lesson done | website path | **0 requests** (kept in the browser) |
| Q-Bank list (18 free of 649) | 534 KB list + 4 refused premium pre-loads | **0 requests** (background pre-load removed) |
| Open a free exam / practice | 9 statements (exam) | **0–1 file, 0 statements** |
| Submit free exam + result page | 1 statement + result request | **0 requests** (marked in the browser with the server's rules: 1 of 15 = 6.67 / 100) |
| Review | 2 statements | **0 requests** |
| Flashcards page | 1 · 1 · 44 rows | **0 requests** (0 free decks: "study every deck in the app" message) |
| Open a premium item (any link) | a refused request | **0 requests**: the browser checks the free list it holds and shows "Continue in the app" (Apple / Google Play badges) |
| Public page `/try` | — | **≤ 3 files, 0 statements** |
| Start-up batch `/student/boot` | 20 statements · 75 KB (cold 26 · 19,974 rows) | 17 statements · **4.3 KB** (quiz and lesson lists removed; the Study Hub part is next, 10.22) |

**User rules added during the build (2026-11-16):**
- **Student side always works by user id** (the account), and **never `SELECT *`**. Checked: no student query uses `SELECT *`. The only `*` selects left are admin (`papers` `p.*`, question reports `qr.*`), already listed in 9.8.
- **Blocked (premium) content says "Continue in the app" without calling the API.**
- **No premium counts:** "+ more in the app" text only, so the server counts nothing.
- **Wording (user):** never say "free samples". Pages say what opens here, and that other items "work in the Xyndrome app"; there is no "Free" filter chip, and course cards read "N lessons · more in the app".

**Changed files:**
- Backend:
  - new `modules/samples/` (service, controller, module; file `storage/cache/public-samples.json`);
  - `LessonsService.freeSamples`, `QuizAttemptsService.freeSamples`;
  - `boot.service.ts` (lists removed);
  - `app.module.ts`.
- Website:
  - new `shared/api/samples.api.js`;
  - `aiNotes.api.js`, `quizAttempts.api.js` (free lists, practice, browser-marked exams, local results / review), `flashcards.api.js`, `courses.api.js` (lesson done in the browser), `boot.api.js`;
  - `AiNotesListPage.jsx`, `StudentQuizzesPage.jsx`, `StudentFlashcardsPage.jsx`, `AiNotesPage.jsx` (no open ping, app gate);
  - `shared/ui/AppOnlyGate.jsx` + CSS (store badges);
  - new public `TryPage.jsx` + CSS, route `/try`.
- Checked: backend unit suites (31/31 and the rest) and security e2e pass; free and premium flows tried in the browser.

### 10.22 Study Hub and start-up the app's way (website) — ✅ implemented locally 2026-11-16 (not committed)

#### Decisions (user, 2026-11-16)
- `/student/boot` does too much. The website's Study Hub follows how the app handles it, using the app's APIs where they fit, without changing how the app works.
- 10/10, fully optimised.

#### Before (measured 2026-11-16, full load of the Study Hub, after 10.21)

| Request | Statements · rows |
|---|---|
| `GET /settings/public/availability` | 1 · 1 |
| `GET /auth/me` | 2 · 4 → 2 |
| `GET /student/boot`: dashboard (full top + lower cards, course progress, the free-question pool for the question of the day), notifications, planner agenda, bookmarks | **17 · 5,908 → 100** |
| `GET /settings/public` | 1 · 61 → 15 |
| `GET /student/quiz-attempts/results` | 2 (catalogue when cold) |
| **Total** | **7 requests · 23 statements · 8,081 rows** |
| The phone, same screen | start-up **3** + lower cards **2** |

#### Plan
1. **Start-up = the app's `POST /app/start`** in place of `auth/me` + `boot`:
   - user, signed token (W6), Study Hub top (lite), progress (lesson bitmap, quiz marks, recent results) and notices (JSON feed, 0 statements);
   - **3 statements**.
   - One additive option for the website (`courses: true`): the course progress cards come from the course structure in server memory and the lesson bitmap already read. 0 extra statements, and the app is unchanged.
2. **Lower cards = the app's `GET /student/dashboard/more` (lite)**: the smart-note title only, about 1 statement. The **question of the day is picked in the browser from the free quiz file** (by date), so 0 statements.
3. **Latest / recent results:** from the start-up progress (recent results) plus the browser's free-sample results (0 requests).
4. **Planner agenda and bookmarks** load only on the screens that show them (Planner: 1 row; Saved: when opened), not at start-up.
5. **Settings / availability:** carried in the start-up reply (0 extra requests).
6. `/student/boot` and its builders are removed once the website no longer calls it (clean-up C1).

#### Targets

| Load | Before | Target |
|---|---|---|
| Open the website → Study Hub | 7 requests · 23 statements · 8,081 rows | **2 requests · ≤ 4 statements · ≈ 4 rows** (start-up 3 + lower cards ≤ 1) + the cached samples index (0) |
| Every later Study Hub visit | from cache | 0 |

#### Built and measured (2026-11-16, full load of the Study Hub, monitor reset, warm server)

| Request | Before | After |
|---|---|---|
| Page load identity | `GET /auth/me` 2 | — (inside the start-up request) |
| `GET /student/boot` | **17 · 5,908 rows** | **not called** |
| `POST /app/start` (the app's start-up): account, signed token, Study Hub top with course cards, progress, **results list** | — | **3 · 5 → 3** (cold after a restart: + the quiz catalogue read once, 2,106 rows) |
| `GET /student/dashboard/more?lite=1` | (inside boot) | 2 · 1 → 1 (lower cards; no stale attempt reads, no question-pool scan) |
| Question of the day | free-question pool scan (2,987 rows) | **0**: picked in the browser from the 18 questions inside the samples index already held |
| `GET /student/quiz-attempts/results` | 2 | **not called** (comes with the start-up reply) |
| `GET /student/planner/agenda` | 6 · **5,883 rows** | **3 · 54 → 15**: own tasks (plan row) and recently finished lessons by id; the stale "missed questions" scan over old per-answer rows and the premium quiz suggestions are removed |
| `GET /student/bookmarks` | 2 | 2 (the Study Hub shows saved items) |
| `GET /settings/public/availability` | 1 | 1 (public shell, before sign-in) |
| `GET /student/notifications` | 0 | 0 (JSON feed) |
| **Total** | **7 requests · 23 statements · 8,081 rows** | **6 requests · 11 statements · 68 → 22 rows · 4.7 KB** |

**Notes**
- The start-up request is **3 statements**, the same as the phone, and the lower cards are 2, also the same.
- **Left above the target:** the planner agenda (3) and saved items (2) still load on the Study Hub because it shows them, and the availability check (1) runs for the public shell.
- **Website sign-in:** the student's signed 1-hour token (W6) is now sent on student requests, so they cost 0 identification statements. An expired token falls back once to the cookie.
- **Changed files:**
  - backend: `app-start` (`courses` option: course cards and results from data already read), `start-payload.service.ts`, `dashboard.controller.ts` / `dashboard.service.ts` (`more?lite=1`), `quiz-attempts.service.ts` (`resultsFromRecent`), `workspace.service.ts` (agenda), `samples.service.ts` (daily questions, built on first use);
  - website: new `stores/studentAccess.js`, `client.js` (token + one fallback), `auth.api.js` (`fetchAppStart`), `authStore.js`, `boot.api.js`, `quizAttempts.api.js` (results from the start-up batch), `samples.api.js` (question of the day).
- **Checked:** backend unit suites and security e2e pass (the samples file builds on first use, so nothing runs at boot); the Study Hub was checked in the browser.

### 10.23 Flashcards in batches of 20, the shared list, and growth safety — ✅ implemented locally 2026-11-16 (not committed)

#### Decisions (user, 2026-11-16)
1. **Study in batches of 20.**
   - Tapping Study on a deck downloads just enough lessons for **20 new cards** (plus any due cards, which are already on the phone).
   - When the 20 are done, **"Study 20 more"** downloads the next lessons for the next 20.
   - Everything downloaded stays on the phone. Once a deck is fully downloaded it never downloads again, unless an admin changes a lesson's cards.
2. The website shows the **same list as the app** (the catalogue). Locked items show a lock and "Continue in the app" with **no request**; free items open from the free files.
3. Planned for growth: the list never costs database work per student, whatever the content size.
4. **New-card limit per session (user, 2026-11-16):**
   - every tap on a deck or lesson offers up to 20 new cards, after any due repeats;
   - tapping again the same day offers the next 20 (no daily cap);
   - a lesson is downloaded whole on its first tap, so further taps cost 0 requests;
   - lesson-level decks stay available alongside course, subject and topic decks, sharing the same saved cards and review records.

#### Aims
- A study session never waits for or downloads more than it shows.
- 0 requests to open Flashcards or grade a card (as now).
- 0 database work per student for the list, at any size.

#### Before (today's app code; 10 lessons with cards, 136 cards)
- **Deck list:** from the catalogue (card count and stamp per lesson): 0 requests.
- **Start any deck:** downloads the cards of **every lesson in that deck** that has cards, 50 lessons per request, then shows 20 new cards plus the due ones.
  - Today that is 1 request.
  - Projected at 1,400 lessons with cards: a course deck (≈ 350 lessons, ≈ 4,900 cards) is **7 requests and ≈ 250 KB** on its first open, to show 20 cards.
- **Grading:** FSRS on the phone, 0 requests. Review history is imported once per phone.

#### Plan
- **F1 Batches of 20 (app):**
  - The session is planned on the phone from what it already holds:
    - **due and learning cards** come from the review records (each knows its lesson), and those lessons are already saved;
    - **new cards:** walk the deck's lessons in study order, skip lessons with no new cards left (count from the catalogue minus cards already reviewed), and stop once the picked lessons add up to 20 new cards.
  - Only lessons not yet on the phone are downloaded, in **one request**.
- **F2 Ready before you need it:** while the student is on the last ~5 cards of a batch, the next batch's lessons download quietly in the background (one small request). "Study 20 more" then opens with no wait.
- **F3 Counts without card text:** the deck's new, learning and due numbers come from the catalogue and the review records, so they're correct before any card is downloaded.
- **F4 Website flashcards:**
  - same batches;
  - free decks' cards come from the free files (0 statements);
  - reviews stay in the browser;
  - locked decks show "Continue in the app" with no request.
- **L1 One list for app and website:** the website loads the catalogue the app uses (index + per-course parts, versioned, "unchanged" when nothing changed), so it can show every lesson and quiz title with locks.
  - It downloads a course's part **only when that course is opened**.
  - The free-samples index stays for free item files and the question of the day.
- **F5 Cards as files (maximum):**
  - when a lesson's cards are approved or changed, the server writes that lesson's cards to a file (`storage/cache/flashcards/<lessonId>.json`, built on first use, dropped on change);
  - a batch request is answered from the files with **0 statements**;
  - premium lessons are checked against the signed token's plan scope (no database work).
- **F6 Skip the history import when there is none:** the start-up reply carries `flashHistory: true/false` (1 bit from the summary row already read). Students with no server history never call the export.
- **F7 Settings in the start-up reply:** the scheduling settings ride along, with no separate request.
- **F8 Reviews saved in batches on the phone:** the review records are written to a file every few grades and at the end of a session, not as one large value rewritten after every tap, so grading stays instant at 10,000 cards.
- **L2 The list split into lessons and Q-Bank (user, 2026-11-16):**
  - each course part is served as two parts, `kind=lessons` (subjects, topics, lessons) and `kind=quizzes` (subjects, topics, quizzes), each with its own fingerprint in the index;
  - a screen downloads only the kind it shows: Lessons / Flashcards → lessons parts, Q-Bank → quiz parts, on the app and the website;
  - the old combined parts stay for app builds already installed.
- **W7 Website lists with locks:**
  - Lessons and Q-Bank show every title from the list parts;
  - free items open from the free files;
  - locked items show a lock, and tapping one opens "Continue in the app" with **no request**;
  - the "+ more in the app" lines are replaced by the locks.
- **G1 Split when big:** when one course's part passes ≈ 100 KB compressed, the server splits that course into subject parts on its own. The app and website handle both shapes; small courses are unchanged.
- **G2 One rebuild per burst of edits:** after a publish, the list is rebuilt ≈ 30 s after the last edit, so a burst of edits causes one rebuild, not many.
- **Rules kept:**
  - student data by user id and named columns only;
  - cards are read by lesson id (examined = returned);
  - no per-student review reads (reviews live on the device).

#### Changes (files, outline)
- App: `state/flash_store.dart` (batch planning, background next batch), `features/flashcards/flashcards_repository.dart` (queue from batches, counts from catalogue + reviews), flashcards screens ("Study 20 more"), tests.
- Website: `shared/api/flashcards.api.js` (batches, free files), catalogue loading in the browser for Lessons / Q-Bank / Flashcards lists with locks.
- Backend:
  - `student-catalogue.service.ts` (split when big, rebuild delay);
  - the cards endpoint keeps answering by lesson ids.

#### Targets (projected at 1,400 lessons with cards; today's 136 cards behave the same, just smaller)

| Action | Before | Target |
|---|---|---|
| Open Flashcards | 0 | **0** |
| Start a course deck, first time | 7 requests · ≈ 4,900 rows · ≈ 250 KB | **1 request · 1 statement · ≈ 14–28 rows · ≈ 2 KB** |
| "Study 20 more" | (already downloaded) | **0 wait**: fetched during the last cards (1 small request), then saved |
| Grade a card | 0 | **0** |
| Any lesson already downloaded | 0 | **0** (always on the phone) |
| List per student (app and website) | 0 database work | **0 database work at any size**; per-course download only when changed or opened |
| Offline | whole deck after first open | **every lesson studied so far** |
| Start a batch (F5) | 1 statement | **0 statements** (cards from files) |
| History import (F6) | 1 request · 2 statements for every new phone | **0** for students with no history |
| Q-Bank page list (L2) | whole course part (lessons + quizzes) | **quiz part only** |
| Lessons page list (L2) | whole course part | **lessons part only** |

#### 10.23 progress — L2 (server) and W7 (website) built and measured (2026-11-16, monitor reset before each step)

| Step | Before | After |
|---|---|---|
| Q-Bank list download (all courses, compressed) | 36.0 KB (combined parts) | **10.9 KB** (`kind=quizzes`), once; later visits: index **304**, part from browser storage, **0 requests** |
| Lessons list download | 36.0 KB | **28.7 KB** (`kind=lessons`), **1 request · 0 statements**, once |
| Website lists | free items only (20 lessons, 18 sets) | **every title** (1,478 lessons, 649 sets) with locks; ticks and best % from the start-up progress |
| Tap a locked lesson or set | "Premium · View packages" | **"Continue in the app"** with store badges, **0 requests** |
| Database work for any list | 0 | 0 |

- **Changed files:**
  - backend: `student-catalogue.service.ts` (lesson and quiz parts, `CATALOGUE_FORMAT` 4), `student-catalogue.controller.ts` (`kind`);
  - website: new `shared/api/catalogue.api.js`, `aiNotes.api.js` / `quizAttempts.api.js` (lists from the catalogue), `stores/studentAccess.js` + `authStore.js` + `boot.api.js` (progress from the start-up reply), `StudentQuizzesPage.jsx` (app box instead of "View packages"), `AiNotesListPage.jsx` ("more in the app" lines removed).
- **Next:** the app part — list parts on demand (L2 in the app), then flashcards F1–F8 — built, installed on the iPhone and measured.

#### 10.23 progress — app part built, installed on the iPhone and measured (2026-11-16, monitor reset, test student)

**Built:**
- **L2:** the app keeps two lists, lessons (Lessons, Courses, Flashcards, Study Hub) and quizzes (Q-Bank, exams, results), each downloading only its own changed parts (`kind=lessons` / `kind=quizzes`).
- **F5:** cards are served from server memory and files, keyed by the lesson's card stamp, with the settings in memory, so a cards request costs 0 statements.
- **F6:** `flash_history` on the summary row (schema `2026-11-16.3`); the app skips the history import when it is false.
- **F7:** the flashcard settings come in the start-up / sign-in reply.
- **F1–F3:** each session downloads only the lessons for 20 new cards plus the lessons holding due cards; the next 20's lessons download quietly at once; deck counts come from the catalogue and the review records.
- **F8:** review records live in a file, written every 5 grades or 2 s after the last one, and when a session closes.

**Phone run** (sign-in after the install, then Study Hub, Lessons, Q-Bank, Flashcards):

| Request | Statements · rows | Note |
|---|---|---|
| Sign-in (with start-up data) | 6 · 7 → 4 | **4 when warm**; the 2 extra are once per server start (the progress-built check and the flashcard settings, then in memory) |
| List index ×2 | 0 · 0.3 KB each | one per kind (sharing it is a small follow-up) |
| Quiz part (all courses) | **0 · 11.1 KB** | once; the Study Hub's recommended set and results need quiz names, so it loads at start |
| Lessons part (all courses) | **0 · 28.7 KB** | once |
| Saved items | 2 · 7 → 2 | |
| Open a lesson ×2 | **1 · 1 → 1** each | |
| Practice quiz | 2 · 161 → 21 | questions read once (cold), then server memory |
| Study Hub top / lower cards | 1 / 4 (2 when warm) | lower cards: question-of-the-day id range and question, once per day |
| **Flashcards** | **0 requests** | the studied deck's cards were already on the phone; the history import was already done |
| **Total** | **11 requests · 17 statements · 185 → 33 rows · 67 KB** (40 KB of it the two list parts, once per install) | |

**Not yet seen on the phone:** a batch download for a deck that isn't on the phone yet, because the test deck was already saved. The code path is the same `cards` request, now 0 statements.

**Checked:** Flutter tests (75 pass; the 2 old `saved_first_refresh_test` failures are unchanged); backend unit suites and security e2e pass.

### 10.24 App run: smaller downloads, rows examined = returned — ⏸️ lists-by-course stopped; the kept items are done

#### Decisions (user, 2026-11-16)
- 67 KB for a normal app session is too much.
- Rows examined must equal rows returned.
- Check that the course and Q-Bank lists load properly.

#### Lists check (phone markers, 2026-11-16)
- **Q-Bank:** list built with 649 sets, ready in 188 ms.
- **Lessons:** list built with 1,478 lessons, ready in 251 ms.
- **Flashcard decks:** built; the Study Hub was shown with data.
- Each later visit rebuilt from the phone's copy with no download.

#### Before (phone run, 2026-11-16 · Statements · rows examined → returned · size)

| Request | Before | Why |
|---|---|---|
| Quiz part + lessons part | 0 · **39.8 KB** | every course's full list on the first open (after an install or format change) |
| List index | 0 · 0.3 KB **×2** | asked once per list kind |
| Practice quiz | 2 · **161 → 21** · 18.1 KB | the option rows packed into 20 questions count as examined; cold load only |
| Saved items | 2 · **7 → 2** | titles joined from lessons / quizzes / questions per bookmark, plus a separate plan-scope read |
| Sign-in subscriptions | 1 · **3 → 1** | only a `user_id` index: all of the student's subscription rows are read to find the active one |
| Study Hub lower cards | 4 (2 warm) | summary row read again, smart-note title, question-of-the-day id range + question |
| Lesson open | 1 · 1 → 1 | ✅ |
| **Session total** | **11 requests · 17 statements · 185 → 33 rows · 67 KB** | |

#### Plan
1. **Lists by course, on demand:**
   - the index carries each course's lesson and set counts, so course cards draw from the index alone (≈ 1 KB);
   - a course's lessons or quiz part downloads only when that course is opened (≈ 3–10 KB each), then stays on the phone;
   - the index is asked **once** for both kinds.
2. **Study Hub without the quiz list:**
   - the results list and recommended set come with their names in the start-up reply, read from the quiz list in server memory (0 statements);
   - so the quiz part is never downloaded just for the Study Hub.
3. **Saved items, examined = returned:**
   - the server returns only the student's rows (`item_type, item_id, created_at` by `user_id`, 1 statement);
   - the phone names them from its lists;
   - the plan scope comes from the signed token (0).
4. **Subscriptions, examined = returned:** index `(user_id, status, end_date)` on `user_subscriptions`, so the active one is found directly (3 → 1 becomes 1 → 1).
5. **Lower cards:**
   - the summary numbers come from the start-up reply (no second read) and the smart-note title rides along;
   - the question of the day keeps its day-long memory cache;
   - warm cost 0–1.
6. **Practice quiz:** already kept on the phone per version and in server memory. The examined rows are the options packed into each question (needed, not wasted). No change, explained here.

#### Targets

| Request | Before | Target |
|---|---|---|
| First open after install: lists | 39.8 KB | **≈ 1 KB index + only opened courses (≈ 3–10 KB each)** |
| Index requests | 2 | **1** |
| Saved items | 2 · 7 → 2 | **1 · rows = returned** |
| Sign-in subscriptions | 3 → 1 | **1 → 1** |
| Lower cards (warm) | 2 | **0–1** |
| A normal session after the first open | — | **≈ 5–10 KB**, every statement examined ≈ returned |

#### 10.24 progress (2026-11-16)

**Done:**
- **Subscriptions:** index `idx_user_subscriptions_user_status_end` (schema `2026-11-16.4`); finding the active subscription examines **1 → 1** (was 3 → 1, checked with `ANALYZE`).
- **Saved items:**
  - the student's own rows only (`SELECT id, user_id, item_type, item_id, created_at … WHERE user_id = ?`, examined = returned);
  - lessons and quizzes named from the catalogue in server memory (0 statements);
  - question text read by id only for question bookmarks.
  - The reply has the same shape, so the app and website are unchanged.
- **List index:** asked **once** for both lists on the phone (shared for 30 s).
- **Checked:** backend unit suites and security e2e pass (the fake databases were taught the new saved-items queries).

**Found while building — needs a decision:** the Study Hub's "next study move" card chooses the next set from **all** quiz sets, and global search and the planner use all of them too. Downloading a course's list only when it's opened would need the server to work out that recommendation (catalogue in memory + quiz marks, 0 statements), and search / planner to load all parts when used.

**Stopped (user, 2026-11-16):** "keep the course and lessons lists as it is"; the two lists (lessons and Q-Bank, each with every course) stay as in 10.23. They're made smaller with size cuts instead (next plan). Removed, so the code is exactly the 10.23 two-list setup:
- **Server:**
  - the Study Hub extras in every progress reply (`courseStats`, `hub`, `recentQuizzes`), which were worked out for each student at every sign-in;
  - the per-course `counts` and `subjects` in the list index.
- **Phone:**
  - the per-course loaders (`catalogueIndexProvider`, `indexCatalogueProvider`, `coursePartProvider`, `progressExtrasProvider`, `hubCatalogueProvider`, `CatalogueRows`);
  - the Q-Bank course-card and course-sets providers.
  - The Q-Bank screens are back on the full quiz list.

**Kept:** the subscriptions index (1 → 1), saved items examined = returned, and one shared list-index request for both lists.

**Checked:** backend build, unit suites and security e2e pass; `flutter analyze` shows no new problems.

### 10.25 Smaller lists, one quiz name, bookmarks on the device, website calls — ✅ implemented locally 2026-11-16 (phone run pending; not committed)

#### Decisions (user, 2026-11-16)
- Keep the two lists (lessons and Q-Bank, every course each); make them smaller instead ("ok we will apply all three cuts").
- **One name per quiz from now on:** the admin name and the student name are always the same. Number display ("Trauma and burn • Quiz 2") is dropped: every quiz shows its one name.
- **Bookmarks on the device only, start fresh:** bookmarking makes no API call; the 27 server bookmarks aren't imported.
- **Website:** remove calls a page doesn't need; ask only when it changes what the student sees. Payment pages stay for later.

#### Aims
- Lists: first download ≈ 30 KB instead of 40.4 KB; later sessions stay at 0 KB (one shared "changed?" check).
- No request for bookmarks, anywhere.
- Each website page makes only the calls its phone screen makes.

#### Before (2026-11-16)

**Lists (phone and website, gzip):** lessons 29.2 KB + Q-Bank 11.2 KB = **40.4 KB**. The Q-Bank list carries all 290 topic names (its quizzes use 13); every quiz row sends its title twice (all 649 equal) plus number-mode and quiz-number fields; every row sends its full id.

**Website, monitor reset before each page (test student, warm server; dev-only OPTIONS preflights left out):**

| Page | Requests · statements · examined → returned · size |
|---|---|
| Open the site (Study Hub) | 7 · 12 · 64 → 22 · 5.9 KB (start-up, dashboard more, planner agenda 3 · 54 → 15, bookmarks 2 · 4 → 2, availability 1, list index, notices) |
| Courses | 5 · 5 · 5 → 5 · **36.1 KB** (course list + every course's full detail prefetched) |
| Planner | 1 · 1 · 1 → 1 (304) |
| Subscriptions | 1 · 12 · 367 → 230 · 2.9 KB (payment page: later) |
| Lessons, Q-Bank, exams, flashcards, bookmarks, notices, results, profile, billing, study tools | 0 |

#### Plan
1. **List format 5** (lessons and Q-Bank parts only; the combined parts and full list keep format 4 for installed builds):
   - Q-Bank part carries only the topics its quizzes use;
   - quiz row = `[id, courseId, subjectId, topicId, lessonId, isGeneral, examModeOnly, isFree, name, totalQuestions, timeLimit, passingMarks, dynamic]` (one name, no number fields);
   - ids in lesson and quiz rows sent as the gap from the row before; phone and website add them back up when reading.
2. **One quiz name:** the admin quiz form has one Name field; the server saves it as both titles and always `display_title_mode = 'title'`; a schema step sets every quiz to `title` and copies the name across. Student screens (phone, website, results) show the one name.
3. **Bookmarks on the device:** phone file / browser storage per account, with the title and course saved at bookmark time; the start-up and Study Hub no longer read bookmarks. The server endpoints stay only for installed builds.
4. **Website calls:**
   - Study Hub: no bookmarks call; site availability served from server memory (0 statements) — refreshed when an admin saves it;
   - Courses: no prefetch of every course's detail (a course's detail loads when it's opened).

#### Targets

| | Before | Target |
|---|---|---|
| Lists, first download | 40.4 KB | **≈ 30 KB** |
| Bookmark requests | 1 per site open + 1 per toggle | **0** |
| Open the site | 7 · 12 · 64 → 22 | **≤ 6 · ≤ 9**, examined ≈ returned |
| Courses page | 5 · 36.1 KB | **1 · < 1 KB** |

#### Changes (2026-11-16)
- **Server:**
  - lessons and quizzes parts written in format 5 (`PARTS_FORMAT`): id gaps, one-name quiz rows (13 fields, oldest first), Q-Bank part with only its quizzes' topics; combined parts and the full list stay format 4 for installed builds;
  - quiz saves: one name (`quizName`) saved as admin name, student name and quiz title; `display_title_mode` always `title`; no quiz numbers given out (the next-number query is removed);
  - schema `2026-11-16.5`, step "one name per quiz": every quiz's three names made equal and set to `title` (96 were number display), then the content version goes up so the lists rebuild;
  - site availability kept 60 s in memory (was 5 s); an admin save clears it at once.
- **Admin:** the quiz form has one **Name** field ("Admins and students see this name"); the number checkbox and its warning are gone.
- **Phone:**
  - reads format-5 parts and widens them to the rows the screens already use (`widenPart`); list files renamed `_f5_`, the old `_f4_` copies deleted once; the index tag stays format 4;
  - quiz names everywhere = the one name (the "Quiz N" branches removed);
  - bookmarks in a file per account (`bookmarks_<userId>.json`) with name, course and subject saved at bookmark time; the Bookmarks page no longer loads the Q-Bank list for names.
- **Website:**
  - reads format-5 parts (`widenPart`, storage `lms.catalogue.f5`); quiz labels use the one name;
  - bookmarks in localStorage per account (`lms.bookmarks.<userId>`), same `{ ok, saved }` reply, 0 requests;
  - Courses page: no background download of every course's detail.
- **Checked:**
  - format-5 parts decode back to exactly the same 1,478 lesson rows and 649 quiz rows;
  - backend build, unit suites and security e2e pass; `flutter analyze` shows no new problems;
  - website: lists decoded with full ids and one name; bookmarking 2 items = 0 requests and the Bookmarks page shows them with names.

#### After (website, monitor reset before each page; warm server)

| Page | Before | After |
|---|---|---|
| Lists, first download (gzip) | 40.4 KB | **30.2 KB** (lessons 26.5 + Q-Bank 3.7) |
| Open the site (Study Hub) | 7 · 12 · 64 → 22 · 5.9 KB | **6 · 9 · 60 → 20 · 4.7 KB** (no bookmarks call) |
| Courses | 5 · 5 · 5 → 5 · 36.1 KB | **1 · 1 · 1 → 1 · 0.3 KB** |
| Bookmark a quiz / note | 1 request each | **0** |
| Bookmarks page | 0 (cached) | 0 |
| Planner | 1 · 1 · 1 → 1 (304) | same |

**Phone run (iPhone, 2026-11-16, first open after the update):** 21 requests · 18 statements · 216 → 72 rows · 158 KB. The two lists came as format 5: **29.7 KB** (was 39.8 KB in the 10.24 run). The rest is one lesson image 84.6 KB, one quiz review 23.8 KB (3 statements, 141 → 22), five lesson notes 11.1 KB, sign-in 2.9 KB and the one-time flashcard history import (44 → 22).

**Left on the Study Hub:** the planner agenda ("Coming up" list), 3 statements · 54 → 15 — the phone's Study Hub has no such list. Removing it changes what the student sees, so it waits for a decision.

**Note (local server):** a start without `PORT=3200` listens on 3000, and the website then shows the sign-in page on reload (no server reached). Local start: `PORT=3200 DEV_QUERY_TRACE=1 FIX_COUNTS_COOLDOWN_MS=0 SCHEMA_SYNC=0 node dist/main` (`SCHEMA_SYNC=1` re-runs the full schema check, ~8 minutes with the slow log on).

### 10.26 Images once, lean quiz review, flashcard history rows — ✅ implemented locally 2026-11-16 (phone run pending; not committed)

#### Decisions (user, 2026-11-16)
- From the 10.25 phone run: the flashcard history import reads 44 rows for 22; quiz loads carry big replies; lesson images can be optimised **without lowering their quality**. "ok we will apply" P1–P4.

#### Before (phone run 2026-11-16; sizes as sent, gzipped)

| Request | Statements · rows read → returned | Size | Why |
|---|---|---|---|
| Lesson image (`g71-ivf-icsi-steps.webp`) | 0 | **84.6 KB** | phone keeps images in memory only (`Image.network`) → downloaded again every app start; server says `Cache-Control: max-age=0` → browsers ask again every view |
| Quiz review (`recent/53/review`) | 3 · 141 → 22 (cold) | **24.3 KB** (96.7 KB before gzip) | all 20 questions sent again with text, options, explanations and theory recap — the phone already has them in its practice-quiz file |
| Flashcard history import | 1 · **44 → 22** | 0.5 KB | joins `lesson_flashcards` for each card's lesson id |

**Checked and dropped:**
- **Re-encoding images:** all 203 lesson images (20.1 MB) re-encoded at visually equal quality (WebP q85, method 6) save only **4 %**; lossless is 3–5× larger; resizing would blur diagram text. Not done.
- **P3 compression:** already on — JSON replies go out gzipped (lesson note 11.2 → 3.7 KB, review 96.7 → 24.3 KB). Nothing to do.
- **Trimming the review fields** (admin trace, "N/A" recap lines): only 3 % smaller. Not done.

#### Plan
1. **P1 images once:**
   - phone: content images saved as files the first time they're shown (`img_<hash>` in the content folder); later views and app starts read the file (0 requests). Content-hashed names (16 hex) are never asked again; older named files are re-checked at most once per app session with their ETag (304, no body);
   - server: content-hashed images `Cache-Control: public, max-age=31536000, immutable`; other lesson images `max-age=86400` with ETag.
2. **P2 lean review:**
   - the phone asks with `lean=1` when it holds this quiz's practice file for the current list version; the server then sends each question's answer state only (`id, answerKey, courseId, subjectId, topicId, answerState, answerStatus, questionScore, maxQuestionScore`) and the phone joins the text, options, explanation and recap from its file;
   - the same for the exam finish reply (`lean: true`);
   - a question missing from the phone's file → the phone asks once without `lean` (full reply, as today).
3. **P4 flashcard history:** no join; each card's lesson comes from the card list the server holds in memory → rows read = returned.

#### Targets

| | Before | Target |
|---|---|---|
| Lesson image, second view / next app start | 84.6 KB | **0 requests** |
| Quiz review (phone has the quiz) | 24.3 KB | **≈ 2.8 KB** |
| Exam finish reply (phone has the quiz) | ≈ 24 KB | **≈ 3 KB** |
| Flashcard history import | 44 → 22 | **22 → 22** |

#### Changes (2026-11-16)
- **P1 images:**
  - phone: `SavedNetworkImage` (used by `ContentImage` for every network content image) keeps each picture as a file (`img_<FNV hash>` + `.etag`); hashed names are never asked again, other names re-checked once per app session with `If-None-Match`;
  - server (`main.ts` static uploads): lesson pictures with a content-hashed name `public, max-age=31536000, immutable`; other lesson pictures `public, max-age=86400` (ETag kept).
- **P2 lean review:**
  - server: `GET /quiz-attempts/recent/:id/review?lean=1` and the exam finish body `lean: true` return each question's answer state only (`LEAN_REVIEW_KEYS`) plus `lean: true`;
  - phone: asks lean when `quiz_<id>.json` matches the current list version; `_widenReview` joins the practice questions; a missing question → full review (recent) or no result file yet (exam finish; fetched once when opened).
- **P4 flashcard history:** `exportReviews` reads only the student's rows; card → lesson from a map built once per content version (`SELECT id, lesson_id … approved`, shared by all students).
- **Checked:**
  - lean review + practice file = the full review, question by question (20/20), result identical;
  - backend build, unit suites and security e2e pass (one e2e run printed an assertion diff; three reruns passed); `flutter analyze` no new problems.

#### After (local server, test student, warm)

| | Before | After |
|---|---|---|
| Quiz review (phone has the quiz) | 24.4 KB · 3 statements cold | **2.8 KB** (same statements; questions from server memory when warm) |
| Flashcard history import | 1 · 44 → 22 | **1 · 22 → 22** (+ one shared map per content version: 136 → 136) |
| Lesson image headers | `max-age=0` | hashed: **1 year, immutable**; named: 1 day + ETag |

### 10.27 Quiz content built once per quiz change; "reviewed" once — ✅ implemented locally 2026-11-16 (phone run pending; not committed)

#### Decisions (user, 2026-11-16)
- From the 10.26 phone run: 675 rows read for 150 returned; the review button calls the API again. "ok goahead.. build the plan" (R1–R4, mock: only the edited quiz is rebuilt). The same design is kept for a future VPS (files are shared by every Node process).

#### Before (phone run 2026-11-16)

| Request | Statements · rows read → returned | Size | Why |
|---|---|---|---|
| Practice quiz 100 / 96 | 2 · 161 → 21 each | 31 KB each | quiz questions kept in server memory **30 s** (`QUIZ_CONTENT_CACHE_MS`), then read again with their packed options |
| Review 55 / 53 | 3 · 142 → 22 / 141 → 22 | 20–24 KB | same 30 s memory; full reply because the phone's practice copies were tied to the whole list version |
| "Reviewed" for quiz 55 | 1 write ×3 | — | the review screen always starts "not reviewed"; every tap sends it, and the server writes again |
| **Run total** | **26 · 675 → 150** | 580 KB | 605 of the 675 rows are the four quiz loads |

#### Plan
1. **R1 per-quiz stamp + quiz content files:**
   - `quizzes.content_stamp` (schema step), raised in the same save whenever the quiz, its question links, one of its questions, options or recap change; "Fix counts" (after SQL imports) raises every stamp;
   - the Q-Bank list row carries the stamp; the server keeps each quiz's questions as a file `storage/cache/quiz-content/<id>-<stamp>.json` plus memory (no 30 s expiry) — practice opens and reviews read 0 statements; only an edited quiz is rebuilt, once.
2. **R2 "reviewed" once:** the review screen starts from the saved flag (already reviewed → no request); the server writes only when the flag isn't set.
3. **R3 phone copies per quiz stamp:** saved practice quizzes stay valid until that quiz's stamp changes (not every content change).
4. **R4 one download for both:** a full review also carries the practice header for the app, so the phone saves the questions as the practice quiz.

#### Targets

| | Before | Target |
|---|---|---|
| Practice open / review (server) | 1–2 statements · 140–160 → 20 | **0** (after the one build per quiz change) |
| Admin edits a lesson | every phone quiz copy dropped | **none dropped** |
| Admin edits one question | every phone quiz copy dropped | **only its quizzes** |
| "Reviewed" tapped again | 1 write each | **0 requests** |
| Same run | 26 · 675 → 150 | **≈ 70 → 64** |

#### Changes (2026-11-16)
- **Stamp:**
  - `quizzes.content_stamp` (schema `2026-11-16.6`, step "quiz content stamp");
  - raised by `bumpQuizStamps` (`common/utils/quiz-stamp.ts`) in the same save as: question update, delete, bulk delete (before its links go), status change, snapshot restore; theory recap save / delete; and `content_stamp = content_stamp + 1` in every `UPDATE quizzes` (save, restore, status, bulk status);
  - "Fix counts" raises every stamp (SQL imports skip the saves);
  - `/api/theory-recap` added to the content-change routes, so a recap edit raises the content version and the Q-Bank list carries the new stamp.
- **Q-Bank list:** quiz rows carry the stamp (format 4 row index 16, format 5 row index 13); cache file format 2.
- **Server quiz content (`quiz-attempts.service.ts`):** `quizContentFor` keeps each quiz's header + linked questions per stamp in memory (up to 400) and as `storage/cache/quiz-content/<id>-<stamp>.json` (older copies of that quiz deleted); `loadActiveQuiz` and `loadQuestionsForQuiz` use it (a dynamic set's unlinked pool question falls back to the database).
- **Review:** a full review for the app carries `practiceQuiz` (the practice header); the exam finish reply too.
- **"Reviewed":** the server writes only when not yet reviewed (`alreadyReviewed: true` otherwise); the phone's review screen starts from the saved flag and sends nothing when already reviewed.
- **Phone:**
  - saved practice quizzes checked by quiz stamp (`_quizInfo`, `_savedPracticeData`), with the list version only as a fallback for servers without stamps;
  - a full review (recent or exam finish) is also kept as the practice quiz (`_keepPracticeFromReview`, not for dynamic sets).
- **Checked:**
  - backend build, unit suites (the question-governance fake database taught the stamp statement) and security e2e pass; `flutter analyze` no new problems;
  - monitor, test student: practice 100 first open 164 → 23 (build), next open **0 quiz rows**; after a restart **0 quiz rows** (read from the file); raising quiz 100's stamp rebuilt **only quiz 100** once (file `100-2` replaced `100-1`), quiz 96 stayed at 0 quiz rows;
  - review 53: full once (build), lean afterwards 1 statement 1 → 1 (2.8 KB); the full review carries `practiceQuiz`;
  - the 2 statements left on a test practice open are the plan check, because the test token carries no plan list; real app tokens carry it (none in the phone run).

#### After (iPhone run, 2026-11-16, fresh install + sign-in)

**8 requests · 13 statements · 330 → 48 rows · 72 KB.**
- **Sign-in:** 6 statements · 6 → 4.
- **Lists:** downloaded once because the rows gained the stamp, 30 KB in all.
- **Quiz content:** review 55 and practice 556 were each built **once** (160 → 20). That build is for every student and lasts until the quiz changes; afterwards each costs 0 rows.
- **Repeat opens:** none reached the server (phone files). No repeated "reviewed", and no lesson pictures downloaded again.
- **What's left per student:** sign-in, and one push-token write per app start (10.19, next version).

### 10.28 One row per student — ✅ implemented locally 2026-11-16 (phone run pending; not committed)

#### Decisions (user, 2026-11-16)
- **`student_study_summary` is the only table for a student's progress.** Every student action is an `UPDATE` of that one row; no other per-student tables, no new statements.
- **Assume zero students:** everyone starts fresh (no migration from the old tables); the app already in the store is not supported after this (new app version required).
- **Drop, after a backup:** `study_activity_events`, `student_daily_activity`, `student_quiz_progress`, `student_lesson_progress`, `student_area_stats`. Admin Reports no longer shows daily activity.
- **Practice:** waits on the phone and rides along with the next main app request (start-up, lesson done, exam finish, flashcard save); if none goes within 12 hours while the app is open, it is sent once on its own. A **passed** practice gives **1 XP** (within the 100 XP daily cap; pass = the quiz's pass mark); a practice that isn't passed gives no XP but still counts as practice done for today.
- **Today's progress = 4 bits** in the row (`today_bits` + `today_day`): lesson done · exam done · practice done · flashcards reviewed. The first time one happens that day its 0 becomes 1; a new day starts at 0000. The phone keeps the same bits and sends them with the ride-along.
- **Streak:** a day counts when **all 4 bits are done** that day (the grace-day rule stays).
- **Every student write is the same shape:** 1 request (or riding along with one), **1 row examined (the student's row by primary key), 0 rows returned**, a reply of a few bytes (`{"ok":1,"v":<progress version>}`).
- **Weak topics and recommendations:** worked out on the phone only, from what it already holds (each exam's best %, the 5 recent results, lessons done, flashcard history, the planner) — 0 requests, 0 rows.

#### Already in the row (kept)
- `lessons_done`: one bit per lesson (1 = finished).
- `quiz_marks`: one byte per quiz (top bit passed, 7 bits best % + 1, 0 = not taken).
- `recent_results`: the 5 recent exam results (answers, %, passed, reviewed) — review, Results page, 5-result lock.
- `xp_total`, `xp_today` + `xp_day`, streak columns, `progress_version`, `flash_history`.

#### Before (local, 2026-11-16)

| Table | Rows | Size | Used for |
|---|---|---|---|
| `study_activity_events` | 1,309 | 368 KB | activity log: practice/lesson/result events, Reports chart, rebuilding a summary row |
| `student_daily_activity` | 4 | 48 KB | per-day counts, daily XP cap, goals, weekly view |
| `student_lesson_progress` | 58 | 96 KB | old lesson progress (replaced by `lessons_done`) |
| `student_quiz_progress` | 10 | 16 KB | exam attempts / practice counts per quiz (older builds) |
| `student_area_stats` | 9 | 32 KB | weak topics per subject / topic |

Practice finished today: 1 request · 4 statements per practice.

#### Plan
1. **Row columns:** add `today_bits` (TINYINT), `today_day` (DATE), `practice_seq` (INT, last practice number applied — a retried request never counts twice); remove `days14` and the per-day counters it replaces (`lessons_today`/`lessons_day`, `exams_today`/`exam_pct_today`/`exams_day`) once nothing reads them.
2. **Ride-along (server):** any student request may carry `practices: [{n, day, passed}]` and `bits`; the server applies them in the same request with **one `UPDATE`** of the row (1 row examined, 0 returned): XP (1 per passed practice, capped), today's bits, the streak for each day (a late day never moves the streak backwards), `practice_seq`.
3. **Ride-along (phone):** one central place adds waiting practices and today's bits to the next main request; cleared when the server confirms; sent alone after 12 hours; sent before sign-out. The phone shows its own numbers on top of the server's until confirmed (no flicker).
4. **Lessons, exams, flashcards:** keep their one-row updates and also set their today bit; the streak is checked when the 4th bit is set.
5. **Remove every read and write of the 5 tables** (study-stats, dashboard, quiz-attempts, workspace Reports, lesson-bits, schema steps); the old practice endpoint and old-build progress rows go.
6. **Weak topics on the phone:** subjects ranked by exam best % (from `quiz_marks` + the Q-Bank list), with recommendations from unread lessons, unpassed sets, due flashcards and planner tasks in those subjects.
7. **Drop:** export the 5 tables to a .sql file on the Desktop (outside the repo), then drop locally; on production only after the new version is deployed and working.

#### Targets

| | Before | Target |
|---|---|---|
| Per-student tables | 6 | **1** |
| Practice finished | 1 request · 4 statements | **0 requests**; inside the ride-along `UPDATE` |
| Any student write (lesson done, exam finish, flashcard save, practices) | 1–5 statements, several tables | **1 statement · 1 row examined · 0 returned · reply ≈ 20 bytes** |
| Today's goals / streak read | daily-table read | **0** (in the start-up row) |
| Weak topics | server table reads | **0** (phone) |

#### Open points (to confirm in review)
- **Settled (user):** only a **passed** practice gives 1 XP; lessons and exams keep their XP rules.
- Streak only when **all 4** are done in a day is strict: a student who studies but skips one of the four loses the day (the grace day still covers one miss).

#### Changes (2026-11-16)
- **Backup:** `~/Desktop/lms-backups/student-tables-before-10.28-*.sql` (the 5 tables + the summary row) and `student-tables-extra-before-10.28-*.sql` (`student_area_daily`, `student_xp`, `xp_events`, `lesson_opens` — the same family, no longer written).
- **Dropped locally:** `study_activity_events`, `student_daily_activity`, `student_quiz_progress`, `student_lesson_progress`, `student_area_stats`, `student_area_daily`, `student_xp`, `xp_events`, `lesson_opens`. Production: only after the new version is deployed and working (manual `DROP TABLE`).
- **The row:** schema `2026-11-16.7`, step "one row per student": adds `today_bits`, `today_day`, `practice_seq`; drops the day / topic-stat columns (`days14`, `lessons_today`/`lessons_day`, `exams_today`/`exam_pct_today`/`exams_day`, `streak_grace`, `streak_for_day`, `streak_today_active`, `area_trimmed_through`, `quiz_progress_built`). The schema code creates no other per-student table and no longer copies from old ones.
- **One write shape (`common/utils/progress-write.ts`):** `progressWrite()` builds the SET pieces — streak only when today's 4th bit is set (`streakAssignmentsWhen`), XP (the write's own + 1 per NEW passed practice, `n > practice_seq`, within the cap), today's bits, `practice_seq`.
  - lesson done (`xp.service`), exam finish (`quiz-attempts`), the older attempt path (`study-stats.recordExam`) and the old practice endpoint each stay ONE `UPDATE`;
  - flashcard save adds one progress statement (`applyProgress`, flashcards bit);
  - `RideAlongInterceptor` (global) takes `practices` out of any request body before validation, a write that updates the row applies them, otherwise they are applied after the request in one statement; the reply carries `X-Practices-Applied: <last number>`. A write that wrote nothing (lesson already done, repeated exam submit) gives them back (`returnRideAlong`).
  - `POST /student/dashboard/sync` — the 12-hour fallback (body `{ practices }`).
- **Study Hub:** goals = the 4 bits (lesson · exam · practice · flashcards), `quizDoneToday` = all 4 done, `todayBits` in the top reply; the progress reply carries `todayBits` and `practiceSeq`.
- **Removed reads:** practice counts per quiz, admin Reports' activity log (daily chart now exam attempts only; "inactive" from attempts + the row's last active day), lesson-open checks (the app sends `readSeconds`).
- **Phone:** `PracticeQueue` (file per account: next number, waiting practices); a finished practice is marked passed against the quiz's pass mark and noted (no request); the ApiClient adds waiting practices to start-up / lesson done / exam finish / flashcard save / sync and drops them on `X-Practices-Applied`; overdue (12 h) → one sync on return to the app; sent before sign-out; numbering continues after the server's `practiceSeq`; the Study Hub counts a practice of today at once (goal + streak when it's the 4th) until the server has it. Weak topics stay the phone's own (10.17).
- **Checked:**
  - backend build, unit suites, security e2e (fake database taught the empty-row insert); `flutter analyze` clean; `flutter test` only the 2 old `saved_first_refresh_test` failures;
  - monitor, test student: lesson done + 2 practices = **1 `UPDATE` · 1 → 0** (XP +7: lesson 6 + passed practice 1; bits lesson+practice); the same practices again = no change (number guard); 1 new passed practice via sync = 1 statement, +1 XP; flashcard save sets the flashcards bit; exam finish + 1 practice = **1 statement · 1 → 0**, bits **1111**.

#### Simulator run (iPhone 17 Pro simulator, 2026-11-16, user: "test it yourself")
- Sign-in: `dashboard/top` 1 · 1 → 1 and `progress` 1 · 1 → 1 (both from the one row; progress carries `todayBits`, `practiceSeq`); the push token sent once (fresh sign-in).
- A practice waiting on the phone rode along with the start-up request: **1 statement** (`INSERT … ON DUPLICATE KEY UPDATE` of the row), XP +1, `practice_seq` 7 → 8, the phone's copy cleared by `X-Practices-Applied`; a practice the server already had was not counted again; numbering continued after the server's.
- Found and fixed in this run:
  - the start-up request checks the session itself, so the ride-along step didn't know the student → it also takes the student from the start-up reply;
  - the phone's confirm and re-number (both on the start-up reply) raced and re-wrote the file → `PracticeQueue` changes now run one at a time.

#### Admin check (2026-11-16, local, signed in as admin)
- **Every admin page opens** with all its requests 200: dashboard, courses / structure, users, roles, questions, question reports, assessments (+ import sets, create), subscriptions, finance, AI notes, announcements, reports (activity chart without the log), drugs, ECG, auscultation, OSCE, settings, AI builder, profile. Only `uploads/marketing-popups/popup-alert.json` fails in the dev browser (loaded cross-origin from :5175; same origin in production).
- **New quiz** (`QA test set 10.28`, id 1022): saved with ONE name in all three name columns, name display, stamp 1; content version 11 → 12; Q-Bank list rebuilt (650 sets).
- **Edits raise only this quiz's stamp:** quiz edit → 2 (all three names changed together), one of its questions → 3, that question's theory recap → 4 (content version → 15, recap route now counts as a content change). A student's practice open shows the new name and recap; the server keeps only `1022-4.json`.
- **New lesson + 2 approved flashcards** (id 1892): content version 15 → 19; course structure and student list rebuilt (1,479 lessons); the lesson is in the lessons list (format 5) with 2 cards and its stamp; note opens; cards served.
- **Announcement** (id 11): created; the student notices feed returns it with 0 statements; the simulator shows it on the next start.
- QA items left in the local database: quiz 1022, lesson 1892 (+2 cards), announcement 11.

### 10.20 Student website = the phone, page by page, plus clean-up — 📝 plan, waiting for "ok we will apply"

#### Decisions (user, 2026-11-16)
1. The student website uses **the same APIs as the phone**, with the same statements and rows per screen.
2. Measured the same way as the phone: the monitor is reset to zero before each page, every page is counted, and before and after are compared.
3. **Clean-up (user, same day):** remove unwanted data, unused code and anything not needed, and make large files and replies smaller.

#### Aims
- Every website screen costs what the matching phone screen costs: 0 requests when nothing changed, 1 indexed statement otherwise.
- No pre-loading of data the student didn't open, and no requests the website is refused.
- Old code paths, tables and files that nothing uses are removed (each with a backup, after approval).

#### Before (website, measured 2026-11-16 with the monitor reset before each page; test student, warm server) vs the phone today

| # | Screen | Website before: requests · statements · rows · size | Phone today | Gap |
|---|---|---|---|---|
| 1 | Open the app → Study Hub | 4 · **24** · 5,920 → 107 · **76 KB** (`/student/boot` alone: 20 statements; **26 · 19,974 rows cold**) | start-up 1 · **3** (+ catalogue 0 when unchanged); Study Hub filled from it | boot reads the whole quiz catalogue, the lessons list and the free-question pool, and the Study Hub still reads stale `quiz_attempts` |
| 2 | Courses | 5 · 7 · 36 KB (the list plus **every course's detail pre-loaded**) | 0 (catalogue + lesson bitmap on the phone) | 4 extra requests |
| 3 | Course detail | 0 (pre-loaded in #2) | 0 | — |
| 4 | Q-Bank | 4 · 4 (**4 premium quizzes pre-loaded and refused: 403**) | 0 (catalogue + quiz byte map) | 4 wasted requests |
| 5 | Study | 0 | 0 | — |
| 6 | Lessons | 1 · 3 · **57.7 KB** | 0 | full lessons list every visit |
| 7 | Open a lesson | 2 · **7** (the lesson 3 + an "activity" ping 4) | 1 · **1** | ping + identification |
| 8 | Flashcards | 1 · 1 · 44 → 22 | 0 (cards kept per lesson) | |
| 9 | Planner | 1 · 1 · 1 | 1 · 1 · 1 | ✅ same |
| 10 | Results / Review / Exam | (10.16-W done) results 1 · exam start 1 · submit 1 | same | ✅ same |
| 11 | Saved, back to Study Hub | 0 | 0 | ✅ |
| — | Identification per request | session cookie: 0–2 (10-second cache) | **0** (signed 1-hour token) | |

#### Plan (website, matching the phone)
- **W1 Start-up:**
  - `/student/boot` is replaced by the phone's `POST /app/start`: user, subscription and Study Hub in 3 statements;
  - the catalogue uses the phone's two-level versioned endpoints (`/student/catalogue/index` + `/parts`, 0 rows when unchanged);
  - progress uses `/student/progress` (lesson bitmap, quiz marks and recent results, 1 row; nothing when unchanged).

  The Study Hub's lower cards use `GET /student/dashboard/more` (2 statements), as on the phone.
- **W2 Courses, course detail, Lessons:** built in the browser from the catalogue and the lesson bitmap, with no per-course pre-loading (0 requests).
- **W3 Q-Bank:** from the catalogue and the quiz byte map (0 requests). The premium pre-loading is removed.
- **W4 Lesson:**
  - open = `GET` the lesson by id (1 statement);
  - the "activity" ping is removed;
  - Done = the phone's Done (1 statement, the 2-minute rule as on the phone).
- **W5 Flashcards:** the phone's flashcard store (decks from the catalogue, cards kept per lesson, reviews in one row).
- **W6 Identification:** the website uses the signed 1-hour access token it already receives at sign-in, as the phone does (0 statements per request). The cookie session is used only to renew it. *(Decision **W6** below; admins keep the session check, 9.8 D3.)*

#### Clean-up (user's request; each item is listed and approved before anything is deleted)
- **C1 Code, removed once W1–W5 are live:**
  - `/student/boot` and its builders;
  - the old exam endpoints (`exam/:id/save`, `/submit`, `result/:id`, `review/:id`, `review/:id/complete`) and the `exam_sessions` code;
  - the website's activity / result-viewed pings;
  - the website's per-course pre-loading and premium quiz pre-loading.
- **C2 Tables:** 9.9 groups 1, 2 and 4 plus the two content audit tables (already decided), each with a backup and a guarded `.sql`.
- **C3 Reply sizes:**
  - the Q-Bank list (534 KB today) and the lessons list (57.7 KB) are replaced by the versioned catalogue parts, downloaded once and then 0;
  - the boot reply (75 KB) disappears.
- **C4 Repo files (decision **C4**):** large tracked files that the app does not use:
  - marketing teaser images, about 50 MB (`marketing/xyndrome-teaser/keyframes`, `work`);
  - `mitral-stenosis-explainer/` (voice-over 2.6 MB);
  - `scripts/drugs.xlsx` (5.6 MB);
  - a duplicate font (ShantellSans in both `frontend` and `mobile`, needed by each app).

  The git history is 1.1 GB and holds the old backup tarballs that contain secrets (see the P0 note), so cleaning that history is a separate, careful step.

#### Targets (website after = phone)

| Screen | Before | Target |
|---|---|---|
| Open the app → Study Hub | 4 · 24 · 5,920 rows · 76 KB (cold 26 · 19,974) | **2 · 3–5** (start-up + lower cards), catalogue 0 when unchanged |
| Courses / course detail / Lessons / Q-Bank | 5–6 · 7–10 · 94 KB | **0** |
| Open a lesson | 2 · 7 | **1 · 1** |
| Lesson Done | (website path) | **1 · 1** |
| Flashcards | 1 · 1 · 44 rows | **0–1** |
| Planner / Results / Exam | already matched | same |
| Identification per request | 0–2 | **0** (W6) |

#### Decisions (user, 2026-11-16)
- **W6:** ✅ the student website uses the signed 1-hour token like the phone; the cookie only renews it.
- **C4:** ✅ remove all three from the repo: the marketing teaser images, `mitral-stenosis-explainer/`, and `scripts/drugs.xlsx` (copies kept outside the repo first).

### 10.17 Study Hub and sign-in from the summary row; weak topics on the phone ✅ implemented locally 2026-11-16 (not committed)

#### Decisions (user, 2026-11-16, "ok go ahead")
1. **Remove the "result viewed" pings.** Nothing reads them.
2. **Study Hub top = 1 statement.** The streak, today's numbers and the last 14 days all come from the summary row, with no day-row reads.
3. **Lower cards = 1–2 statements.** There are no server weak areas, and the question of the day and its options load in one joined statement.
4. **Weak topics on the phone only** (10.16 decision 8). Each subject gets its right / wrong counts from every marked exam. A reinstalled phone starts from zero.
5. **Sign-in = 3–4 statements.**

#### Aims
- Every Study Hub read is the one summary row, by user id.
- No topic-stat or day-row reads on any phone screen.
- Sign-in reads the summary row only once.

#### Before (measured on the phone 2026-11-16 · Statements per request)

| Request | Before |
|---|---|
| "Result viewed" (`dashboard/student/activity`) | 1 request · 2 statements (an event + a day row), on every result or review open |
| Study Hub top | 3 (summary + day rows + weak areas) |
| Study Hub lower cards | 4–6 (summary again, weak / strong areas, smart-note title, question id range, question, its 5 options); one took 7.6 s |
| Sign-in | about 8 |

#### Plan
- **14-day ring on the summary row:** a new `days14` JSON column with 14 slots of `[day number, exams, exam % sum, active]`. The slot is day number mod 14. It is written inside the statement that already records the activity: lesson Done, exam finish, the older exam submit, and practice / lesson activity. So it costs 0 extra statements. A one-time fill copies the last 14 days of day rows (schema `2026-11-16.2`).
- **Study Hub top:** one SELECT of the summary row. It covers today's exams / %, the streak, XP and the ring, which supplies the active days and the 7 / 14-day exam windows.
- **Lower cards:** no weak / strong-areas read. The question of the day and its options come in ONE statement, with the options packed as JSON. The id range is kept in memory after its first read.
- **Same summary row in one request:** sign-in and start-up answer both the Study Hub and the progress. The Study Hub read now carries the progress columns (lesson bitmap, quiz byte map, recent results, version) and keeps the row in the request context, and the progress part reuses it.
- **Phone weak topics:** `WeakTopics` (SharedPreferences, `xyndrome.weak.<uid>`) stores `{subjectId: [right, wrong]}`, added from each submit's marked review. Full papers are counted too. A subject shows once it has 10 answers or more. Weakest 3 / strongest come from these counts.
- **Phone:** the result-viewed POST is removed from Review.

#### Changes (files)
- Backend:
  - `xp/streak-sql.ts`: ring assignment and reader.
  - `schema/schema-sync.service.ts`: `days14` step and fill, version `2026-11-16.2`.
  - `xp/xp.service.ts`: Done writes the ring.
  - `quiz-attempts/quiz-attempts.service.ts`: finish writes the ring; review questions carry course / subject / topic ids for the phone's weak topics.
  - `study-stats/study-stats.service.ts`: summary reads the ring and progress columns and remembers the row; recordExam / recordActivity write the ring.
  - `dashboard/dashboard.service.ts`: no recent-days, area or ranked reads; question of the day joined.
  - `common/auth/subscription-scope.ts`: `rememberSummaryRow` / `summaryRowFromRequest`.
  - `courses/student-catalogue.service.ts`: progress reuses the row.
  - `test/access-control-regression.ts`: the fake database knows the joined question.
- App:
  - new `state/weak_topics.dart` and `test/weak_topics_test.dart`;
  - `features/dashboard/dashboard_repository.dart`: weak / strong from the phone;
  - `features/quizzes/quizzes_repository.dart`: submit adds to weak topics;
  - `features/results/review_page.dart`: no result-viewed ping.

#### Targets and measured after (local, test student, slow log · Statements · Rows examined → returned)

| Request | Before | Target | After |
|---|---|---|---|
| "Result viewed" | 1 · 2 per open | **0** | **0 requests** (removed) |
| Study Hub top | 3 | **1** | **1 · 1 → 1** |
| Lower cards, warm | 4–6 | **1–2** | **2 · 1 → 1** (summary + smart-note title, 0 rows) |
| Lower cards, cold (first after a restart / new day) | 4–6 | — | 4 · 7 → 3 (+ id range from the index, then kept; + the question with 5 options in one row: 6 → 1) |
| Sign-in, warm | about 8 | **3–4** | **4 · 6 → 3** (user, session save, subscriptions, summary once) |
| Sign-in, first after a restart | about 8 | — | 5 · 7 → 4 (+ the once-per-boot "progress built" check) |

- **Checked:**
  - backend unit suites (Apple IAP 31/31, access control, auth, SQL injection, OWASP, secrets, medical) and security e2e pass;
  - Flutter `weak_topics_test` passes;
  - the Study Hub shows streak 3 and active days 2026-11-14 / 15 from the ring.

#### Phone after-run (iPhone, 2026-11-16, slow log · Statements · Rows examined → returned)

| Request (phone) | Statements · rows |
|---|---|
| Sign-in | **4 · 6 → 3** (user, session save, subscriptions, summary once; progress reused from it) |
| Sign-in, wrong password | 1 · 1 → 1 |
| App start (reopen) | **3 · 5 → 3** (user by session, subscriptions, summary) |
| Progress check, unchanged | **1 · 1 → 1** (161 bytes) |
| Review "reviewed" | **1 · 1** |
| Recent review, first open (quizzes 55, 56: finished by test calls, not on the phone) | 3 · 142 → 22 (entry, quiz row, 20 questions in one statement); kept on the phone afterwards |
| "Result viewed" pings | **0** |

- Total: 7 requests · 16 statements · 298 → 52 rows · 42 KB. 284 of those rows are the two first-time review loads.
- The Study Hub needed no request of its own: it was filled from the sign-in / start-up reply.

### 10.18 Results order and the free-slot exam rule ✅ implemented locally 2026-11-16 (not committed)

#### Decisions (user, 2026-11-16)
1. **Results page order:** failed and not reviewed at the top, then failed and reviewed, then passed at the bottom. Newest first inside each group.
2. **Free-slot rule:** a new exam may start when **any** of the 5 recent results is free, not only the oldest. A result is free when it is **passed and reviewed** (review first, as now). Fewer than 5 results also means a free slot. A redo always uses its own slot.
3. **The new result replaces the oldest free result.** Failed or unreviewed results are never dropped.
4. **The lock shows instantly when the exam is opened.** The phone keeps a ready free / not-free answer from the progress it already holds, so there is no wait and no request.

#### Aims
- 0 requests and no waiting to know whether an exam can start.
- Server cost unchanged: exam finish stays **1 statement · 1 row**.

#### Before
- Only the **oldest** result counted. A free slot elsewhere still blocked the student.
- The lock was found inside the exam load, behind the loading screen.
- Past 5 results, the server always dropped the oldest entry, even if it was failed or unreviewed.

#### Plan
- **Server (finish exam, the same 1 UPDATE):**
  - a redo replaces its own entry;
  - fewer than 5 entries: the result is added;
  - otherwise the first entry with `passed` and `reviewed` is removed (a CASE over the 5 slots, no extra read) and the new result is added;
  - if none is free (older builds only), the oldest is removed as before.
- **Phone:**
  - `StudentProgress.examBlocker` is worked out from the recent results the phone already holds;
  - the exam page checks it before loading, so the lock card shows at once;
  - the exam load keeps the same check as a backstop;
  - `applyExamLocally` replaces the oldest free result the same way;
  - the Results list is sorted into the 3 groups.

#### Changes (files)
- Backend: `quiz-attempts/quiz-attempts.service.ts` (recent-results expression).
- App:
  - `state/catalogue.dart`: `examBlocker`, local replace rule;
  - `features/quizzes/quizzes_repository.dart`: lock from `examBlocker`, results order;
  - `features/quizzes/take_quiz_page.dart`: instant lock;
  - `test/quiz_marks_test.dart`.

#### Targets

| Item | Before | Target |
|---|---|---|
| Know whether an exam can start | inside the exam load (wait) | **instant, 0 requests** |
| Exam finish | 1 · 1 | **1 · 1** (unchanged) |

### 10.19 Study tools and background calls — 🔧 in progress (started 2026-11-16, user: "start 10.19")

These are left as they are for this version. They will be planned for the next update. The audit numbers, measured locally with the test student (Statements · rows examined), are:

| Call | When | Cost now |
|---|---|---|
| Drugs: 10-drug batch | open, and again whenever 3 are left | 5 · 1,344 (2 random-order scans) · 190 KB |
| Drugs: each spin | before every drug | 3 · 3 |
| OSCE: courses / regions / systems / cases / case | every screen open, nothing kept | 1–4 each |
| ECG: topics / topic | every screen open, nothing kept | 1–2 (topic 63 KB) |
| Auscultation: topics / topic / quiz | every screen open, nothing kept | 1 each |
| Practice quiz finished ping | every practice finish | 5 |
| Push token | every app launch | 1 write |
| `/auth/me` | every return to the app after 1 minute | 0 (1 request) |
| `/subscriptions/me` | Planner and Subscriptions open | 5 warm / 12 cold · 52 KB |

The idea for the next version is 0 requests when nothing has changed:
- the drug list is kept on the phone and spins happen there; each drug's text is downloaded once;
- OSCE / ECG / Auscultation content is kept per content version;
- practice finished becomes 1 statement;
- the push token is sent only when it changes;
- `/auth/me` on return is dropped;
- the Planner reads the plan from the token.

One choice is still open: whether the free-spin count lives on the phone or stays on the server.

#### Decisions (user, 2026-11-16)
- **Free spins:** counted on the server for free users only — but not per spin: the spins of one visit are sent in **one request when the student leaves the Drugs page**. Subscribers send nothing.
- **Drug data:** a light list of all drugs (name + class) kept on the phone, downloaded **only when the Drugs page opens**; spins and wrong answers are picked on the phone; each drug's full text downloads the first time it comes up, then stays.

#### Before (measured again 2026-11-16, local, test student; sizes as sent, gzipped)

| Call | Statements · rows read → returned | Size |
|---|---|---|
| Drugs: 10-drug batch | 5 · **1,344 → 52** | **116.7 KB** (213 KB raw) |
| Drugs: each spin | 3 (subscription check, count read, count write) | — |
| OSCE regions / case | 4 · 13 → 5 / 4 · 3 → 3 | 0.4 / 6.1 KB |
| OSCE courses / systems / cases | 1 · 8 → 1 / 1 · 11 → 1 / 2 · 11 → 3 | small |
| ECG topics / topic | 1 · 23 → 11 / 2 · 3 → 2 | 0.3 / **46.3 KB** |
| Auscultation topics / topic / quiz | 1 each | small |
| Practice finished ping | 5 | — |
| Push token | 1 write, every app start | — |
| `/auth/me` | 0 · 1 request on each return to the app | 0.2 KB |
| `/subscriptions/me` (Planner) | 5 warm / 12 cold | 52 KB |

#### Plan
1. **Drugs:**
   - `GET /student/drugs/list`: id, name, class of every active drug + free-spin state (used, limit, subscriber from the token) — built once per content version in memory, 1 statement per open (the student's used count);
   - `GET /student/drugs/item/:id`: one drug's full text from memory (0 statements); the phone keeps it per content version;
   - spins and the 3 wrong classes picked on the phone; `POST /student/drugs/record {count}` once when leaving the page (free users only; capped at the free limit on the server);
   - the old `batch` / `record` stay for installed builds.
2. **OSCE / ECG / Auscultation:** each list and topic/case kept on the phone per content version (like lessons), and in server memory per version.
3. **Practice finished:** 1 statement (subject from the list in memory, no extra quiz read).
4. **Push token:** sent only when the token or the account changes.
5. **`/auth/me` on return:** dropped (the signed token already says who it is; a rejected token still renews or signs out as today).
6. **Planner:** plan and access from the token, not `/subscriptions/me`.

#### Targets

| | Before | Target |
|---|---|---|
| Open Drugs, 10 spins (first time) | 117 KB · 1,344 rows + 30 statements | ≈ 15 KB list + 12 KB per new drug · 1 statement + 1 write on leaving |
| Spin a drug seen before | part of a 117 KB batch | **0 requests** |
| OSCE / ECG / Auscultation screen opened again | 1–4 statements each | **0 requests** |
| Practice finished | 5 | **1** |
| App start / return | push write + `auth/me` | **0** when nothing changed |
| Planner open | 5–12 statements · 52 KB | **0** |

#### Changes (2026-11-16)
- **Drugs:**
  - server: `GET /drugs/list` (light list from a copy built once per content version + `have=<v>` → no list when unchanged), `GET /drugs/item/:id` (0 statements), `POST /drugs/record {count}` (one visit's spins; paid plans skip; capped at the free limit); the old `batch` / `record` kept for installed builds;
  - "paid plan" = an active plan whose slug isn't `free` (the free plan's subscriptions all use it), read from the signed token's plan list — the old spin rule (a free-plan subscription doesn't lift the limit) is kept;
  - phone: `DrugQueueNotifier.open()` on page open, spins and 3 wrong classes picked on the phone, drug text kept per drug (dropped when the content version changes), `flush()` on leaving the page or the app going to the background.
- **OSCE / ECG / Auscultation:** `keptPerVersion` (`state/kept_content.dart`) keeps lists, cases, topics and audio clips per content version; premium cases/topics/clips are read from the phone only while the student has a plan.
- **Practice finished:** subject and course from the Q-Bank list in memory → 4 statements (was 5). The history log, the practice count (older builds) and the day row + streak (two tables) stay; whether the request itself moves into the start-up request is the user's choice (asked).
- **Push token:** sent after a new sign-in, or when the token or account differs from the last one sent (`xyndrome.push.sent`); not on every app start.
- **`/auth/me` on return:** removed (`revalidateSession` and the repository's `me()`); an expired or revoked session answers the next request with 401 and goes to sign-in as before.
- **Planner (subscribers only, as before):** `paidPlan` in the progress reply's `access` (0 statements); the PRO marker and the generate gate read it, `/subscriptions/me` only as a fallback for an older server; purchases refresh the progress.
- **Checked:**
  - backend build, unit suites and security e2e pass; `flutter analyze` no new problems;
  - drugs (test student): list 6.7 KB for 357 drugs, unchanged list 75 B, one drug 7.7 KB · 0 statements, a paid plan's spins write nothing (the 1 statement left is the plan lookup, only because the test token carries no plan list).

### 10.29 Today's goals, streak and Readiness on the phone — ✅ implemented locally 2026-11-17 (simulator checked; not committed)

#### Decisions (user, 2026-11-17)
- **Today's 4 goals are kept on the phone.** Lesson done, exam finish, practice and a flashcard save each tick their goal on the phone at once; the server still saves the same bit inside the write it already makes (no extra statement).
- **Streak on the phone:** when the 4th goal is ticked, the Study Hub shows streak + 1 and today's dot at once (the server saves the same in that write).
- **No Study Hub re-ask after an action:** the app stops `GET /student/dashboard/top` + `/more` after a lesson, exam or practice.
- **Readiness = one bar per study day** (days with nothing done are skipped, no dates shown): bar = that day's average marks (exams + practice), lines at 50 and 75, 4 goal dots under each bar; a day with no marks shows a short grey bar. Last 14 study days, about 1 KB, kept per account on the phone; the first run fills from the 5 recent exams. New phone / reinstall starts again (accepted: the only fix would be a column + request).
- **Drop `attempts_total`, `passed_total`, `percentage_sum`.** AVG MARKS = the average of the best % per exam taken (the quiz-marks bytes the phone and the row already hold).
- **Readiness card title:** "Readiness" (done 2026-11-17). Lesson continue card = Q-Bank style per subject (done 2026-11-17).

#### Aims
- Lesson done / exam finish: only the action's own request. Practice: 0 requests. Readiness, goals, streak: 0 requests, 0 rows.
- An exam finish writes 3 fewer columns.

#### Before (local, 2026-11-17, test student)
| Step | Requests | Statements | Rows examined | Rows returned | Size |
|---|---|---|---|---|---|
| Lesson done (PATCH) | 1 | 1 | 1 | — | 0.1 KB |
| then Study Hub `GET /student/dashboard/top` | 1 | 1 | 1 | 1 | 0.9 KB |
| then Study Hub `GET /student/dashboard/more` | 1 | 2 | 1 | 1 | 0.7 KB |
| **Lesson done, total** | **3** | **4** | **3** | **2** | **1.7 KB** |

Exam finish and practice: the same two Study Hub requests after (practice: 2 requests for nothing).

#### Plan
1. Phone `StudyDays` file (`study_days_<uid>.json`): today's bits + marks per study day; seeded with the server's `todayBits` (start-up) and the 5 recent exams.
2. Lesson done / exam finish / practice / flashcard save → tick on the phone; the Study Hub reads goals, streak and Readiness from it; `freshNext('dashboard')` + dashboard invalidate removed after those actions.
3. Readiness card → study-day bars; AVG MARKS from quiz marks.
4. Server: drop the 3 columns (schema step + version bump); exam finish and the older attempt path stop writing them; the Study Hub's average / pass rate / attempts come from `quiz_marks`.

#### Changes (2026-11-17)
- **Found while tracing:** flashcard reviews stay on the phone since 10.23, so the server never got today's flashcards goal, and since 10.28 the streak needs all 4. **The server streak could never go up.** Fix: the flashcards goal rides along like a practice (`{n, day, kind:'flash'}`, once per day, no XP); `progressWrite` sets bit 8 for it.
- **Phone `state/study_days.dart`:** one entry per study day (`study_days_<uid>.json`: goals bits, marks sum, marks count), last 14 kept, the first read filled from the 5 recent exams. Lesson done, exam finish (`submitExam`), practice and the first flashcard review of the day call `StudyDays.done(...)`.
- **Study Hub split:** `hubTopProvider` = the server part (the start-up reply, or `/student/dashboard/top`); `studentDashboardProvider` = that part plus everything on the phone (course progress, results, weak topics, today's goals + streak from the study days). Rebuilding it asks for nothing. `hubMoreProvider` follows `hubTopProvider` only.
- **No re-asks after actions:** `freshNext('dashboard'/'quizzes'/'results')` and the dashboard / quiz-list invalidations removed after lesson done, exam finish and practice. After an exam only the saved progress is re-read (already updated on the phone).
- **Streak on the phone:** when the phone's bits make 15 and the server's don't yet, streak + 1 and today's dot show at once.
- **Readiness card:** study-day bars (`_StudyDayBarsPainter`): one bar per study day, newest on the right, height = that day's average marks, red below 50, amber 50–74, green from 75, dashed 50/75 lines, 4 goal dots, grey stub for a day with no marks. Reads only `studyDaysProvider` (no `/more` needed). The old sparkline and stat boxes are removed.
- **Today's route card:** the 4 goals (lesson, exam, practice, flashcards), ticked from today's bits (the phone's and the server's), with the suggested lesson / quiz from the lists on the phone; it no longer needs the lower-cards request. The Readiness bars start at the left and grow right; today's bar also shows goals the server already has.
- **Simulator (2026-11-17):** after launch only `POST /api/app/start` (1 request · 3 statements); Study Hub, Today's route (3 of 4 ticked) and Readiness bars shown with 0 requests.
- **AVG MARKS:** the average of the best % per exam taken, from the quiz marks (`examAverageProvider`); the hint shows "N exams".
- **Server:** `attempts_total`, `passed_total`, `percentage_sum` dropped (schema step 'drop exam totals', CRITICAL_SCHEMA_VERSION 2026-11-17.1; backup `~/Desktop/lms-backups/student_study_summary-before-10.29-*.sql`). Exam finish and the older attempt path no longer write them; the Study Hub's exams taken / passed / average come from `quiz_marks`.
- **Checked:**
  - backend: build, 31/31 unit, security e2e pass;
  - Flutter: `flutter analyze` shows no new problems; `flutter test` has 2 failures in `saved_first_refresh_test.dart` that come from before this change (the test feeds the old lesson list format into the catalogue loader).

#### After (local, 2026-11-17, test student)
| Step | Requests | Statements | Rows examined | Rows returned | Size |
|---|---|---|---|---|---|
| Lesson done + flashcards goal riding along | 1 | 1 | 1 | — | 0.1 KB |
| Exam finish (no totals written) | 1 | 1 | 1 | — | 18.4 KB (the review) |
| Practice finished | 0 | 0 | 0 | 0 | — |
| Study Hub after any of these (goals, streak, Readiness, AVG MARKS) | 0 | 0 | 0 | 0 | — |

Lesson done: **3 requests · 4 statements · 3 examined · 2 returned · 1.7 KB → 1 request · 1 statement · 1 examined · 0 returned · 0.1 KB.** Today's bits on the row: lesson + flashcards ride-along 1 → 9; exam 9 → 11.

#### Targets
| Step | Requests | Statements | Rows examined | Rows returned |
|---|---|---|---|---|
| Lesson done, total | 1 | 1 | 1 | — |
| Exam finish, total | 1 | 1 | 1 | — |
| Practice finished | 0 | 0 | 0 | 0 |
| Readiness / goals / streak shown | 0 | 0 | 0 | 0 |

### 10.30 Day done on the phone — streak from one ride-along mark — ✅ implemented locally 2026-11-17 (not committed)

#### Decisions (user, 2026-11-17)
- **The phone counts the 4 goals** (lesson, exam, practice, flashcards). When all 4 are done it flips that day's mark 0 → 1: `{n, day, kind:'day'}`.
- **The mark rides along** with the next request the app sends anyway (start-up, lesson done, exam finish, the 12-hour sync); never a request of its own.
- **It updates the same row** (no new row): `streak` and `last_active_day` for the mark's own day — a mark that arrives the next morning still counts for its day (same grace-day rule). Inside the carrying request's own UPDATE: 1 statement, 1 examined, 0 returned.
- **The server no longer tracks the 4 goals:** `today_bits` and `today_day` dropped (backup first). Lesson / exam writes don't touch them; practices ride along only for their XP; the flashcards note (10.29) is removed.
- **Accepted:** goals split across two devices don't add up; an app deleted while a mark is waiting loses that day.

#### Before (2026-11-17, from 10.29)
Lesson done / exam finish: 1 request · 1 statement · 1 examined · 0 returned, each also writing `today_bits` + `today_day`; flashcards: a goal note riding along once a day.

#### Plan
1. Server: `progressWrite` streak = one `streakAssignmentsWhen(mark.day, n > practice_seq AND last_active_day < day)` per day mark (in day order, same statement); bits removed from every write; "today done" read as `last_active_day = today`.
2. Start-up applies waiting marks before it reads the row (its reply shows the new streak; same 1 statement as before, just earlier).
3. Phone: `StudyDays.done` adds the day mark the first time a day reaches all 4; flashcards note removed.
4. Schema step 'drop today bits' (version bump), backup first.

#### Changes (2026-11-17)
- **Server:**
  - `progressWrite`: one `streakAssignmentsWhen(mark.day, n > practice_seq AND last_active_day < day)` per `kind:'day'` mark, oldest first, inside the carrying write; the goal bits are gone from lesson done, exam finish (both paths), flashcards and the old practice route.
  - "Today done" is read as `last_active_day = today` (Study Hub, progress reply: `todayBits` 15 or 0).
  - The start-up applies waiting marks before reading the row.
  - Schema step 'drop today bits' (version 2026-11-17.2); backup `~/Desktop/lms-backups/student_study_summary-before-10.30-*.sql`.
- **Phone:** `StudyDays.done` adds `PracticeQueue.addDayDone(day)` the first time a day reaches all 4; the 10.29 flashcards note is removed (flashcards are phone-only again).
- **Checked (test student):**
  - lesson done + day mark → streak 3 → 4, `last_active_day` 2026-11-17, `X-Practices-Applied: 10`;
  - the same mark again → no change;
  - an older day's mark → no streak change (the number is still recorded);
  - when the lesson was already done, the mark is applied on its own (2 statements in that case only).

### 10.31 Question of the Day on the phone — fetched once, then picked from saved sets — ✅ implemented locally 2026-11-17 (not committed)

#### Decisions (user, 2026-11-17)
- **Answerable on the card:** the 5 options are shown; a tap marks right / wrong at once. **No explanation** — only the question and its 5 answers.
- **The question stays on the phone until it is answered**, however many days pass (no new fetch while it is unanswered).
- **After it is answered, the next day's question is picked on the phone** from the Q-Bank practice sets already saved there (`quiz_<id>.json`), skipping recently used questions, wrong-answered ones first, only sets the student can open. 0 requests.
- **Only when the phone has no saved sets** does it ask the server — once — for one question + its 5 options (one indexed join).
- **Accepted:** limited choice (only sets the student already opened); an unanswered question can sit for a long time.
- The question is no longer sent in the Study Hub lower-cards request (`/student/dashboard/more`) for the app.

#### Aims
- Question of the Day: 0 requests and 0 statements on most days.
- When the server is asked: 1 request · 1 statement · ~6 rows examined · 5 returned (question row by index + its 5 options by `question_id`).
- The lower-cards request loses the question statements.

#### Before (2026-11-17, measured on the iPad, monitor, first call of the day after a restart)
`GET /student/dashboard/more`: 1 request · 4 statements · 7 examined · 3 returned · 670 B.
- summary row 1 · 1; smart note title 0 · 0;
- question part: `MIN/MAX(id)` range 0 · 1 + question with options packed as JSON 6 · 1.
- The card showed only the question text; the 5 options and the right answer were downloaded and never shown; "Answer in Q-Bank" opened the Q-Bank list.

#### Plan
1. **Server:** new `GET /student/question-of-day` (app): one statement — the question picked by index (`idx_questions_status_type_id`, `id >= ?`, `LIMIT 1`) joined to `question_options` by `question_id` (`idx_question_options_question_label`), 5 rows. Skips a question without exactly 5 options / 1 right (tries the next id). ID range kept per content version (0 statements after the first). Course / subject names from the names cache (0).
2. **Server:** `/student/dashboard/more` sends no question for the app (`noQuestion`).
3. **Phone:** `QuestionOfDayStore` (`qod_<uid>.json`): `{day, question, answered, picked, recent[]}`; rules above; picks from saved practice sets, else one request.
4. **Phone:** answerable card (options, right / wrong colours like practice mode); the answer saved on the phone.
5. Measure after (same steps).

- **Added (user, during build):** a wrong tap marks only that option and says "try again" — the right answer is never shown until the student finds it.

#### Changes (2026-11-17)
- **Server:** `GET /student/dashboard/question` (route `dashboard/student/question`, main.ts rewrite). One statement: derived table `questions FORCE INDEX (idx_questions_status_type_id) … id >= ? LIMIT 1` LEFT JOIN `question_options FORCE INDEX (idx_question_options_question_label)` by `question_id`; no ORDER BY (options sorted in code — an ORDER BY made a temporary table). EXPLAIN: range on the questions index, ref on the options index. `/student/dashboard/more` sends no question to the app.
- **Phone:** `features/dashboard/question_of_day.dart` (`QuestionOfDayStore`, `qod_<uid>.json`: question, right pick, wrong tries, answered day, last 200 ids); `pickSavedPracticeQuestion` in quizzes_repository (saved `quiz_<id>.json` the student can open and that are current, lowest best mark first, 5 options / 1 right, recent ids skipped); `ContentFiles.names`. Answerable card with "try again".
- Also in this pass: "Cards are due" card uses the flat tinted square + flashcards icon of the Study page (no gradient glow).

#### After (2026-11-17, iPad, monitor)
| Case | Requests | Statements | Examined | Returned | Bytes |
|---|---|---|---|---|---|
| Lower cards `/more` (app) | 0 (was 1) | 0 (was 4) | 0 (was 7) | 0 (was 3) | 0 (was 670) — the QOD card was its last reader; nothing on the phone asks for it now |
| QOD, nothing saved on the phone (first time) | 1 | 1 (+1 ID range once per server start) | 7 | 5 | 750 |
| QOD unanswered, app reopened | 0 | 0 | 0 | 0 | 0 |
| QOD answered, reopened same day | 0 | 0 | 0 | 0 | 0 |
| QOD next day, saved sets on phone | 0 | 0 | 0 | 0 | 0 (picked "GIT Revision 3") |

### 10.32 Lessons on the phone — same lesson as the website, tables always fit — ✅ implemented locally 2026-11-17 (not committed)

#### Decisions (user, 2026-11-17)
- **Server stops reshaping lessons for the app:** no tables turned into cards / flipped, no long-bullet splitting, no "(continued)" cards. The phone gets the same lesson as the website. The `**` / `==` marker scrub on plain-text fields stays.
- **Tables always fit the screen (Style c, mock approved):** columns sized by their text; text wraps and rows grow; text shrinks only if the longest words still don't fit, never below 11.5 px; then only words over 8 letters may continue on the next line (short ones like SVR / JVP never split). No sideways swipe. Pinch-zoom stays.
- **Video button hidden** when the lesson has no video.
- iPhone first (the iPad reading-width step is left out).
- Server and app ship together (the store app still draws equal-width columns).

#### Before (2026-11-17, all 1,479 lessons, server code timed in node)
- Reshape per lesson open: 0.044 ms; replies average 5.5 KB (stored 5.4 KB).
- 2,329 "(continued)" cards across the lessons; wide tables (4+ columns) sent as one card per row.
- App tables: equal-width columns, 9.5–10.5 px text when wide.

#### Plan
1. Server: `calmTextForPhone(reshapeTablesForPhone(…))` → `scrubPlainTextFieldsForPhone(…)` in both lesson-open paths.
2. App `_tableBlock`: always-fit layout (rules above).
3. App: `_VideoButton` not shown without a video URL.
4. Check on the iPhone simulator (tables, long sections, a lesson without video); after numbers.

#### Changes (2026-11-17)
- **Server:** both app lesson-open paths call only `scrubPlainTextFieldsForPhone` (reshape + text calming removed for the app; website unchanged).
- **App `_tableBlock`:** real text widths (TextPainter): full width when everything fits on one line; else each column ≥ its longest word, spare room shared by text amount; text 13 (12.5 for 4+ columns) → shrinks to 11.5, then 10.5 only for very dense tables; words that still don't fit are cut into pieces with a hyphen ("compr-" / "essing"), never a piece under 3 letters, decided with exact bold width so a short word that fits is never cut.
- **App:** Video button only when the lesson has a video. Saved lessons carry a format number (`f: 2`); copies saved before (reshaped) are downloaded once more.
- Built for the simulator with a test-only stand-in for the PDF library (pdfium download blocked by the full disk); pubspec restored after each build.

#### After (2026-11-17)
| | Before | After |
|---|---|---|
| Server work per lesson open (CPU) | 0.044 ms reshape | 0.005 ms scrub |
| Reply size (average of 1,479 lessons) | 5.5 KB | 5.3 KB |
| "(continued)" cards | 2,329 | 0 |
| Wide tables (4+ columns) | one card per row | a real grid that fits the screen |
| Database work | 1 row by key | 1 row by key (unchanged) |

Checked on the iPhone 17 Pro simulator: Thoracic trauma (5-column paragraph table, 2-column table), no Video button on a lesson without video.


### 10.33 Dense lesson tables → one card per disease — ✅ applied locally 2026-11-17 (not on live)

#### Decisions (user, 2026-11-17)
- Only the **dense** tables change: 4+ columns with cells averaging over 60 characters — **9 tables in 9 lessons** of 1,877 tables. The 9 wide-but-short tables (hepatitis, IV fluids, burn depth …) stay grids.
- Same data, word for word: each disease / item becomes a card; each attribute a label line ("Pathology:") with the cell's own lines under it as "→" lines; highlights and bold kept. The table's numbered heading stays as a heading card; the item cards are `unnumbered`.
- Changes the stored lesson, so the website shows the cards too.

#### Changes
- `~/Downloads/dense-tables-to-cards.sql`: 9 `UPDATE lessons … WHERE id = … AND MD5(note_data) = '<before>'` (a lesson edited since is skipped), `updated_at = NOW()` so phones re-download, content version +1 only if a lesson changed. No DELETE / DROP / ALTER.
- Backup: `~/Desktop/lms-backups/lessons-before-10.33-*.sql` (REPLACE rows for the 9 lessons).
- Checked: run twice → second run changes nothing; applied to a scratch copy of the original 9 lessons → identical result; word check: no text lost (only first-column titles like "Menopausal Status", now the card headings' role).
- Lessons: 60 Thoracic trauma — approach (4 cards), 84 Upper limb fractures (3), 88 Ulnar/median/radial nerve lesions (3), 97 Primary malignant bone tumours (3), 299 Treatment (2), 1148 Cardiomyopathies (3), 64 Primary amenorrhoea (4), 159 Contraception (9), 479 Dysmenorrhoea (2).
- Seen on the iPhone 17 Pro simulator (Thoracic trauma). Website not checked yet.
- Heading-only section (the table's title): shown as its title pill, centred, with no card box — app `_SectionCard` and website `NoteCanvas.jsx` `SectionCard` (view mode only; editing keeps the card, corner icon hidden). Seen on the iPhone.

### 10.34 Smaller lesson replies for the app — ✅ implemented locally 2026-11-17 (not committed)

#### Decisions (user, 2026-11-17)
- The app's lesson reply leaves out empty fields (`""`, `[]`, `null` on objects) and `visual_style`. **No SQL / no stored change**: the website reply and the database stay exactly as they are (the website reads `visual_style.colors` for its highlight colours — so a database cleanup was rejected).
- Highlights are `==…==` inside text and are untouched; values inside lists stay in place (table cells keep their columns).

#### Before → after (all 1,479 lessons; lesson 60 opened on the iPhone)
| | Before | After |
|---|---|---|
| Average app reply | 5.28 KB (2.51 KB gzipped) | 4.75 KB (2.37 KB gzipped) |
| Lesson 60 on the wire | 4,753 B gzipped | 4,607 B (monitor: 4,648 B incl. headers) |
| Server time added per open | — | 0.036 ms |
| Database | 1 statement · 1 examined · 1 returned | same |

#### Changes
- `compactForPhone` in `mobile-text-layout.ts`, applied after `scrubPlainTextFieldsForPhone` in both app lesson-open paths.
- Checked: the app's own parser (`LessonDoc.fromApi`) gives identical results for all 1,479 lessons with and without the trimmed fields (temporary test, removed); only `span` differs and the app never uses it. Thoracic trauma downloaded fresh and drawn correctly on the iPhone.

### 10.35 Subscription page, flashcard history import, lesson images — ✅ implemented locally 2026-11-17 (not committed)

#### Decisions (user, 2026-11-17)
- Optimise `GET /subscriptions/me` and `GET /student/flashcards/reviews/export`; find why lesson images stay blank in the app. Server code + one app fix; no SQL.

#### Before (live monitor, iPhone sign-in right after a server restart)
| Request | Statements | Examined | Returned |
|---|---|---|---|
| `/subscriptions/me` cold (first after restart) | 12 | 367 | 230 |
| `/subscriptions/me` warm (plans + payment settings already remembered) | 5 | 14 | 5 |
| `/flashcards/reviews/export` (first after a content change) | 2 | 162 | 161 |

Plans, features and plan-features were loaded **twice** on a cold start (two cache keys for the same data). Current subscription and history read the same rows twice. The export read every approved card in the system (139) to find the lessons of the student's 23.

Lesson images: the server sent them (200) and the app saved them, but the picture stayed blank — `savedImageFile` ended with `.whenComplete(() => _inFlight.remove(url))`; `remove` returns that very future, so it waited on itself forever (the same trap saved_first.dart documents).

#### Changes
- **Plans:** `findActive()` filters the shared `public.allPlans` remembered list (one load per hour / plan save instead of two).
- **Subscriptions:** one statement (`… ORDER BY created_at DESC LIMIT 13`) gives history and current; current picked in code with the old order (status rank, end date, id). Checked on all 114 students: identical for the 111 with ≤ 12 rows; the 3 with more use the old query as a fallback.
- **Flashcards:** card → lesson only for the student's own cards: `FORCE INDEX (PRIMARY) WHERE id IN (…)` (the optimizer otherwise scanned all 139). The shared all-cards map is removed.
- **App:** `saved_network_image.dart` — `whenComplete(() { _inFlight.remove(url); })`; same form in `osce_media_cache.dart` (that one did not hang, changed for consistency).

#### After
| Request | Statements | Examined | Returned |
|---|---|---|---|
| `/subscriptions/me` cold | 8 | ~226 (plans/features/settings once per hour) | — |
| `/subscriptions/me` warm | **4** | **10** | **4** |
| `/flashcards/reviews/export` | 2 | **46** (23 + 23) | 46 |

Images: Menstrual cycle physiology shows its HPO-axis picture on the simulator. 7 of 130 lesson images (incl. Thoracic trauma's) exist only on the live server, so they stay blank against the local server.

### 10.36 Flashcard progress fully on the phone — ✅ implemented locally 2026-11-17 (not committed)

#### Decisions (user, 2026-11-17)
- Flashcard progress is **phone-only**. The one-time history import (`GET /student/flashcards/reviews/export`) is removed from the app.
- Found while checking: since 10.23 the app never uploads ratings, so `lesson_flashcard_reviews` only held pre-10.23 history — the import restored stale data. Accepted: progress is lost on reinstall / new phone (as it already was for anything recent).
- Card **content** still comes from the server once per lesson (`/student/flashcards/cards`, served from files, 0 card-table reads); edits are noticed through the catalogue's per-lesson cards stamp. Progress is kept by card id: an edited card keeps its progress, a new card is New, a removed card is ignored.
- The server endpoint, the `lesson_flashcard_reviews` table and the `flash_history` flag are left in place (older app builds; never delete).

#### Before → after (fresh install, open Flashcards)
| | Before | After |
|---|---|---|
| History import | 1 request · 2 statements · 46 examined | 0 |
| Card content (first study of a lesson) | 1 request · 8.5 KB · 0 card reads | same |

### 10.37 Database clean-up: 7 unused tables dropped — ✅ applied locally 2026-11-17 (not on live)

#### Decisions (user, 2026-11-17)
- Keep the database clean: drop `lesson_flashcard_reviews` (108 rows, 16 students, frozen since 10.23 — progress is phone-only, 10.36).
- Audit every table for unused ones; report them before deleting.

#### Changes
- Backup: `~/Desktop/lms-backups/lesson_flashcard_reviews-before-10.37-*.sql`.
- Server (`flashcards.service.ts`): no code reads or writes the table any more. Endpoints kept for older app builds / the website answer as if nothing was reviewed: history export → empty; review save → nothing stored (ride-along progress still applied); undo → nothing to undo; card flags → not stored; stats → zeros; decks / queue → all cards "new".
- Schema: step 'drop flashcard reviews table' (`DROP TABLE IF EXISTS`), `CRITICAL_SCHEMA_VERSION` 2026-11-17.5; the CREATE and the `flash_history` back-fill removed. Applied locally on restart (table gone).
- Security e2e passes.
- Live: dropped on the first restart after the backend is deployed (back up live first).

#### Audit (62 tables; rows · code references outside the schema file)
Unused by any app / website / server code: `announcement_reads` (325, last 2026-10-15 — notices moved to the JSON feed), `notification_dismissals` (414), `question_review_items` (0), `lesson_doubts` (0), `practice_sessions` (0), `practice_answers` (0). `schema_migrations` (0) is used by `scripts/migrate.mjs` — keep. Every other table is used.
- **Dropped too (user OK, 2026-11-17):** the 6 unused tables. Backup `~/Desktop/lms-backups/unused-tables-before-10.37-*.sql`; step 'drop unused tables' (practice_answers before practice_sessions — foreign key), `CRITICAL_SCHEMA_VERSION` 2026-11-17.7; their CREATE / index code removed. Local database 62 → 55 tables. Security e2e passes.
- **Audit tables (user: delete if not needed):** `content_audit_events` (19,039 rows, 111 MB — a before/after copy on every admin save) and `admin_audit_events` (177) were written but never read → the 14 inserts removed from the services, tables backed up (`~/Desktop/lms-backups/audit-tables-before-10.37-*.sql.gz`) and dropped (schema 2026-11-17.8). Every admin save now does one statement less. **Kept:** `subscription_audit_events` (shown on the admin Subscriptions page; payment disputes) and `account_deletion_audit` (proof of deletion requests; privacy policy). Local database 55 → 53 tables, 201.8 MB in all.

### 10.38 Content versions: keep the newest 2 per item — superseded by 10.39 (tables dropped)

#### Decisions (user, 2026-11-17)
- `content_versions` gained a full copy of an item on **every** admin save and never shrank; only the latest version number is read (exam attempts note which question version was answered). Keep the newest 3 copies per item → changed to **2** (user, same day).

#### Changes
- Backup: `~/Desktop/lms-backups/content_versions-before-10.38-*.sql.gz`.
- The 7 save paths (lessons, questions, quizzes, topics, subtopics, courses, papers) delete copies older than the newest 2 right after adding one (by the unique (type, id, version) index).
- Schema step 'content versions keep 2' (one-time cleanup + OPTIMIZE TABLE), `CRITICAL_SCHEMA_VERSION` 2026-11-17.10.

#### Before → after (local)
| | Before | After |
|---|---|---|
| Rows | 24,207 | 21,938 |
| Copies per item | up to 40 (lessons), 23 (questions) | at most 2 |
| Size | 83.6 MB | 81.6 MB |
| Growth | +1 full copy per save, forever | stays ≤ 2 per item |

Where the 24,207 came from: version 1 is written when an item is **created** (bulk question imports made most of them), +1 per edit. 6,618 rows belong to items since deleted (5,791 questions, 426 quizzes, …). Lessons imported by SQL have none. Most items were saved once, so the size barely falls; the gain is that it stops growing.
- **Copies of deleted items removed (user OK):** step 'content history of deleted items' (schema 2026-11-17.11) deletes `content_versions` and `content_workflow_states` rows whose item no longer exists; `forgetContentHistory()` (common/utils/content-history.ts) now runs in every delete path (questions single + bulk, quizzes single + bulk + their questions, topics + their subtopics, subtopics, courses, papers). Backup of the workflow table: `content_workflow_states-before-10.38-*.sql.gz`.
- Result: content_versions 24,207 → **15,443** rows, 83.6 → **58.3 MB**; content_workflow_states 20,462 → **14,258** rows (2.0 MB). Note: `content_workflow_states` is written but **never read** by anything. Security e2e passes.

### 10.39 Content history tables dropped — ✅ applied locally 2026-11-17 (not on live)

#### Decisions (user, 2026-11-17)
- Drop `content_versions` and `content_workflow_states`: nothing reads them. The exam code's version lookup (`loadQuestionContentVersions`) was never called; the admin "list versions" / "rollback" endpoints exist but the admin website never calls them. Accepted: no rollback feature.

#### Changes
- Backup: `~/Desktop/lms-backups/content-history-before-drop-10.39-*.sql.gz`.
- 7 services (courses, lessons, papers, questions, quizzes, topics, subtopics): `recordContentVersion` / `setWorkflowState` are no-ops; `listVersions` returns []; `rollback` answers "Version history is not kept any more." `forgetContentHistory` is a no-op. The admin question detail returns `content_version` 1. The unused `loadQuestionContentVersions` is removed.
- Schema: both tables added to 'drop unused tables'; their CREATE / index code and the two 10.38 clean-up steps removed; `CRITICAL_SCHEMA_VERSION` 2026-11-17.12.
- Every admin save now does 3–4 statements fewer (version number read, copy insert, prune, workflow upsert).

#### Result (local)
51 tables, 115.9 MB in all (today: 62 tables before the clean-up; −111 MB audit, −60 MB history). Security e2e passes.

### 10.40 Database clean-up round 2 — ✅ applied locally 2026-11-17 (not on live)

#### Audit (all 51 tables: rows, size, reads / writes / deletes in the server)
- **Unused:** `announcements` (1,018 rows) — announcements live in the JSON notices / popups files; nothing reads or writes the table.
- **Dead rows:** `study_planner_tasks` — 453 old per-item rows (folded into each student's one `plan` row in 10.12, never read); only the 14 plan rows are used.
- **Growing:** `exam_sessions` — +1 row per exam start, never removed; only the latest per student + exam is read (103 older sessions).
- Fine: `student_answers` (removed with old attempts), content, payments / Apple / subscription history, `account_deletion_audit`, empty feature tables. Check on live only: `native_push_tokens` (locally all fail because pushes are blocked on this Mac); `lessons.raw_text` kept (admin editor reads it; lesson content is never deleted).

#### Changes (user OK)
- Backup: `~/Desktop/lms-backups/announcements-planner-exam_sessions-before-10.40-*.sql.gz`.
- `announcements` added to 'drop unused tables'; its CREATE / index code removed.
- Step 'planner old rows and old exam sessions' — runs **after** 'planner one row' (the fold) and deletes old planner rows only for students who have a plan row; deletes exam sessions older than the latest per student + exam.
- Starting an exam session now deletes that student's older sessions of the same exam (1 indexed statement).
- `CRITICAL_SCHEMA_VERSION` 2026-11-17.13.

#### Result (local)
`announcements` gone · planner 467 → 14 rows · exam sessions 101, one per student + exam · 50 tables, 115.7 MB. Security e2e passes.

### 10.41 Smart notes and the account-deletion record removed — ✅ applied locally 2026-11-17 (not on live)

#### Decisions (user, 2026-11-17)
- Drop `smart_notes` (old Smart Notes feature: 6 rows from one account, last change 20 April; no app or website page uses it) and `account_deletion_audit` (3 rows; the user chose to keep no server record of deleted accounts).

#### Changes
- Backup: `~/Desktop/lms-backups/smart_notes-account_deletion_audit-before-10.41-*.sql.gz`.
- Smart notes module removed (controller, service, DTOs, app module entry, route names in main.ts / admin-read-cache); `smart-notes-image-api.service.ts` kept — OSCE uses it for images. The Study Hub lower cards no longer read a smart-note title.
- Account deletion: the audit insert and its email-hash helper removed (the account is still soft-deleted as before).
- Security e2e: the smart-note ownership check removed with the endpoint; suite passes.
- Schema: both in 'drop unused tables'; their CREATE / index code removed; `CRITICAL_SCHEMA_VERSION` 2026-11-17.14.
- Note: the privacy policy still says audit records may be kept — still true for subscription history; reword if wanted.

#### Result (local)
48 tables, 115.5 MB.

### 10.42 lesson_annotations, web push, keyword map, lessons.lesson_content removed — ✅ applied locally 2026-11-17 (not on live)

#### Decisions (user, 2026-11-17 — no backup wanted)
- `lesson_annotations` (7 rows, April; no page calls it), `push_subscriptions` (1 row; browser web push was already switched off), `question_keyword_map` (31,285 rows; written on every question save, never read — keywords live in `questions.keywords_text`), `lessons.lesson_content` (old lesson system's text, 1.9 MB; never read).
- Kept: `lessons.raw_text` (source for the admin "rewrite card"), `question_keywords` (admin suggestions), `papers` (admin import / builder use it; empty), `question_quizzes` (core).

#### Changes
- Lessons: annotation routes, service methods and DTOs removed; inserts / updates no longer write `lesson_content`, reads return NULL.
- Push: settings / admin status / unsubscribe no longer read web-push rows (phone push only).
- Questions / quizzes: keyword saves only add names to `question_keywords`; the per-question map writes and deletes are gone (question saves several statements lighter).
- Schema: the three tables in 'drop unused tables'; step 'drop lessons.lesson_content'; CREATE / index / back-fill code removed; `CRITICAL_SCHEMA_VERSION` 2026-11-17.15.
- Security e2e: the annotation-ownership test and the web-push settings checks removed / updated; passes.

#### Result (local)
45 tables, 105.4 MB.

### 10.43 Q-Bank in 3 tables (options + theory recap inside `questions`) + student Report button — ✅ BUILT locally 2026-11-17 (Report button: later)

#### Decisions (user, 2026-11-17)
- Move each question's 5 options and its theory recap **into the question row**; drop `question_options` and `question_theory_recaps` afterwards. **No leftovers**: every read and write switched, old tables and their code removed.
- Keep `quizzes` (assessments) and `question_quizzes` (one question can be in several assessments — 12,921 links for 11,686 questions).
- Add a **Report** button on the student side (`question_reports` + the admin Question Reports page already exist; only the student button is missing).
- Test by importing AI-generated question sets (the `~/Desktop/qbank` JSON sets) and checking every column end to end.

#### Facts (local, 2026-11-17)
- `question_options` 65,455 rows (ids up to 99,598): label A–E, text, is_correct, why_incorrect. Every question has options; no orphans.
- `question_theory_recaps` 12,422 rows, exactly 1 per question that has one: concept, hierarchy (course / subject / topic / lesson), etiology, pathophysiology, clinical_features, investigations, treatment, key_points, mnemonic, generated_by, reviewed_status.
- **Option ids are referenced elsewhere** and must not change: `student_answers.option_id` (past exam answers, review), the phone's saved practice sets (`quiz_<id>.json`) and the server's per-quiz files.

#### Target shape
`questions` gains:
- `options_json` — `[{"id":64331,"label":"A","text":"…","correct":1,"why":"…"}, …]` (A–E order). Existing options **keep their id**. New options get a stable id **10,000,000 + question_id × 10 + label index (A=0 … E=4)**: unique, never reused, and the same label keeps the same id across edits (so old answers still match).
- `recap_json` — the recap fields above as one object (NULL when there is none).

#### Steps
1. **Before numbers** (monitor + node timing): admin save of one question, bulk import of a 20-question set, open a practice set (first download), exam start/submit/review, Question of the Day, admin question list / detail / export.
2. **Schema step (one time, idempotent):** add the 2 columns; fill them from the old tables in one pass per question; **verify** every question — option count, labels, correct option, every text, every recap field — equals the old rows. Any mismatch → stop, change nothing.
3. **Switch every reader** (found by search, nothing left):
   - questions: `findAll`, `findOne`, `loadQuestionsForExport`, `loadOptionsForQuestionIds`;
   - quiz-attempts: `loadQuestionsForQuizFromDb` (practice, exam, review);
   - dashboard: `computeAppQuestion` (Question of the Day), `buildStudentAdaptivePlan`, `computeRandomDashboardQuestion`;
   - workspace: `getAdminReports` (correctness via `student_answers` → the option's `correct` in JSON);
   - theory-recap: `getByQuestionId`, `generateForQuestion`.
4. **Switch every writer:** questions `replaceOptions` (create / edit / bulk import / quiz-set import), theory-recap `upsert` / `delete`, bulk deletes (questions, quizzes) — the JSON goes with the row.
5. **Drop** `question_options` and `question_theory_recaps` (schema step, backup first) and remove their CREATE / index code; `CRITICAL_SCHEMA_VERSION` bump.
6. **Report button (student):** on the question screen (practice after the answer is shown, exam review), a small "Report" → reason list + optional note → `POST /api/student/question-reports` (exists). App and website. One open report per student per question.
7. **Tests:** import several AI-generated sets (different courses) through the admin quiz-set importer; check every column saved (question, 5 options with correct + why, approach, explanation, image, keywords, recap); open them as practice, exam, review, Question of the Day; admin edit / bulk edit / export; delete. Security e2e + unit tests. Phone: practice set + review on the simulator.
8. **After numbers** (same as step 1), OPTIMIZE change log, memory.

#### Answers (user, 2026-11-17)
- Report button: **later** (kept in memory); reasons will be the standard 5.
- Test imports: in a **scratch copy database**, deleted afterwards.
- No extra backup: the full export `~/Downloads/xyndrome_lms-4.sql` (11 Nov) holds both tables.

#### Changes (built 2026-11-17, local, not committed)
- `common/utils/question-content.ts`: `optionsOf` / `optionsJsonFor` / `recapOf` + SQL pieces (`sqlOptionCount`, `sqlCorrectCount`, `sqlWhyMissing`, `sqlOptionIsWrong`). The JSON keeps the old column names (`option_label`, `option_text`, `is_correct`, `why_incorrect`), so readers use the rows as before.
- Schema step `questions hold options and recap` (`CRITICAL_SCHEMA_VERSION` 2026-11-17.17): adds both columns, copies in batches of 500, reads everything back and compares field by field (throws and drops nothing on any mismatch), then drops the foreign key `student_answers.fk_student_answers_option` (the column stays) and both old tables.
- Readers/writers switched: questions (list filters, detail, options load, save = 1 SELECT + 1 UPDATE, bulk delete), quizzes bulk delete, theory-recap (read / upsert / generate / delete), quiz-attempts (practice, exam, review), dashboard (Question of the Day, app + website), workspace Reports (wrong answers via `JSON_CONTAINS`).
- Tests updated to the JSON columns: security e2e, access-control regression (also: no `content_audit_events` write since 10.37), quiz bulk-delete fake DB (`query()` for stored counts).

#### Results
- Local move: 13,103 questions · 65,515 options · 12,960 recaps copied and verified, 0 mismatches; 43 tables.
- Scratch copy (`lms_scratch`, deleted after): 6 AI sets imported through the quiz-set importer's own code (Medicine ×2, Surgery, Paediatrics, ObsGyn, Psychiatry; SBA + True/False): **125/125 questions, every column equal to the JSON** (stem, 5 options, correct, why-incorrect / statement explanations, explanation, approach, highlights, keywords, recap fields, new option ids = 10,000,000 + id×10 + label).
- Practice, exam (13/25 expected → 13/25 scored), app review, Question of the Day (old option ids), admin detail, edit (same label keeps its id), recap update/delete, workbook export, "missing" filters, single delete, assessment + questions delete: all correct. All 13,228 SBAs/True-False have 5 options, each SBA exactly 1 correct, 0 missing reasons. Reports: 366 wrong answers by SQL = 366 by script; all 815 past answers still find their option.
- Practice set read (quiz 52, 20 questions): **159 → 40 rows examined**, 20 returned. Admin save of one question: 1 DELETE + 5 INSERTs → **1 SELECT + 1 UPDATE**.
- Suites: security e2e, all unit/regression suites, quiz bulk-delete — pass.

#### Two older bugs found and fixed (user: "Yes, fix both", 2026-11-17)
- `GET /admin/questions/export` (old route) always failed: it didn't pass `missing`, so the response object landed in the wrong place. Now passed through → 200 CSV (96 rows = 96 questions without a recap in course 10, on the scratch copy).
- Deleting questions (single and bulk) left the assessment's stored `total_questions` / `total_marks` too high. `bumpQuizStampsForDeletedQuestions` (quiz-stamp.ts) now raises the stamp **and** stores the remaining link count in the same single statement, replacing the plain stamp bump (no extra statement). Checked: single delete 20 → 19, bulk 2 of 20 → 18, an unlinked question changes no quiz, and afterwards every quiz's total equals its links.

#### Live deploy notes
- The first boot runs the move + drops (backup first). The phone app needs no update (same reply shape, same option ids).

### 10.44 Drop the old exam tables (`student_answers`, `quiz_attempts`, `exam_sessions`) + `study_bookmarks`, `schema_migrations` — ✅ BUILT locally 2026-11-17

#### Decisions (user, 2026-11-17)
- "remove the database that new apps wont use", "remove them fully": no real users yet, all rows are test data.
- Admin parts that showed past exams **switch to the students' recent results** (the 5 per student on `student_study_summary.recent_results`, filled by every new app/website exam); old routes and code dropped.

#### Aims
- No table, route or code is left that the new app and website don't use.
- Admin keeps its exam statistics, now from the same data new exams write.

#### Before (local, 2026-11-17, by trace in the slow log)
| Request | Statements | Rows examined | Rows returned |
|---|---|---|---|
| Admin Reports (cold, all) | 14 | 7,429 | 3,036 |
| Admin user detail (972) | 6 | 52 | 16 |
| Assessment delete preview (1 quiz) | 10 | 1,374 | 1,365 |
- Tables: `student_answers` 1,013 rows, `quiz_attempts` 34, `exam_sessions` 101, `study_bookmarks` 26, `schema_migrations` 0. Last writes 14–16 Nov (tests).

#### Plan
1. **Readers → recent results:**
   - Reports: attempts / average / pass rate, quiz performance, activity per day, Hard questions (answers in each result checked against the question's `options_json`), last activity (summary `last_active_day`). Date and course filters apply to each result's day and quiz.
   - Admin user detail: recent results from the student's row; the bookmark count goes (bookmarks are on the device since 10.25).
   - Student dashboard "recent attempts" (website, non-lite): from the student's recent results.
   - Assessment delete preview: students holding a result for those quizzes.
   - Health metrics: `quiz_attempts` count → number of stored results.
2. **Remove:** routes `exam/:id/submit`, `exam/:id/save`, `quiz/:id?mode=exam`, `result/:attemptId`, `review/:attemptId`, `review/:attemptId/complete`; their service code (exam sessions, attempt insert/prune, expired-session auto-submit); the `study-bookmarks` module; `student_answers` deletes in question/assessment deletes; their CREATE/index code.
3. **Schema step:** drop foreign keys pointing at these tables, then the 5 tables; `CRITICAL_SCHEMA_VERSION` bump.
4. **Tests + after numbers** (same 3 requests), pages checked in the browser, change log, memory.

#### Changes (local, not committed)
- `common/utils/recent-results.ts`: `parseRecentResults`, `loadRecentResults` (all students, or one), `loadQuizInfo`, `mostMissedQuestions` (answers checked against `options_json`; SBA wrong pick, True/False any statement wrong).
- Reports (`workspace.service`): attempts / average / pass rate, quiz performance, activity per day and Hardest questions from the recent results; last activity = summary `last_active_day`.
- Admin user detail: recent results (quiz titles by id); bookmark count and the website's Bookmarks panel removed; "Quiz attempts" → "Recent results".
- Website dashboard recent attempts, assessment delete preview (results held for those quizzes, read only in the preview), health metric (stored results).
- Removed: routes `exam/:id/submit`, `exam/:id/save`, `quiz/:id?mode=exam` (now 400 "Start this exam from the exam screen"), `result/:attemptId`, `review/:attemptId`, `review/:attemptId/complete`; the whole `/results` and `/study-bookmarks` modules; exam-session / attempt-insert / prune / expired-session code and their DTOs; `student_answers` deletes; the tables' CREATE / column / index code; bookmarks in the old `/student/boot` reply.
- Schema step `drop old exam, bookmark and migration tables` (`CRITICAL_SCHEMA_VERSION` 2026-11-17.18): foreign keys pointing at them first, then the 5 tables. **38 tables.**
- Tests: old-route checks now assert 404 and no table access; staff exam finish → 401; exam deadline tested through the signed exam token; bulk-delete preview counts held results.

#### After (local, same requests)
| Request | Statements | Rows examined | Rows returned |
|---|---|---|---|
| Admin Reports (cold, all) | 14 → **13** | 7,429 → **5,138** | 3,036 → 3,044 |
| Admin user detail (972) | 6 → 6 | 52 → **20** | 16 → 11 |
| Assessment delete preview (1 quiz) | 10 → 10 | 1,374 → 1,376 | 1,365 → 1,366 |
- Checked: Reports shows 8 results, avg 15 %, pass 13 %, activity on 3 days, 7 quizzes, hardest question #2742 (answered E, wrong — verified against its options); user 972 shows its 5 recent results; old routes answer 404. Security e2e, all unit suites and bulk-delete pass.
- Note: Reports reads every student's summary row (5 results each); cached 60 s per filter set.

### 10.45 Admin Questions list: pages of 15 — ✅ BUILT locally 2026-11-17

#### Decisions (user, 2026-11-17)
- "make the pagination 15 and only 15-15-15": **pages of 15** with Previous / Next (only 15 rows on screen), Questions page only.

#### Before → after (local)
| Request | Rows examined | Rows returned |
|---|---|---|
| Open the list (page 1) | 50 | 50 |
| Each next page | 50 more ("Load more", rows piled up) | **16** (15 + 1 to know a Next page exists) |
- The folder lists on open are unchanged (4 courses + 47 subjects + papers, cached).
- **First page load, measured by trace (browser storage cleared, 2026-11-17):** 5 requests · 4 statements · 19 rows examined · 19 returned · 3.0 KB. That is `app/start` (1 sign-in read), `questions/meta?scope=folders` (1 sign-in read; folder lists from the server's memory; on a just-started server +3 statements · 51 rows), `questions?limit=16` (sign-in read + 16 rows), plus `availability` and the popup file (0 statements). One sign-in read per admin request remains.

#### Changes
- `QuestionsPage.jsx`: `QUESTION_PAGE_SIZE` 50 → 15; keyset pages (`after` = last id of the page before, cursors kept per page); Previous / Page N / Next replace "Load more"; reloads after a save stay on the current page, new filters go to page 1, a page emptied by deletes falls back one page. No server change (the list already takes `limit` + `after`).
- Checked in the browser: pages 1–3 are 15 rows each, in order with no repeats (#19164–19150, 19149–19135, 19134–19120); Previous returns to page 2.

### 10.46 Admin walkthrough after 10.43–10.45 (Questions + Assessments) — ✅ checked locally 2026-11-17

Done in the browser on :5174 (backend :3000, same `lms_db`):
- **Questions list:** pages of 15 (1 → 2 → back), Type / Course / search filters, missing-content filters (correct results).
- **Full view** of a question: 5 options, answers, reasons, explanation, approach, highlights, theory recap. **Fixed:** "Linked quizzes" always said 0 and "Updated" was blank (the detail read neither `quiz_count` nor `updated_at`; older bug).
- **Edit + save** (#18944, unchanged save): text, explanation, approach and recap unchanged; all 5 option ids and contents unchanged; quiz content stamp 1 → 2; catalogue content version 393 → 394 (phones refresh).
- **Create** a question (stable option ids 10191650–54) + recap, publish it, put it in a new assessment; the assessment shows in the library and the builder (Selected 1); **Update Assessment** keeps the link (stamp 2 → 3).
- **Delete** the assessment together with its question from the page: both gone, no leftover links.
- Today's import (4 "Paediatrics revision paper" sets, 65 questions, quizzes 1028–1031): every question complete (5 options, reasons, explanation, approach, highlights, keywords, recap with key points, stable ids); quiz 1031 opens with its 20 questions.
- **Wording fixed** in the assessment delete dialog: no more "students' saved answers"; the results warning now says "recent results".
- Version history (`/questions/:id/versions`) is empty by design since 10.39; no admin page calls it.

Answers (user, 2026-11-17): "do 1 and 2 — it is a test, 3 — fix them".
- **Subject is now optional** in the question edit form ("No subject (course-wide)"); an empty choice is sent as `null`, not 0 (both save paths). Checked: #19164 (no subject) saves; content unchanged, subject stays NULL, quiz stamp 2 → 3.
- The 65 paediatrics questions in Medicine are test data: left as they are.
- The slowness: the dev slow log was cleared (387k rows), but the real cause was the Mac under heavy load (load average 25–57 from the Xcode/Flutter build, 2 GB disk free). The filters themselves were fixed in 10.47.

### 10.47 "Missing content" filters by an indexed flag — ✅ BUILT locally 2026-11-17

#### Decision (user, 2026-11-17)
- "fix them": the admin Missing content filters scanned and parsed every question.

#### Before → after (local, same 16-row page)
| Filter | Rows examined | Time (Mac under load) |
|---|---|---|
| No quick theory card | 11,144 → **159** | 2.6 s → **0.006 s** |
| No why-incorrect | 13,293 → **0** | 5.9 s → **0.001 s** |
| No question approach | 11,144 → **291** | 2.2 s → **0.0005 s** |
| No explanation | 13,293 → **0** | 1.6 s → **0.0007 s** |
| Missing anything | full scan → **304** | 5.7 s → **0.001 s** |
- Through the admin API: 1.3–9.6 s → 5–35 ms.

#### Changes
- `questions.missing_mask` TINYINT STORED generated column (explanation 1, why-incorrect 2, approach 4, theory 8), MySQL keeps it current on every write; index `(missing_mask, id)`. Schema step `questions missing-content flags`, `CRITICAL_SCHEMA_VERSION` 2026-11-17.19.
- `question-content.ts`: `MISSING_BITS`, `sqlMissingMaskExpression`, `sqlMissingFilter` (a bit → `missing_mask IN (masks with that bit)`, an index range); list + export filters use it.
- Checked: the flag equals the old rules on all 13,293 questions (0 differences); counts 275 no approach, 143 no recap, 0 no explanation / reasons. Unit + e2e suites pass.

### 10.48 Student website: unwanted requests out, ≤ 5 rows examined per page — ✅ BUILT locally 2026-11-17 (approved)

#### Decision (user, 2026-11-17)
- "open the student part and fix them, remove the unwanted api calls, each page max 5 rows examined".

#### Before (local, test student 166, warm server, own cookie host 127.0.0.1:5177 → :3200; browser pre-check OPTIONS requests not counted — they don't happen on the live same-origin site)
| Page | Requests | Statements | Rows examined |
|---|---|---|---|
| Open site → Study Hub (empty browser) | 9 | 9 | **65** ✗ |
| Study Hub (reload, browser cache kept) | 6 | 5 | 5 |
| Courses | 1 | 1 | 1 |
| Course page (Medicine) | 1 | 1 | 1 |
| Q-Bank, Exams, Lessons, Flashcards, Study, Saved, Notifications, Results, Profile | 0 | 0 | 0 |
| Planner | 1 | 1 | 0 |
| Subscriptions | 1 | 8 | **208** ✗ |
| Drugs / ECG / Auscultation | (hidden on the website: back to Study Hub) | | |

Where the rows go:
- `GET /settings/public` (on open): 61 rows (system_settings is read whole for 15 keys).
- `GET /subscriptions/me`: plans 10 + **features 72 + plan-features 64** (feature gating is gone since the "any active subscription unlocks all" decision) + payment settings 61.
Unwanted requests on open:
- `GET /student/notifications` (empty): the start-up reply already carries `notices` and `popups`.
- `GET /uploads/marketing-popups/popup-alert.json` (404 locally): popups also come in the start-up reply.
- `GET /student/catalogue/index` twice on a reload; `dashboard/more`, `planner/agenda` each a separate request.

#### Plan
1. **Settings from memory:** public + payment settings kept in server memory (read once, refreshed when an admin saves settings) → 0 statements.
2. **Subscriptions page:** stop reading features / plan-features (not used); plans from server memory (refreshed on plan save) → only the student's own subscription row(s) by user id (≤ 2 rows).
3. **Open site:** drop the separate notifications call and the popup-file fetch (both already in the start-up reply); one catalogue-index call (no duplicate).
4. **After numbers** for every page, browser check, change log, memory.

#### Changes
- `settings.service`: the settings table is kept in memory (read once, updated on every save here, re-read at most every 10 min) → public / payment / availability settings cost 0 statements.
- Subscriptions: warm it was already 4 statements · 1 row (plans + features are in server memory for an hour); the 208 rows were the first read after a restart. Plan features are **kept** (the phone app shows them on its Subscriptions screen); settings now from memory.
- Website start-up: the notices list comes from the start-up reply (`notices.items` seeded into the bell / inbox cache) → no `GET /student/notifications`; the popup asks for the public settings only when the popup file is missing. The duplicate catalogue-index call did not reappear (the loader shares one request).
- Tests: settings fakes know the whole-table read.

#### After (same setup)
| Page | Requests | Statements | Rows examined |
|---|---|---|---|
| Open site → Study Hub (empty browser) | 9 → 9 (notifications gone; `samples/index` and settings fallback only because the popup file is missing locally) | 9 → **6** | 65 → **4** |
| Subscriptions (warm) | 1 | 4 | **1** |
| Every other page | unchanged (0–1 rows) | | |
- Note: a just-restarted server fills its memory once (quiz list 2,118 rows inside the first `app/start`, plans + features 146 rows on the first Subscriptions open); after that every page stays ≤ 5.

### 10.49 Website course progress the app's way; exam countdown card removed — ✅ BUILT locally 2026-11-17

#### Decision (user, 2026-11-17)
- "move the course progress like how we did for the app and drop the exam counter card and its related codes".

#### Changes
- `catalogue.api.js` `catalogueCourseProgress()`: each course's lessons from the catalogue (already downloaded) checked against the finished-lessons bitmap from start-up progress — the app's `completeLocally` logic. The Study Hub uses it (falls back to a cached server value only until it is ready).
- Server: the start-up reply no longer builds course cards (`courseCards` removed from `start-payload.service`; reply 2,588 → 2,419 B).
- Exam countdown card removed: the component, its use, `nextExamItem`, and all its CSS (`study-exam-countdown-*`, `study-exam-agenda*`, the two-column grid it shared with Course progress) in dashboard-page / cards / native CSS. The planner agenda request stays (the upcoming-tasks card uses it).
- Checked in the browser: Course progress shows 4 courses / 1,479 lessons from the catalogue; no countdown card; open site 6 statements · 4 rows. Totals follow the catalogue like the app (lessons students can see), so a course can show slightly fewer lessons than the admin Reports count of all active lessons (e.g. Gynaecology and Obstetrics 168 vs 180).

### 10.50 Buying a plan with a bank slip — end-to-end check — ✅ F1–F3 BUILT locally 2026-11-17 (F4 not done)

#### What was done (local, 2026-11-17)
Test student 166 (no plan) on the website (127.0.0.1:5177) and the admin on :5175, both on the traced backend; a generated 200 KB PNG as the slip.

| Step | Requests | Statements | Rows examined |
|---|---|---|---|
| 1. Student opens Subscriptions | 0 (saved copy) | 0 | 0 |
| 2. Choose plan → Checkout (invoice #1189 created) | 2 | 16 | **89** |
| 3. Upload slip + reference → back to Subscriptions | 2 | 14 | **93** |
| 4. Admin opens Subscriptions (Requests tab) | 5 | 12 | **533** |
| 5. Admin views the slip (200 KB file) | 1 | 2 | 2 |
| 6. Admin approves (then the page reloads its lists) | 4 | 18 | **618** (approve itself 87) |
| 7. Student opens Subscriptions again | 0 (saved copy, still "Waiting for approval") | 0 | 0 |
| 7b. Student reloads the page | fetch 4 st · 11 rows, but the page still shows the old copy | | |

Works: invoice number, slip saved as a file (`/uploads/payment-proofs/1189.png`, only the path in the database), reference kept, admin sees "Proof uploaded" with the slip, approve creates subscription 256 (Quick Revision, paid LKR 1190, 17–23 Nov, active) and marks the request approved; the student sees the active plan on the next visit.

#### Found
1. **Plan details read fresh** on create invoice, upload and approve (`plansService.findById` skips the plan memory): plan + all 36 features + plan features = 3 statements · 84 rows each time.
2. `requestManualPayment` re-reads the student row (already read by the sign-in check) and runs the invoice-counter `INSERT IGNORE` on every invoice.
3. **The student does not see the approval** on the first visit or even a reload: the Subscriptions page shows its 1-hour saved copy, and a background refresh updates only the saved copy, not the screen.
4. Admin Subscriptions: overview counts read 339 rows (every student 107 + every subscription 220) and the plans list 146 rows on each open / after each approval (admin only).

#### Proposed fixes
- F1: `findById` from the plan memory (already used by `findActive` / `findByIds`) → −3 statements · −84 rows on create / upload / approve.
- F2: drop the second student read; create the invoice counter once (schema step) instead of every invoice.
- F3: Subscriptions page — while the saved copy shows a pending invoice, ask the server (4 statements · ≤ 4 rows) and show the answer; a background refresh updates the screen too.
- F4 (admin, optional): overview counts from stored numbers.

#### Built (user: "do F1–F3")
- F1 `plansService.findById` from the plan memory (direct read only for a plan not in it).
- F2 `requestManualPayment` reuses the student the sign-in check read; the invoice counter row is created only when missing.
- F3 student Subscriptions page: while its saved copy shows a pending request, it asks the server and shows the answer.
- Also (to keep the student page lean): the student's history and requests are read without joins — plan names / prices from the plan memory, admin names dropped (students never see them) — and newest-first by id so no sort pass. Reply identical apart from those two names.

| Step | Before | After |
|---|---|---|
| Create invoice | 12 statements · 88 rows | **7 · 6** |
| Upload slip | 10 · 89 | **6 · 7** |
| Approve (the request itself) | 9 · 87 | **6 · 4** |
| Student `subscriptions/me` (2 subscriptions + 2 requests) | 4 · 19 | **4 · 7** (rows read = rows returned) |
- Checked in the browser: second purchase (Monthly Prep, invoice #1190) → slip → approve → the student's first visit shows "Monthly Prep, 30 days left". Tests pass.

### 10.51 Website weight: unused files removed, homepage lighter, demo linked — ✅ BUILT locally 2026-11-17

#### Decisions (user, 2026-11-17)
- Delete the unused public files (all listed); measure and lighten the homepage; "connect the demo page you created to the home page" (the demo /try page is also called too basic — redesign not started, mockups first).

#### Measured (production `build:web` into a scratch folder, served locally)
| | Before | After |
|---|---|---|
| `frontend/public` | 18 MB | < 1 MB |
| Built site (`dist`) | 24 MB | **5.9 MB** |
| Homepage files (own, 18 files) | 1,981 KB raw · **794 KB gzipped** | 1,643 KB raw · **456 KB gzipped** |
- Plus on the homepage: Google font CSS 7.5 KB + JetBrains Mono 30.6 KB, two store-badge images from Google / Apple.

#### Changes
- Deleted (all unreferenced, in git history if ever needed): `public/download/` (14 photos, 7.9 MB), `public/landing/*.jpg` (11 photos, 7.5 MB), `public/lms-assets/` (1.6 MB), `public/icons/medical` (75 SVGs), `offline/medical-quotes.json`, `theme-preview.html`, `dark-mode-mockups.html`, `.DS_Store`. Kept: `.htaccess`, `.well-known`, robots, sitemap, app icons.
- Logo in the closing section: `landing/logo.png` 1254×956, 346 KB → `landing/logo.webp` 168×128 (2× of its 64 px size), 7.7 KB, same artwork; the PNG deleted.
- Demo page linked from the homepage: hero "Try a free demo" (next to Sign In, which stays — the only sign-in on phones), top-bar "Try free", closing section "Try the free demo first". Checked in the browser: all three open /try.

#### Still on the homepage (next cuts, not done — ask)
- `main.css` 542 KB raw / 77 KB gz: every page's global styles load on the homepage.
- `app-shared.js` 120 KB gz: shared app code (API, stores) loaded by the homepage too.
- Two animation libraries: GSAP 43 KB + Motion 40 KB gz.
- JetBrains Mono (boot loader / hero mock browser) and the store badges come from other hosts.

### 10.52 Demo page (/try) rebuilt: features one by one, coming-soon tools, zero database — ✅ BUILT locally 2026-11-17 (mockup A)

#### Decisions (user, 2026-11-17)
- Show the features one by one; ECG, OSCE stations and so on as "Coming soon"; the page must not look AI-generated — nicer, with fade-in animations, working on phones; a short lesson written by hand; no database connections (zero cost); optimise the homepage and the demo page as much as possible.

#### Before
- /try: 4 server requests on open (samples index, a lesson, a quiz, a deck — files, 0 database rows) plus the large lesson renderer (NoteCanvas) loaded lazily.

#### Plan
1. Content in a static file in the website bundle (no requests): short lesson "Iron deficiency anaemia" (5 sections + key point), 3 practice SBAs with a reason on every wrong option, a 2-minute 2-question mini exam with a review, 1 flashcard, 4 coming-soon tools (ECG library, OSCE stations, heart & lung sounds, drug cards). Facts checked against BSG 2021 / NICE; no drug doses.
2. CSS-only fade-ins (IntersectionObserver), no animation libraries, no NoteCanvas; respects reduced motion; phone-first layout.
3. Mockups (tools/mockups/try-a/b/c.html): A one step at a time with Next/Back, B one scrolling story, C dark chapters with a progress rail.
4. Then the homepage weight (10.51 list): global CSS, shared app code, two animation libraries.

#### Built (user picked A; then "remove the background card for flashcards, match the theme", "one question with why-wrong, explanation, approach, key points, quick theory recap")
- `TryPage.jsx` + `tryContent.js` + `try-page.css`: steps Lesson → Q-Bank → 2-minute exam + review → flashcard (no panel behind it) → coming soon (ECG library, OSCE stations, heart & lung sounds, drug cards) → done; progress bar, fixed Back / Next bar (safe-area aware), CSS fade-ins, reduced motion respected.
- Q-Bank step: ONE question; after answering — verdict, "why not" on each wrong option, explanation, clues highlighted in the stem, numbered "how to approach it", key points, collapsible quick theory recap (causes, how it develops, features, investigations, treatment).
- Colours from the site theme tokens (`--ink-strong`, `--ink-muted`, `--surface-card`, `--line-soft`, `--color-primary`, `--surface-0`): follows light / dark.
- Checked in the browser: every step, exam timer + review, flip card, recap; 375 px phone width (no sideways scroll); dark theme.

| /try | Before | After |
|---|---|---|
| Requests from the page | 4 (samples index 42.7 KB + lesson + quiz + deck) | **0** |
| Code + styles | 5 KB + 2.3 KB + lesson renderer 118 KB (28 KB gz) | **18 KB raw · 6.5 KB gz** |
| Database | 0 (files) | 0 |

#### Revised (user, 2026-11-17, same session)
- Topic → **acute coronary syndrome** (ESC 2023 / NICE facts; lesson, one taught STEMI question, 2 exam questions — papillary muscle rupture, LAD territory — flashcard on PCI vs fibrinolysis).
- Brand header (logo + Get started), homepage pastels with a **light** touch; lesson pen marks draw themselves (highlights, scribbled underline, circle, margin note); flashcard ratings (Again / Hard / Good / Easy with the next review); new steps Progress & analysis (sample data) and Planner.
- Layout now **one scrolling page**: no progress bar, no step counter, no Back / Next bar; each part unlocks when the one above is finished (Continue, Show answer, Submit, rating); locked parts show a lock line. Portrait column (max 520 px) with more outer space; no "why" dot chips.
- Q-Bank: a **Show answer** button. Exam: after Submit, **marks only** (score, Q1 ✓ / Q2 ✗), then **Review answers** shows the questions.
- Checked: full unlock flow, no errors, phone width, logo light / dark. Still 0 requests, 0 database.
- Then: headings and text full width again — only the cards are inset (max 480 px, 14 px extra side gap on phones); the page **grows one part at a time** (later parts are not on the page at all, so it cannot be scrolled past the current part); the lesson cut to a small piece (Symptoms, Diagnosis, Treatment + key point, 2 min read; the "Where on the ECG" section is gone).
- Final shape (same day): back to **one step per screen** with the bottom bar **Back · 1 / 7 · Next** (no progress bar, no step label); every screen fits a 375×812 phone without scrolling (checked: lesson, Q-Bank before/after + every tab, exam questions, marks, review, flashcard, progress, planner, coming soon, end).
- **Flat, plain look**: white page, one bordered card per step (very light warm `#fffdf9`), no shadows, gradients, glow mesh or boxes inside boxes; one title + one short line per step; solid buttons; coming soon as a plain list; planner as a plain checklist.
- Q-Bank after answering: only the right answer (and the wrong pick) stay, the stem folds to 2 lines (tap to read), teaching in tabs — Why not · Explanation · Approach · Key points · Recap. Exam: one question at a time, marks first, then review one at a time.
- Lesson pen marks: the blue circle removed (it cut through the words) — underline instead; circle code deleted.
- **Get started** (header + end screen) opens a sheet: Continue with email → the real `/register` page; Continue with Google → `/login?start=google` (LoginPage now starts the same Google sign-in once when it sees `start=google`); Continue with Apple → the same `startAppleRedirect` (shown only when Apple is configured). Checked: sheet opens/closes, email goes to /register; Google and Apple not clicked (they leave for the real providers).
- Colour pass (user): lesson canvas colourful — pastel highlighters (pink, mint, lilac), a coloured pen underline, a grey pencil underline (SVG pencil texture), pen ticks / a wave by the headings and a star on the key point, a pencil squiggle under the title; pen colours and tilt chosen at random on each visit. Right / wrong answers in pastel green / red; question clues in pastel lilac (no yellow). Each card a different faint pastel (lilac, sky, peach, mint, rose, lemon at ~22% on white). Header: only the logo and the homepage's own Get Started button (gradient + arrow); "Sign In" removed (it's in the sheet). Lesson's "Medicine · Cardiology · 2 min read" line removed.
- ECG exam question (V1–V4 → LAD) and the "ECG library" card removed.
- Exam: small "Mini exam · 5 questions · 2:00" row with a round play button; 5 short questions, always 5 options (A–E): first test (ECG), troponin, RV infarct after GTN, papillary muscle rupture, statin. Keys checked against ESC 2023.
- Progress: score trend as columns (W1–W7, last column solid, "+24%" pill); readiness as 4 rings (Cardio, Haem, Resp, Renal); a Weak topics card (topic, subject, questions missed, accuracy bar) plus "Strongest" topic.
- Exam marks: score ring with a verdict, correct / wrong / skipped tiles, 5 numbered circles (tap one to review it), full-width Review answers.
- Flashcard ratings: pastel tinted tiles (Again rose, Hard peach, Good mint, Easy sky); the "Next review…" sentence removed.
- End screen: "Everything you need, in one app." — after about 1.3 s "one app" slides up and out and "xyndrome" slides in with the brand gradient. Its Get Started is text only (brand blue) with an arrow that keeps nudging right; the header Get Started button is unchanged.
- Lesson look: Symptoms / Diagnosis / Treatment headings are pastel chips (pink, sky, mint). Bigger scribbles, kept in the margins: a heart by the title, a random big arrow / spiral / loops at the end of each heading row, and a rough hand-drawn box around the key point (scaled doodles use a longer dash so they draw fully).
- "Tap here" hints: handwritten pen-colour notes with drawn arrows, each gone once used — lesson "write here!" with a pen that traces a ghost stroke on a loop (the lesson is drawable with finger or mouse, each stroke a new pen colour, no Clear button), Q-Bank "tap one", exam "tap to start", flashcard "tap to flip", planner "tap a task" (after the auto-ticks).
- Next locks: Lesson until the student has scribbled (about 20 points drawn; a tap is not enough); Q-Bank until the 2 auto tabs finish; Exam until play is tapped once. Other steps never lock.
- Bottom bar: round ‹ › arrow buttons instead of Back / Next (the last screen shows a restart arrow), and small step dots instead of "1 / 7" (done dots tinted, current dot stretched).
- The bottom bar and the Get Started sheet are rendered into <body> (React portal, wrapped in `.try-page.try-layer` to keep the tokens). The site's route wrapper (`lms-route-reveal`) keeps a transform after its fade, and that made `position: fixed` scroll with the page whenever the page was a little taller than the screen.
- Planner: the 4 tasks tick themselves one after another when the step opens; when all are done the header says "All done" and a streak card shows "10-day streak · +40 pts" (sample).
- Coming soon: one tool at a time, centred in the panel (OSCE stations → heart & lung sounds → drug cards, about 1.9 s each, fading in and out), ending on "And more on the way"; small dots show where it is. No panel behind it (sits on the white page, like Flashcards).
- Transitions: steps slide in from the side they came from, the panel scales in, the exam row expands into the question, and exam questions slide left or right. All off with reduced motion.
- Q-Bank teaching: after an answer only the first 2 tabs play by themselves (Why not 1.8 s → Explanation 2.2 s), with a fill line on the active tab. The bottom Next is locked on this step only, until Explanation finishes (about 4 s) or another tab is tapped. Other steps never lock.

#### Homepage option measured, not applied
- Without the `app-shared` chunk grouping (vite `manualChunks`), homepage code 327 → 291 KB gz but 9 more files and every page's packaging changes — needs a full-site check first. Global CSS split: the stylesheet order is load-bearing (index.css), so only with before/after screenshots of every page.

### 10.4 Order

1. Monitor + baseline ✅ · 2. Tokens + start-up request + phone cache rules · 3. Stored counts, student summary, per-topic stats · 4. Notifications (feed, inbox, popups, SQL removed) · 5. Screens one at a time, mockups first: Lessons, Q-Bank, Flashcards, Study Hub, courses screens, quiz open · 6. Student website on the same endpoints · 7. After-run on the phone (same 12 steps), side-by-side.

### 10.53 Public pages (loader, homepage, demo): under 1 MB, no white flash, nothing unused — 📝 PLAN 2026-11-18 (questions open)

**Decisions** — (1) ✅ target is the **raw** files: each page under 1 MB raw (2026-11-18). (3) ✅ the white flash is seen everywhere: iPhone live, computer live and the local site. Open: (2) the boot loader — explained, mockups shown 2026-11-18 (A today's dark terminal, B light pastel CSS loader, C no loader), waiting for a choice; (4) the homepage animations — user asked what happens to them; explained, waiting for an answer.

**Backup** — a copy of the three pages as they are now is at `~/Desktop/xyndrome-backups/public-pages-2026-11-18/` (source files + the measured production build; README says how to view and restore). Outside the repo on purpose.

**Aims** — the three public pages (boot loader → homepage → demo /try) load fast, each under 1 MB, with no white or dark flash between them, and nothing downloaded that the page does not use.

**Before** (production build 2026-11-18, measured from the built files; compressed = gzip -9, images/fonts as is):

| Page | Files | Raw | Compressed |
|---|---|---|---|
| Homepage `/` (first visit, loader plays) | 23 + 2 Google font files + 2 store badges | 1,661 KB | 465 KB |
| Demo `/try` (opened directly) | 16 | 1,386 KB | 368 KB |

Largest pieces on both pages: the whole app stylesheet `main.css` 542 KB raw / 77 KB compressed (every app page's CSS, mostly unused on public pages); `app-shared` 373 / 120 KB (app code shared by all routes); `react-dom` 171 / 53 KB; `main` 100 / 27 KB; `vendor` 71 / 20 KB. Homepage only: framer-motion 124 / 40 KB (boot loader + 7 homepage sections), GSAP 110 / 43 KB (pinned hero), LandingPage 84 / 24 KB, JetBrains Mono from Google (38 KB, used by the loader typewriter only), both store badges from Google/Apple servers. The demo page itself is small: 36 / 11 KB JS + 28 / 7 KB CSS.

White flash — what the code does today: `boot.js` paints the document dark (#05070d) on every web route; the homepage gets `data-lms-dark-boot` to stay dark until the dark boot loader (#050a08) shows; the homepage underneath is now pastel/light (landing v2), so the order is dark → dark loader → light page. Not yet reproduced here; needs the device/browser where it is seen.

**Plan** (each step measured before/after; nothing changes until the questions are answered):
1. Flash: one background colour from the first paint to the page — match `boot.js` / `index.html` / the loader to the page they lead to (light for homepage and demo if the loader goes light).
2. Boot loader: replace the framer-motion + typewriter loader with a small CSS-only one (drops JetBrains Mono and, with step 3, framer-motion).
3. Homepage sections: rebuild the 7 framer-motion animations as CSS (same look) → framer-motion leaves the public pages.
4. Public stylesheet: give the homepage and demo their own small CSS instead of the whole app `main.css` (the biggest raw item; needs a screenshot check of every public page and spot checks of app pages).
5. Remove unused code found on the way. Leftovers check 2026-11-18 (nothing deleted yet):
   - `TestimonialsMarquee.jsx` (4 KB): the section is commented out in `LandingPage.jsx` (`{/* <TestimonialsMarquee /> */}`) but still imported.
   - `CinematicHero.jsx`: `GlyphNotes`, `GlyphChart` never used; props `ctaHeading`, `ctaDescription`, `primaryCta` ("Start Free Trial") accepted but never shown.
   - `landing-v2.css`: 6 classes from an older subject-card design, no longer used (`lpv2-subject-card`, `-count`, `-meta`, `-title`, `-track`, `lpv2--subject-dark`).
   - `01-app-frame.css` (in the whole-app stylesheet): `.landing-page` dark-background rules — no page has that class any more (left from the dark homepage).
   - Dark-homepage boot leftovers: `boot.js` sets `data-lms-dark-boot` and a dark #05070d first paint for the homepage, `index.html` has the matching `!important` dark rules and `theme-color #05070d` — the homepage is pastel now (likely part of the flash; fix together with the loader choice).
   - `public/medical/`: 5 of 10 icons unused (`blood`, `pills`, `stethoscope`, `syringe`, `tooth`, 20 KB; `stethoscope` in `subjectIcon.js` is an icon name, not this file). Not downloaded by visitors, only shipped.
   - `tools/mockups/try-a/b/c.html` + `try-shared.*` + `try-content.js`: the first demo-page mockups (old iron-deficiency content), untracked and not shipped.
   - Store badges load from Google's and Apple's servers on every homepage visit (could be our own small files).
6. Connect the three pages: already linked (hero button, menu item and bottom call-to-action → /try; demo logo → homepage); the labels now read "Give it a free try" / "Give it a try" / "Give it a free try — you might like it" as gradient text (no second filled button).

**Changes** (2026-11-18, step 5 — leftovers removed; all files moved to `~/.Trash/xyndrome-leftovers-2026-11-18/`, also in the Desktop backup):
- `TestimonialsMarquee.jsx` deleted, its import and commented-out tag removed from `LandingPage.jsx`, and its marquee CSS removed from `landing-v2.css`.
- `CinematicHero.jsx`: `GlyphNotes`, `GlyphChart` and the unused `ctaHeading` / `ctaDescription` / `primaryCta` props removed (lint now clean).
- `landing-v2.css`: the old subject-card and `lpv2--subject-dark` rules removed. `01-app-frame.css`: the `.landing-page` dark rules removed.
- `public/medical/`: blood, pills, stethoscope, syringe, tooth removed (10 → 5 files, 37 → 17 KB shipped).
- `tools/mockups/try-*` (6 files) moved to the Trash; the other mockups there belong to the phone work and stay.
- After (build 2026-11-18): homepage CSS 4.0 → 2.1 KB raw; app stylesheet 542.1 → 541.5 KB; homepage JS 84.3 → 84.7 KB (the testimonials section was already tree-shaken; +0.4 KB is the new gradient text links). Homepage checked in the built site: all sections render, no broken images, the three /try links present. Not done here: the dark boot leftovers (wait for the loader choice) and local store badges (a replacement, not a removal).

- Popup check skipped on /try (2026-11-18): `AppFrame.jsx` adds `/try` to `shouldSuppressMarketingPopup`, so the demo page never downloads the popup code (5.6 KB) and never reads the popup file or settings. Checked with a local test popup (with image; the file restored afterwards): /try → no popup code, no requests; logo → homepage → the popup code loads, the popup opens after a scroll, image shows, the close button works; back to /try → no popup. Notes found while testing (not changed): the popup only appears when it has an image (`hasPopupContent` checks `imageUrl` only); on the local site the popup file can't be read from port 5177 (no CORS header on `/api/uploads`), so locally it falls back to the settings call — on the live site the file is on the same domain.

**White flash — found (2026-11-18).** Measured frame by frame (a test page samples the loading page's background every frame) on the built site, with `boot.js` delayed 1.5 s by a small test server to mimic a slow phone connection:
- Today: from the first byte until `boot.js` has downloaded, the page has **no background colour at all** (`html` transparent, no body yet) — the browser shows its default white. `index.html` loads `boot.js` as a blocking script *before* the `<style>` that sets the dark colour, so nothing can paint until it arrives (1.5 s in the test; on the live site = one round trip for `boot.js`, every visit, plus the HTML itself). After that: dark #05070d → dark loader → dark hero — no other white frame.
- Test fix (copy of the build only): the dark colour as the first line of `<head>` → the page has its colour from the first parsed byte (144 ms vs 1,591 ms in the test). Caveat: while a blocking script is downloading the browser may still not paint at all, so the real fix also needs `boot.js` to stop blocking or to come from cache.
- Options: (a) dark colour first + `boot.js` loaded with `defer` (paints dark as soon as the HTML arrives; light-mode app pages would show dark for a moment before their light splash); (b) keep `boot.js` blocking but give it a hashed name with a long cache so returning visitors never wait for it (first visit unchanged); (c) both, with the colour rule only on the public pages.

**White flash — decision (c), 2026-11-18, as built:** (1) `boot.js` gets a content version in its address (`boot.js?v=<hash>`, added by a small Vite plugin) and `.htaccess` lets browsers keep it for a year (`immutable`) instead of `no-cache, must-revalidate`, so returning visitors no longer wait a round trip with a blank white page; any change to `boot.js` changes the address. (2) `html{background:#05070d}` moves to the first line of `<head>` — the same colour `boot.js` already sets on every website page, only earlier (its CSP hash is added automatically by `sync-root-index.mjs`). Not possible safely: a different first colour per page (homepage dark / demo white) needs an inline script before `boot.js`; left as is. First visits still fetch `boot.js` once (2.5 KB compressed). Files: `frontend/vite.config.js` (plugin `versionBootScript`), `frontend/index.html` (first-line style), `frontend/public/.htaccess` (boot.js cache rule). Checked: built page has the style on line 1 and `boot.js?v=bdaed41c14`; homepage (dark hero), `/try` (white) and a signed-out app page (light sign-in, rgb 220 230 244) look as before; the dev server also serves the versioned address. Not testable locally: the `.htaccess` cache header (the preview server ignores `.htaccess`) — check `Cache-Control` on `boot.js` after the next deploy.

**Loading pages separately — experiments (2026-11-18, test builds only, nothing kept):**
- Removing the forced `app-shared` group alone: `/try` direct 1,386 → 1,388 KB raw (worse): the catch-all `vendor` group grew 71 → 231 KB and the animation library started loading on every page.
- Also removing the catch-all `vendor` group, then also giving React its own group: the animation file still loads on every page, because the bundler puts part of React's own code inside the `motion` chunk (its exports `o`/`s` are imported by the app start-up code and ~40 pages). The fix needs the chunk groups rebuilt so a library group does not pull its dependencies in (rolldown `advancedChunks` without recursive dependencies) — a careful change with a before/after file list for every page type.
- The stylesheet: 542 KB raw is the theme (86 KB), shared layout/components and Tailwind helpers for every page; `index.css` warns the order is load-bearing, so a split needs screenshots of every page.

**Targets** — each page under 1 MB raw (and well under 300 KB compressed); no frame of a different background colour between loader, homepage and demo; same look.

### 10.54 Sets table tidy-up + question keywords removed — ✅ BUILT locally 2026-11-18 (not committed, not deployed)

**Decisions** — ✅ "ok we will apply" (2026-11-18): (1) remove the `quizzes` columns no set uses and fold the three identical name columns into one; (2) keywords **option C**: question keywords removed entirely (the `question_keywords` table, `questions.keywords_text`, the admin keyword field, filter and suggestions); admin search keeps question text, subtopic and paper title. Past-paper keywords (`papers.keywords_text`) are a separate feature and are not part of this.

**Aims** — the sets table and the admin builder carry only what is used; no keyword table that grows forever; nothing changes for students.

**Before** (data, 2026-11-18): `quizzes` 659 rows, 34 columns. Empty or identical in all 659: `lesson_id`, `paper_id`, `collection_tags`, `subtopic` (text), `quiz_description`, `blueprint_json` (empty); `randomization_mode` (static), `quiz_mode` (exam), `display_title_mode` (title); `exam_mode_only`, `hide_time_limit`, `hide_passing_marks`, `show_theory_recap_in_exam` (off). `quiz_title` = `admin_name` = `student_title` in all 659. Questions: 13,293, of which 10,623 have keywords; `question_keywords` 7,193 names (id counter ~26 million). Request numbers before (traced backend :3200, slow log; reads only; responses saved to compare after):

| Flow | Size | Statements | Rows examined | Rows returned |
|---|---|---|---|---|
| Admin sets list (page 1) | 34,124 B | 2 | 1,528 | 51 |
| Admin sets meta | 310,095 B | 0 (memory) | 0 | 0 |
| Admin builder open (set 887) | 708 B | 3 | 5 | 5 |
| Admin Questions list (page 1) | 82,922 B | 2 | 101 | 51 |
| Admin Questions search "ectopic" | 87,452 B | 1 | 13,488 | 50 |
| Admin Questions meta | 310,000 B | 7 | 11,201 | 9,029 |
| Admin keyword suggestions "myo" | 172 B | 2 | 12 | 12 |
| Phone catalogue index | 481 B | 2 | 3 | 2 |
| Phone catalogue parts (course 14) | 26,990 B | 0 (memory) | 0 | 0 |
| Phone open set 127 (20 questions) | 114,829 B | 5 | 45 | 24 |
| Phone open set 887 (3 questions) | 9,842 B | 3 | 4 | 3 |

Search (2026-11-18): the phone app reads `examModeOnly` (7 files), `displayTitleMode`, `studentTitle`, `quizDescription`, and the catalogue as fixed-position lists (`[id, courseId, subjectId, topicId, lessonId, isGeneral, examModeOnly, isFree, studentTitle, quizTitle, numberMode, …]`); with `displayTitleMode` missing it falls back to "Quiz N". So the server keeps sending the same fields with fixed values (title = `quiz_title`, `displayTitleMode` 'title', `examModeOnly` false, description '', …) — installed apps see no difference. Backup: `~/Desktop/xyndrome-backups/db-10.54-2026-11-18/` (quizzes, questions, question_keywords, question_quizzes; 56 MB).

**Plan**
1. Search the backend, admin website, student website and Flutter app for every read/write of the 15 columns and of question keywords (no changes).
2. Back up `quizzes`, `questions`, `question_keywords` (mysqldump to the Desktop backups folder).
3. Measure before: admin set builder open + save, admin Questions list + search, student opening a set (web + phone) — requests · statements · rows examined · rows returned.
4. Remove: code paths and builder controls first; then a boot schema step (new `CRITICAL_SCHEMA_VERSION`) drops the columns and the table — on the live server this runs on the first start, so a live backup comes first.
5. Measure after, same flows; test the builder, Questions page, bulk input/import, and opening/doing a set on the website and the phone.

**Changes** (2026-11-18):
- Server reads (`quiz-attempts`, `student-catalogue`, `recent-results`, `dashboard`, admin `quizzes`): the dropped columns are replaced by the fixed values every set had (title = `quiz_title`, `displayTitleMode` 'title', `examModeOnly` 0, description '', static order, no lesson/paper link), so every reply is unchanged; the joins to `lessons`/`papers` for sets are gone. Saves (create, update, version rollback) write only the 13 remaining set fields; sets are always fixed lists.
- Keywords (option C): removed from question search, filters, create/update/import/export, the suggestion and bulk-keyword routes (`GET /admin/questions/keywords`, `POST /admin/questions/keywords/bulk`), the sets meta, and the builder ("Apply tags"). Admin search matches question text, subtopic and paper title. Past-paper keywords untouched.
- Admin website: Questions page (keyword field, filter, "Update keywords" dialog, preview text), bulk question input (global and per-question keywords), set import, set builder (description, attempt type, set paper/lesson, collection tags, internal group label, the fixed/random delivery section, hide timer / hide pass mark / exam-only). The builder's random-set code was then removed too (2026-11-18): no dynamic branches, save checks or random-mode texts remain; the "Paper sections → Draw missing" helper stays (it picks questions into the fixed list) but its sections are no longer saved (the column was empty in all 659 sets), and its card now says so. Tested: builder opens, a paper section can be added, saving set 1022 from the page works (content stamp 6 → 7), no console errors. The server's random-set code was removed as well (2026-11-18): in `quiz-attempts` the premium random-set access check, the random question picker, its 60-second question-pool cache, blueprint parsing and the random exam-token path are gone (practice, exam start and exam finish use the fixed list only); in admin `quizzes` the random/blueprint validation, counting, snapshot fields and helpers are gone, and the request format no longer accepts `blueprint` / `randomizationMode` (the set import page stopped sending them). Student and phone replies still carry `randomizationMode: 'static'` and the catalogue's random flag (always 0) for installed apps. Checked after a rebuild/restart: opening sets 127 and 887 byte-identical; catalogue lists identical apart from content stamps changed by the test saves (set 1022 4 → 7, set 887 1 → 2) and the version hashes that follow; admin set replies lose only `blueprint` and `randomizationMode`; exam start + finish work (adds a 0% result for test student 166 on set 887); builder opens with no errors. Then the plan feature went too (2026-11-18): "Dynamic quiz randomization" (`dynamic_quiz_randomization`) removed from `subscription-catalog.ts` (and from Master Prep's default features); boot step `drop dynamic quiz randomization plan feature` (`CRITICAL_SCHEMA_VERSION` 2026-11-18.2) deletes its plan link and feature row. Ran locally: "Master Prep - 1 Year" now lists 16 features instead of 17 (the public plans list and billing page lose that one line); admin plans and features lists load. Backup of the two rows: `~/Desktop/xyndrome-backups/db-10.54-2026-11-18/plan_feature_dynamic_quiz.sql`. The request format still requires `examModeOnly`, `hideTimeLimit`, `hidePassingMarks` (sent as fixed values).
- Database: boot step `drop unused set columns and question keywords` (`CRITICAL_SCHEMA_VERSION` 2026-11-18.1) drops the 15 columns, `questions.keywords_text`, the `question_keywords` table and the old two-column title index; the admin header search uses a new `ft_quizzes_title (quiz_title)`. The full schema sync no longer re-adds any of them. Ran locally: `quizzes` 34 → 19 columns.

**Old app check (2026-11-18):** every address the store build 1.0.0+2 (and 1.0.1+3) calls was tested against the v7 server. Not answered by v7: exam submit (`POST /quiz-attempts/exam/:id/submit`), bookmarks (`GET /study-bookmarks`, `POST /study-bookmarks/toggle`) and the old result/review routes (`/quiz-attempts/result/:id`, `/quiz-attempts/review/:id`, `…/review/:id/complete`; result/review were already gone in v6.5). Everything else the old app calls still answers. **Decision (user, 2026-11-18): no students use the old build — v7 is for the new app only, no compatibility routes.** The website always loads the new code on deploy (index.html is never cached); a stale open tab or old app gets an immediate 404 that touches no database.

**After** (same flows; first run after the restart had cold caches, warm numbers shown where they differ):

| Flow | Size | Statements | Rows examined | Rows returned |
|---|---|---|---|---|
| Admin sets list (page 1) | 34,124 B (same) | 2 | 1,528 | 51 |
| Admin sets meta (warm) | **174,097 B** (was 310,095) | 1 | 1 | 1 |
| Admin builder open (set 887) | 708 B (same) | 3 | 5 | 5 |
| Admin Questions list (page 1) | 79,492 B (was 82,922) | **1** (was 2) | 100 | 50 |
| Admin Questions search "ectopic" | 65,462 B | 1 | 29,685 (was 13,488) | **31** (was 50+) |
| Admin Questions meta (cold) | **174,002 B** (was 310,000) | **5** (was 7) | **4,007** (was 11,201) | **1,835** (was 9,029) |
| Admin keyword suggestions | route removed | — | — | — |
| Phone catalogue index / parts | 481 B / 26,990 B (same) | 2 / 0 | 3 / 0 | 2 / 0 |
| Phone open set 127 / 887 | 114,829 B / 9,842 B (same) | 3 / 3 | 4 / 4 | 3 / 3 |

- Identical replies: the 7 saved responses (phone catalogue index and parts, opening sets 127 and 887, admin builder and sets list) are byte-for-byte the same before and after.
- The "ectopic" search now finds 31 questions instead of 50+ (the rest matched only through keywords — the expected effect of option C); it examines more rows only because, with fewer than a page of matches, it scans the whole table instead of stopping at 50.
- Tested: admin set save (API and the builder's Update button, set 1022), header search (4 sets via the new index), exam start for a test student (set 887, 3 questions), question open and save; the builder and Questions page open with no errors. An admin page opened before the update gets a 400 on save until reloaded (old keyword field).
- Deploy: backend `dist` rebuilt locally; the live database must be backed up first, because the boot step drops columns and a table on the first start. Frontend not built for live yet.

### 10.55 Homepage and demo load separately (file grouping) — ✅ BUILT locally 2026-11-18 (not committed)

**Decisions** — ✅ user 2026-11-18: "optimize the website page load the demo and main page separately" (10.53 plan step "load the pages separately").

**Aims** — the homepage and the demo download only the code they use; the animation libraries never load outside the homepage; no visible change anywhere.

**Before** (production build, measured in the browser from a fresh load; compressed = gzip -9):

| Page | Files | Raw | Compressed |
|---|---|---|---|
| Homepage `/` (loader plays) | 18 | 1,638 KB | 455 KB |
| Demo `/try` (opened directly) | 15 | 1,376 KB | 365 KB |

Largest on both: the whole app stylesheet `main.css` 538 KB; the forced `app-shared` chunk 373 KB (every shared app module, used or not); `vendor-react-dom` 171 KB; `main` 100 KB; the catch-all `vendor` 71 KB.

**Cause** — `vite.config.js` uses `manualChunks`, which on Rolldown (Vite 8) becomes groups that pull each group's dependencies in with it: one `app-shared` file for all shared app code, one catch-all `vendor`, and (seen in 10.53) React's code landing inside the `motion` chunk when the other groups are removed.

**Plan**
1. Replace `manualChunks` with Rolldown's native `codeSplitting` groups and `includeDependenciesRecursively: false`: React + router in their own group first, then the heavy libraries (GSAP, framer-motion, html2canvas) in their own groups; no `app-shared`, no catch-all `vendor` — the rest splits by what each page actually imports.
2. Measure both pages again; check the animation library is not loaded on `/try`; check the number of files does not explode.
3. Check app pages still load: student pages, admin builder and Questions page, sign-in (no console errors).
4. The stylesheet split (538 KB) stays a separate step (needs screenshots of every page).

**Changes** — `frontend/vite.config.js`: `manualChunks` replaced by `codeSplitting` with `includeDependenciesRecursively: false` and four groups (`vendor-react` = react, react-dom, scheduler, react-router; `gsap`; `motion` = framer-motion, motion-dom, motion-utils; `html2canvas`). No `app-shared`, no catch-all `vendor`.

**After** (same measurement):

| Page | Files | Raw | Compressed |
|---|---|---|---|
| Homepage `/` | 33 (was 18) | **1,455 KB** (was 1,638) | **404 KB** (was 455) |
| Demo `/try` | 29 (was 15) | **1,193 KB** (was 1,376) | **314 KB** (was 365) |

- Each page drops 183 KB raw / 51 KB compressed: the unused part of the old `app-shared` file and the catch-all `vendor` no longer download.
- The animation libraries (GSAP 110 KB, framer-motion 124 KB) load only on the homepage; the demo loads neither (before the fix the animation file loaded on every page because it carried part of React).
- More, smaller files (all cached for a year by `.htaccess`); app-only start-up modules still on public pages total ~10 KB (announcements, reminders, workspace API) — not worth moving.
- Checked on the built site: homepage (hero, loader), demo, student pages (Study Hub, courses, lessons, flashcards, profile) and admin pages (set builder, questions, dashboard, structure, sets) load with no console errors.
- Still above 1 MB raw on both pages: the whole-app stylesheet (538 KB raw / 76 KB compressed) — the next step, with screenshots of every page.
- Deploy: needs a fresh `npm run build` in `frontend` (writes `frontend/dist`) committed with it.

### 10.56 App Subscription page: "What's included" fixed text, 1-query plan read — ✅ BUILT locally 2026-11-18 (not committed, not deployed)

**Decisions** — ✅ user 2026-11-18: "make the what is included as the hard coded text no api calls and make max optimize … dont touch in app purchases". Website unchanged (it keeps the full reply). Apple purchase, restore, verify and the reconciler are not touched.

**Aims** — the app's Subscription page reads only the student's own current plan: 1 query, rows examined = the student's own subscription rows, a reply of a few hundred bytes. The Free / Premium table is fixed text in the app.

**Before** (local, app client, `GET /subscriptions/me`, test student with 2 subscription rows; from the MariaDB log by trace id):

| Case | Requests | Queries | Rows examined | Rows returned | Reply |
|---|---|---|---|---|---|
| Normal (plan memory warm) | 1 | 4 | 5 | 4 | 50,583 bytes |
| Plan memory cold (once an hour, first student) | 1 | 8 | 209 | 168 | 50,583 bytes |

Warm queries: session user row (1/1), access profile (2/1), subscription history (2/2), plan-change requests (0/0). Cold adds: active plans (10/5), all features (70/35), plan↔feature links (63/63), whole `system_settings` table (61/61).
The app opens the page from its once-a-day saved copy, so a repeat open the same day is 0 requests; the numbers above are the first open of the day, pull-to-refresh and after a purchase.

The app uses only `currentSubscription` (plan name, status, free/unlimited flags, dates, days left) and the plans' feature lists (only to draw the Free / Premium table). History, requests, payment settings, checkout mode and the 4 plans with their features are unused by the app.

**Plan**
1. App: the Free / Premium table becomes fixed text (same 16 rows, same order, same Free ticks as today); it no longer needs `availablePlans`.
2. App: `GET /subscriptions/me?view=app`.
3. Server: `view=app` → lean path: the signed-token student check (`requireStudent`, no database read) and one indexed statement for the current subscription (`WHERE user_id = ? ORDER BY FIELD(status …), end_date DESC, id DESC LIMIT 1`); plan name from the plan memory; reply `{ currentSubscription: { planName, status, computedStatus, isFreePlan, isUnlimitedAccess, startDate, endDate, daysRemaining, isExpiringSoon } }`.
4. Without `view=app` (website, older app builds) the reply is unchanged.
5. Measure after; check the page on the iPad simulator (paid plan card, Change plan / Manage buttons, table).

**Targets** — normal: 1 request · 1 query · rows examined = the student's rows (2 here) · 1 returned · reply under 1 KB. The plan memory cold read (once an hour, shared by everyone) is unchanged.

**Changes**
- `mobile/lib/features/subscriptions/subscriptions_page.dart`: `_comparison` draws fixed `_premiumRows` (16) and `_freeRows` (4); no plan list needed.
- `mobile/lib/features/subscriptions/subscriptions_repository.dart`: `GET /subscriptions/me?view=app`.
- `backend/src/modules/subscriptions/subscriptions.controller.ts` (+dist): `view=app` → `requireStudent` (signed token, no read) + `getStudentCurrentPlanForApp`.
- `backend/src/modules/subscriptions/subscriptions.service.ts` (+dist): `getStudentCurrentPlanForApp` — one statement, `LIMIT 1`, plan name from the plan memory, 9 fields.
- Apple purchase / restore / verify / reconciler: untouched.

**After** (same measurement):

| Case | Requests | Queries | Rows examined | Rows returned | Reply |
|---|---|---|---|---|---|
| Normal | 1 | **1** (was 4) | **3** (was 5) | **1** (was 4) | **239 bytes** (was 50,583) |
| Plan memory cold (once an hour, shared) | 1 | 4 (was 8) | 146 (was 209) | 104 (was 168) | 239 bytes |
| Website / older app (no `view=app`) | 1 | 4 | 5 | 4 | 50,583 bytes (unchanged) |

- Repeat opens the same day stay 0 requests (the app's once-a-day saved copy).
- Deploy: backend dist + an app build (older app builds keep working; they just get the full reply).

### 10.57 Admin round 2: every page cold-measured, Reports + Gemini + counters — ✅ BUILT locally 2026-11-20 (not committed, not deployed)

**Decisions**
- ✅ User 2026-11-20: "Ok, we will apply". This covers every item below. It includes the 9.8 items that were already decided but never built (Reports on the summary row, stored admin counters, small fixes).
- 9.8 decisions still apply:
  - D1 "hardest questions" from the 5 recent results;
  - D2 inactive students and active-per-day from the summary row;
  - D3 the admin session check stays.

**Aims**
- Every admin page cold open: rows examined ≈ rows returned, and nothing over 1,000 rows.
- No page loads lists it only needs after a click.
- A "not changed" (304) reply costs no more than the stored counters it reads.

**Before** (local, 2026-11-20). Each page was loaded cold, in a fresh frame. The admin website was `localhost:5175` with the traced backend on `:3200` and the monitor in all-clients mode. Requests · Statements · Rows examined → returned (page requests only):

| Page | Requests | Statements | Rows examined | Rows returned | vs 9.8 (16 Nov) |
|---|---|---|---|---|---|
| Reports | 2 | 13 | 5,143 | 3,046 | 9,644 → 5,143 (10.44) |
| Gemini AI | 1 | 5 | 4,007 | 1,835 (33 KB) | not measured |
| Subscriptions | 3 | 11 | 537 | 126 | unchanged |
| Drugs | 2 | 4 | 389 | 33 | unchanged |
| Dashboard | 1 | 10 | 323 | 17 | unchanged |
| Finance | 3 | 5 | 230 | 159 | ✅ allowed |
| Users | 2 | 6 | 166 | 56 | unchanged |
| Assessments | 2 | 6 | 104 | 104 | ✅ |
| OSCE | 2 | 3 | 93 | 12 | unchanged |
| Questions | 2 | 6 | 69 | 69 | ✅ |
| ECG | 1 | 1 | 23 | 11 | unchanged |
| Roles | 1 | 1 | 12 | 6 | ✅ |
| Structure · Question reports · Auscultation · Announcements · Settings | 1 each | 1–2 | 0–4 | = examined | ✅ |
| Shell on every cold page (start-up + availability) | 2 | 1 | 1 | 1 | was +4 · +12 · +323 ✅ |
| **All 17 pages** | **78** | **94** | **11,120** | **5,498** | |

Where the rows go:
- **Reports:**
  - the lessons list is read twice (1,494 + 1,494);
  - lessons per course counts every lesson (1,510 → 4);
  - "inactive students" still joins the old activity tables (226 → 10, 136 ms);
  - the summary `lessons_done` is read twice;
  - the users count reads 113 rows for 1.
- **Gemini AI** (`/admin/questions/meta` full form):
  - every active lesson (2,988 → 1,494, 112 ms);
  - every subtopic joined to topics (917 → 290);
  - courses and topics with filesort (8 → 4, 94 → 47).
- **Dashboard:**
  - users by role/status (113 → 3);
  - active subscriptions count (192 → 1).
- **Subscriptions:**
  - overview: students count (107 → 1), subscription totals (222 → 1);
  - plans: features with `FIELD` order (70 → 35), plan↔feature links (63 → 63).
- **Drugs:** `COUNT(*) FROM drugs` (357 → 1).
- **Users summary:** users by role/status (113 → 3).
- **OSCE:** subject count joins every topic (59 → 4); category case counts (8 → 2).
- **ECG:** card count subquery per topic (23 → 11).
- **Assessments:** `quizzes/meta` and `quizzes/summary` both read courses (4) and topics (47), so the same data is read twice.
- **304 replies** (Subscriptions overview, Users summary, Courses) run every query before they find nothing changed.
- **The session row** read on admin requests includes the `password` hash, which the check doesn't use.

**Plan**
1. **Gemini AI form:** opens with courses and topics only. Subtopics and lessons load for the picked topic only (`WHERE topic_id = ?`, indexed), and are kept in page memory per topic.
2. **Assessments:** one request returns courses and topics with their quiz totals. The page stops calling `quizzes/meta` separately.
3. **Reports on the summary row** (9.8 step 4):
   - lessons per course from `courses.lesson_count`;
   - the lessons list is not read (the course id comes from the summary / stored counts);
   - inactive students and active-per-day from `last_active_day` and the 14-day ring;
   - each summary column is read once;
   - user counts from the counters row.
4. **Stored admin counters** (9.8 step 3), in one small row:
   - students / staff / pending by role and status;
   - active / expired / expiring subscriptions and their totals;
   - drugs total.

   The row is adjusted in the same statement as each change, and Fix counts rebuilds it. It serves the Dashboard, the Users summary, the Subscriptions overview and the Drugs total. Their 304 replies are then based on the row, with no recount.
5. **Small fixes** (9.8 step 5):
   - OSCE subject count from stored `courses` counts;
   - ECG card count stored on the topic (adjusted on card add / delete);
   - plan features read with exact rows (no `FIELD` filesort over every feature);
   - Settings and Question reports keep their current 1 statement.
6. **Session row:** name the columns the check needs and drop `password`. The check itself stays (D3).
7. **Saves** that touch the new counters (user create / delete / status, subscription assign / approve / expire, drug add / delete, ECG card add / delete) are measured before and after.
8. Re-run the same 17-page cold sweep and record the After numbers here.

**Changes (files)** — planned (built list below under After)
- Backend (`.ts` + compiled dist):
  - `admin` questions-meta (form mode + per-topic subtopics / lessons);
  - quizzes summary;
  - `reports` service;
  - `admin/dashboard`;
  - users summary;
  - subscriptions overview + plans;
  - drugs;
  - ECG topics;
  - OSCE systems;
  - auth session read;
  - schema step for the counters row and the ECG card count (bump `CRITICAL_SCHEMA_VERSION`);
  - Fix counts.
- Frontend:
  - Gemini / ChatGPT AI pages (load on topic pick);
  - Assessments page (one request).

**Targets** (≈ = estimate)

| Page | Before (Req · Stmt · Rows examined → returned) | Target |
|---|---|---|
| Reports | 2 · 13 · 5,143 → 3,046 | 2 · ≤ 6 · ≈ 70 |
| Gemini AI | 1 · 5 · 4,007 → 1,835 | 1 · 3 · ≈ 55 on open (+ ≈ 10–40 per topic picked) |
| Subscriptions | 3 · 11 · 537 → 126 | 3 · ≤ 7 · ≈ 150 |
| Drugs | 2 · 4 · 389 → 33 | 2 · 3 · ≈ 32 |
| Dashboard | 1 · 10 · 323 → 17 | 1 · ≤ 5 · ≈ 20 |
| Users | 2 · 6 · 166 → 56 | 2 · 4 · ≈ 56 |
| Assessments | 2 · 6 · 104 → 104 | 1 · 3 · 52 |
| OSCE | 2 · 3 · 93 → 12 | 2 · 3 · ≈ 20 |
| ECG | 1 · 1 · 23 → 11 | 1 · 1 · 11 |
| **All 17 pages** | **78 · 94 · 11,120 → 5,498** | **≈ 77 · ≈ 70 · ≈ 850** |

**Changes (files)** — built
- New `backend/src/common/utils/admin-counters.ts`:
  - table `admin_counters (name, value)` with keys `users:{role}:{status}` (live accounts), `subs:{plan}:{payment_status}:{status}` (subscriptions whose student row exists) and `drugs:total`;
  - `trackSubscriptionChange` reads the rows an UPDATE will touch (by its own WHERE), then the same rows by id, and moves the counts;
  - `rebuildAdminCounters` (3 grouped reads).
- Subscriptions are counted per plan, so the "free plan" rule (from the plan's price) is applied when reading and can change without the counters going wrong.
- Writes that keep the counters:
  - `auth.service`: sign-up, Google and Apple first sign-in, free plan on sign-up, account delete (user −1 and its subscriptions cancelled);
  - `users.service`: admin create, status change (live accounts only), role change, free plan on admin create;
  - `subscriptions.service`: create (cancel-existing + insert), extend, cancel, payment update, Apple grace / renewal / expiry;
  - `drugs.service`: create, import (+inserted), delete.
- Reads:
  - Admin Hub users and active subscriptions;
  - Users summary;
  - Subscriptions overview: students and paid totals, plus expiring soon read by the `(status, end_date)` index;
  - Drugs total;
  - Reports users and subscriptions by status (no filters).
- `schema-sync.service`, version `2026-11-20.1`, three steps:
  - `admin_counters` created and filled;
  - `ecg_topics.card_count` added and filled;
  - index `idx_summary_last_active` on `student_study_summary(last_active_day)`.
- Fix counts (Structure page) rebuilds the admin counters at its last step (`lessons.service`).
- `workspace.service` (Reports):
  - one bitmap pass shared by the lesson total and the course funnel;
  - the course of the finished lessons only (by id), not every lesson;
  - lessons per course = `courses.lesson_count`;
  - inactive students: never-active first (walking user ids, stops at 10), then by the new index; deleted accounts left out.
- `quizzes.controller` / `quizzes.service`: `GET /admin/quizzes/summary?withFolders=1` returns folder rows + courses + subjects from the same two reads.
- `ecg.service`: stored `card_count` (+1 on add, −1 on delete); topics sorted in the app.
- `osce.service`: `courses.subject_count`.
- `plans.service`: plans and features sorted in the app (no `FIELD` sort pass).
- `auth.service` session reads: named columns without the password hash (3 queries).
- Frontend:
  - `AiQuizGeneratorPage.jsx` (Gemini + ChatGPT): opens with `meta?scope=folders`; topics and lessons load per picked subject (`meta/subject`), kept for the visit;
  - `QuizzesPage.jsx`: the first load uses `summary?withFolders=1`; `meta?scope=folders` only as a fallback.
- Not changed: `BulkQuestionInputPage.jsx` still loads the full editor lists. It is not in the 17-page menu sweep; noted for a later round.

**After** (same 17-page cold sweep, 2026-11-20, page requests only):

| Page | Before (Req · Stmt · Rows examined → returned) | After |
|---|---|---|
| Reports | 2 · 13 · 5,143 → 3,046 | **2 · 11 · 133 → 92** |
| Gemini AI | 1 · 5 · 4,007 → 1,835 (33 KB) | **1 · 4 · 52 → 52**; picking a subject: 1 · 4 · 40 → 40 (Cardiology) |
| Subscriptions | 3 · 11 · 537 → 126 | **3 · 12 · 188 → 144** |
| Drugs | 2 · 4 · 389 → 33 | **2 · 4 · 33 → 33** |
| Dashboard | 1 · 10 · 323 → 17 | **1 · 10 · 42 → 36** |
| Users | 2 · 6 · 166 → 56 | **2 · 6 · 57 → 57** |
| Assessments | 2 · 6 · 104 → 104 | **1 · 3 · 52 → 52** |
| OSCE | 2 · 3 · 93 → 12 | **2 · 3 · 38 → 12** |
| ECG | 1 · 1 · 23 → 11 | **1 · 1 · 11 → 11** (after the in-app sort; the sweep run itself read 22) |
| Finance · Questions · Roles · the small pages | unchanged | unchanged |
| **All 17 pages** | **78 · 94 · 11,120 → 5,498** | **79 · 86 · 963 → 758** |

- Every page shows the same figures as before (Users 61 / 60 active / 1 pending; Subscriptions 55 students / 1 pending; 659 assessments).
- The stored counters were compared with a full recount after the save run: identical.
- Targets missed:
  - Dashboard is 10 statements (target ≤ 5), at 42 rows. The 18 subscription counter rows are most of them.
  - Subscriptions overview went from 6 to 7 statements: the expiring-soon read is now its own small indexed read, at 0 rows today.
- Gemini's open read was served from the admin read memory in the sweep. Measured on its own it is 4 · 52 → 52, the same as the Questions page folder read.

**Saves** (foreground statements · rows examined, before → after; the catalogue rebuild is shown separately):

| Save | Before | After |
|---|---|---|
| Admin create student | 5 · 2 | 7 · 2 |
| User status change | 2 · 2 | 3 · 2 |
| Assign subscription | 7 · 145 | 11 · 107 |
| Cancel subscription | 3 · 2 | 6 · 4 |
| Delete user (+ cancel their subscriptions) | 8 · 9 | 10 · 11 |
| Drug create / delete | 1 · 0 / 1 · 1 | 2 · 0 / 2 · 1 |
| ECG card add / delete | 2 · 1 / 1 · 1 | 3 · 2 / 3 · 3 |

**Found while measuring (not part of 10.57, nothing changed):**
- Every `/api/admin/*` save raises the catalogue version (`isCatalogueWrite` in `content-version.ts` matches the whole `/api/admin` prefix). That includes users, drugs, ECG and subscriptions saves, none of which is in the students' lists.
- Each raise:
  - rebuilds the catalogue snapshots in the background, about 17 statements and ≈ 5,500 rows (structure, flashcard stamps, quiz list);
  - makes every phone re-download its lists on its next open.
- Proposal for the user: limit the prefix to the content routes. ➡️ Approved and built as 10.58.

### 10.58 Admin account / subscription saves no longer raise the catalogue version — ✅ BUILT locally 2026-11-20 (not committed, not deployed)

**Decisions**
- ✅ User 2026-11-20: "Yes, fix it". This answers the finding at the end of 10.57.
- Correction to that finding: drugs, ECG, OSCE and auscultation saves **keep** raising the version. The drug list students get is cached per version (`drugs.service`, 10.19), and those are study-tool content. The waste was the non-content admin resources only.

**Aims**
- An admin save of an account, subscription, setting or report status should cost only the save itself.
- No catalogue rebuild, and no phone re-download, unless student content actually changed.

**Before** (local, monitor in all-clients mode). Requests · Statements · Rows examined → returned:

| Save | Before |
|---|---|
| User status change (`PATCH /api/admin/users/:id/status`) | 1 · 10 · 1,849 → 1,848 (the save is 3 statements / 2 rows; +2 for the version bump; +5 for the structure rebuild, 1,846 rows) |
| Admin create student (`POST /api/admin/users`) | 1 · 14 · 1,849 → 1,849 |

Each one also raised `content_version` (431 → 433 across the two saves), so every phone re-downloads its lists on its next open.

**Plan / Changes (built)**
- `content-version.ts`, `isCatalogueWrite`: `/api/admin/<resource>` no longer counts as a catalogue write for `users`, `subscriptions`, `settings`, `reports`, `question-reports`, `question-review`, `dashboard` or `ai`. The middleware sees the path before the `/api/admin` rewrite, so these resources were all caught by the `/api/admin` prefix.
  - `question-reports` only writes `question_reports.status`.
  - `ai` only generates text. The save that follows goes through `questions` / `lessons` and still bumps.
- Still bumping: `drugs`, `ecg`, `osce`, `auscultation`, `plans`, `lessons`, `questions`, `quizzes`, `courses`, `topics`, `subtopics`, `papers`, `theory-recap`, `ai-notes`. These were checked one by one against the new rule.

**After** (same saves, backend restarted on the new dist):

| Save | Before | After |
|---|---|---|
| User status change | 1 · 10 · 1,849 → 1,848 | **1 · 3 · 2 → 1** |
| Admin create student | 1 · 14 · 1,849 → 1,849 | **1 · 7 · 2 → 2** |

- `content_version` stayed at 433, and background work was 0 statements.
- The test users were soft-deleted afterwards. The `users:student:*` counters still match a full recount (54 active, 1 inactive).

**Targets:** a non-content admin save = the save's own statements only ✅. Content saves are unchanged, and they still raise the version ✅.

### 10.59 Release check: homepage + student website fixes, Study Hub planner rows — ✅ BUILT locally 2026-11-20 (not committed, not deployed)

**Decisions**
- ✅ User 2026-11-20: "fix all and optimize the rows", after the release check of the homepage and student website (desktop, phone, dark mode).
- Subscription page: no change. Measured warm it is already 1 · 4 · 5 → 4. The 8 · 169 in the check was a cold read (plans memory 1 h, settings memory 10 min, both per server process, not per student).
- The `QA lesson 10.28` test lesson exists only in the local database. It was left alone. Check the live database before release.

**Aims**
- No bug a student sees on the first visit: a readable homepage menu, no blank pages, no broken Profile layout.
- Each student website page reads ≤ 5 rows when warm (except the first app start).

**Before** (local, student 972, web client). Requests · Statements · Rows examined → returned:

| Page | Before |
|---|---|
| Study Hub (full open) | 10 · 7 · 79 → 24 (`/student/planner/agenda` 3 · 74 → 20: 4 primary-key reads per finished lesson for its names) |
| Subscription (cold) | 1 · 8 · 169 → 168 |
| Subscription (warm) | 1 · 4 · 5 → 4 |
| Homepage | 3 · 1 · 61 → 61 (`settings/public` sent on every fresh load, because the popup file check failed) |

**Plan / Changes (built)**
- **Homepage menu colour.** `shared/foundation.css` had `a { color: inherit }` unlayered, which beat every Tailwind text colour on a link. The menu was dark-on-dark over the hero, the subjects strip and the footer, and "Get Started" lost its white text. The rule now sits in `@layer theme` (the lowest layer). Link colours were compared before and after on the homepage, `/try`, `/terms`, Results and a course page: only links that carry their own colour class changed, and the student pages had no changes.
- **Homepage bar over light sections.** The bar's colour sampler hit the pinned hero, which stays on top at opacity 0. It now skips faded layers, and takes one more sample 450 ms after scrolling stops (the fade is scrubbed).
- **Homepage copy.** The "coming soon… eat the budget money" joke was replaced by "Coming soon to the App Store and Google Play." It only shows while the store links in `appLinks.js` are empty.
- **Blank pages.** The idle pause (after 12 s without input) paused *every* animation, so one-time fade-ins froze at opacity 0. A page that finished loading untouched stayed blank until a tap. Now only endless animations inside the app shells are paused (`performanceProfile.js`, Web Animations API). The blanket CSS rule was removed.
- **Profile.** The "Dark / Light" pill no longer squeezes to one letter per line. The Email and Role fields use the normal input style (16 px padding).
- **Flashcards (web).** When there are no lesson decks it shows the "Continue in the app" card with the store badges, instead of empty counters and table headings.
- **Results.** Rows show the set's name, not "Exam attempt #153" (that was the set id). The score line is "2/20 correct" (correct out of the whole set; the reply now carries `totalQuestions` from the stored ids), not "2/5" (right out of answered). The Study Hub average rounds like Results (18% vs 19% before).
- **Subscription.** Amounts are shown as "17,490.00" and day counts as "359 days" / "1 day".
- **Tab title.** App pages without PageMeta now set the tab title from their page header ("Study | xyndrome"). Before, the tab kept the previous page's title.
- **Scroll reset.** The scroll-to-top on a new page used `behavior: 'auto'`, which follows `<html>`'s smooth scroll, so the jump was cut short and pages opened part-way down. It is now `'instant'`.
- **Planner rows.** `getPlannerAgenda` takes lesson, course, subject and topic names from the course structure in memory (`CourseStructureService`, 0 rows). Only a finished lesson missing from it (hidden, or no notes) is still read from the database. `WorkspaceModule` imports `CoursesModule`.
- **Popup check.** Each popup file is tried on its own. A missing static file served as HTML used to throw and skip the API file, which fell back to `settings/public`. On the live site (same origin) the API file now answers. In local dev it is cross-origin and still falls back.

**After** (backend restarted on the new dist; warm):

| Page | Before | After |
|---|---|---|
| Study Hub (full open) | 10 · 7 · 79 → 24 | **9 · 6 · 7 → 6** (planner 3 · 74 → 20 → **2 · 2 → 2**, same 1,265-byte reply) |
| Subscription (warm) | 1 · 4 · 5 → 4 | 1 · 4 · 5 → 4 (unchanged) |
| Q-Bank, Study, Results, Profile, Flashcards, Notifications | 0 | 0 |
| Planner · Course page | 1 · 1 · 1 → 1 | 1 · 1 · 1 → 1 |

- Checked in the browser:
  - homepage menu readable over the hero, the light sections, the dark strip and the footer (desktop 1280);
  - Study Hub visible while the idle pause is on;
  - switching from a scrolled Results page to Study lands at the top;
  - the Profile, Flashcards, Results and Subscription screens.

**Targets:**
- Study Hub ≤ 10 rows ✅ (7).
- Every other student web page ≤ 5 rows warm ✅.
- No homepage or student bug from the release check left open ✅, except checking the live database for the QA lesson.

### 10.60 Fix counts reads only what changed + admin release-check fixes — ✅ BUILT locally 2026-11-20 (not committed, not deployed)

**Decisions**
- ✅ User 2026-11-20: "we need to make fix counts another way without loading the whole rows", then "Do both" (the Fix counts plan and the admin release-check fixes).
- Stored counts are admin-only (students' lesson counts come from the course structure in memory), so Fix counts no longer raises the content version.
- The assessment-stamp bump (10.27 R1, needed after an SQL import) becomes a tick box, "I changed content with SQL". When ticked it bumps the stamps and raises the version once.
- Quick fix is the default. Full recount stays for rows deleted directly in SQL, which leave no `updated_at` trace.
- Not changed: the large Questions select-all checkbox (a deliberate 44 px touch target below 768 px), and the sideways-scrolling Users / Subscriptions tables (by design). The Roles "Custom access" button was measured inside its card, so it is not clipped.

**Aims**
- Fix counts should read only rows that changed since the last check, and never make phones re-download.
- No admin page without the menu; admin numbers agree between pages.

**Before** (local; one Fix counts run: Requests · Statements · Rows examined → returned)

| Part | Rows examined |
|---|---|
| Counting (subject sets) | ≈ 1,950 |
| Plan | 51 |
| Course finish | 590 |
| Course structure rebuilt **twice** (the version raise on `/api/admin/ai-notes/structure/counts/*`) | 3,692 |
| Student Q-Bank list rebuilt | ≈ 800 |
| `UPDATE quizzes SET content_stamp + 1` (every row written) | 659 |
| Admin counters rebuild | ≈ 880 |
| **Total** | **4 · 30 · 8,620 → 4,487** |

Admin release check (all 20 admin pages, 699 px and desktop):
- ECG, Auscultation and OSCE had no top bar: no menu button and a stale tab title.
- The Hub said "93 active subs" (it counted every free plan and deleted users' rows) while Subscriptions said 21.
- Drug names broke mid-word in the table.
- The Structure top chips read "0 Subjects / 0 Topics / 0 Lessons" at the course level.
- Questions "15 question(s) loaded · 0 SBA · 15 T/F" counted only the current page.
- The Announcements info box touched the first field.

**Plan / Changes (built)**
- `content-version.ts`: any `/structure/counts` path is not a catalogue write.
- `structure-counts.ts`:
  - `finishCourses(…, bumpStamps)`: the stamp bump is opt-in.
  - A "checked up to" mark (`system_settings.structure_counts_checked_at`) is saved when a full or quick fix ends.
  - New `quickCountFix`, one request:
    - rows changed since the mark, read through 4 new `updated_at` indexes (index only);
    - the existing course-vs-subject check (courses + topics), which catches a lesson moved between subjects;
    - a recount of only those subjects, then those courses' totals.
  - Falls back to the full flow when there is no mark yet or too much changed.
- `lessons.service.ts` / controller:
  - new `POST …/structure/counts/fix/quick`;
  - `start` takes `bumpStamps`;
  - the version is raised only when the stamps were bumped;
  - admin counters are rebuilt in the full flow only.
- Boot step `2026-11-20.2` (`CRITICAL_SCHEMA_VERSION` bumped) adds four indexes:
  - `idx_lessons_updated_scope (updated_at, topic_id, course_id)`
  - `idx_subtopics_updated_scope (updated_at, topic_id)`
  - `idx_quizzes_updated_scope (updated_at, topic_id, course_id)`
  - `idx_topics_updated_scope (updated_at, course_id)`

  Every structure table already stamps `updated_at` on insert and update, SQL imports included.
- Structure page:
  - "Fix counts" opens a small dialog: Quick fix (default), Full recount, and the SQL tick box.
  - The top chips use the courses' stored totals (47 subjects, 1,480 lessons), and Topics is hidden at that level.
- Admin fixes:
  - **ECG / Auscultation / OSCE:** the shared `AppHeader` (menu, tab title).
  - **Hub "active subs":** paid / manual on non-free plans, the same rule as Subscriptions.
  - **Drugs:** the Name column is at least 160 px wide and breaks only between words.
  - **Questions:** the header reads "Showing 15 questions on this page" and "… SBA here".
  - **Announcements:** a gap under the info box.

**After** (backend restarted on the new dist; same database)

| Fix counts run | Before | After |
|---|---|---|
| Full recount (first run, no mark yet) | 4 · 30 · 8,620 | **6 · 14 · 3,468** (no rebuilds, no stamp bump) |
| Quick fix, nothing changed | — | **1 · 9 · 61** |
| Quick fix after one lesson hidden by SQL | — | **2 · 17 · 333**: fixed both counts (Obstetrics 90 → 89, course 168 → 167). Undone and fixed back afterwards (90, 168). |

- `content_version` stayed at 436 through all runs.
- Admin Hub after: 3 · 12 · 52, and "21 active subs" now matches Subscriptions.
- Checked in the browser: the ECG, Auscultation and OSCE top bars and tab titles; Drugs names; the Structure chips and dialog.

**Targets:**
- Everyday Fix counts ≤ 100 rows ✅ (61).
- No phone re-download from Fix counts ✅.
- Full recount ≤ 4,000 rows ✅ (3,468).
- Admin pages all have the menu, and the Hub and Subscriptions agree ✅.

## 8. Change log

| Date | Change |
|---|---|
| 2026-11-20 | 10.60 built locally: Fix counts quick mode (only rows changed since the last check: 1 · 9 · 61) and full recount 8,620 → 3,468 (no version raise / rebuilds, stamp bump opt-in); admin release fixes (ECG/Auscultation/OSCE top bar, Hub active subs = paid rule, Drugs names, Structure chips, Questions page counts). |
| 2026-11-20 | 10.59 built locally: release-check fixes (homepage menu colour = link rule moved to @layer theme, bar over light sections, coming-soon copy; idle pause no longer blanks pages; Profile, Flashcards, Results, Subscription text; tab titles; scroll reset instant); Study Hub 79 → 7 rows (planner names from the structure in memory). |
| 2026-11-20 | 10.58 built locally: admin user / subscription / settings / report saves no longer raise the catalogue version (status change 10 · 1,849 → 3 · 2; create student 14 · 1,849 → 7 · 2; no phone re-download). Drugs, ECG, OSCE, auscultation and all content routes still raise it. |
| 2026-11-20 | 10.57 built locally: all 17 admin pages 11,120 → 963 rows examined (Reports 5,143 → 133, Gemini 4,007 → 52, Subscriptions 537 → 188, Dashboard 323 → 42, Drugs 389 → 33); stored admin counters match a full recount; found: every /api/admin save rebuilds the catalogue (≈ 5,500 rows). |
| 2026-11-20 | 10.57 approved: all 17 admin pages measured cold (78 · 94 · 11,120 → 5,498); Gemini AI form loads lessons per topic (4,007 → ≈ 55), Assessments one request, plus the 9.8 Reports / counters / small fixes; target ≈ 850 rows for the whole sweep. |
| 2026-11-16 | 10.24 planned: lists by course on demand (index carries counts), Study Hub without the quiz list, saved items and subscriptions examined = returned, lower cards from start-up; phone lists checked (649 sets 188 ms, 1,478 lessons 251 ms). |
| 2026-11-16 | 10.24 lists-by-course stopped (user: keep the two lists); its server extras (hub, course stats, index counts) and phone loaders removed; subscriptions index, saved-items rows and the shared index request kept. |
| 2026-11-16 | 10.25: lists 40.4 → 30.2 KB (format 5: id gaps, one-name quiz rows, Q-Bank topics trimmed); one quiz name (admin form, saves, schema step); bookmarks on the device (phone + website, 0 requests); website Courses 5 requests 36 KB → 1 request 0.3 KB; open site 7 · 12 → 6 · 9. |
| 2026-11-16 | 10.26: lesson images saved on the phone + long cache headers; lean quiz review 24.4 → 2.8 KB; flashcard history import 44 → 22 → 22 → 22; image re-encoding (4 %) and extra gzip (already on) checked and dropped. |
| 2026-11-16 | 10.27: per-quiz content stamp raised in the same save; quiz content kept per stamp (memory + file) → practice and review 0 quiz rows, only an edited quiz rebuilt; "reviewed" written once; phone keeps quizzes per stamp and saves a full review as the practice quiz. |
| 2026-11-16 | 10.28: one row per student — 9 per-student tables backed up and dropped locally; every student write is one UPDATE of the row (lesson, exam, flashcards, ride-along practices); today = 4 bits, streak when all 4 done; practices ride along (12 h fallback, number guard, 1 XP when passed). |
| 2026-11-17 | 10.29: today's goals, streak and Readiness on the phone (study days), no Study Hub re-ask after lesson / exam / practice; flashcards goal rides along (server streak fix); 3 exam total columns dropped; lesson continue card Q-Bank style; Readiness title. |
| 2026-11-17 | 10.30: day done counted on the phone; one `{day, kind:'day'}` mark rides along and moves the streak for its day; `today_bits` / `today_day` dropped. |
| 2026-11-17 | 10.52: demo /try rebuilt (one step at a time, one fully taught question, mini exam + review, flashcard, coming-soon tools), content in the page — 0 requests, 6.5 KB gz; follows light/dark theme. |
| 2026-11-17 | 10.51: 17 MB of unused public files deleted (built site 24 → 5.9 MB); homepage 794 → 456 KB gzipped (logo 346 → 7.7 KB); demo /try linked from hero, top bar and closing section. |
| 2026-11-17 | 10.50 F1–F3 built: plan details from memory, student sees approval at once, student subscription reads = returned (invoice 88 → 6 rows, approve 87 → 4). |
| 2026-11-17 | 10.50 measured: plan purchase with bank slip works end to end (invoice → slip file → admin view → approve → active); found fresh plan reads (84 rows ×3), stale student Subscriptions after approval; fixes proposed. |
| 2026-11-17 | 10.49: website course progress from the catalogue (app's way), server course cards removed; exam countdown card and its CSS removed. |
| 2026-11-17 | 10.48: student website ≤ 5 rows per page — settings in server memory, notices from start-up (no notifications request), popup settings only as fallback; open site 65 → 4 rows. |
| 2026-11-17 | 10.47: Missing-content filters by an indexed stored flag (11–13k rows → 0–304, seconds → ms); question edit allows no subject (null, not 0). |
| 2026-11-17 | 10.46: admin Questions + Assessments walked through after the migrations — all working; fixed detail "Linked quizzes" / "Updated" and the delete-dialog wording; open: subject required on edit, local slow log. |
| 2026-11-17 | 10.45: admin Questions list in pages of 15 (Previous / Next, keyset); each page 16 rows read (was 50 per load, piling up). |
| 2026-11-17 | 10.44: student_answers, quiz_attempts, exam_sessions, study_bookmarks, schema_migrations dropped (38 tables); admin exam stats from recent results; old exam/result/review/bookmark routes and modules removed; Reports 7,429 → 5,138 rows. |
| 2026-11-17 | 10.43 follow-up: old export route fixed (passes `missing`); question deletes keep the assessment's question total right (same statement as the stamp). |
| 2026-11-17 | 10.43 built locally: options + recap in `questions` (old 2 tables + FK dropped, 43 tables); 125 imported AI questions checked column by column on a scratch copy; practice read 159 → 40 rows; admin save 6 → 2 statements; Report button later. |
| 2026-11-17 | 10.43 planned: options + theory recap into questions (3 Q-Bank tables), stable option ids, student Report button, tests with imported AI sets. |
| 2026-11-17 | 10.42: lesson_annotations, push_subscriptions, question_keyword_map dropped; lessons.lesson_content column dropped; 45 tables, 105.4 MB. |
| 2026-11-17 | 10.41: smart_notes + account_deletion_audit dropped, smart-notes module removed (image service kept for OSCE); 48 tables. |
| 2026-11-17 | 10.40: announcements dropped; 453 old planner rows + old exam sessions removed (after the fold), exam starts clear older sessions; 50 tables. |
| 2026-11-17 | 10.39: content_versions + content_workflow_states dropped (never read); admin saves 3–4 statements lighter; 51 tables, 115.9 MB. |
| 2026-11-17 | 10.38: content_versions keeps the newest 2 copies per item (24,207 → 21,938 rows; growth capped). |
| 2026-11-17 | 10.37: lesson_flashcard_reviews dropped (backup on Desktop, schema step 2026-11-17.5); 6 more unused tables + 2 never-read audit tables dropped (62 → 53 tables, −111 MB, schema 2026-11-17.8). |
| 2026-11-17 | 10.36: flashcard progress phone-only — history import request removed (ratings had not been uploaded since 10.23). |
| 2026-11-17 | 10.35: subscriptions/me warm 5 → 4 statements (cold 12 → 8, plans loaded once); flashcard export 162 → 46 rows (own cards by primary key); lesson images fixed (image loader waited on itself). |
| 2026-11-17 | 10.34: app lesson reply without empty fields / visual_style (5.28 → 4.75 KB, gzipped 2.51 → 2.37 KB); no SQL; parser parity on all 1,479 lessons. |
| 2026-11-17 | 10.33: 9 dense lesson tables (4+ cols, long cells) turned into one card per disease, same text; guarded SQL in ~/Downloads, applied locally, backup on Desktop. |
| 2026-11-17 | 10.32 approved: phone gets the website's lesson (no reshape, no \"(continued)\" cards), tables always fit (wrap, ≥ 11.5 px, long words only split last), Video button hidden without a video. Before: 0.044 ms reshape/lesson, 5.5 KB replies, 2,329 continued cards. |
| 2026-11-17 | 10.31 approved: Question of the Day answerable on the card; stays until answered; next ones picked from saved practice sets on the phone; server asked once (1 indexed join) only when no sets are saved; removed from the lower-cards request. Before: /more 4 statements · 7 examined · 3 returned · 670 B. |
| 2026-11-16 | 10.23 app part built and measured on the iPhone: lessons / quiz lists per kind (28.7 / 11.1 KB once, 0 statements), flashcards 0 requests (cached), cards request 0 statements (files), history import skipped when none, settings in start-up, batched review saves. Phone run 11 requests · 17 statements · 185 rows. |
| 2026-11-16 | 10.23 L2 + W7 built: list parts per kind (Q-Bank 10.9 KB, Lessons 28.7 KB, once, 0 statements); website lists every title with locks, locked items open "Continue in the app" with 0 requests. |
| 2026-11-16 | 10.23 approved and extended: F5 cards as files (0 statements), F6 skip empty history import, F7 settings in start-up, F8 batched review saves, L2 list split into lessons / Q-Bank parts downloaded per screen (app + website), W7 website lists with locks. |
| 2026-11-16 | 10.23 planned: flashcards in batches of 20 ("Study 20 more", next batch fetched during the last cards), one shared list (catalogue) for app and website with locks, split-when-big and one rebuild per burst of edits. |
| 2026-11-16 | 10.22 built: website Study Hub on the app's start-up (3 statements) + light lower cards; boot no longer called; agenda 6 → 3 statements (5,883 → 54 rows); question of the day from the samples index. Full load 7 · 23 · 8,081 → 6 · 11 · 68. |
| 2026-11-16 | 10.21 built: free lessons / quizzes / flashcards from files (0 statements), browser-marked free exams, premium → "Continue in the app" with no request, no premium counts, public /try page; rules: student side by user id, no SELECT *. 10.22 (Study Hub / start-up the app's way) planned. |
| 2026-11-16 | 10.21 decided: light website — premium hidden ("more in the app"), free lessons / quizzes / flashcards as ready files (0 statements), browser-only results, one-of-each public page; mockups next. Replaces 10.20 W1–W5. |
| 2026-11-16 | 10.20 planned: student website measured page by page (monitor reset per page) against the phone; start-up 24–26 statements, Courses pre-loads every course, Q-Bank pre-loads refused premium quizzes, lesson open 7; clean-up list C1–C4. |
| 2026-11-16 | 10.16-W built locally: website exam open 9 → 1, autosave 7 → 0 requests, submit 13 → 1, results 7 → 1, Q-Bank 8 → 2, identification 3 → 0 when warm. |
| 2026-11-16 | 10.16-W website phase planned and measured (before): exam open 9, autosave 7 per save, submit 13, results 7, 3 identification statements per request. |
| 2026-11-16 | 9.9 table audit: 8 tables unused, 3 old (fills only), 3 written-never-read (111 MB content audit), 9 kept for the website's old exam flow; phone confirmed on the new tables. D1/D2/D3 recorded in 9.8. |
| 2026-11-16 | 9.8 admin re-measured with the live monitor (all pages); Reports 9,644 rows and stale since 10.16, Dashboard loaded on every page reload, session row read per request; next-round plan written, waiting for approval. |
| 2026-11-16 | 10.19 audit of study tools and background calls recorded; deferred to the next version by the user. |
| 2026-11-16 | 10.18: Results ordered failed → failed reviewed → passed; a new exam may start when any of the 5 recent results is passed and reviewed (the new result replaces the oldest such one); lock shown instantly from the phone's own data. |
| 2026-11-16 | 10.17 built locally: "result viewed" pings removed; Study Hub top 3 → 1 statement (14-day ring `days14` on the summary row); lower cards 4–6 → 2 warm (question of the day joined, no server weak areas); weak topics on the phone; sign-in about 8 → 4 (summary row read once per request). Schema `2026-11-16.2`. |
| 2026-11-16 | **10.16 proposed:** quizzes in the progress row — byte-map marks (best % + passed), 5 recent results with answers (lock: oldest must be reviewed and passed), server marking with a signed exam token (start 1 statement, answering 0, submit 1, duplicate-proof), questions as 1 joined row each, minimum-time gate on the phone. Waiting for approval. |
| 2026-11-15 | **10.15 (local):** all lesson progress in ONE table (`student_study_summary`): "Done" = **1 statement · 1 row** (bit, version, XP, streak, today's count; was 3), no per-lesson or day rows written; streak kept on the row with the same rule (18,069 + 10,093 checks, 0 mismatches); website course pages, lesson list, agenda, admin reports and older builds read the bitmap; "continue" = first unfinished lesson in course order. Schema `2026-11-15.8`. |
| 2026-11-15 | **10.14 (local):** finished lessons as ONE bitmap per student (bit = lesson id) on the summary row with a progress version; the phone keeps it cached and sends "userId:version" — lesson ticks now 1 row (was every finished-lesson row) and nothing sent when unchanged; after "Done" the phone flips the bit itself (no progress re-download); "Done" statements unchanged. Schema `2026-11-15.7`. |
| 2026-11-15 | **10.13 (local):** exam submit 14 → **7** statements (full paper) / **9** (topic quiz) after round 2 (one locked session read): attempt inserted with its scores, exam XP worked out in the quiz-row upsert and paid in the summary upsert (no XP round after the submit), one session update, full papers no longer feed the topic stats. XP checked (+20 first pass, +2 retake, 0 low score). |
| 2026-11-15 | **10.12 (local):** lesson timer on the phone (2 min; nothing sent before), "Done" 2 requests · 10 statements → **1 · 3** (repeat 1 · 1), lesson open 1 · 1; XP in ONE place (summary row; `student_xp` / `xp_events` no longer written; exam XP ≈ 9 → 3 statements); planner one row per student behind the same endpoints (open up to 256 rows → 1, every write 1 statement, reply identical). Schema `2026-11-15.6`. |
| 2026-11-15 | **10.11 (local):** Planner spinner fixed: `savedFirst`'s shared-request wrapper waited on itself, so every first load with no saved copy hung (and background refreshes never finished); regression test added. Lesson open 2 requests → **1** (`?opened=1` records the XP clock inside the lesson request; 2 statements either way). Dev timing marks from the phone reach the load monitor. |
| 2026-11-15 | **10 step 5 (local):** shared student catalogue (35 KB, 0 rows, per version) + progress by user id; lessons / Q-Bank / courses / flashcards built on the phone (identical to the old lists); Lessons subject shelf, Q-Bank one subject/series at a time; flashcards fully on the phone (FSRS on device); lesson open 7 columns by PK (17.6 → 9.4 KB) and lessons / practice quizzes kept on the phone; sign-in 4 requests → 1; token 1.9 → 0.76 KB; reply headers 1.2 → 0.5 KB; decks 9,001 → 44 rows. |
| 2026-11-15 | **10 step 4 (local):** notifications without MySQL: 30-notice JSON feed + phone inbox (start-up reply, read/cleared on the device), in-app announcements as centre card or Study Hub banner from a JSON file (one at a time by priority, once per device), plan-expiry and weekly weak-subject reminders on the phone. Notifications list 4 statements · 1,059 rows → **0**; bell 1 request per Study Hub open → **0**. Android FCM wired on the server, app side waits for Firebase files. |
| 2026-11-15 | **10 step 3b (local):** Study Hub design A: top part with the start-up request (8 statements · 9 → 9 rows, was 13 · 169 growing with every answer), lower cards in one request on scroll (8 · 12 → 12). Stored per-student summary, daily rows and 45-day course/subject/topic stats written in 4 batched statements inside the exam submit; weak areas by wrong-answer % (≥ 10 answered); question of the day by index (1 row); XP index (submit 210 → 34 rows read). Schema `2026-11-15.2`. |
| 2026-11-15 | **10 steps 2b + 3a (local):** `POST /app/start` (one cold-open request), catalogue version + day-long phone cache, subscription once a day; course structure snapshot built by one background worker in ≤ 1,000-row reads; subscription scopes carried in the token. Courses list 4,000 → **1** row, course page 1,350 → **1**. |
| 2026-11-15 | **10 step 2a (local):** signed 1 h access tokens (no session SQL per request), `POST /auth/token` renewal, database re-check kept for payments/subscriptions and account/security, instant revocation on sign-out/password/deactivate/delete; app renews quietly instead of signing out. |
| 2026-11-15 | **Section 10 approved: student app optimisation** (Flutter + student website). Live load monitor built (`tools/dev-monitor`, backend `DEV_QUERY_TRACE=1`); 12-step route baseline on the iPhone: 23 requests · 174 statements · 34,492 rows · 157 KB. Plan: signed 1 h tokens, one start-up request, phone cache, stored counts + per-student summary, notifications without MySQL, folder-by-folder lists (3 mockups per screen). |
| 2026-11-14 | **User delete → soft delete (local):** admin delete = the self-service soft delete (history kept, subscriptions cancelled); deleted accounts no longer counted or listed (Students 105 → 53 locally: 52 self-deleted accounts were counted). Schema `2026-11-14.13`. |
| 2026-11-14 | **P12 done locally:** evidence API module and its QA check removed (41,006 rows per open → endpoint gone); governance tables kept. |
| 2026-11-14 | **P11 checked (no change, all ≤ 68 rows); P12 paused:** the evidence API is guarded by the medical content QA suite's auditability check, so removing it needs a confirmation. |
| 2026-11-14 | **P10 implemented locally (Drugs):** fixed create/update 500 (undefined optional fields); pages by `(name, id)` index (page 5: 864 → **30 → 30**), total only on page 1, one-read search, select-all ids only. Schema `2026-11-14.12`. |
| 2026-11-14 | **P9 implemented locally:** Users page pages of 50 by index (212 → 101 → **52 → 52**; all 111 users reachable, was the first 100), word-start search; announcements newest-first by id with Load more (1,118 → 100 → **51 → 50**). Schema `2026-11-14.10`. |
| 2026-11-14 | **P7 implemented locally (Reports):** 60 s cache per filter set (repeat opens 4,400 rows → 0, audit entry kept); student filter searches the server (was the first 100 students). |
| 2026-11-14 | **P8 done locally:** Setup page and `GET /setup` removed (15 statements · 15,853 rows per open → 0). |
| 2026-11-14 | **P6 implemented locally (Finance):** open 6 requests · 10,645 rows · ≈745 KB → **3 · 214 · 101 KB**; totals now over all paid subscriptions (were the newest 100); gateway totals without the whole Reports request; coupons/audit only for the PDF. |
| 2026-11-14 | **P5 implemented locally (Subscriptions):** open 7 requests · 6,946 rows · 838 KB → **3 · 636 · 45 KB**; tabs load when opened; all paid subscriptions (was the newest 100 only) at 140 → 140; student search and lesson titles on demand; audit and Apple lists read only the rows shown. Schema `2026-11-14.9`. |
| 2026-11-14 | **P4 + P14 implemented locally:** Lessons page merged into Structure (add, hide/publish, Free/Draft markers, lesson search); header search moved to the server with FULLTEXT word-start search: open 4 requests · 10,727 rows · 1,035 KB → 0, then 4–33 rows per query; removed the every-lesson endpoint (8,961 rows) and the 3 old bulk reorder endpoints. Schema `2026-11-14.8`. |
| 2026-11-14 | **P13 implemented locally (push spreading):** push settings read once per broadcast instead of 2× per phone; failed tokens written once per batch; broadcasts (new content, announcements) spread over ≈3 minutes. 49 phones 106 → **7** statements; 199 phones **failed before (pool queue overflow, 0 sent)** → 19 statements, sent over 160 s. |
| 2026-11-14 | **Step 3 (P3) implemented locally:** dashboard 4 requests · 19 statements · 16,893 rows · ≈519 KB → **1 request · 9 statements · 314 → 16 rows · 1.7 KB**. Stored `courses.question_total` and `courses.quiz_total` with every save path hooked and both Fix flows extended; money numbers over all rows (fixed: they came from the first 100 subscriptions only); 3 indexes + 2 VIRTUAL flags with indexes; users summary on indexes; charts and activity feed removed. Found: hard user delete leaves orphan subscriptions (P9). Schema `2026-11-14.7`. |
| 2026-11-14 | **Step 2 (P2) implemented locally:** Questions page open 601 → **50** rows, paging "after id" (50 → 50, was capped at 200), subject list 240 → **40**, builder counts 12,998 → **40** for a subject and 38,939 → 13,103 for the whole bank. New stored `questions.quiz_count` with link hooks + Fix link counts. Corrected the plan: the 38,939 query is the quiz builder's, not the Questions page's. Schema `2026-11-14.5`. |
| 2026-11-14 | **Step 1 (P1) implemented locally:** Assessments open 38,281 → **102** rows (examined = returned), Questions lists 11,197 → **51**, subject pick 52, keyword search 20, folder pages exact (14 → 14, 50 → 50, page 2 356 → 50). Stored assessment counts with all save paths hooked, slim list + 2 indexes, Fix counts extended (3 requests, each < 1,000). Schema `2026-11-14.4`. |
| 2026-11-14 | **Read the Desktop load audits (6 files) and added 9.7:** evidence API (41,006 rows, no page calls it), push fan-out on publish (spread in batches), old bulk reorder endpoints (remove), Prepare round trips, bounded pool wait, per-request query counter, Reports tallies. |
| 2026-11-14 | **Added section 9: admin optimisation programme.** Every admin page captured in the browser and measured cold and warm (18 pages, 43 endpoints), main saves measured on throwaway draft rows, the Structure page's 12-rule recipe written down, and a page-by-page, query-by-query plan with targets and order. Found: Questions counts 38,939 rows (worst single query), Assessments meta 37,405, Setup 15,957, Subscriptions 7 requests / 830 KB, and a drug-create 500 bug. |
| 2026-11-14 | **Fix counts final (local):** 5 requests · 15 statements · 2,014 rows → **2 requests · 5 statements · 1,919 rows**, largest request 973 (< 1,000). Plan + first set in request 1, last set + finish in the last request, one index-only statement per set, packing by size, 1-minute cooldown. A hard row cap was tested and rejected (it forced a full index scan). |
| 2026-11-14 | **Fix counts in small steps (local):** start → sets of ≤ 900 rows → finish, one request at a time with a 0.3 s pause, progress bar, compare-and-set writes, one Fix at a time. Measured 1 request · 3,406 rows (all lessons locked) → **5 requests · 2,014 rows, largest 859, no locks**. Added the **7-connections-per-user** fact: pool from `.env`, new `DB_MAX_USER_CONNECTIONS` lowers the pool to floor((cap−1)/2) (3 for 7). Lesson create no longer uses a second connection while holding its transaction. |
| 2026-11-14 | **Implemented locally (not committed): counters without recounts (4.9).** No automatic recount (after saves or at startup). Each count-changing save adjusts 1–4 counter rows by id in its transaction, and text/flashcard/order/student saves adjust 0. Every save measured: recount 4 q · ≈3,440 rows → **0**. Fixed: the Flutter lesson open/complete recount bug (uncommitted code); subject edit no longer recreates topics (5A); subject and topic moves carry their lessons. Added: a strong typed-DELETE warning for cascade deletes (5B), the "Fix counts" button and endpoints, consistent lock order plus automatic deadlock retry. Add lesson back to 9 statements (lock-free rank read). |
| 2026-11-14 | **Add lesson final (local):** 9 → **8 statements**, ≈7 → **5 rows actually read** (4 warm). The existence check is folded into the count update plus the lessons foreign keys (clear 400 on bad ids, tested). The notification setting is cached in memory. Noted that the slow log undercounts multi-table statements (logged 2–3 vs real 5–7). |
| 2026-11-14 | **Add lesson trimmed (local):** 13 → **9 statements**, 5 → **3 rows examined**. One query for the course/subject/topic checks, rank + insert in one `INSERT … SELECT`, no version read for a new lesson. Counts verified exact; tests pass. |
| 2026-11-14 | **Implemented locally (not committed): gap ranks (4.9).** Every level is ranked inside its parent, 1000 apart. A move is 1 statement and no recount; add and delete adjust counts inline; the lesson list page's reorder panel is removed; course-wide lists sort subject → topic → rank; one-time conversion with order check and rollback (schema `2026-11-14.3`). Peds measured: move 105 queries + **503 failure (half-saved)** → **2 queries · 2 rows · 1 changed**. Add 12 q · 524 rows + recount 3,411 → **13 q · 5 rows**, no recount. Delete 4 requests · 67 rows + recount 3,425 → **1 request · 1 statement · 3 rows**, no recount. Added the hard rule to section 0: only lists read many rows (examined = returned); everything else stays under 5. |
| 2026-11-14 | **Fixed (local):** the structure recount's topics-per-subject statement had flipped to a 19,035-row plan. It now uses correlated index counts: recount after a save 3,607 / 22,258 → **3,409 / 3,409**, stable. Measured the Structure page writes (save, reorder, create, delete) and listed 4 proposed write improvements (4.9 "Writes"). |
| 2026-11-14 | **Implemented locally (not committed): Structure phase 3.** Course page without the course-name read (Medicine 12 → 11); a lesson opened from Structure loads by id only with its dropdowns from the page (5 req · 29 → 25 → **2 req · 2 → 2**); subjects and topics remembered per visit (revisits 0 requests). Whole visit 82 → 78 → **54 → 54**, 9 → 6 requests. Added the **"Background: what we know about the server overload"** section from earlier investigations. |
| 2026-11-14 | Rule added to section 0: **every change is measured before and after the same way and compared side by side** (earlier → current → proposed when relevant). |
| 2026-11-14 | **Implemented locally (not committed):** (1) **Structure phase 2**: stored counts, `courses.sort_order` + index, lessons sort index, subject list without join or count, `structure-counts` removed, no repeated sign-in lookup; schema version `2026-11-14.2`. Whole visit 9,631 → 1,551 before, now **56 → 56 cold / 55 → 55 warm**, examined = returned at every step. (2) **All 12 `SELECT *` replaced** with exact columns. All verification checks passed. Backend tests: all unit and regression suites pass (SQL injection, auth, access control, medical content, secrets, OWASP, Apple IAP 31/31), and the security e2e passes. The e2e's fake database was taught the shared quiz list's per-student reads and the structure recount, and its quiz-list ownership check now asserts the shared catalog has no student id while every per-student read binds the signed-in student. That e2e change was needed by the earlier pending batch (section 3), not by this change. |
| 2026-11-14 | Added **section 0, the goal for the whole app**: exact queries, no waste, no repeats; examined = returned except the listed allowed cases (counts, reports, search, random pick, small joins, small tables), each with its required handling; the list of repeats and waste found so far; and the check every change must pass. |
| 2026-11-14 | Added **1A** (target examined → returned per admin and student action at maximum optimisation, plus the stored-counts trade-off) and **1B** (careful index method + the index and schema work needed). **Corrected section 2:** the server still runs `1a010762`; new limit errors on 14 Nov, likely the old per-restart startup maintenance. Added open items: pull fixes, push burst, reorder burst, Flutter cold-start sign-out, drug spin. Structure page: Sort button hides ↑↓ until pressed; "Loading…" while lessons load. |
| 2026-11-14 | **Implemented locally (not committed):** admin Structure page (4.9). Lessons load per subject only, subjects collapsed, counts from a small cached request, one-line row actions. Measured: open page 9,398 → 1,543 rows cold / 9 warm, 960.9 KB → 0.7 KB. Whole visit 9,631 → 2,417 rows cold / 331 warm, 964.5 KB → 11.0 KB. Identical lessons and counts verified for all 47 subjects. |
| 2026-11-14 | **Approved:** admin dashboard page index review. Growth indexes `users (created_at, id)` and `user_subscriptions (created_at, id)` (4.7 step 2c, no effect at today's sizes). Rewrites: today's sign-ups as a date range, and pending requests with a limit (4.1). Most dashboard cost is `COUNT(*)` and charts, which 4.1 handles. |
| 2026-11-14 | **Approved:** index `user_subscriptions (user_id, status, end_date)` (4.7 step 2b). Measured on a temporary copy: 5–6 → 1 rows examined for a student with 28 subscription records. |
| 2026-11-13 | Notifications option (c) added: on-device cache + `afterId` check (measured 2 rows read and 0 sent when nothing is new), push updates the cache, daily full refresh. Recommended over (b). |
| 2026-11-13 | Notifications changed to last 5: announcements 6 rows; dismissals for shown keys 180 → 5 rows; subscription item 29 → ≈1 row with new index `(user_id, updated_at, id)`; weak-topic item proposed for removal; new-student edge case (1,019 rows) noted with optional fix. Total ≈12 rows per load. |
| 2026-11-13 | Notifications plan (4.8): last 10 (11 rows, 2.3 ms, 3 KB, identical first 10), dismissals for shown items only, load only when opened (web boot/header/sync, Flutter dashboard badge), subscription-expired-by-date fix. Two decisions open: bell badge and web local sync. |
| 2026-11-13 | Notifications: `ORDER BY a.id DESC` measured, 1,019 → 81 rows and 15.7 → 2.9 ms with identical results; replaces the planned `announcements` index. |
| 2026-11-13 | Index review added (4.7): 1 index to add (`announcements`), 4 exact duplicates to drop, 19 redundant prefix indexes (4 worth considering), and a method to find unused ones. Notifications measured: 1,099 rows read, 16 ms per open. |
| 2026-11-13 | File created. Live dashboard measured with `ANALYZE`: about 30,830 rows per `/admin/dashboard` open. Live logs checked: no limit errors since the fixes. Bot scan at 21:19 found nothing and wasn't related to the limit errors. |
