import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './login-anim.css';
import './auth-native.css';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../../shared/api/client.js';
import { fetchPublicSettings } from '../../../shared/api/settings.api.js';
import { ThemeToggle } from '../../../shared/layout/ThemeToggle.jsx';
import { detectPlatform } from '../../../shared/platform/detect.js';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { useAuthStore } from '../../../shared/stores/authStore.js';
import { clearServerNotResponding } from '../../../shared/stores/serverStatusStore.js';
import { requestSpaNavigation } from '../../../shared/routing/spaNavigation.js';
import { cx, ui } from '../../../shared/styles/tailwindClasses.js';
import { canonicalizeForwardPathForUser, getSafeForwardPath } from '../../../shared/utils/routeForwarding.js';
import { AuthFeedbackNotice } from './AuthFeedbackNotice.jsx';
import { preloadRouteByPath } from '../../../app/routePreloading.js';
import { useNativeAuthKeyboardAnchor } from './useNativeAuthKeyboardAnchor.js';

/* ── Animation keyframes ─────────────────────────────────────────────────────── */

const STATIC_GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_SCRIPT_ID = 'google-identity-services';

function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in is not available here'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google sign-in could not load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google sign-in could not load'));
    document.head.appendChild(script);
  });
}

/* ── Medical subject pills ────────────────────────────────────────────────────── */
function MedSubjectPills() {
  const subjects = [
    { name: 'Cardiology', color: '#60A5FA', bg: 'rgba(96,165,250,.12)', border: 'rgba(96,165,250,.25)' },
    { name: 'Pharmacology', color: '#A78BFA', bg: 'rgba(167,139,250,.12)', border: 'rgba(167,139,250,.25)' },
    { name: 'Anatomy', color: '#34D399', bg: 'rgba(52,211,153,.12)', border: 'rgba(52,211,153,.25)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {subjects.map(({ name, color, bg, border }) => (
        <span key={name} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          borderRadius: 99, border: `1px solid ${border}`,
          background: bg, padding: '4px 11px',
          fontSize: 11.5, fontWeight: 700, color,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }}/>
          {name}
        </span>
      ))}
    </div>
  );
}

/* ── ECG monitor band ─────────────────────────────────────────────────────────── */
function EcgMonitorBand() {
  const P = 'M0,60 L10,60 L14,54 L18,66 L22,60 L30,60 L32,65 L35,20 L38,92 L42,60 L54,60 L58,48 L65,60 L112,60 L122,54 L126,66 L130,60 L138,60 L140,65 L143,20 L146,92 L150,60 L162,60 L166,48 L173,60 L224,60 L234,54 L238,66 L242,60 L250,60 L252,65 L255,20 L258,92 L262,60 L274,60 L278,48 L285,60 L336,60 L346,54 L350,66 L354,60 L362,60 L364,65 L367,20 L370,92 L374,60 L386,60 L390,48 L397,60 L448,60 L458,54 L462,66 L466,60 L474,60 L476,65 L479,20 L482,92 L486,60 L498,60 L502,48 L509,60 L560,60';
  const gridBg = {
    backgroundImage: [
      'linear-gradient(var(--lms-brand-monitor-grid) 1px, transparent 1px)',
      'linear-gradient(90deg, var(--lms-brand-monitor-grid) 1px, transparent 1px)',
    ].join(','),
    backgroundSize: '22px 22px',
    backgroundColor: 'transparent',
  };
  return (
    <div style={{ position:'relative', width:'min(76%, 430px)', margin:'0 auto 10px', flexShrink:0 }}>

      {/* ── Top dome grid extension ── */}
      <div style={{
        position:'absolute', bottom:'100%', left:0, right:0, height:36,
        ...gridBg,
        WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(0,0,0,.55) 0%, transparent 70%)',
        maskImage:        'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(0,0,0,.55) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {/* ── Bottom dome grid extension ── */}
      <div style={{
        position:'absolute', top:'100%', left:0, right:0, height:36,
        ...gridBg,
        WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(0,0,0,.55) 0%, transparent 70%)',
        maskImage:        'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(0,0,0,.55) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {/* ── Main card — left/right feather only ── */}
      <div style={{
        position:'relative', width:'100%', height:132,
        borderRadius:20, overflow:'hidden', flexShrink:0,
        border:'1px solid var(--lms-brand-border)',
        background:'linear-gradient(180deg, var(--lms-brand-card-strong), transparent)',
        boxShadow:'0 18px 44px rgba(15,23,42,.10)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
        maskImage:        'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
      }}>
        {/* Grid */}
        <div style={{ position:'absolute', inset:0, ...gridBg }}/>

        {/* Live monitor label */}
        <div style={{
          position:'absolute', bottom:9, left:'50%', transform:'translateX(-50%)',
          display:'inline-flex', alignItems:'center', gap:5,
          background:'var(--lms-brand-monitor-bg)', border:'1px solid rgba(34,211,238,.18)',
          borderRadius:99, padding:'3px 10px', zIndex:4,
        }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:'#22D3EE', boxShadow:'0 0 6px #22D3EE', flexShrink:0 }}/>
          <span style={{ fontSize:11.5, fontWeight:800, color:'var(--lms-brand-monitor-label)', letterSpacing:'.1em', textTransform:'uppercase' }}>Clinical progress</span>
        </div>

        {/* Annotation card — Heart Rate */}
        <div style={{
          position:'absolute', top:10, left:'10%',
          background:'var(--lms-brand-card-strong)', border:'1px solid rgba(34,211,238,.18)',
          borderRadius:10, padding:'7px 13px',
          backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
          zIndex:3, boxShadow:'0 0 0 1px rgba(34,211,238,.08), 0 10px 26px rgba(15,23,42,.12)',
        }}>
          <div style={{ fontSize:11.5, fontWeight:800, color:'var(--lms-brand-soft)', letterSpacing:'.11em', textTransform:'uppercase' }}>Heart Rate</div>
          <div style={{ fontSize:20, fontWeight:900, color:'#22D3EE', lineHeight:1.1, marginTop:2 }}>
            72<span style={{ fontSize:11, fontWeight:600, color:'var(--lms-brand-soft)', marginLeft:2 }}>bpm</span>
          </div>
          <div style={{ fontSize:11.5, fontWeight:700, color:'#34D399', marginTop:3 }}>Normal sinus</div>
        </div>

        {/* Annotation card — SpO₂ */}
        <div style={{
          position:'absolute', top:10, right:'10%',
          background:'var(--lms-brand-card-strong)', border:'1px solid rgba(96,165,250,.18)',
          borderRadius:10, padding:'7px 13px',
          backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
          zIndex:3, boxShadow:'0 0 0 1px rgba(96,165,250,.07), 0 10px 26px rgba(15,23,42,.12)',
        }}>
          <div style={{ fontSize:11.5, fontWeight:800, color:'var(--lms-brand-soft)', letterSpacing:'.11em', textTransform:'uppercase' }}>SpO₂</div>
          <div style={{ fontSize:20, fontWeight:900, color:'#60A5FA', lineHeight:1.1, marginTop:2 }}>
            98<span style={{ fontSize:11, fontWeight:600, color:'var(--lms-brand-soft)', marginLeft:2 }}>%</span>
          </div>
          <div style={{ fontSize:11.5, fontWeight:700, color:'#34D399', marginTop:3 }}>Oxygen sat.</div>
        </div>

        {/* ECG SVG */}
        <svg viewBox="0 0 560 120" fill="none" preserveAspectRatio="none"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:2 }}
          aria-hidden="true"
        >
          <defs>
            <filter id="ecgGlowF" x="-4%" y="-90%" width="108%" height="280%">
              <feGaussianBlur stdDeviation="2.8" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="dotGlowF" x="-180%" y="-180%" width="460%" height="460%">
              <feGaussianBlur stdDeviation="6" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path d={P} stroke="var(--lms-brand-ecg-base)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" filter="url(#ecgGlowF)"/>
          <path d={P} className="lms-ecg-full" stroke="var(--lms-brand-ecg-stroke)" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="255" cy="20" r="9" fill="var(--lms-brand-ecg-dot)" className="lms-ecg-dot" filter="url(#dotGlowF)"/>
          <circle cx="255" cy="20" r="5" fill="var(--lms-brand-ecg-stroke)" className="lms-ecg-dot"/>
          <circle cx="255" cy="20" r="2.2" fill="white" opacity=".92"/>
        </svg>
      </div>
    </div>
  );
}

/* ── Left brand panel ────────────────────────────────────────────────────────── */
const LoginBrand = memo(function LoginBrand() {
  return (
    <div
      className="lms-brand-panel"
      aria-hidden="true"
      style={{
        position: 'relative', width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none',
        background: 'var(--lms-brand-bg)',
      }}
    >
      {/* ── Ambient glows ── */}
      <div className="lms-glow-pulse" style={{
        position: 'absolute', top: '-18%', right: '-6%',
        width: 560, height: 560, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, var(--lms-brand-blue-glow) 0%, transparent 64%)',
      }}/>
      <div className="lms-glow-pulse" style={{
        position: 'absolute', bottom: '-5%', left: '-10%',
        width: 440, height: 440, borderRadius: '50%', pointerEvents: 'none', animationDelay: '2.2s',
        background: 'radial-gradient(circle, var(--lms-brand-cyan-glow) 0%, transparent 64%)',
      }}/>
      <div className="lms-glow-pulse" style={{
        position: 'absolute', top: '40%', left: '30%',
        width: 320, height: 320, borderRadius: '50%', pointerEvents: 'none', animationDelay: '1.1s',
        background: 'radial-gradient(circle, var(--lms-brand-violet-glow) 0%, transparent 64%)',
      }}/>

      {/* ── Subtle ambient noise texture only (no hard grid) ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, var(--lms-brand-grid) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}/>

      {/* ── Large decorative stethoscope (background art) ── */}
      <div style={{ position: 'absolute', bottom: 130, right: -14, opacity: 'var(--lms-brand-lower-art-opacity)', pointerEvents: 'none', color: 'var(--lms-brand-lower-art-color)', transform: 'rotate(-14deg)' }}>
        <svg width="170" height="196" viewBox="0 0 170 196" fill="none">
          <circle cx="38" cy="20" r="12" stroke="currentColor" strokeWidth="11" fill="none"/>
          <circle cx="112" cy="20" r="12" stroke="currentColor" strokeWidth="11" fill="none"/>
          <path d="M38 32 C38 72 75 82 75 125" stroke="currentColor" strokeWidth="11" strokeLinecap="round" fill="none"/>
          <path d="M112 32 C112 72 75 82 75 125" stroke="currentColor" strokeWidth="11" strokeLinecap="round" fill="none"/>
          <circle cx="75" cy="158" r="32" stroke="currentColor" strokeWidth="9" fill="none"/>
          <circle cx="75" cy="158" r="16" fill="currentColor" opacity=".35"/>
        </svg>
      </div>
      {/* ── Decorative microscope (background art) ── */}
      <div style={{ position: 'absolute', top: 110, left: 18, opacity: .05, pointerEvents: 'none', color: '#22D3EE', transform: 'rotate(6deg)' }}>
        <svg width="76" height="116" viewBox="0 0 76 116" fill="none">
          <rect x="27" y="4" width="22" height="42" rx="5" stroke="currentColor" strokeWidth="7"/>
          <rect x="22" y="44" width="32" height="16" rx="5" stroke="currentColor" strokeWidth="6"/>
          <path d="M38 60 L38 84" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
          <path d="M8 108 L68 108" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
          <path d="M26 84 L50 84 L54 108 L22 108 Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" fill="none"/>
          <circle cx="38" cy="25" r="6" fill="currentColor" opacity=".4"/>
        </svg>
      </div>
      {/* ── Decorative DNA helix (background art, left mid) ── */}
      <div style={{ position: 'absolute', bottom: 290, left: 24, opacity: .055, pointerEvents: 'none', color: '#A78BFA' }}>
        <svg width="22" height="56" viewBox="0 0 22 56" fill="none">
          <path d="M2 2C2 2 20 10 20 28C20 46 2 54 2 54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M20 2C20 2 2 10 2 28C2 46 20 54 20 54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="2" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
          <line x1="5" y1="22" x2="17" y2="22" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
          <line x1="2" y1="28" x2="20" y2="28" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
          <line x1="5" y1="34" x2="17" y2="34" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
          <line x1="2" y1="42" x2="20" y2="42" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
        </svg>
      </div>
      {/* ── Top diagonal line accent ── */}
      <svg style={{ position: 'absolute', top: 0, right: 0, width: 220, height: 220, opacity: .06, pointerEvents: 'none' }} viewBox="0 0 220 220" fill="none">
        <line x1="220" y1="0" x2="0" y2="220" stroke="url(#brandLine)" strokeWidth="1"/>
        <line x1="220" y1="40" x2="40" y2="220" stroke="url(#brandLine)" strokeWidth="1"/>
        <line x1="220" y1="80" x2="80" y2="220" stroke="url(#brandLine)" strokeWidth="1"/>
        <defs>
          <linearGradient id="brandLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop stopColor="#22D3EE"/><stop offset="1" stopColor="#6366F1"/>
          </linearGradient>
        </defs>
      </svg>

      {/* ── Decorative medical cross ── */}
      <div className="lms-cross-pulse lms-login-brand-plus" style={{
        position: 'absolute', top: 28, right: 32, opacity: .22, pointerEvents: 'none', color: '#22D3EE',
      }}>
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <rect x="14" y="2" width="6" height="30" rx="2.5" fill="currentColor"/>
          <rect x="2" y="14" width="30" height="6" rx="2.5" fill="currentColor"/>
        </svg>
      </div>

      {/* ── Logo ── */}
      <XyndromeBrand
        className="lms-login-brand-logo-row"
        markSize={50}
        subtitle="Medical Workspace"
        textClassName="!font-extrabold"
        subtitleClassName="!font-bold"
        style={{
          '--xyndrome-brand-text': 'var(--lms-brand-title)',
          '--xyndrome-brand-muted': 'var(--lms-brand-soft)',
          padding: '28px 36px 0',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      />

      {/* ── Hero copy ── */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '18px 40px', minHeight: 0 }}
        className="lms-brand-stagger"
      >
        {/* Eyebrow pill */}
        <div style={{
          display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: 8,
          borderRadius: 999, border: '1px solid rgba(6,182,212,.30)',
          background: 'rgba(6,182,212,.10)', padding: '5px 14px', marginBottom: 22,
          fontSize: 11, fontWeight: 800, color: '#22D3EE',
          letterSpacing: '.1em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22D3EE', boxShadow: '0 0 8px #22D3EE', flexShrink: 0 }}/>
          Trusted by medical students
        </div>

        {/* Headline */}
        <h1 style={{
          margin: '0 0 16px', lineHeight: 1.07, fontWeight: 900,
          fontSize: 'clamp(26px, 2.6vw, 44px)', color: 'var(--lms-brand-title)',
          letterSpacing: '-0.025em',
        }}>
          Your medical study{' '}<br/>
          <span style={{
            background: 'linear-gradient(135deg, #60A5FA 0%, #22D3EE 55%, #34D399 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>command center.</span>
        </h1>

        {/* Subtitle */}
        <p style={{ margin: '0 0 20px', fontSize: 14.5, lineHeight: 1.72, color: 'var(--lms-brand-muted)', maxWidth: 430 }}>
          Lessons, flashcards, Q-Bank, and progress tracking — all in one focused clinical workspace.
        </p>

        {/* ECG monitor band */}
        <EcgMonitorBand/>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {[
            'Role-aware access for every learner type',
            'Integrated study tools, notes & Q-Bank',
            'Dark & light mode, built for long sessions',
          ].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                background: 'rgba(34,211,238,.12)', border: '1px solid rgba(34,211,238,.26)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1.5 5.5l2.8 2.8L9.5 2" stroke="#22D3EE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--lms-brand-strong)', fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Medical subject pills */}
        <div style={{ marginTop: 18 }}>
          <MedSubjectPills/>
        </div>
      </div>

      {/* ── Bottom stats strip ── */}
      <div style={{ padding: '0 40px 30px', flexShrink: 0 }}>
        {/* Simplified stats card */}
        <div style={{
          borderRadius: 16, border: '1px solid var(--lms-brand-border)',
          background: 'var(--lms-brand-card)', padding: '13px 16px',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          opacity: .92,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            {/* Progress section */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lms-brand-strong)' }}>Revision path</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#22D3EE' }}>74%</span>
              </div>
              <div style={{ height: 3.5, borderRadius: 99, background: 'color-mix(in_srgb, var(--lms-brand-border) 68%, transparent)', overflow: 'hidden' }}>
                <div className="lms-meter-fill" style={{
                  height: '100%', width: '74%', borderRadius: 99,
                  background: 'linear-gradient(90deg, #22D3EE, #60A5FA, #A78BFA)',
                  boxShadow: '0 0 10px rgba(34,211,238,.38)',
                }}/>
              </div>
            </div>
            {/* Divider */}
            <div style={{ width: 1, height: 36, background: 'var(--lms-brand-border)', flexShrink: 0 }}/>
            {/* 2 key stats */}
            <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
              {[['Streak', '12d', '#60A5FA'], ['Q-Bank', '480', '#A78BFA'], ['BP', '120/80', '#FB7185']].map(([label, value, color]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize:11, fontWeight: 700, color: 'var(--lms-brand-soft)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const PLATFORM = detectPlatform();
const LOGIN_INTRO_COMPLETE_DELAY_MS = 900;
let loginIntroHasCompleted = false;

function showNativeDocument() {
  if (typeof document === 'undefined') return;

  const targets = [
    document.documentElement,
    document.body,
    document.getElementById('root'),
    document.querySelector('.lms-app-scroll-root'),
    document.querySelector('.portal-content'),
    document.querySelector('.portal-content__frame'),
  ].filter(Boolean);

  document.body.classList.remove('app-booting');
  document.body.classList.add('app-ready');
  targets.forEach((element) => {
    element.style.visibility = 'visible';
    element.style.opacity = '1';
    element.style.webkitBackfaceVisibility = 'hidden';
    element.style.backfaceVisibility = 'hidden';
  });
}

function nextPaint() {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function forceNativeRoute(path) {
  if (typeof window === 'undefined') return;
  const target = getSafeForwardPath(path, '/dashboard') || '/dashboard';
  const targetPathname = target.split(/[?#]/)[0] || '/';

  window.setTimeout(() => {
    if (window.location.pathname !== targetPathname) {
      requestSpaNavigation(target, { replace: true });
    }
  }, 650);
}

/* ── Login page ──────────────────────────────────────────────────────────────── */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn   = useAuthStore((s) => s.signIn);
  const signInWithGoogleCode = useAuthStore((s) => s.signInWithGoogleCode);
  const authNotice = useAuthStore((s) => s.authNotice);
  const consumeAuthNotice = useAuthStore((s) => s.consumeAuthNotice);

  const [status,       setStatus]       = useState({ loading: false, error: '', success: '' });
  const [googleSdk, setGoogleSdk] = useState(null);
  const [googleClientId, setGoogleClientId] = useState(STATIC_GOOGLE_CLIENT_ID);
  const [googleConfigStatus, setGoogleConfigStatus] = useState({
    loading: !STATIC_GOOGLE_CLIENT_ID,
    error: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const googleCodeClientRef = useRef(null);
  const fromParam = new URLSearchParams(location.search).get('from') || '';
  const requestedPath = getSafeForwardPath(fromParam);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;

    let timer = 0;
    const body = document.body;
    const routeReveal = document.querySelector('.lms-login-page')?.closest('.lms-route-reveal');
    body.classList.add('lms-login-mounted');
    routeReveal?.classList.add('lms-login-route-stable');

    const completeIntro = () => {
      loginIntroHasCompleted = true;
      body.classList.add('lms-login-intro-complete');
    };

    const completeIntroOnFieldIntent = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.lms-login-page :is(input, textarea, select, [contenteditable="true"])')) return;
      completeIntro();
    };

    if (loginIntroHasCompleted) {
      completeIntro();
    } else {
      body.classList.remove('lms-login-intro-complete');
      timer = window.setTimeout(completeIntro, LOGIN_INTRO_COMPLETE_DELAY_MS);
    }

    document.addEventListener('pointerdown', completeIntroOnFieldIntent, true);
    document.addEventListener('focusin', completeIntroOnFieldIntent, true);

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('pointerdown', completeIntroOnFieldIntent, true);
      document.removeEventListener('focusin', completeIntroOnFieldIntent, true);
      body.classList.remove('lms-login-mounted');
      routeReveal?.classList.remove('lms-login-route-stable');
    };
  }, []);

  useNativeAuthKeyboardAnchor({
    surface: 'login',
    wrapSelector: '.lms-login-form-wrap',
    cardSelector: '.lms-login-page .lms-form-card',
  });

  const completeSignIn = useCallback(async (data, startedAt) => {
    clearServerNotResponding();
    try {
      window.sessionStorage.setItem('lms_recent_auth_success', String(Date.now()));
    } catch {
      // Recent-login reload protection is helpful, but storage can be unavailable.
    }
    const defaultHome = data.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard';
    const nextPath = canonicalizeForwardPathForUser(requestedPath, data.user) || data.redirectPath || defaultHome;
    preloadRouteByPath(nextPath, data.user?.role);

    const remaining = Math.max(0, 360 - (performance.now() - startedAt));
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
    if (PLATFORM.isNative) {
      await nextPaint();
      navigate(nextPath, { replace: true });
      forceNativeRoute(nextPath);
    } else {
      navigate(nextPath);
    }
  }, [navigate, requestedPath]);

  async function handleSubmit(e) {
    e.preventDefault();
    const startedAt  = performance.now();
    const fd = new FormData(e.currentTarget);
    setStatus({ loading: true, error: '', success: '' });
    try {
      if (PLATFORM.isNative && PLATFORM.isIos) {
        showNativeDocument();
      }

      // Email is normalized (trim + lowercase) so an iOS auto-capitalized or
      // autofill-padded value still matches. Password is sent verbatim (it is
      // case-sensitive and may contain intentional spaces).
      const data = await signIn({
        email: String(fd.get('email') || '').trim().toLowerCase(),
        password: String(fd.get('password') || ''),
      });
      await completeSignIn(data, startedAt);
    } catch (err) {
      if (PLATFORM.isNative && PLATFORM.isIos) {
        showNativeDocument();
      }
      setStatus({ loading: false, error: getErrorMessage(err, 'Unable to sign in'), success: '' });
    }
  }

  const handleGoogleCode = useCallback(async (response) => {
    const error = String(response?.error || '').trim();
    const code = String(response?.code || '').trim();
    if (error || !code) {
      setStatus({
        loading: false,
        error: error || 'Google did not return a sign-in code. Please try again.',
        success: '',
      });
      return;
    }

    const startedAt = performance.now();
    setStatus({ loading: true, error: '', success: '' });
    try {
      const data = await signInWithGoogleCode({
        code,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
      });
      await completeSignIn(data, startedAt);
    } catch (err) {
      setStatus({ loading: false, error: getErrorMessage(err, 'Unable to sign in with Google'), success: '' });
    }
  }, [completeSignIn, signInWithGoogleCode]);

  function handleGoogleButtonClick() {
    if (status.loading) return;

    if (googleConfigStatus.error && !googleClientId) {
      setStatus({ loading: false, error: googleConfigStatus.error, success: '' });
      return;
    }

    const client = googleCodeClientRef.current;
    if (!client) {
      setStatus({
        loading: false,
        error: 'Google sign-in is still preparing. Please try again in a moment.',
        success: '',
      });
      return;
    }

    setStatus({ loading: false, error: '', success: '' });
    try {
      client.requestCode();
    } catch (err) {
      setStatus({ loading: false, error: getErrorMessage(err, 'Google sign-in could not open'), success: '' });
    }
  }

  useEffect(() => {
    if (!authNotice?.message) return;
    if (!requestedPath) {
      consumeAuthNotice();
      return;
    }

    setStatus((current) => {
      if (current.loading) return current;
      return { loading: false, error: authNotice.message, success: '' };
    });
    consumeAuthNotice();
  }, [authNotice, consumeAuthNotice, requestedPath]);

  useEffect(() => {
    if (STATIC_GOOGLE_CLIENT_ID) return undefined;

    let cancelled = false;
    setGoogleConfigStatus({ loading: true, error: '' });
    fetchPublicSettings()
      .then((settings) => {
        if (cancelled) return;
        const runtimeGoogleClientId = String(settings?.auth?.googleClientId || '').trim();
        setGoogleClientId(runtimeGoogleClientId);
        setGoogleConfigStatus({
          loading: false,
          error: runtimeGoogleClientId ? '' : 'Google sign-in is not configured on the server yet.',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setGoogleConfigStatus({
          loading: false,
          error: getErrorMessage(err, 'Google sign-in settings could not load'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId) {
      setGoogleSdk(null);
      googleCodeClientRef.current = null;
      return undefined;
    }

    let cancelled = false;
    let idleId = 0;
    let timerId = 0;

    const startGoogleSdkLoad = () => {
      loadGoogleIdentityScript()
        .then((google) => {
          if (!cancelled) {
            setGoogleSdk(google);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setGoogleConfigStatus((current) => ({
              ...current,
              error: current.error || err.message || 'Google sign-in could not load',
            }));
          }
        });
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(startGoogleSdkLoad, { timeout: 1500 });
    } else if (typeof window !== 'undefined') {
      timerId = window.setTimeout(startGoogleSdkLoad, 250);
    } else {
      startGoogleSdkLoad();
    }

    return () => {
      cancelled = true;
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleClientId || !googleSdk?.accounts?.oauth2) {
      googleCodeClientRef.current = null;
      return undefined;
    }

    googleCodeClientRef.current = googleSdk.accounts.oauth2.initCodeClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: handleGoogleCode,
      error_callback: (err) => {
        setStatus({
          loading: false,
          error: err?.message || err?.type || 'Google sign-in popup could not open',
          success: '',
        });
      },
    });

    return () => {
      googleCodeClientRef.current = null;
    };
  }, [googleClientId, googleSdk, handleGoogleCode]);

  const feedbackId = status.error ? 'login-error' : status.success ? 'login-success' : undefined;
  const clearFeedback = () => setStatus((current) => ({ ...current, error: '', success: '' }));

  return (
    <main className={cx(ui.authRouteScene, 'lms-login-page')} style={{ display: 'flex', minHeight: '100dvh', overflowX: 'hidden', overflowY: 'auto', background: 'var(--lms-login-page-bg, var(--page-background))' }}>
      <PageMeta
        title="Sign In"
        description="Sign in to xyndrome to continue medical lessons, quizzes, results, revision notes, and subscriptions."
        path="/auth/login"
        noindex
      />

      {/* ── Left: dark brand panel (desktop only) ── */}
      <div className="hidden lg:flex flex-1 min-w-0">
        <LoginBrand/>
      </div>

      {/* ── Right: form panel ── */}
      <div
        className="lms-auth-form-panel flex w-full flex-col lg:w-[440px] lg:shrink-0 xl:w-[460px]"
        style={{ background: 'var(--lms-auth-panel-bg, var(--page-background))', borderLeft: '1px solid var(--lms-auth-panel-border, var(--line-soft))' }}
      >
        {/* Top bar: mobile logo + theme toggle */}
        <div className="lms-login-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', flexShrink: 0 }}>
          {!PLATFORM.isNative ? (
            <XyndromeBrand
              className="lms-login-mobile-brand lg:hidden"
              markSize={36}
              textClassName="!font-extrabold"
            />
          ) : null}
          <div className="hidden lg:block"/>
          {!PLATFORM.isNative ? <ThemeToggle/> : null}
        </div>

        {/* Centered form area */}
        <div className="lms-login-form-wrap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px 24px', overflowY: 'visible' }}>
          <div
            className="lms-form-card"
            style={{ width: '100%', maxWidth: 404, borderRadius: 22, border: '1px solid var(--line-soft)', padding: 'clamp(22px,3vw,32px)' }}
          >
          <form
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 13 }}
            className="lms-stagger lms-login-form"
            onSubmit={handleSubmit}
            noValidate
            aria-describedby={feedbackId}
          >
            {/* ── Heading ── */}
            <div>
              {PLATFORM.isNative ? (
                <XyndromeBrand
                  className="lms-login-inline-brand"
                  markSize={42}
                  textClassName="!font-extrabold"
                />
              ) : null}
              <h2 style={{ margin: '0 0 5px', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, lineHeight: 1.1, color: 'var(--ink-strong)' }}>
                Hey there 👋
              </h2>
              <p className="lms-form-sub" style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.62 }}>
                The mitochondria is still the powerhouse of the cell — let&apos;s review. 🔬
              </p>
            </div>

            {/* ── Feedback banners ── */}
            {status.error ? (
              <AuthFeedbackNotice id="login-error" tone="error" onDismiss={clearFeedback}>
                {status.error}
              </AuthFeedbackNotice>
            ) : null}
            {status.success ? (
              <AuthFeedbackNotice id="login-success" tone="success" onDismiss={clearFeedback}>
                {status.success}
              </AuthFeedbackNotice>
            ) : null}

            {/* ── Email ── */}
            <div className="lms-field-wrap grid gap-1.5">
              <label className={cx(ui.formLabel, 'lms-field-label')}>
                Email address
                <input
                  id="login-email"
                  className={ui.input}
                  name="email"
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={status.error ? 'true' : undefined}
                  aria-describedby={feedbackId}
                />
              </label>
            </div>

            {/* ── Password ── */}
            <div className="lms-field-wrap">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className={cx(ui.formLabel, 'lms-field-label mb-0')} htmlFor="login-password">
                  Password
                </label>
                <NavLink to="/auth/forgot-password" className="inline-flex items-center leading-none text-[12.5px] font-bold text-brand-primary no-underline hover:underline">
                  Forgot password?
                </NavLink>
              </div>
              <div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    className={cx(ui.input, 'pr-14')}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={status.error ? 'true' : undefined}
                    aria-describedby={feedbackId}
                  />
                  <button
                    type="button"
                    className="lms-login-password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                    style={{
                      position: 'absolute', top: '50%', right: 8,
                      transform: 'translateY(-50%)',
                      width: 44, height: 44, borderRadius: 10, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--ink-soft)',
                      transition: 'color 150ms ease, background 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-soft)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {showPassword ? (
                      /* Eye-off icon */
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      /* Eye icon */
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={status.loading}
              aria-busy={status.loading}
              className={cx(ui.primaryAction, 'lms-submit-btn lms-login-cta w-full rounded-[var(--radius-md)]')}
            >
              <span className="lms-login-button-label">
                {status.loading ? (
                  <>
                    <span className="lms-ios-loader" aria-hidden="true">
                      {Array.from({ length: 12 }, (_, index) => (
                        <span key={index} />
                      ))}
                    </span>
                    <span>Signing in</span>
                  </>
                ) : 'Sign in'}
              </span>
            </button>

            <div className="lms-auth-divider">or</div>

            <button
              type="button"
              className="lms-google-btn"
              disabled={status.loading}
              aria-busy={status.loading}
              onClick={handleGoogleButtonClick}
            >
              <span className="lms-google-mark" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"/>
                </svg>
              </span>
              <span>{status.loading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            {/* ── Register link ── */}
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
              New here?{' '}
              <NavLink to="/register" style={{ fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }} className="hover:underline">
                Create your account
              </NavLink>
            </p>
          </form>
          </div>
        </div>
      </div>
    </main>
  );
}
