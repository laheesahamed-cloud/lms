import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../../shared/config/appLinks.js';
import { TRY_CONTENT as C } from './tryContent.js';
import { appleSignInConfigured, startAppleRedirect } from '../../../shared/auth/appleAuth.js';
import './try-page.css';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

/**
 * The public demo page (OPTIMIZE 10.52, mockup A "one at a time"): one part
 * per screen, sized to fit without scrolling — lesson (the pen marks draw
 * themselves), one fully taught question, a timed mini exam + review,
 * flashcards with spaced-repetition ratings, progress & analysis, planner,
 * coming-soon tools; progress bar and Back · 1 / 7 · Next. Everything is
 * in the page (tryContent.js): no requests, no database, no animation library.
 */
const STEPS = [
  { key: 'lesson', tone: 'lilac', kind: 'Lessons', title: 'Lessons you can write on', lead: 'Highlight and scribble on every lesson, like paper.', Body: Lesson },
  { key: 'qbank', tone: 'sky', kind: 'Q-Bank', title: 'Questions that teach', lead: 'Every option explained, not just the answer.', Body: Practice },
  { key: 'exam', tone: 'peach', kind: 'Exams', title: 'A 2-minute mock exam', lead: 'Timed, then marked and reviewed.', Body: Exam },
  { key: 'flashcards', tone: 'mint', kind: 'Flashcards', title: 'Flashcards', lead: 'Cards come back just before you forget.', Body: Flashcard, bare: true },
  { key: 'progress', tone: 'rose', kind: 'Progress', title: 'Your progress', lead: 'Readiness and weak topics, worked out for you.', Body: Progress },
  { key: 'planner', tone: 'lemon', kind: 'Planner', title: 'Planner', lead: 'Your day in one list. Tap to tick.', Body: Planner },
  { key: 'soon', tone: 'lilac', kind: 'Coming soon', title: 'More on the way', lead: 'Tools for the clinical years.', Body: ComingSoon, bare: true },
];

export function TryPage() {
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState('next'); // which way the step slides in
  const [locked, setLocked] = useState(false); // a step can hold Next until it has finished teaching
  const [joinOpen, setJoinOpen] = useState(false);
  const last = STEPS.length; // the closing screen
  const step = STEPS[at];
  const go = (n) => {
    setDir(n < at ? 'back' : 'next');
    setLocked(false);
    setAt(Math.max(0, Math.min(last, n)));
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="try-page">
      <div className="try-wrap">
        <header className="try-top">
          <Link to="/" className="try-brand" aria-label="xyndrome home">
            <img className="try-logo try-logo-light" src={`${ASSET}brand/xyndrome-logo-mark-light.webp`} alt="" width="30" height="27" />
            <img className="try-logo try-logo-dark" src={`${ASSET}brand/xyndrome-logo-mark-dark.webp`} alt="" width="30" height="27" />
            <span>xyndrome</span>
          </Link>
          <div className="try-top-links">
            <button type="button" className="try-cta" onClick={() => setJoinOpen(true)}>
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </header>

        {step ? (
          <section key={step.key} className={`try-screen try-slide from-${dir}`}>
            <div className="try-screen-head">
              <h1 className="try-h">{step.title}</h1>
              <p className="try-lead">{step.lead}</p>
            </div>
            <div className={`try-panel try-panel-in tone-${step.tone} ${step.bare ? 'is-bare' : ''}`}>
              <step.Body setLocked={setLocked} />
            </div>
          </section>
        ) : (
          <section key="end" className="try-screen try-end try-fade">
            <h1 className="try-h">Everything you need, in <span className="try-swap"><span className="try-swap-a">one app</span><span className="try-swap-b">xyndrome</span></span>.</h1>
            <p className="try-lead">Every lesson, thousands of explained questions, full mock exams, flashcards, progress and a planner.</p>
            <div className="try-end-links">
              {APP_STORE_URL ? <a className="try-btn" href={APP_STORE_URL} target="_blank" rel="noreferrer">App Store</a> : null}
              {PLAY_STORE_URL ? <a className="try-btn" href={PLAY_STORE_URL} target="_blank" rel="noreferrer">Google Play</a> : null}
              <button type="button" className="try-cta-text" onClick={() => setJoinOpen(true)}>
                Get Started
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </section>
        )}
      </div>

      {joinOpen ? createPortal(<div className="try-page try-layer"><GetStarted onClose={() => setJoinOpen(false)} /></div>, document.body) : null}

      {/* Portalled to <body>: the site's route wrapper keeps a transform, which would make position: fixed scroll with the page. */}
      {createPortal(
        <div className="try-page try-layer">
          <nav className="try-nav" aria-label="Demo steps">
            <div className="try-nav-in">
              <button type="button" className="try-arrow try-arrow-ghost" onClick={() => go(at - 1)} style={{ visibility: at ? 'visible' : 'hidden' }} aria-label="Back">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <span className="try-dots" role="img" aria-label={`Step ${Math.min(at + 1, STEPS.length)} of ${STEPS.length}`}>
                {STEPS.map((st, i) => <i key={st.key} className={i === at ? 'is-on' : i < at ? 'is-done' : ''} />)}
              </span>
              <button type="button" className="try-arrow" disabled={locked} aria-disabled={locked} onClick={() => go(at === last ? 0 : at + 1)}
                aria-label={at === last ? 'Start over' : at === last - 1 ? 'Finish' : 'Next'}>
                {at === last
                  ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></svg>
                  : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>}
              </button>
            </div>
          </nav>
        </div>,
        document.body,
      )}
    </main>
  );
}

/* ── Get started: the site's own sign-up (email page, Google, Apple) ─────── */

function GetStarted({ onClose }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const apple = appleSignInConfigured();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function withApple() {
    setBusy('apple'); setError('');
    try {
      await startAppleRedirect(); // leaves the page; Apple returns to the login page
    } catch (err) {
      setBusy('');
      setError(err?.message || 'Apple sign-in could not open.');
    }
  }

  return (
    <div className="try-sheet-back" onClick={onClose}>
      <div className="try-sheet" role="dialog" aria-modal="true" aria-labelledby="try-sheet-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="try-sheet-title">Create your free account</h2>
        <button type="button" className="try-auth" onClick={() => navigate('/register')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          Continue with email
        </button>
        <button type="button" className="try-auth" disabled={Boolean(busy)} onClick={() => navigate('/login?start=google')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
          Continue with Google
        </button>
        {apple ? (
          <button type="button" className="try-auth" disabled={Boolean(busy)} onClick={withApple}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.2-1.2 3.1-2.5a10 10 0 0 0 1.4-2.9 4.4 4.4 0 0 1-3-4zM14 5.1a4.4 4.4 0 0 0 1-3.2 4.5 4.5 0 0 0-2.9 1.5 4.2 4.2 0 0 0-1.1 3.1c1.1.1 2.2-.5 3-1.4z" /></svg>
            {busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
          </button>
        ) : null}
        {error ? <p className="try-sheet-error">{error}</p> : null}
        <p className="try-sheet-foot">Already have an account? <Link to="/login">Sign in</Link></p>
        <button type="button" className="try-sheet-x" onClick={onClose} aria-label="Close">×</button>
      </div>
    </div>
  );
}

/* ── Lesson: the pen marks draw themselves ─────────────────────────────── */

/** A lesson line with its pen marks; `order` gives each mark its play delay. */
function Inked({ text, order }) {
  const parts = [];
  let rest = text;
  while (rest) {
    let hit = null;
    for (const m of C.lesson.marks) {
      const i = rest.indexOf(m.text);
      if (i >= 0 && (!hit || i < hit.i)) hit = { i, m };
    }
    if (!hit) { parts.push(rest); break; }
    parts.push(rest.slice(0, hit.i));
    const delay = `${700 + order.get(hit.m) * 650}ms`;
    parts.push(
      <span key={parts.length} className={`ink ink-${hit.m.kind} ${hit.m.tone ? `ink-${hit.m.tone}` : ''} ${hit.m.tool ? `ink-${hit.m.tool}` : ''}`} style={{ '--ink-d': delay }}>
        {hit.m.text}
        {hit.m.kind === 'underline' ? (
          <svg className="ink-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" filter={hit.m.tool === 'pencil' ? 'url(#try-pencil)' : undefined} d="M1 6 C 12 2, 22 9, 34 5 S 58 2, 70 6 S 90 8, 99 4" /></svg>
        ) : null}
      </span>,
    );
    rest = rest.slice(hit.i + hit.m.text.length);
  }
  return parts;
}

/* Hand-drawn doodles: a pen (random colour) and a grey pencil. */
const PEN_COLOURS = ['#e8727a', '#6f8cf0', '#4fae84', '#b07ae6', '#f08c4b'];
const DOODLES = {
  tick: 'M3 13 L 9 19 L 21 5',
  star: 'M12 2 L 14.6 9 L 22 9.2 L 16 13.8 L 18.2 21 L 12 16.8 L 5.8 21 L 8 13.8 L 2 9.2 L 9.4 9 Z',
  squiggle: 'M2 8 C 10 2, 16 14, 24 8 S 38 2, 46 8 S 60 14, 68 8 S 82 2, 90 8',
  wave: 'M2 6 C 6 2, 10 10, 14 6 S 22 2, 26 6 S 34 10, 38 6',
  heart: 'M12 21 C 4 14, 1 9, 4 5 C 7 2, 11 4, 12 7 C 13 4, 17 2, 20 5 C 23 9, 20 14, 12 21',
  arrow: 'M2 17 C 14 3, 30 3, 44 12 M44 12 L 35 13 M44 12 L 40 4',
  spiral: 'M24 12 C 24 8, 18 8, 18 12 C 18 17, 27 17, 28 12 C 29 5, 15 4, 14 12 C 13 20, 32 21, 33 12 C 34 3, 10 1, 9 12',
  loops: 'M2 14 C 8 2, 14 2, 12 12 C 10 20, 20 18, 22 8 C 24 2, 30 4, 28 12 C 26 20, 36 18, 38 8 C 40 2, 46 6, 44 14',
  box: 'M3 5 C 30 1, 70 3, 97 4 C 99 30, 98 70, 96 95 C 60 98, 30 97, 4 96 C 2 70, 1 35, 6 2',
};
// Big margin scribbles: sized so they never cross the words.
const BIG = { arrow: { w: 46, h: 22, view: '0 0 46 20' }, spiral: { w: 40, h: 24, view: '0 0 42 24' }, loops: { w: 48, h: 22, view: '0 0 48 22' } };
const SECTION_TONES = ['pink', 'sky', 'mint'];
function Doodle({ shape, tool, colour, rot = 0, delay, className = '', w = 22, h = 22, view = '0 0 24 24', stretch = false }) {
  return (
    <svg className={`doodle doodle-${tool} ${className}`} width={w} height={h} viewBox={view} preserveAspectRatio={stretch ? 'none' : undefined} style={{ '--ink-d': delay, transform: `rotate(${rot}deg)`, color: colour }} aria-hidden="true">
      <path pathLength="1" filter={tool === 'pencil' ? 'url(#try-pencil)' : undefined} d={DOODLES[shape]} />
    </svg>
  );
}

/** A handwritten hint with a drawn arrow ("tap here"), gone once the student does it. */
const HINT_ARROWS = {
  left: { d: 'M30 8 C 20 2, 10 4, 3 9 M3 9 L 10 12 M3 9 L 8 2', w: 30, h: 15, view: '0 0 32 16' },
  right: { d: 'M2 8 C 12 2, 22 4, 29 9 M29 9 L 22 12 M29 9 L 24 2', w: 30, h: 15, view: '0 0 32 16' },
  up: { d: 'M8 30 C 2 20, 4 10, 9 3 M9 3 L 12 10 M9 3 L 3 8', w: 15, h: 28, view: '0 0 16 32' },
  down: { d: 'M8 2 C 2 12, 4 22, 9 29 M9 29 L 12 22 M9 29 L 3 24', w: 15, h: 28, view: '0 0 16 32' },
};
function Hint({ text, arrow = 'left', after = false, delay = '700ms', className = '' }) {
  const a = HINT_ARROWS[arrow];
  const svg = <svg width={a.w} height={a.h} viewBox={a.view} aria-hidden="true"><path pathLength="1" d={a.d} /></svg>;
  return (
    <span className={`try-hint hint-${arrow} ${className}`} style={{ '--ink-d': delay }} aria-hidden="true">
      {after ? null : svg}<span>{text}</span>{after ? svg : null}
    </span>
  );
}

/** Lets the student draw on the lesson with a finger or the mouse; each stroke takes the next pen colour. */
function DrawLayer({ onFirst, onEnough }) {
  const [strokes, setStrokes] = useState([]);
  const box = useRef(null);
  const drawing = useRef(false);
  const at = (e) => { const r = box.current.getBoundingClientRect(); return `${Math.round(e.clientX - r.left)},${Math.round(e.clientY - r.top)}`; };
  const down = (e) => {
    drawing.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); onFirst?.();
    setStrokes((xs) => [...xs, { c: PEN_COLOURS[xs.length % PEN_COLOURS.length], pts: [at(e)] }]);
  };
  const move = (e) => { if (drawing.current) setStrokes((xs) => { const last = xs[xs.length - 1]; return [...xs.slice(0, -1), { ...last, pts: [...last.pts, at(e)] }]; }); };
  const up = () => { drawing.current = false; };
  // "Some scribble" = about 20 points drawn in all (a tap or a dot is not enough).
  const total = strokes.reduce((n, st) => n + st.pts.length, 0);
  useEffect(() => { if (total >= 20) onEnough?.(); }, [total, onEnough]);
  return (
    <>
      <svg ref={box} className="tl-draw" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Draw on the lesson">
        {strokes.map((st, i) => <polyline key={i} points={st.pts.join(' ')} style={{ stroke: st.c }} />)}
      </svg>
    </>
  );
}

function Lesson({ setLocked }) {
  const L = C.lesson;
  const order = useMemo(() => new Map(L.marks.map((m, i) => [m, i])), [L.marks]);
  const noteDelay = `${700 + L.marks.length * 650}ms`;
  // A fresh, slightly different scribble every time: colours, tilt and timing.
  const art = useMemo(() => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const rnd = (min, max) => Math.round(min + Math.random() * (max - min));
    return {
      sections: L.sections.map((_, i) => ({ colour: pick(PEN_COLOURS), rot: rnd(-12, 10), delay: `${1100 + i * 520 + rnd(0, 240)}ms`, shape: i === 1 ? 'wave' : 'tick' })),
      big: [...Object.keys(BIG)].sort(() => Math.random() - 0.5).map((shape, i) => ({
        shape, colour: pick(PEN_COLOURS), tool: Math.random() < 0.5 ? 'pen' : 'pencil', rot: rnd(-10, 10), delay: `${1500 + i * 800 + rnd(0, 300)}ms`,
      })),
      heart: { colour: pick(PEN_COLOURS), rot: rnd(-18, 14) },
      box: { colour: pick(PEN_COLOURS), tool: Math.random() < 0.5 ? 'pen' : 'pencil' },
      star: { colour: pick(PEN_COLOURS), rot: rnd(-20, 20) },
    };
  }, [L.sections]);
  const [drew, setDrew] = useState(false);
  // Next waits until the student has scribbled something.
  useEffect(() => { setLocked?.(true); }, [setLocked]);
  const unlock = useCallback(() => setLocked?.(false), [setLocked]);
  return (
    <div className="tl">
      <DrawLayer onFirst={() => setDrew(true)} onEnough={unlock} />
      {drew ? null : (
        <span className="tl-guide" style={{ '--ink-d': '1600ms' }} aria-hidden="true">
          <svg viewBox="0 0 120 30" className="tl-guide-ghost"><path d="M4 22 C 18 4, 26 4, 30 16 S 44 28, 52 14 S 66 2, 74 16 S 92 28, 116 8" /></svg>
          <span className="tl-guide-pen">✎</span>
          <b>write here!</b>
        </span>
      )}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="try-pencil"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" /></filter>
      </svg>
      <h2 className="tl-title">
        {L.title}
        <Doodle shape="heart" tool="pen" colour={art.heart.colour} rot={art.heart.rot} delay="300ms" className="tl-heart" w={34} h={34} />
        <Doodle shape="squiggle" tool="pencil" colour="#8b8f97" delay="500ms" className="tl-title-line" w={150} h={12} view="0 0 92 14" />
      </h2>
      {L.sections.map((s, i) => (
        <div key={s.heading} className="tl-sec try-fade" style={{ '--d': `${80 + i * 60}ms` }}>
          <h3>
            <span className={`tl-chip tone-${SECTION_TONES[i % SECTION_TONES.length]}`}>{s.heading}</span>
            <Doodle shape={art.sections[i].shape} tool="pen" colour={art.sections[i].colour} rot={art.sections[i].rot} delay={art.sections[i].delay}
              {...(art.sections[i].shape === 'wave' ? { w: 40, h: 12, view: '0 0 40 12' } : { w: 16, h: 16 })} />
            {art.big[i] ? (
              <Doodle shape={art.big[i].shape} tool={art.big[i].tool} colour={art.big[i].colour} rot={art.big[i].rot} delay={art.big[i].delay}
                className="tl-big" {...BIG[art.big[i].shape]} />
            ) : null}
          </h3>
          <ul>{s.points.map((p) => <li key={p}><Inked text={p} order={order} /></li>)}</ul>
        </div>
      ))}
      <div className="tl-key try-fade" style={{ '--d': '440ms' }}>
        <Doodle shape="box" tool={art.box.tool} colour={art.box.colour} delay={`${700 + L.marks.length * 650 + 500}ms`} className="tl-key-box" w={100} h={100} view="0 0 100 100" stretch />
        <b>Key point <Doodle shape="star" tool="pen" colour={art.star.colour} rot={art.star.rot} delay={noteDelay} w={15} h={15} /></b>{L.keyPoint}
        <span className="ink-note" style={{ '--ink-d': noteDelay }} aria-hidden="true">
          <svg viewBox="0 0 60 30"><path pathLength="1" d="M58 4 C 40 2, 20 8, 8 24 M8 24 L 18 22 M8 24 L 9 14" /></svg>
          {L.note}
        </span>
      </div>
    </div>
  );
}

/* ── Q-Bank: one question, taught in full ──────────────────────────────── */

/** The stem with the clue phrases marked (shown after answering). */
function Stem({ text, marks }) {
  if (!marks?.length) return text;
  const parts = [];
  let rest = text;
  while (rest) {
    let hit = null;
    for (const m of marks) {
      const i = rest.indexOf(m);
      if (i >= 0 && (!hit || i < hit.i)) hit = { i, m };
    }
    if (!hit) { parts.push(rest); break; }
    parts.push(rest.slice(0, hit.i), <mark key={parts.length}>{hit.m}</mark>);
    rest = rest.slice(hit.i + hit.m.length);
  }
  return parts;
}

const TEACH_TABS = ['Why not', 'Explanation', 'Approach', 'Key points', 'Recap'];
// Only the first 2 tabs play by themselves; after Explanation, Next unlocks and the rest are a tap away.
const TAB_MS = { 'Why not': 1800, Explanation: 2200 };
const AUTO_TABS = Object.keys(TAB_MS);

function Practice({ setLocked }) {
  const q = C.question;
  const [picked, setPicked] = useState(null);
  const [tab, setTab] = useState('Why not');
  const tabsRef = useRef(null);
  // Next stays locked until the student has been walked through every tab.
  useEffect(() => { setLocked?.(true); }, [setLocked]);
  useEffect(() => {
    if (!picked) return undefined;
    tabsRef.current?.querySelector('.is-on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if (!TAB_MS[tab]) { setLocked?.(false); return undefined; }
    const k = AUTO_TABS.indexOf(tab);
    const id = setTimeout(() => (k < AUTO_TABS.length - 1 ? setTab(AUTO_TABS[k + 1]) : setLocked?.(false)), TAB_MS[tab]);
    return () => clearTimeout(id);
  }, [picked, tab, setLocked]);
  const [stemOpen, setStemOpen] = useState(false); // after answering the stem shows 2 lines; tap for all
  const right = q.options.find((o) => o.correct);
  return (
    <div className="tq tq-single">
      <p className={`tq-stem ${picked && !stemOpen ? 'is-clamped' : ''}`} onClick={() => setStemOpen((o) => !o)}><Stem text={q.stem} marks={picked ? q.highlights : null} /></p>
      <div className="tq-opts">
        {picked ? null : <Hint text="tap one" arrow="left" delay="600ms" className="hint-opts" />}
        {q.options.filter((o) => !picked || o.correct || o === picked).map((o) => {
          const cls = picked ? (o.correct ? 'is-right' : 'is-wrong') : '';
          return (
            <button key={o.label} type="button" className={`tq-opt ${cls}`} disabled={Boolean(picked)} onClick={() => setPicked(o)}>
              <span className="tq-l">{o.label}</span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {!picked ? (
        <button type="button" className="try-btn try-btn-ghost try-reveal" onClick={() => setPicked(right)}>Show answer</button>
      ) : (
        <div className="tq-teach try-fade">
          <p className={`tq-verdict ${picked.correct ? 'is-ok' : 'is-no'}`}>
            {picked.correct ? `Correct — ${right.text}.` : `The answer is ${right.label}: ${right.text}.`}
          </p>
          <div className="tq-tabs" role="tablist" ref={tabsRef}>
            {TEACH_TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''}
                style={tab === t && TAB_MS[t] ? { '--ms': `${TAB_MS[t]}ms` } : undefined} onClick={() => setTab(t)}>
                {t}{tab === t && TAB_MS[t] ? <i key={t} className="tq-tabtime" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <div key={tab} className="tq-tabbody try-fade">
            {tab === 'Why not' ? (
              <ul className="tq-whylist">{q.options.filter((o) => !o.correct).map((o) => <li key={o.label}><b>{o.label}</b> {o.why}</li>)}</ul>
            ) : null}
            {tab === 'Explanation' ? <p>{q.explanation}</p> : null}
            {tab === 'Approach' ? <ol className="tq-approach">{q.approach.map((x) => <li key={x.clue}><mark>{x.clue}</mark> {x.text}</li>)}</ol> : null}
            {tab === 'Key points' ? <ul>{q.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul> : null}
            {tab === 'Recap' ? (
              <div className="tq-recap">
                <b>{q.recap.concept}</b>
                {q.recap.sections.map((r) => <p key={r.heading}><strong>{r.heading}:</strong> {r.points.join('; ')}.</p>)}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Exam ──────────────────────────────────────────────────────────────── */

/** An exam question: the pick is marked while running, answers shown at review. */
function ExamQuestion({ q, index, picked, onPick, revealed, dir }) {
  const right = q.options.find((o) => o.correct);
  return (
    <div className={`tq tq-in from-${dir}`}>
      <p className={`tq-stem ${revealed ? 'is-clamped is-3' : ''}`}><span>Q{index + 1}</span> {q.stem}</p>
      <div className="tq-opts">
        {q.options.filter((o) => !revealed || o.correct || o === picked).map((o) => {
          const cls = revealed ? (o.correct ? 'is-right' : 'is-wrong') : (o === picked ? 'is-picked' : '');
          return (
            <button key={o.label} type="button" className={`tq-opt ${cls}`} disabled={revealed} onClick={() => onPick(o)}>
              <span className="tq-l">{o.label}</span>
              <span>{o.text}</span>
              {revealed && !o.correct && o === picked && o.why ? <small className="tq-why"><b>Why not:</b> {o.why}</small> : null}
            </button>
          );
        })}
      </div>
      {revealed ? <p className="tq-exp try-fade"><b>Why {right.label}:</b> {q.explanation}</p> : null}
    </div>
  );
}

function Exam({ setLocked }) {
  const E = C.exam;
  const [state, setState] = useState('ready'); // ready | running | marks | review
  // Next waits for one tap on play.
  useEffect(() => { setLocked?.(state === 'ready'); }, [state, setLocked]);
  const [left, setLeft] = useState(E.minutes * 60);
  const [picked, setPicked] = useState({});
  const [qi, setQi] = useState(0);
  const [qDir, setQDir] = useState('next');
  const moveQ = (n) => { setQDir(n < qi ? 'back' : 'next'); setQi(n); };
  const timer = useRef(null);

  useEffect(() => {
    if (state !== 'running') return undefined;
    timer.current = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer.current);
  }, [state]);
  useEffect(() => { if (state === 'running' && left <= 0) setState('marks'); }, [left, state]);

  const right = useMemo(() => E.questions.filter((q, i) => picked[i]?.correct).length, [picked, E.questions]);
  const secs = Math.max(0, left);
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const lastQ = qi === E.questions.length - 1;

  if (state === 'marks') {
    const n = E.questions.length;
    const pct = Math.round((right / n) * 100);
    const wrong = E.questions.filter((q, i) => picked[i] && !picked[i].correct).length;
    const skipped = n - right - wrong;
    const used = E.minutes * 60 - secs;
    const verdict = pct >= 80 ? 'Excellent work' : pct >= 60 ? 'Good work' : pct > 0 ? 'Keep going' : 'Time to review';
    const review = (i) => { setQDir('next'); setQi(i); setState('review'); };
    return (
      <div className="te-marks try-fade">
        <div className="te-score" role="img" aria-label={`Score ${pct}%`}>
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9155" className="te-score-bg" />
            <circle cx="18" cy="18" r="15.9155" className="te-score-fg" style={{ '--p': pct }} />
          </svg>
          <b>{pct}%</b>
        </div>
        <h3>{verdict}</h3>
        <p>{right} of {n} correct · {Math.floor(used / 60)}:{String(used % 60).padStart(2, '0')} used</p>
        <div className="te-tally">
          <span className="is-ok"><b>{right}</b>Correct</span>
          <span className="is-no"><b>{wrong}</b>Wrong</span>
          <span className="is-skip"><b>{skipped}</b>Skipped</span>
        </div>
        <div className="te-dots" aria-label="Tap a question to review it">
          {E.questions.map((q, i) => (
            <button key={q.stem} type="button" onClick={() => review(i)}
              className={picked[i] ? (picked[i].correct ? 'is-ok' : 'is-no') : 'is-skip'}
              aria-label={`Question ${i + 1}: ${picked[i] ? (picked[i].correct ? 'correct' : 'wrong') : 'skipped'}`}>{i + 1}</button>
          ))}
        </div>
        <button type="button" className="try-btn te-review" onClick={() => review(0)}>Review answers</button>
      </div>
    );
  }

  if (state === 'ready') {
    return (
      <div className="te-ready">
        <span><b>Mini exam</b><small>{E.questions.length} question{E.questions.length === 1 ? '' : 's'} · {time}</small></span>
        <Hint text="tap to start" arrow="right" after delay="500ms" className="hint-play" />
        <button type="button" className="te-play" onClick={() => setState('running')} aria-label="Start the exam">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
        </button>
      </div>
    );
  }

  const review = state === 'review';
  return (
    <div className="te-run">
      <div className="te-bar">
        <span>{review ? 'Review' : 'Question'} {qi + 1} of {E.questions.length}</span>
        {review ? <b>{picked[qi]?.correct ? '✓' : '✗'}</b> : <b className="te-time">{time}</b>}
      </div>
      <ExamQuestion key={`${state}-${qi}`} dir={qDir} q={E.questions[qi]} index={qi} picked={picked[qi]} revealed={review}
        onPick={(o) => setPicked((p) => ({ ...p, [qi]: o }))} />
      <div className="te-nav">
        {qi > 0 ? <button type="button" className="try-btn try-btn-ghost" onClick={() => moveQ(qi - 1)}>Previous</button> : <span />}
        {review
          ? (!lastQ ? <button type="button" className="try-btn try-btn-ghost" onClick={() => moveQ(qi + 1)}>Next</button> : <span />)
          : (lastQ
            ? <button type="button" className="try-btn te-next" onClick={() => setState('marks')}>Submit</button>
            : <button type="button" className="try-btn te-next" onClick={() => moveQ(qi + 1)}>Next</button>)}
      </div>
    </div>
  );
}

/* ── Flashcards ────────────────────────────────────────────────────────── */

function Flashcard() {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(null);
  return (
    <div className="tf-wrap">
      <button type="button" className={`tf ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-label="Flip the flashcard">
        <span className="tf-in">
          <span className="tf-face tf-front"><small>Question · tap to flip</small>{C.flashcard.front}</span>
          <span className="tf-face tf-back"><small>Answer</small>{C.flashcard.back}</span>
        </span>
      </button>
      {flipped ? null : <Hint text="tap to flip" arrow="up" delay="600ms" className="hint-card" />}
      {flipped ? (
        <div className="tf-rate try-fade">
          <p>How well did you know it?</p>
          <div className="tf-rate-row">
            {C.ratings.map((r) => (
              <button key={r.label} type="button" className={`tf-rate-btn ${rated === r ? 'is-on' : ''}`} onClick={() => setRated(r)}>
                <b>{r.label}</b><small>{r.next}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Progress & analysis (sample data) ─────────────────────────────────── */

function Progress() {
  const P = C.progress;
  const lo = 30; // columns start at 30% so the rise is visible
  const first = P.trend[0];
  const lastScore = P.trend[P.trend.length - 1];
  const R = 15.9155; // circumference 100
  return (
    <div className="tpg">
      <div className="tpg-stats">
        {P.stats.map((s, i) => (
          <div key={s.label} className="tpg-stat try-fade" style={{ '--d': `${80 + i * 80}ms` }}><b>{s.value}</b><small>{s.label}</small></div>
        ))}
      </div>
      <section className="tpg-card">
        <h3>Score trend <span className="tpg-up">+{lastScore - first}%</span></h3>
        <div className="tpg-cols" role="img" aria-label={`Weekly scores rising from ${first}% to ${lastScore}%`}>
          {P.trend.map((v, i) => (
            <div key={i} className={`tpg-col ${i === P.trend.length - 1 ? 'is-last' : ''}`}>
              <small>{i === P.trend.length - 1 ? `${v}%` : ''}</small>
              <i style={{ '--h': `${((v - lo) / (100 - lo)) * 100}%`, '--d': `${200 + i * 70}ms` }} />
              <span>W{i + 1}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="tpg-card">
        <h3>Readiness <small>sample data</small></h3>
        <div className="tpg-rings">
          {P.readiness.map((r, i) => (
            <div key={r.subject} className="tpg-ring">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r={R} className="tpg-ring-bg" />
                <circle cx="18" cy="18" r={R} className="tpg-ring-fg" style={{ '--p': r.pct, '--d': `${500 + i * 120}ms`, '--c': `var(--ring-${i})` }} />
              </svg>
              <b>{r.pct}%</b>
              <small>{r.subject}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="tpg-card">
        <h3>Weak topics <small>practise these next</small></h3>
        <ul className="tpg-weak">
          {P.weak.map((w, i) => (
            <li key={w.topic} className="try-fade" style={{ '--d': `${800 + i * 100}ms` }}>
              <span><b>{w.topic}</b><small>{w.subject} · {w.missed} missed</small></span>
              <i><em style={{ '--w': `${w.pct}%`, '--d': `${900 + i * 100}ms` }} /></i>
              <strong>{w.pct}%</strong>
            </li>
          ))}
        </ul>
        <p className="tpg-strong try-fade" style={{ '--d': '1200ms' }}>Strongest: <b>{P.strong.topic}</b> · {P.strong.pct}%</p>
      </section>
    </div>
  );
}

/* ── Planner (sample) ──────────────────────────────────────────────────── */

function Planner() {
  const [items, setItems] = useState(() => C.planner.map((p) => ({ ...p, done: false })));
  const done = items.filter((i) => i.done).length;
  const all = done === items.length;
  const [tapped, setTapped] = useState(false);
  // On reaching this step the four tasks tick themselves, one after another.
  useEffect(() => {
    const ids = items.map((_, k) => setTimeout(() => setItems((xs) => xs.map((x, j) => (j === k ? { ...x, done: true } : x))), 600 + k * 550));
    return () => ids.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`tpl ${all ? 'is-all' : ''}`}>
      <div className="tpl-head">
        <b>Today</b>
        {all && !tapped ? <Hint text="tap a task" arrow="down" after delay="300ms" className="hint-plan" /> : null}
        <small>{all ? 'All done' : `${done} of ${items.length} done`}</small>
      </div>
      {items.map((it, i) => (
        <button key={it.title} type="button" className={`tpl-item try-fade ${it.done ? 'is-done' : ''}`} style={{ '--d': `${80 + i * 80}ms` }}
          onClick={() => { setTapped(true); setItems((xs) => xs.map((x, k) => (k === i ? { ...x, done: !x.done } : x))); }}>
          <span className="tpl-check" aria-hidden="true" />
          <span className="tpl-kind">{it.kind}</span>
          <span className="tpl-title">{it.title}<small>{it.meta}</small></span>
        </button>
      ))}
      {all ? (
        <div className="tpl-streak try-fade" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.7 1 2.8 2.2 3.3C11 8.4 11.3 5 12 2z" /></svg>
          <span><b>{C.streak.days}-day streak</b><small>Every task done today</small></span>
          <em>+{C.streak.points} pts</em>
        </div>
      ) : null}
    </div>
  );
}

/* ── Coming soon ───────────────────────────────────────────────────────── */

function ComingSoon() {
  // One tool at a time, centred: each fades in, holds, fades out; "And more on the way" stays at the end.
  const items = [...C.comingSoon, { title: 'And more on the way', text: 'New tools every term.', more: true }];
  const [on, setOn] = useState(0);
  useEffect(() => {
    if (on >= items.length - 1) return undefined;
    const id = setTimeout(() => setOn((k) => k + 1), 1900);
    return () => clearTimeout(id);
  }, [on, items.length]);
  const it = items[on];
  return (
    <div className="ts">
      <div key={on} className={`ts-one ${it.more ? 'ts-more' : ''}`} aria-live="polite">
        <b>{it.title}</b><span>{it.text}</span>
      </div>
      <div className="ts-dots" aria-hidden="true">
        {items.map((x, i) => <i key={x.title} className={i === on ? 'is-on' : ''} />)}
      </div>
    </div>
  );
}

export default TryPage;
