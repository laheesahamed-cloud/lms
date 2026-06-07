/*
 * StatsSection — animated count-up stats (framer-motion useInView + rAF).
 * DM Serif numbers, pastel-bordered cards, tabular-nums to avoid layout shift.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const STATS = [
  { value: 4, suffix: '', label: 'Core LMS workflows', bg: '#d6ffe8' },
  { value: 10000, suffix: '+', label: 'Exam-style MCQs', bg: '#d6f0ff' },
  { value: 25, suffix: '+', label: 'Clinical subjects', bg: '#e8d6ff' },
  { value: 3, suffix: '', label: 'Practice modes', bg: '#fff3d6' },
];

function CountUp({ value, suffix, active }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return undefined; }
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, value]);
  return <span className="tabular-nums">{n.toLocaleString()}{suffix}</span>;
}

export function StatsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="lpv2-section bg-[#fafaf7]">
      <div className="lpv2-shell grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            className="lpv2-press rounded-[20px] bg-white p-6 text-center shadow-[0_10px_30px_-18px_rgba(17,17,24,0.18)]"
            style={{ border: `2px solid ${s.bg}` }}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="font-display text-[clamp(40px,6vw,64px)] leading-none text-[#111118]">
              <CountUp value={s.value} suffix={s.suffix} active={inView} />
            </div>
            <div className="mt-2 text-[13px] font-medium text-[#6b7280] md:text-sm">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default StatsSection;
