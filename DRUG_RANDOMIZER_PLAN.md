# Drug Randomizer — Full Implementation Plan

## Overview
A Drug Randomizer study tool inside the Study section for both Web and Flutter.
Students spin a lottery-style animation, get a random drug, answer an MCQ, then see the full drug card.
Free users get 5 spins lifetime. Admin controls everything.

---

## Features
- Lottery/slot machine animation on spin
- MCQ quiz after spin (1 random question type, 4 options — correct from drug + 3 random distractors from DB)
- Full drug card reveal after MCQ (class · SL brands · adult dosage · pediatric dosage · side effects · warnings · interactions · pregnancy)
- Free user limit: 5 spins → upgrade prompt after
- Admin: full CRUD on drugs, toggle feature on/off, change free limit
- Available on both Web and Flutter

---

## Database Schema

```sql
-- Core drugs table
CREATE TABLE drugs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255)  NOT NULL,
  drug_class      VARCHAR(255),
  uses            TEXT,
  dosage_adult    TEXT,
  dosage_pediatric TEXT,
  side_effects    TEXT,
  warnings        TEXT,
  drug_interactions TEXT,
  pregnancy_info  TEXT,
  sl_brand_names  VARCHAR(500),   -- comma-separated e.g. "Panadol, Calpol, Metacin"
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usage tracking per user
CREATE TABLE drug_randomizer_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT         NOT NULL,
  drug_id     INT         NOT NULL,
  question_type VARCHAR(50),           -- 'drug_class' | 'uses' | 'warnings' | 'pregnancy_info'
  answered_correctly TINYINT(1),
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (drug_id) REFERENCES drugs(id)  ON DELETE CASCADE
);

-- Indexes for performance
ALTER TABLE drugs ADD INDEX idx_active     (is_active);
ALTER TABLE drugs ADD INDEX idx_active_id  (is_active, id);
ALTER TABLE drug_randomizer_sessions ADD INDEX idx_user   (user_id);
ALTER TABLE drug_randomizer_sessions ADD INDEX idx_drug   (drug_id);

-- Feature settings (insert once, admin updates via panel)
INSERT INTO settings (setting_key, setting_value) VALUES
  ('drug_randomizer_enabled',    'true'),
  ('drug_randomizer_free_limit', '5');
```

---

## DB Optimization Strategy (single-query approach)

**One HTTP request → one DB query → one response.**

The core randomizer endpoint runs a single raw SQL query that returns:
- The random drug (all columns)
- The user's current usage count (LEFT JOIN subquery)
- 3 MCQ distractor drug_class values (correlated JSON subquery)

Settings (`free_limit`, `enabled`) are **cached in memory** at app startup and refreshed every 5 min — zero DB hits.

Usage logging is **fire-and-forget** (`void db.execute(...)`) — does not block the response.

### The single master query

```sql
SELECT
  d.id, d.name, d.drug_class, d.uses,
  d.dosage_adult, d.dosage_pediatric,
  d.side_effects, d.warnings,
  d.drug_interactions, d.pregnancy_info, d.sl_brand_names,
  COALESCE(u.use_count, 0) AS use_count,
  (
    SELECT JSON_ARRAYAGG(dc)
    FROM (
      SELECT drug_class AS dc
      FROM drugs
      WHERE is_active = 1
        AND id    != d.id
        AND drug_class IS NOT NULL
        AND drug_class != d.drug_class
      ORDER BY RAND()
      LIMIT 3
    ) AS dis
  ) AS distractors
FROM drugs d
LEFT JOIN (
  SELECT COUNT(*) AS use_count
  FROM drug_randomizer_sessions
  WHERE user_id = ?
) u ON 1=1
WHERE d.is_active = 1
ORDER BY RAND()
LIMIT 1
```

---

## Excel Data Format (for manual DB import)

File: `drugs_seed.xlsx`
One sheet, columns in order:

| Column | Notes |
|--------|-------|
| name | Generic drug name |
| drug_class | e.g. "Penicillin Antibiotic" |
| uses | Plain text |
| dosage_adult | Plain text |
| dosage_pediatric | Plain text |
| side_effects | Plain text |
| warnings | Plain text |
| drug_interactions | Plain text |
| pregnancy_info | Plain text |
| sl_brand_names | Leave blank — admin fills later |

---

## Backend (NestJS)

### New module: `backend/src/modules/drugs/`

Files:
- `drugs.module.ts`
- `drugs.controller.ts`       — student endpoints
- `drugs-admin.controller.ts` — admin endpoints
- `drugs.service.ts`
- `dto/create-drug.dto.ts`
- `dto/update-drug.dto.ts`

### Student Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/drugs/spin` | Student | Random drug + usage count + MCQ distractors (single query) |
| POST | `/drugs/session` | Student | Log a spin session (fire-and-forget) |

### Admin Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/drugs` | Admin | List all drugs (paginated, search) |
| POST | `/admin/drugs` | Admin | Create drug |
| GET | `/admin/drugs/:id` | Admin | Get single drug |
| PUT | `/admin/drugs/:id` | Admin | Update drug |
| DELETE | `/admin/drugs/:id` | Admin | Delete drug |
| PATCH | `/admin/drugs/:id/toggle` | Admin | Toggle is_active |
| GET | `/admin/drugs/settings` | Admin | Get feature settings |
| PUT | `/admin/drugs/settings` | Admin | Update settings (free limit, enabled) |

### Settings Cache
- Loaded once at module init via `onModuleInit()`
- Stored in service memory
- Refreshed every 5 min via `setInterval`
- Settings: `drug_randomizer_enabled` (bool) + `drug_randomizer_free_limit` (int)

---

## Web Frontend

### New page: `surfaces/app/student/drugs/`

Files:
- `DrugRandomizerPage.jsx`
- `DrugRandomizerPage.css`
- `components/LotterySpinner.jsx`   — CSS slot-machine animation
- `components/DrugMCQ.jsx`          — 4-option MCQ card
- `components/DrugCard.jsx`         — Full drug info card
- `components/UpgradePrompt.jsx`    — Modal after 5 spins

### API helper: `shared/api/drugs.api.js`

### Route: `/app/drugs` → added to router

### Study hub card: added to `StudentStudyPage.jsx` `studyItems` array

### Animation (CSS only, no JS lib)
- Names scroll fast in a slot strip → ease-out to final drug name
- CSS keyframes: `@keyframes slot-spin` with `translateY` cycling
- Duration: 2.5s, `cubic-bezier(0.17, 0.67, 0.12, 0.99)` easing

### Flow
```
[Spin button] → lottery animation (2.5s) → drug name revealed
→ MCQ card (question + 4 options) → student picks
→ correct/wrong feedback (0.4s) → full drug card slides in
→ [Spin again] button
```

### Free limit UX
- Spin counter shown: "3 / 5 spins used" pill
- After 5th spin → UpgradePrompt modal overlays with blur backdrop
- Upgrade CTA → `/app/plans`

---

## Flutter App

### New feature: `mobile/lib/features/drugs/`

Files:
- `drug_randomizer_page.dart`        — main page
- `drug_randomizer_repository.dart`  — API calls
- `widgets/lottery_spinner.dart`     — AnimationController slot machine
- `widgets/drug_mcq_card.dart`       — MCQ 4-option widget
- `widgets/drug_info_card.dart`      — Full drug card
- `widgets/upgrade_prompt.dart`      — Bottom sheet after limit

### Route: `/app/drugs` added to `go_router`

### Study hub: new `_ToolEntry` added to `StudyHubPage._tools`

### Animation (Flutter)
- `AnimationController` + `CurvedAnimation(curve: Curves.easeOutQuart)`
- `ListWheelScrollView` with `FixedExtentScrollController` → spins through drug names
- Duration: 2500ms, snaps to final drug

### Free limit UX
- Counter shown in AppBar subtitle: "3 / 5 free spins"
- After 5 → `showModalBottomSheet` upgrade prompt
- CTA → `/app/plans`

---

## Admin Panel

### New page: `surfaces/admin/pages/drugs/`

Files:
- `DrugsPage.jsx`         — list + search + pagination
- `DrugFormModal.jsx`     — create/edit modal
- `DrugSettingsPanel.jsx` — feature toggle + free limit slider

### Admin nav: added to existing admin sidebar

### Features
- Search by name or drug class
- Toggle active/inactive per drug
- Inline edit via modal
- Settings panel: enable/disable feature, set free spin limit (1–50)

---

## Implementation Order

1. **SQL** — `drugs` table + `drug_randomizer_sessions` + indexes + settings rows
2. **Backend** — `drugs.module.ts` → service → controllers → wire into `app.module.ts`
3. **Admin panel** — drugs list page + form modal + settings panel
4. **Web student page** — DrugRandomizerPage + animation + MCQ + drug card
5. **Web routing** — add route + add study hub card
6. **Flutter** — repository → page → widgets → route → study hub entry
7. **Excel seed script** — standalone Node.js script in `scripts/fetch-drugs.js`

---

## Out of Scope (this plan)
- ECG Learning (separate plan)
- Lung & Heart Sounds (separate plan)
- Push notifications for study streaks
