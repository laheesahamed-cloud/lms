/*
 * ScrollRevealText — words light up one by one, tied to scroll position, as the
 * line rises up through the viewport (the "scroll reveal" beat). Driven by a
 * plain rAF + getBoundingClientRect: framer's useScroll freezes on this landing
 * because of the overflow:clip + route-reveal ancestors, and a sticky/pin scrub
 * was removed earlier because it trapped the page — so this reveals on scroll
 * WITHOUT ever pinning or locking the page. Optionally underlines a trailing
 * phrase that draws in as that phrase reveals.
 */
import { useEffect, useRef } from 'react';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function ScrollRevealText({ text, highlight, className, dim = 0.14, underlineColor = '#2563eb' }) {
  const ref = useRef(null);
  const slotRefs = useRef([]);
  const underlineRef = useRef(null);

  // Split into leading words + an optional nowrap, underlined highlight group
  // (kept on one line so the underline stays continuous).
  const hasHl = Boolean(highlight) && text.endsWith(highlight);
  const lead = (hasHl ? text.slice(0, text.length - highlight.length) : text).trim();
  const leadWords = lead ? lead.split(/\s+/) : [];
  const hlText = hasHl ? highlight.trim() : '';
  const slotCount = leadWords.length + (hasHl ? 1 : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const T = slotCount || 1;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) {
      slotRefs.current.forEach((s) => { if (s) s.style.opacity = '1'; });
      if (underlineRef.current) underlineRef.current.style.transform = 'scaleX(1)';
      return undefined;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = el.getBoundingClientRect();
      // 0 as the line enters from the bottom, 1 once it has risen ~half a
      // viewport up — so the words finish lighting up on the way past.
      const progress = clamp01((vh * 0.85 - rect.top) / (vh * 0.55));
      for (let i = 0; i < slotCount; i++) {
        const span = slotRefs.current[i];
        if (!span) continue;
        const start = (i / T) * 0.74;
        const end = start + 0.26;
        const o = dim + (1 - dim) * clamp01((progress - start) / (end - start));
        span.style.opacity = o.toFixed(3);
      }
      if (underlineRef.current) {
        const hlStart = ((slotCount - 1) / T) * 0.74;
        underlineRef.current.style.transform = `scaleX(${clamp01((progress - hlStart) / (1 - hlStart)).toFixed(3)})`;
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [text, highlight, dim, slotCount]);

  return (
    <p ref={ref} className={className}>
      {leadWords.map((w, i) => (
        <span
          key={`l-${w}-${i}`}
          ref={(node) => { slotRefs.current[i] = node; }}
          className="mx-1.5 inline-block lg:mx-2"
          style={{ opacity: dim }}
        >
          {w}
        </span>
      ))}
      {hasHl && (
        <span
          ref={(node) => { slotRefs.current[leadWords.length] = node; }}
          className="relative mx-1.5 inline-block whitespace-nowrap lg:mx-2"
          style={{ opacity: dim }}
        >
          {hlText}
          <span
            ref={underlineRef}
            className="absolute -bottom-1 left-0 h-[2px] w-full origin-left"
            style={{ background: underlineColor, transform: 'scaleX(0)' }}
            aria-hidden="true"
          />
        </span>
      )}
    </p>
  );
}
