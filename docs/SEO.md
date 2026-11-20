# SEO plan — xyndrome website

Started 2026-11-18. Kept apart from `docs/OPTIMIZE.md` (that file is speed and database work; this one is about being found on Google).
Each section: Decisions · Aims · Before · Plan · Changes · Targets. Items move to **Changes** only when built.

---

## S0. Where we stand (research, 2026-11-18)

### Google searches (Sri Lanka setting, browser outside Sri Lanka, so order may differ slightly)

**"erpm sri lanka"**

| # | Site | What it is |
|---|---|---|
| 1 | slmc.gov.lk/en/news/announcements | Official SLMC notices |
| 2 | facebook.com/groups/erpmsrilanka | Facebook group |
| 3 | erpm360.lk | Classes |
| 4 | slmc.gov.lk/en/services/check-erpm-results | Official results |
| 5 | reccampus.com/erpm-preparation-programme | REC Campus programme |
| 6 | reddit.com/r/srilanka | Foreign graduate pathways post |
| 7 | scribblingsofamedic.com | Blog post |

**"erpm preparation sri lanka"**: reccampus.com · panthi.lk (tutor list) · slmc.gov.lk guidelines PDF · erpm360.lk · mcqmed.lk/erpm-mcq-question-bank-sri-lanka · erpmmaster.online · Facebook group · imcedu.com

**"erpm mcq"**: mcqmed.lk · erpm.lk/free-mcq-practice · panthi.lk · instagram.com/mcqmedlk · erpm360.lk · x.com/mcqmedlk

**xyndrome does not appear in any of them.**

### Competitors that matter

| Site | Why it matters |
|---|---|
| mcqmed.lk | #1 for "erpm mcq". Free Final MBBS + ERPM bank, a dedicated ERPM page, Instagram and X accounts that also rank |
| erpm.lk | Free MCQ practice page ranks #2 for "erpm mcq" |
| erpmmaster.online | ERPM Part 1 Q-Bank and mock exams |
| erpm360.lk | Classes; ranks for all three searches |
| slmc.gov.lk | Official body; we do not try to outrank it |

**Our edge:** none of them combine write-on notes, a teaching Q-Bank, flashcards, timed mock exams and a phone app in one place.

### Facts about the exam (from SLMC documents)

- ERPM is the SLMC exam for doctors whose primary medical qualification is from outside Sri Lanka.
- It tests basic sciences, clinical knowledge and decision making, and clinical skills, at the level of a general medical practitioner working in Sri Lanka.
- It runs in parts (A and D, then B and C). Format and dates change; always link to slmc.gov.lk for current details.
- **Rule:** every exam fact on our pages is checked against the SLMC guidelines before it goes live. No pass marks, dates or paper counts unless the user confirms them.

### Our site today

| Item | State |
|---|---|
| Homepage title | "Your All-in-One MBBS Study Partner \| xyndrome" (2026-11-20, option A; replaced "xyndrome, your all in one MBBS partner"; not committed) |
| Homepage description | "Your notes, Q-Bank, flashcards, mock exams and study planner in one app. Built for Sri Lankan medical students preparing for finals and the ERPM." (share cards: same without "preparing for finals and the ERPM") |
| Pages in sitemap | /, /auth/login, /auth/register, 5 legal pages |
| Missing from sitemap | /try |
| Duplicate URLs | /login and /auth/login both open sign-in; /register and /auth/register both open sign-up |
| Page text before the app's code runs | empty `<div id="root">` (only tags) |
| Share image | 512 px square app icon (too small for wide previews) |
| Pages about ERPM / finals | none |
| Google Search Console | not set up |

---

## S1. Google Search Console (user does it)

**Decisions:** pending.
**Aims:** see real searches, positions and clicks; tell Google about new pages.
**Plan:**
1. Add property `xyndrome.lk` (domain property, verified with a DNS TXT record in Cloudflare).
2. Submit `https://xyndrome.lk/sitemap.xml`.
3. After each new page, use "Request indexing".
**Targets:** property verified, sitemap read without errors.

## S2. Site basics

**Decisions:** pending.
**Aims:** Google reads every public page once, with no duplicates.
**Plan:**
1. Add `/try` (and later `/erpm`) to `frontend/public/sitemap.xml`, with `lastmod`.
2. Canonical for `/login` → `/auth/login` and `/register` → `/auth/register` (or list only one in the sitemap; both already do this).
3. Wide 1200 × 630 share image for the homepage (`og:image`), same black and blue as the site.
4. Short real text inside `<div id="root">` on the homepage (headline, one line, link to /try and /erpm). Sits behind the loader; React replaces it. No visual change.
5. Store badges served from our own files (small speed win).
**Targets:** sitemap lists every public page; no duplicate-page warnings in Search Console.

## S3. ERPM page `/erpm`

**Decisions:** pending — 5 sample questions (user picks from the Q-Bank), exam-facts text (user approves), homepage link yes/no.
**Aims:** rank on page 1 for "erpm mcq", "erpm preparation", "erpm sri lanka" (after SLMC).
**Who it's for:** Sri Lankans studying medicine abroad (Russia, China, Armenia, Bangladesh, …) preparing for the ERPM.
**Plan:**
- Head: title "ERPM preparation, xyndrome"; description "Prepare for the ERPM with exam-style MCQs, clear explanations, notes and timed mock exams. Try free sample questions."; canonical `https://xyndrome.lk/erpm`; wide share image.
- Structure: h1 "Pass the ERPM with xyndrome" · h2 What the ERPM is and who sits it · h2 How xyndrome helps · h2 Free ERPM sample questions (5, with explanations) · h2 Subjects covered · h2 ERPM questions answered (FAQ).
- About 600–900 words of real text, written into the HTML Google downloads first (prerendered at build time), not only after JavaScript.
- Structured data: FAQPage, Course, BreadcrumbList.
- Links in: homepage "Preparing for ERPM?" link, footer, /try, sitemap. Link out: slmc.gov.lk examinations page.
- Look matches the homepage and /try (black, blue gradient text links, "Give it a free try").
- Page size and requests measured before/after (public page: no API calls, 0 database rows).
**Targets:** indexed within 2 weeks of deploy; top 10 for "erpm mcq" within 8 weeks (a target, not a promise).

## S4. App store listings

**Plan:** add "ERPM", "MBBS", "Sri Lanka" to the App Store subtitle/keywords and the Play Store short description. Store pages also show in Google.

## S5. Links from other sites (user and team)

**Plan:** posts in the ERPM Sri Lanka Facebook group, answers on r/srilanka, university society pages, short YouTube or Instagram sample-question videos that link to /erpm. Each real link from a Sri Lankan medical site helps.

## S6. Later pages (after Search Console data)

- `/finals` — Final MBBS for local students (state universities and KDU).
- Subject pages: `/erpm/medicine`, `/erpm/surgery`, `/erpm/paediatrics`, `/erpm/obstetrics` — only for searches Search Console shows people actually use.

---

## Changes

- 2026-11-18 — Homepage title and description (S0), title no longer doubled by PageMeta. Commit e5fceaf7 on v7. Not live.
- 2026-11-20 — Homepage title changed to "Your All-in-One MBBS Study Partner \| xyndrome" (user picked option A), new description and keywords. Files: frontend/index.html (title, description, keywords, og/twitter tags) and LandingPage.jsx PageMeta. Checked on the dev server. Not committed, not live.
