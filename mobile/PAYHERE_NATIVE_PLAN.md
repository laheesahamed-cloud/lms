# Native PayHere Checkout (Flutter SDK) — Implementation Plan

**Status:** Draft for approval — *document first, implement after sign-off*
**Date:** 2026-06-22
**Scope:** Replace the in-app **WebView / external-browser** card checkout with PayHere's
official **`payhere_mobilesdk_flutter`** SDK, with **coupon support inside the native flow**
and **bank-transfer (manual payment) kept as-is**. Sandbox vs live is driven by the **same
admin PayHere settings the web uses** — no separate app config.

---

## 1. Goal & non-goals

### Goal
A native, in-app PayHere card checkout (no browser hop) that:
- Uses the **existing backend** `POST /subscriptions/payhere/initiate` (no backend changes).
- Supports **coupons** (discount applied before payment; 100%-off coupons skip payment).
- Keeps **bank-transfer / manual payment** working exactly as today.
- Reads **sandbox/live** from the backend's admin PayHere settings (returned as `sandboxMode`).

### Non-goals
- No DB changes. Backend stays almost untouched — **possible small addition**: expose the per-app
  mobile `merchant_secret` from admin PayHere settings to the app (only if testing shows the SDK
  requires it; see §11.1). The order/coupon/notify logic is unchanged.
- Web admin `Settings → PayHere` stays the source of truth for merchant id, secret(s), sandbox flag.
- Not removing the WebView component yet — it stays available as a fallback during rollout (see §9).

---

## 2. How security actually works (verified against official PayHere Flutter doc)

> **Source of truth:** the official PayHere "Flutter SDK" knowledge-base page, saved in the repo
> as `flutted.pdf` (and pub.dev/GitHub — see §12). My two earlier drafts were both wrong about
> the secret. **The corrected facts:**

- **The SDK payment object does NOT use the web `hash`. It uses `merchant_secret`** — but this is
  a **per-mobile-app secret** (PayHere's doc step 4e: *"the hash value … is your Merchant Secret
  for this specific mobile App"*), obtained by **whitelisting the app package name** in
  **Settings → Domains & Credentials → Add Domain/App → App**. It is distinct from the web
  account secret and is tied to the approved package name.
- **So `fields.hash` from the backend is ignored** (that's for the web form). We still call
  `initiate` for a server-authoritative order (order_id, discounted amount, currency, items,
  customer, custom_1/2, notify_url); we just feed those to the SDK and add `merchant_secret`.
- **Where the per-app `merchant_secret` comes from is the key open question** (see §11.1). Two
  options: (a) test whether the SDK works with *only* the whitelisted package and `merchant_secret`
  omitted — some official examples (hold-on-card, item-wise) omit it; or (b) store the per-app
  secret in **web admin → PayHere settings** and have the backend return it to the app
  (a **small backend addition** — so the value is admin-managed, not hardcoded).
- **Access is still granted by the webhook, not the app.** PayHere calls `notify_url` →
  `handlePayHereNotification` ([subscriptions.service.ts:1291](../backend/src/modules/subscriptions/subscriptions.service.ts))
  verifies the md5 signature server-side and unlocks the subscription. The app's "success"
  callback only triggers a `GET /subscriptions/me` refresh. **Confirm** the notify md5sig secret
  (account secret already in backend settings) is what verifies *mobile* payments too (§11.2).
- **Sandbox/live parity with web.** `initiate` returns `sandboxMode`; the app passes it to the
  SDK. Toggling it in web admin changes both web and app.

---

## 3. The package & native setup (verified from official doc — `flutted.pdf`)

- **`payhere_mobilesdk_flutter: ^3.2.2`** (latest 3.2.x; pin at implementation) → `pubspec.yaml`, then `flutter pub get`.
- **Android** (min API **17+**, Flutter > 1.20):
  - Outermost `build.gradle` repositories: add `mavenLocal()` **and**
    `maven { url "https://repo.repsy.io/mvn/payhere/payhere-mobilesdk-android/" }`
    *(official repo — NOT jitpack).*
  - `AndroidManifest.xml`: declare `xmlns:tools="http://schemas.android.com/tools"` and add
    `<application tools:replace="android:label">`.
  - `proguard-rules.pro` (release): keep Retrofit/OkHttp/Okio + `lk.payhere.**` classes (exact
    rules listed in the doc, p.2).
- **iOS** (min **11.0+**): run `pod install` in the iOS project. (If a module/framework build
  error appears, add `use_frameworks!` to the Runner target — verify at implementation.)
- **Whitelist the app package (PayHere dashboard, required):**
  **Settings → Domains & Credentials → Add Domain/App → select "App"** → enter the package/bundle
  name (`app.xyndrome.lk`) → **note the per-app secret/hash (step 4e)** → **Request to Approve**.
  Live accounts: manual review, up to ~1 business day. Repeat for the dev id
  `app.xyndrome.lk.dev` if testing a side-by-side build.

> The SDK renders PayHere's own secure payment sheet (card entry, OTP/3DS) **inside the app** — no browser redirect.

---

## 4. Backend contract (already exists — for reference)

All under `@Controller(['subscriptions'])`, called by the app with a Bearer token (no `/student` prefix).

| Endpoint | Body | Returns (relevant) |
|---|---|---|
| `POST /subscriptions/checkout/coupon-preview` | `RequestSubscriptionDto` (`planId`, `couponCode?`) | `{ couponCode, couponMode, originalAmount, discountAmount, amount, currency, requiresApproval }` |
| `POST /subscriptions/payhere/initiate` | `RequestSubscriptionDto` (`planId`, `couponCode?`, billing, `message?`) | `{ ok, provider, sandboxMode, orderId, amount, currency, fields:{…} }` |
| `POST /subscriptions/coupon-approval/request` | `RequestSubscriptionDto` | request record (used when a coupon makes the price 0 / needs approval) |
| `POST /subscriptions/manual-payment/request` | manual-payment DTO (bank transfer + proof) | request record |
| `GET /subscriptions/me` | — | current subscription/access status (refresh after pay) |

### `initiate` → `fields` (the SDK uses most of these)
```
merchant_id, notify_url,
first_name, last_name, email, phone, address, city, country,
order_id, items, currency, amount,
custom_1 (userId), custom_2 (planId),
return_url, cancel_url, platform, hash   ← used by the WEB form only; SDK ignores these
```
The SDK additionally needs `sandbox` (from `sandboxMode`) and the per-app `merchant_secret` (§2/§11.1).

### Coupon preview semantics
- `amount` = payable after discount.
- `requiresApproval == true` → coupon zeroes the price → **do not** call PayHere; call
  `coupon-approval/request` instead (free unlock / admin approval path).
- Otherwise pass the same `couponCode` to `initiate`; backend returns the **discounted `amount`** —
  so the SDK charges the correct total.

---

## 5. Native payment object mapping

```dart
// from initiate response `fields` + `sandboxMode`.
// Matches the official one-time payment example (flutted.pdf p.3).
final payment = {
  "sandbox": sandboxMode,                       // bool, from backend (admin setting)
  "merchant_id": fields["merchant_id"],
  "merchant_secret": appMerchantSecret,         // per-app secret (§2/§11.1) — NOT the web hash
  "notify_url": fields["notify_url"],           // PayHere still calls this server webhook
  "order_id": fields["order_id"],
  "items": fields["items"],
  "amount": fields["amount"],                   // discounted amount when a coupon applied
  "currency": fields["currency"],
  "first_name": fields["first_name"],
  "last_name": fields["last_name"],
  "email": fields["email"],
  "phone": fields["phone"],
  "address": fields["address"],
  "city": fields["city"],
  "country": fields["country"],
  "custom_1": fields["custom_1"],               // userId
  "custom_2": fields["custom_2"],               // planId
};

PayHere.startPayment(
  payment,
  (paymentId) { /* success → refresh GET /subscriptions/me, show success */ },
  (error)     { /* failed → show error, allow retry */ },
  ()          { /* user dismissed → back to plan screen */ },
);
```

---

## 6. Flow (native checkout with coupon)

```
Plan card → tap "Get plan"
   │
   ▼
Native Checkout screen (new)
   ├─ shows plan name + price (from /subscriptions or coupon-preview)
   ├─ optional coupon field → POST coupon-preview
   │     ├─ valid → show original/discount/payable; if requiresApproval → "Redeem (free)"
   │     └─ invalid → inline error
   ├─ [Pay with card]  → POST payhere/initiate(couponCode?) → PayHere.startPayment(fields)
   │        success → refresh /subscriptions/me → success screen → back to subscriptions
   ├─ [Redeem free]    → POST coupon-approval/request (only when requiresApproval)
   └─ [Bank transfer]  → existing manual-payment flow (unchanged, §7)
```

---

## 7. Bank transfer / manual payment — unchanged

- Keep the current path: `POST /subscriptions/manual-payment/request` (bank details + payment proof).
- If today this runs through the WebView, it continues to; if a small native form is preferred
  later, that's a separate task. **No change in this plan** beyond surfacing the entry point on
  the new checkout screen.

---

## 8. Files

**Add**
- `pubspec.yaml` → `payhere_mobilesdk_flutter` dependency.
- `lib/features/subscriptions/payhere_checkout.dart` → service: `initiate()`, `couponPreview()`,
  `couponApproval()`, and `startNativePayment(fields, sandbox)` wrapping `PayHere.startPayment`.
- `lib/features/subscriptions/checkout_page.dart` → native checkout screen (plan summary, coupon
  field, Pay / Redeem / Bank-transfer actions).

**Change**
- `lib/features/subscriptions/subscriptions_page.dart` → "Get plan" routes to the new native
  checkout screen instead of `launchUrl(...externalApplication)`.
- `lib/router/app_router.dart` → route for the native checkout screen.

**Keep (fallback during rollout)**
- `checkout_webview_page.dart` retained but no longer the default card path.

---

## 9. Rollout & safety

1. **Sandbox first** (driven by admin setting). Verify with PayHere test cards end-to-end:
   initiate → pay → webhook marks `paid` → `/subscriptions/me` reflects access.
2. Confirm **coupon** (partial discount) charges the discounted amount and the webhook matches.
3. Confirm **100%-off coupon** routes to `coupon-approval/request` (no PayHere call).
4. Confirm **failure** and **dismiss** callbacks restore the UI without granting access.
5. Flip admin to **live** → smoke-test one real low-value transaction.
6. Keep WebView fallback until the native path is verified on both iOS + Android.

---

## 10. Store-policy note (unchanged from PLAN §14)

Apple (3.1.1) / Google generally require **their** IAP for digital subscriptions and may reject
external/third-party payment for digital goods. Native PayHere is still a third-party processor,
so the same review risk applies as the web checkout. This plan does not change that posture —
it improves UX (in-app sheet vs browser). IAP remains a possible future fast-follow if rejected.

---

## 11. Open items to confirm at implementation

1. **Per-app `merchant_secret` delivery (most important).** Official one-time example includes
   `merchant_secret` (per-app, from whitelisting step 4e), but hold-on-card / item-wise examples
   omit it. **Test first** whether a whitelisted package works *without* it. If it's required:
   store the per-app secret in **web admin → PayHere settings** and return it from the backend to
   the app (small addition) — do **not** hardcode it in source. Decide at implementation.
2. **Notify-webhook secret match.** Confirm PayHere signs the `notify_url` md5sig for *mobile-SDK*
   payments with the **same account merchant secret** the backend already verifies with
   (`generateNotificationHash`). If mobile uses a different secret, the webhook must verify with it
   too — otherwise mobile payments won't unlock access.
3. **SDK version** — pin latest 3.2.x (doc shows `^3.2.2`; pub.dev shows 3.2.3).
4. **iOS** — `pod install`; only add `use_frameworks!` if a module build error appears (min iOS 11).
5. **Recurring option (future).** The SDK natively supports recurring (`recurrence`, `duration`,
   `startup_fee`) — could power true auto-renewing subscriptions later, but needs backend support
   for PayHere recurring notifications. v1 stays **one-time** to match the current backend.
6. **Billing fields** — confirm the app sends the logged-in user's name/email (from auth `user`)
   or collects them on the checkout screen; `initiate` already fills these server-side.
7. **`return_url`/`cancel_url`** — web-only; the native SDK uses callbacks, so no app deep-link needed.
8. **Manual payment proof upload** on native (if later moved off WebView) — out of scope here.

---

## 12. Verified sources

- **Official doc (saved in repo):** `flutted.pdf` = PayHere Knowledge Base → *Flutter SDK*
  (`https://support.payhere.lk/api-&-mobile-sdk/flutter-sdk`, last updated 17 Dec 2025).
- **pub.dev:** https://pub.dev/packages/payhere_mobilesdk_flutter
- **GitHub:** https://github.com/PayHereLK/payhere-mobilesdk-flutter
- **Version reference:** https://libraries.io/pub/payhere_mobilesdk_flutter (3.2.x)

> Earlier drafts of §2/§5 contained two memory-based mistakes (first "pass a precomputed hash",
> then "no secret at all"). Both are superseded by the official doc above: the SDK uses a per-app
> `merchant_secret` obtained via package whitelisting.
```
