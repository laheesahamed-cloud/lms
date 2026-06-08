/*
 * ScrollMorphFeatures — section 4. A pinned, scroll-scrubbed sequence of 4
 * scenes (MCQ, Mock Exams, Mastery, Leaderboard). Each scene crossfades and
 * its pastel accent bleeds into the background. Built to spec with framer-motion
 * (adapted from prashantsom75/scroll-morph-hero patterns).
 */
import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const SCENES = [
  { eyebrow: 'Smart MCQ practice', accent: '#d6ffe8', text: '10,000+ exam-style MCQs — with explanations written by doctors.' },
  { eyebrow: 'Timed mock exams', accent: '#fff3d6', text: 'Simulate real exam pressure. Know exactly where you stand.' },
  { eyebrow: 'Active-recall flashcards', accent: '#ffd6f0', text: 'Lock in every fact with spaced-repetition flashcards.' },
  { eyebrow: 'Canvas notes', accent: '#e8f5e9', text: 'Turn any lesson into clean, structured notes — instantly.' },
  { eyebrow: 'Review & revise', accent: '#ffe8d6', text: 'Highlight, revisit, and master your weak spots before exam day.' },
  { eyebrow: 'Subject mastery', accent: '#e8d6ff', text: 'Track mastery subject by subject. Never guess your weak spots again.' },
  { eyebrow: 'Community + leaderboard', accent: '#d6f0ff', text: 'Study with a community. Rise through the leaderboard.' },
];

/* ---- Scene visuals ---------------------------------------------------- */

function MCQVisual() {
  const opts = ['Aortic Regurgitation', 'Mitral Stenosis', 'Tricuspid Stenosis', 'Pulmonary Stenosis'];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <p className="mb-4 text-[13.5px] font-semibold leading-snug text-[#111118]">
        A 45-year-old presents with dyspnea and a mid-diastolic rumble at the apex. Most likely diagnosis?
      </p>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={o} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] ${i === 1 ? 'border-[#22c55e]/40 bg-[#d6ffe8]/70 font-bold text-[#15803d]' : 'border-black/8 text-[#374151]'}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i === 1 ? 'bg-[#22c55e] text-white' : 'bg-black/5 text-[#6b7280]'}`}>{String.fromCharCode(65 + i)}</span>
            {o}
            {i === 1 && <span className="ml-auto text-[#22c55e]">✓</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[#d6ffe8]/60 px-3 py-2 text-[12px] text-[#15803d]">
        ✦ Classic MS: rumbling diastolic murmur + opening snap after S2.
      </div>
    </div>
  );
}

function MockExamVisual() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Mock Exam</span>
        <span className="font-mono text-2xl font-bold tabular-nums text-[#111118]">01:42:30</span>
      </div>
      <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-[#6b7280]"><span>Progress</span><span>34 / 100</span></div>
      <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-[#f1f1ee]"><span className="block h-full rounded-full bg-[#f59e0b]" style={{ width: '34%' }} /></div>
      <div className="flex items-center gap-4 rounded-xl bg-[#fff3d6]/60 p-3">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="7" /><circle cx="32" cy="32" r="26" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" strokeDasharray="163" strokeDashoffset="21" /></svg>
          <div className="absolute inset-0 grid place-items-center text-[14px] font-extrabold text-[#111118]">87%</div>
        </div>
        <div className="text-[13px] text-[#374151]"><b className="text-[#111118]">Predicted score</b><br />You’re on track to pass.</div>
      </div>
    </div>
  );
}

function MasteryVisual() {
  const rings = [{ l: 'Cardio', v: 94, c: '#ef4444' }, { l: 'Pharma', v: 71, c: '#3b82f6' }, { l: 'Path', v: 83, c: '#8b5cf6' }, { l: 'Neuro', v: 65, c: '#10b981' }];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-4 grid grid-cols-4 gap-2">
        {rings.map((r) => (
          <div key={r.l} className="flex flex-col items-center">
            <div className="relative h-14 w-14">
              <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" /><circle cx="28" cy="28" r="22" fill="none" stroke={r.c} strokeWidth="6" strokeLinecap="round" strokeDasharray="138" strokeDashoffset={138 - (138 * r.v) / 100} /></svg>
              <div className="absolute inset-0 grid place-items-center text-[11px] font-bold text-[#111118]">{r.v}%</div>
            </div>
            <span className="mt-1 text-[10px] font-semibold text-[#6b7280]">{r.l}</span>
          </div>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }).map((_, i) => {
          const on = (i * 7) % 11 < 5;
          return <span key={i} className="aspect-square rounded-[3px]" style={{ background: on ? '#86efac' : '#eef0ec' }} />;
        })}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563eb]/10 px-3 py-1 text-[12px] font-bold text-[#2563eb]">▲ +12% this week</span>
    </div>
  );
}

function LeaderboardVisual() {
  const rows = [
    { rank: 1, name: 'Nethmi K.', pts: 9840 },
    { rank: 2, name: 'Ravindu P.', pts: 9210 },
    { rank: 3, name: 'Tharushi M.', pts: 8975 },
    { rank: 7, name: 'You', pts: 7320, me: true },
  ];
  return (
    <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between"><span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Leaderboard</span><span className="text-[11px] text-[#9ca3af]">This week</span></div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.me ? 'bg-[#d6f0ff]/80 ring-1 ring-[#2563eb]/20' : ''}`}>
            <span className={`w-5 text-center text-[13px] font-extrabold ${r.rank <= 3 ? 'text-[#2563eb]' : 'text-[#9ca3af]'}`}>{r.rank}</span>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(r.name)}`} alt="" width="28" height="28" loading="lazy" className="h-7 w-7 rounded-full bg-[#f1f1ee]" />
            <span className="flex-1 text-[13px] font-semibold text-[#111118]">{r.name}</span>
            <span className="text-[12px] font-bold tabular-nums text-[#6b7280]">{r.pts.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <span className="absolute -right-2 -top-2 animate-bounce rounded-full bg-[#2563eb] px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">+50 XP</span>
    </div>
  );
}

function FlashcardVisual() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Flashcards</span>
        <div className="flex gap-1.5 text-[10.5px] font-bold">
          <span className="rounded-full bg-[#d6f0ff] px-2 py-0.5 text-[#0369a1]">New 8</span>
          <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[#b45309]">Learn 3</span>
          <span className="rounded-full bg-[#ffd6d6] px-2 py-0.5 text-[#b91c1c]">Due 5</span>
        </div>
      </div>
      <div className="rounded-xl bg-[#ffd6f0]/45 p-6 text-center ring-1 ring-black/5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#9d174d]">Cardiology</p>
        <p className="mt-2 text-[16px] font-bold leading-snug text-[#111118]">Most common cause of mitral stenosis?</p>
        <p className="mt-3 text-[12px] font-semibold text-[#6b7280]">↺ Tap to reveal answer</p>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] font-bold">
        <span className="rounded-lg bg-[#fee2e2] py-2 text-center text-[#b91c1c]">Again</span>
        <span className="rounded-lg bg-[#fff3d6] py-2 text-center text-[#b45309]">Hard</span>
        <span className="rounded-lg bg-[#d6ffe8] py-2 text-center text-[#15803d]">Good</span>
        <span className="rounded-lg bg-[#d6f0ff] py-2 text-center text-[#0369a1]">Easy</span>
      </div>
    </div>
  );
}

function CanvasNotesVisual() {
  const points = [
    { c: '#10b981', a: 'Reduced cardiac output', b: ' → tissue hypoperfusion' },
    { c: '#3b82f6', a: 'Frank–Starling', b: ' compensates early' },
    { c: '#8b5cf6', a: 'RAAS activation', b: ' → fluid retention' },
  ];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Canvas Notes</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]">✦ Structured</span>
      </div>
      <h4 className="text-[16px] font-extrabold text-[#111118]">Heart Failure</h4>
      <div className="mt-3 space-y-2.5">
        {points.map((p) => (
          <div key={p.a} className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.c }} />
            <p className="text-[12.5px] leading-snug text-[#374151]"><b className="text-[#111118]">{p.a}</b>{p.b}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[#e8f5e9]/70 px-3 py-2 text-[12px] font-semibold text-[#15803d]">
        📌 Key: treat the cause, offload the heart.
      </div>
    </div>
  );
}

function NotesReviewVisual() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Revision</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#d6ffe8] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]">✓ Reviewed</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#374151]">
        The <mark className="rounded bg-[#ffe8d6] px-1 text-[#9a3412]">JVP rises</mark> in right heart failure, and a{' '}
        <mark className="rounded bg-[#fff3d6] px-1 text-[#b45309]">third heart sound (S3)</mark> points to volume overload.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f1ee]"><span className="block h-full rounded-full bg-[#fb923c]" style={{ width: '72%' }} /></div>
        <span className="text-[13px] font-extrabold tabular-nums text-[#111118]">72%</span>
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-[#6b7280]">18 of 25 cards mastered in this topic</p>
    </div>
  );
}

const VISUALS = [MCQVisual, MockExamVisual, FlashcardVisual, CanvasNotesVisual, NotesReviewVisual, MasteryVisual, LeaderboardVisual];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Soft pastel hex → low-opacity rgba for the background bleed.
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function Scene({ scene, index, progress }) {
  const seg = 1 / SCENES.length;
  const start = index * seg;
  const end = start + seg;
  const isFirst = index === 0;
  const isLast = index === SCENES.length - 1;
  // Crossfade centered on the segment boundaries: scene N fades out over a window
  // around `end` while scene N+1 fades in over the same window around its `start`,
  // so at the boundary both sit at ~0.5 (a true crossfade) instead of both hitting 0
  // and flashing blank between scenes. Keep the window small so most of each
  // segment is the scene held fully visible (long "read" time, quick transition).
  const half = seg * 0.16;
  const opacity = useTransform(
    progress,
    [start - half, start + half, end - half, end + half],
    [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0],
  );
  const y = useTransform(progress, [start - half, start + half], [isFirst ? 0 : 28, 0]);
  const Visual = VISUALS[index];

  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex items-center justify-center px-6">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="mb-4 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#111118]" style={{ background: scene.accent }}>{scene.eyebrow}</span>
          <h3 className="font-display text-[clamp(28px,4.5vw,46px)] leading-[1.1] text-[#111118]">{scene.text}</h3>
        </div>
        <div className="flex justify-center lg:justify-end"><Visual /></div>
      </div>
    </motion.div>
  );
}

export function ScrollMorphFeatures() {
  const ref = useRef(null);
  // Drive progress from the section's own position rather than framer's useScroll,
  // which freezes on this landing page (overflow:clip + route-reveal ancestors throw
  // off its scroll measurement, leaving only one scene visible).
  const progress = useMotionValue(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      // rect.top goes from 0 (pin start) to -distance (pin end).
      progress.set(distance > 0 ? clamp01(-rect.top / distance) : 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // ── One gesture = one scene (discrete step navigation) ───────────────────
    // While the section is fully pinned, each wheel tick / swipe advances exactly
    // ONE scene, regardless of how hard you scroll. A cooldown that extends while
    // you keep scrolling means even a long fling only moves one scene. At the first
    // or last scene the gesture is released so the page scrolls out normally.
    const N = SCENES.length;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let cooling = false;
    let coolTimer = 0;
    const cool = () => { clearTimeout(coolTimer); coolTimer = setTimeout(() => { cooling = false; }, 760); };
    const m = () => {
      const rect = el.getBoundingClientRect();
      const dist = el.offsetHeight - window.innerHeight;
      return { rect, dist, absTop: rect.top + window.scrollY };
    };
    const active = () => {
      const { rect } = m();
      return rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
    };
    const currentScene = () => {
      const { rect, dist } = m();
      const p = dist > 0 ? clamp01(-rect.top / dist) : 0;
      return Math.max(0, Math.min(N - 1, Math.round(p * N - 0.5)));
    };
    const goTo = (i) => {
      const { absTop, dist } = m();
      const top = Math.round(absTop + ((i + 0.5) / N) * dist);
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    const tryStep = (dir) => {
      const next = currentScene() + dir;
      if (next < 0 || next > N - 1) return false; // at an edge → let the page scroll out
      if (cooling) { cool(); return true; }       // mid-gesture → swallow, keep cooldown alive
      cooling = true;
      goTo(next);
      cool();
      return true;
    };
    const onWheel = (e) => {
      if (!active()) return;
      if (tryStep(e.deltaY > 0 ? 1 : -1)) e.preventDefault();
    };
    let touchY = null;
    const onTouchStart = (e) => { touchY = e.touches[0]?.clientY ?? null; };
    const onTouchMove = (e) => {
      if (!active() || touchY == null) return;
      const dy = touchY - (e.touches[0]?.clientY ?? touchY);
      if (Math.abs(dy) < 22) return;
      if (tryStep(dy > 0 ? 1 : -1)) { e.preventDefault(); touchY = e.touches[0].clientY; }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      clearTimeout(coolTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [progress]);

  // Background bleeds each scene's accent at low opacity as it becomes active.
  const bgInputs = [0, ...SCENES.map((_, i) => (i + 0.5) / SCENES.length), 1];
  const bgColors = ['#fafaf7', ...SCENES.map((s) => rgba(s.accent, 0.35)), rgba(SCENES[SCENES.length - 1].accent, 0.35)];
  const bg = useTransform(progress, bgInputs, bgColors);

  return (
    <section ref={ref} className="relative" style={{ height: `${SCENES.length * 110}vh` }}>
      <motion.div style={{ backgroundColor: bg }} className="sticky top-0 flex h-screen items-center overflow-hidden">
        {SCENES.map((scene, i) => (
          <Scene key={scene.eyebrow} scene={scene} index={i} progress={progress} />
        ))}
        {/* progress dots */}
        <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
          {SCENES.map((s, i) => <ProgressDot key={s.eyebrow} accent={s.accent} index={i} progress={progress} />)}
        </div>
      </motion.div>

      {/* One snap point per scene, placed at the scroll offset where that scene is
          fully held. `scroll-snap-align: start` makes the viewport settle here, so
          one scroll advances exactly one card (see html.lpv2-snap-active in CSS). */}
      {SCENES.map((s, i) => (
        <span
          key={`snap-${s.eyebrow}`}
          aria-hidden="true"
          className="lpv2-snap-point"
          style={{ top: `calc(${(i + 0.5) / SCENES.length} * (100% - 100vh))` }}
        />
      ))}
    </section>
  );
}

function ProgressDot({ accent, index, progress }) {
  const seg = 1 / SCENES.length;
  const opacity = useTransform(
    progress,
    [index * seg - 0.001, index * seg, (index + 1) * seg, (index + 1) * seg + 0.001],
    [0.3, 1, 1, 0.3],
  );
  return <motion.span style={{ background: accent, opacity }} className="h-1.5 w-8 rounded-full" />;
}

export default ScrollMorphFeatures;
