# Security review — 2026-11-05

Follow-up to [security-audit-2026-10-01.md](security-audit-2026-10-01.md). Scope: the
student side, the admin side (privilege escalation and takeover paths), and
everything that changed in the 195 commits since the last audit.

Method: static code review, the six QA security suites, `npm audit`, and a
route-by-route scan of all backend controllers for endpoints with neither a guard
nor a login check. Production was **not** probed (see the no-production-probing
rule); items that depend on live server state are marked **verify on server**.

## Status of the 2026-10-01 findings

| # | Finding | Now |
| --- | --- | --- |
| 1 | Secrets committed in `backups/` | **Partly fixed.** Archives are no longer tracked at HEAD and are in `.gitignore`, but they are still in git history (pack is ~1 GiB). Rotation is unconfirmed. |
| 2 | Dependency drift | **Open.** See finding 4 below. |
| 3 | Theory recap had no entitlement check | **Fixed** (`studentCanReadQuestion`), now covered by a test. |
| 4 | Deactivating a user kept their session | **Fixed** (`users.service.ts` clears the session). |
| 5 | Negative-security e2e suite failing | **Fixed in this review** (stale test stubs; suite passes). |
| 6 | Rate limits keyed on the proxy IP | **Still open** (no `trust proxy`). See finding 1. |
| 7 | Dev OTP / reset echo fails open on `NODE_ENV` | **Fixed** (explicit opt-in flag). |

## Fixes applied after this review

| Finding | Status |
| --- | --- |
| 1 Rate limit sees proxy IP | **Fixed.** `trust proxy` now set (default `loopback`; override with `TRUST_PROXY`, see `.env.example`). Set it to the real hop count on the server. |
| 2 Secrets in git history | **Open, needs you.** Rotate DB password, OpenRouter key, VAPID and APNs keys, then purge history and force-push. |
| 3 Per-account lockout | **Fixed** (10 failures / 15 min, in-memory per process). **2FA for admins is still open** (a feature, not a patch). |
| 4 Dependencies | **Mostly fixed.** nodemailer 10.3.1, multer 2.5.0, Capacitor 8.6.0, `npm audit fix`; frontend audit is clean. **`xlsx` remains** (no fixed npm release; admin-only, 5MB cap). |
| 5 Password change keeps sessions | **Fixed** on profile change and admin edit; web signs out after a change. |
| 6 Default unlock code | **Fixed.** No built-in code; constant-time compare. Set a code in admin settings. |
| 7 Enumeration | **Partly fixed.** Login timing equalised. Registration "email already exists" is unchanged. |
| 8 Payments | **Fixed.** Constant-time signature compare and an atomic "claim" update. |
| 9 Deletion wording | **Fixed on web** (dialog, privacy policy). Flutter dialog not changed. |

Also added: upload size limits on lesson PDF, canvas image and drug import.
Tests added in `test/auth-regression.ts` and `test/security.e2e.ts`.

## New findings

### 1. 🟠 High (verify on server) — rate limiting may see one IP for everyone
`main.ts` keys the limit on `req.ip`, and Express has no `trust proxy` setting.
Behind LiteSpeed every request then arrives from the proxy's address. Login allows
8 attempts per 15 minutes per key, so if the key is the proxy's address, **any 8
login attempts by anyone block every user, admins included**. It is also a trivial
denial of service against the admin login.

*Verify:* in the server's stderr log, look at the `ip` field of `api_rate_limited`
lines. If it is always `127.0.0.1` / the proxy address, this is confirmed.

*Fix:* `app.set('trust proxy', <number of proxy hops>)` so `req.ip` is the real
client. The hop count must match the real chain, otherwise `X-Forwarded-For` can
be spoofed to dodge the limit.

### 2. 🟠 High — secrets still in git history
The tarballs under `backups/` held `backend/.env` with the live DB password,
OpenRouter key, VAPID and APNs private keys. They are untracked now, but anyone
with a clone (or the remote) still has them. **Rotate all four**, then purge
history (`git filter-repo --path backups --invert-paths`) and force-push, or treat
the repo as compromised for those secrets.

### 3. 🟡 Medium — no per-account lockout and no second factor on admin accounts
Only the per-IP limit protects login. A slow, distributed guess against an admin
account is never throttled per account, and there is no 2FA. Add a per-account
failed-attempt counter with growing delay, and TOTP for admin/staff.

### 4. 🟡 Medium — dependencies
* `nodemailer` (high, several advisories) — upgrading is a breaking change; we only
  send fixed templates to the account's own address, so practical exposure is low.
* `@nestjs/platform-express` → `multer` (high, upload DoS).
* `xlsx` (high: prototype pollution, ReDoS) — **no fixed version on npm**; used only
  for the admin drug import, so a malicious spreadsheet needs an admin to upload it.
* Frontend: `@capacitor/android` and `@capacitor/ios` flagged critical. The app is
  Flutter now; if Capacitor is no longer built, remove these dependencies.

### 5. 🟡 Medium — changing a password does not end other sessions
`resetPassword` clears the session, but `changePassword` (profile) and an admin
editing a password in `users.update` do not. A stolen session survives the password
change (students 7 days, staff 1 day). Clear the session on both paths and return a
fresh token for the current device.

### 6. 🟢 Low — hard-coded default "launch mode" unlock code
`settings.service.ts` falls back to `1122334455` when no code is configured. It only
reveals the admin login path (admin still needs credentials) and is not a bypass,
but it is guessable. Set a real code in settings, or have it fail closed when unset.

### 7. 🟢 Low — account enumeration
Registration says "An account with this email already exists", and login returns
faster for an unknown email (no password hash is computed). Use a generic response
and hash against a dummy value on the unknown-user path.

### 8. 🟢 Low — payments
PayHere's signature is compared with `!==` rather than a constant-time compare, and
the "already paid" check is not atomic, so two simultaneous duplicate notifications
could both pass it. The signature, amount, currency and merchant checks themselves
are correct.

### 9. ℹ️ Our own change: retained payer emails
Payment records now keep the payer's email after the account is deleted. The delete
dialog still says the name and email are removed; update that wording and the
privacy policy.

## What was checked and holds

* **Admin boundary:** only 18 of the ~380 routes are open without a login, and
  every one is intentionally public (health, sign-in/reset, public catalogue,
  signed media, webhooks). Role changes and staff access are admin-only; staff
  cannot edit accounts above their level; deactivation ends the session.
* **Webhooks:** PayHere verifies merchant, currency, amount and signature. Apple
  notifications verify the full certificate chain against a pinned Apple root.
* **Files:** OSCE media uses signed URLs plus a strict file-name pattern and a
  folder check; marketing images and payment proofs are validated (payment proofs
  by file signature, not just by name or type).
* **Injection:** SQL is parameterised (suite passes); the YouTube embed validates
  the id and ships a hash-only CSP; the only raw-HTML sinks are two reviewed ones.
* **Headers:** `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
  `Permissions-Policy`, an origin allow-list for CORS and CSRF on unsafe methods.

## Test suite changes in this review

The suites that guard the above were failing or crashing, which means no
protection. Fixed:

* `test/security.e2e.ts` — stub updated for the profile-setup query and the
  theory-recap entitlement queries; the suite now runs to the end.
* `test/access-control-regression.ts` — recap and bookmark mocks updated for the
  entitlement check, and a new test that a student with **no plan is refused a
  premium recap even when sending the mobile header**.
* `scripts/qa/owasp-regression.mjs` — the new course-icon component
  (`SubjectIcon.jsx`) is a reviewed raw-HTML sink: its markup is only the bundled
  SVG files, and the script now also scans those files for scripts and handlers.

All six suites pass: access-control, API negative, auth, OWASP, secrets, SQL.
