# Xyndrome — SQL Query Execution Audit (read-only)

## Summary of findings (read this first)

Method: static code audit plus a SELECT-only measurement on the **local** database (script: `docs/sql-audit-measure.cjs`, local only, never run against production). No application files were changed.

| # | Finding | Status | Priority |
|---|---|---|---|
| B1 | Lesson/topic/subtopic reorder sends N parallel UPDATEs, no transaction; admin page sends the whole course (local max 520 lessons). Local test: 300 updates → 196 fail. | **Confirmed** | **Fix first** |
| B2 | `hasFeatureAccess` ignores its key; same query runs 3x on quiz list/start. Local test: 30 → 10 queries for 10 students. | **Confirmed, small** | Fix second |
| B3 | Exam-submit fallback takes a 2nd pool connection while holding one. Re-checked: only reachable via an almost-impossible session change. | Code smell, not observed | Low (cheap hardening) |
| B4 | Push fan-out unbounded | Not measured | Low/Medium |
| B5 | Boot ~30–36 queries, access profile read 4+ times | Estimate | Medium |
| B6 | Planner 4-way burst | Estimate | Low |
| U1 | Admin Reports heavy aggregates, uncached | **Unknown**, local data too small to judge | Measure at the 13–14 Nov incident times |
| U2 | Production pool size (code default 4, `.env.example` 6) and Passenger process count | **Unverified** | Check now |
| U3 | Real queries per request | Unmeasured | Add instrumentation |

Already in place (no fix needed): releases of all `getConnection()` calls, session cache (10s), pool shutdown on SIGTERM, capped dashboards (limit 3), and a global 503 + Retry-After for DB overload including "Queue limit reached".
Still missing: a bounded wait when acquiring a pool connection.

Context from the user (not verified by me): five MySQL Governor CPU events on 13–14 Nov 2026 at 535–570 vs a limit of 400. They prove SQL CPU was the resource exceeded; they do not identify the statements, and none of the findings above is proven to be their cause.

Sections 1–7 are the original audit, 8 the local measurements, 9 the bug list, 10 the exam-fallback re-check, 11 the follow-up plan items and rollout phases.

Date: 2026-11-14. Sections 1–7 are a static code audit (no files changed, nothing run). The only queries run were the SELECT-only local tests in section 8.
Query counts are **estimates from code**; they need runtime measurement to confirm.

## 1. Execution methods

| Method | Evidence | Frequency |
|---|---|---|
| Sequential (`pool.execute` borrows a connection per query) | ~825 call sites | Most common |
| Parallel (`Promise.all` / `allSettled`) | ~31 sites in 20 files | Moderate |
| Capped parallel (`runInBatches`, limit 3) | `dashboard.service.ts:160,597`, `workspace.service.ts:711` | Few |
| Transactions (`getConnection`) | ~48 sites, 13 files, mostly admin writes | Rare |

Overall: **mixed**, sequential dominates. `await` alone does not hold a connection between queries.

## 2. Pool configuration (verified)

- One pool per process: `backend/src/database/database.module.ts:59`. `scripts/migrate.mjs` opens one-off connections only.
- `connectionLimit`: code default **4** (`config/database.config.ts:13`), `.env.example` says **6**, local `.env` unset. **Production value unverified.**
- `waitForConnections: true`, `queueLimit: 100` (101st waiter errors), no acquire timeout (waits unbounded), `maxIdle: 1`, `idleTimeout: 10s`, `connectTimeout: 10s`.
- `pool.end()` on SIGTERM (`database.module.ts:41`).
- Every `getConnection()` has a matching `release()` in `finally`: no leaks found.
- Session lookups cached 10s (`auth/session-cache.ts`). `/api/health` uses no DB.
- No cron jobs; one 5-minute `setInterval` (DrugsService) with one cheap read.

## 3. Endpoints

| Endpoint | Current method | Queries/request (est.) | Peak demand | Recommended | Reason |
|---|---|---|---|---|---|
| `GET boot` (`boot.service.ts:28`) | `allSettled` of 6 services | ~30–36 cold | ~10–12 | Cap at 2–3 / share access lookups | Over-requests pool; access profile read 4+ times |
| Student dashboard (`dashboard.service.ts:597`) | `runInBatches` 13 tasks, limit 3 | 13–18 | 3 | Keep | Well capped |
| Admin dashboard (`:160`) | `runInBatches` limit 3, charts cached 5 min | 11 (7 cached) | 3 | Keep | Good |
| Quiz list (`quiz-attempts.service.ts:244`) | `Promise.all` x3 then sequential | ~7 | 3 | Single query | 3 identical queries |
| Start quiz (`:434`,`:451`) | 2 parallel waves | 8–10 | 3 | Dedupe feature checks | Same duplicate |
| Exam save/submit (`:483`,`:568`) | Parallel auth, short transaction | 10–12 | 3 then 1 | Keep | Questions loaded before connection taken |
| Student lesson list/open (`lessons.service.ts:2831`) | Sequential, catalog cached | 2–3 | 1 | Keep | Light |
| Planner agenda (`workspace.service.ts:343`) | `Promise.all` of 4 | 5 | 4 | `runInBatches(…,2)` | 4-way burst equals pool |
| Admin reports (`workspace.service.ts:711`) | `runInBatches` limit 3, 10 aggregates | 10 | 3 | Cache like dashboard | Highest CPU risk |
| Admin user detail (`users.service.ts:183`) | `Promise.all` of 4 | 5 | 4 | Keep | Rare, admin only |
| Reorder lessons/topics/subtopics (`lessons.service.ts:1623`, `topics.service.ts:269`, `subtopics.service.ts:487`) | `Promise.all` of N UPDATEs, no transaction | N (50–300) | N | One `UPDATE … CASE` in a transaction | Can exceed queueLimit; not atomic |
| Push to all devices (`push-notifications.service.ts:380`) | `Promise.all` over all tokens | up to token count | burst | `runInBatches(…,5)` | Unbounded |
| Publish lesson/quiz/paper | Transaction, notify after commit | 5–15 | 1 | Keep | Atomicity needed |
| Login/signup/delete account | Sequential; delete is a transaction, bcrypt outside | 2–6 | 1 | Keep | Correct |
| Subscriptions/payments | Transactions release correctly | not inspected in depth | 1 | Follow-up read | |

### Key findings
1. **Duplicate query:** `hasFeatureAccess` ignores its feature key (`plans.service.ts:336`). `listQuizzes` calls it 3x in parallel (`quiz-attempts.service.ts:246`) = same SQL three times.
2. **Reorder bug:** more than ~100 items exceeds `queueLimit` and fails partway; no transaction so the order is left half-applied.
3. **Residual deadlock risk:** `submitExam` fallback `loadQuestionsForExamSession` (`quiz-attempts.service.ts:612`) uses the pool while a transaction connection is held. Rare, but N simultaneous hits with pool size N deadlock.
4. **Reports page:** heavy joins and `GROUP BY` (hard questions, inactive students) with no cache; likeliest CPU spike source.

## 4. Simulation: 10 students x 4 queries, pool of 6 (theoretical)

| Scenario | Peak demand | Real connections | Waiting | Result |
|---|---|---|---|---|
| Sequential | 10 | 6 | 4 briefly | 40 queries drain in ~7 rounds. Safe |
| Parallel (x4 each) | 40 | 6 | 34 | No host-cap breach (queue < 100). Same total work; early bursts delay others |
| Transaction (1 each) | 10 | 6 | 4 for whole transaction | Deadlock if any transaction needs a 2nd pool connection |

Pool exhausted: FIFO queue, no timeout, 101st waiter errors. Parallelism never exceeds pool size; it only adds queueing and bursts of concurrent MySQL threads (the CPU pattern the Governor reacts to).
Restart overlap = 2 pools: 12 connections at limit 6, 8 at limit 4.

## 5. Answers

1. Most used: sequential pool-level queries.
2. Pool of 6: safe for one process only; 4 is safer if the host cap is ~10.
3. Unnecessary parallel: quiz-list feature checks, start-quiz/exam auth repeats, boot fan-out, the three reorders, push fan-out.
4. Connections held too long: none in student flows (except the `submitExam` fallback above).
5. Multiple processes: **unverified.** Restart via `tmp/restart.txt` suggests Passenger, which may run several instances; instances x pool could pass the cap.
6. See recommendations.

## 6. Recommendations (prioritised)

**Fix now**
1. Replace the three reorder `Promise.all`s with one `UPDATE … CASE` inside a transaction.
2. Confirm production `DB_CONNECTION_LIMIT` and Passenger max instances.

**Soon**
3. Collapse the 3 identical `hasFeatureAccess` calls into one (also in start-quiz and exam auth).
4. Cache admin reports (`workspace.service.ts:711`) via `cachedAdminRead`.

**Optional**
5. Cap boot, planner and push fan-outs with `runInBatches`; share one subscription lookup across boot branches.
6. Remove the nested-pool fallback in `submitExam`.

**Leave alone:** dashboards, transactions, connection release handling.

## 7. Not verified / measurement needed
- Production pool size and process count.
- Real queries per request: slow-query log or a counter around the pool for a day.
- MySQL cost: `EXPLAIN` on the reports aggregates; `Max_used_connections` and `Threads_connected` on the host.
- Subscription, payment, settings and OSCE endpoints not read in depth.

---

# 8. Verification results (local database, SELECT-only, 2026-11-14)

Tested against local `lms_db` with a scratch script; nothing written, production untouched.
Timings are from an idle local machine, so treat them as relative.

| Fix | Before | After | Verdict |
|---|---|---|---|
| Lesson reorder | 150 updates: 104 run, 46 fail. 300 updates: 104 run, **196 fail** ("Queue limit reached") | 1 statement in 1 transaction, 0 failures | **Needed** |
| Duplicate feature check (10 students at once) | 30 queries, 45 ms | 10 queries, 14 ms | **Needed, small** |
| Exam-submit nested-pool fallback | not measured | not measured | Optional hardening |
| Admin reports | not measured (local data too small: 111 answers, 16 attempts) | not measured | Unknown: measure on production data first |

Reorder detail: 100 parallel updates all succeed; 150 is where failures start (pool 4 + queue 100 = 104 accepted).
The admin page sends the **whole course** on every arrow click (`frontend/src/surfaces/admin/pages/ai-notes/AdminAiNotesListPage.jsx:171-179`).
Largest local course = 520 lessons, so one click ≈ 520 updates, ≈ 416 would fail, and with no transaction the saved order is half-applied.
Not yet confirmed: whether production has a course that large, and the live endpoint behaviour (test used SELECTs shaped like the updates).

# 9. Bug list and fixes needed

## Confirmed bugs (fix)

### B1. Lesson reorder overflows the pool queue — HIGH
- **Where:** `lessons.service.ts:1623` (`canvasReorderLessons`); same pattern in `topics.service.ts:269`, `subtopics.service.ts:487`.
- **Problem:** `Promise.all` of N single-row `UPDATE`s, no transaction. Above ~104 items updates fail and the order is left half-applied.
- **Fix:** Build one `UPDATE lessons SET sort_order = CASE id WHEN ? THEN ? … END WHERE id IN (…)` inside a single transaction (chunk at ~500 ids). Apply the same to topics and subtopics.
- **Optional:** the UI could send only the changed range instead of the whole course.
- **Acceptance:** reorder 520 lessons → 1 statement, 0 errors; result identical to the old per-row values `(index+1)*10`.

### B2. Duplicate subscription check run 3x — MEDIUM
- **Where:** `plans.service.ts:336` (`hasFeatureAccess` ignores its feature key); called 3x in parallel at `quiz-attempts.service.ts:246`, and repeated in start-quiz (`:451`) and exam auth (`:489`).
- **Fix:** call it once and reuse the result (or drop the unused key parameter and reuse). Behaviour unchanged since feature gating was removed.
- **Acceptance:** quiz list issues 1 check instead of 3.

## Risks (fix if cheap)

### B3. Exam-submit fallback takes a second pool connection while holding one — LOW (rare)
- **Where:** `quiz-attempts.service.ts:~612` (`loadQuestionsForExamSession` inside the transaction fallback).
- **Problem:** only runs if the session changed between the pre-read and the locked read; enough simultaneous hits can deadlock the pool.
- **Fix:** pass the transaction `connection` to the loader, or re-read after commit/rollback instead of inside the transaction.

### B4. Push fan-out is unbounded — LOW/MEDIUM
- **Where:** `push-notifications.service.ts:380` (`Promise.all` over every token, plus a DB write per failed token).
- **Fix:** `runInBatches(tasks, 5)`; or collect failures and write them in one statement.

### B5. Boot endpoint over-requests the pool — MEDIUM
- **Where:** `boot.service.ts:28` (6 services in parallel, ~30–36 queries cold; subscription access profile read 4+ times).
- **Fix:** cap the branches (2–3) and share one subscription lookup across them.

### B6. Planner agenda 4-way burst — LOW
- **Where:** `workspace.service.ts:343`.
- **Fix:** `runInBatches(…, 2)`; measure latency before and after.

## Unknown (measure first)

### U1. Admin Reports CPU cost
- **Where:** `workspace.service.ts:711` (10 aggregates, limit 3, no cache).
- **Needed:** `EXPLAIN` on production data or the slow-query log from the time of the 535–570% spikes. Then index and/or cache with `cachedAdminRead`.

### U2. Production pool size and process count
- Check live `DB_CONNECTION_LIMIT` (code default 4, `.env.example` 6) and Passenger max instances. Instances × pool must stay under the host cap (10–15); two overlapping pools of 6 = 12.

### U3. Real queries per request
- Add a per-request query counter/timer around the pool, or enable the slow-query log, for a day.

## Hardening (after the above)
- Add a bounded wait for pool acquisition (no timeout exists today) and log requests that wait long.
- Consider pool 4 if the host cap is ~10.

## Suggested order
1. B1 reorder fix → 2. B2 duplicate check → 3. U2 verify production settings → 4. U1 measure reports → 5. B3, B5, B4, B6 → 6. hardening.

Do not try to make everything sequential: one expensive query still burns CPU. Keep useful parallelism and transactions; remove duplicate and uncontrolled work.

---

# 10. Re-check of the exam-submit fallback (B3) — priority confirmed LOW, not P0

Code re-read (`quiz-attempts.service.ts:568-645`, `:1132-1150`, `:1554-1600`):

- Questions are loaded **before** the transaction connection is taken (`preQuestions`). The nested-pool path only runs when `sameSession` is false.
- `sameSession` is false only if (a) the session was not `in_progress` at the pre-read but is `in_progress` at the locked re-read, or (b) its `question_ids_json` differs between the two reads.
- (a) is effectively impossible: statuses only move `in_progress → submitted/expired`, never back, and `ensureExamSession` has just run.
- (b) would need a concurrent write to the same student's session. For dynamic quizzes the ids are written during the pre-read and copied onto `preSession` (`:1148`), so both reads match.
- Column type verified: `exam_sessions.question_ids_json` is `LONGTEXT` (string), so the `===` comparison is valid. If it were a JSON column the comparison would always fail and the fallback would run every time; it does not.
- Worst case if it did fire: the fallback loader uses the pool (`this.db`) while the transaction holds a connection, and for an unseeded dynamic quiz it also issues an `UPDATE exam_sessions` on the row the transaction has locked `FOR UPDATE` (a self-wait until lock timeout).
- To starve the pool, as many students as the pool has connections (4 default, 6 if configured) would have to hit this at the same moment.

Verdict: real code smell, not an observed or likely failure. Keep as a cheap hardening fix (pass `connection` to the loader, or re-read after rollback). Do not rank above the reorder fix (B1). No measured number exists for it.

# 11. Items from the follow-up plan (new) and how each was checked

| Item | Status | Notes |
|---|---|---|
| Governor evidence: 5 CPU events on 13–14 Nov 2026, 535–570 vs limit 400 | Reported by user, not verified by me | Proves SQL CPU was the exceeded resource; does not identify the statements. Match the timestamps to the slow-query log / host logs. |
| Overload handling | **Already exists** | `common/filters/database-exception.filter.ts` maps `ER_CON_COUNT_ERROR`, `ER_USER_LIMIT_REACHED`, `max_user_connections`, and the message "queue limit reached" to a **503 + Retry-After: 3**. The auth middleware (`main.ts:~770`) does the same. A reorder that overflows the queue therefore returns 503, not a crash, but updates that ran stay saved. |
| Missing: bounded pool-acquire wait | Still open | mysql2 has no acquire timeout; waiters queue until a connection frees or the queue (100) is full. |
| Instrumentation (pool active/idle/waiting, SQL per request, p50/p95) | New, not built | Wrap the pool in one place to count queries per request; log slow ones. Do not log parameters. |
| Remove unused admin-dashboard calculations | New, not checked | Needs a read of what the admin dashboard UI actually displays. |
| Duplicate lesson-catalog requests; `engine`/`engineKey` mismatch (web) | New, **not verified by me** | Frontend finding from the user's plan. Check the network tab before changing. |
| Flutter lessons pagination (course → subject → first 50 summaries) | New roadmap | Replace every consumer of the full catalog (search, planner, flashcards, dashboard) before removing it. |
| Admin lessons/assessments: summary first, detail on demand | New roadmap | Keep old clients working during the transition. |
| Startup: move repeated schema inspection / ALTER / subscription reconcile out of normal boot | New roadmap | The boot gate `CRITICAL_SCHEMA_VERSION` already limits repeats; verify what still runs on every start. |
| Caches with invalidation + ETag; indexes from real `EXPLAIN` | New roadmap | Never cache authorization, subscriptions or per-student progress across users. |
| Deep audit of subscriptions, payments, settings, OSCE | New | Not read in depth so far. |

## Rollout phases
- **A. Measure (read-only):** production `DB_CONNECTION_LIMIT`, Passenger max instances, slow-query log at the 13–14 Nov timestamps, per-endpoint query counts.
- **B. Cheap work reduction:** B2 duplicate check, B5 boot lookups, unused calculations.
- **C. Correctness:** B1 atomic reorder (first), then B3 hardening, bounded pool wait.
- **D. Data-loading redesign:** pagination and summary APIs for web, Flutter and admin, with backward compatibility.
- **E. Verify:** load test 10 / 25 / 50 active students including a restart overlap; compare before/after; beta first, with backup and rollback. No benchmark numbers are claimed until measured.

## Priority after re-check
1. **B1** reorder (confirmed: ~196 of 300 updates fail locally).
2. **B2** duplicate feature check (confirmed: 30 → 10 queries for 10 students).
3. **U2** production pool size and process count.
4. **U1** reports: measure at the incident timestamps before optimizing.
5. B5, B3, B4, B6, instrumentation, then Phase D.
