# Apple IAP — full test checklist

Written 2026-10-14, after fixing three bugs that sandbox testing exposed
(commit `064198b5`). Every "expected" below is what the code actually does, read
from the source — not what it ought to do.

Tick these in order. §0 first: most of the list is meaningless until the
backend is deployed.

---

## 0. Before you start — deploy, or none of this is testing the fix

- [ ] On the server: `cd ~/public_html && git pull && touch ~/public_html/tmp/restart.txt`
- [ ] cPanel **Deploy** button for the frontend (the product-ID field and the IAP table)
- [ ] Confirm the duration survived the restart:
      `SELECT name, duration_days, apple_product_id FROM plans WHERE slug = 'master-prep-6m';`
      → **365** and `app.xyndrome.lk.yearly`. If it says 180, the old seeder reset
      it; the new dist stops that, so pull first and re-check.
- [ ] All four products mapped:
      `SELECT name, duration_days, apple_product_id FROM plans WHERE apple_product_id IS NOT NULL ORDER BY duration_days;`
      → exactly 4 rows: 7 / 30 / 90 / 365 days.
- [ ] Device signed into a **Sandbox Apple ID** (Settings → App Store → Sandbox
      Account), not your real one.

**Sandbox compresses every duration** — Apple's own table: 1 week → 3 min,
1 month → 5 min, 2 months → 10 min, 3 months → 15 min, 6 months → 30 min,
1 year → 1 hour. A sandbox subscription auto-renews 6 times then stops. Plan
your test window around that; a "yearly" purchase lapses in an hour.

---

## 1. The paywall renders

- [ ] Study/profile → **Subscribe** opens the paywall
- [ ] **All four plans listed**, each with a price
- [ ] Prices are in your storefront's currency and formatting

**Expected:** names and prices come from **App Store Connect via StoreKit**
(`displayName` / `displayPrice`), *not* from our `plans` table. So renaming a
plan in the admin panel does **not** change the iOS paywall text — that is
correct behaviour, not a bug. Our plan names drive the web app and the billing
card only.

- [ ] If a product is missing here, it is an App Store Connect problem (not
      Approved / not in the subscription group / agreements unsigned), not ours

---

## 2. First purchase — the happy path

- [ ] Buy **Complete Prep** (quarterly). Apple sheet → Sandbox password → success
- [ ] Access unlocks **without restarting the app**
- [ ] Q-Bank shows unlocked content immediately (the paywall invalidates
      `quizListProvider` on purpose — it is kept-alive and used to stay locked
      until a restart)
- [ ] Billing card shows the plan and an end date
- [ ] Admin → Subscriptions → **Apple in-app purchases**: a new row with your
      student, `app.xyndrome.lk.quarterly`, a **Sandbox** badge, and
      `active` + `Subscription #…` under Result

**Red flags**
- [ ] "No plan mapped" in the Plan column → no plan carries that product id
- [ ] "No access granted" → purchase verified but no subscription was written

---

## 3. Change plan — the bug that showed the old package

- [ ] Billing page shows **Change plan** and **Manage or cancel** (only while a
      subscription is active)
- [ ] Tap **Change plan** → the four prices list appears
- [ ] Pick a **higher** tier (Complete Prep → Master Prep). Apple confirms an
      upgrade
- [ ] **The billing card now shows the NEW plan.** This is the regression:
      before the fix it kept showing the old one, because Apple reuses
      `originalTransactionId` across a plan change and the idempotency guard
      mistook it for a repeat renewal
- [ ] Admin IAP table: a second row for the new product, `active`, with a
      different subscription number
- [ ] `SELECT plan_id, status, end_date FROM user_subscriptions WHERE user_id = <you> ORDER BY id DESC LIMIT 3;`
      → the new row `active`, the previous one `cancelled`

**Expected, not a bug:** a **downgrade** (Master Prep → Monthly) is **deferred
by Apple to the next renewal date**. No transaction arrives now, so the plan
legitimately does not change yet. Only upgrades and same-duration crossgrades
apply immediately. Verify a downgrade by waiting for the sandbox renewal.

---

## 4. Yearly — the one that was rejected

- [ ] Buy **Master Prep - 1 Year** (`app.xyndrome.lk.yearly`)
- [ ] **No error.** Previously: "Server rejected the purchase (400): This
      purchase does not match a known plan." — our server, after Apple had
      already charged
- [ ] Billing card shows Master Prep
- [ ] End date ≈ Apple's expiry, *not* today + 365. Apple's `expiresDate` is
      authoritative; `duration_days` is only the fallback. In sandbox that means
      about **one hour** ahead, which is correct
- [ ] Admin IAP table: the yearly row shows the plan name, not "No plan mapped"

---

## 5. Restore purchases

- [ ] Delete and reinstall the app (or sign in on a second device)
- [ ] Paywall → **Restore Purchases**
- [ ] Access returns without paying again
- [ ] No duplicate subscription row is created

---

## 6. Edge cases worth one pass each

- [ ] **Cancel mid-sheet** → no error banner, nothing written, no row in the
      IAP table
- [ ] **Manage or cancel** → explains Settings → Apple ID → Subscriptions.
      Required by Guideline 3.1.2, so it must be present and must work
- [ ] **Cancel the subscription in Settings**, then wait out the sandbox period
      → access ends at the end date (not instantly — a cancellation runs to term)
- [ ] **Already-active subscriber sees no "Subscribe" banner** — only "Change
      plan", so nobody can pay twice over an active plan
- [ ] **Second account, same Apple ID** → "This purchase is already linked to a
      different account." (409). `original_transaction_id` is first-come-owns
- [ ] **Ask to Buy / pending** → "Your purchase needs approval. Access unlocks
      automatically once it is approved." and no access until approved
- [ ] **Airplane mode mid-purchase** → "Could not reach the server…", and the
      transaction is NOT finished, so StoreKit re-presents it and the next
      launch reconciles it

---

## 7. Admin panel

- [ ] Plan form has **Apple product ID**, prefilled for the mapped plans
- [ ] Clearing it and saving unmaps the plan (purchases of that product then get
      rejected — so only do this deliberately)
- [ ] Pasting a product id another plan already owns is refused with a message
      **naming that plan**, not a 500
- [ ] **Rename a plan and restart the backend** → the new name survives. This
      was the revert bug: `seedDefaultPlans` re-applied hardcoded names, prices
      and `duration_days` on every schema-sync boot
- [ ] Renaming does **not** change the slug (`SELECT name, slug FROM plans;` —
      slugs stay `quick-revision-7d`, `monthly-prep-1m`, `complete-prep-3m`,
      `master-prep-6m`). Slugs are the identity key the Apple mapping and the
      seeder match on. `master-prep-6m` holding a 365-day plan is intentional
- [ ] IAP table's Sandbox badge appears on every sandbox row, so test purchases
      are never mistaken for revenue

---

## 8. Server notifications (optional, needs the URL configured)

`POST /subscriptions/apple/notifications` takes App Store Server Notifications
V2. The JWS signature is the authentication — there is no bearer token.

- [ ] Send a **TEST** notification from App Store Connect → 200, and the
      response reports `handled: false` (nothing subscription-shaped to apply)
- [ ] Let a sandbox subscription auto-renew → the end date extends without the
      app being opened
- [ ] Refund a sandbox purchase → access is revoked and the IAP table shows
      **Refunded**

---

## What "it works" means

1. All four products appear and are purchasable.
2. Every purchase appears in the admin IAP table with a plan name and a
   subscription number.
3. Upgrading changes the plan shown immediately; downgrading changes it at the
   next renewal.
4. No purchase is ever rejected by *our* server after Apple has charged.

If any purchase is rejected, the admin IAP table tells you where it broke: a row
with "No plan mapped" is ours to fix (map the product id); no row at all means
the failure was on Apple's side or in transit, before redemption.
