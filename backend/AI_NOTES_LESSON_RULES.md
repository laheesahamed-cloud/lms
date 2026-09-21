# AI Notes — Lesson Generation Rules

**Read this before touching `lessons.service.ts`'s prompts, `validate()`,
`groupSectionFamilies()`, `mergeCanvases()`, or the matching frontend
(`NoteCanvas.jsx`) / mobile (`topic_icons.dart`) card renderers.** Every rule
below exists because a real generated lesson broke in that exact way once.
Skipping this file is how the same bug comes back with a different heading.

## 1. The pipeline, in order

1. `canvasGenerate()` — entry point. Computes a 6-minute hard `deadline`.
2. Long paste → `splitSourceIntoChunks` → each chunk generated separately
   → `mergeCanvases()` stitches them into one canvas.
3. `ensureCompleteness()` — a **second, separate** AI call that compares
   the draft against the SOURCE and adds anything missing. Runs on
   **every** generation, unconditionally (do not make this conditional —
   that was tried and reverted, see §9).
4. `groupSectionFamilies()` — the safety net. Folds same-topic cards
   together, positions notes/images, reorders into canonical topic order.
5. `renumberSections()` — flat "1., 2., 3." numbering, always last.

Both AI calls (`buildPrompt`, `buildCompletenessPrompt`) share the same
section-type vocabulary below, and both must be kept in sync when a rule
changes — a fix in one and not the other is how a bug "randomly" only
shows up on long lessons (chunked) or short ones (single-pass, no
completeness gap to expose it).

## 2. Section types

| `type` | Shape | Use for |
|---|---|---|
| *(text)* | `heading, bullets, callout, sticky_note, mnemonic` | Default. Everything that isn't one of the below. |
| `table` | `+ headers, rows` | A comparison where **every** row needs the SAME set of columns. |
| `flow` | `+ steps` | A cause→effect chain, read top to bottom. 2–6 full-sentence steps. |
| `branch` | `+ root, branches: [{label, detail}]` | ONE topic splitting into named sub-types, each with just a short description — no type needs a second attribute. The moment one does, it's a `table`, not this. |
| `note` | `+ anchor_topic` | Unnumbered floating box for content that fits NO existing topic. Positioned next to `anchor_topic` (best-effort AI judgement: exact heading match → topic-family match → nearest card). Never numbered. |
| `image` / `image-explained` | — | Unrelated to text formatting; unaffected by any of this. |

Any TEXT section can ALSO carry `embedded_flow` / `embedded_table` /
`embedded_label` — see §4. This is not a 7th type; it's an attribute a
text section can have.

## 3. Choosing the right type — decision order

Ask in this order, stop at the first "yes":

1. **Is it a drug's mechanism of action?** → Never its own card. `embedded_flow`
   on the topic that uses the drug (almost always Management), with
   `embedded_label` naming the drug. Not even if it's long. The ONLY
   standalone `flow` allowed for a "mechanism" is the DISEASE's own
   pathophysiology — not one specific drug's MOA.
2. **Is it a numbered/lettered classification (Type 0-8, Stage I-III)?**
   → Does any type need more than one extra fact besides its name? →
   `table`, one row per type. Otherwise → `branch`.
3. **Is it a comparison that genuinely needs columns** (drug classes,
   differentials with multiple attributes)? → `table`.
4. **Is it a cause→effect chain that IS the whole topic** (not a sub-part
   of a bigger one)? → standalone `flow`.
5. **Is it a sub-part of an ALREADY-PLANNED topic** or already-covered
   heading (Management, Investigations, etc.) that happens to need a
   table/flow shape? → `embedded_table` / `embedded_flow` on that SAME
   section, never a new numbered section.
6. **Does it fit no existing topic at all?** → `note`, anchored to the
   closest related topic. Never left as an orphaned new numbered card
   for something the source barely mentioned.
7. Otherwise → plain bullets, `→ ` sub-bullets for lists.

## 4. Embedded content (`embedded_flow` / `embedded_table` / `embedded_label`)

- Lives on a normal TEXT section, alongside its `bullets`.
- `embedded_label` is REQUIRED whenever either is present — must be
  SPECIFIC ("Ramipril mechanism"), never the bare word "Mechanism" or
  "Comparison". The frontend divider shows this label verbatim; a generic
  label is how a reader ends up not knowing which mechanism they're
  looking at.
- **Only one embedded block per section.** If a second one shows up for
  the same heading (typically the completeness pass re-adding something
  the main pass already embedded), it is DROPPED, not concatenated —
  concatenating two different flows produces one nonsensical nRead-step
  chain that silently restates itself halfway through. See §9.

## 5. The anchor / merge system (`groupSectionFamilies`)

This is the part most likely to regress silently. The rule: **anchors are
registered for EVERY section type**, not just text. A card of ANY type
(text, table, flow, branch) that is the FIRST occurrence of its topic
family becomes that family's anchor. Every later section for the same
family merges into it:

| Later section is → | Anchor is text | Anchor is table/flow/branch |
|---|---|---|
| **text** | Bullets merge into anchor's `bullets` (labelled sub-part if headings differ) | Bullets fold into anchor's `bullets` as supplementary content (`SupplementaryBullets` on the frontend) |
| **table/flow/branch** | Gets RELABELLED to the anchor's family title (kept as its own adjacent card — can't merge rows/steps into bullets), NOT merged in | Same treatment — relabelled to the shared family title |

If you ever see two cards with the **same or near-identical heading**
sitting next to each other, this table is where to look first — it means
one of these four cells stopped working.

`note`-type sections are excluded from this table entirely — they never
register as an anchor and are never relabelled; they get pulled out and
positioned via `anchor_topic` matching in a separate pass after this loop.

## 6. Topic-family match priority (`TOPIC_FAMILIES`)

`topicFamily(heading)` returns the FIRST pattern in the list that matches
— order is priority, not alphabetical. Two traps:

- **`definition` must be checked before `pathophysiology`.** A combined
  heading like "Definition & Pathophysiology" matches both regexes; if
  pathophysiology is checked first, the card silently sorts to canonical
  rank 5 instead of rank 0 and the lesson's opening card lands 3rd/4th.
- Narrower patterns must precede broader ones they'd otherwise be
  swallowed by (e.g. "mechanism of action" before the bare `mechanism`
  inside pathophysiology's pattern).

This list exists in **three places** that must stay identical in order
and keys: `lessons.service.ts` (`TOPIC_FAMILIES`, drives card ordering),
`NoteCanvas.jsx` (`TOPIC_FAMILY_PATTERNS`, drives icon selection),
`topic_icons.dart` (`_familyPatterns`, same, for the Flutter app). A fix
to ordering in one and not the others means the website and the app show
a different icon (or the icon disagrees with where the web puts the card)
for the exact same heading.

## 7. Table headers must render markup

Table/embedded-table headers go through `<RichText>` on the frontend, same
as data cells. If you ever see literal `==TEXT==` or `**TEXT**` show up
unrendered, it's almost always a header cell that got left as raw
`{h}` instead of `<RichText text={h} .../>` — check both `TableSectionCard`
and `EmbeddedTable`.

## 8. The `degluedBullets` safety net

The AI's compliance with "one fact per bullet" is inconsistent — the same
kind of content sometimes comes back correctly split, sometimes jammed
into one run-on string with zero separators between facts (e.g.
`"...resectionIntramural (within the myometrial wall)..."`). Prompt
wording alone cannot guarantee this, so `degluedBullets()` in
`lessons.service.ts` splits on the signature "lowercase letter directly
followed by an uppercase letter, no space" — this essentially never
happens in normal English prose, so it's a safe, narrow fix. Applied to
`bullets`, `note` bullets, and `embedded_flow` steps in `validate()`.
Do not widen this heuristic without re-testing against normal bullets
containing things like "pH 7.2" or "mRNA" — both must stay untouched.

## 9. Regression history — do not reintroduce these

- **Completeness pass made conditional on paste length.** Tried once to
  skip it for short pastes to save time. Reverted — the user wants it
  running every time; speed was not worth the coverage loss.
- **A worked example in the prompt described a REAL clinical mechanism**
  (GnRH agonists). The model pattern-matched it back into unrelated real
  generations, duplicating content already covered by a legitimate
  standalone Mechanism-of-action card. Lesson: prompt examples for a new
  JSON shape should use a clearly generic/fictional example, never a real
  memorable clinical fact — the model treats a good example as a template
  to reproduce, not just a syntax illustration.
- **Anchors only registered for text sections.** A table/flow/branch that
  came first never became findable as an anchor, so a same-titled text
  addition after it became a duplicate card instead of merging. Fixed in
  §5 — if this regresses, it'll look like "two cards with the same title,
  one plain text and one table/flow/branch."
- **`embedded_flow` concatenation.** Merging a second embedded flow onto
  an existing one by concatenating arrays produced an N-step chain that
  quietly restates itself. Fixed to "first one wins, second one dropped."

## 10. Where the code lives

- Prompts: `buildPrompt()` and `buildCompletenessPrompt()` in
  `backend/src/modules/lessons/lessons.service.ts`.
- Sanitizing raw AI JSON: `validate()`, same file.
- Merge/ordering: `mergeCanvases()`, `groupSectionFamilies()`,
  `renumberSections()`, `topicFamily()`, `TOPIC_FAMILIES`, `TOPIC_ORDER`,
  same file.
- Web rendering: `frontend/src/surfaces/app/student/ai-notes/NoteCanvas.jsx`
  — `SectionCard`, `TableSectionCard`, `FlowSectionCard`,
  `BranchSectionCard`, `NoteBoxCard`, `SupplementaryBullets`,
  `TOPIC_FAMILY_PATTERNS`.
- Mobile icon matching only (mobile has no editor, so no table/flow/branch/
  note rendering yet): `mobile/lib/features/lessons/topic_icons.dart`.

## Before you change anything here

1. Re-read §3 and §5 — most "the card layout broke" reports trace back to
   one of those two.
2. If you add a new section type or a new AI-facing field, update it in
   BOTH prompts, `validate()`, `groupSectionFamilies()`/`mergeCanvases()`
   if it needs merge/anchor behaviour, and the frontend renderer — then
   add a row to §2 or §6 here.
3. Test with the `Object.create(LessonsService.prototype)` + call the
   private method directly pattern (no DB/AI call needed for the pure
   merge/ordering functions) before pushing — every fix in this file's
   history was verified that way first.
4. Update §9 with what broke and why, not just what changed.
