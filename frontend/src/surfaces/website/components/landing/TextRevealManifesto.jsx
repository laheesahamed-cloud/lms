/*
 * TextRevealManifesto — the "why we built it" beat (restores the v3 original).
 * A tall 235vh track with a `sticky top-0` full-screen inner block: the line
 * stays pinned centred in the viewport (the page "scroll-locks" on it) while you
 * scroll through the track, and each word lights up tied to scroll progress.
 *
 * Progress is computed from the track's getBoundingClientRect via rAF — framer's
 * useScroll (the v3 driver) freezes on this landing because of the overflow:clip
 * + route-reveal ancestors, leaving every word stuck dim. CSS `sticky` does the
 * pin natively, so it never JS-traps or clamps the page. Off-white bg, DM Serif.
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const MANIFESTO =
  'We\'re medical students who were tired of the mess. Notes photocopied, PDFs scattered across chat groups, and a different app for everything: flashcards, Q-banks, revision, timetables. More time spent switching apps than studying. So we built xyndrome.';

const TRUST_TAGS = [
  { label: 'Built in Sri Lanka', bg: '#d6f0ff' },
  { label: 'Doctor-reviewed content', bg: '#d6ffe8' },
  { label: 'Updated for current exams', bg: '#fff3d6' },
];

const DIM = 0.12;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function TextRevealManifesto() {
  const trackRef = useRef(null);
  const wordRefs = useRef([]);
  const words = MANIFESTO.split(' ');

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const n = words.length;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) {
      wordRefs.current.forEach((s) => { if (s) s.style.opacity = '1'; });
      return undefined;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = track.getBoundingClientRect();
      // 0 when the track's top reaches the viewport top (sticky engages), 1 when
      // its bottom reaches the viewport bottom (sticky releases) — i.e. progress
      // across the whole pinned scroll, exactly like the v3 scrollYProgress.
      const span = Math.max(1, rect.height - vh);
      const progress = clamp01(-rect.top / span);
      for (let i = 0; i < n; i++) {
        const s = wordRefs.current[i];
        if (!s) continue;
        const start = i / n;
        const end = start + 1 / n;
        const o = DIM + (1 - DIM) * clamp01((progress - start) / (end - start));
        s.style.opacity = o.toFixed(3);
      }
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
  }, [words.length]);

  return (
    <section id="about" className="relative z-0 bg-[#faf9f6]">
      <div ref={trackRef} className="relative h-[235vh]">
        <div className="sticky top-0 mx-auto flex h-screen max-w-4xl flex-col items-center justify-center px-6">
          <p className="font-display flex flex-wrap justify-center text-[clamp(28px,5vw,48px)] leading-[1.25] text-[#111118]">
            {words.map((w, i) => (
              <span
                key={`${w}-${i}`}
                ref={(node) => { wordRefs.current[i] = node; }}
                className="mx-1.5 inline-block lg:mx-2"
                style={{ opacity: DIM }}
              >
                {w}
              </span>
            ))}
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {TRUST_TAGS.map((t, i) => (
              <motion.span
                key={t.label}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-[#111118] ring-1 ring-black/5"
                style={{ background: t.bg }}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: 0.1 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {t.label}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
