import { useEffect, useMemo, useState } from 'react';
import '../../../../shared/styles/03-components/quiz-loading.css';

/**
 * Quiz loading screen — "question-suction" loader.
 *
 * Sequence: the card deck pops in first (no question marks), then the suction
 * opens — question marks stream in from the top third and get sucked into the
 * deck while the caption types in. Pure CSS animations; particles seeded here.
 */

const MARK_COLORS = ['#2563ff', '#00d26a', '#7c3aed', '#ff5a1f', '#ffb800', '#ff2d78', '#06b6d4'];
const MARK_COUNT = 48;
const SPARK_COUNT = 7;

const rand = (a, b) => a + Math.random() * (b - a);

export default function QuizLoadingOverlay({ label = 'Preparing your quiz…' }) {
  // Seed particles once so they don't reshuffle on every render.
  const marks = useMemo(
    () =>
      Array.from({ length: MARK_COUNT }, () => {
        const color = MARK_COLORS[Math.floor(Math.random() * MARK_COLORS.length)];
        return {
          glyph: Math.random() < 0.22 ? '??' : '?',
          color,
          fontSize: rand(13, 28),
          // Card appears first (~0.95s) before marks begin pulling in.
          animation: `ql-flyPull ${rand(0.8, 1.4).toFixed(2)}s ${(0.95 + rand(0, 1.5)).toFixed(
            2
          )}s cubic-bezier(.45,0,.7,.25) infinite`,
          textShadow: `0 0 14px ${color}66`,
          x: `${rand(-150, 150).toFixed(1)}px`,
          y: `${rand(-205, -105).toFixed(1)}px`,
          r: `${rand(-50, 50).toFixed(1)}deg`,
        };
      }),
    []
  );

  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, () => ({
        left: `${(50 + rand(-30, 30)).toFixed(1)}%`,
        top: `${(42 + rand(-26, 26)).toFixed(1)}%`,
        delay: `${(0.9 + rand(0, 2)).toFixed(2)}s`,
        background: Math.random() < 0.5 ? '#fff' : MARK_COLORS[Math.floor(Math.random() * MARK_COLORS.length)],
      })),
    []
  );

  // Typewriter caption — types in, holds, re-types, in sync with the loop.
  const [typed, setTyped] = useState('');
  useEffect(() => {
    let k = 0;
    let timer;
    const tick = () => {
      setTyped(label.slice(0, k));
      if (k < label.length) {
        k += 1;
        timer = setTimeout(tick, 75);
      } else {
        timer = setTimeout(() => {
          k = 0;
          timer = setTimeout(tick, 140);
        }, 1700);
      }
    };
    timer = setTimeout(tick, 850);
    return () => clearTimeout(timer);
  }, [label]);

  return (
    <main className="ql-screen" role="status" aria-live="polite" aria-label={label}>
      <div className="ql-stage" aria-hidden="true">
        <div className="ql-aura" />
        {sparks.map((s, i) => (
          <span
            key={`spark-${i}`}
            className="ql-spark"
            style={{ left: s.left, top: s.top, animationDelay: s.delay, background: s.background }}
          />
        ))}
        <div className="ql-stack">
          <div className="ql-card ql-card--back ql-card--b2" />
          <div className="ql-card ql-card--back ql-card--b1" />
          <div className="ql-card ql-card--front">
            <div className="ql-head">
              <span className="ql-dot" />
              <div className="ql-line" />
            </div>
            <div className="ql-line ql-line--s" />
            <div className="ql-opts">
              <div className="ql-opt">
                <span className="ql-sq" />
                <span className="ql-bar" />
              </div>
              <div className="ql-opt ql-opt--sel">
                <span className="ql-sq" />
                <span className="ql-bar" />
              </div>
              <div className="ql-opt">
                <span className="ql-sq" />
                <span className="ql-bar" style={{ width: '70%' }} />
              </div>
            </div>
          </div>
        </div>
        {marks.map((m, i) => (
          <span
            key={`mark-${i}`}
            className="ql-mark"
            style={{
              color: m.color,
              fontSize: `${m.fontSize}px`,
              textShadow: m.textShadow,
              animation: m.animation,
              '--x': m.x,
              '--y': m.y,
              '--r': m.r,
            }}
          >
            {m.glyph}
          </span>
        ))}
      </div>
      <p className="ql-cap">
        <span className="ql-typed">{typed}</span>
      </p>
    </main>
  );
}
