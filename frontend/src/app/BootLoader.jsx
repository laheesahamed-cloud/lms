import { useEffect, useState } from 'react';

const bootSteps = [
  'Starting app...',
  'Loading dashboard...',
  'Preparing study data...',
  'Almost ready...',
  'Ready',
];

function isNativeRuntime() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.lmsRuntime === 'native';
}

function removeStaticBootScreen() {
  if (typeof document === 'undefined') return;
  document.getElementById('lms-static-boot')?.remove();
}

export function BootLoader() {
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const native = isNativeRuntime();
    const minBootMs = native ? 3000 : 720;
    const maxBootMs = native ? 5200 : 1900;
    const startedAt = performance.now();
    let done = false;
    let minTimeDone = false;
    let reactIsReady = window.__lmsReactReady === true;
    let routeIsReady = window.__lmsRouteReady === true;
    const timers = [];

    window.__lmsAnimDone = false;
    window.__lmsBootComplete = false;
    document.body.classList.add('app-booting');
    document.body.classList.remove('app-ready');
    removeStaticBootScreen();

    function finishBoot() {
      if (done) return;
      done = true;
      window.__lmsAnimDone = true;
      window.__lmsBootComplete = true;
      document.body.classList.remove('app-booting');
      document.body.classList.add('app-ready');
      setExiting(true);
      document.dispatchEvent(new CustomEvent('lms:anim-done'));
      document.dispatchEvent(new CustomEvent('lms:boot-complete'));
      timers.push(window.setTimeout(() => setMounted(false), native ? 320 : 420));
    }

    function tryFinish() {
      if (!minTimeDone || !reactIsReady || !routeIsReady) return;
      const elapsed = performance.now() - startedAt;
      const settleDelay = native ? Math.max(0, 80 - elapsed) : 0;
      timers.push(window.setTimeout(finishBoot, settleDelay));
    }

    function handleReactReady() {
      reactIsReady = true;
      tryFinish();
    }

    function handleRouteReady() {
      routeIsReady = true;
      tryFinish();
    }

    if (!reactIsReady) {
      document.addEventListener('lms:react-ready', handleReactReady);
    }
    if (!routeIsReady) {
      document.addEventListener('lms:route-ready', handleRouteReady);
    }

    const stepGap = native ? 600 : 160;
    timers.push(window.setTimeout(() => setStep(1), stepGap));
    timers.push(window.setTimeout(() => setStep(2), stepGap * 2));
    timers.push(window.setTimeout(() => setStep(3), stepGap * 3));
    timers.push(window.setTimeout(() => setStep(4), stepGap * 4));
    timers.push(window.setTimeout(() => {
      minTimeDone = true;
      tryFinish();
    }, minBootMs));
    timers.push(window.setTimeout(() => {
      reactIsReady = true;
      routeIsReady = true;
      minTimeDone = true;
      finishBoot();
    }, maxBootMs));

    return () => {
      document.removeEventListener('lms:react-ready', handleReactReady);
      document.removeEventListener('lms:route-ready', handleRouteReady);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (!mounted) return null;

  const native = isNativeRuntime();
  const loaderClassName = [native ? 'abl-native' : '', exiting ? 'abl-exiting' : ''].filter(Boolean).join(' ');

  return (
    <div id="app-boot-loader" className={loaderClassName} aria-hidden="true" role="presentation">
      <div className="abl-glow abl-glow--tl" />
      <div className="abl-glow abl-glow--br" />
      <div className="abl-glow abl-glow--center" />
      <div className="abl-grid" />

      <div className="abl-stage">
        {native ? (
          <span className="abl-native-pulse" aria-hidden="true" />
        ) : (
          <div className="abl-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32 4L56 18V46L32 60L8 46V18L32 4Z" stroke="url(#abl-hex)" strokeWidth="1.4" fill="none" opacity="0.65" />
              <path d="M32 14L48 23.5V42.5L32 52L16 42.5V23.5L32 14Z" stroke="url(#abl-hex)" strokeWidth="0.9" fill="none" opacity="0.35" />
              <path d="M32 22V42" stroke="url(#abl-cross)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M22 32H42" stroke="url(#abl-cross)" strokeWidth="4.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="abl-hex" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="abl-cross" x1="22" y1="22" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}

        <div className="abl-brand-wrap">
          <div className="abl-brand-text">ERPM LMS</div>
        </div>

        {!native ? <p className="abl-tagline">Your Medical Exam Companion</p> : null}

        {!native ? (
          <div className="abl-progress-area">
            <p className="abl-step-text">{bootSteps[step]}</p>
            <div className="abl-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
