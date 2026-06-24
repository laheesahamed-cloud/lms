# xyndrome LMS SaaS Intro - Motion Video Script

## Format

- Product: xyndrome, a medical LMS SaaS for medical students
- Output: vertical social intro video
- Aspect ratio: 9:16
- Duration: 25 seconds
- Frame rate: 30 fps
- Composition: `XyndromeIntro`
- Resolution: 1080 x 1920
- Tone: calm, smart, reassuring, premium, student-friendly
- Core idea: scattered study tools become one focused learning system

## One-line Concept

Medicine study feels scattered until xyndrome pulls notes, MCQs, flashcards, mock exams, and progress into one calm exam-prep workspace.

## Voiceover Script

Warm young female voice. Speak like a fellow med student who understands the pressure but does not over-dramatize it. Pronounce xyndrome as "ZIN-drome".

| Time | VO |
| --- | --- |
| 0.25-3.95s | "The exam keeps getting closer, and everything feels scattered." |
| 4.15-7.85s | "So we look for smarter ways to study." |
| 8.25-11.85s | "PDFs, notes, screenshots, mnemonics, flashcards..." |
| 12.20-16.75s | "And still, too many papers to scribble on. Too much to remember alone." |
| 17.10-20.65s | "xyndrome brings it all into one calm place." |
| 20.65-24.10s | "So you stop chasing materials, and start feeling ready." |

## Full Script With Motion Direction

| Beat | Time | Frames | Visual Direction | Motion | Audio Direction |
| --- | --- | --- | --- | --- | --- |
| 1. Study Overload | 0.00-4.00s | 0-120 | A soft cream study desk fills the frame. Medical books, notes, MCQ cards, flashcards, pills, and a stethoscope feel slightly scattered but elegant. The palette is cool and a little tense. | Slow push in. Objects gently tremble and begin to lift, like the study load is becoming too much to hold. | VO line 1. Low warm music bed. Subtle paper rustle and soft UI-pop accents. |
| 2. Everything Everywhere | 4.00-8.00s | 120-240 | Study objects float into a loose orbit. Notes, cards, books, and medical icons separate into different paths to show fragmentation. | Orbiting gets faster but remains smooth. Cards and notes pass close to camera with shallow depth. | VO line 2. Add airy whooshes and card snaps. Music stays restrained. |
| 3. The Turn | 8.00-12.00s | 240-360 | A gradient ECG pulse line appears, using xyndrome blue to violet. The background shifts brighter as the pulse passes through the chaos. | The pulse draws across the screen. Objects decelerate, stop fighting each other, and start aligning into a clean system. | VO line 3. Single heartbeat at the pulse. Add a gentle riser into the reveal. |
| 4. One Calm Place | 12.00-17.00s | 360-510 | Notes, MCQs, flashcards, and mock exams form a structured feature stack around a glowing center. The scene now feels airy, ordered, and useful. | Objects fold, stack, and slide into orbit. Motion should feel precise, not flashy. Use a soft pop only on the final alignment. | VO line 4. Music opens up. Add paper-folds, card snaps, and light interface chimes. |
| 5. Confidence Moment | 17.00-21.00s | 510-630 | The ordered study system collapses into an abstract glowing X form. It should feel like focus, not a hard logo yet. | The feature stack spirals inward, blooms into the X, then settles with a clean shimmer. | VO line 5. Soft impact at 17s. Logo shimmer begins near the end of the beat. |
| 6. Brand Lockup | 21.00-25.00s | 630-750 | Real xyndrome logo fades in on the bright background. Tagline appears beneath it: "Your exam prep starts now." | Logo fades and scales gently into position. Tagline rises 12-18px with opacity. Hold long enough to read. | VO line 6. Music resolves with a clean final tail. No dead silence. |

## On-screen Text

Use only real rendered typography in Remotion or post. Do not bake text into generated footage.

Primary lockup:

```text
xyndrome
Your exam prep starts now.
```

Optional kinetic captions during the video:

```text
Notes
MCQs
Flashcards
Mock exams
One calm place
```

## Visual Style

- Bright minimal medical SaaS aesthetic
- Frosted glass, matte ceramic, soft shadows, pastel medical accents
- Brand gradient: `#4AA3F4 -> #5274F3 -> #6D35DF`
- Backgrounds: `#FAFAF7` during overload, `#F7F9FC` after the turn
- Text color: `#0F172A`
- Typeface: Plus Jakarta Sans, bold for lockup and captions
- Logo source: `public/logo-full.png`

## Edit Notes

- Keep the video as one continuous transformation, not a slideshow.
- The first 8 seconds should communicate scattered study pressure without feeling dark or stressful.
- The 8-second ECG pulse is the emotional pivot.
- From 12 seconds onward, motion should become simpler, cleaner, and more confident.
- Final logo must be the real asset, crisp, centered, and spelled lowercase: `xyndrome`.
- Do not use humans, hands, faces, fake logos, or AI-generated text inside background footage.

## Remotion Mapping

- Main composition: `src/Composition.tsx`
- Duration: 750 frames at 30 fps
- Audio bed: `public/audio/bed.mp3`
- VO files: `public/audio/vo1.mp3` through `public/audio/vo6.mp3`
- SFX files: `public/audio/whoosh.mp3`, `heartbeat.mp3`, `card-snap.mp3`, `bubble-pop.mp3`, `logo-shimmer.mp3`
- Render command: `npm run render`
