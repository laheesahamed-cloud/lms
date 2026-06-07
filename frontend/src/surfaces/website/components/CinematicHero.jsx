/*
 * CinematicHero (v2) — ported from 21st.dev "cinematic-landing-hero" (easemize),
 * heavily adapted for the xyndrome LMS landing redesign:
 *  - Plain JSX, no shadcn / theme-token dependency.
 *  - NO phone mockup — a browser/laptop mockup of the student dashboard instead.
 *  - Dramatic plum→black→teal card gradient; indigo brand-echo accents.
 *  - Aurora drift, floating medical-icon orbit, animated ECG line, GSAP pin sequence.
 *  - Respects prefers-reduced-motion (static "card showcase" frame).
 *
 * Brand wordmark renders as text — swap in the logo at "BRAND WORDMARK" once final.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const cx = (...parts) => parts.filter(Boolean).join(' ');

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const med = (name) => `${ASSET}medical/${name}.svg`;

const FG = '#EAF1F8';
const CTA_GRADIENT = 'linear-gradient(135deg, #4aa3f4 0%, #5274f3 52%, #6d35df 100%)';

// Floating decorative medical icons (downloaded Health Icons, MIT/public-domain).
const FLOATING_MED = [
  { n: 'heart',       cls: 'top-[16%] left-[8%]',      size: 52, anim: 'cinFloatA', depth: 26 },
  { n: 'dna',         cls: 'bottom-[20%] left-[12%]',  size: 48, anim: 'cinFloatC', depth: 30 },
  { n: 'brain',       cls: 'bottom-[24%] right-[12%]', size: 52, anim: 'cinFloatA', depth: 22 },
  { n: 'lungs',       cls: 'top-[48%] right-[5%]',     size: 44, anim: 'cinFloatC', depth: 38 },
  { n: 'microscope',  cls: 'bottom-[12%] left-[44%]',  size: 42, anim: 'cinFloatA', depth: 24 },
];

// Mini dashboard subject cards (pastel) shown inside the browser mockup.
const PREVIEW_SUBJECTS = [
  { label: 'Cardiology', pct: 94, bg: '#ffd6d6' },
  { label: 'Pharmacology', pct: 71, bg: '#d6f0ff' },
  { label: 'Pathology', pct: 83, bg: '#d6ffe8' },
  { label: 'Neurology', pct: 65, bg: '#e8d6ff' },
];

const INJECTED_STYLES = `
  .cinhero .gsap-reveal { visibility: hidden; }
  .cinhero .transform-style-3d { transform-style: preserve-3d; }

  .cinhero .film-grain {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50; opacity: 0.05; mix-blend-mode: overlay;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .cinhero .bg-grid-theme {
      background-size: 60px 60px;
      background-image:
          linear-gradient(to right, color-mix(in srgb, ${FG} 5%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, ${FG} 5%, transparent) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  /* Drifting aurora */
  .cinhero .cin-aurora { position: absolute; inset: -20% -10%; z-index: 0; pointer-events: none; filter: blur(8px); }
  .cinhero .cin-aurora span { position: absolute; border-radius: 999px; mix-blend-mode: screen; will-change: transform; }
  .cinhero .cin-aurora .a1 { top: 6%; left: 10%; width: 46vw; height: 46vw; background: radial-gradient(circle at center, rgba(37,99,235,0.32) 0%, rgba(37,99,235,0) 62%); animation: cinAuroraA 17s ease-in-out infinite; }
  .cinhero .cin-aurora .a2 { bottom: 2%; right: 8%; width: 42vw; height: 42vw; background: radial-gradient(circle at center, rgba(124,58,237,0.30) 0%, rgba(124,58,237,0) 62%); animation: cinAuroraB 21s ease-in-out infinite; }
  .cinhero .cin-aurora .a3 { top: 38%; left: 42%; width: 36vw; height: 36vw; background: radial-gradient(circle at center, rgba(74,163,244,0.22) 0%, rgba(74,163,244,0) 60%); animation: cinAuroraA 26s ease-in-out infinite reverse; }

  /* Floating medical icons */
  .cinhero .cin-med { position: absolute; z-index: 4; pointer-events: none; opacity: 0; filter: brightness(0) invert(1) drop-shadow(0 0 16px rgba(82,116,243,0.5)); will-change: transform; }
  .cinhero.cin-ready .cin-med { opacity: 0.18; transition: opacity 1.2s ease; }
  .cinhero .cin-med img { width: 100%; height: 100%; display: block; }

  /* Animated ECG line */
  .cinhero .cin-ecg { width: min(560px, 76vw); height: 56px; overflow: visible; }
  .cinhero .cin-ecg path {
      fill: none; stroke: url(#cinEcgGrad); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round;
      filter: drop-shadow(0 0 6px rgba(82,116,243,0.6));
      stroke-dasharray: 1100; stroke-dashoffset: 1100;
      animation: cinEcgDraw 3.4s cubic-bezier(0.6,0,0.2,1) 0.6s forwards, cinEcgPulse 2.2s ease-in-out 4s infinite;
  }

  .cinhero .text-3d-matte {
      color: ${FG};
      text-shadow: 0 10px 30px color-mix(in srgb, ${FG} 20%, transparent), 0 2px 4px color-mix(in srgb, ${FG} 10%, transparent);
  }
  .cinhero .text-grad-cta {
      background: ${CTA_GRADIENT};
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      transform: translateZ(0);
      filter: drop-shadow(0px 10px 26px rgba(82,116,243,0.32));
  }
  .cinhero .text-card-silver-matte {
      background: linear-gradient(180deg, #FFFFFF 0%, #cdbef0 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      transform: translateZ(0);
      filter: drop-shadow(0px 12px 24px rgba(0,0,0,0.8)) drop-shadow(0px 4px 8px rgba(124,58,237,0.3));
  }

  /* Card — spec gradient: plum → near-black → dark teal */
  .cinhero .premium-depth-card {
      background:
          radial-gradient(120% 90% at 86% 6%, rgba(124,58,237,0.20) 0%, transparent 46%),
          linear-gradient(145deg, #1a0533 0%, #06000f 60%, #001a18 100%);
      box-shadow: 0 40px 100px -20px rgba(0,0,0,0.9), 0 20px 40px -20px rgba(8,4,30,0.8), inset 0 1px 2px rgba(255,255,255,0.14), inset 0 -2px 4px rgba(0,0,0,0.8);
      border: 1px solid rgba(150,130,240,0.10);
      position: relative;
  }
  .cinhero .card-sheen {
      position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
      background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(150,130,240,0.10) 0%, transparent 40%);
      mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  /* Browser / laptop mockup */
  .cinhero .browser-mock {
      background: linear-gradient(180deg, #11131c 0%, #0a0c14 100%);
      box-shadow: 0 40px 80px -15px rgba(0,0,0,0.85), 0 15px 25px -5px rgba(8,4,30,0.7), inset 0 1px 0 rgba(255,255,255,0.06);
      border: 1px solid rgba(150,130,240,0.12);
  }
  .cinhero .browser-screen { background: radial-gradient(120% 100% at 50% 0%, #141a2e 0%, #0b0e1a 70%); }

  .cinhero .floating-ui-badge {
      background: linear-gradient(135deg, rgba(150,130,240,0.16) 0%, rgba(150,130,240,0.02) 100%);
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 0 0 1px rgba(150,130,240,0.18), 0 25px 50px -12px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .cinhero .study-cta {
      background: ${CTA_GRADIENT}; color: #fff;
      text-decoration: none;
      box-shadow: 0 18px 38px -18px rgba(82,116,243,0.7), inset 0 1px 1px rgba(255,255,255,0.28);
      transition: transform 0.35s cubic-bezier(0.25,1,0.5,1), filter 0.35s ease, box-shadow 0.35s ease;
  }
  .cinhero .study-cta:hover { transform: translateY(-3px); filter: saturate(1.08) brightness(1.05); text-decoration: none; }
  .cinhero .study-cta:focus { text-decoration: none; }
  .cinhero .study-cta:active { transform: scale(0.97); }
  .cinhero .btn-ghost-dark {
      background: rgba(255,255,255,0.06); color: #ede9ff; border: 1px solid rgba(255,255,255,0.16);
      text-decoration: none;
      transition: transform 0.3s cubic-bezier(0.25,1,0.5,1), background-color 0.3s cubic-bezier(0.25,1,0.5,1);
  }
  .cinhero .btn-ghost-dark:hover { transform: translateY(-3px); background: rgba(255,255,255,0.12); text-decoration: none; }
  .cinhero .btn-ghost-dark:focus { text-decoration: none; }
  .cinhero .btn-ghost-dark:active { transform: scale(0.97); }

  .cinhero .progress-ring { transform: rotate(-90deg); transform-origin: center; stroke-dasharray: 402; stroke-dashoffset: 402; stroke-linecap: round; }

  @keyframes cinAuroraA { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(6%, -5%, 0) scale(1.12); } }
  @keyframes cinAuroraB { 0%,100% { transform: translate3d(0,0,0) scale(1.05); } 50% { transform: translate3d(-7%, 4%, 0) scale(0.92); } }
  @keyframes cinFloatA { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-22px) rotate(3deg); } }
  @keyframes cinFloatB { 0%,100% { transform: translateY(0) rotate(2deg); } 50% { transform: translateY(-30px) rotate(-4deg); } }
  @keyframes cinFloatC { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-16px) rotate(5deg); } }
  @keyframes cinEcgDraw { to { stroke-dashoffset: 0; } }
  @keyframes cinEcgPulse { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }

  @media (prefers-reduced-motion: reduce) {
      .cinhero .cin-aurora span, .cinhero .cin-med, .cinhero .cin-ecg path { animation: none !important; }
      .cinhero .cin-ecg path { stroke-dashoffset: 0; }
  }
`;

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}
function GlyphPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2-6 4 12 2.5-7 1.5 1H22" />
    </svg>
  );
}
function GlyphNotes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h7l3 3v15H7z" /><path d="M14 3v4h4" /><path d="M10 11h5M10 15h5M10 19h3" />
    </svg>
  );
}
function GlyphChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-4" /><path d="M12 16V8" /><path d="M16 16v-6" />
    </svg>
  );
}

export function CinematicHero({
  animationReady = true,
  brandName = 'xyndrome',
  tagline1 = 'Master medical exams',
  tagline2 = 'with xyndrome.',
  cardHeading = "Built for Sri Lanka's medical students.",
  cardDescription = (
    <>
      <span className="font-semibold text-white">xyndrome</span> is a medical LMS
      for structured notes, exam-style MCQs, mock exams, and subject mastery
      tracking — all in one place.
    </>
  ),
  metricValue = 25,
  metricLabel = 'Clinical Subjects',
  ctaHeading = 'Your exam prep starts now.',
  ctaDescription = 'Notes, MCQs, mock exams, and progress tracking in one medical LMS.',
  primaryCta = { label: 'Start Free Trial', to: '/register' },
  secondaryCta = { label: 'Sign In', to: '/login' },
  className,
  ...props
}) {
  const containerRef = useRef(null);
  const mainCardRef = useRef(null);
  const mockupRef = useRef(null);
  const requestRef = useRef(0);

  // Neutralize the router's `.lms-route-reveal` transform so the fixed pin works.
  useLayoutEffect(() => {
    const wrap = containerRef.current?.closest('.lms-route-reveal');
    if (!wrap) return undefined;
    const prevClass = wrap.className;
    const prev = {
      transform: wrap.style.transform, perspective: wrap.style.perspective, filter: wrap.style.filter,
      contain: wrap.style.contain, willChange: wrap.style.willChange, animation: wrap.style.animation,
    };
    wrap.classList.remove('animate-panelRouteFade', 'animate-routeFade');
    wrap.style.animation = 'none'; wrap.style.transform = 'none'; wrap.style.perspective = 'none';
    wrap.style.filter = 'none'; wrap.style.contain = 'none'; wrap.style.willChange = 'auto';
    return () => {
      wrap.className = prevClass;
      Object.assign(wrap.style, prev);
    };
  }, []);

  // Mouse parallax — mockup tilt + floating icons.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (window.matchMedia?.('(hover: none), (pointer: coarse)').matches) return undefined;
    const meds = containerRef.current?.querySelectorAll('.cin-med') || [];

    const handleMouseMove = (e) => {
      if (window.scrollY > window.innerHeight * 2) return;
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
        const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
        if (mainCardRef.current && mockupRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect();
          mainCardRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
          mainCardRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
          gsap.to(mockupRef.current, { rotationY: xVal * 9, rotationX: -yVal * 9, ease: 'power3.out', duration: 1.2 });
        }
        meds.forEach((el) => {
          const depth = Number(el.dataset.depth) || 24;
          gsap.to(el, { x: -xVal * depth, y: -yVal * depth, ease: 'power2.out', duration: 1.4 });
        });
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => { window.removeEventListener('mousemove', handleMouseMove); cancelAnimationFrame(requestRef.current); };
  }, []);

  // Cinematic scroll timeline (or static frame for reduced motion).
  useEffect(() => {
    if (!animationReady) return undefined;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const root = containerRef.current;
    root?.classList.add('cin-ready');

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set('.gsap-reveal', { visibility: 'visible' });
        gsap.set('.hero-text-wrapper', { autoAlpha: 0 });
        gsap.set('.cta-wrapper', { autoAlpha: 0 });
        gsap.set('.main-card', { y: 0, autoAlpha: 1 });
        gsap.set(['.card-left-text', '.card-right-text', '.mockup-scroll-wrapper', '.floating-badge', '.phone-widget'], { autoAlpha: 1 });
        gsap.set('.progress-ring', { strokeDashoffset: 110 });
        const counter = root?.querySelector('.counter-val');
        if (counter) counter.innerHTML = String(metricValue);
        return;
      }

      const isMobile = window.innerWidth < 768;
      gsap.set('.text-track', { autoAlpha: 0, y: 60, scale: 0.85, filter: 'blur(20px)', rotationX: -20 });
      gsap.set('.text-days', { autoAlpha: 1, clipPath: 'inset(0 100% 0 0)' });
      gsap.set('.hero-accents', { autoAlpha: 0, y: 24 });
      gsap.set('.main-card', { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set(['.card-left-text', '.card-right-text', '.mockup-scroll-wrapper', '.floating-badge', '.phone-widget'], { autoAlpha: 0 });
      gsap.set('.cta-wrapper', { autoAlpha: 0, scale: 0.8, filter: 'blur(30px)' });

      gsap.timeline({ delay: 0.3 })
        .to('.text-track', { duration: 1.8, autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', rotationX: 0, ease: 'expo.out' })
        .to('.text-days', { duration: 1.7, clipPath: 'inset(0 0% 0 0)', ease: 'power4.inOut' }, '-=1.0')
        .to('.hero-accents', { duration: 1.4, autoAlpha: 1, y: 0, ease: 'power3.out' }, '-=0.9');

      gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top top', end: '+=8200', pin: true, scrub: 1.25, anticipatePin: 1 },
      })
        .to(['.hero-text-wrapper', '.bg-grid-theme', '.med-float'], { scale: 1.15, filter: 'blur(20px)', opacity: 0.12, ease: 'power2.inOut', duration: 2.4 }, 0)
        .to('.main-card', { y: 0, ease: 'power3.inOut', duration: 2.4 }, 0)
        .to('.main-card', { width: '100%', height: '100%', borderRadius: '0px', ease: 'power3.inOut', duration: 1.9 })
        .fromTo('.mockup-scroll-wrapper',
          { y: 300, z: -500, rotationX: 40, rotationY: -22, autoAlpha: 0, scale: 0.6 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: 'expo.out', duration: 2.5 }, '-=0.8')
        .fromTo('.phone-widget', { y: 40, autoAlpha: 0, scale: 0.95 }, { y: 0, autoAlpha: 1, scale: 1, stagger: 0.12, ease: 'back.out(1.2)', duration: 1.4 }, '-=1.6')
        .to('.progress-ring', { strokeDashoffset: 110, duration: 2, ease: 'power3.inOut' }, '-=1.4')
        .to('.counter-val', { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 2.2, ease: 'expo.out' }, '-=2.0')
        .fromTo('.floating-badge', { y: 100, autoAlpha: 0, scale: 0.7, rotationZ: -10 }, { y: 0, autoAlpha: 1, scale: 1, rotationZ: 0, ease: 'back.out(1.5)', duration: 1.5, stagger: 0.2 }, '-=2.0')
        .fromTo('.card-left-text', { x: -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: 'power4.out', duration: 1.5 }, '-=1.5')
        .fromTo('.card-right-text', { x: 50, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, ease: 'expo.out', duration: 1.5 }, '<')
        .to({}, { duration: 2.5 })
        .set('.hero-text-wrapper', { autoAlpha: 0 })
        .to(['.mockup-scroll-wrapper', '.floating-badge', '.card-left-text', '.card-right-text'], { scale: 0.9, y: -40, z: -200, autoAlpha: 0, ease: 'power2.inOut', duration: 1.9, stagger: 0.08 })
        .set('.cta-wrapper', { autoAlpha: 1 })
        .to('.main-card', { width: isMobile ? '92vw' : '85vw', height: isMobile ? '92vh' : '85vh', borderRadius: isMobile ? '32px' : '40px', ease: 'expo.inOut', duration: 2.2 }, 'pullback')
        .to('.cta-wrapper', { scale: 1, filter: 'blur(0px)', ease: 'expo.out', duration: 1.5 }, 'pullback+=0.15')
        .to({}, { duration: 2.5 })
        .to('.main-card', { y: -window.innerHeight - 300, ease: 'power2.inOut', duration: 2.3 })
        .to('.cta-wrapper', { y: -80, autoAlpha: 0, ease: 'power2.inOut', duration: 2.0 }, '<');
    }, containerRef);

    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { cancelAnimationFrame(refreshId); ctx.revert(); };
  }, [animationReady, metricValue]);

  return (
    <div
      ref={containerRef}
      className={cx('cinhero relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#070310] text-white font-sans antialiased', className)}
      style={{ perspective: '1500px' }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />

      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="cinEcgGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4aa3f4" /><stop offset="52%" stopColor="#5274f3" /><stop offset="100%" stopColor="#6d35df" />
          </linearGradient>
        </defs>
      </svg>

      <div className="cin-aurora" aria-hidden="true"><span className="a1" /><span className="a2" /><span className="a3" /></div>
      <div className="film-grain" aria-hidden="true" />
      <div className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      <div className="med-float absolute inset-0 z-[4] pointer-events-none" aria-hidden="true">
        {FLOATING_MED.map((m) => (
          <span key={m.n} data-depth={m.depth} className={cx('cin-med absolute', m.cls)} style={{ width: m.size, height: m.size, animation: `${m.anim} ${9 + (m.depth % 5)}s ease-in-out infinite` }}>
            <img src={med(m.n)} alt="" loading="lazy" />
          </span>
        ))}
      </div>

      {/* Hero text */}
      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform transform-style-3d">
        <h1 className="text-track gsap-reveal text-3d-matte text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight -mb-3 flex items-center justify-center gap-4">
          {tagline1}
        </h1>
        <h1 className="text-days gsap-reveal text-grad-cta text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter">{tagline2}</h1>
        <div className="hero-accents gsap-reveal mt-6 flex flex-col items-center gap-4">
          <p className="max-w-xl text-sm font-medium leading-relaxed text-white/65 md:text-base">
            A medical LMS for Sri Lankan students: structured notes, exam-style MCQs,
            mock exams, and progress tracking.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-[13px] font-semibold">
            {[{ icon: <GlyphPulse />, label: '10,000+ exam-style MCQs' }, { icon: <GlyphChart />, label: '25+ clinical subjects' }].map((p) => (
              <span key={p.label} className="inline-flex items-center gap-2 rounded-full border border-[#8a7bf0]/26 bg-[#5274f3]/10 px-3.5 py-1.5 text-[#d6cdff]">
                <span className="w-4 h-4 text-[#a99cff] [&_svg]:w-full [&_svg]:h-full">{p.icon}</span>{p.label}
              </span>
            ))}
          </div>
          <Link to={secondaryCta.to} className="btn-ghost-dark inline-flex min-w-[10rem] items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-bold no-underline focus:no-underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-[#5274f3] focus:ring-offset-2 focus:ring-offset-[#070310]">
            <span>{secondaryCta.label}</span>
          </Link>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-wrapper absolute z-30 flex max-h-[100dvh] w-screen flex-col items-center justify-center overflow-y-auto px-5 py-5 text-center gsap-reveal pointer-events-auto will-change-transform">
        <h2 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-grad-cta sm:mb-4 sm:text-4xl md:mb-6 md:text-6xl lg:text-7xl">{ctaHeading}</h2>
        <p className="mx-auto mb-3 max-w-lg text-sm font-medium leading-relaxed text-white/60 sm:text-base md:mb-5">{ctaDescription}</p>
        <p className="mb-4 max-w-xl text-xs font-semibold leading-relaxed text-[#d6cdff]/75 sm:text-sm md:mb-7 md:text-base">
          Learn from organized theory, practice exam-style questions, review explanations,
          and track weak areas before every mock.
        </p>
        <div className="mb-5 grid w-full max-w-[21rem] grid-cols-1 gap-2 text-left sm:max-w-2xl sm:grid-cols-3 sm:gap-3 md:mb-8">
          {[
            { icon: <GlyphNotes />, label: 'Structured notes', text: 'Review theory without scattered PDFs.' },
            { icon: <GlyphPulse />, label: 'MCQ practice', text: 'Practice by subject, topic, and weak area.' },
            { icon: <GlyphChart />, label: 'Progress tracking', text: 'See mastery before mock exams.' },
          ].map((item) => (
            <div key={item.label} className="py-1">
              <div className="mb-1 flex items-center gap-2 text-[13px] font-extrabold text-white sm:text-sm">
                <span className="grid size-6 place-items-center text-[#9db0ff] [&_svg]:size-4">{item.icon}</span>
                {item.label}
              </div>
              <p className="m-0 text-xs font-medium leading-relaxed text-white/50">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="flex w-full max-w-[18rem] flex-col items-center justify-center gap-2.5 sm:w-auto sm:max-w-xl sm:flex-row sm:gap-3">
          <Link to={primaryCta.to} className="study-cta inline-flex min-w-[12.5rem] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold no-underline focus:no-underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-[#5274f3] focus:ring-offset-2 focus:ring-offset-[#070310] sm:w-auto sm:px-6 sm:py-3 sm:text-base">
            <PlayIcon /><span>{primaryCta.label}</span>
          </Link>
          <Link to={secondaryCta.to} className="btn-ghost-dark inline-flex min-w-[12.5rem] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold no-underline focus:no-underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-[#5274f3] focus:ring-offset-2 focus:ring-offset-[#070310] sm:w-auto sm:px-6 sm:py-3 sm:text-base">
            <span>{secondaryCta.label}</span>
          </Link>
        </div>
      </div>

      {/* Card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: '1500px' }}>
        <div ref={mainCardRef} className="main-card premium-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]">
          <div className="card-sheen" aria-hidden="true" />
          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-[1fr_1.25fr_0.9fr] items-center lg:gap-8 z-10 py-6 lg:py-0">

            {/* LEFT: value prop */}
            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-0 lg:mb-5 tracking-tight text-[#e8d6ff]">{cardHeading}</h3>
              <p className="hidden md:block text-[#cdbef0]/75 text-sm md:text-base lg:text-lg font-normal leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-none">{cardDescription}</p>
            </div>

            {/* CENTER: browser/laptop mockup of the dashboard */}
            <div className="mockup-scroll-wrapper order-2 relative w-full h-[300px] lg:h-[460px] flex items-center justify-center z-10" style={{ perspective: '1200px' }}>
              <div className="relative w-full flex items-center justify-center transform scale-[0.78] md:scale-90 lg:scale-100">
                <div ref={mockupRef} className="browser-mock relative w-[min(560px,92%)] rounded-2xl overflow-hidden will-change-transform transform-style-3d">
                  {/* Chrome bar */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
                    <div className="ml-3 flex-1 max-w-[260px] mx-auto rounded-md bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] text-white/45 text-center font-mono">xyndrome.lk/lms</div>
                  </div>
                  {/* Screen */}
                  <div className="browser-screen p-4 lg:p-5">
                    <div className="phone-widget flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Welcome back</div>
                        <div className="text-base font-bold text-white">Tharushi</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff3d6]/15 border border-[#fff3d6]/25 px-2.5 py-1 text-[11px] font-bold text-[#ffe9b0]">7-day streak</span>
                    </div>

                    <div className="phone-widget flex items-center gap-4 rounded-xl bg-white/[0.04] border border-white/10 p-3 mb-3">
                      <div className="relative w-16 h-16 shrink-0">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64" aria-hidden="true">
                          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                          <circle className="progress-ring" cx="32" cy="32" r="26" fill="none" stroke="#5274f3" strokeWidth="7" pathLength="402" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-white">78%</div>
                      </div>
                      <div className="min-w-0">
                        <div className="counter-val text-2xl font-extrabold tracking-tight text-white leading-none">0</div>
                        <div className="text-[11px] text-[#9db0ff] font-semibold mt-1">{metricLabel}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {PREVIEW_SUBJECTS.map((s) => (
                        <div key={s.label} className="phone-widget rounded-xl p-2.5" style={{ background: `${s.bg}1f`, border: `1px solid ${s.bg}33` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-white/85">{s.label}</span>
                            <span className="text-[10px] font-bold" style={{ color: s.bg }}>{s.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <span className="block h-full rounded-full" style={{ width: `${s.pct}%`, background: s.bg }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating glass badges */}
                <div className="floating-badge absolute flex top-2 lg:top-2 left-[-12px] lg:left-[-64px] floating-ui-badge rounded-xl lg:rounded-2xl p-2.5 lg:p-3.5 items-center gap-2.5 lg:gap-3 z-30">
                  <span className="grid size-6 place-items-center rounded-lg bg-[#d6f0ff]/15 text-[#9db0ff]" aria-hidden="true"><GlyphPulse /></span>
                  <div><p className="text-white text-xs lg:text-sm font-bold tracking-tight">Cardiology</p><p className="text-[#9db0ff] text-[10px] lg:text-xs font-medium">94% mastery</p></div>
                </div>
                <div className="floating-badge absolute flex bottom-6 lg:bottom-10 right-[-12px] lg:right-[-64px] floating-ui-badge rounded-xl lg:rounded-2xl p-2.5 lg:p-3.5 items-center gap-2.5 lg:gap-3 z-30">
                  <span className="grid size-6 place-items-center rounded-lg bg-[#fff3d6]/15 text-[#ffe9b0]" aria-hidden="true"><PlayIcon /></span>
                  <div><p className="text-white text-xs lg:text-sm font-bold tracking-tight">Mock exam</p><p className="text-[#9db0ff] text-[10px] lg:text-xs font-medium">87 / 100</p></div>
                </div>
              </div>
            </div>

            {/* RIGHT: BRAND WORDMARK */}
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className="text-5xl md:text-[5rem] lg:text-[6.5rem] font-black lowercase tracking-tighter text-card-silver-matte">{brandName}</h2>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default CinematicHero;
