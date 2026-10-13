# Runbook — building and running Xyndrome

Written 2026-10-14. Everything here was done on this machine, and every trap
listed is one that actually bit, not a precaution.

Read §1 before your first build. Most of the lost time in this project has gone
to four traps, and they all look like something else.

---

## 1. The four traps

**A failed build still "installs".** `flutter install` pushes whatever is in
`build/ios/iphoneos/Runner.app` — which, after a failed build, is the PREVIOUS
binary. It prints "Installing…" and exits 0, so a broken build looks like a
successful no-op change. **Always chain them and check the build line:**

```bash
flutter build ios --release --dart-define=API_BASE_URL=https://xyndrome.lk/api 2>&1 | grep -E "error|Built" \
  && flutter install --release -d <UDID>
```

If you do not see `✓ Built build/ios/iphoneos/Runner.app`, nothing new went to
the phone.

**The tools are not on PATH.**

| Tool | Path |
|---|---|
| flutter | `~/development/flutter/bin/flutter` |
| keytool | Android Studio's bundled JBR |
| pod | `~/.gem/ruby/2.6.0/bin` |

**CocoaPods is broken here** (ruby 2.6 + activesupport 6.1). The project builds
via SPM, so this only matters if you add a native plugin to `pubspec.yaml`. If
you must: move `ios/Podfile` aside, `cp ios/Podfile.lock ios/Pods/Manifest.lock`,
build, then restore the Podfile.

**The disk fills up and the failure looks unrelated.** A full disk shows up as
`lipo: can't write to output file`. Check with `df -h /System/Volumes/Data`.
Safe to delete, all regenerate:

```bash
rm -rf mobile/build ~/Library/Developer/Xcode/DerivedData/*
```

`~/Library/Developer/Xcode/iOS DeviceSupport` holds ~5.5 GB per device per iOS
version. Entries for OS versions your devices no longer run are dead weight;
the ones matching your current devices regenerate slowly on next connect, so
only delete those if you must.

---

## 2. The Flutter app

### Devices

| Device | UDID | Install with |
|---|---|---|
| iPhone 14 Pro | `00008120-001171683C82201E` | `flutter install` |
| iPad Pro 11″ | `576F7089-887F-5024-A788-E60B5B2B669B` | `devicectl` (Flutter cannot see it) |

### iPhone

```bash
cd mobile
~/development/flutter/bin/flutter build ios --release --dart-define=API_BASE_URL=https://xyndrome.lk/api
~/development/flutter/bin/flutter install --release -d 00008120-001171683C82201E
```

### iPad

Flutter's device discovery fails for this iPad. Build as above, then:

```bash
xcrun devicectl device install app --device 576F7089-887F-5024-A788-E60B5B2B669B \
  mobile/build/ios/iphoneos/Runner.app
```

### Verify what is actually on the device

Do not trust the install output — confirm:

```bash
xcrun devicectl device info apps --device <UDID> --bundle-id app.xyndrome.lk
```

### Static analysis baseline

```bash
cd mobile && ~/development/flutter/bin/flutter analyze lib
```

**18 issues is clean.** They are long-standing infos/warnings in
`pdf_lesson_page.dart`, `lesson_canvas_page.dart`, `personal_deck_page.dart`,
`planner_page.dart` and `lessons_course_detail_page.dart`. **0 errors** is the
thing that matters — more than 18, or any `error •`, means you broke something.

### Reading device logs

Flutter's `debugPrint` is **invisible** in a release build on a device, and
`devicectl --console` only follows the process it launched itself, so reopening
the app silently detaches it. Both of those cost real debugging time. If you
need a trace from a release build, write it to a file in the app container and
pull it:

```bash
xcrun devicectl device copy from --device <UDID> \
  --domain-type appDataContainer --domain-identifier app.xyndrome.lk \
  --source Documents/<file> --destination ./<file>
```

Swift `NSLog` does reach `devicectl ... --console`, if you launch the app from it
and do not reopen the app by hand.

---

## 3. Backend

Live production runs the **committed `backend/dist`** — there is no build step on
the server. So a backend change means: edit the `.ts`, build, commit the `dist`,
push, then pull and restart on the server.

```bash
cd backend
rm -rf dist tsconfig.build.tsbuildinfo node_modules/.cache   # see trap below
npm run build
```

**`rm -rf dist` alone rebuilds nothing.** `tsconfig.build.tsbuildinfo` survives
and TypeScript decides everything is up to date, so you ship a stale `dist` that
looks freshly built. Always delete the tsbuildinfo with it.

Local dev server:

```bash
cd backend && npm run start:dev      # port from PORT in .env, 3000 here
```

Checks:

```bash
npx tsc --noEmit -p tsconfig.build.json   # use the BUILD config
npm run test:unit                          # QA regression suites
```

`tsconfig.json` (not `.build.`) reports pre-existing `rootDir` errors about
`test/` — those are not yours.

Deploying: `git pull` then `touch ~/public_html/tmp/restart.txt` on the server.
Do not curl production repeatedly to test — the IP gets firewall-blocked.

---

## 4. Frontend

```bash
cd frontend
npm run dev        # vite dev server
npm run build      # vite build + sync-root-index
```

Deployed via the cPanel Deploy button. The app is served from the subpath
`https://xyndrome.lk/lms/frontend/dist/`, so any absolute link or store metadata
must include that prefix.

---

## 5. State as of this writing

Branch `v6.3`. **Nothing below is pushed**, and two things are built but not
deployed. Base 4 is committed and installed on the iPhone; the screenshot fixes
in it are **not yet verified by a device screenshot**.

| Commit | |
|---|---|
| *(tip)* | **base 4 — this commit. Installed on the iPhone.** The two below, plus this note. |
| `c775ecad` | base 4 pt.2 — dashboard AVG MARKS chip (replaces READINESS) |
| `477c2a96` | base 4 pt.1 — the four gap-cover races |
| `2b2e0001` | base 3 restored (reapply, after `4ca7f855` reverted it) |
| `48649e5c` | base 3 — capture-protection snapshot shield |
| `d86665a2` | base 2 — blur over the rebuild gap |
| `fed43b87` | rapid switching no longer kills protection permanently |
| `a1ccf245` | blur the rebuild window |
| `a858f981` | rebuild protection on resume |

Returning to an earlier base: `git checkout <commit> -- mobile/`, then rebuild
and reinstall.

**Base 4 is deliberately two commits.** `477c2a96` (screenshot races) and
`c775ecad` (AVG MARKS chip) are independent, so either can be reverted without
taking the other with it. Base 3 was reverted wholesale once (`4ca7f855`) and
that discarded a set of uncommitted fixes along with it — hence the split, and
hence committing before each device test rather than after.

### Not deployed

- **Backend `dist`** — the onboarding (`needs_profile_setup`) and question/theory
  fixes are committed but production still runs the old build.
- **Frontend** — the bulk-question JSON and theory-recap changes need the cPanel
  Deploy button.

### Open, unrelated to any feature

The git-tracked tarballs under `backups/` contain `backend/.env` with live DB,
OpenRouter, VAPID and APNS credentials, and **the repository is public**. Those
credentials need rotating regardless of whether the files are ever removed from
history.

### Known-imperfect: iOS capture protection

Working: a lesson with no app switching, a single quick switch, navigating away
and back. Android is unaffected throughout — `FLAG_SECURE` is a real OS block.

**2026-10-13 — fixes installed on the iPhone, NOT yet verified by a screenshot.**
The rapid close/open loophole was traced to four races around the gap COVER, not
to the 1200ms gap. All four are fixed in the working tree (uncommitted) and in
the release build now on the device:

1. Overlapping `handleResume()` attempts share one cover (one `_inGap`, one
   `ResumeShield` window, no reference counting). Its `finally` uncovered
   unconditionally, so a superseded attempt stripped the cover while a live one
   was still mid-gap with the secure field torn down — real content on screen,
   nothing protecting it, app looking entirely normal. Repeating the cycle
   stacked more abandoned attempts, each uncovering again.
2. `_closeGap()` lands ~2 frames late, so a stale close lowered a shield a newer
   `_openGap()` had just raised.
3. `SecureQuizMode.rootFlutterView()` used `isKeyWindow` while the shield window
   was up AND taking touches. UIKit promotes a touched window to key, so the
   secure field could be built around the SHIELD's root view — `isActive` true,
   protection marked ON, nothing retried, lesson capturable until the route
   changed. Tapping during a rapid close/open is the trigger.
4. `onShowGapCover` was fire-and-forget, so the teardown raced the cover.

A fifth change — sizing the gap to the trip length, to attack the documented
~18s failure — was written, installed, and then **dropped**. It was a hypothesis
with an unmeasured constant (2600ms), and `_resumeGap` is load-bearing per
`memory/ios-screenshot-block-fragile.md`. The tree now carries ONLY the four
races above, with `_resumeGap` at the proven 1200ms. Do not reintroduce a second
gap constant without a device sweep.

Still to verify on the device, with a real screenshot each time: 5-7 rapid
close/opens on a lesson, tapping the screen mid-cycle. **As of 2026-10-13 a
screenshot still got through after these four fixes**, so at least one more
mechanism is in play; the races below were real and provable from the code, but
they were not the whole story.

The "Screenshot blocked" notice fires on every screenshot whether or not the
capture was actually blocked, so **it is not evidence** — only the image in
Photos is.

If you work on this, the one rule that matters: **nothing here can be verified
from code.** `secureField != nil`, `isSecureTextEntry == true`, correct
parenting, non-zero frames and a freshly changed layer identity all read healthy
while screenshots succeed. Every change needs a real screenshot on a real
device. See `memory/ios-screenshot-block-fragile.md` for the measured constants
and the list of approaches already ruled out.
