# MASTER PROMPT — xyndrome social teaser (paste everything below into a fresh Claude session with the Higgsfield connector)

---

You are a senior motion-graphics director and producer. Produce a **finished, fully-assembled vertical product teaser video (MP4)** for **xyndrome**, a medical LMS for Sri Lankan medical students. You will generate all footage with Higgsfield, generate the voiceover, and assemble everything locally with ffmpeg into one final file. Work end-to-end; only stop once for my approval at the checkpoint marked below.

## 1. The video

- **Type:** Emotional SaaS brand teaser for social media (Instagram Reels / TikTok / Shorts). NOT a UI tour — no app screenshots, no screen recordings.
- **Duration:** 22–27 seconds. **Aspect:** 9:16 vertical, 1080×1920, 24 or 30 fps.
- **The single most important rule — ONE CONTINUOUS SHOT:** absolutely no cuts, no slideshow feel, no scene changes. Every scene must **morph** into the next: objects from one moment physically transform, fold, dissolve, or flow into the objects of the next moment. If two adjacent clips look like a "cut", the result is rejected.
- **Emotional arc:** chaos/pain (juggling too many study tools) → the turn (everything comes together) → relief → logo reveal with tagline.
- **No humans, no hands, no faces** anywhere in the footage.
- **No AI-generated text or logos in the footage.** AI models mangle words — ALL typography and the logo are composited later in ffmpeg from real assets. Every generation prompt must include: `no text, no letters, no logos, no watermark, no humans, no hands`.

## 2. Brand kit (use these exact values)

- **Brand name:** `xyndrome` — always all-lowercase.
- **Logo (light mode, full wordmark):** `/Applications/XAMPP/xamppfiles/htdocs/lms/frontend/public/landing/logo.png` (1254×956 PNG — colored gradient X with stethoscope + "yndrome" text). Icon-only fallback: `/Applications/XAMPP/xamppfiles/htdocs/lms/frontend/public/brand/xyndrome-logo-mark-light.webp`.
- **Colors:** brand gradient `#4AA3F4 → #5274F3 → #6D35DF`; brand indigo `#2563EB`; violet `#7C3AED`; light background `#F7F9FC`; warm cream `#FAFAF7`; ink text `#0F172A`. Subject pastels for accents: rose `#FFD6D6`, sky `#D6F0FF`, lavender `#E8D6FF`, mint `#D6FFE8`, peach `#FFF3D6`.
- **Font:** Plus Jakarta Sans (download from Google Fonts for the ffmpeg text overlays; bold/extrabold for the tagline).
- **Tone:** calm, empowering, peer-to-peer; clinical without being cold.

## 3. Visual style block (repeat VERBATIM in every image/video prompt for consistency)

> Premium soft-lit 3D render, matte ceramic and frosted-glass materials, pastel medical color palette on a bright minimal background (#F7F9FC), soft global illumination, gentle studio shadows, shallow depth of field, Apple-ad aesthetic, clean and weightless, vertical 9:16 composition, no text, no letters, no logos, no watermark, no humans, no hands.

Medical objects must be stylized and friendly (matte ceramic anatomical heart, smooth pill capsules, clean textbooks, coiled stethoscope, paper flashcards) — never gory, never photoreal organs.

## 4. Storyboard — six beats, frame-chained

| Beat | Time | Scene | Morph into next |
|---|---|---|---|
| S1 "The Pile" | 0–4s | Overhead-ish view of a cream desk (#FAFAF7): a tilting stack of thick medical textbooks, scattered sticky notes, loose paper sheets, highlighters, a tangled stethoscope, a few floating frosted-glass app cards. Slightly chaotic, cool desaturated grade. Slow camera push-in, papers fluttering subtly. | Objects begin lifting off the desk |
| S2 "The Juggle" | 4–8s | The clutter floats up and orbits chaotically — pages peel off books, flashcards tumble, pill capsules and pens spin in slow motion around the frame. Visual overwhelm, still cool-toned. | Everything decelerates as a light approaches |
| S3 "The Turn" | 8–12s | A glowing gradient ECG pulse line (#4AA3F4→#6D35DF) draws itself across the frame like a heartbeat trace. Wherever it passes, the cool grade warms to bright #F7F9FC and the floating objects snap into a calm, orderly orbit. One soft heartbeat. | Ordered objects begin merging |
| S4 "Convergence" | 12–17s | Objects morph INTO each other as they spiral toward center: pages fold into flashcards, flashcards stack into one neat deck, the stethoscope coils gracefully inward, a matte-ceramic anatomical heart gives one gentle beat that ripples outward. | The spiral tightens into a single glowing form |
| S5 "The Mark" | 17–21s | Everything collapses into a glowing abstract X-shaped form of indigo-violet gradient light with a soft bloom, floating on the bright background, particles settling. (This is only an ABSTRACT X of light — the real logo is overlaid in ffmpeg.) | Bloom settles to a clean hold |
| S6 "Lockup" | 21–25s | Clean, calm hold on the bright background with faint settling particle shimmer — this is the canvas for the real logo + tagline overlay in post. | — |

## 5. Production pipeline

**Step 0 — Setup.** Check Higgsfield balance and explore available models (`models_explore`); choose the best image model and a video model that supports **start-frame AND end-frame** image conditioning. Upload the logo file to Higgsfield only if a generation needs it as reference; otherwise the logo is post-only.

**Step 1 — Keyframes.** Generate 7 keyframe images **K0–K6** (the boundary frames of the six beats) at 9:16, each prompt = scene description + the verbatim style block. Generate 2 variants of each and pick the most on-brand. Consistency between adjacent keyframes matters more than individual beauty.

**Step 2 — Frame-chained clips (this is what makes it cut-less).** Generate 6 video clips where **clip N uses keyframe K(N-1) as its start frame and K(N) as its end frame**. Each motion prompt describes the morph/transformation between the two frames ("the scattered pages fold mid-air into flashcards which stack into a single deck…"). Because every clip starts on the exact frame the previous one ended on, hard-concatenation produces one continuous shot.

**Step 3 — Voiceover.** Warm, relatable young female voice — like a fellow med student, calm and reassuring, gently energizing toward the end. Generate with the best available TTS (Higgsfield audio/speak model if available via `models_explore`; otherwise any TTS tool available, otherwise ask me for a VO file). Script (timed, ~48 words):

> (0–4s) "Tired of juggling five different apps just to study medicine?"
> (4–8s) "Notes here. Questions there. Flashcards… somewhere else."
> (8–12s) "What if everything just… came together?"
> (12–17s) "Notes, MCQs, flashcards, mock exams — one place."
> (17–20s) "We've got you."
> (20–25s) "xyndrome. Your exam prep starts now."

Pronunciation: "ZIN-drome". You may micro-polish wording for rhythm but keep the beats, the meaning, and "We've got you."

**Step 4 — Music + SFX (native SaaS-ad feel).** Minimal warm track: soft tense piano/pads 0–8s → opens into a light uplifting beat at the 8s turn → peak at 17s → resolves into a clean tail. SFX cues: paper rustle (0s), airy whoosh on every morph, single heartbeat thump + riser at 8s, soft paper-fold/card-snap sounds 12–17s, deep soft impact + shimmer at 17s, warm logo sting at 21s. Generate with available audio tools, or use royalty-free assets, or ask me to supply files — never ship silence.

**Step 5 — Assembly (ffmpeg, local).**
1. Hard-concat the 6 clips (identical fps/resolution). If any seam is visible, bridge with a 0.2–0.3s `xfade` — but frame-chaining should make this unnecessary.
2. Overlay the REAL logo (`landing/logo.png`, scaled, centered) fading in at ~21s over S6.
3. Tagline under the logo at ~22.5s in Plus Jakarta Sans bold, ink `#0F172A`: **"Your exam prep starts now."** (render text via drawtext or a pre-rendered transparent PNG).
4. Mix audio: VO ~-14 LUFS, music ducked ~6 dB under VO, SFX placed on cue.
5. Export: H.264, yuv420p, 1080×1920, ~10 Mbps, AAC 192k → `xyndrome-teaser-9x16.mp4`.

## 6. Checkpoint & QC

- **CHECKPOINT (the only pause):** after Step 1, show me the 7 chosen keyframes + final VO script in one message and wait for "go". Then run Steps 2–5 without stopping.
- **QC before delivering:** watch the result — verify (a) zero visible cuts, (b) no humans/hands/text in footage, (c) logo is the real asset and crisp, (d) "xyndrome" spelled lowercase everywhere, (e) duration 22–27s, (f) VO synced to beats, (g) audio has no dead silence or clipping.
- Deliver the final MP4 path plus a folder with keyframes, clips, and audio stems so I can re-edit later.
