/*
 * BootLoader — full-screen terminal-style loader, plays once per session.
 * Typewriter sequence → progress bar → vertical wipe reveal. framer-motion.
 * Brand echo = dashboard indigo (not teal). sessionStorage flag: xyndrome_loaded.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Typewriter } from './Typewriter.jsx';

const PROGRESS_MS = 1800;

function hasPlayed() {
  try { return sessionStorage.getItem('xyndrome_loaded') === 'true'; } catch { return false; }
}
function markPlayed() {
  try { sessionStorage.setItem('xyndrome_loaded', 'true'); } catch { /* ignore */ }
}

export function BootLoader({ onFinished }) {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [show, setShow] = useState(() => typeof window !== 'undefined' && !hasPlayed());
  const [progress, setProgress] = useState(0);
  const [line2, setLine2] = useState(false);

  useEffect(() => {
    if (!show) {
      onFinished?.();
      return undefined;
    }

    if (reduced) {
      markPlayed();
      const t = setTimeout(() => { setShow(false); onFinished?.(); }, 500);
      return () => clearTimeout(t);
    }

    let raf = 0;
    const t1 = setTimeout(() => setLine2(true), 900);
    const t2 = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / PROGRESS_MS, 1);
        setProgress(Math.round(p * 100));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 1100);
    const t3 = setTimeout(() => { markPlayed(); setShow(false); onFinished?.(); }, 1100 + PROGRESS_MS + 550);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); cancelAnimationFrame(raf);
    };
  }, [show, reduced, onFinished]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="xyndrome-bootloader"
          className="fixed inset-0 z-[100000] flex flex-col items-center justify-center overflow-hidden bg-[#050a08]"
          initial={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: '-100%', scale: 1.04, filter: 'blur(8px)', opacity: 0.4 }}
          transition={{ duration: reduced ? 0.3 : 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* Scanline / CRT texture */}
          <div
            className="pointer-events-none absolute inset-0 z-[2] opacity-[0.05] mix-blend-screen"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)' }}
            aria-hidden="true"
          />
          {/* Soft indigo glow */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[80px]"
            style={{ background: 'radial-gradient(circle, rgba(82,116,243,0.5), transparent 65%)' }}
            aria-hidden="true"
          />

          <div className="relative z-[3] flex flex-col items-center gap-8 px-6">
            <div className="flex min-h-[3.5rem] flex-col items-center gap-1 text-center">
              <div className="font-mono text-lg font-bold tracking-tight text-[#7aa2ff] sm:text-xl">
                <Typewriter text="xyndrome://" speed={70} loop={false} cursorChar="▌" cursorClassName="ml-0.5 text-[#5274f3]" />
              </div>
              {line2 && (
                <div className="font-mono text-xs text-[#6fae8f] sm:text-sm">
                  <Typewriter text="welcome to xyndrome.lk" speed={32} loop={false} showCursor={false} />
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-[3px] w-[min(280px,70vw)] overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-150 ease-linear"
                style={{ transform: `scaleX(${progress / 100})`, background: 'linear-gradient(90deg, #4aa3f4, #5274f3, #6d35df)' }}
              />
            </div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/30">{progress}%</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BootLoader;
