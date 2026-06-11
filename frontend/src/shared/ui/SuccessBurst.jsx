/*
 * SuccessBurst — a small celebratory success mark: animated check draw + a
 * radial confetti pop. Pure CSS animations, reduced-motion aware. No deps.
 * Reusable (checkout success, lesson complete, etc.).
 */
import './SuccessBurst.css';
import { prefersReducedMotion } from '../hooks/useCountUp.js';

const COLORS = ['#2563eb', '#7c3aed', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];

export function SuccessBurst({ size = 76, className = '' }) {
  const reduce = prefersReducedMotion();
  return (
    <div className={`relative mx-auto ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {!reduce && Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <span
            key={i}
            className="lms-success-burst__confetti absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{
              background: COLORS[i % COLORS.length],
              '--burst-x': `${Math.cos(angle) * size * 0.72}px`,
              '--burst-y': `${Math.sin(angle) * size * 0.72}px`,
            }}
          />
        );
      })}
      <svg
        viewBox="0 0 52 52"
        className="lms-success-burst__svg relative h-full w-full drop-shadow-[0_6px_16px_rgba(34,197,94,0.35)]"
      >
        <circle
          className="lms-success-burst__circle"
          cx="26" cy="26" r="24" fill="none" stroke="#22c55e" strokeWidth="3"
          pathLength="1"
        />
        <path
          className="lms-success-burst__check"
          d="M15 27l7.5 7.5L38 18" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          pathLength="1"
        />
      </svg>
    </div>
  );
}

export default SuccessBurst;
