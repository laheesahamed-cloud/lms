# v1.0 launch flags — hiding five study tools for App Store submission

**Date:** 2026-10-13
**Branch:** v6.3
**Status:** flags are OFF (features hidden). This document is the restore key.

> Paste this file back into a Claude Code session when you are ready for v1.1
> and it will have the complete picture: why, what changed, and the exact way
> back.

---

## 1. Why this exists

Five study tools are hidden from the first App Store release:

| Feature | Route | Why hidden |
|---|---|---|
| OSCE stations | `/app/osce` | 4 published cases — too few to feel like a library |
| ECG library | `/app/ecg` | 10 cards |
| Auscultation | `/app/auscultation` | 11 cards |
| Drug randomizer | `/app/drugs` | 711 drug rows, but the study flow wants more polish |
| My Notes (personal notebook) | `/app/my-notes` | feature-complete, content model still being reworked |

**None of them is broken.** They were scanned before this change: real content in
the database, no stub screens, no TODO-only code paths, no crashes. The reason
is *depth*, not *defects* — a reviewer or a student opening a tool with ten
cards concludes the app is unfinished, which is the one impression a v1.0 can
least afford.

This was the deliberate choice over the two alternatives:

- **"Coming soon" cards** — rejected. Apple's review guideline 2.1 treats
  placeholder content as an incomplete app; a visible card that does nothing is
  exactly what that rule is about.
- **Shipping them as they are** — rejected. The content depth is the problem,
  and a 1-star "it's empty" review on day one outlives the fix.

Hiding them is invisible to the reviewer: there is no empty shelf, no greyed-out
button, no "soon" label. The app simply has the features it has.

---

## 2. The design rule that shaped it

**Nothing was deleted.** No file removed, no route removed, no provider removed,
no asset removed. Every one of the five features is still compiled into the
binary, byte for byte as it was.

That was chosen over deleting-and-reverting for three reasons:

1. **Restoring is one word per feature**, not a revert that has to be rebased
   over whatever else landed in between.
2. **No merge pain.** Work can continue on these features on other branches
   while v1.0 is in review; nothing is in conflict because nothing moved.
3. **App size is unchanged either way** — about 12,600 lines stay in the binary
   (osce 6,004 / personal_notes 3,112 / ecg 1,405 / drugs 1,134 /
   auscultation 956). Dart tree-shaking cannot drop them while the routes are
   registered, and that is a trade worth taking: a few hundred KB against a
   one-word restore.

---

## 3. What changed — four files

### 3.1 `lib/config/launch_flags.dart` — NEW, the only switch

```dart
static final bool osce = false;
static final bool ecg = false;
static final bool auscultation = false;
static final bool drugs = false;
static final bool myNotes = false;
```

Plus `hiddenRoutePrefixes` (the route prefix for each OFF feature) and
`isHidden(location)` (does this location belong to an OFF feature).

**Why `static final` and not `static const`:** a `const false` makes every
guarded branch provably unreachable, so `flutter analyze` fills the project with
`dead_code` warnings and buries the real ones. `final` is decided at startup,
costs nothing measurable, and keeps the analyzer honest.

### 3.2 `lib/router/app_router.dart` — routes are *sealed*, not just unlisted

One line inside the existing global `redirect` (~line 113):

```dart
if (LaunchFlags.isHidden(loc)) return '/app/dashboard';
```

**This is the important half of the change.** Hiding a button does not close a
route. Without this line, a hidden page is still reachable by:

- restored navigation state (the app reopening where it was last closed),
- a push notification or deep link pointing at it,
- a `push()` or `go()` left behind in some other screen,
- anything typed into a URL on the web build.

The global redirect is the single place every navigation passes through, so one
line there covers all of them.

### 3.3 `lib/features/shell/app_shell.dart` — the iPad/desktop side rail

`_kSideStudy` was renamed to `_kSideStudyAll` (still `const`, still the full
list) and the rail now reads a filtered copy:

```dart
final _kSideStudy = _kSideStudyAll
    .where((d) => !LaunchFlags.isHidden(d.route))
    .toList(growable: false);
```

The full list stays intact so turning a tool back on changes nothing here.

**The phone bottom nav (`kDests`) needed no change** — it lists Courses,
Q-Bank, Study Hub, Study and Results, and none of the five appear in it.

### 3.4 `lib/features/study/study_hub_page.dart` — the Study Hub

Three edits:

```dart
static const _allTools = <_ToolEntry>[ ...all tools, unchanged... ];

static List<_ToolEntry> get _tools =>
    _allTools.where((t) => !LaunchFlags.isHidden(t.route)).toList();
```

and the two large featured tiles:

```dart
if (LaunchFlags.drugs) ...[ _DrugRandomizerTile(state: drugState!), ... ],
if (LaunchFlags.myNotes) ...[ const _MyNotesTile(), ... ],
```

and the provider watch is made conditional:

```dart
final drugState = LaunchFlags.drugs ? ref.watch(drugQueueProvider) : null;
```

That last one matters: an unconditional `ref.watch(drugQueueProvider)` would
fire the drug-queue network request on every Study Hub open for a feature the
student cannot see. A hidden feature should cost nothing at runtime.

---

## 4. Verification done before building

- **Entry-point scan.** Every reference to the five routes across `lib/` was
  listed. Only the four files above render or resolve them. The sole other
  mention is `lib/services/screen_protection.dart`, which matches route strings
  for screenshot protection — harmless when the route is unreachable.
- **No other surfaces.** Saved/bookmarks, the Planner, and the push/deep-link
  handlers contain no reference to any of the five.
- **`flutter analyze lib`** → **0 errors**; 18 pre-existing infos/warnings
  (`unnecessary_underscores`, `use_build_context_synchronously`,
  `body_might_complete_normally_catch_error` in `pdf_lesson_page.dart`,
  `lesson_canvas_page.dart`, `personal_deck_page.dart`, `planner_page.dart`) —
  the identical set as before this change, so nothing new was introduced.
- **iOS release build** run with the flags off.

### Will Apple reject this?

No — and specifically, nothing here is the kind of thing review looks for.
There is no hidden-feature toggle a reviewer could flip, no remote config, no
code that behaves differently under review. The build genuinely does not offer
these screens. Dead code inside a binary is not a guideline violation; shipping
placeholder UI (2.1) would have been.

The review items that *do* matter were all confirmed satisfied separately:
3.1.1 (no external purchase paths in the app), Restore Purchases present,
renewal terms shown, Terms + Privacy links reachable, 5.1.1(v) account deletion
in-app, 4.8 Sign in with Apple present.

---

## 5. How to restore — v1.1

### The whole restore, per feature

Open `lib/config/launch_flags.dart` and change one word:

```dart
static final bool osce = true;   // was false
```

That is it. The route unseals, the Study Hub tile reappears, the iPad rail entry
reappears, and `drugQueueProvider` starts being watched again. There is nothing
else to undo — no deleted code to bring back, no imports to re-add.

**Features can come back one at a time.** Turning on `ecg` alone is valid and
leaves the other four hidden.

### After flipping a flag

```bash
cd mobile
~/development/flutter/bin/flutter analyze lib    # expect 0 errors
~/development/flutter/bin/flutter build ios --release --dart-define=API_BASE_URL=https://xyndrome.lk/api
```

### When all five are back on permanently

Once no feature is hidden any more, the flag file can be deleted and the four
call sites simplified:

1. `app_router.dart` — delete the `LaunchFlags.isHidden(loc)` line and the import.
2. `app_shell.dart` — rename `_kSideStudyAll` back to `_kSideStudy`, delete the
   filtered `final`, delete the import.
3. `study_hub_page.dart` — rename `_allTools` back to `_tools` as a plain
   `const`, delete the getter, unwrap the two `if (LaunchFlags...)` blocks,
   restore the unconditional `ref.watch(drugQueueProvider)`, delete the import.
4. Delete `lib/config/launch_flags.dart` and this file.

Doing that is optional. Leaving the flags in place (all `true`) is harmless and
keeps the switch available for the next release.

---

## 6. The real v1.1 work

The flags buy time; they do not fix anything. What these features actually need
is content, not code:

- **OSCE** — more published cases (4 today). See `docs/OSCE_HANDOVER.md`.
- **ECG** — more cards (10 today).
- **Auscultation** — more cards (11 today).
- **Drugs** — 711 rows already imported; the study/review flow is what needs
  design work.
- **My Notes** — the content model was mid-rework when v1.0 was cut.

---

## 7. Unrelated, still outstanding (do not lose these)

- **Backend not deployed** — the question/theory-recap/subject fixes
  (`subjectId` optional, `UpsertTheoryRecapDto` decorators,
  `validateQuestionPayload`) are committed but production still runs the old
  `backend/dist`. Needs `git pull` + `touch ~/public_html/tmp/restart.txt` on
  the server.
- **Frontend not deployed** — the bulk-question JSON/theory changes need the
  cPanel Deploy button.
- **P0 open:** git-tracked backup tarballs under `backups/` contain
  `backend/.env` with live DB / OpenRouter / VAPID / APNS credentials, and the
  repository is public. Those credentials need rotating.
