# Unified Card & Dark-Mode Plan

Goal: every card on every page (Dashboard, Courses, Quizzes, Results, Planner,
Notes…) draws from **one source of truth**. No page may invent its own card
surface, radius, border, shadow, or dark-mode background.

---

## 1. The single source of truth (do not duplicate these anywhere)

| Concern | Token | Light value | Dark value |
|---|---|---|---|
| Card surface | `--surface-card` | `rgba(255,255,255,0.92)` | `#16181f` |
| Card border | `--line-soft` | `rgba(15,23,42,0.08)` | `rgba(203,213,225,0.13)` |
| Card radius | `--ds-card-radius` | `22px` | `22px` |
| Card shadow | `--ds-card-shadow` | soft raised | soft dark |
| Primary text | `--ink-strong` (alias `--sa-ink`) | near-black | near-white |
| Muted text | `--ink-soft` / `--ink-muted` | grey | grey |

**Every card surface = exactly these four lines:**
```css
border: 1px solid var(--line-soft);
border-radius: var(--ds-card-radius);
background: var(--surface-card);
box-shadow: var(--ds-card-shadow);
```
Text inside a card must use the **ink tokens**, never a hardcoded `#fff` /
`#ffffff` / `rgba(255,…)` (those only worked because the card had a colored
gradient behind them — that is the bug).

---

## 2. The "other resources" the dashboard was using (the fork to remove)

All in `frontend/src/shared/styles/`:

1. **`04-pages/dashboard.css`** — hardcoded gradient backgrounds + non-standard
   radii (`--sa-radius-xl` = 28px, `16px`, `18px`) + ~19 hardcoded white text
   colors on these card surfaces:
   - `.study-continue-card` (hero) — radial blue/indigo gradient, `box-shadow:none`, 28px
   - `.study-readiness-card` — solid blue gradient, white text, 28px
   - `.study-plan-card` — gradient, 28px
   - `.study-streak-card` — orange gradient, 16px
   - `.study-mood-card` — gradient, 16px
   - `.study-action-card` — primary-soft fill, 18px
   - content cards (course-progress / upcoming / exam-countdown / analytics) — **already converted**
2. **`04-pages/student-app.css`** — secondary `--sa-*` definitions and inner
   tile gradients.
3. **`01-base/theme.css`** — the `--sa-*` token block. **Keep**, but every
   `--sa-*` card token must *alias* the canonical token (already true for
   `--sa-surface: var(--surface-card)`), so it can never drift.

> The `--sa-*` names can stay as aliases for backward compat, but they must
> point at the canonical tokens above — they are not an independent system.

---

## 3. Conversion rules (apply per card)

For each gradient card surface listed in §2.1:

1. Replace its `background`, `border`, `border-radius`, `box-shadow` with the
   four canonical lines in §1.
2. Replace every inner `color: #fff / rgba(255,…)` with `var(--ink-strong)`
   (titles/values) or `var(--ink-soft)` (labels/captions). These are
   theme-aware, so they read dark-on-white in light mode and light-on-dark in
   dark mode automatically — no per-theme override needed.
3. Delete now-dead `:root:not([data-theme="dark"]) …` light-mode text overrides
   that only existed to repaint white text — the ink tokens make them redundant.
4. Keep decorative accents (progress rings, streak flame, mascot, soft icon
   chips) — those are content, not the card surface. Only the **card shell** and
   **text** change.

### Exceptions (intentional, keep colored)
- None by default. If a "feature" highlight is wanted later, it should be a
  documented `.card-accent` modifier built **on top of** the canonical shell,
  not a bespoke gradient.

---

## 4. Verification checklist (per card, both themes)

- [ ] radius === 22px
- [ ] 1px `--line-soft` border visible
- [ ] background === `--surface-card` (no gradient image)
- [ ] `--ds-card-shadow` present
- [ ] all text readable (no white-on-white, no black-on-black)
- [ ] matches a Courses/Quizzes card placed side by side

Verify with the injected-card screenshot method (renders real compiled CSS)
until the dashboard is reachable while logged in.
