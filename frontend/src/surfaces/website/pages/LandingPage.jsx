/*
 * LandingPage (v2) — pastel editorial landing, told as one story:
 *   Hero (dark cinematic) → Problem "stop juggling 5 apps" (cream) → Feature
 *   deep-dives (Canvas, MCQs, Flashcards, Instant Notes, Mocks) → Manifesto (why) →
 *   Subjects gallery → Stats → Testimonials → Comparison → FAQ → Final CTA →
 *   Footer. Calm in-view reveals throughout (only the hero is scroll-pinned).
 *   Scoped under `.lpv2` so tokens/fonts don't leak into the app.
 */
import { useCallback, useEffect, useState } from 'react';
import '../landing-v2.css';
import { ensureLandingFonts } from '../landingFonts.js';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { StructuredData } from '../../../shared/seo/StructuredData.jsx';
import { useAuthStore } from '../../../shared/stores/authStore.js';
import { CinematicHero } from '../components/CinematicHero.jsx';
import { BootLoader } from '../components/landing/BootLoader.jsx';
import { LandingNav } from '../components/landing/LandingNav.jsx';
import { ProblemSolutionSection } from '../components/landing/ProblemSolutionSection.jsx';
import { FeatureDeepDives } from '../components/landing/FeatureDeepDives.jsx';
import { TextRevealManifesto } from '../components/landing/TextRevealManifesto.jsx';
import { SubjectGallery3D } from '../components/landing/SubjectGallery3D.jsx';
import { StatsSection } from '../components/landing/StatsSection.jsx';
import { TestimonialsMarquee } from '../components/landing/TestimonialsMarquee.jsx';
import { FeatureComparison } from '../components/landing/FeatureComparison.jsx';
import { FaqSection } from '../components/landing/FaqSection.jsx';
import { FAQ_ITEMS } from '../components/landing/faqData.js';
import { FinalCTA } from '../components/landing/FinalCTA.jsx';
import { SiteFooter } from '../components/landing/SiteFooter.jsx';

// Landing typefaces start loading as soon as the landing chunk arrives.
ensureLandingFonts();

// Relative luminance (0 = black, 1 = white) of a computed `rgb()/rgba()` string.
// Drives whether the fixed nav sits over a dark section (white wordmark) or a
// light one (dark wordmark). Unknown colours fall back to "light".
const luminanceOf = (color) => {
  const m = color.match(/^rgba?\(([^)]+)\)/);
  if (!m) return 1;
  const [r, g, b] = m[1].split(',').map((s) => parseFloat(s));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [heroAnimationReady, setHeroAnimationReady] = useState(false);
  const [subjectDarkModeActive, setSubjectDarkModeActive] = useState(false);
  // The cinematic hero is pinned dark for ~8200px, so the nav must stay in its
  // over-dark (white wordmark) state far longer than a fixed scroll threshold.
  const [topIsDark, setTopIsDark] = useState(true);
  const handleBootFinished = useCallback(() => setHeroAnimationReady(true), []);
  const handleSubjectDarkModeChange = useCallback((active) => {
    setSubjectDarkModeActive((current) => current === active ? current : active);
  }, []);

  // Keep the safe area / status-bar colour (theme-color) and the overscroll
  // background matched to whatever section is at the top of the viewport, updating
  // live as you scroll (dark hero → cream sections → dark gallery, etc.). Without
  // this the notch/overscroll stays a fixed mismatched colour.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content') || '';
    const prevBodyBg = document.body.style.backgroundColor;
    // CSS `scroll-behavior: smooth` (set by the "balanced" visual-effects
    // profile) fights GSAP ScrollTrigger's scrub on the hero: the browser keeps
    // animating toward each programmatic scroll target while GSAP reads/sets the
    // position every frame, so scrubbed reveals flicker. Force instant scrolling
    // for the duration of the landing page.
    const rootEl = document.documentElement;
    const prevScrollBehavior = rootEl.style.scrollBehavior;
    rootEl.style.scrollBehavior = 'auto';
    const isOpaque = (c) => {
      if (!c || c === 'transparent') return false;
      const m = c.match(/^rgba?\(([^)]+)\)/);
      if (!m) return false;
      const parts = m[1].split(',').map((s) => s.trim());
      const alpha = parts.length >= 4 ? parseFloat(parts[3]) : 1;
      return alpha >= 0.99; // skip translucent overlays → take the solid base colour
    };
    const sampleTopColor = () => {
      // Probe a few points just below the fixed 64px nav, down the edges where the
      // section's own background shows (not a centered card), and take the first
      // opaque colour walking up the tree.
      const points = [[10, 80], [Math.round(window.innerWidth / 2), 80], [window.innerWidth - 10, 80]];
      for (const [x, y] of points) {
        let el = document.elementFromPoint(x, y);
        while (el && el !== document.documentElement) {
          const bg = getComputedStyle(el).backgroundColor;
          if (isOpaque(bg)) return bg;
          el = el.parentElement;
        }
      }
      return '';
    };
    // `sampleTopColor` does an elementFromPoint×3 + a getComputedStyle tree-walk,
    // which forces a synchronous style/layout recalc. Running it every scroll
    // frame is the single biggest scroll-jank source on Android, and the
    // notch/overscroll colour does not need per-frame precision — so throttle to
    // at most once per SAMPLE_MS, with a trailing sample so the resting colour is
    // always correct.
    const SAMPLE_MS = 120;
    const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let raf = 0;
    let trailTimer = 0;
    let lastRun = 0;
    const run = () => {
      raf = 0;
      lastRun = nowMs();
      const color = sampleTopColor();
      if (color) {
        meta?.setAttribute('content', color);
        document.body.style.backgroundColor = color;
        const dark = luminanceOf(color) < 0.5;
        setTopIsDark((cur) => (cur === dark ? cur : dark));
      }
    };
    const schedule = () => {
      if (raf || trailTimer) return;
      const elapsed = nowMs() - lastRun;
      if (elapsed >= SAMPLE_MS) {
        raf = requestAnimationFrame(run);
      } else {
        trailTimer = setTimeout(() => { trailTimer = 0; raf = requestAnimationFrame(run); }, SAMPLE_MS - elapsed);
      }
    };
    run();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
      if (trailTimer) clearTimeout(trailTimer);
      if (meta && prevTheme) meta.setAttribute('content', prevTheme);
      document.body.style.backgroundColor = prevBodyBg;
      rootEl.style.scrollBehavior = prevScrollBehavior;
    };
  }, []);

  // Re-sample after the gallery flips the page into/out of dark mode (the bg
  // transition takes ~0.75s, so sample once it has settled).
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('scroll')), 820);
    return () => clearTimeout(t);
  }, [subjectDarkModeActive]);

  const dashboardUrl = !isAuthenticated || !user
    ? '/login'
    : user.role === 'admin'
      ? '/admin/dashboard'
      : user.status === 'active'
        ? '/dashboard'
        : '/pending';

  const heroSecondaryCta = isAuthenticated
    ? { label: 'Open Dashboard', to: dashboardUrl }
    : { label: 'Sign In', to: '/login' };

  return (
    <main className={`lpv2 relative isolate overflow-x-clip ${subjectDarkModeActive ? 'lpv2--subject-dark' : ''}`}>
      <PageMeta
        title="Study App for Sri Lankan Medical Students: Notes, Q-Bank, Flashcards & Mock Exams"
        description="The all-in-one study app for Sri Lankan medical students, for MBBS, KDU and licensing-exam prep. Write on your own notes, practise a teaching Q-Bank that explains why wrong answers are wrong, build your own flashcards, sit timed mock exams and plan revision with reminders, all in one place."
        path="/"
      />
      <StructuredData id="landing" faqs={FAQ_ITEMS} />

      <BootLoader onFinished={handleBootFinished} />
      <LandingNav ctaTo="/register" signInTo="/login" overDark={topIsDark} />

      <CinematicHero animationReady={heroAnimationReady} secondaryCta={heroSecondaryCta} />
      <ProblemSolutionSection />
      <FeatureDeepDives />
      <TextRevealManifesto />
      <SubjectGallery3D darkModeActive={subjectDarkModeActive} onDarkModeChange={handleSubjectDarkModeChange} />
      <StatsSection />
      <TestimonialsMarquee />
      <FeatureComparison />
      <FaqSection />
      <FinalCTA primaryTo="/register" />
      <SiteFooter />
    </main>
  );
}

export default LandingPage;
