# xyndrome — Brand Teaser (9:16, ~24s)

Emotional SaaS brand teaser for Instagram Reels / TikTok / Shorts.
One continuous **morphing** shot — no cuts. No humans, hands, or AI-rendered text/logos in footage.
All typography + the real logo are composited in post (ffmpeg + Pillow).

## Concept arc
Chaos (juggling too many study tools) → the turn (a heartbeat brings order) → relief → logo reveal.

## Storyboard (7 keyframes / 6 frame-chained clips)
| Beat | Time | Scene |
|---|---|---|
| S1 The Pile | 0–4s | Cream desk, tilting stack of pastel medical books + clutter, cool grade |
| S2 The Juggle | 4–8s | Everything floats up, orbits chaotically, peak overwhelm |
| S3 The Turn | 8–12s | A glowing gradient ECG pulse sweeps across; grade warms; objects snap into calm orbit |
| S4 Convergence | 12–17s | Objects morph into each other, spiral to center; ceramic heart beats |
| S5 The Mark | 17–21s | Everything collapses into a glowing abstract X of indigo→violet light |
| S6 Lockup | 21–24s | Clean bright canvas → real logo + tagline fade in |

Keyframes K0..K6 are the beat boundaries. Clip N runs K(N-1) → K(N) (start frame → end frame),
so hard-concatenation yields one cut-less shot.

## Voiceover (~24s, warm young female, fellow-med-student tone)
- (0–4s) "Tired of juggling five different apps just to study medicine?"
- (4–8s) "Notes here. Questions there. Flashcards… somewhere else."
- (8–12s) "What if everything just… came together?"
- (12–17s) "Notes, MCQs, flashcards, mock exams — one place."
- (17–20s) "We've got you."
- (20–24s) "xyndrome. Your exam prep starts now."

## Brand kit
- Name: `xyndrome` (always lowercase). Pronounced "ZIN-drome".
- Gradient: `#4AA3F4 → #5274F3 → #6D35DF`; indigo `#2563EB`; violet `#7C3AED`.
- Backgrounds: cool `#FAFAF7` (chaos) → bright `#F7F9FC` (resolution). Ink `#0F172A`.
- Font: Plus Jakarta Sans (ExtraBold tagline).
- Logo: `frontend/public/landing/logo.png` (real asset, post-only).

## Folder
- `keyframes/` K0–K6 PNGs (2K)
- `clips/` 6 frame-chained MP4s
- `audio/` VO, music, SFX stems
- `work/` overlays, fonts, intermediates
- `out/` final `xyndrome-teaser-9x16.mp4`

## Pipeline
nano_banana_pro (keyframes, image-to-image chained) → kling3_0 (start+end frame clips)
→ inworld TTS (VO) + sonilo (music) + mirelo (SFX) → ffmpeg assembly.
