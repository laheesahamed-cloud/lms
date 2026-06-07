/*
 * SuccessBurst — a small celebratory success mark: animated check draw + a
 * radial confetti pop. framer-motion, reduced-motion aware. No heavy deps.
 * Reusable (checkout success, lesson complete, etc.).
 */
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '../hooks/useCountUp.js';

const COLORS = ['#2563eb', '#7c3aed', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];

export function SuccessBurst({ size = 76, className = '' }) {
  const reduce = prefersReducedMotion();
  return (
    <div className={`relative mx-auto ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {!reduce && Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ x: Math.cos(angle) * size * 0.72, y: Math.sin(angle) * size * 0.72, opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
            transition={{ duration: 0.85, delay: 0.2, ease: 'easeOut' }}
          />
        );
      })}
      <motion.svg
        viewBox="0 0 52 52"
        className="relative h-full w-full drop-shadow-[0_6px_16px_rgba(34,197,94,0.35)]"
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <motion.circle
          cx="26" cy="26" r="24" fill="none" stroke="#22c55e" strokeWidth="3"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.path
          d="M15 27l7.5 7.5L38 18" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.35, ease: 'easeOut' }}
        />
      </motion.svg>
    </div>
  );
}

export default SuccessBurst;
