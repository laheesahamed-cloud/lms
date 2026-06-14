/*
 * FeatureDeepDives — the heart of the landing's "one platform" story (#features).
 * Each real feature gets its own calm, in-view section: eyebrow, SEO H2, an
 * emotional lede, three concrete capabilities, and a reused product visual.
 * Layout alternates side to side. No pin / wheel-capture / snap — plain scroll.
 */
import { motion } from 'framer-motion';
import {
  CanvasNotesVisual,
  MCQVisual,
  FlashcardVisual,
  NotesReviewVisual,
  MockExamVisual,
  MasteryVisual,
} from './featureVisuals.jsx';

const FEATURES = [
  {
    id: 'canvas',
    eyebrow: 'Notes & Canvas',
    accent: '#e8f5e9',
    h2: 'Your notes, your way — on one infinite canvas.',
    lede:
      'No more switching between a notes app, a PDF annotator, and a pile of sticky notes. Write, draw, and organise everything for a topic in one place — the way your brain actually works.',
    bullets: [
      'Type clean structured notes, or scribble freehand — your choice.',
      'Drop sticky notes, highlight, draw and design right on the page.',
      'Everything stays organised by lesson, ready when you revise.',
    ],
    replaces: 'Replaces your notes app + PDF annotator + sticky notes',
    render: () => <CanvasNotesVisual />,
  },
  {
    id: 'mcqs',
    eyebrow: 'Smart MCQs',
    accent: '#d6ffe8',
    h2: 'Every question makes you a better doctor.',
    lede:
      'Practise 10,000+ exam-style MCQs — but the real value is what happens after you answer. Each question teaches, so you never just memorise the answer key.',
    bullets: [
      'A full, doctor-written explanation and the key points to remember.',
      'See exactly why every wrong option is wrong — not just the right one.',
      'One-tap theory recap right beside the question — without leaving the page.',
    ],
    replaces: 'Replaces your question bank + flipping through textbooks mid-practice',
    render: () => <MCQVisual />,
  },
  {
    id: 'flashcards',
    eyebrow: 'High-yield flashcards',
    accent: '#ffd6f0',
    h2: 'Lock it in — and actually keep it.',
    lede:
      'Spaced repetition that brings each fact back exactly when you’re about to forget it. High-yield decks, kept up to date, built from the very topics you’re studying.',
    bullets: [
      'Anki-style spaced repetition, with Again / Hard / Good / Easy grading.',
      'High-yield decks that stay current with the exams.',
      'Cards auto-built from your lessons, so there’s nothing to set up.',
    ],
    replaces: 'Replaces a separate flashcard app and hours of deck-making',
    render: () => <FlashcardVisual />,
  },
  {
    id: 'ai-notes',
    eyebrow: 'AI notes',
    accent: '#ffe8d6',
    h2: 'Turn any lesson into clean notes, instantly.',
    lede:
      'Let AI distil a dense topic into clear, structured, exam-ready notes — with the high-yield points highlighted — so you start revising in seconds instead of rewriting.',
    bullets: [
      'AI-structured notes with the key facts pulled to the top.',
      'Highlights and recap built in, so revision is fast.',
      'Yours to edit — keep them in your own words on the canvas.',
    ],
    replaces: 'Replaces hours of rewriting and re-summarising',
    render: () => <NotesReviewVisual />,
  },
  {
    id: 'mocks',
    eyebrow: 'Mock exams & progress',
    accent: '#fff3d6',
    h2: 'Walk into the real exam already calm.',
    lede:
      'Sit timed mock exams that feel like the real thing, get a predicted score, then watch your mastery climb subject by subject — so you always know what to study next.',
    bullets: [
      'Realistic timed mocks with a predicted score when you finish.',
      'Subject-by-subject mastery, so weak spots can’t hide.',
      'Clear next steps — never guess what to revise again.',
    ],
    replaces: 'Replaces guesswork with a plan',
    render: () => (
      <div className="flex w-full max-w-md flex-col gap-4">
        <MockExamVisual />
        <div className="mx-auto w-full max-w-[20rem] sm:ml-auto sm:mr-0"><MasteryVisual /></div>
      </div>
    ),
  },
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="11" fill="#2563eb" opacity="0.1" />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Feature({ f, index }) {
  const flip = index % 2 === 1;
  return (
    <section className="lpv2-section" style={{ background: index % 2 === 0 ? '#fafaf7' : '#f5f4f0' }} aria-labelledby={`feat-${f.id}`}>
      <div className="lpv2-shell">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            className={flip ? 'lg:order-2' : ''}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="mb-4 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#111118]" style={{ background: f.accent }}>
              {f.eyebrow}
            </span>
            <h2 id={`feat-${f.id}`} className="font-display text-[clamp(28px,4.2vw,44px)] leading-[1.1] text-[#111118]">{f.h2}</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#4b5563] md:text-base">{f.lede}</p>
            <ul className="mt-6 space-y-3">
              {f.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-[14px] leading-snug text-[#374151] md:text-[15px]">
                  <CheckIcon />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {f.replaces && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#6b7280] ring-1 ring-black/5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                {f.replaces}
              </p>
            )}
          </motion.div>
          <motion.div
            className={`flex justify-center ${flip ? 'lg:order-1 lg:justify-start' : 'lg:justify-end'}`}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            {f.render()}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function FeatureDeepDives() {
  return (
    <div id="features">
      <div className="lpv2-section bg-[#fafaf7] !pb-0 text-center">
        <div className="lpv2-shell">
          <motion.span
            className="mb-4 inline-block rounded-full bg-[#2563eb]/8 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2563eb]"
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            Everything in one place
          </motion.span>
          <motion.h2
            className="font-display mx-auto max-w-3xl text-[clamp(32px,5vw,52px)] leading-tight text-[#111118]"
            initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            One platform for your whole study workflow.
          </motion.h2>
          <motion.p
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#6b7280] md:text-base"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.6 }}
          >
            Notes, exam-style MCQs, flashcards, AI notes, mock exams and progress — built
            to work together, so nothing slips through the cracks.
          </motion.p>
        </div>
      </div>

      {FEATURES.map((f, i) => <Feature key={f.id} f={f} index={i} />)}
    </div>
  );
}

export default FeatureDeepDives;
