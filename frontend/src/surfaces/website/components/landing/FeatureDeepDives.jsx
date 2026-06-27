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
  PlannerVisual,
} from './featureVisuals.jsx';

const FEATURES = [
  {
    id: 'canvas',
    eyebrow: 'Notes you can write on',
    accent: '#e8f5e9',
    h2: 'Notes you can actually write on, not just read.',
    lede:
      'The lesson is your canvas. Write, draw and highlight right on top.',
    bullets: [
      'Type or scribble on the lesson',
      'Highlights & sticky notes anywhere',
      'Saved by lesson, ready to revise',
    ],
    replaces: 'Replaces your notes app + PDF annotator + sticky notes',
    render: () => <CanvasNotesVisual />,
  },
  {
    id: 'mcqs',
    eyebrow: 'A Q-Bank that teaches',
    accent: '#d6ffe8',
    h2: 'A question bank that teaches you, not just tests you.',
    lede:
      'Every answer comes with the key point and a quick theory recap at once, plus why every other option is right or wrong.',
    bullets: [
      'Key point + quick theory recap together',
      'Why each other option is right or wrong',
      'Relaxed Practice or timed Exam mode',
    ],
    replaces: 'Replaces a plain question bank + flipping through textbooks mid-practice',
    render: () => <MCQVisual />,
  },
  {
    id: 'flashcards',
    eyebrow: 'Flashcards you build',
    accent: '#ffd6f0',
    h2: 'Flashcards you can build yourself, not just ours.',
    lede:
      'Use our decks or add your own. Each fact returns right before you forget it.',
    bullets: [
      'Ready-made decks + your own cards',
      'Anki-style spaced repetition',
      'Auto-built from your lessons',
    ],
    replaces: 'Replaces a separate flashcard app and hours of deck-making',
    render: () => <FlashcardVisual />,
  },
  {
    id: 'instant-notes',
    eyebrow: 'Instant lesson notes',
    accent: '#ffe8d6',
    h2: 'Turn any lesson into clean notes, instantly.',
    lede:
      'Dense topic in, exam-ready notes out, with high-yield points already flagged.',
    bullets: [
      'Auto-structured, key facts on top',
      'Highlights & recap built in',
      'Yours to edit on the canvas',
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
      'Timed mocks that feel real, a predicted score, mastery climbing subject by subject.',
    bullets: [
      'Realistic mocks + predicted score',
      'Subject-by-subject mastery',
      'Always know what to study next',
    ],
    replaces: 'Replaces guesswork with a plan',
    render: () => (
      <div className="flex w-full max-w-md flex-col gap-4">
        <MockExamVisual />
        <div className="mx-auto w-full max-w-[20rem] sm:ml-auto sm:mr-0"><MasteryVisual /></div>
      </div>
    ),
  },
  {
    id: 'planner',
    eyebrow: 'Planner & reminders',
    accent: '#e8d6ff',
    h2: 'Plan your week, and actually get reminded.',
    lede:
      'Map your revision, set priorities and get nudged, right beside your lessons.',
    bullets: [
      'Tasks with subjects & due dates',
      'Reminders before each session',
      'Open to today’s agenda',
    ],
    replaces: 'Replaces scattered to-do apps and forgotten revision',
    render: () => <PlannerVisual />,
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
            initial={{ y: 28 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="mb-4 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#111118]" style={{ background: f.accent }}>
              {f.eyebrow}
            </span>
            <h2 id={`feat-${f.id}`} className="font-display lpv2-feature-h2 text-[#111118]">{f.h2}</h2>
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
            className="font-display lpv2-features-h2 mx-auto max-w-4xl text-[#111118]"
            initial={{ y: 18 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            Six study tools. One app. Built to work together.
          </motion.h2>
          <motion.p
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#6b7280] md:text-base"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.6 }}
          >
            Write-on notes, a teaching Q-Bank, your own flashcards, instant lesson notes, timed mock
            exams and a study planner, all in one place, so nothing slips through the cracks.
          </motion.p>
        </div>
      </div>

      {FEATURES.map((f, i) => <Feature key={f.id} f={f} index={i} />)}
    </div>
  );
}
