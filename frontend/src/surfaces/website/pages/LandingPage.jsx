/*
 * LandingPage (v2) — pastel editorial "minimal brand echo" rebuild.
 * Composes the new section components. Scoped under `.lpv2` so the design
 * tokens/fonts apply without leaking into the app. Mixed light/dark rhythm:
 *   BootLoader (dark) → Hero (dark cinematic) → Floating subjects (cream) →
 *   Scroll-morph (light, accent bleed) → Manifesto (off-white) → Gallery
 *   (light gray) → Stats (cream) → Testimonials (cream) → Comparison (gray) →
 *   Final CTA (pastel mesh) → Footer (near-black).
 */
import { useCallback, useState } from 'react';
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
