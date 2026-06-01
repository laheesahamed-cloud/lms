import { useEffect, useState } from 'react';
import { XyndromeLogoMark } from '../shared/brand/XyndromeBrand.jsx';

const bootTiming = {
  web: {
    minMs: 260,
    maxMs: 1200,
    stepGapMs: 180,
    exitMs: 220,
    settleMs: 0,
  },
  native: {
    minMs: 520,
    maxMs: 1600,
    stepGapMs: 240,
    exitMs: 240,
    settleMs: 40,
  },
};

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

export function BootLoader() {
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const native = isNativeRuntime();
    const timing = native ? bootTiming.native : bootTiming.web;
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

    function finishBoot() {
      if (done) return;
      done = true;
      window.__lmsAnimDone = true;
      window.__lmsBootComplete = true;
      document.body.classList.remove('app-booting');
      document.body.classList.add('app-ready');
      setStep(4);
      setExiting(true);
      document.dispatchEvent(new CustomEvent('lms:anim-done'));
      document.dispatchEvent(new CustomEvent('lms:boot-complete'));
      timers.push(window.setTimeout(() => setMounted(false), timing.exitMs));
    }

    function tryFinish() {
      if (!minTimeDone || !reactIsReady || !routeIsReady) return;
      const elapsed = performance.now() - startedAt;
      const settleDelay = Math.max(0, timing.settleMs - elapsed);
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

    const stepGap = timing.stepGapMs;
    timers.push(window.setTimeout(() => setStep(1), stepGap));
    timers.push(window.setTimeout(() => setStep(2), stepGap * 2));
    timers.push(window.setTimeout(() => setStep(3), stepGap * 3));
    timers.push(window.setTimeout(() => setStep(4), stepGap * 4));
    timers.push(window.setTimeout(() => {
      minTimeDone = true;
      tryFinish();
    }, timing.minMs));
    timers.push(window.setTimeout(() => {
      reactIsReady = true;
      routeIsReady = true;
      minTimeDone = true;
      finishBoot();
    }, timing.maxMs));

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
        <div className="abl-icon" aria-hidden="true">
          <XyndromeLogoMark size={native ? 58 : 60} />
        </div>

        <div className="abl-brand-wrap">
          <div className="abl-brand-text">xyndrome</div>
        </div>

        <p className="abl-tagline">Your Medical Exam Companion</p>

        <div className="abl-progress-area">
          <p className="abl-step-text">{bootSteps[step]}</p>
          <div className="abl-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
