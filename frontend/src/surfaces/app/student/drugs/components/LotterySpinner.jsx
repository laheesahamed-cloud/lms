import { useEffect, useRef } from 'react';
import './LotterySpinner.css';

const DUMMY_NAMES = [
  'Amoxicillin','Metformin','Atorvastatin','Lisinopril','Omeprazole',
  'Paracetamol','Ibuprofen','Amlodipine','Metoprolol','Salbutamol',
  'Ciprofloxacin','Diazepam','Warfarin','Furosemide','Prednisolone',
];

export function LotterySpinner({ spinning, finalName, onDone }) {
  const stripRef = useRef(null);
  const rafRef   = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!spinning) return;

    const DURATION = 2500;
    const strip = stripRef.current;
    if (!strip) return;

    const items = [...DUMMY_NAMES, ...DUMMY_NAMES, finalName];
    strip.innerHTML = items
      .map((n) => `<span class="ls-item">${n}</span>`)
      .join('');

    const itemH = 52;
    const totalH = items.length * itemH;
    const targetY = (items.length - 1) * itemH;

    startRef.current = null;

    function ease(t) {
      return t < 1 ? 1 - Math.pow(1 - t, 4) : 1;
    }

    function frame(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const y = ease(progress) * targetY;
      strip.style.transform = `translateY(-${y}px)`;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        strip.style.transform = `translateY(-${targetY}px)`;
        onDone?.();
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [spinning, finalName, onDone]);

  return (
    <div className="ls-root" aria-label="Drug randomizer spinner" aria-live="polite">
      <div className="ls-window">
        <div className="ls-strip" ref={stripRef} />
        <div className="ls-fade ls-fade--top" />
        <div className="ls-fade ls-fade--bottom" />
        <div className="ls-cursor" aria-hidden="true" />
      </div>
    </div>
  );
}
