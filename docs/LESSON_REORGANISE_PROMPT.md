# Lesson completion prompt — one subject at a time, all 4 courses

Use this to turn one subject's lessons into complete, organised notes.
Start a **fresh conversation for each subject**, on the most capable model, and send the prompt with `{COURSE}` and `{SUBJECT}` filled in.

Order of work: Paediatrics → Medicine → Surgery → Gynaecology & Obstetrics, one subject at a time.
Done: **Paediatrics → Cardiology** (2026-11-09, file `~/Downloads/cardiology-update.sql`).

---

## The prompt

> Complete the lessons for **{COURSE} → {SUBJECT}**.
>
> **Sources (read them first):**
> - Database: my latest phpMyAdmin export (`~/Downloads/xyndrome_lms-*.sql`). This is the truth for ids and current content. The local `lms_db` must match it before you start.
> - Resource folder: `~/Desktop/data xyn/lesson/<course>/`:
>   - original lecture notes: PDFs, or extracted text in `Complete_Notes/_source_material/*.txt`;
>   - processed notes per subject: `Complete_Notes/<code>_<Subject>.html`. The lessons were built from these, so they are **not complete**;
>   - current guidelines: `Complete_Notes/_GUIDELINE_ANCHORS_2026*.md` (Medicine keeps them in the course folder).
>   - Course folders: `pedia]` (P01–P16), `medicine` (01–11), `surgery` (S01–…), `gyn and obs` (G1–G5, O1–O6).
>
> ### Hard rules
> 1. **Never delete.** No `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`. No lesson, subtopic, card, bullet or table row is lost. No existing id changes.
> 2. **Add and update only.** Lesson titles and card headings may be renamed, renumbered and reordered. Card content stays word for word; new content goes in new cards.
> 3. **New lessons and subtopics are `INSERT`ed without an id**, guarded with `WHERE NOT EXISTS`, so importing twice cannot duplicate them. New lessons copy their settings from a sibling lesson in the same topic and are `is_public = 1`.
> 4. **Every edit of an existing lesson is guarded**: `AND MD5(note_data) = '<hash of the exported version>'` (or `note_data IS NULL` for an empty one). A lesson edited live since the export is skipped, never overwritten.
> 5. One transaction; the file contains only `INSERT` and `UPDATE`.
>
> ### Steps
> 1. **Scan each lesson one by one**: list its cards and compare them with the template below.
> 2. **Read the sources** for the subject and list what they have that the lessons lack: whole topics (→ new lessons) and facts (→ new cards). Check by searching the lesson text, not by guessing.
> 3. **Split combined lessons**: one condition per lesson (e.g. "ASD & AVSD" → two). Reuse the existing cards and divide their bullets; do not rewrite them. Keep one lesson when it is really one disease (e.g. rheumatic fever + rheumatic heart disease). An empty lesson whose `raw_text` holds several conditions becomes one lesson per condition.
> 4. **Add new lessons** for topics the sources cover but no lesson does (e.g. PPHN, Eisenmenger syndrome, post-cardiac surgery care).
> 5. **Categorise into subtopics.** Every lesson in the subject, old and new, belongs to a subtopic. Create subtopics as needed (guarded), basics first, related conditions together.
> 6. **Reorder**: lessons are ranked **inside their topic** (subtopic), 1000 apart: the first lesson of a topic is 1000, the next 2000, and so on. A new lesson goes after the last one in its topic (highest `sort_order` in that topic + 1000). Topics are ranked inside their subject the same way (`subtopics.sort_order`, 1000 apart). Never renumber other topics or subjects.
> 6b. **Counts**: the Structure page shows stored counts (`courses.lesson_count`, `courses.subject_count`, `topics.lesson_count`, `topics.subtopic_count`). An SQL import changes lessons without updating them, so **after importing, press "Fix counts"** on the admin Structure page (Courses level). It recounts and corrects only what is wrong.
> 7. **Name plainly**: no subtopic name inside the lesson title; sentence case; spell out abbreviations once ("Ventricular septal defect (VSD)").
> 8. **Complete the content**: add the template cards each lesson lacks. Expand beyond the sources where a complete exam-level note needs it, using current guidelines from the anchors file.
> 9. **Organise headings**: sort each condition lesson's cards into template order and renumber 1, 2, 3… Reference lessons (physiology, normal values, approach-to lessons) keep their order and are only renumbered. Note cards stay unnumbered next to the card they belong to.
> 10. **Test on the local copy**: run the file, run it again (the second run must change nothing), and check that **every original bullet, step and table row still exists** somewhere in the subject.
> 11. **Report**: what was split, added, renamed, still thin or empty; list every place where you wrote medical content from your own knowledge; ask me before any guess about clinical facts.
>
> ### Card template (model: the Asthma lessons)
> 1. Definition & epidemiology
> 2. Aetiology / causes / types / associations
> 3. Pathophysiology (`flow` card)
> 4. Clinical features
> 5. 🚩 Red flags
> 6. Differential diagnosis (`table` card)
> 7. Investigations
> 8. Management
> 9. Complications & prognosis
>
> ### Writing style: small lines, not big chunks
> - **One fact per line.** Aim for under about 80 characters; never a paragraph.
> - Put a **label line** ending in `:` and the details under it as `→` sub-lines, e.g. `**Clinical features**:` then `→ Central cyanosis`, `→ Clubbing`.
> - Break any long existing bullet into a label plus sub-lines. **Keep every word and fact**: splitting is allowed; dropping is not.
> - Lists inside brackets become separate sub-lines.
> - Tables keep short cells (a few words each).
> - The check after splitting is **word-level**: every word of every original line must still be present in that lesson.
>
> Card format: `heading`, `bullets` (`==highlight==`, `**bold**`; `→` starts a sub-line; a line ending in `:` is a label), optional `callout` ([EXAM TRAP] / [EXAM PEARL]), `sticky_note`, `mnemonic`. Tables: `headers` + `rows`. Flow: `steps`. Use only these types: card, table, flow, branch, note (the phone app drops anything else).
>
> ### Output
> One `.sql` file in `~/Downloads/` for phpMyAdmin → Import, and a short summary. Do not import anything on the live server.

---

## Why these rules

- A plain `INSERT` with an existing id fails or duplicates, so new rows carry no id and are guarded.
- Lesson `sort_order` is a rank inside the lesson's topic (gaps of 1000, since 2026-11-14); lists show subject → topic → lesson. SQL files made before 2026-11-14 use the old flat numbers (steps of 5 across the course) and must be renumbered before import.
- The Structure page counts are stored, not counted live: run "Fix counts" after any SQL import.
- The admin editor only opens lessons with `is_public = 1`.
- `anchor_topic` on a note card is only a "Related to …" label; keep it in step if a heading is renamed.
- Images are files in `uploads/lesson-notes/<lesson id>/`, linked as `/api/uploads/lesson-notes/<id>/<file>`; leave a marker ("image needed: …") rather than inventing a picture.
- Medical text written by the model needs a clinician's review before students see it.
