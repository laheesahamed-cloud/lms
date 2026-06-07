/*
 * TextRevealManifesto — section 5. Ported from 21st.dev (dillionverma/text-reveal):
 * word-by-word opacity reveal driven by scroll progress. Off-white bg, DM Serif
 * Display, plus 3 pastel trust tags that fade in after the reveal.
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const MANIFESTO =
  'xyndrome was built because Sri Lankan medical students deserved better than photocopied notes and outdated PDFs. We built the exam prep tool we wished existed.';

const TRUST_TAGS = [
  { label: 'Built in Sri Lanka', bg: '#d6f0ff' },
  { label: 'Doctor-reviewed content', bg: '#d6ffe8' },
  { label: 'Updated for current exams', bg: '#fff3d6' },
];

function Word({ children, progress, range }) {
  const opacity = useTransform(progress, range, [0, 1]);
  return (
    <span className="relative mx-1.5 inline-block lg:mx-2">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 select-none opacity-[0.12]">{children}</span>
      <motion.span style={{ opacity }}>{children}</motion.span>
    </span>
  );
}

export function TextRevealManifesto() {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: targetRef });
  const words = MANIFESTO.split(' ');

  return (
    <section id="about" className="relative z-0 bg-[#faf9f6]">
      <div ref={targetRef} className="relative h-[235vh]">
        <div className="sticky top-0 mx-auto flex h-screen max-w-4xl flex-col items-center justify-center px-6">
          <p className="font-display flex flex-wrap justify-center text-[clamp(28px,5vw,48px)] leading-[1.25] text-[#111118]">
            {words.map((word, i) => {
              const start = i / words.length;
              const end = start + 1 / words.length;
              return (
                <Word key={`${word}-${i}`} progress={scrollYProgress} range={[start, end]}>
                  {word}
                </Word>
              );
            })}
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

export default TextRevealManifesto;
