# xyndrome Q Bank SaaS Promo Plan

## Goal

Promote the xyndrome Q Bank as more than a place to answer MCQs. The video should make students feel that every question teaches them: the key point, the full theory, the explanation, and why the wrong answers are wrong.

## Audience

Medical students preparing for exams who are tired of jumping between PDF banks, textbooks, notes, screenshots, mnemonics, flashcards, and messy scribbled papers.

## Core Message

Most question banks give you questions. xyndrome Q Bank gives you understanding.

## Key Selling Points

- 10,000+ exam-style MCQs
- Built for medical students
- Key points after every question
- Doctor-written explanations
- Clear breakdown of why the correct answer is correct
- Explanation of why every tempting wrong answer is incorrect
- One-tap theory recap beside the question
- Recap includes causes, mechanisms, clinical features, investigations, treatment, mnemonics, and high-yield facts
- Practice, review, and learn in one flow
- Helps students stop memorising answer keys and start understanding the pattern

## Recommended Format

- Duration: 40-45 seconds
- Aspect ratio: 9:16 vertical for Reels, TikTok, Shorts
- Secondary crop: 1:1 square for paid social
- Tone: emotional, premium, clear, exam-focused
- Voice: calm, confident, young female or warm male, like a senior student guiding a junior
- Music: soft tension at start, then clean uplifting SaaS pulse from the first feature reveal

## Storyboard

| Beat | Time | Visual | On-screen Text | Voiceover |
| --- | --- | --- | --- | --- |
| 1. The frustration | 0-5s | Fast but elegant flashes of PDFs, notes, screenshots, flashcards, and scribbled paper around a student desk. No humans needed. | Too many resources. | "Most question banks stop when you choose an answer." |
| 2. The promise | 5-9s | The clutter pulls into a clean phone/app frame showing the Q Bank card. | xyndrome Q Bank | "xyndrome starts teaching there." |
| 3. Scale and trust | 9-14s | MCQ cards stack smoothly with subject chips and progress rings. | 10,000+ exam-style MCQs | "Practise 10,000+ exam-style MCQs built for medical students." |
| 4. Key point reveal | 14-19s | A selected answer resolves into a highlighted learning card labelled Key Point. | Key point first | "After each question, see the key point first - the exact idea the examiner wanted." |
| 5. Explanation | 19-25s | The answer card expands into a clean explanation panel with calm reading rhythm. | Doctor-written explanations | "Then read a clear, doctor-written explanation that turns the answer into a concept." |
| 6. Why wrong answers are wrong | 25-31s | Wrong options slide into view one by one with short rationale cards. | Why every wrong option is wrong | "When another option looks tempting, xyndrome shows why it is wrong too." |
| 7. Theory recap | 31-38s | One tap opens a compact theory recap with sections: causes, mechanisms, clinical picture, investigations, treatment, mnemonic. | One-tap theory recap | "Need the theory? Open the one-tap recap: causes, mechanisms, clinical features, investigations, treatment, mnemonics, and high-yield facts - right beside the question." |
| 8. Outcome | 38-43s | The Q Bank, recap, explanation, and progress cards form one clean study system. | Stop memorising. Start understanding. | "Stop memorising answer keys. Start understanding medicine." |
| 9. Brand lockup | 43-45s | Logo lockup on bright background with soft shimmer. | xyndrome Q Bank | "xyndrome Q Bank. Every question teaches." |

## Full Voiceover - 40 to 45 Seconds

Most question banks stop when you choose an answer.

xyndrome starts teaching there.

Practise 10,000+ exam-style MCQs built for medical students.

After each question, see the key point first - the exact idea the examiner wanted.

Then read a clear, doctor-written explanation that turns the answer into a concept.

When another option looks tempting, xyndrome shows why it is wrong too.

Need the theory? Open the one-tap recap: causes, mechanisms, clinical features, investigations, treatment, mnemonics, and high-yield facts - right beside the question.

Stop memorising answer keys.

Start understanding medicine.

xyndrome Q Bank. Every question teaches.

## 30-Second Cutdown

Most Q banks show the answer.

xyndrome shows you the lesson.

Practise 10,000+ exam-style MCQs with key points, doctor-written explanations, and one-tap theory recaps.

See why the correct answer is right - and why every tempting wrong answer is wrong.

Stop memorising answer keys.

Start understanding medicine.

xyndrome Q Bank. Every question teaches.

## 15-Second Hook Ad

Still using a Q bank that only tells you the answer?

xyndrome teaches the question.

Key points, explanations, theory recaps, and why wrong answers are wrong.

xyndrome Q Bank.

Every question teaches.

## Motion Direction

- Start with scattered study inputs: PDF pages, notes, screenshots, mnemonic cards, flashcards, and paper scribbles.
- Move into one clean Q Bank interface instead of showing random feature cards.
- Every feature reveal should feel like a layer of understanding being added.
- Do not overuse red for wrong answers; keep it clinical and calm.
- Wrong answers should look like useful learning moments, not failure.
- The theory recap should feel like a mini textbook opening beside the question.
- End on confidence and clarity, not hype.

## Visual Language

- Background: bright off-white or very light blue-gray
- Brand gradient: `#4AA3F4 -> #5274F3 -> #6D35DF`
- Correct answer: soft green
- Wrong option rationales: soft rose, muted red, or amber
- Theory recap: warm paper/cream with blue section chips
- Typography: Plus Jakarta Sans, strong but calm
- Cards: clean SaaS surfaces with 8-16px radius, soft shadow, readable text blocks

## Sound Design

- 0-5s: soft paper shuffle, light notification ticks, low study tension
- 5-14s: smooth whoosh as everything organizes into the Q Bank
- 14-25s: gentle pop for key point and explanation cards
- 25-31s: precise ticks for wrong-option rationales
- 31-38s: page-open sound for theory recap
- 38-45s: warm resolve, logo shimmer, clean final tail

## CTA Options

- Start practicing smarter.
- Try xyndrome Q Bank.
- Stop memorising. Start understanding.
- Your next MCQ should teach you something.
- Learn the answer. Learn the reason.

## Remotion Implementation Notes

- Create a dedicated composition such as `QBankPromo`.
- Use a 45-second timeline at 30 fps: 1350 frames.
- Build each beat as a separate component but keep transitions continuous.
- Use `interpolate()` with clamped easing for all feature card entrances.
- Layer voiceover, music bed, and SFX with separate `<Audio>` tracks.
- Keep final logo as a real asset, not generated text.
