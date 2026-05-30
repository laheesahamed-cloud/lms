import { memo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../../shared/api/client.js';
import { ThemeToggle } from '../../../shared/layout/ThemeToggle.jsx';
import { detectPlatform } from '../../../shared/platform/detect.js';
import { useAuthStore } from '../../../shared/stores/authStore.js';
import { clearServerNotResponding } from '../../../shared/stores/serverStatusStore.js';
import { cx, ui } from '../../../shared/styles/tailwindClasses.js';
import { canonicalizeForwardPathForUser, getSafeForwardPath } from '../../../shared/utils/routeForwarding.js';

/* ── Animation keyframes ─────────────────────────────────────────────────────── */
const ANIM_CSS = `
  :root { --ease-os: cubic-bezier(0.23,1,0.32,1); }

  .lms-login-page {
    position: relative;
    isolation: isolate;
    --lms-login-page-bg: var(--page-background);
    --lms-auth-panel-bg: var(--page-background);
    --lms-auth-panel-border: var(--line-soft);
  }
  .lms-login-page > * {
    position: relative;
    z-index: 1;
  }
  .lms-login-page::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
  :root:not([data-theme='dark']) .lms-login-page {
    --lms-login-page-bg:
      linear-gradient(180deg, #EEF6FF 0%, #F8FBFF 48%, #FFFFFF 100%);
    --lms-auth-panel-bg:
      linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(244,248,255,.98) 100%);
    --lms-auth-panel-border: rgba(37,99,235,.12);
  }
  :root:not([data-theme='dark']) .lms-login-page::before {
    background:
      linear-gradient(90deg, rgba(37,99,235,.045) 1px, transparent 1px),
      linear-gradient(180deg, rgba(14,165,233,.035) 1px, transparent 1px);
    background-size: 72px 72px;
    -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,.7), transparent 72%);
    mask-image: linear-gradient(180deg, rgba(0,0,0,.7), transparent 72%);
    opacity: .65;
  }

  .lms-brand-panel {
    --lms-brand-bg: linear-gradient(148deg, #04091A 0%, #0A1230 45%, #060D22 100%);
    --lms-brand-title: #F1F5F9;
    --lms-brand-strong: rgba(226,232,240,.92);
    --lms-brand-muted: rgba(148,163,184,.88);
    --lms-brand-soft: rgba(148,163,184,.72);
    --lms-brand-card: rgba(255,255,255,.035);
    --lms-brand-card-strong: rgba(255,255,255,.055);
    --lms-brand-border: rgba(255,255,255,.10);
    --lms-brand-grid: rgba(255,255,255,.022);
    --lms-brand-monitor-grid: rgba(34,211,238,.11);
    --lms-brand-monitor-line: rgba(34,211,238,.18);
    --lms-brand-ecg-stroke: #22D3EE;
    --lms-brand-ecg-base: rgba(34,211,238,.18);
    --lms-brand-ecg-dot: rgba(34,211,238,.22);
    --lms-brand-blue-glow: rgba(37,99,235,.20);
    --lms-brand-cyan-glow: rgba(6,182,212,.13);
    --lms-brand-violet-glow: rgba(99,102,241,.08);
    --lms-brand-monitor-bg: rgba(5,12,36,.80);
    --lms-brand-monitor-label: rgba(148,163,184,.72);
    --lms-brand-logo-shadow: 0 4px 22px rgba(37,99,235,.50);
    --lms-brand-lower-art-color: #60A5FA;
    --lms-brand-lower-art-opacity: .06;
  }
  :root:not([data-theme='dark']) .lms-brand-panel {
    --lms-brand-bg: linear-gradient(145deg, #FFFFFF 0%, #EFF6FF 46%, #F4FBFF 100%);
    --lms-brand-title: #0F172A;
    --lms-brand-strong: #1D2B44;
    --lms-brand-muted: #42526D;
    --lms-brand-soft: #64758E;
    --lms-brand-card: rgba(255,255,255,.78);
    --lms-brand-card-strong: rgba(255,255,255,.86);
    --lms-brand-border: rgba(37,99,235,.13);
    --lms-brand-grid: rgba(37,99,235,.045);
    --lms-brand-monitor-grid: rgba(37,99,235,.10);
    --lms-brand-monitor-line: rgba(2,132,199,.32);
    --lms-brand-ecg-stroke: #0284C7;
    --lms-brand-ecg-base: rgba(2,132,199,.28);
    --lms-brand-ecg-dot: rgba(2,132,199,.24);
    --lms-brand-blue-glow: rgba(37,99,235,.12);
    --lms-brand-cyan-glow: rgba(14,165,233,.10);
    --lms-brand-violet-glow: rgba(124,58,237,.07);
    --lms-brand-monitor-bg: rgba(255,255,255,.86);
    --lms-brand-monitor-label: #64748B;
    --lms-brand-logo-shadow: none;
    --lms-brand-lower-art-color: #2563EB;
    --lms-brand-lower-art-opacity: .13;
  }

  @keyframes lmsUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes lmsFade  { from{opacity:0} to{opacity:1} }
  @keyframes lmsFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes lmsSlideIn { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }

  @keyframes lmsEcgDraw {
    0%  { stroke-dashoffset:760; opacity:0   }
    6%  { opacity:1                          }
    80% { stroke-dashoffset:0;  opacity:.72  }
    94% { stroke-dashoffset:0;  opacity:0    }
    100%{ stroke-dashoffset:760;opacity:0    }
  }
  @keyframes lmsMeter      { from{transform:scaleX(0)} to{transform:scaleX(1)} }
  @keyframes lmsLoginRing  { to{transform:rotate(360deg)} }
  @keyframes lmsLoginCheck { from{stroke-dashoffset:42;opacity:0} to{stroke-dashoffset:0;opacity:1} }
  @keyframes lmsOverlayIn  { from{opacity:0} to{opacity:1} }
  @keyframes lmsPortalHold { from{opacity:0;transform:scale(.985)} to{opacity:1;transform:scale(1)} }
  @keyframes lmsPortalZoom {
    0%  { opacity:1; transform:scale(1);  border-radius:12px  }
    68% { opacity:1; transform:scale(44); border-radius:999px }
    100%{ opacity:1; transform:scale(62); border-radius:999px }
  }
  @keyframes lmsPortalOut { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(.96)} }
  @keyframes lmsGlowPulse { 0%,100%{opacity:.45} 50%{opacity:.8} }
  @keyframes lmsCrossPulse{ 0%,100%{opacity:.7;filter:drop-shadow(0 0 8px rgba(34,211,238,.3))} 50%{opacity:1;filter:drop-shadow(0 0 20px rgba(34,211,238,.65))} }
  @keyframes lmsGoogleMobileIn {
    0%   { opacity:0; transform:translate3d(0,12px,0) scale(.98); }
    68%  { opacity:1; transform:translate3d(0,-2px,0) scale(1.01); }
    100% { opacity:1; transform:translate3d(0,0,0) scale(1); }
  }
  @keyframes lmsGoogleSheen {
    0%   { transform:translateX(-130%) skewX(-18deg); opacity:0; }
    26%  { opacity:.55; }
    72%  { opacity:.45; }
    100% { transform:translateX(130%) skewX(-18deg); opacity:0; }
  }

  .lms-stagger>*        { opacity:0; animation:lmsUp 400ms var(--ease-os) forwards; }
  .lms-stagger>*:nth-child(1){ animation-delay: 55ms }
  .lms-stagger>*:nth-child(2){ animation-delay:110ms }
  .lms-stagger>*:nth-child(3){ animation-delay:165ms }
  .lms-stagger>*:nth-child(4){ animation-delay:220ms }
  .lms-stagger>*:nth-child(5){ animation-delay:275ms }
  .lms-stagger>*:nth-child(6){ animation-delay:330ms }
  .lms-stagger>*:nth-child(7){ animation-delay:385ms }
  .lms-stagger>*:nth-child(8){ animation-delay:440ms }
  .lms-stagger>*:nth-child(9){ animation-delay:495ms }

  .lms-brand-stagger>*        { opacity:0; animation:lmsSlideIn 520ms var(--ease-os) forwards; }
  .lms-brand-stagger>*:nth-child(1){ animation-delay: 80ms }
  .lms-brand-stagger>*:nth-child(2){ animation-delay:160ms }
  .lms-brand-stagger>*:nth-child(3){ animation-delay:240ms }
  .lms-brand-stagger>*:nth-child(4){ animation-delay:320ms }
  .lms-brand-stagger>*:nth-child(5){ animation-delay:400ms }

  .lms-float       { animation:lmsFloat      6.5s ease-in-out infinite; }
  .lms-glow-pulse  { animation:lmsGlowPulse  4.5s ease-in-out infinite; }
  .lms-cross-pulse { animation:lmsCrossPulse   3s ease-in-out infinite; }
  .lms-meter-fill  { transform-origin:left; animation:lmsMeter 1.4s var(--ease-os) .85s both; }
  .lms-ecg         { stroke-dasharray:760; animation:lmsEcgDraw 5.5s linear infinite; }

  .lms-submit-btn {
    min-height: 48px !important;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    word-break: normal;
    -webkit-tap-highlight-color: transparent;
    transition: box-shadow 180ms var(--ease-os), filter 180ms var(--ease-os);
  }
  .lms-submit-btn::before {
    content: "";
    position: absolute;
    top: -35%;
    bottom: -35%;
    left: -55%;
    width: 46%;
    background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,.16) 30%, rgba(255,255,255,.46) 50%, rgba(255,255,255,.16) 70%, transparent 100%);
    opacity: 0;
    transform: translateX(-140%) skewX(-18deg);
    transition: opacity 180ms var(--ease-os), transform 680ms cubic-bezier(.23,1,.32,1);
    pointer-events: none;
  }
  .lms-submit-btn:not(:disabled):hover  {
    filter: saturate(1.03);
    box-shadow: 0 7px 24px rgba(37,99,235,.42), 0 1px 0 rgba(255,255,255,.16) inset !important;
  }
  .lms-submit-btn:not(:disabled):hover::before { opacity: 1; transform: translateX(430%) skewX(-18deg); }
  .lms-submit-btn:not(:disabled):active { filter: brightness(.98); }
  .lms-submit-btn > span {
    position: relative;
    z-index: 1;
    min-width: 0;
    white-space: nowrap;
    word-break: normal;
  }
  .lms-login-button-label {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
  }

  .lms-google-btn {
    position: relative;
    display: inline-flex;
    min-height: 48px;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 10px;
    overflow: hidden;
    border: 1px solid rgba(37,99,235,.16);
    border-radius: var(--radius-md);
    background:
      linear-gradient(135deg, rgba(255,255,255,.9), rgba(239,246,255,.82)),
      rgba(255,255,255,.78);
    color: #0f172a;
    cursor: pointer;
    font: inherit;
    font-size: 13.5px;
    font-weight: 850;
    letter-spacing: 0;
    box-shadow:
      0 12px 28px -22px rgba(37,99,235,.45),
      inset 0 1px 0 rgba(255,255,255,.78);
    -webkit-backdrop-filter: blur(14px) saturate(124%);
    backdrop-filter: blur(14px) saturate(124%);
    -webkit-tap-highlight-color: transparent;
    transition:
      transform 170ms var(--ease-os),
      border-color 170ms var(--ease-os),
      box-shadow 170ms var(--ease-os),
      background 170ms var(--ease-os);
  }
  .lms-google-btn::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(59,130,246,.12) 46%, transparent 100%);
    opacity: 0;
    transform: translateX(-120%);
    pointer-events: none;
    transition: opacity 180ms var(--ease-os), transform 460ms var(--ease-os);
  }
  .lms-google-btn:hover {
    border-color: rgba(37,99,235,.28);
    box-shadow:
      0 18px 34px -24px rgba(37,99,235,.62),
      inset 0 1px 0 rgba(255,255,255,.86);
    transform: translateY(-1px);
  }
  .lms-google-btn:hover::before {
    opacity: 1;
    transform: translateX(120%);
  }
  .lms-google-btn:active {
    transform: translateY(0) scale(.985);
  }
  .lms-google-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 3px;
  }
  .lms-google-mark {
    position: relative;
    z-index: 1;
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    border-radius: 999px;
    background: rgba(255,255,255,.86);
    box-shadow: 0 1px 0 rgba(15,23,42,.05);
    flex-shrink: 0;
  }
  .lms-google-btn > span:not(.lms-google-mark) {
    position: relative;
    z-index: 1;
    min-width: 0;
    white-space: nowrap;
  }
  .lms-auth-divider {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    color: var(--ink-soft);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .lms-auth-divider::before,
  .lms-auth-divider::after {
    height: 1px;
    background: var(--line-soft);
    content: "";
  }
  :root[data-theme='dark'] .lms-google-btn {
    border-color: rgba(96,165,250,.22);
    background:
      linear-gradient(135deg, rgba(15,23,42,.82), rgba(2,6,23,.76)),
      rgba(15,23,42,.74);
    color: #e2e8f0;
    box-shadow:
      0 18px 34px -26px rgba(96,165,250,.6),
      inset 0 1px 0 rgba(255,255,255,.08);
  }
  :root[data-theme='dark'] .lms-google-btn:hover {
    border-color: rgba(96,165,250,.36);
    box-shadow:
      0 22px 40px -28px rgba(96,165,250,.76),
      inset 0 1px 0 rgba(255,255,255,.1);
  }

  @media (max-width: 640px) {
    .lms-google-btn {
      min-height: 50px;
      border-radius: 16px;
      animation: lmsGoogleMobileIn 520ms var(--ease-os) 220ms both;
    }
    .lms-google-btn::after {
      content: "";
      position: absolute;
      top: -35%;
      bottom: -35%;
      left: 0;
      width: 46%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);
      transform: translateX(-130%) skewX(-18deg);
      pointer-events: none;
      animation: lmsGoogleSheen 1800ms var(--ease-os) 780ms both;
    }
    .lms-google-btn:active {
      transform: translateY(1px) scale(.975);
    }
  }

  .lms-login-overlay { animation:lmsOverlayIn 160ms var(--ease-os) both; }
  .lms-login-portal  { animation:lmsPortalHold 120ms var(--ease-os) both; transform-origin:center; }
  .lms-login-portal.is-success { animation:lmsPortalZoom 560ms cubic-bezier(.23,1,.32,1) both; }
  .lms-login-portal.is-success .lms-portal-content { animation:lmsPortalOut 150ms ease both; }
  .lms-login-ring  { animation:lmsLoginRing 780ms linear infinite; }
  .lms-login-check { stroke-dasharray:42; animation:lmsLoginCheck 260ms var(--ease-os) 90ms both; }
  .lms-tab-link    { transition:background 150ms var(--ease-os), color 150ms ease; }
  .lms-field-wrap:focus-within .lms-field-label { color:#2563eb; transition:color 180ms ease; }
  :root:not([data-theme='dark']) .lms-auth-form-panel {
    background:
      linear-gradient(180deg, rgba(255,255,255,.96), rgba(245,249,255,.98)) !important;
    color: #0f172a;
  }
  :root:not([data-theme='dark']) .lms-login-mobile-logo {
    box-shadow: none !important;
  }
  :root:not([data-theme='dark']) .lms-login-topbar {
    border-bottom: 1px solid rgba(37,99,235,.08);
    background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,0));
  }
  :root.lms-desktop-mac .lms-login-brand-logo-row {
    padding-top: 46px !important;
  }
  :root.lms-desktop-mac .lms-login-brand-plus {
    top: 46px !important;
  }
  :root.lms-desktop-mac .lms-login-topbar {
    padding-top: 38px !important;
  }

  /* ── Right panel: input contrast ── */
  :root:not([data-theme='dark']) .lms-login-form .lms-field-label {
    color: #1e293b !important;
  }
  :root:not([data-theme='dark']) .lms-login-form input {
    border-color: rgba(37,99,235,.18) !important;
    background:
      linear-gradient(180deg, #FBFCFF 0%, #F8FBFF 100%) !important;
    color: #0B1220 !important;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.92),
      0 1px 0 rgba(15,23,42,.025) !important;
  }
  :root:not([data-theme='dark']) .lms-login-form input::placeholder {
    color: #94A3B8 !important;
  }
  :root[data-theme='dark'] .lms-login-form input {
    border-color: rgba(148,163,184,.32) !important;
    background: rgba(2,5,12,.97) !important;
    color: #E2E8F0 !important;
  }
  .lms-login-form input:focus {
    border-color: #2563EB !important;
    box-shadow:
      0 0 0 4px rgba(37,99,235,.14),
      0 12px 24px -22px rgba(37,99,235,.72) !important;
    outline: none !important;
  }
  :root[data-theme='dark'] .lms-login-form input:focus {
    border-color: #3B82F6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,.24) !important;
  }
  /* ── CTA button: vibrant blue gradient ── */
  .lms-login-cta {
    background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%) !important;
    box-shadow: 0 4px 18px rgba(37,99,235,.45), 0 1px 0 rgba(255,255,255,.14) inset !important;
    border-color: transparent !important;
    color: #fff !important;
    font-weight: 800 !important;
    letter-spacing: .01em !important;
  }
  .lms-login-cta:not(:disabled):hover {
    background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%) !important;
  }
  :root[data-theme='dark'] .lms-login-cta {
    background: linear-gradient(135deg, #2563EB 0%, #3B82F6 55%, #60A5FA 100%) !important;
    box-shadow: 0 4px 22px rgba(59,130,246,.50), 0 1px 0 rgba(255,255,255,.10) inset !important;
  }
  /* ── Form heading: stronger text contrast ── */
  :root:not([data-theme='dark']) .lms-login-form h2 { color: #0B1220 !important; }
  :root:not([data-theme='dark']) .lms-login-form .lms-form-sub { color: #42526D !important; }
  :root:not([data-theme='dark']) .lms-auth-divider {
    color: #64748B;
  }
  :root:not([data-theme='dark']) .lms-auth-divider::before,
  :root:not([data-theme='dark']) .lms-auth-divider::after {
    background: rgba(37,99,235,.14);
  }
  :root:not([data-theme='dark']) .lms-google-btn {
    border-color: rgba(37,99,235,.18);
    background:
      linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,251,255,.94)),
      #FFFFFF;
    color: #0B1220;
    box-shadow:
      0 16px 34px -28px rgba(37,99,235,.58),
      0 1px 0 rgba(255,255,255,.95) inset,
      0 0 0 1px rgba(255,255,255,.72) inset;
  }
  :root:not([data-theme='dark']) .lms-google-btn:hover {
    border-color: rgba(37,99,235,.28);
    background:
      linear-gradient(180deg, #FBFCFF, #F1F7FF);
  }
  :root[data-theme='dark'] .lms-login-form h2 { color: #F1F5F9 !important; }
  /* ── Right panel form card elevation ── */
  :root:not([data-theme='dark']) .lms-form-card {
    background:
      linear-gradient(180deg, rgba(255,255,255,.98), rgba(250,253,255,.96)) !important;
    border-color: rgba(37,99,235,.14) !important;
    box-shadow:
      0 24px 70px -42px rgba(30,64,175,.38),
      0 12px 30px -26px rgba(15,23,42,.28),
      inset 0 1px 0 rgba(255,255,255,.96) !important;
    animation: none !important;
  }
  :root[data-theme='dark'] .lms-form-card {
    background: rgba(4,7,14,.98) !important;
    border-color: rgba(148,163,184,.15) !important;
    box-shadow: 0 8px 40px rgba(0,0,0,.52), 0 1px 0 rgba(255,255,255,.06) inset !important;
  }

  /* ── ECG monitor band animations ── */
  @keyframes lmsEcgDrawFull {
    0%   { stroke-dashoffset: 1420; opacity: 0;   }
    5%   { opacity: 1;                             }
    76%  { stroke-dashoffset: 0;    opacity: .90;  }
    91%  { stroke-dashoffset: 0;    opacity: 0;    }
    100% { stroke-dashoffset: 1420; opacity: 0;    }
  }
  @keyframes lmsEcgDotPulse {
    0%, 100% { opacity: .60; }
    50%       { opacity: 1;   }
  }
  @keyframes lmsCardBreath {
    0%, 100% { transform: scale(1);       }
    50%       { transform: scale(1.0032);  }
  }

  .lms-ecg-full { stroke-dasharray: 1420; animation: lmsEcgDrawFull 6.5s linear infinite; }
  .lms-ecg-dot  { animation: lmsEcgDotPulse  1.8s ease-in-out infinite; }
  :root:not([data-theme='dark']) .lms-ecg-full {
    filter: drop-shadow(0 0 3px rgba(2,132,199,.30));
  }
  .lms-form-card { animation: lmsCardBreath   5s   ease-in-out infinite; }

  @media (prefers-reduced-motion:reduce) {
    .lms-float,.lms-glow-pulse,.lms-ecg,.lms-ecg-full,.lms-ecg-dot,.lms-login-ring,.lms-google-btn,.lms-google-btn::after { animation:none!important; }
    .lms-stagger>*,.lms-brand-stagger>*,.lms-login-overlay,.lms-login-portal {
      animation:lmsFade 200ms ease forwards!important; animation-delay:0ms!important;
    }
    .lms-meter-fill { animation:none!important; transform:scaleX(1)!important; }
    .lms-form-card  { animation:none!important; transform:none!important; }
    .lms-submit-btn::before { opacity:0!important; transform:none!important; transition:none!important; }
  }
`;

/* ── Medical vitals illustration card ───────────────────────────────────────── */
function MedVitalsCard() {
  return (
    <div style={{
      borderRadius: 14, border: '1px solid rgba(255,255,255,.11)',
      background: 'rgba(255,255,255,.055)',
      padding: '12px 14px',
      display: 'flex', gap: 13, alignItems: 'center',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      maxWidth: 360,
    }}>
      {/* Heart + ECG icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(251,113,133,.16), rgba(34,211,238,.14))',
        border: '1px solid rgba(251,113,133,.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 20.5C12 20.5 3 15.5 3 9C3 6.2 5.2 4 8 4C9.7 4 11 5 12 6.3C13 5 14.3 4 16 4C18.8 4 21 6.2 21 9C21 15.5 12 20.5 12 20.5Z"
            stroke="#FB7185" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(251,113,133,.12)"/>
        </svg>
      </div>
      {/* Vitals data */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,.65)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 7 }}>
          Patient Vitals
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'HR', value: '72', unit: 'bpm', color: '#FB7185' },
            { label: 'SpO₂', value: '98', unit: '%', color: '#34D399' },
            { label: 'BP', value: '120/80', unit: '', color: '#60A5FA' },
          ].map(({ label, value, unit, color }) => (
            <div key={label}>
              <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,.56)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.1 }}>
                {value}
                {unit && <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(148,163,184,.6)', marginLeft: 1 }}>{unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Mini waveform */}
      <svg width="58" height="28" viewBox="0 0 58 28" fill="none" style={{ flexShrink: 0, opacity: .72 }} aria-hidden="true">
        <path d="M0,14 L7,14 L9,10 L12,18 L13,3 L16,27 L18,14 L27,14 L29,11 L31,14 L44,14 L46,10 L49,18 L50,3 L53,27 L55,14 L58,14"
          stroke="#22D3EE" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
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
          <span style={{ fontSize:8.5, fontWeight:800, color:'var(--lms-brand-monitor-label)', letterSpacing:'.1em', textTransform:'uppercase' }}>Clinical progress</span>
        </div>

        {/* Annotation card — Heart Rate */}
        <div style={{
          position:'absolute', top:10, left:'10%',
          background:'var(--lms-brand-card-strong)', border:'1px solid rgba(34,211,238,.18)',
          borderRadius:10, padding:'7px 13px',
          backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
          zIndex:3, boxShadow:'0 0 0 1px rgba(34,211,238,.08), 0 10px 26px rgba(15,23,42,.12)',
        }}>
          <div style={{ fontSize:8.5, fontWeight:800, color:'var(--lms-brand-soft)', letterSpacing:'.11em', textTransform:'uppercase' }}>Heart Rate</div>
          <div style={{ fontSize:20, fontWeight:900, color:'#22D3EE', lineHeight:1.1, marginTop:2 }}>
            72<span style={{ fontSize:10, fontWeight:600, color:'var(--lms-brand-soft)', marginLeft:2 }}>bpm</span>
          </div>
          <div style={{ fontSize:8.5, fontWeight:700, color:'#34D399', marginTop:3 }}>Normal sinus</div>
        </div>

        {/* Annotation card — SpO₂ */}
        <div style={{
          position:'absolute', top:10, right:'10%',
          background:'var(--lms-brand-card-strong)', border:'1px solid rgba(96,165,250,.18)',
          borderRadius:10, padding:'7px 13px',
          backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
          zIndex:3, boxShadow:'0 0 0 1px rgba(96,165,250,.07), 0 10px 26px rgba(15,23,42,.12)',
        }}>
          <div style={{ fontSize:8.5, fontWeight:800, color:'var(--lms-brand-soft)', letterSpacing:'.11em', textTransform:'uppercase' }}>SpO₂</div>
          <div style={{ fontSize:20, fontWeight:900, color:'#60A5FA', lineHeight:1.1, marginTop:2 }}>
            98<span style={{ fontSize:10, fontWeight:600, color:'var(--lms-brand-soft)', marginLeft:2 }}>%</span>
          </div>
          <div style={{ fontSize:8.5, fontWeight:700, color:'#34D399', marginTop:3 }}>Oxygen sat.</div>
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
      <div className="lms-login-brand-logo-row" style={{ padding: '28px 36px 0', display: 'flex', alignItems: 'center', gap: 13, flexShrink: 0 }}>
        <div style={{ flexShrink: 0, boxShadow: 'var(--lms-brand-logo-shadow)', borderRadius: 13 }}>
          <svg width="42" height="42" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <rect width="30" height="30" rx="9" fill="url(#bp-logo-g)"/>
            <path d="M9 10.5h12M9 15h8M9 19.5h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="bp-logo-g" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB"/>
                <stop offset="100%" stopColor="#0EA5E9"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lms-brand-title)', lineHeight: 1.25 }}>xyndrome</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--lms-brand-soft)' }}>Medical Workspace</div>
        </div>
      </div>

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
          Your medical study<br/>
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
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--lms-brand-soft)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>{label}</div>
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

/* ── Login motion overlay ─────────────────────────────────────────────────────── */
function LoginMotionOverlay({ phase = 'loading', rect = null }) {
  if (!rect) return null;
  return (
    <div className="lms-login-overlay fixed inset-0 z-[1000] bg-transparent" role="status" aria-live="polite">
      <div
        className={cx('lms-login-portal fixed grid place-items-center overflow-hidden text-white', phase === 'success' && 'is-success')}
        style={{
          left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          borderRadius: Math.max(12, rect.height / 2),
          background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
          boxShadow: '0 8px 32px rgba(37,99,235,.42)',
        }}
      >
        <span className="lms-portal-content inline-flex items-center gap-2 whitespace-nowrap px-4 text-sm font-black">
          {phase === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path className="lms-login-check" d="M4 9.2L7.2 12.3L14 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span
              className="lms-login-ring"
              style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', flexShrink: 0 }}
              aria-hidden="true"
            />
          )}
          {phase === 'success' ? 'Opening workspace' : 'Signing in...'}
        </span>
      </div>
    </div>
  );
}

const PLATFORM = detectPlatform();

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

/* ── Login page ──────────────────────────────────────────────────────────────── */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn   = useAuthStore((s) => s.signIn);

  const [status,       setStatus]       = useState({ loading: false, error: '', success: '' });
  const [showPassword, setShowPassword] = useState(false);
  const fromParam = new URLSearchParams(location.search).get('from') || '';
  const requestedPath = getSafeForwardPath(fromParam);

  async function handleSubmit(e) {
    e.preventDefault();
    const startedAt  = performance.now();
    const fd = new FormData(e.currentTarget);
    setStatus({ loading: true, error: '', success: '' });
    try {
      if (PLATFORM.isNative && PLATFORM.isIos) {
        showNativeDocument();
      }

      const data = await signIn({ email: String(fd.get('email') || ''), password: String(fd.get('password') || '') });
      clearServerNotResponding();
      try {
        window.sessionStorage.setItem('lms_recent_auth_success', String(Date.now()));
      } catch {
        // Recent-login reload protection is helpful, but storage can be unavailable.
      }
      const defaultHome = data.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard';
      const nextPath = canonicalizeForwardPathForUser(requestedPath, data.user) || data.redirectPath || defaultHome;

      const remaining = Math.max(0, 360 - (performance.now() - startedAt));
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
      if (PLATFORM.isNative) {
        await nextPaint();
        navigate(nextPath);
      } else {
        navigate(nextPath);
      }
    } catch (err) {
      if (PLATFORM.isNative && PLATFORM.isIos) {
        showNativeDocument();
      }
      setStatus({ loading: false, error: getErrorMessage(err, 'Unable to sign in'), success: '' });
    }
  }

  return (
    <main className={cx(ui.authRouteScene, 'lms-login-page')} style={{ display: 'flex', minHeight: '100dvh', overflowX: 'hidden', overflowY: 'auto', background: 'var(--lms-login-page-bg, var(--page-background))' }}>
      <style>{ANIM_CSS}</style>

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
          <div className="flex items-center gap-2.5 lg:hidden">
            <svg className="lms-login-mobile-logo" width="32" height="32" viewBox="0 0 30 30" fill="none" aria-hidden="true" style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(37,99,235,.30)', flexShrink: 0 }}>
              <rect width="30" height="30" rx="9" fill="url(#mb-logo-g)"/>
              <path d="M9 10.5h12M9 15h8M9 19.5h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="mb-logo-g" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB"/>
                  <stop offset="100%" stopColor="#0EA5E9"/>
                </linearGradient>
              </defs>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-strong)' }}>xyndrome</span>
          </div>
          <div className="hidden lg:block"/>
          <ThemeToggle/>
        </div>

        {/* Centered form area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px 24px', overflowY: 'auto' }}>
          <div
            className="lms-form-card"
            style={{ width: '100%', maxWidth: 404, borderRadius: 22, border: '1px solid var(--line-soft)', padding: 'clamp(28px,3.5vw,36px)' }}
          >
          <form
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}
            className="lms-stagger lms-login-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* ── Heading ── */}
            <div>
              <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '.13em' }}>
                Secure sign in
              </p>
              <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, lineHeight: 1.1, color: 'var(--ink-strong)' }}>
                Welcome back
              </h2>
              <p className="lms-form-sub" style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.62 }}>
                Enter your details to continue where you left off.
              </p>
            </div>

            <button
              type="button"
              className="lms-google-btn"
              aria-label="Continue with Google"
              onClick={() => setStatus({ loading: false, error: '', success: 'Google sign-in will be connected later.' })}
            >
              <span className="lms-google-mark" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" focusable="false">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.85 0-5.27-1.93-6.14-4.52H2.18v2.84C4 20.56 7.73 23 12 23z" />
                  <path fill="#FBBC05" d="M5.86 14.11A6.63 6.63 0 015.5 12c0-.73.13-1.44.36-2.11V7.05H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.95l3.68-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.45 2.07 14.97 1 12 1 7.73 1 4 3.44 2.18 7.05l3.68 2.84C6.73 7.31 9.15 5.38 12 5.38z" />
                </svg>
              </span>
              <span>Continue with Google</span>
            </button>

            <div className="lms-auth-divider" aria-hidden="true">
              <span>or</span>
            </div>

            {/* ── Feedback banners ── */}
            {status.error   && <div className={ui.feedbackError}>{status.error}</div>}
            {status.success && <div className={ui.feedbackSuccess}>{status.success}</div>}

            {/* ── Email ── */}
            <div className="lms-field-wrap grid gap-1.5">
              <label className={cx(ui.formLabel, 'lms-field-label')}>
                Email address
                <input
                  className={ui.input}
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </label>
            </div>

            {/* ── Password ── */}
            <div className="lms-field-wrap">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className={cx(ui.formLabel, 'lms-field-label mb-0')} htmlFor="login-password">
                  Password
                </label>
                <NavLink to="/auth/forgot-password" className="text-[12.5px] font-bold text-brand-primary no-underline hover:underline">
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
                  />
                  <button
                    type="button"
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
              className={cx(ui.primaryAction, 'lms-submit-btn lms-login-cta w-full rounded-[var(--radius-md)]')}
            >
              <span className="lms-login-button-label">
                {status.loading ? 'Signing in...' : 'Sign in'}
              </span>
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
