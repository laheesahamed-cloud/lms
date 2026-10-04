# Security Audit — 2026-10-01

Scope: NestJS backend (193 source files, 374 HTTP routes), React/Vite frontend,
Flutter mobile client, session/auth layer, SQL surface, payment flows, upload
paths, CORS/CSRF/headers, both dependency trees, repository hygiene, and the
production deploy layout.

Method: static review plus execution of all six QA security suites
(`scripts/qa/*.mjs`) and `npm audit` on both workspaces. Production was **not**
probed — see the no-production-probing rule; every item below is derived from
code, config, the repository, or a local suite run, and items that depend on
live server state are marked **verify on server**.

Supersedes the status claims in [owasp-top-10-risk-report.md](owasp-top-10-risk-report.md)
(2026-05-23), whose "zero vulnerabilities" and "`npm test` passes" lines no
longer hold.

## Summary

The application code is in good shape. The May 2026 hardening pass holds:
session handling, SQL parameterisation, the admin/student access boundary,
payment verification and upload handling all stand up to review. **The serious
findings are not in request-handling code — they are in repository hygiene and
deployment-coupled configuration.** One is critical.

| # | Severity | Finding | Where |
| --- | --- | --- | --- |
| 1 | 🔴 Critical | Live secrets committed to git inside backup tarballs | `backups/` |
| 2 | 🟠 High | Dependency drift: 14 vulnerabilities, 1 critical, 10 high | both workspaces |
| 3 | 🟠 High | Theory-recap content has no entitlement check | `theory-recap.service.ts:62` |
| 4 | 🟡 Medium | Deactivating a user does not end their session | `users.service.ts:416` |
| 5 | 🟡 Medium | Negative-security e2e suite fails; 2 test functions never run | `test/security.e2e.ts` |
| 6 | 🟡 Medium | Rate limits and audit logs record the proxy IP, not the client | `main.ts:201` |
| 7 | 🟡 Medium | Two security behaviours fail open on a single `NODE_ENV` check | `auth.service.ts`, `health.controller.ts` |
| 8 | 🟢 Low | Six residual / accepted items | see below |

---

## 1. 🔴 Live secrets committed to git

`backups/v1/` and `backups/full-online-20260527-1946/` hold split full-site
tarballs — 738 MB across 19 files — and they are **tracked in git on every
branch** (`main`, `v4`, `v5`, `v6`, `v6.3`). Both archives contain
`./backend/.env`.

Extracted and hash-compared against the current `backend/.env`. These four are
**byte-identical to the values in use today**:

| Secret | Blast radius |
| --- | --- |
| `DB_PASSWORD` | production database |
| `OPENROUTER_API_KEY` | billable AI spend |
| `VAPID_PRIVATE_KEY` | forge web push to every student |
| `APNS_PRIVATE_KEY` | forge iOS push to every student |

`SETTINGS_ENCRYPTION_KEY` holds an **older** value: anything encrypted at rest
while that key was active (PayHere merchant secret, SMTP password, APNs/FCM
credentials in `system_settings`) is decryptable by anyone holding the archive.
`database/lms.sql` inside both archives is 0 bytes, so there is no DB dump and
no user PII in them.

Why nothing caught it: `scripts/qa/secrets-regression.mjs` scans source files
and passes — it never opens archives. `.gitignore` excludes `backend/.env`
directly, but not a tarball that contains it.

Not web-reachable: the production document root is `frontend/dist`, which is
self-contained, so `.git`, `backups/`, `backend/.env` and `backend/uploads/`
all sit above the web root. The deployed dist ships no source maps and no
stray secrets.

**Fix**

1. Rotate all four secrets (DB user password, OpenRouter key, VAPID keypair,
   APNs `.p8`). Re-save any `system_settings` secret that was written under the
   old `SETTINGS_ENCRYPTION_KEY`.
2. Remove the archives from HEAD and ignore them:
   ```sh
   git rm -r --cached backups
   printf 'backups/\n*.tar.gz.part-*\n' >> .gitignore
   ```
3. If the repository has ever been shared, cloned by CI, or lived on a machine
   you no longer control, purge the blobs from history
   (`git filter-repo --path backups --invert-paths`) and force-push.
4. Extend `secrets-regression.mjs` to fail on any tracked `*.tar*`, `*.zip` or
   `*.part-*`, so a future backup cannot re-introduce this silently.

## 2. 🟠 Dependency drift

The May report recorded zero vulnerabilities in both workspaces. Current state:

**backend — 7 (4 high, 2 moderate, 1 low)**

| Package | Severity | Issue |
| --- | --- | --- |
| `xlsx` | high | Prototype pollution + ReDoS — **no patch available**; reachable from admin question import |
| `@nestjs/platform-express` | high | advisory ≤ 11.1.27 |
| `multer` | high | DoS via deeply nested field names; incomplete cleanup of aborted uploads |
| `nodemailer` | high | CRLF injection in `List-*` header comments |
| `mysql2` | moderate | unbounded zlib inflate (decompression bomb) |
| `qs` | moderate | array-limit bypass; DoS via attacker-controlled `isBuffer` |
| `body-parser` | low | invalid `limit` silently disables size enforcement |

**frontend — 7 (1 critical, 6 high)**

| Package | Severity | Issue |
| --- | --- | --- |
| `tar` | **critical** | PAX override file smuggling; crash via numeric path type confusion |
| `axios` | high | prototype pollution can inject Basic auth / alter request construction |
| `react-router` / `react-router-dom` | high | vendored turbo-stream deserialisation (SSR-only path); `__manifest` DoS |
| `form-data` | high | CRLF injection via unescaped multipart field names |
| `@xmldom/xmldom` | high | XML fragment injection |
| `brace-expansion` | high | exponential-time expansion DoS |

**Fix** — `npm audit fix` clears every one except `xlsx`. For `xlsx`, either
move the import parser behind a worker with a hard timeout and a plain-object
prototype guard, or migrate to `exceljs`. It is admin-only, which caps exposure,
but it has no upstream fix and will stay on the report.

## 3. 🟠 Theory-recap content has no entitlement check

[`theory-recap.service.ts:62`](../../backend/src/modules/theory-recap/theory-recap.service.ts)

```ts
if (!isMobileAppClient(appClient) && !(await this.isQuestionFreelyAccessible(questionId))) {
  throw new AppOnlyContentException();
}
return this.getByQuestionId(questionId);
```

The only gates are the `x-app-client` header — which
[`mobile-client.util.ts`](../../backend/src/common/utils/mobile-client.util.ts)
itself documents as forgeable ("a header can be forged by anyone calling the API
directly") — and whether the question happens to appear in a free quiz. There is
**no subscription or quiz-access check at all**, so any authenticated account can
walk integer question IDs and pull full etiology, pathophysiology, clinical
features, investigations, treatment and mnemonics.

Compare [`quiz-attempts.service.ts:765`](../../backend/src/modules/quiz-attempts/quiz-attempts.service.ts),
where the same header gate is immediately followed by a real scope check:

```ts
const accessProfile = await this.getQuizAccessProfile(userId);
if (!this.canAccessQuiz(quiz, accessProfile)) { throw new BadRequestException(...); }
```

Lessons and quizzes both do this. Theory-recap is the single place the
entitlement layer is missing.

**Fix** — pass the authenticated user id into `getByQuestionIdForStudent` and
apply the same access-profile check used for quizzes, keyed on the courses the
question's quizzes belong to. Add an e2e case asserting 400/403 for an
out-of-scope question with the mobile header set.

## 4. 🟡 Deactivating a user does not end their session

[`users.service.ts:416`](../../backend/src/modules/users/users.service.ts) sets
`status` without clearing the session:

```sql
UPDATE users SET status = ? WHERE id = ?
```

That is normally harmless, because `requireAdmin` and `requireStudent` both
re-read `status` from the database on every request. But
`requireAuthenticatedUser` ([`auth.service.ts`](../../backend/src/modules/auth/auth.service.ts))
never checks it, and 11 call sites use it. A suspended student keeps access to:

- `GET /api/theory-recap/question/:id` — study content (compounds finding 3)
- `GET /api/subscriptions` — their own billing view
- announcements list and mark-as-read (`workspace.service.ts:143`, `:239`)
- push token register / list (6 call sites in `push-notifications.service.ts`)

The May pass fixed exactly this class of bug for **staff** inside
`PermissionGuard`; students were missed, and the only test covering it
(`testInactiveStaffCannotAccessPermissionProtectedRoutes`) is staff-only.

**Fix** — reject non-`active` users inside `requireAuthenticatedUser` (any role),
and null `session_token` / `session_expires_at` in the status UPDATE for defence
in depth. Add an inactive-student e2e case.

## 5. 🟡 Negative-security e2e suite fails — two test functions never run

`node scripts/qa/api-security-negative-regression.mjs` exits **1**. Its SQL stub
does not recognise theory-recap's newer `isQuestionFreelyAccessible` query:

```
Error: Unexpected SQL in security e2e test: SELECT 1 FROM question_quizzes qq
  INNER JOIN quizzes q ON q.id = qq.quiz_id AND q.status = 'active' AND q.is_free = 1 ...
AssertionError: 500 !== 200  (test/security.e2e.ts:1449)
```

The run aborts at step 18 of 20, so these never execute:

- `testRemainingAdminPermissionBoundaries()` — `security.e2e.ts:1455–1525`
- `testRealMySqlSecurityIntegrationIfConfigured()` — `security.e2e.ts:1526+`

Same failure shape as the stall fixed in August: the suite looks present but a
block of admin-boundary assertions provides no protection. `npm test` is red
overall, so nobody can run the full battery to clear a release.

The other five suites pass: `sql-injection`, `secrets`, `owasp`,
`access-control`, `auth`.

**Fix** — teach the e2e SQL stub the `question_quizzes` × `quizzes` free-access
query, then re-run and confirm all 20 steps execute.

## 6. 🟡 Rate limits and audit logs record the proxy IP

`trust proxy` is never enabled anywhere in the app, and
[`main.ts:201`](../../backend/src/main.ts) short-circuits on `req.ip`:

```ts
return String(req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')...
```

Express always populates `req.ip`, so the `x-forwarded-for` fallback is dead
code and the real client IP is never read. Behind LiteSpeed with Cloudflare in
front, every request therefore shares one upstream IP, which means:

- **Availability:** the login bucket is `ip:<ip>:POST:/api/auth/login` at 8 per
  15 minutes. Collapsed to one IP, that is 8 logins per 15 minutes **for the
  entire user base** — any 8 attempts lock everyone out.
- **Security:** per-IP admin and content limits cannot distinguish an attacker
  from normal traffic; there is also no per-account lockout, so credential
  stuffing is only bounded by the shared bucket.
- **Forensics:** `security_access` and `content_access` log entries record the
  proxy, so the multi-device warning and rate-limit events cannot identify a
  client.

**Fix** — `app.set('trust proxy', 1)` (or `'loopback'`, matching the hop count),
prefer `CF-Connecting-IP` when Cloudflare is in front, and add a per-account
failed-login counter alongside the per-IP one. **Verify on server** how many
proxy hops sit in front before choosing the value — trusting too many lets a
client spoof `X-Forwarded-For` and evade limits entirely.

## 7. 🟡 Two security behaviours fail open on one `NODE_ENV` check

Two separate protections are keyed off the same string comparison, and both
fail **open** when it does not match:

- [`auth.service.ts:609`](../../backend/src/modules/auth/auth.service.ts) and
  [`:737`](../../backend/src/modules/auth/auth.service.ts) —
  `exposeDevCode = !emailSent && NODE_ENV !== 'production'` returns the real
  6-digit signup OTP in the JSON response whenever an email send fails, which
  makes email verification bypassable.
- [`health.controller.ts:93`](../../backend/src/health.controller.ts) —
  `requireMetricsAccess` returns early when `NODE_ENV !== 'production'`, serving
  user/course/lesson/question/attempt counts and process memory unauthenticated.

**Current live status: believed closed.** The last read-only verification
(2026-06-25, eight probes of `GET /api/health/metrics` with no token, all
returning `401 Metrics access is restricted`) showed `NODE_ENV=production` is
set and stable on the live process. The root cause then was a hosting-panel
Application mode, not the `.env` file — dotenv never overrides a host-injected
variable. So this is a **latent design risk, not a present leak**, and it is
listed here only because a single panel setting silently re-opens two holes at
once. **Verify on server** before release if the hosting plan or app mode has
changed since June.

**Fix** — gate the OTP exposure on an explicit opt-in flag, exactly as the
password-reset token already does
(`canExposeDevResetToken` requires `EXPOSE_DEV_RESET_TOKEN=true` **and**
non-production), and make `requireMetricsAccess` require a token unless an
explicit dev flag is set. Then a `NODE_ENV` misconfiguration fails closed.

## 8. 🟢 Low / residual

| Item | Note |
| --- | --- |
| Unauthenticated OSCE media — `/api/osce/ecg/:id/image`, `/sound/:id/audio`, `/media/:slug/:file` | Deliberate and documented (admin reference picker, `<audio>` carries no bearer token). Paid teaching media is enumerable by integer id; path traversal is correctly blocked. |
| `x-lms-native` opts a client out of cookie-only sessions | Returns the raw session token in the login/register/OAuth response body. Requires valid credentials first, so it is not an XSS escalation path, but it is a soft gate on an httpOnly protection. |
| Non-constant-time signature compare | `localSig !== md5sig` in `subscriptions.service.ts:1323`. Runs after merchant/amount/currency checks; network timing attack impractical. Use `crypto.timingSafeEqual` for hygiene. |
| Admin-set AI provider base URL → SSRF | Arbitrary HTTPS endpoint reachable from `normalizeAiProviderBaseUrl`. Settings-capable staff only. Already carried as a follow-up in the May report; allow-list provider hosts. |
| Dev preview pages in the docroot | `frontend/dist/dark-mode-mockups.html` and `theme-preview.html` are publicly reachable. Cosmetic; drop them from the build. |
| In-memory rate-limit buckets | Reset on restart and do not coordinate across replicas. Known; move to Redis before scaling horizontally. |

---

## What holds up

Recorded so a future pass does not re-audit settled ground.

- **Sessions** — 32-byte (`randomBytes(32)`) tokens, SHA-256 hashed at rest,
  format-validated, DB-side expiry, 1-day TTL for admins vs 7 for students,
  invalidated on password reset. Cookie is `httpOnly`, `sameSite=lax`, `secure`
  derived from the configured origin.
- **Passwords** — bcrypt cost 10 everywhere; 10 characters with upper/lower/digit
  on register, reset, change and admin-create. Reset tokens are hashed at rest
  with a TTL and single use.
- **Access control** — 374 routes; only 15 unauthenticated, all deliberately so
  (login/register/OAuth/embed/public-settings/public media). The `/api/admin/*`
  and `/api/student/*` boundaries run `requireAdmin` / `requireStudent` in
  middleware *before* routing, and `PermissionGuard` is registered globally as
  `APP_GUARD` so `@RequirePermissions` cannot be a no-op.
- **SQL** — no request input is interpolated into any query. All 15 dynamic-SQL
  sites use placeholder arrays (`IN (${placeholders})`) or field lists built from
  code-controlled keys; schema-sync DDL uses internal constants.
- **Payments** — PayHere notify verifies the MD5 signature server-side and
  matches merchant id, currency and amount against the stored transaction, then
  rejects replays. Checkout hashes are generated server-side, so a client cannot
  alter the amount. Apple IAP verifies the JWS against Apple's certificate chain.
- **CSRF / CORS** — unsafe methods carrying the session cookie are checked
  against an allow-listed `Origin` plus `Sec-Fetch-Site`; the Apple form-POST
  exemption is scoped to one callback path and backed by a state cookie.
  Disallowed origins omit CORS headers rather than throwing.
- **Headers** — the API sets CSP (`default-src 'none'`), `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`
  and CORP. The docroot `.htaccess` adds HSTS (1 year, `env=HTTPS`) and a
  two-tier CSP with **no** `script-src 'unsafe-inline'`.
- **Uploads** — payment proofs are 404'd at the static mount, served only
  through a `subscriptions.manage`-gated controller, magic-byte validated, size
  capped and forced to `attachment`. HTML and SVG are forced to download so they
  cannot execute in-origin. Path traversal is blocked by prefix checks on every
  file route.
- **Secrets at rest** — AES-256-GCM with a fresh 12-byte IV and auth tag per
  value, versioned payload, masked in admin API responses. Production startup
  refuses to boot on a weak `SETTINGS_ENCRYPTION_KEY`, a missing `DB_PASSWORD`,
  `ALLOW_LAN_ORIGINS`, or a non-public frontend origin.
- **Frontend / mobile** — exactly one `dangerouslySetInnerHTML`, on a static
  constant. Mobile tokens live in the iOS Keychain / Android
  EncryptedSharedPreferences; iOS ATS is left on (local networking only).
- **Deploy layout** — docroot is `frontend/dist`, self-contained, no source maps,
  no `.env`, no `.git`, no SQL.

## Verification commands

```sh
node scripts/qa/sql-injection-regression.mjs            # pass
node scripts/qa/secrets-regression.mjs                  # pass (blind to archives — finding 1)
node scripts/qa/owasp-regression.mjs                    # pass
node scripts/qa/access-control-regression.mjs           # pass
node scripts/qa/auth-regression.mjs                     # pass
node scripts/qa/api-security-negative-regression.mjs    # FAILS, exit 1 — finding 5
npm audit --omit=dev --prefix backend                   # 7 — finding 2
npm audit --omit=dev --prefix frontend                  # 7 — finding 2
```

## Suggested order of work

1. Rotate the four live secrets and drop `backups/` from the repo (finding 1).
2. `npm audit fix` in both workspaces; decide on `xlsx` (finding 2).
3. One commit for findings 3, 4 and 5 — all three are small, related to the same
   service, and verifiable locally once the e2e stub is fixed.
4. `trust proxy` plus a per-account login counter (finding 6), after confirming
   the hop count on the server.
5. Move the OTP and metrics gates onto explicit flags so they fail closed
   (finding 7).
