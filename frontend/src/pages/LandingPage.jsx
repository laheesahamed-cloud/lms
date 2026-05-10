import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { siteContent } from '../content/siteContent.js';
import { useAuthStore } from '../stores/authStore.js';
import { cx } from '../styles/tailwindClasses.js';
import { isLowSpecDevice, shouldUseBalancedVisualEffects } from '../utils/performanceProfile.js';

/* ── SVG icons ── */
function IcoArrow()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoCheck()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoSteth()    { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 4a2 2 0 0 0-2 2v3a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 4h4M7 4V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IcoNotes()    { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="2" width="13" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M6 6h7M6 9.5h7M6 13h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M16 6h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IcoQuiz()     { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 9a2.5 2.5 0 1 1 3.5 2.3c-.5.2-.8.7-.8 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="11" cy="15" r=".9" fill="currentColor"/></svg>; }
function IcoChart()    { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 18V11l4-4 4 4 4-6 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 18h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IcoBrain()    { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M9 4a5 5 0 0 0-5 5c0 1.8.9 3.4 2.3 4.4L7 18h8l.7-4.6A5 5 0 1 0 9 4z" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M11 4v14M8 8l3 3M14 8l-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function IcoMoon()     { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M19 12.5A9 9 0 1 1 9.5 3a7 7 0 0 0 9.5 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IcoBookmark() { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 3h12a1 1 0 0 1 1 1v15l-7-4-7 4V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>; }
function IcoScalpel()  { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 18L14 8l4-1-1 4L7 21l-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M14 8l1-4 3 3-4 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" opacity=".7"/></svg>; }
function IcoStar()     { return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 .5l1.39 2.82 3.11.45-2.25 2.19.53 3.1L6 7.5l-2.78 1.56.53-3.1L1.5 3.77l3.11-.45z"/></svg>; }
function IcoX()        { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
function IcoChevron()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoMenu()     { return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 5h15M2.5 10h15M2.5 15h15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>; }
function IcoClose()    { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>; }
function IcoMicro()    { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M11 12v6M8 18h6M7 8a4 4 0 0 0 4 4 4 4 0 0 0 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IcoBaby()     { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 10.5c1.5 0 3 .7 3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".6"/></svg>; }
function IcoPeople()   { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" opacity=".65"/><path d="M19 19c0-2.8-1.35-5-3-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".65"/></svg>; }

/* trust pill mini icons (14px) */
function IcoSteth14()  { return <svg width="13" height="13" viewBox="0 0 22 22" fill="none"><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.6"/><path d="M5 4a2 2 0 0 0-2 2v3a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M5 4h4M7 4V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
function IcoNotes14()  { return <svg width="13" height="13" viewBox="0 0 22 22" fill="none"><rect x="3" y="2" width="13" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M6 6h7M6 9.5h7M6 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IcoQuiz14()   { return <svg width="13" height="13" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M8 9a2.5 2.5 0 1 1 3.5 2.3c-.5.2-.8.7-.8 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="11" cy="15" r=".9" fill="currentColor"/></svg>; }
function IcoChart14()  { return <svg width="13" height="13" viewBox="0 0 22 22" fill="none"><path d="M3 18V11l4-4 4 4 4-6 4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 18h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }

/* step icons — premium SVG, not emoji */
function IcoUserPlus() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/><path d="M3 21c0-4 3.1-7 7-7s7 3 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>; }
function IcoCompass()  { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>; }
function IcoTarget()   { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>; }

const lpRevealClass =
  'translate-y-0 scale-100 opacity-100 transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] [transition-delay:var(--reveal-delay,0s)] [.lp.lp-reveal-enabled.lp-motion-ready_&:not(.is-revealed)]:translate-y-3 [.lp.lp-reveal-enabled.lp-motion-ready_&:not(.is-revealed)]:scale-[0.992] [.lp.lp-reveal-enabled.lp-motion-ready_&:not(.is-revealed)]:opacity-0 [&.is-revealed]:translate-y-0 [&.is-revealed]:scale-100 [&.is-revealed]:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none';
const lpSectionHeadClass = cx(lpRevealClass, 'mx-auto mb-12 max-w-[640px] text-center max-[640px]:mb-8');
const lpSectionEyebrowClass = 'mb-3 inline-block text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-blue-400';
const lpSectionTitleClass = 'm-0 mb-3.5 text-[clamp(26px,3vw,40px)] font-black leading-tight tracking-normal text-white';
const lpSectionTextClass = 'm-0 text-[15px] leading-relaxed text-white/50';
const lpPlanGridClass = 'grid grid-cols-3 gap-4 max-[860px]:grid-cols-1';
const lpRootClass =
  'lp lp-v3 group/lp isolate overflow-x-hidden bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.12),transparent_38%),linear-gradient(180deg,#02030A_0%,#05070F_42%,#010208_100%)] text-white';
const lpShellClass = 'lp-shell mx-auto w-[min(1180px,calc(100%_-_40px))]';
const lpNavClass =
  'lp-nav fixed inset-x-0 top-0 z-[20000] border-b border-transparent bg-transparent shadow-none transition-[background,border-color,box-shadow] duration-200 [&.lp-nav--scrolled]:border-white/10 [&.lp-nav--scrolled]:bg-[#020310]/95 [&.lp-nav--scrolled]:shadow-[0_4px_22px_rgba(0,0,0,0.28)]';
const lpNavInnerClass = 'flex h-[62px] items-center gap-8 max-[640px]:gap-3';
const lpNavBrandClass = 'flex shrink-0 items-center gap-2.5 text-white no-underline';
const lpNavCrossClass = 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#2563EB,#7C3AED)] text-xl font-bold text-white';
const lpNavNameClass = '[&_strong]:block [&_strong]:text-sm [&_strong]:font-extrabold [&_small]:block [&_small]:text-[10.5px] [&_small]:text-white/50';
const lpNavLinksClass = 'flex flex-1 justify-center gap-7 max-[860px]:hidden [&_a]:text-[13.5px] [&_a]:font-medium [&_a]:text-white/60 [&_a]:no-underline [&_a]:transition-colors hover:[&_a]:text-white';
const lpNavCtaClass = 'flex shrink-0 gap-2 max-[860px]:[&_a:first-child]:hidden';
const lpNavHamburgerClass = 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-white/75 hover:bg-white/[0.12] hover:text-white transition duration-150 min-[860px]:hidden';
const lpMobileMenuClass = 'fixed inset-0 z-[19999] flex flex-col bg-[#020310]/[0.98] px-5 pt-[78px] pb-[max(32px,calc(env(safe-area-inset-bottom,0px)+20px))] backdrop-blur-xl min-[860px]:hidden overflow-y-auto';
const lpMobileNavLinkClass = 'flex cursor-pointer items-center rounded-xl px-4 py-[14px] text-[17px] font-bold text-white/70 no-underline transition-colors hover:bg-white/[0.06] hover:text-white';
const lpButtonClass =
  'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-5 py-[9px] text-[13.5px] font-bold no-underline transition-[transform,box-shadow,background-color,border-color,color,opacity,filter] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]';
const lpButtonLgClass = 'px-7 py-[13px] text-[15px]';
const lpButtonPrimaryClass = 'bg-blue-600 text-white hover:bg-blue-700';
const lpButtonGhostClass = 'border border-white/10 bg-white/[0.08] text-white/80 hover:bg-white/[0.14] hover:text-white';
const lpButtonOutlineClass = 'border border-white/20 bg-transparent text-white/80 hover:border-white/40 hover:bg-white/[0.07] hover:text-white';
const lpButtonGoldClass = 'bg-[linear-gradient(135deg,#F59E0B,#EF4444)] text-white shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_8px_28px_rgba(245,158,11,0.45)] hover:brightness-110';
const lpButtonGhostLightClass = 'border border-white/20 bg-white/10 text-white hover:bg-white/20';
const lpButtonOutlineDarkClass = 'border border-white/20 bg-transparent text-white/75 hover:bg-white/[0.06] hover:text-white';
const lpButtonBlockClass = 'w-full justify-center';
const lpHeroClass =
  'lp-hero relative overflow-hidden bg-[radial-gradient(ellipse_at_74%_18%,rgba(14,165,233,0.14),transparent_35%),radial-gradient(ellipse_at_18%_76%,rgba(16,185,129,0.08),transparent_30%),linear-gradient(180deg,#02030A_0%,#05070F_66%,#02030A_100%)] pt-[104px] pb-10 [--lp-dot-a-y:0px] [--lp-dot-b-y:0px] [--lp-dot-c-y:0px] [--lp-path-y:0px] [--lp-grid-y:0px] [--lp-orb-a-y:0px] [--lp-orb-b-y:0px] [--lp-orb-c-y:0px] [contain:layout_paint_style] max-[860px]:pt-[92px] max-[860px]:pb-10 max-[640px]:pt-[82px] max-[640px]:pb-9';
const lpHeroBgClass = 'absolute inset-0 z-0 overflow-hidden pointer-events-none [contain:paint] translate-z-0';
const lpHeroBgGridClass =
  'absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.032)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.032)_1px,transparent_1px)] bg-[length:60px_60px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black,transparent)] [transform:translate3d(0,var(--lp-grid-y),0)]';
const lpHeroOrbClass =
  'lp-hero-orb absolute rounded-full opacity-25 blur-[36px] [transform:translate3d(0,var(--lp-orb-y),0)] max-[860px]:opacity-[0.14] max-[860px]:blur-[22px] motion-reduce:!animate-none motion-reduce:!transform-none motion-reduce:!transition-none';
const lpHeroOrbAClass = 'lp-hero-orb--a right-[-100px] top-[-100px] size-[520px] bg-blue-600 [--lp-orb-y:var(--lp-orb-a-y)]';
const lpHeroOrbBClass = 'lp-hero-orb--b bottom-[-80px] left-[20%] size-[430px] bg-violet-600 [--lp-orb-y:var(--lp-orb-b-y)]';
const lpHeroOrbCClass = 'lp-hero-orb--c left-[-60px] top-[30%] size-[300px] bg-emerald-600 opacity-20 [--lp-orb-y:var(--lp-orb-c-y)] max-[860px]:opacity-[0.14]';
const lpDepthDotClass =
  'lp-depth-dot absolute size-[7px] rounded-full bg-blue-300/75 opacity-[0.34] shadow-[0_0_24px_rgba(59,130,246,0.6)] [transform:translate3d(0,var(--lp-dot-y),0)] max-[860px]:opacity-[0.18] motion-reduce:!animate-none motion-reduce:!transform-none motion-reduce:!transition-none';
const lpDepthDotAClass = 'lp-depth-dot--a left-[11%] top-[22%] [--lp-dot-y:var(--lp-dot-a-y)]';
const lpDepthDotBClass = 'lp-depth-dot--b right-[16%] top-[36%] size-[5px] bg-violet-300/70 [--lp-dot-y:var(--lp-dot-b-y)]';
const lpDepthDotCClass = 'lp-depth-dot--c bottom-[28%] left-[46%] size-1 bg-emerald-300/70 [--lp-dot-y:var(--lp-dot-c-y)]';
const lpPathMapClass =
  'lp-path-map absolute left-0 top-[47%] z-0 h-[168px] w-screen overflow-visible opacity-[0.72] [contain:paint] [transform:translate3d(0,calc(-50%+var(--lp-path-y)),0)] max-[860px]:top-[43%] max-[860px]:h-[118px] max-[860px]:opacity-45 max-[640px]:top-[38%] max-[640px]:h-[92px] max-[640px]:opacity-[0.34]';
const lpPathBaseClass = 'lp-path-base fill-none stroke-sky-200/16 stroke-[1.15] [stroke-linecap:round] [stroke-linejoin:round]';
const lpPathTraceClass =
  'lp-path-trace fill-none stroke-[#7DD3FC] stroke-[2.2] opacity-[0.86] drop-shadow-[0_0_6px_rgba(125,211,252,0.45)] [stroke-dasharray:220_1480] [stroke-dashoffset:0] [stroke-linecap:round] [stroke-linejoin:round] [.lp-motion-ready_&]:animate-lpPathTrace [body.app-booting_&]:![animation-play-state:paused] motion-reduce:![animation:none] motion-reduce:![stroke-dasharray:none] motion-reduce:![stroke-dashoffset:0] motion-reduce:!opacity-45';
const lpPathNodeClass = 'fill-[#02030A] stroke-sky-300/34 stroke-[1.2]';
const lpHeroInnerClass = 'relative z-[1] grid grid-cols-[minmax(0,0.92fr)_minmax(460px,1.08fr)] items-center gap-10 max-[1120px]:grid-cols-[minmax(0,0.96fr)_minmax(420px,1.04fr)] max-[1024px]:gap-8 max-[860px]:grid-cols-1 max-[860px]:gap-8';
const lpHeroCopyClass = cx(lpRevealClass, 'lp-hero-copy group/herocopy relative z-[1] !translate-y-0 !scale-100 !opacity-100 !transition-none before:absolute before:inset-[-28px_-18px] before:z-[-1] before:rounded-[28px] before:bg-[radial-gradient(ellipse_at_35%_45%,rgba(2,3,10,0.72),transparent_68%)] before:pointer-events-none max-[860px]:text-center');
const lpHeroStaggerBaseClass =
  'translate-y-0 opacity-100 transition-[opacity,transform] duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-[.is-revealed]/herocopy:translate-y-0 group-[.is-revealed]/herocopy:opacity-100 motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none';
const lpHeroKickerClass = cx('lp-hero-kicker mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3.5 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-blue-400 group-[.is-revealed]/herocopy:delay-[50ms]', lpHeroStaggerBaseClass);
const lpKickerDotClass = 'lp-kicker-dot size-1.5 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.16)] [.lp-motion-ready_&]:animate-pulseSoft [body.app-booting_&]:![animation-play-state:paused] motion-reduce:!animate-none motion-reduce:!transform-none motion-reduce:!transition-none';
const lpHeroTitleClass = cx('lp-hero-h1 m-0 mb-5 max-w-[620px] text-[clamp(34px,4.2vw,58px)] font-black leading-[1.07] tracking-normal text-white text-balance max-[860px]:mx-auto max-[640px]:text-[clamp(29px,8vw,42px)] group-[.is-revealed]/herocopy:delay-[140ms]', lpHeroStaggerBaseClass);
const lpHeroGradientClass = 'bg-[linear-gradient(90deg,#60A5FA,#A78BFA,#F472B6)] bg-clip-text text-transparent';
const lpHeroSubClass = cx('lp-hero-sub mb-7 max-w-[520px] text-base leading-[1.65] text-white/64 max-[860px]:mx-auto max-[640px]:text-sm group-[.is-revealed]/herocopy:delay-[230ms]', lpHeroStaggerBaseClass);
const lpHeroActionsClass = cx('lp-hero-actions mb-7 flex flex-wrap gap-3 max-[860px]:justify-center group-[.is-revealed]/herocopy:delay-[320ms]', lpHeroStaggerBaseClass);
const lpHeroTrustClass = cx('lp-hero-trust flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[860px]:flex-wrap max-[860px]:justify-center group-[.is-revealed]/herocopy:delay-[410ms]', lpHeroStaggerBaseClass);
const lpTrustPillClass = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.12] bg-white/[0.07] px-3 py-[5px] text-[11.5px] font-medium text-white/60 transition-colors duration-150 hover:border-white/20 hover:text-white/80';
const lpHeroCardsClass = cx(lpRevealClass, 'lp-hero-cards group/herocards relative z-[2] grid grid-cols-2 grid-rows-[auto_auto] gap-3 rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025)),rgba(2,6,23,0.78)] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.09)] [contain:layout_paint] max-[860px]:mx-auto max-[860px]:max-w-[560px] max-[640px]:grid-cols-1 max-[640px]:gap-3 max-[480px]:gap-2.5');
const lpPreviewCardClass =
  'lp-hcard relative isolate overflow-hidden rounded-2xl border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025)),#03050D] shadow-[0_14px_32px_rgba(2,6,23,0.2),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.18)] transition-[transform,box-shadow,border-color] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-white/[0.12] hover:shadow-[0_18px_40px_rgba(2,6,23,0.26),0_0_0_1px_rgba(96,165,250,0.10),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.22)] active:scale-[0.99] active:translate-y-0 [contain:layout_paint]';
const lpPreviewCanvasMotionClass =
  'group-[.is-revealed]/herocards:translate-y-0 [.lp-motion-ready_.lp-hero-cards.is-revealed_&]:animate-lpFloatA hover:[animation-play-state:paused] max-[860px]:!animate-none motion-reduce:!animate-none [body.app-booting_&]:![animation-play-state:paused]';
const lpPreviewQuizMotionClass =
  'group-[.is-revealed]/herocards:-translate-y-[5px] [.lp-motion-ready_.lp-hero-cards.is-revealed_&]:animate-lpFloatB hover:[animation-play-state:paused] max-[860px]:!animate-none motion-reduce:!animate-none [body.app-booting_&]:![animation-play-state:paused]';
const lpFeaturedPlanMotionClass =
  'lp-plan-card--featured [.lp-motion-ready_&]:animate-lpPlanGlow [body.app-booting_&]:![animation-play-state:paused] motion-reduce:!animate-none';
const lpPreviewHeadClass = 'relative z-[1] flex items-center gap-2 border-b border-white/[0.07] bg-black/50 px-3.5 py-2.5 max-[640px]:px-3 max-[640px]:py-2';
const lpPreviewDotsClass = 'flex gap-[5px] [&_span]:size-2 [&_span]:rounded-full [&_span:nth-child(1)]:bg-[#FF6058] [&_span:nth-child(2)]:bg-[#FFBE2E] [&_span:nth-child(3)]:bg-[#28CA41]';
const lpPreviewLabelClass = 'text-[10.5px] font-extrabold tracking-[0.04em] text-white/75 max-[640px]:text-[10px]';
const lpPreviewBodyClass = 'relative z-[1] px-3.5 py-3 text-[10.5px] leading-[1.55] max-[640px]:px-3 max-[640px]:py-[11px]';
const lpSectionClass = 'lp-section scroll-mt-[30vh] py-[76px] [content-visibility:auto] [contain-intrinsic-size:760px] max-[860px]:py-14 max-[640px]:py-11';
const lpAltSectionClass = 'bg-[linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.36)),rgba(255,255,255,0.012)]';
const lpSubjectsSectionClass = 'lp-subjects-section scroll-mt-[30vh] py-14 [content-visibility:auto] [contain-intrinsic-size:640px] max-[860px]:py-11 max-[640px]:py-9';
const lpMarqueeOuterClass = 'my-8 overflow-visible';
const lpMarqueeTrackClass = 'flex w-full flex-wrap justify-center gap-3.5';
const lpMarqueePillClass = 'flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-[18px] py-2.5 text-[13px] font-semibold text-[var(--mc)] transition hover:bg-white/[0.09]';
const lpSubjectGridClass = 'grid grid-cols-7 gap-3 max-[1024px]:grid-cols-4 max-[640px]:grid-cols-2';
const lpSubjectCardClass =
  cx(lpRevealClass, 'flex cursor-default flex-col items-center gap-2 rounded-[14px] border border-white/[0.065] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022)),#03050D] px-2.5 py-[18px] text-center text-[var(--mc)] shadow-[0_10px_22px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--mc)_24%,transparent)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))]');
const lpSubjectIconClass = 'flex size-10 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--mc)_15%,transparent)]';
const lpCardGrid3Class = 'grid grid-cols-3 gap-4 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1 max-[640px]:gap-3';
const lpFeatureBentoClass = 'grid grid-cols-3 gap-4 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1 max-[640px]:gap-3';
const lpFeatureCardClass =
  cx(lpRevealClass, 'relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.046),rgba(255,255,255,0.022)),#03050D] px-[22px] py-6 shadow-[0_12px_26px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-1.5 hover:border-[color-mix(in_srgb,var(--fc)_30%,transparent)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.038))] hover:shadow-[0_24px_56px_rgba(2,6,23,0.28)] [contain:layout_paint]');
const lpFeatureIconClass = 'mb-3 flex size-[46px] items-center justify-center rounded-xl bg-[var(--fb)] text-[var(--fc)]';
const lpFeatureTagClass = 'mb-2.5 inline-block rounded-full bg-[var(--fb)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--fc)]';
const lpHowGridClass = 'relative grid grid-cols-3 gap-5 max-[860px]:grid-cols-1 max-[860px]:gap-3.5 max-[640px]:gap-3';
const lpHowCardClass =
  cx(lpRevealClass, 'relative rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.046),rgba(255,255,255,0.022)),#03050D] px-6 pb-[26px] pt-7 text-left shadow-[0_12px_28px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-1 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))]');
const lpHowIconClass = 'mb-[18px] flex size-[50px] items-center justify-center rounded-[14px] border border-[color-mix(in_srgb,var(--hic)_30%,transparent)] bg-[color-mix(in_srgb,var(--hic)_14%,rgba(255,255,255,0.04))] text-[var(--hic)]';
const lpHowNumClass = 'mb-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/20';
const lpHowArrowClass = 'absolute -right-[17px] top-10 z-[2] text-white/20 max-[860px]:hidden';
const lpCompareWrapClass = cx(lpRevealClass, 'mx-auto grid max-w-[700px] grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-[#02030A] shadow-[0_18px_42px_rgba(0,0,0,0.3)] max-[860px]:grid-cols-1');
const lpCompareUsClass = 'bg-[linear-gradient(135deg,rgba(37,99,235,0.15),rgba(124,58,237,0.10)),#03050D]';
const lpCompareThemClass = 'bg-[#03040A]';
const lpCompareHeadUsClass = 'bg-[linear-gradient(90deg,#2563EB,#7C3AED)] px-5 py-3.5 text-[13px] font-extrabold text-white';
const lpCompareHeadThemClass = 'bg-white/[0.06] px-5 py-3.5 text-[13px] font-bold text-white/40';
const lpCompareRowClass = 'flex items-center gap-[9px] border-t border-white/[0.06] px-5 py-[9px] text-[12.5px]';
const lpTestimonialGridClass = 'grid grid-cols-3 gap-4 max-[860px]:grid-cols-1';
const lpTestimonialCardClass =
  cx(lpRevealClass, 'rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.046),rgba(255,255,255,0.022)),#03050D] p-6 shadow-[0_12px_26px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-1 hover:border-white/10 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.035))]');
const lpFaqGridClass = 'grid grid-cols-2 gap-4 max-[860px]:grid-cols-1';
const lpFaqItemClass =
  cx(lpRevealClass, 'overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.046),rgba(255,255,255,0.022)),#03050D] shadow-[0_12px_26px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-0.5 hover:border-white/10 open:border-blue-300/20 open:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))]');
const lpFaqSummaryClass = 'flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-[15px] font-bold text-white [&::-webkit-details-marker]:hidden';
const lpFaqPlusClass = 'inline-flex size-7 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.06] text-blue-300 transition duration-200 group-open:rotate-180 group-open:bg-blue-600/20 group-open:text-white';
const lpCtaSectionClass = 'lp-cta-section py-24 [content-visibility:auto] [contain-intrinsic-size:520px]';
const lpCtaBoxClass = cx(lpRevealClass, 'lp-cta-box relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(124,58,237,0.12)),linear-gradient(180deg,#050711,#010208)] px-14 py-16 text-center shadow-[0_18px_40px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] max-[860px]:px-6 max-[860px]:py-10');
const lpCtaActionsClass = 'flex flex-wrap justify-center gap-3';
const lpCtaOrbAClass = 'lp-cta-orb lp-cta-orb--a absolute -left-[60px] -top-20 size-[350px] translate-x-2 -translate-y-1.5 rounded-full bg-blue-600 opacity-25 blur-[46px] [.lp-motion-ready_&]:animate-lpCtaDriftA [body.app-booting_&]:![animation-play-state:paused] motion-reduce:hidden';
const lpCtaOrbBClass = 'lp-cta-orb lp-cta-orb--b absolute -bottom-[60px] -right-10 size-[280px] -translate-x-1.5 translate-y-1 rounded-full bg-violet-600 opacity-25 blur-[46px] [.lp-motion-ready_&]:animate-lpCtaDriftB [body.app-booting_&]:![animation-play-state:paused] motion-reduce:hidden';

const SUBJECTS = [
  { icon: <IcoSteth/>,   label: 'Medicine',            color: '#3B82F6' },
  { icon: <IcoScalpel/>, label: 'Surgery',             color: '#8B5CF6' },
  { icon: <IcoBaby/>,    label: 'OBS & GYN',           color: '#EC4899' },
  { icon: <IcoBaby/>,    label: 'Paediatrics',         color: '#06B6D4' },
  { icon: <IcoBrain/>,   label: 'Psychiatry',          color: '#F59E0B' },
  { icon: <IcoMicro/>,   label: 'Forensic Medicine',   color: '#EF4444' },
  { icon: <IcoPeople/>,  label: 'Community Medicine',  color: '#10B981' },
];

const FEATURES = [
  { icon: <IcoNotes/>,    color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', title: 'Interactive Lessons',       desc: 'Visual lesson sheets with mnemonics, callouts, and colour-coded highlights built to make knowledge stick — not just read it.',  tag: 'Lessons',    wide: true  },
  { icon: <IcoQuiz/>,     color: '#10B981', bg: 'rgba(16,185,129,0.10)', title: 'Practice & Exam Mode',          desc: 'Instant feedback in practice. Strict timing in exam mode. Every attempt tracked.',                                                    tag: 'Practice + Exam', wide: false },
  { icon: <IcoChart/>,    color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', title: 'Performance Analytics',         desc: 'Score trends, topic breakdown, and automatic weak-area detection guide your next session.',                                            tag: 'Insights',        wide: false },
  { icon: <IcoSteth/>,    color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', title: 'Structured Curriculum',         desc: 'All 7 subjects organised Course → Subject → Topic → Lesson. Navigate the full syllabus without losing context or backtracking.',       tag: 'Full Syllabus',   wide: true  },
  { icon: <IcoMoon/>,     color: '#06B6D4', bg: 'rgba(6,182,212,0.10)',  title: 'Night-Ready Dark Mode',         desc: 'Fully designed for light and dark. Study at any hour without eye strain during long revision blocks.',                                   tag: 'Zero eye strain', wide: true  },
  { icon: <IcoBookmark/>, color: '#DB2777', bg: 'rgba(219,39,119,0.10)', title: 'Personal Study Bookmarks',      desc: 'Save notes or quizzes for later. Build a revision queue around your weak spots.',                                                      tag: 'Revision queue',  wide: false },
];

const COMPARE_US  = ['Interactive Lessons','Practice + Exam Mode','Performance Analytics','4-Level Course Structure','Dark Mode','Smart Bookmarks','Weak Topic Detection'];
const COMPARE_THEM = ['No visual notes','MCQs only','No analytics','Flat subject list','No dark mode','No bookmarks','No weak tracking'];

const HOW_COLORS = ['#3B82F6', '#8B5CF6', '#10B981'];
const CURRICULUM_PATH = 'M0 92 C98 36 176 36 248 86 C314 132 390 132 468 82 C546 32 640 34 716 88 C786 138 866 132 942 76 C1018 20 1110 34 1200 92';

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Register in under a minute. No credit card needed to explore.',                                                        icon: <IcoUserPlus/> },
  { n: '02', title: 'Choose your subject', desc: 'Browse all 7 medical subjects — Medicine, Surgery, OBS&GYN, Paeds, Psychiatry, Forensics, Community Medicine.',        icon: <IcoCompass/> },
  { n: '03', title: 'Study, quiz & track', desc: 'Read illustrated notes, attempt practice quizzes, check your results, and repeat with precision.',                     icon: <IcoTarget/> },
];

const STATS = [
  { v: '7',    num: 7,   suffix: '',  l: 'Medical Subjects' },
  { v: '2',    num: 2,   suffix: '',  l: 'Quiz Modes' },
  { v: '∞',    num: null,             l: 'Practice Attempts' },
  { v: '100%', num: 100, suffix: '%', l: 'Sri Lanka focused' },
];

const FAQS = [
  {
    q: 'Who is this platform for?',
    a: 'It is built for medical students in Sri Lanka who want one place for illustrated notes, structured subjects, practice quizzes, and exam-style revision.',
  },
  {
    q: 'Do you only provide MCQs?',
    a: 'No. The platform combines interactive lessons, topic navigation, practice mode, exam mode, bookmarks, and performance analytics so revision feels complete.',
  },
  {
    q: 'Can I practice before attempting exam mode?',
    a: 'Yes. You can use practice mode for instant feedback and explanation review, then switch to exam mode when you want a stricter timed experience.',
  },
  {
    q: 'Are all the main medical subjects included?',
    a: 'Yes. The landing page is designed around the 7 core medical subjects, and the content is structured Course → Subject → Topic → Lesson for easier navigation.',
  },
  {
    q: 'Can I track weak areas and come back later?',
    a: 'Yes. Quiz attempts and review flows help you identify weaker topics, and bookmarks let you save notes or quizzes into your own revision queue.',
  },
  {
    q: 'Does it support dark mode for long study sessions?',
    a: 'Yes. The platform supports both light and dark mode, with a night-ready interface for low-glare studying.',
  },
];

/* ─── Whatsapp float ─── */
function LandingWhatsappButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined' || !siteContent.whatsappContactUrl) return null;

  return createPortal(
    <a
       className="fixed bottom-[max(16px,calc(env(safe-area-inset-bottom,0px)+12px))] right-[max(16px,calc(env(safe-area-inset-right,0px)+12px))] z-[9999] inline-grid size-[58px] place-items-center rounded-[18px] border border-white/40 bg-gradient-to-br from-[#25D366] to-[#16A34A] text-white shadow-[0_16px_34px_rgba(22,163,74,0.32),0_6px_16px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:scale-[1.04] hover:saturate-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/25"
       href={siteContent.whatsappContactUrl}
       target="_blank" rel="noreferrer" aria-label="Contact on WhatsApp">
      <svg viewBox="0 0 24 24" className="size-6 shrink-0">
        <path fill="currentColor" d="M19.05 4.94A9.9 9.9 0 0 0 12.02 2C6.55 2 2.1 6.44 2.1 11.92c0 1.75.46 3.46 1.34 4.97L2 22l5.26-1.38a9.9 9.9 0 0 0 4.75 1.21h.01c5.47 0 9.92-4.44 9.92-9.92 0-2.65-1.03-5.13-2.89-6.97Zm-7.03 15.21h-.01a8.26 8.26 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.24 8.24 0 0 1-1.27-4.37c0-4.55 3.71-8.26 8.28-8.26 2.21 0 4.28.86 5.84 2.42a8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.27-8.27 8.27Zm4.54-6.18c-.25-.13-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.25-1.48-1.39-1.73-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.76-1.84-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.06s.89 2.38 1.01 2.55c.12.16 1.74 2.66 4.21 3.73.59.25 1.05.4 1.41.51.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.29Z"/>
      </svg>
    </a>,
    document.body,
  );
}

function onLandingBootReady(callback) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    callback();
    return () => {};
  }

  let done = false;
  let timer = 0;

  const cleanup = () => {
    document.removeEventListener('lms:anim-done', run);
    if (timer) window.clearTimeout(timer);
  };

  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    callback();
  };

  // Fire immediately if boot is already done or body no longer booting.
  // Also check app-ready in case ThemeBootstrap already finished before this ran.
  if (
    window.__lmsAnimDone === true ||
    document.body.classList.contains('app-ready') ||
    !document.body.classList.contains('app-booting')
  ) {
    window.requestAnimationFrame(run);
    return cleanup;
  }

  document.addEventListener('lms:anim-done', run, { once: true });
  // Generous safety fallback — should never be needed with the dispatch fix.
  timer = window.setTimeout(run, 2800);
  return cleanup;
}

function revealLandingContent(root) {
  root.querySelectorAll('[data-reveal]').forEach((node) => {
    node.classList.add('is-revealed');
    node.querySelectorAll('[data-count]').forEach((el) => {
      if (el.dataset.countReady === 'true') return;
      el.textContent = `${el.dataset.count || el.textContent}${el.dataset.suffix || ''}`;
      el.dataset.countReady = 'true';
    });
  });
}

function canUseEnhancedLandingMotion() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isLowSpecDevice()) return false;
  if (shouldUseBalancedVisualEffects()) return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia?.('(max-width: 1180px)').matches) return false;
  if (window.matchMedia?.('(hover: none), (pointer: coarse)').matches) return false;
  return true;
}

/* ─── Main page ─── */
export function LandingPage() {
  const pageRef = useRef(null);
  const lowSpecRef = useRef(typeof window !== 'undefined' ? isLowSpecDevice() : false);
  const enhancedMotionRef = useRef(typeof window !== 'undefined' ? canUseEnhancedLandingMotion() : false);
  const showEnhancedHeroMotion = enhancedMotionRef.current;
  const user            = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const dashboardUrl    = !isAuthenticated || !user ? '/login'
    : user.role === 'admin' ? '/dashboard'
    : user.status === 'active' ? '/dashboard' : '/pending';
  const customPlanUrl = '/subscriptions?custom=1&request=1';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const root = pageRef.current;
    if (!root) {
      return;
    }

    root.querySelectorAll('.lp-hero [data-reveal]').forEach((node) => {
      node.classList.add('is-revealed');
      node.querySelectorAll('[data-count]').forEach((el) => {
        el.textContent = `${el.dataset.count || el.textContent}${el.dataset.suffix || ''}`;
        el.dataset.countReady = 'true';
      });
    });

    root.classList.add('lp-reveal-enabled');
  }, []);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;
    if (!enhancedMotionRef.current) {
      root.classList.add('lp-motion-disabled');
      return undefined;
    }

    const enableMotion = () => {
      // Set up the hero pathway trace before adding lp-motion-ready so the
      // first animation frame starts from the correct dashoffset.
      root.querySelectorAll('.lp-path-trace').forEach((path) => {
        if (typeof path.getTotalLength !== 'function') return;
        const length = Math.ceil(path.getTotalLength());
        // If SVG isn't laid out yet length will be 0; CSS has a fallback.
        if (length > 0) {
          path.style.setProperty('--lp-path-length', `${length}`);
          path.style.strokeDasharray = `${Math.max(220, length * 0.24)} ${length}`;
          path.style.strokeDashoffset = `${length}`;
        }
      });
      root.classList.add('lp-motion-ready');
    };

    const stopWaiting = onLandingBootReady(enableMotion);

    // Pause CSS animations when the tab is hidden; resume on return.
    const onVisibility = () => {
      if (!root.classList.contains('lp-motion-ready')) return;
      root.style.animationPlayState = document.hidden ? 'paused' : '';
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopWaiting();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const scrollToLandingSection = (event, sectionId) => {
    event.preventDefault();
    setMobileMenuOpen(false);

    const section = document.getElementById(sectionId);
    if (!section) return;

    const navHeight = document.querySelector('.lp-nav')?.getBoundingClientRect().height ?? 0;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const rect = section.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    const availableHeight = window.innerHeight - navHeight;
    const sectionLift = sectionId === 'features' || sectionId === 'plans' ? 84 : 0;
    const centeredTop = absoluteTop - navHeight - Math.max(24, (availableHeight - rect.height) / 2) - sectionLift;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.min(Math.max(centeredTop, 0), maxScroll);

    window.scrollTo({
      top,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  /* Content is visible by default; enhanced desktop motion gets a short reveal. */
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;

    let io = null;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const lowSpec = lowSpecRef.current;
    const enhancedMotion = enhancedMotionRef.current;

    const revealAll = () => {
      revealLandingContent(root);
    };

    const startReveal = () => {
      const nodes = Array.from(root.querySelectorAll('[data-reveal]:not(.is-revealed)'));

      if (!enhancedMotion || lowSpec || prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
        revealAll();
        return;
      }

      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add('is-revealed');
          entry.target.querySelectorAll('[data-count]').forEach((el) => {
            if (el.dataset.countReady === 'true') return;

            const target = parseInt(el.dataset.count, 10);
            const suffix = el.dataset.suffix || '';
            const start = performance.now();
            const duration = 900;
            el.dataset.countReady = 'true';

            const tick = (now) => {
              const progress = Math.min((now - start) / duration, 1);
              el.textContent = `${Math.round((1 - Math.pow(1 - progress, 3)) * target)}${suffix}`;
              if (progress < 1) window.requestAnimationFrame(tick);
            };

            window.requestAnimationFrame(tick);
          });
          io.unobserve(entry.target);
        });
      }, { threshold: 0.05, rootMargin: '220px 0px 0px 0px' });

      nodes.forEach((node) => io.observe(node));
    };

    const revealTimer = window.setTimeout(startReveal, 80);
    const forceVisibleTimer = window.setTimeout(revealAll, 900);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(forceVisibleTimer);
      io?.disconnect();
    };
  }, []);

  /* spotlight border effect on hero cards */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!enhancedMotionRef.current) return undefined;
    const container = pageRef.current?.querySelector('.lp-hero-cards');
    if (!container) return undefined;

    const onMove = (e) => {
      container.querySelectorAll('.lp-hcard').forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--sx', `${x}px`);
        card.style.setProperty('--sy', `${y}px`);
      });
    };
    const onLeave = () => {
      container.querySelectorAll('.lp-hcard').forEach((card) => {
        card.style.removeProperty('--sx');
        card.style.removeProperty('--sy');
      });
    };

    container.addEventListener('mousemove', onMove, { passive: true });
    container.addEventListener('mouseleave', onLeave, { passive: true });
    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  /* nav transparent → solid on scroll */
  useEffect(() => {
    const nav = document.querySelector('.lp-nav');
    if (!nav) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      nav.classList.toggle('lp-nav--scrolled', window.scrollY > 50);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main ref={pageRef} className={lpRootClass}>

      {/* ── STICKY NAV ── */}
      <header className={lpNavClass}>
        <div className={cx(lpShellClass, lpNavInnerClass)}>
          <Link to="/" className={lpNavBrandClass}>
            <span className={lpNavCrossClass}>+</span>
            <span className={lpNavNameClass}>
              <strong>{siteContent.siteName}</strong>
              <small>Medical Study Platform</small>
            </span>
          </Link>
          <nav className={lpNavLinksClass}>
            <a href="#subjects" onClick={(event) => scrollToLandingSection(event, 'subjects')}>Subjects</a>
            <a href="#features" onClick={(event) => scrollToLandingSection(event, 'features')}>Features</a>
            <a href="#how" onClick={(event) => scrollToLandingSection(event, 'how')}>How it works</a>
            <a href="#plans" onClick={(event) => scrollToLandingSection(event, 'plans')}>Pricing</a>
          </nav>
          <div className={lpNavCtaClass}>
            <Link to="/login" className={cx(lpButtonClass, lpButtonGhostClass)}>Sign In</Link>
            <Link to="/register" className={cx(lpButtonClass, lpButtonPrimaryClass)}>Get Started</Link>
          </div>
          <button
            className={lpNavHamburgerClass}
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="lp-mobile-menu"
          >
            {mobileMenuOpen ? <IcoClose/> : <IcoMenu/>}
          </button>
        </div>
      </header>

      {/* ── MOBILE NAV DRAWER ── */}
      {mobileMenuOpen && (
        <div id="lp-mobile-menu" className={lpMobileMenuClass} role="dialog" aria-modal="true" aria-label="Navigation menu">
          <nav className="flex flex-1 flex-col gap-1">
            {[
              ['subjects', 'Subjects'],
              ['features', 'Features'],
              ['how',      'How it works'],
              ['plans',    'Pricing'],
              ['faq',      'FAQ'],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className={lpMobileNavLinkClass}
                 onClick={(e) => scrollToLandingSection(e, id)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 border-t border-white/[0.08] pt-6">
            <Link to="/login"    className={cx(lpButtonClass, lpButtonGhostClass,   lpButtonBlockClass, 'py-3')} onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
            <Link to="/register" className={cx(lpButtonClass, lpButtonPrimaryClass, lpButtonBlockClass, 'py-3')} onClick={() => setMobileMenuOpen(false)}>Get Started — Free</Link>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section className={lpHeroClass}>
        {/* animated background */}
        <div className={lpHeroBgClass} aria-hidden="true">
          <div className={lpHeroBgGridClass}/>
          {showEnhancedHeroMotion && (
            <>
              <div className={cx(lpDepthDotClass, lpDepthDotAClass)}/>
              <div className={cx(lpDepthDotClass, lpDepthDotBClass)}/>
              <div className={cx(lpDepthDotClass, lpDepthDotCClass)}/>
            </>
          )}
          {/* Curriculum pathway trace */}
          <svg className={lpPathMapClass} viewBox="0 0 1200 150" preserveAspectRatio="none" aria-hidden="true">
            <path className={lpPathBaseClass} d={CURRICULUM_PATH}/>
            {showEnhancedHeroMotion && <path className={lpPathTraceClass} d={CURRICULUM_PATH}/>}
            {[
              [248, 86],
              [468, 82],
              [716, 88],
              [942, 76],
            ].map(([cxValue, cyValue]) => (
              <circle key={`${cxValue}-${cyValue}`} className={lpPathNodeClass} cx={cxValue} cy={cyValue} r="8" />
            ))}
          </svg>
        </div>

        <div className={cx(lpShellClass, lpHeroInnerClass)}>
          <div className={lpHeroCopyClass} data-reveal>
            <div className={lpHeroKickerClass}>
              <span className={lpKickerDotClass}/>
              Built for medical students in Sri Lanka
            </div>
            <h1 className={lpHeroTitleClass}>
              The smarter way to<br/>
              <span className={lpHeroGradientClass}>prepare for</span><br/>
              medical exams.
            </h1>
            <p className={lpHeroSubClass}>
              Interactive lessons, timed quizzes, and performance analytics — all
              structured around the 7 core medical subjects. One calm workspace for serious revision.
            </p>
            <div className={lpHeroActionsClass}>
              <Link to="/register" className={cx(lpButtonClass, lpButtonGoldClass, lpButtonLgClass)}>
                Start Studying Free <IcoArrow/>
              </Link>
              <Link to={dashboardUrl} className={cx(lpButtonClass, lpButtonOutlineClass, lpButtonLgClass)}>
                {isAuthenticated ? 'Open Dashboard' : 'Explore Platform'}
              </Link>
            </div>
            <div className={lpHeroTrustClass}>
              {[
                { label: '7 Medical Subjects',   icon: <IcoSteth14/>,  color: 'text-blue-400'   },
                { label: 'Interactive Lessons',   icon: <IcoNotes14/>,  color: 'text-violet-400' },
                { label: 'Practice & Exam Mode', icon: <IcoQuiz14/>,   color: 'text-emerald-400'},
                { label: 'Progress Analytics',   icon: <IcoChart14/>,  color: 'text-amber-400'  },
              ].map(({ label, icon, color }) => (
                <span key={label} className={lpTrustPillClass}>
                  <span className={cx('shrink-0', color)}>{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* hero cards */}
          <div className={lpHeroCardsClass} data-reveal style={{'--reveal-delay':'0.14s'}} aria-label="ERPM LMS study workspace preview">
            <div className="col-span-full flex items-center justify-between gap-3 px-1 pb-0.5 max-[640px]:col-span-1">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-sky-300">Live study workspace</div>
                <div className="mt-0.5 truncate text-[12px] font-semibold text-white/52">Lessons, quizzes, and progress in one connected dashboard</div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]" />
                <span className="size-2 rounded-full bg-sky-400/70" />
                <span className="size-2 rounded-full bg-violet-400/70" />
              </div>
            </div>
            {/* canvas preview card */}
            <div className={cx(lpPreviewCardClass, lpPreviewCanvasMotionClass, 'lp-hcard--canvas col-start-1 max-[640px]:col-start-1 [--sx:50%] [--sy:50%] before:pointer-events-none before:absolute before:inset-0 before:z-[2] before:rounded-2xl before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 before:bg-[radial-gradient(280px_circle_at_var(--sx)_var(--sy),rgba(255,255,255,0.06),transparent_70%)]')}>
              <div className={lpPreviewHeadClass}>
                <div className={lpPreviewDotsClass}><span/><span/><span/></div>
                <span className={lpPreviewLabelClass}>Lesson — Cardiology</span>
              </div>
              <div className={lpPreviewBodyClass}>
                <div className="mb-2 text-[11px] font-extrabold tracking-[0.04em] text-blue-300 max-[480px]:text-[10px]">→ MITRAL STENOSIS</div>
                <div className="mb-1.5 rounded-r-md border-l-[2.5px] border-[var(--ac)] bg-[color-mix(in_srgb,var(--ac)_8%,transparent)] px-2 py-1.5" style={{'--ac':'#3B82F6'}}>
                  <div className="mb-1 text-[10px] font-extrabold text-[var(--ac)]">1. Definition</div>
                  <div className="mb-0.5 flex gap-1.5 text-white/65 max-[480px]:text-[9.5px]"><span className="mt-1 size-1 shrink-0 rounded-full bg-[var(--ac)]"/>Narrowed MV → obstructs LA→LV inflow</div>
                  <div className="mb-0.5 flex gap-1.5 text-white/65 max-[480px]:text-[9.5px]"><span className="mt-1 size-1 shrink-0 rounded-full bg-[var(--ac)]"/>MVA &lt;1.5 cm² = Severe MS</div>
                  <div className="mt-1 rounded bg-amber-400/15 px-2 py-1 text-[9.5px] font-semibold text-amber-300">⚡ Symptoms begin when MVA &lt;2.0 cm²</div>
                </div>
                <div className="mb-1.5 rounded-r-md border-l-[2.5px] border-[var(--ac)] bg-[color-mix(in_srgb,var(--ac)_8%,transparent)] px-2 py-1.5" style={{'--ac':'#8B5CF6'}}>
                  <div className="mb-1 text-[10px] font-extrabold text-[var(--ac)]">2. Aetiology</div>
                  <div className="mb-0.5 flex gap-1.5 text-white/65 max-[480px]:text-[9.5px]"><span className="mt-1 size-1 shrink-0 rounded-full bg-[var(--ac)]"/>Rheumatic HD — 90% of cases</div>
                  <div className="mb-0.5 flex gap-1.5 text-white/65 max-[480px]:text-[9.5px]"><span className="mt-1 size-1 shrink-0 rounded-full bg-[var(--ac)]"/>Congenital, SLE, Carcinoid (rare)</div>
                  <div className="mt-1 rounded bg-violet-500/20 px-2 py-0.5 text-[9.5px] font-bold tracking-[0.05em] text-violet-300">MNEMONIC · PRESS · RHD</div>
                </div>
              </div>
            </div>

            {/* quiz preview card */}
            <div className={cx(lpPreviewCardClass, lpPreviewQuizMotionClass, 'lp-hcard--quiz col-start-2 max-[640px]:col-start-1 [--sx:50%] [--sy:50%] before:pointer-events-none before:absolute before:inset-0 before:z-[2] before:rounded-2xl before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 before:bg-[radial-gradient(280px_circle_at_var(--sx)_var(--sy),rgba(255,255,255,0.06),transparent_70%)]')}>
              <div className={lpPreviewHeadClass}>
                <div className={lpPreviewDotsClass}><span/><span/><span/></div>
                <span className={lpPreviewLabelClass}>Practice Quiz · Medicine</span>
              </div>
              <div className={lpPreviewBodyClass}>
                <div className="mb-2 text-[10.5px] font-semibold leading-normal text-white/80 max-[480px]:text-[10px]">A 45-year-old woman presents with dyspnoea and a rumbling mid-diastolic murmur at the apex. Most likely diagnosis?</div>
                {['Aortic Regurgitation','Mitral Stenosis','Tricuspid Stenosis','Pulmonary Stenosis'].map((opt, i) => (
                  <div key={i} className={cx('relative mb-1 flex items-center gap-1.5 rounded-md border border-white/[0.07] px-2 py-1 text-[10px] text-white/50 max-[480px]:text-[9.5px]', i === 1 && 'border-emerald-400/35 bg-emerald-500/10 font-semibold text-emerald-300')}>
                    <span className={cx('flex size-4 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-bold max-[480px]:size-[15px] max-[480px]:text-[8.5px]', i === 1 && 'bg-emerald-600 text-white')}>{String.fromCharCode(65+i)}</span>
                    <span>{opt}</span>
                    {i===1 && <span className="ml-auto text-[10px] text-emerald-400">✓</span>}
                  </div>
                ))}
                <div className="mt-1.5 rounded bg-blue-500/10 px-2 py-1 text-[9.5px] text-blue-300">✦ Classic MS: rumbling diastolic murmur + opening snap after S2</div>
              </div>
            </div>

            {/* analytics card */}
            <div className={cx(lpPreviewCardClass, 'lp-hcard--analytics col-span-full flex items-center gap-0 border-blue-300/10 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(124,58,237,0.10)),#02040B] p-0 max-[860px]:flex-col max-[640px]:col-span-1 max-[640px]:grid max-[640px]:grid-cols-[minmax(0,0.76fr)_minmax(0,1fr)] max-[640px]:items-stretch [--sx:50%] [--sy:50%] before:pointer-events-none before:absolute before:inset-0 before:z-[2] before:rounded-2xl before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 before:bg-[radial-gradient(280px_circle_at_var(--sx)_var(--sy),rgba(255,255,255,0.06),transparent_70%)]')}>
              <div className="min-w-[108px] shrink-0 border-r border-white/[0.07] px-[18px] py-4 max-[860px]:w-full max-[860px]:border-b max-[860px]:border-r-0 max-[640px]:flex max-[640px]:w-auto max-[640px]:flex-col max-[640px]:justify-center max-[640px]:border-b-0 max-[640px]:border-r max-[640px]:px-3 max-[640px]:py-3">
                <div className="mb-1 text-[10px] font-bold text-white/40 max-[420px]:text-[9px]">Weekly Avg</div>
                <div className="text-3xl font-black leading-none text-white max-[640px]:text-[25px] max-[420px]:text-[23px]">78<span className="text-[15px] text-white/40 max-[420px]:text-[12px]">%</span></div>
                <div className="mt-1 text-[9.5px] font-bold text-emerald-400 max-[420px]:text-[8.5px]">+6% this week</div>
              </div>
              <div className="flex-1 border-r border-white/[0.07] px-4 py-3 max-[860px]:w-full max-[860px]:border-b max-[860px]:border-r-0 max-[640px]:flex max-[640px]:w-auto max-[640px]:flex-col max-[640px]:justify-center max-[640px]:border-b-0 max-[640px]:px-3 max-[640px]:py-3">
                <div className="flex h-10 items-end gap-[5px] max-[640px]:h-9 max-[420px]:h-8 max-[420px]:gap-1">
                  {[65,72,80,75,88,78,82].map((v,i) => (
                    <div key={i} className="flex h-full flex-1 items-end">
                      <div className="min-h-1 w-full rounded-t-[3px] bg-[var(--bc)]" style={{height:`${v*0.62}%`, '--bc': i===6?'#3B82F6':'rgba(255,255,255,0.18)'}}/>
                    </div>
                  ))}
                </div>
                <div className="mt-1 text-[9px] tracking-[0.04em] text-white/20 max-[420px]:text-[8px]">M T W T F S S</div>
              </div>
              <div className="min-w-[148px] shrink-0 px-4 py-3 max-[860px]:w-full max-[640px]:col-span-2 max-[640px]:min-w-0 max-[640px]:border-t max-[640px]:border-white/[0.07] max-[640px]:px-3 max-[640px]:py-2.5">
                {[
                  { label:'Medicine', v:82, c:'#3B82F6' },
                  { label:'Surgery',  v:74, c:'#8B5CF6' },
                  { label:'OBS/GYN',  v:61, c:'#EC4899' },
                ].map(t => (
                  <div key={t.label} className="mb-2 last:mb-0 max-[420px]:mb-1.5">
                    <div className="mb-1 flex justify-between">
                      <span className="text-[9.5px] text-white/45 max-[420px]:text-[8.5px]">{t.label}</span>
                      <span className="text-[9.5px] font-bold text-white/75 max-[420px]:text-[8.5px]">{t.v}%</span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-sm bg-white/10"><div className="h-full rounded-sm bg-[var(--tc)]" style={{width:`${t.v}%`,'--tc':t.c}}/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* stats strip */}
        <div className={lpShellClass}>
          <div className={cx(lpRevealClass, 'lp-hero-stats mt-7 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-black/50 max-[860px]:grid-cols-2 max-[640px]:mt-6 max-[480px]:grid-cols-1')} data-reveal style={{'--reveal-delay':'0.22s'}}>
            {STATS.map(s => (
              <div key={s.l} className="flex flex-col items-center bg-white/[0.035] px-4 py-5 text-center">
                <strong className="text-[28px] font-black text-white max-[640px]:text-[22px]" {...(s.num !== null ? {'data-count': String(s.num), 'data-suffix': s.suffix} : {})}>{s.v}</strong>
                <span className="mt-[3px] text-xs text-white/40">{s.l}</span>
              </div>
            ))}
          </div>

          {/* scroll cue — purpose: tells user there's more below */}
          <div className="mt-7 flex justify-center max-[640px]:mt-6" aria-hidden="true">
            <a href="#subjects" onClick={(e) => scrollToLandingSection(e, 'subjects')}
               className="group flex flex-col items-center gap-1.5 text-white/20 transition-colors duration-200 hover:text-white/40">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Explore</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                   className="[animation:scrollBounce_1.8s_ease-in-out_infinite] motion-reduce:!animate-none">
                <path d="M4 6.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── SUBJECTS MARQUEE ── */}
      <section className={lpSubjectsSectionClass} id="subjects">
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>Curriculum Coverage</span>
            <h2 className={lpSectionTitleClass}>All 7 core medical subjects — in one place.</h2>
            <p className={lpSectionTextClass}>From Medicine to Community — every subject you'll face in your examinations, structured and ready.</p>
          </div>
        </div>
        <div className={lpMarqueeOuterClass} aria-hidden="true">
          <div className={lpMarqueeTrackClass}>
            {SUBJECTS.map((s, i) => (
              <div key={i} className={lpMarqueePillClass} style={{'--mc': s.color}}>
                <span className="flex shrink-0">{s.icon}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={lpShellClass}>
          <div className={lpSubjectGridClass}>
            {SUBJECTS.map((s, i) => (
              <div key={s.label} className={lpSubjectCardClass} data-reveal
                   style={{'--mc': s.color, '--reveal-delay': `${i*0.06}s`}}>
                <div className={lpSubjectIconClass}>{s.icon}</div>
                <span className="text-[11px] font-semibold leading-snug text-white/70">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={cx(lpSectionClass, lpAltSectionClass)} id="features">
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>Platform Features</span>
            <h2 className={lpSectionTitleClass}>The full study loop, not just a pile of MCQs.</h2>
            <p className={lpSectionTextClass}>Read, revise, practise, and review — inside one calm academic workspace built for medical preparation.</p>
          </div>
          <div className={lpFeatureBentoClass}>
            {FEATURES.map((f, i) => (
              <article key={f.title}
                       className={cx(lpFeatureCardClass, f.wide && 'col-span-2 max-[1024px]:col-span-1')}
                       data-reveal
                       style={{'--fc': f.color, '--fb': f.bg, '--reveal-delay': `${i*0.06}s`}}>
                <div className={lpFeatureIconClass}>{f.icon}</div>
                <span className={lpFeatureTagClass}>{f.tag}</span>
                <h3 className="m-0 mb-2 text-[15px] font-bold text-white">{f.title}</h3>
                <p className={cx('m-0 leading-relaxed text-white/50', f.wide ? 'text-[13.5px] max-w-[480px]' : 'text-[13px]')}>{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className={lpSectionClass} id="how">
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>Getting Started</span>
            <h2 className={lpSectionTitleClass}>Up and revising in three steps.</h2>
            <p className={lpSectionTextClass}>No complicated setup. Sign up and start revising your medical subjects today.</p>
          </div>
          <div className={lpHowGridClass}>
            {STEPS.map((s, i) => (
              <div key={s.n} className={lpHowCardClass} data-reveal
                   style={{'--reveal-delay': `${i*0.1}s`}}>
                <div className={lpHowIconClass} style={{'--hic': HOW_COLORS[i]}}>{s.icon}</div>
                <div className={lpHowNumClass}>{s.n}</div>
                <h3 className="m-0 mb-2 text-base font-bold text-white">{s.title}</h3>
                <p className="m-0 text-[13px] leading-relaxed text-white/50">{s.desc}</p>
                {i < STEPS.length-1 && <div className={lpHowArrowClass}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US + COMPARE ── */}
      <section className={cx(lpSectionClass, lpAltSectionClass)}>
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>Why Choose Us</span>
            <h2 className={lpSectionTitleClass}>More than just another MCQ bank.</h2>
            <p className={lpSectionTextClass}>While others give you a flat list of questions, we give you the full study experience — structured, visual, and data-driven.</p>
          </div>

          <div className={lpCompareWrapClass} data-reveal style={{'--reveal-delay':'0.1s'}}>
            <div className={lpCompareUsClass}>
              <div className={lpCompareHeadUsClass}>{siteContent.siteName}</div>
              {COMPARE_US.map(f => (
                <div key={f} className={cx(lpCompareRowClass, 'text-white/80')}>
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400"><IcoCheck/></span>{f}
                </div>
              ))}
            </div>
            <div className={lpCompareThemClass}>
              <div className={lpCompareHeadThemClass}>Basic Platforms</div>
              {COMPARE_THEM.map(f => (
                <div key={f} className={cx(lpCompareRowClass, 'text-white/30')}>
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400"><IcoX/></span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className={lpSectionClass} id="stories">
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>Student Stories</span>
            <h2 className={lpSectionTitleClass}>What medical students say.</h2>
            <p className={lpSectionTextClass}>Real feedback from students across Sri Lanka using the platform for their revision.</p>
          </div>
          <div className={lpTestimonialGridClass}>
            {siteContent.testimonials.map((t, i) => (
              <article key={t.name} className={lpTestimonialCardClass} data-reveal
                       style={{'--reveal-delay': `${i*0.08}s`}}>
                <div className="mb-3 flex gap-[3px] text-amber-500" aria-label="5 out of 5 stars">
                  {[0,1,2,3,4].map(i => <IcoStar key={i}/>)}
                </div>
                <p className="m-0 mb-[18px] text-sm italic leading-[1.65] text-white/70">"{t.quote}"</p>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2563EB,#7C3AED)] text-sm font-extrabold text-white">{t.name.charAt(0)}</div>
                  <div>
                    <strong className="block text-[13px] text-white">{t.name}</strong>
                    <small className="block text-[11px] text-white/40">{t.role}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className={cx(lpSectionClass, lpAltSectionClass)} id="faq">
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>FAQ</span>
            <h2 className={lpSectionTitleClass}>Questions students usually ask first.</h2>
            <p className={lpSectionTextClass}>Clear answers about how the platform works before you start your revision journey.</p>
          </div>

          <div className={lpFaqGridClass}>
            {FAQS.map((item, i) => (
              <details
                key={item.q}
                className={cx('group', lpFaqItemClass)}
                data-reveal
                style={{ '--reveal-delay': `${i * 0.05}s` }}
              >
                <summary className={lpFaqSummaryClass}>
                  <span>{item.q}</span>
                  <span className={lpFaqPlusClass}><IcoChevron/></span>
                </summary>
                <div className="px-[22px] pb-[22px]">
                  <p className="m-0 text-[13.5px] leading-[1.7] text-white/60">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className={cx(lpSectionClass, lpAltSectionClass)} id="plans">
        <div className={lpShellClass}>
          <div className={lpSectionHeadClass} data-reveal>
            <span className={lpSectionEyebrowClass}>Pricing</span>
            <h2 className={lpSectionTitleClass}>Transparent plans for Sri Lankan students.</h2>
            <p className={lpSectionTextClass}>No hidden fees. Choose the plan that fits your exam timeline and study intensity.</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
            {siteContent.plans.map((plan, i) => (
              <article key={plan.name}
                       className={cx(
                         lpRevealClass,
                         'relative flex flex-col gap-3.5 rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.046),rgba(255,255,255,0.022)),#03050D] p-7 shadow-[0_12px_28px_rgba(2,6,23,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-1 hover:border-white/10 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.035))]',
                         plan.accent === 'growth' && cx(lpFeaturedPlanMotionClass, 'overflow-hidden border-indigo-400/45 bg-[linear-gradient(160deg,rgba(37,99,235,0.18),rgba(124,58,237,0.12)),#02040B] shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_16px_48px_rgba(37,99,235,0.15)]')
                       )}
                       data-reveal style={{'--reveal-delay':`${i*0.08}s`}}>
                {plan.accent === 'growth' && (
                  <div className="-mx-7 -mt-7 mb-2 bg-[linear-gradient(90deg,#2563EB,#7C3AED)] px-7 py-2 text-center text-[10.5px] font-extrabold tracking-[0.07em] text-white uppercase">
                    Best Value
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-blue-400">{plan.tag}</span>
                  {plan.savings ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-emerald-300">{plan.savings}</span>
                  ) : null}
                </div>
                <h3 className="m-0 text-xl font-extrabold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-[28px] font-black text-white">{plan.price}</strong>
                  <span className="text-[13px] text-white/40">{plan.period}</span>
                </div>
                {plan.regularPrice ? (
                  <div className="text-[13px] font-semibold text-white/35">
                    Usually <span className="line-through">{plan.regularPrice}</span>
                  </div>
                ) : null}
                <p className="m-0 text-[13px] leading-relaxed text-white/50">{plan.description}</p>
                <ul className="m-0 flex flex-1 list-none flex-col gap-[9px] p-0">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-white/70">
                      <span className="mt-px shrink-0 text-emerald-400"><IcoCheck/></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                      className={cx(lpButtonClass, lpButtonBlockClass, plan.accent === 'growth' ? lpButtonGoldClass : lpButtonOutlineDarkClass)}>
                  Choose {plan.name}
                </Link>
              </article>
            ))}
          </div>
          <div className={cx(lpRevealClass, 'mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-sky-300/14 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(16,185,129,0.07)),rgba(3,5,13,0.78)] px-5 py-4 shadow-[0_12px_28px_rgba(2,6,23,0.12)] max-[640px]:grid max-[640px]:gap-3 max-[640px]:px-4')} data-reveal style={{'--reveal-delay':'0.28s'}}>
            <div className="min-w-0">
              <h3 className="m-0 text-[15px] font-extrabold text-white">Need a customized package?</h3>
              <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-white/52">Tell us what access you need and ask admin to prepare the right subscription package.</p>
            </div>
            <Link
              to={customPlanUrl}
              className={cx(lpButtonClass, lpButtonGhostLightClass, 'shrink-0 justify-center max-[640px]:w-full')}
            >
              Ask for Custom Package <IcoArrow/>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={lpCtaSectionClass}>
        <div className={lpShellClass}>
          <div className={lpCtaBoxClass} data-reveal>
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {showEnhancedHeroMotion && (
                <>
                  <span className={lpCtaOrbAClass}/><span className={lpCtaOrbBClass}/>
                </>
              )}
            </div>
            <span className="mb-3 block text-xs font-extrabold uppercase tracking-[0.1em] text-blue-400">Ready to begin?</span>
            <h2 className="m-0 mb-3.5 text-[clamp(22px,3vw,36px)] font-black tracking-normal text-white">Join the most complete medical study platform in Sri Lanka.</h2>
            <p className="mx-auto mb-8 mt-0 max-w-[560px] text-[15px] leading-[1.65] text-white/55">Interactive lessons, a full quiz engine, and performance tracking — everything you need to walk into your examination with confidence.</p>
            <div className={lpCtaActionsClass}>
              <Link to="/register" className={cx(lpButtonClass, lpButtonGoldClass, lpButtonLgClass)}>Create Free Account</Link>
              <Link to="/login" className={cx(lpButtonClass, lpButtonGhostLightClass, lpButtonLgClass)}>Sign In</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] bg-[#02030A] py-10 max-[640px]:py-8">
        <div className={lpShellClass}>
          <div className="mb-7 flex flex-wrap items-start justify-between gap-8 max-[640px]:flex-col max-[640px]:gap-6">
            <div className="max-w-[260px] max-[640px]:max-w-none">
              <Link to="/" className={cx(lpNavBrandClass, 'mb-3 inline-flex')}>
                <span className={lpNavCrossClass}>+</span>
                <span className={lpNavNameClass}>
                  <strong>{siteContent.siteName}</strong>
                  <small>Medical Study Platform</small>
                </span>
              </Link>
              <p className="m-0 text-[12.5px] leading-relaxed text-white/30">
                A focused study platform for medical students in Sri Lanka — notes, quizzes, and analytics in one place.
              </p>
            </div>
            <div className="flex gap-12 max-[480px]:gap-8">
              <div>
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/25">Platform</div>
                <ul className="m-0 flex flex-col gap-2.5 p-0 text-[13px] [&_a]:text-white/45 [&_a]:no-underline [&_a]:transition-colors hover:[&_a]:text-white/80">
                  <li><a href="#subjects" onClick={(e) => scrollToLandingSection(e, 'subjects')}>Subjects</a></li>
                  <li><a href="#features" onClick={(e) => scrollToLandingSection(e, 'features')}>Features</a></li>
                  <li><a href="#how"      onClick={(e) => scrollToLandingSection(e, 'how')}>How it works</a></li>
                  <li><a href="#plans"    onClick={(e) => scrollToLandingSection(e, 'plans')}>Pricing</a></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/25">Support</div>
                <ul className="m-0 flex flex-col gap-2.5 p-0 text-[13px] [&_a]:text-white/45 [&_a]:no-underline [&_a]:transition-colors hover:[&_a]:text-white/80">
                  <li><a href="#faq"      onClick={(e) => scrollToLandingSection(e, 'faq')}>FAQ</a></li>
                  <li><a href={siteContent.whatsappContactUrl} target="_blank" rel="noreferrer">WhatsApp</a></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/25">Legal</div>
                <ul className="m-0 flex flex-col gap-2.5 p-0 text-[13px] [&_a]:text-white/45 [&_a]:no-underline [&_a]:transition-colors hover:[&_a]:text-white/80">
                  <li><Link to="/terms">Terms</Link></li>
                  <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.05] pt-6 max-[640px]:flex-col max-[640px]:text-center">
            <p className="m-0 text-[11.5px] text-white/25">© {new Date().getFullYear()} {siteContent.siteName}. All rights reserved.</p>
            <p className="m-0 text-[11.5px] text-white/20">Built for Sri Lankan medical education.</p>
          </div>
        </div>
      </footer>

      <LandingWhatsappButton/>
    </main>
  );
}
