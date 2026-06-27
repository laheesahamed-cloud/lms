/*
 * SubjectGallery3D — section 6. Fetches real topics+question counts from
 * /api/courses/landing-summary (public, no auth). Falls back to empty grid.
 * 3D tilt cards, indigo question counts, gradient bar scaled to question count.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const med = (name) => `${ASSET}medical/${name}.svg`;

const PASTEL_BG = ['#ffd6d6', '#d6f0ff', '#e8d6ff', '#d6ffe8', '#fff3d6', '#ffd6f0', '#e8f5e9', '#ffe8d6'];

const ICON_MAP = {
  cardio: 'heart', heart: 'heart',
  pharmac: 'pills', drug: 'pills',
  pathol: 'microscope', histol: 'microscope',
  microb: 'blood', bacterio: 'blood',
  biochem: 'dna', molecular: 'dna',
  surg: 'tooth', operat: 'tooth',
  anatom: 'syringe', dissect: 'syringe',
  physiol: 'lungs', respirat: 'lungs',
  oncol: 'microscope', cancer: 'microscope',
  neuro: 'lungs', psych: 'lungs',
  paediat: 'heart', pediatr: 'heart',
  obstet: 'heart', gynaec: 'heart',
  ortho: 'syringe', bone: 'syringe',
  ophthal: 'syringe', eye: 'syringe',
  ent: 'syringe', ear: 'syringe',
  derm: 'microscope', skin: 'microscope',
  radio: 'microscope', imaging: 'microscope',
  anaesth: 'syringe', anaesth: 'syringe',
  communit: 'blood', public: 'blood',
  forensic: 'microscope',
};

function iconFor(name) {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return 'microscope';
}

function TiltCard({ s, index, maxQ }) {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${-py * 8}deg) rotateY(${px * 10}deg) translateY(-4px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ''; };

  const bg = PASTEL_BG[index % PASTEL_BG.length];
  const icon = iconFor(s.name);
  const barScale = maxQ > 0 ? s.questionCount / maxQ : 0;

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
          <span
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_28px_-22px_rgba(17,17,24,0.45)]"
            style={{ background: `linear-gradient(135deg, ${bg}, rgba(255,255,255,0.72))` }}
            aria-hidden="true"
          >
            <img src={med(icon)} alt="" className="size-5" loading="lazy" />
          </span>
          <div>
            <h3 className="lpv2-subject-card-title text-[15px] font-extrabold text-[#111118]">{s.name}</h3>
            {s.questionCount > 0 && (
              <p className="lpv2-subject-card-meta text-[12px] text-[#6b7280]">
                <span className="lpv2-subject-card-count font-bold text-[#2563eb]">{s.questionCount.toLocaleString()}</span> questions
              </p>
            )}
          </div>
        </div>
        <div className="lpv2-subject-card-track relative z-[1] h-2 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(17,17,24,0.08)]">
          <motion.span
            className="block h-full w-full origin-left rounded-full shadow-[0_0_18px_rgba(82,116,243,0.4)]"
            style={{ background: 'linear-gradient(90deg, #22D3EE 0%, #5274F3 48%, #6D35DF 100%)' }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: barScale }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';

export function SubjectGallery3D({ darkModeActive = false, onDarkModeChange }) {
  const sectionRef = useRef(null);
  const [subjects, setSubjects] = useState([]);
  const [totalTopics, setTotalTopics] = useState(null);

  useEffect(() => {
    fetch(`${API}/courses/landing-summary`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.topics?.length) return;
        setTotalTopics(data.topics.length);
        setSubjects(data.topics.slice(0, 8));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => onDarkModeChange?.(entry.isIntersecting),
      { rootMargin: '-38% 0px -38% 0px', threshold: 0 }
    );
    observer.observe(node);
    return () => { onDarkModeChange?.(false); observer.disconnect(); };
  }, [onDarkModeChange]);

  const maxQ = subjects.reduce((m, s) => Math.max(m, s.questionCount), 0);
  const heading = totalTopics != null
    ? `${totalTopics}+ subjects. All exam-ready.`
    : 'All subjects. All exam-ready.';

  return (
    <motion.section
      id="subjects"
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
          {heading}
        </motion.h2>
        {subjects.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {subjects.map((s, i) => <TiltCard key={s.id} s={s} index={i} maxQ={maxQ} />)}
          </div>
        )}
      </div>
    </motion.section>
  );
}
