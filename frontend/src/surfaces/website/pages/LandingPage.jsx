/*
 * LandingPage (v2) — pastel editorial landing, told as one story:
 *   Hero (dark cinematic) → Problem "stop juggling 5 apps" (cream) → Feature
 *   deep-dives (Canvas, MCQs, Flashcards, AI Notes, Mocks) → Manifesto (why) →
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

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [heroAnimationReady, setHeroAnimationReady] = useState(false);
  const [subjectDarkModeActive, setSubjectDarkModeActive] = useState(false);
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
    let raf = 0;
    const run = () => {
      raf = 0;
      const color = sampleTopColor();
      if (color) {
        meta?.setAttribute('content', color);
        document.body.style.backgroundColor = color;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (meta && prevTheme) meta.setAttribute('content', prevTheme);
      document.body.style.backgroundColor = prevBodyBg;
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
        title="Medical Study Platform — Notes, MCQs, Flashcards & Mock Exams"
        description="xyndrome puts your whole medical study workflow in one place: canvas notes, 10,000+ exam-style MCQs with doctor-written explanations, high-yield flashcards, AI notes, timed mock exams and subject mastery tracking — built for Sri Lankan medical students."
        path="/"
      />
      <StructuredData id="landing" faqs={FAQ_ITEMS} />

      <BootLoader onFinished={handleBootFinished} />
      <LandingNav ctaTo="/register" signInTo="/login" />

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
