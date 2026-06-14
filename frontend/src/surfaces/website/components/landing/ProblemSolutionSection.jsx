/*
 * ProblemSolutionSection — the emotional hook that opens the feature story.
 * Names the real pain (juggling five disconnected tools) without any brand
 * names, then resolves the chaos into one xyndrome card.
 *
 * The five "old way" cards sit scattered at random spots and DON'T tidy up —
 * the mess is the point. As the section scrolls into view each card flies in
 * from further out and settles into its messy spot, one after another. The
 * scroll progress is driven by a plain rAF listener on the section's own
 * getBoundingClientRect (NOT framer's useScroll, which freezes on this landing
 * because of the overflow:clip + route-reveal ancestors). No pin, no scroll
 * capture — the page scrolls normally throughout.
 */
import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* Each card: copy + a scattered resting spot (md+ absolute) + the off-position
 * it flies in from. Deliberately uneven so the cluster reads as chaotic. */
const CARDS = [
  { label: 'A notes app', sub: 'half your lectures', dot: '#3b82f6', pos: 'md:left-[2%] md:top-[4%]', rot: -6, from: { x: -150, y: 24 } },
  { label: 'A flashcard app', sub: 'deck 4 of 9, unfinished', dot: '#ec4899', pos: 'md:left-[55%] md:top-[0%]', rot: 5, from: { x: 150, y: -30 } },
  { label: 'A PDF reader', sub: 'highlights you never reopen', dot: '#f59e0b', pos: 'md:left-[60%] md:top-[44%]', rot: -4, from: { x: 170, y: 50 } },
  { label: 'The group chat', sub: 'where past papers go to hide', dot: '#22c55e', pos: 'md:left-[6%] md:top-[56%]', rot: 4, from: { x: -140, y: 70 } },
  { label: 'Lecture recordings', sub: '1h 58m, still unplayed', dot: '#8b5cf6', pos: 'md:left-[34%] md:top-[78%]', rot: -3, from: { x: 10, y: 130 } },
];

function ScatterCard({ c, index, progress }) {
  // Each card animates over its own slice of the scroll so they arrive in
  // sequence ("come to the current point" one by one) as you scroll down.
  const start = index * 0.07;
  const end = Math.min(start + 0.55, 1);
  const range = [start, end];
  const opacity = useTransform(progress, range, [0, 1]);
  const x = useTransform(progress, range, [c.from.x, 0]);
  const y = useTransform(progress, range, [c.from.y, 0]);
  const rotate = useTransform(progress, range, [c.rot * 2.6, c.rot]);
  const scale = useTransform(progress, range, [0.86, 1]);

  return (
    <motion.div
      className={`md:absolute ${c.pos}`}
      style={{ opacity, x, y, rotate, scale }}
    >
      <div
        className="flex w-fit items-center gap-2.5 rounded-xl bg-white px-4 py-3 shadow-[0_14px_34px_-20px_rgba(17,17,24,0.42)] ring-1 ring-black/5"
        style={{ animation: `lpv2Float ${4.4 + (index % 3) * 0.7}s ease-in-out ${index * 0.3}s infinite` }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.dot }} />
        <span className="text-[13.5px] font-bold text-[#111118]">{c.label}</span>
        <span className="hidden text-[11.5px] text-[#9ca3af] sm:inline">· {c.sub}</span>
      </div>
    </motion.div>
  );
}

export function ProblemSolutionSection() {
  const scatterRef = useRef(null);
  const progress = useMotionValue(0);

  useEffect(() => {
    const el = scatterRef.current;
    if (!el) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) { progress.set(1); return undefined; }

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = el.getBoundingClientRect();
      // 0 when the cluster is just entering from the bottom, 1 once it has
      // risen to ~35% from the top — so the cards finish settling on the way up.
      progress.set(clamp01((vh * 0.9 - rect.top) / (vh * 0.55)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [progress]);

  return (
    <section className="lpv2-section relative overflow-hidden bg-[#fafaf7]">
      <div className="lpv2-shell relative z-[2] flex flex-col items-center text-center">
        <motion.span
          className="mb-4 inline-block rounded-full bg-[#ffd6d6]/70 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#b91c1c]"
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        >
          Sound familiar?
        </motion.span>
        <motion.h2
          className="font-display max-w-3xl text-[clamp(34px,6vw,60px)] leading-[1.08] text-[#111118]"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Stop juggling five apps to study medicine.
        </motion.h2>
        <motion.p
          className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#6b7280] md:text-base"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.6 }}
        >
          Notes in one app. Flashcards in another. Past papers buried in a group chat,
          theory in a stack of PDFs. You end up spending more time
          <span className="font-semibold text-[#111118]"> managing your study tools</span> than actually studying.
        </motion.p>

        {/* Scattered "old way" — flies in card by card on scroll, stays messy.
            md+: absolute scatter in a fixed-height stage. Mobile: simple wrap. */}
        <div
          ref={scatterRef}
          className="relative mt-12 flex w-full max-w-4xl flex-wrap items-start justify-center gap-3 md:mt-10 md:block md:h-[360px]"
        >
          {CARDS.map((c, i) => <ScatterCard key={c.label} c={c} index={i} progress={progress} />)}
        </div>

        <motion.div
          className="my-8 flex flex-col items-center gap-2 text-[#9ca3af]"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }}
          aria-hidden="true"
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.2em]">becomes</span>
          <svg width="20" height="28" viewBox="0 0 20 28" fill="none"><path d="M10 2v22M3 17l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </motion.div>

        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="rounded-2xl bg-[#111118] p-6 text-left shadow-[0_30px_70px_-30px_rgba(17,17,24,0.6)]">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#4aa3f4] via-[#5274f3] to-[#6d35df] text-[16px] font-black text-white">x</span>
              <div>
                <p className="text-[15px] font-extrabold text-white">One platform. Everything.</p>
                <p className="text-[12.5px] text-white/55">Notes · MCQs · Flashcards · Mock exams · Progress</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          className="font-display mt-12 max-w-2xl text-[clamp(22px,3.4vw,34px)] leading-[1.2] text-[#111118]"
          initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          So we built{' '}
          <span className="relative whitespace-nowrap">
            one place for all of it.
            <motion.span
              className="absolute -bottom-1 left-0 h-[2px] w-full origin-left bg-[#2563eb]"
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        </motion.p>
      </div>
    </section>
  );
}

export default ProblemSolutionSection;
