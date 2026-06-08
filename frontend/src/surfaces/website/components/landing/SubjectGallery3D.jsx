/*
 * SubjectGallery3D — section 6. 8 subject module cards with pointer-driven 3D
 * tilt (CSS perspective; no three.js). Dashboard-style cards, indigo question
 * counts, mastery bar. Light-gray bg.
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const med = (name) => `${ASSET}medical/${name}.svg`;

const SUBJECTS = [
  { name: 'Cardiology',   q: 1240, topics: 12, mastery: 78, icon: 'heart', bg: '#ffd6d6' },
  { name: 'Pharmacology', q: 980,  topics: 10, mastery: 71, icon: 'pills', bg: '#d6f0ff' },
  { name: 'Pathology',    q: 1100, topics: 14, mastery: 83, icon: 'microscope', bg: '#e8d6ff' },
  { name: 'Microbiology', q: 760,  topics: 9,  mastery: 66, icon: 'blood', bg: '#d6ffe8' },
  { name: 'Biochemistry', q: 890,  topics: 11, mastery: 74, icon: 'dna', bg: '#fff3d6' },
  { name: 'Surgery',      q: 650,  topics: 8,  mastery: 69, icon: 'tooth', bg: '#ffd6f0' },
  { name: 'Anatomy',      q: 920,  topics: 13, mastery: 81, icon: 'syringe', bg: '#e8f5e9' },
  { name: 'Physiology',   q: 840,  topics: 10, mastery: 72, icon: 'lungs', bg: '#ffe8d6' },
];

function TiltCard({ s, index }) {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${-py * 8}deg) rotateY(${px * 10}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: (index % 4) * 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 800 }}
    >
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="lpv2-subject-card group relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out [transform-style:preserve-3d] hover:shadow-[0_24px_58px_-34px_rgba(59,130,246,0.42)]"
      >
        <div className="relative z-[1] mb-3 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_28px_-22px_rgba(17,17,24,0.45)]" style={{ background: `linear-gradient(135deg, ${s.bg}, rgba(255,255,255,0.72))` }} aria-hidden="true">
            <img src={med(s.icon)} alt="" className="size-5" loading="lazy" />
          </span>
          <div>
            <h3 className="lpv2-subject-card-title text-[15px] font-extrabold text-[#111118]">{s.name}</h3>
            <p className="lpv2-subject-card-meta text-[12px] text-[#6b7280]">
              <span className="lpv2-subject-card-count font-bold text-[#2563eb]">{s.q.toLocaleString()}</span> questions · {s.topics} topics
            </p>
          </div>
        </div>
        <div className="lpv2-subject-card-meta relative z-[1] mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#6b7280]">
          <span>Avg mastery</span><span className="lpv2-subject-card-title text-[#111118]">{s.mastery}%</span>
        </div>
        <div className="lpv2-subject-card-track relative z-[1] h-2 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(17,17,24,0.08)]">
          <motion.span
            className="block h-full w-full origin-left rounded-full shadow-[0_0_18px_rgba(82,116,243,0.4)]"
            style={{ background: 'linear-gradient(90deg, #22D3EE 0%, #5274F3 48%, #6D35DF 100%)' }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: s.mastery / 100 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function SubjectGallery3D({ darkModeActive = false, onDarkModeChange }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => onDarkModeChange?.(entry.isIntersecting),
      { rootMargin: '-38% 0px -38% 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => {
      onDarkModeChange?.(false);
      observer.disconnect();
    };
  }, [onDarkModeChange]);

  return (
    <motion.section
      ref={sectionRef}
      className="lpv2-section lpv2-subject-gallery overflow-hidden"
      initial={false}
      animate={{ backgroundColor: darkModeActive ? '#070310' : '#f5f4f0' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="lpv2-shell">
        <motion.h2
          className="font-display mb-12 text-center text-[clamp(32px,5vw,52px)] leading-tight"
          initial={{ opacity: 0, y: 18 }}
          animate={{ color: darkModeActive ? '#f8fafc' : '#111118' }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.32 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          25+ subjects. All exam-ready.
        </motion.h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUBJECTS.map((s, i) => <TiltCard key={s.name} s={s} index={i} />)}
        </div>
      </div>
    </motion.section>
  );
}

export default SubjectGallery3D;
