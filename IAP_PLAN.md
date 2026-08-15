# Apple In-App Purchase (StoreKit 2) — Implementation Plan

**Status:** Planning
**Trigger:** App Store rejection, Submission ID `d769ec36-9234-4ea0-b3b3-ad75826cc4d1` (July 15, 2026) — Guideline 3.1.1.
**Target:** Build `1.0.0+2`, resubmitted together with 3 subscription products.

---

## 0. Why we were rejected, and what actually fixes it

Apple's message:

> Once the user's free trial has expired, the subscription is not available for
> purchase using In-App Purchase and the user is directed to payment mechanisms
> other than In-App Purchase.

Guideline **3.1.1** (verified from developer.apple.com):

> If you want to unlock features or functionality within your app … you must use
> in-app purchase. Apps may not use their own mechanisms to unlock content or
> functionality, such as license keys …

Guideline **3.1.3(b) — Multiplatform Services**:

> Apps that operate across multiple platforms may allow users to access content,
> subscriptions, or features they have acquired in your app **on other platforms
> or your web site** … **provided those items are also available as in-app
> purchases within the app.**

### The key consequence for this project

The existing **web / PayHere / bank-transfer** subscriptions are **allowed to keep
working**, and users who bought there may keep using the app — **but only because
IAP will now also exist inside the app**. 3.1.3(b) is the clause that legalises the
Sri Lankan bank-transfer flow. Today we fail it because IAP does *not* exist.

So the fix is **additive**, not a replacement:

| Path | Before | After |
| --- | --- | --- |
| Buy inside iOS app | ❌ impossible → **rejection** | ✅ StoreKit 2 IAP |
| Buy on website (card / bank transfer) | ✅ works | ✅ still works, now legal under 3.1.3(b) |
| Admin-granted access (demo, staff) | ✅ works | ✅ unchanged |

### Hard rule for the app UI

Anywhere inside the iOS app we must **never** show a price, button, or link that
sends the user to the website to pay. The iOS purchase path is IAP **only**. The
website keeps selling independently; the app simply never points at it.

---

## 1. Current state (verified against the codebase)

### Backend — already 90% ready

`user_subscriptions` (from `backend/src/modules/schema/schema-sync.service.ts`):

```
id, user_id, plan_id, assigned_by, notes,
status         ENUM('active','pending','expired','cancelled'),
payment_status ENUM('manual','paid','unpaid','free_plan'),
amount_paid, payment_method VARCHAR(80), payment_reference VARCHAR(191),
payment_date, receipt_url,
access_scope ENUM('all','courses','lessons'), course_ids_json, lesson_ids_json,
start_date, end_date, created_at, updated_at
```

**No schema change is needed for the subscription itself.** An IAP subscription is
just a row with `payment_method = 'apple_iap'`. Reusable building blocks that
already exist in `subscriptions.service.ts`:

- `createSubscription(...)` (line ~1586) — transactional insert + cancels the
  previous active row. Already accepts `paymentMethod` / `paymentReference`.
- `handlePayHereNotification(...)` (line ~1298) — the exact shape our Apple
  server-notification handler should follow.
- `getStudentBilling(userId)` (line ~881) — powers `GET /subscriptions/me`, which
  the app already reads.

### Flutter — deliberately built with no purchase UI

- `mobile/lib/features/subscriptions/subscriptions_page.dart` — header comment
  says *"ACCESS-ONLY by design: there is intentionally NO in-app purchase, price,
  checkout, or link to pay."* Renders `_PlanCard` with **no price** and no button.
- `mobile/lib/widgets/locked_view.dart` — shows *"This is included with a
  subscription."* with no way to buy. **This exact screen is what the reviewer
  hit after the trial expired.**
- `mobile/lib/features/subscriptions/subscriptions_repository.dart` — `SubPlan`
  already carries `effectivePrice`, `currency`, `billingPeriod`, `durationDays`.

### The build-environment constraint that drives the biggest decision

Per project memory (`flutter-ios-build-env`): **CocoaPods is broken on this
machine** (ruby 2.6 + activesupport 6.1). Adding a pubspec dependency that ships
native iOS code — such as `in_app_purchase` — **will fail the build here.**

The proven workaround already used twice in this repo is a **MethodChannel to a
system framework, with no pod**:

- `mobile/lib/data/apple_auth.dart` → `MethodChannel('app.xyndrome.lk/apple_auth')`
  → `AuthenticationServices` in `AppDelegate.swift`.

**Decision: implement StoreKit 2 natively in Swift behind a MethodChannel**, the
same way Apple Sign-In was done. This avoids CocoaPods entirely *and* gives us
StoreKit 2 (`Product`, `Transaction`, JWS-signed transactions), which is Apple's
current recommended API — the `in_app_purchase` plugin still leans on StoreKit 1.

---

## 2. Architecture

```
┌── iOS app ─────────────────┐     ┌── Backend ──────────────┐    ┌── Apple ────┐
│ SubscriptionsPage (paywall)│     │                         │    │             │
│   ↓ buy(productId)         │     │                         │    │             │
│ apple_iap.dart             │     │                         │    │             │
│   ↓ MethodChannel          │     │                         │    │             │
│ StoreKitBridge.swift       │────────── purchase ───────────────▶│  App Store  │
│   ← signed JWS transaction │◀───────────────────────────────────│             │
│   ↓ POST /apple/verify     │────▶│ AppleIapService         │    │             │
│      { jws }               │     │  1 verify JWS signature │    │             │
│                            │     │    vs Apple Root CA G3  │    │             │
│                            │     │  2 check bundleId/env   │    │             │
│                            │     │  3 productId → plan_id  │    │             │
│                            │     │  4 idempotency check    │    │             │
│                            │     │  5 createSubscription() │    │             │
│                            │     │     payment_method=     │    │             │
│                            │     │       'apple_iap'       │    │             │
│ GET /subscriptions/me ─────────▶ │ getStudentBilling()     │    │             │
│   ← unlocked               │     │                         │    │             │
└────────────────────────────┘     │ POST /apple/notifications│◀───── renewals, │
                                   │  (App Store Server      │      cancels,   │
                                   │   Notifications V2)     │      refunds    │
                                   └─────────────────────────┘    └─────────────┘
```

**Trust boundary:** the client is never trusted for price, plan, or duration.
It sends only the Apple-signed JWS; the backend derives everything else from the
verified `productId` and its own `plans` table.

---

## 3. Product catalogue

Created in App Store Connect, group **Xyndrome Pro**:

| Product ID | Duration | Price (USD) | Maps to plan |
| --- | --- | --- | --- |
| `app.xyndrome.lk.weekly` | 1 week | 1.99 | plan row w/ `duration_days = 7` |
| `app.xyndrome.lk.monthly` | 1 month | 4.99 | plan row w/ `duration_days = 30` |
| `app.xyndrome.lk.yearly` | 1 year | 29.99 | plan row w/ `duration_days = 365` |

No introductory free trial (the app already has a free tier — decided 2026-07).

---

## 4. Step-by-step implementation

Each step ends in a verifiable state. Do them in order.

### Step 1 — DB: map Apple products to plans

Add **one nullable column** to `plans` (additive, no data migration, no breakage):

```sql
ALTER TABLE plans ADD COLUMN apple_product_id VARCHAR(191) NULL AFTER billing_period;
CREATE UNIQUE INDEX uniq_plans_apple_product ON plans (apple_product_id);
```

Add via `ensureColumn(...)` in `schema-sync.service.ts` so it self-heals on boot
(matching the `ensureCriticalTables` precedent from `lesson-create-500-schema-drift`).

New table for replay-protection and audit:

```sql
CREATE TABLE IF NOT EXISTS iap_transactions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_id INT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'apple',
  product_id VARCHAR(191) NOT NULL,
  transaction_id VARCHAR(191) NOT NULL,
  original_transaction_id VARCHAR(191) NOT NULL,
  environment VARCHAR(20) NOT NULL,          -- Production | Sandbox
  purchase_date DATETIME NULL,
  expires_date DATETIME NULL,
  revocation_date DATETIME NULL,
  raw_payload MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_iap_transaction (transaction_id),
  KEY idx_iap_original (original_transaction_id),
  KEY idx_iap_user (user_id)
);
```

`UNIQUE(transaction_id)` is the idempotency guarantee. `original_transaction_id`
is the stable identity of a subscription across renewals.

**Verify:** boot the backend, confirm both objects exist, confirm no existing
query breaks (`SELECT` sites for `plans` use explicit column lists).

### Step 2 — Seed the three plans

Create/point three `plans` rows at the Apple product IDs. Prefer updating existing
plans over inserting duplicates, so current subscribers keep their `plan_id`.
Idempotent script, run once per environment.

**Verify:** `SELECT id, name, duration_days, apple_product_id FROM plans WHERE apple_product_id IS NOT NULL;` → 3 rows.

### Step 3 — Backend: JWS verification (security core)

New `backend/src/modules/subscriptions/apple-iap.service.ts`.

StoreKit 2 hands us a **JWS (JSON Web Signature)**, header contains an `x5c`
certificate chain. Verification, using **Node's built-in `crypto` only** — the
same no-new-dependency approach already used for Sign in with Apple:

1. Parse the JWS header; read the `x5c` chain (leaf → intermediate → root).
2. Verify the chain terminates at **Apple Root CA — G3** (certificate pinned in
   the repo as a constant).
3. Verify each certificate signs the next, and none is expired.
4. Verify the JWS `ES256` signature with the leaf certificate's public key.
5. Only then parse the payload.

Then validate the **claims** (all mandatory — skipping any of these is a real
vulnerability):

| Claim | Rule |
| --- | --- |
| `bundleId` | must equal `app.xyndrome.lk` |
| `environment` | `Production`; `Sandbox` accepted only when `APPLE_IAP_ALLOW_SANDBOX=1` |
| `productId` | must resolve to a plan via `plans.apple_product_id` |
| `expiresDate` | must be in the future to grant access |
| `revocationDate` | if present → refunded/revoked, do **not** grant |

**Verify:** unit-test with a known-good sandbox JWS, plus negative tests —
tampered payload, wrong bundle id, expired cert, sandbox JWS in production mode.
All must reject.

### Step 4 — Backend: redeem endpoint

`POST /subscriptions/apple/verify` (authenticated), body `{ jws }`.

Flow:

1. Verify JWS (Step 3).
2. Resolve `productId` → `plan`. Unknown product → `400`.
3. **Ownership / replay check** on `original_transaction_id`:
   - unseen → proceed;
   - seen for **this** user → idempotent refresh, return current state;
   - seen for a **different** user → `409 Conflict`, log a security event, grant
     nothing. *(This is the account-sharing attack: one purchase, many accounts.)*
4. `INSERT … ON DUPLICATE KEY UPDATE` into `iap_transactions`.
5. Call the existing `createSubscription({ … paymentMethod: 'apple_iap',
   paymentReference: originalTransactionId, paymentStatus: 'paid',
   status: 'active', endDate: expiresDate, cancelExisting: true })`.
6. Return the refreshed billing payload.

Wrap 3–5 in a single DB transaction so a failure cannot leave a transaction row
without its subscription.

**Verify:** sandbox purchase → row in `user_subscriptions` with
`payment_method='apple_iap'`; calling the endpoint twice creates exactly one
subscription; a second account replaying the same JWS gets `409`.

### Step 5 — Backend: App Store Server Notifications V2

`POST /subscriptions/apple/notifications` — **public** (Apple calls it), but the
body is a signed JWS verified by the same Step 3 code. No auth header; the
signature *is* the authentication.

Handle at minimum:

| `notificationType` | Action |
| --- | --- |
| `DID_RENEW`, `SUBSCRIBED` | extend `end_date` |
| `DID_CHANGE_RENEWAL_STATUS` | record intent; access continues until expiry |
| `EXPIRED` | set `status='expired'` |
| `REFUND`, `REVOKE` | set `status='cancelled'` immediately |
| `DID_FAIL_TO_RENEW` | leave active during Apple's grace period |

Always return `200` once the signature is valid, even for unhandled types, or
Apple will retry indefinitely.

**Security note:** this endpoint must **not** be behind the auth guard, must
**not** trust any field before signature verification, and must be excluded from
CSRF. Add it to the public-route list explicitly rather than by a broad wildcard.

**Verify:** send a sandbox notification from App Store Connect; confirm `200` and
the expected DB change. Confirm an unsigned/tampered body returns `401`.

### Step 6 — Native StoreKit 2 bridge (Swift, no pod)

New `mobile/ios/Runner/StoreKitBridge.swift`, registered in `AppDelegate.swift`
on channel `app.xyndrome.lk/storekit`, mirroring the existing `apple_auth`
registration.

Methods:

| Method | Returns |
| --- | --- |
| `products` | `[{ id, displayName, description, displayPrice, period }]` via `Product.products(for:)` |
| `purchase(productId)` | `{ status: purchased/cancelled/pending, jws }` |
| `restore` | `{ jws }` for the current entitlement via `Transaction.currentEntitlements` |
| `currentEntitlement` | same, without `AppStore.sync()` |

Rules:
- Use `Transaction.updates` from launch so renewals/Ask-to-Buy approvals arriving
  outside a purchase call are captured.
- Call `transaction.finish()` **only after** our backend confirms redemption —
  finishing early can lose a purchase if the network drops.
- Return the raw **JWS** (`VerificationResult.jwsRepresentation`) to Dart. Never
  send parsed fields; the backend re-verifies the signature itself.

**Verify:** app builds with **no Podfile changes** (guard against the known
CocoaPods breakage); products load in a StoreKit sandbox session.

### Step 7 — Dart wrapper

`mobile/lib/data/apple_iap.dart`, shaped like `apple_auth.dart`:

```dart
const MethodChannel _channel = MethodChannel('app.xyndrome.lk/storekit');

class IapProduct { final String id, displayName, description, displayPrice, period; … }

Future<List<IapProduct>> loadProducts(List<String> ids);
Future<IapPurchaseResult> purchase(String productId);
Future<String?> restorePurchases();
```

Guard every entry point with `Platform.isIOS` so Android is unaffected.

**Verify:** `flutter analyze` clean; products print in a debug run.

### Step 8 — Paywall UI (the part reviewers actually judge)

Rewrite `subscriptions_page.dart` (iOS branch) into a real paywall. Apple rejects
paywalls that omit any of the following, so treat these as **mandatory**:

- [ ] Subscription **name** and **duration** per option
- [ ] **Localized price** — from `Product.displayPrice`, never hardcoded
- [ ] Statement that it **auto-renews until cancelled**
- [ ] **Restore Purchases** button *(Guideline 3.1.1 — required)*
- [ ] **Terms of Use (EULA)** link → `…/lms/frontend/dist/terms`
- [ ] **Privacy Policy** link → `…/lms/frontend/dist/privacy-policy`

Also update `locked_view.dart` — the screen the reviewer hit — to take an
optional **"View plans"** action routing to the paywall (iOS). This is precisely
the missing path called out in the rejection.

Platform split:
- **iOS** → prices + buy buttons (IAP).
- **Android / web** → keep today's access-only view. Google Play has an
  equivalent rule and this app is not on Play yet; adding Play Billing is out of
  scope for this submission.

**Verify:** sandbox purchase end-to-end → content unlocks; Restore works on a
second device/reinstall; every required element is visible in one screenshot.

### Step 9 — Reconcile on launch and resume

On app start and on resume, ask StoreKit for `currentEntitlements`; if there is a
live entitlement the backend doesn't know about (reinstall, new device, backend
outage during purchase), silently POST it to `/apple/verify`.

`subscriptions_page.dart` already invalidates `billingProvider` on resume — extend
that to also reconcile entitlements.

**Verify:** delete + reinstall the app with an active sandbox subscription →
access restored with no user action.

### Step 10 — Security review, then ship

Full pass described in §5, then:

1. `version: 1.0.0+2` in `mobile/pubspec.yaml`.
2. Build IPA, upload.
3. Deploy backend (**committed `dist`** — per `backend-deploy-committed-dist`,
   edit both `.ts` and compiled `.js`, then pull + restart on the server).
4. Set the **App Store Server Notifications V2** production + sandbox URLs in
   App Store Connect to `https://xyndrome.lk/api/subscriptions/apple/notifications`.
5. Submit **app version + all 3 subscriptions together** (Apple requires the
   first IAP to accompany a version).
6. Reviewer notes: keep the demo account, and state that IAP is now implemented
   and that web purchases are honoured under 3.1.3(b).

---

## 5. Security review checklist

Run before submission — these are the failure modes that matter.

### Purchase forgery
- [ ] JWS signature verified against the **pinned Apple Root CA G3**, not merely decoded
- [ ] Full certificate chain validated, expiry checked
- [ ] `bundleId` checked against `app.xyndrome.lk`
- [ ] `environment` enforced; sandbox rejected in production unless explicitly enabled
- [ ] **No** trust in any client-supplied plan, price, or duration

### Replay / sharing
- [ ] `UNIQUE(transaction_id)` enforced at the DB level
- [ ] `original_transaction_id` bound to the first redeeming user
- [ ] Re-redemption by another account → `409` + security log, never a grant
- [ ] Re-redemption by the same account is idempotent (no duplicate rows)

### Database integrity
- [ ] Redemption runs in one transaction (`iap_transactions` + `user_subscriptions` commit together)
- [ ] All new SQL is **parameterised** — no string interpolation
- [ ] Additive migration only; no destructive `ALTER`/`DROP`
- [ ] Existing PayHere / bank-transfer / admin-assign flows unchanged and retested
- [ ] `plans.apple_product_id` unique so one product can't map to two plans

### Endpoint exposure
- [ ] `/apple/verify` requires auth; grants only to the caller's own `user_id`
- [ ] `/apple/notifications` is public **but** signature-gated, CSRF-exempt, and not wildcarded open
- [ ] Rate limiting on both
- [ ] Raw payloads stored for audit contain **no** card or personal payment data (Apple never sends any)
- [ ] Verification failures logged with reason, without leaking internals to the client

### Access-control regressions
- [ ] Expired IAP subscription → content re-locks
- [ ] Refunded (`REVOKE`) → access removed promptly
- [ ] `access_scope` / `course_ids_json` semantics still honoured (see `subscription-plan-access-control`)
- [ ] Demo account `jauffar@gmail.com` keeps admin-granted access with no IAP

### App Review compliance
- [ ] Paywall shows name, duration, localized price, auto-renew disclosure
- [ ] **Restore Purchases** present and working
- [ ] Terms + Privacy links present and loading
- [ ] **No** price, payment link, or "buy on our website" text anywhere in the iOS app
- [ ] Locked content offers a path to the IAP paywall (the original rejection reason)

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| **CocoaPods broken on this machine** | Native StoreKit 2 + MethodChannel; zero pubspec native deps. Verify the Podfile is untouched before building. |
| Backend `dist` is committed, not built on the server | Edit `.ts` **and** compiled `.js`; `rm -rf dist node_modules/.cache` before rebuilding (known stale-cache trap). |
| Sandbox ≠ production behaviour | Test with a Sandbox Apple ID; keep `APPLE_IAP_ALLOW_SANDBOX` off in production. |
| Notification endpoint unreachable → stale state | Step 9 reconciliation on launch/resume is the safety net. |
| Double-charging a web subscriber | Paywall shows current access state first; an already-active subscriber sees status, not buy buttons. |
| Rejected again on paywall presentation | §5 "App Review compliance" is a hard gate before submitting. |

---

## 7. Progress

- [x] 1 — DB: `plans.apple_product_id` + `iap_transactions` *(in `ensureCriticalTables`, so prod's `SCHEMA_SYNC=0` still gets them)*
- [x] 2 — Seed three plans *(weekly→`quick-revision-7d`, monthly→`monthly-prep-1m`, yearly→`annual-prep-1y`, created **inactive** so the public pricing page is unchanged)*
- [x] 3 — JWS verification service *(`apple-iap.service.ts`; 22/22 in `backend/test/apple-iap-regression.ts`)*
- [x] 4 — `POST /subscriptions/apple/verify` *(rate-limited; replay/ownership guard returns 409)*
- [x] 5 — `POST /subscriptions/apple/notifications` *(public, signature-gated)*
- [x] 6 — `StoreKitBridge.swift` *(wired into pbxproj; deployment target raised 13.0 → 15.0, required by StoreKit 2)*
- [x] 7 — `apple_iap.dart` + `redeemAppleTransactionProvider`
- [x] 8 — `paywall_sheet.dart` + `LockedView` "View plans" *(closes the exact rejection)*
- [x] 9 — `iap_reconciler.dart`, run on launch + resume + account switch
- [x] 10 — Security review done; built `1.0.0+2` (`flutter build ios` ✓). **Left for you:** archive/upload in Xcode, deploy backend `dist`, set the notification URL, resubmit.

---

## Appendix — Screen-capture protection (added 2026-08-13)

Separate from IAP, but shipping in the same build.

**iOS cannot block screenshots.** Apple exposes no public API to suppress the
screenshot gesture; anything claiming otherwise uses a private API (rejected at
review) or a `UITextField`-only trick. Android's `FLAG_SECURE` has no iOS
counterpart. The implementation therefore does what each platform genuinely
allows, and `ScreenProtection.capabilities()` reports the difference so the UI
never claims a capture was blocked when it wasn't.

| | Android (`FLAG_SECURE`) | iOS |
| --- | --- | --- |
| Screenshot | **Blocked by the OS** | **Not possible** — detected after the fact only |
| Screen recording / AirPlay | **Blocked** (renders black) | Screen covered while capture is active |
| App-switcher thumbnail | Hidden | Covered |

Files: `android/.../MainActivity.kt`, `ios/Runner/ScreenProtection.swift`,
`lib/services/screen_protection.dart`, enabled from `lib/main.dart`.

On iOS a screenshot triggers a SnackBar worded as a request ("Course content is
protected. Please don't share screenshots.") rather than implying it was
prevented — because it wasn't.

---

## References

- [Guideline 3.1.1 — In-App Purchase](https://developer.apple.com/app-store/review/guidelines/#3.1.1)
- [StoreKit documentation](https://developer.apple.com/documentation/storekit/)
- [Configuring in-app purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)
- [Submitting an in-app purchase for review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
