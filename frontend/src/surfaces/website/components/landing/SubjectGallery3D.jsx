/*
 * SubjectGallery3D — section 6. Plain text subject list.
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const SUBJECTS = ['Medicine', 'Surgery', 'Psychiatry', 'Gynaecology & Obstetrics', 'Paediatrics'];

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
    return () => { onDarkModeChange?.(false); observer.disconnect(); };
  }, [onDarkModeChange]);

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
          All subjects. All exam-ready.
        </motion.h2>
        <ul className="flex flex-wrap justify-center gap-x-10 gap-y-4">
          {SUBJECTS.map((name, i) => (
            <motion.li
              key={name}
              className="text-[clamp(18px,2.4vw,26px)] font-bold"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ color: darkModeActive ? '#f8fafc' : '#111118' }}
            >
              {name}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
