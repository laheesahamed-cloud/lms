/*
 * TextRevealManifesto — the "why we built it" beat. The line staggers in word
 * by word once the section scrolls into view (no 235vh sticky scrub / pin — so
 * it can't trap or clamp the page). Off-white bg, DM Serif Display, 3 trust tags.
 */
import { motion } from 'framer-motion';

const MANIFESTO =
  'xyndrome was built because Sri Lankan medical students deserved better than photocopied notes and scattered PDFs. So we built the all-in-one study tool we wished existed.';

const TRUST_TAGS = [
  { label: 'Built in Sri Lanka', bg: '#d6f0ff' },
  { label: 'Doctor-reviewed content', bg: '#d6ffe8' },
  { label: 'Updated for current exams', bg: '#fff3d6' },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const word = {
  hidden: { opacity: 0.12 },
  show: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function TextRevealManifesto() {
  const words = MANIFESTO.split(' ');

  return (
    <section id="about" className="lpv2-section bg-[#faf9f6]">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <motion.p
          className="font-display flex flex-wrap justify-center text-[clamp(28px,5vw,48px)] leading-[1.25] text-[#111118]"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
        >
          {words.map((w, i) => (
            <motion.span key={`${w}-${i}`} className="mx-1.5 inline-block lg:mx-2" variants={word}>
              {w}
            </motion.span>
          ))}
        </motion.p>

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
    </section>
  );
}

export default TextRevealManifesto;
