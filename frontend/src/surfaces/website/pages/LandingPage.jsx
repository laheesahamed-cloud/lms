/*
 * LandingPage (v2) — pastel editorial "minimal brand echo" rebuild.
 * Composes the new section components. Scoped under `.lpv2` so the design
 * tokens/fonts apply without leaking into the app. Mixed light/dark rhythm:
 *   BootLoader (dark) → Hero (dark cinematic) → Floating subjects (cream) →
 *   Scroll-morph (light, accent bleed) → Manifesto (off-white) → Gallery
 *   (light gray) → Stats (cream) → Testimonials (cream) → Comparison (gray) →
 *   Final CTA (pastel mesh) → Footer (near-black).
 */
import { useCallback, useEffect, useState } from 'react';
import '../../../shared/styles/04-pages/landing-v2.css';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { useAuthStore } from '../../../shared/stores/authStore.js';
import { CinematicHero } from '../components/CinematicHero.jsx';
import { BootLoader } from '../components/landing/BootLoader.jsx';
import { LandingNav } from '../components/landing/LandingNav.jsx';
import { FloatingMedicalIcons } from '../components/landing/FloatingMedicalIcons.jsx';
import { ScrollMorphFeatures } from '../components/landing/ScrollMorphFeatures.jsx';
import { TextRevealManifesto } from '../components/landing/TextRevealManifesto.jsx';
import { MediaStrip } from '../components/landing/MediaStrip.jsx';
import { SubjectGallery3D } from '../components/landing/SubjectGallery3D.jsx';
import { StatsSection } from '../components/landing/StatsSection.jsx';
import { TestimonialsMarquee } from '../components/landing/TestimonialsMarquee.jsx';
import { FeatureComparison } from '../components/landing/FeatureComparison.jsx';
import { FinalCTA } from '../components/landing/FinalCTA.jsx';
import { SiteFooter } from '../components/landing/SiteFooter.jsx';

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
        title="Medical Study Platform"
        description="xyndrome is a medical LMS for Sri Lankan students with structured notes, exam-style MCQs, mock exams, explanations, and subject mastery tracking."
        path="/"
      />

      <BootLoader onFinished={handleBootFinished} />
      <LandingNav ctaTo="/register" signInTo="/login" />

      <CinematicHero animationReady={heroAnimationReady} secondaryCta={heroSecondaryCta} />
      <FloatingMedicalIcons />
      <ScrollMorphFeatures />
      <TextRevealManifesto />
      <MediaStrip />
      <SubjectGallery3D darkModeActive={subjectDarkModeActive} onDarkModeChange={handleSubjectDarkModeChange} />
      <StatsSection />
      <TestimonialsMarquee />
      <FeatureComparison />
      <FinalCTA primaryTo="/register" />
      <SiteFooter />
    </main>
  );
}

export default LandingPage;
