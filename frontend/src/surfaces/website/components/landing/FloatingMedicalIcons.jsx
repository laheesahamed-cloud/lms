/*
 * FloatingMedicalIcons — section 3. Cream editorial "every subject" section.
 * A centered headline over a tidy, evenly-spaced grid of pastel subject cards
 * that fills the section at every width (no absolute floating pills, no empty
 * gap). Cards still get a soft staggered entrance + a gentle idle float.
 */
import { motion } from 'framer-motion';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const med = (name) => `${ASSET}medical/${name}.svg`;

const SUBJECTS = [
  { icon: 'heart', label: 'Cardiology', bg: '#ffd6d6' },
  { icon: 'pills', label: 'Pharmacology', bg: '#d6f0ff' },
  { icon: 'brain', label: 'Neurology', bg: '#e8d6ff' },
  { icon: 'microscope', label: 'Pathology', bg: '#d6ffe8' },
  { icon: 'dna', label: 'Biochemistry', bg: '#fff3d6' },
  { icon: 'blood', label: 'Microbiology', bg: '#ffd6f0' },
  { icon: 'tooth', label: 'Surgery', bg: '#e8f5e9' },
  { icon: 'syringe', label: 'Anatomy', bg: '#ffe8d6' },
];

function SubjectCard({ s, index }) {
  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: (index % 4) * 0.06 + Math.floor(index / 4) * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-[0_10px_30px_-16px_rgba(17,17,24,0.3)] ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-1 max-[520px]:px-3 max-[520px]:py-3"
        style={{ background: s.bg, animation: `lpv2Float ${4 + (index % 4) * 0.6}s ease-in-out ${index * 0.25}s infinite` }}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/55 ring-1 ring-black/5 max-[520px]:size-9">
          <img src={med(s.icon)} alt="" aria-hidden="true" className="size-5 max-[520px]:size-4" loading="lazy" />
        </span>
        <span className="text-[15px] font-bold text-[#111118] max-[520px]:text-[13.5px]">{s.label}</span>
      </div>
    </motion.div>
  );
}

export function FloatingMedicalIcons() {
  return (
    <section id="subjects" className="lpv2-section relative overflow-hidden bg-[#fafaf7]">
      <div className="lpv2-shell relative z-[2] flex flex-col items-center text-center">
        <motion.span
          className="mb-4 inline-block rounded-full bg-[#2563eb]/8 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2563eb]"
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        >
          25+ subjects
        </motion.span>
        <motion.h2
          className="font-display text-[clamp(40px,7vw,72px)] leading-[1.05] text-[#111118]"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Every subject.{' '}
          <span className="relative whitespace-nowrap">
            One platform.
            <motion.span
              className="absolute -bottom-1 left-0 h-[2px] w-full origin-left bg-[#2563eb]"
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        </motion.h2>
        <motion.p
          className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#6b7280] md:text-base"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.6 }}
        >
          Cardiology · Pharmacology · Pathology · Microbiology · and 20+ more — every
          subject organised, exam-ready, and tracked in one place.
        </motion.p>

        <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 max-[520px]:mt-9 max-[520px]:gap-2.5">
          {SUBJECTS.map((s, i) => <SubjectCard key={s.label} s={s} index={i} />)}
        </div>
      </div>
    </section>
  );
}

export default FloatingMedicalIcons;
