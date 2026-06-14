/*
 * FeatureComparison — section 9. xyndrome vs Textbooks vs PDF Banks.
 * Indigo header is the only solid-brand block; pastel-mint xyndrome cells;
 * rows stagger in on scroll. Mobile: horizontal scroll.
 */
import { motion } from 'framer-motion';

const FEATURES = [
  'Exam-style MCQs (10,000+)',
  'Doctor-written explanations',
  'Subject mastery tracking',
  'Timed mock exams',
  'Updated for 2025 exams',
  'Mobile app (iOS + Android)',
  'Progress analytics',
  'Sri Lanka–specific content',
];

function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mx-auto" aria-label="Yes">
      <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Cross() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mx-auto" aria-label="No">
      <path d="M6 6l12 12M18 6L6 18" stroke="#d1d5db" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function FeatureComparison() {
  return (
    <section id="compare" className="lpv2-section bg-[#f5f4f0]">
      <div className="lpv2-shell">
        <motion.h2
          className="font-display mb-10 text-center text-[clamp(32px,5vw,52px)] leading-tight text-[#111118]"
          initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
        >
          Why students choose xyndrome
        </motion.h2>

        <div className="overflow-x-auto">
          <div className="mx-auto min-w-[640px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_50px_-30px_rgba(17,17,24,0.3)] ring-1 ring-black/5">
            {/* Header */}
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr]">
              <div className="px-5 py-4" />
              <div className="bg-[#2563eb] px-4 py-4 text-center text-[14px] font-extrabold text-white">xyndrome</div>
              <div className="bg-[#f5f5f5] px-4 py-4 text-center text-[13px] font-bold text-[#9ca3af]">Textbooks</div>
              <div className="bg-[#f5f5f5] px-4 py-4 text-center text-[13px] font-bold text-[#9ca3af]">PDF Banks</div>
            </div>

            {FEATURES.map((f, i) => (
              <motion.div
                key={f}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr] border-t border-black/5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="px-5 py-3.5 text-[13.5px] font-semibold text-[#111118]">{f}</div>
                <div className="bg-[#d6ffe8]/60 px-4 py-3.5"><Check /></div>
                <div className="px-4 py-3.5"><Cross /></div>
                <div className="px-4 py-3.5"><Cross /></div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeatureComparison;
