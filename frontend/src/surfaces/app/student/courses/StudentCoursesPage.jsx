import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentCourses } from '../../../../shared/api/courses.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

// ─── Per-subject config: gradient + rich SVG watermark illustration ──────────

const subjectConfig = {
  anatomy: {
    cls: 'subject-anatomy',
    accent: 'rgba(225,29,72,0.72)',
    /* Skeleton silhouette: skull, ribcage, spine, pelvis */
    watermark: (
      <svg viewBox="0 0 120 140" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Skull */}
        <ellipse cx="60" cy="20" rx="14" ry="16" stroke="white" strokeWidth="1.2" fill="none" opacity=".55"/>
        <ellipse cx="60" cy="24" rx="8" ry="6" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
        <line x1="52" y1="28" x2="68" y2="28" stroke="white" strokeWidth="1" opacity=".3"/>
        {/* Spine */}
        <line x1="60" y1="36" x2="60" y2="110" stroke="white" strokeWidth="1.4" strokeDasharray="3 2" opacity=".45"/>
        {/* Collar/clavicle */}
        <path d="M38 44 Q60 40 82 44" stroke="white" strokeWidth="1.2" fill="none" opacity=".5"/>
        {/* Ribcage */}
        {[50, 58, 66, 74, 82].map((y, i) => (
          <g key={y}>
            <path d={`M60 ${y} Q${38 - i} ${y + 5} ${36 - i} ${y + 12}`} stroke="white" strokeWidth="1" fill="none" opacity={0.48 - i * 0.04}/>
            <path d={`M60 ${y} Q${82 + i} ${y + 5} ${84 + i} ${y + 12}`} stroke="white" strokeWidth="1" fill="none" opacity={0.48 - i * 0.04}/>
          </g>
        ))}
        {/* Pelvis */}
        <path d="M44 106 Q60 114 76 106 Q80 96 76 90 Q60 94 44 90 Q40 96 44 106Z" stroke="white" strokeWidth="1.1" fill="none" opacity=".42"/>
        {/* Hip joints */}
        <circle cx="44" cy="108" r="5" stroke="white" strokeWidth="1" fill="none" opacity=".38"/>
        <circle cx="76" cy="108" r="5" stroke="white" strokeWidth="1" fill="none" opacity=".38"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <ellipse cx="11" cy="6" rx="5" ry="5.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <line x1="11" y1="11.5" x2="11" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2.5 1.8"/>
        <path d="M5 14 Q2 17 3 20M17 14 Q20 17 19 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },

  physiology: {
    cls: 'subject-physiology',
    accent: 'rgba(37,99,235,0.72)',
    /* ECG heartbeat wave */
    watermark: (
      <svg viewBox="0 0 140 80" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Main ECG line */}
        <path d="M0,40 L20,40 L25,38 L30,42 L33,14 L39,66 L43,40 L58,40 L63,36 L68,40 L100,40 L105,38 L110,42 L113,14 L119,66 L123,40 L138,40 L143,40"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".55"/>
        {/* Secondary faint line below */}
        <path d="M0,55 L20,55 L24,53 L28,57 L31,38 L36,72 L40,55 L55,55 L59,52 L63,55 L100,55"
              stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity=".22"/>
        {/* Heart symbol */}
        <path d="M116,24 C116,24 108,19 108,14 C108,11 110,9 112.5,9 C113.8,9 115,9.8 116,11 C117,9.8 118.2,9 119.5,9 C122,9 124,11 124,14 C124,19 116,24 116,24Z"
              stroke="white" strokeWidth="1.2" fill="none" opacity=".45"/>
        {/* Pulse nodes */}
        <circle cx="33" cy="14" r="2.5" fill="white" opacity=".5"/>
        <circle cx="113" cy="14" r="2.5" fill="white" opacity=".5"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M1 11h4l3-6 4 12 3-8 4 4h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },

  biochemistry: {
    cls: 'subject-biochem',
    accent: 'rgba(217,119,6,0.72)',
    /* Molecular structure: benzene ring + chains */
    watermark: (
      <svg viewBox="0 0 130 130" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Central benzene ring */}
        <polygon points="65,30 85,42 85,66 65,78 45,66 45,42" stroke="white" strokeWidth="1.3" fill="none" opacity=".55"/>
        {/* Inner dashed ring */}
        <circle cx="65" cy="54" r="14" stroke="white" strokeWidth="0.9" strokeDasharray="3 2" fill="none" opacity=".3"/>
        {/* Bond lines extending outward */}
        <line x1="65" y1="30" x2="65" y2="14"  stroke="white" strokeWidth="1.2" opacity=".42"/>
        <line x1="85" y1="42" x2="99" y2="34"   stroke="white" strokeWidth="1.2" opacity=".42"/>
        <line x1="85" y1="66" x2="99" y2="74"   stroke="white" strokeWidth="1.2" opacity=".42"/>
        <line x1="65" y1="78" x2="65" y2="94"   stroke="white" strokeWidth="1.2" opacity=".42"/>
        <line x1="45" y1="66" x2="31" y2="74"   stroke="white" strokeWidth="1.2" opacity=".42"/>
        <line x1="45" y1="42" x2="31" y2="34"   stroke="white" strokeWidth="1.2" opacity=".42"/>
        {/* Atom nodes */}
        {[[65,14],[99,34],[99,74],[65,94],[31,74],[31,34]].map(([x,y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" stroke="white" strokeWidth="1" fill="none" opacity=".48"/>
        ))}
        {/* Extra chains */}
        <line x1="65" y1="14" x2="78" y2="5"    stroke="white" strokeWidth="1" opacity=".28"/>
        <line x1="99" y1="34" x2="112" y2="30"  stroke="white" strokeWidth="1" opacity=".28"/>
        <line x1="99" y1="74" x2="112" y2="80"  stroke="white" strokeWidth="1" opacity=".28"/>
        <line x1="65" y1="94" x2="78" y2="105"  stroke="white" strokeWidth="1" opacity=".28"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M8 3v7l-5 6h18l-5-6V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M8 3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8"  cy="14" r="1.2" fill="currentColor" opacity="0.7"/>
        <circle cx="14" cy="14" r="1.2" fill="currentColor" opacity="0.7"/>
      </svg>
    ),
  },

  pathology: {
    cls: 'subject-pathology',
    accent: 'rgba(124,58,237,0.72)',
    /* Microscope + cell clusters */
    watermark: (
      <svg viewBox="0 0 120 140" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Microscope body */}
        <rect x="48" y="20" width="18" height="34" rx="4" stroke="white" strokeWidth="1.3" fill="none" opacity=".52"/>
        {/* Eyepiece */}
        <rect x="53" y="12" width="8" height="12" rx="2" stroke="white" strokeWidth="1.2" fill="none" opacity=".48"/>
        <line x1="57" y1="12" x2="57" y2="9"   stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity=".52"/>
        {/* Arm */}
        <path d="M57 54 Q57 68 62 68 L74 68" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".48"/>
        {/* Stage */}
        <rect x="38" y="68" width="38" height="6" rx="2" stroke="white" strokeWidth="1.2" fill="none" opacity=".45"/>
        {/* Base */}
        <path d="M42 74 L38 90 L76 90 L72 74" stroke="white" strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity=".42"/>
        {/* Cell clusters in view */}
        <circle cx="95" cy="30" r="10" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
        <circle cx="95" cy="30" r="5"  stroke="white" strokeWidth="0.8" fill="none" opacity=".28"/>
        <circle cx="88" cy="24" r="5"  stroke="white" strokeWidth="0.8" fill="none" opacity=".28"/>
        <circle cx="102" cy="24" r="5" stroke="white" strokeWidth="0.8" fill="none" opacity=".28"/>
        <circle cx="88" cy="36" r="5"  stroke="white" strokeWidth="0.8" fill="none" opacity=".25"/>
        <circle cx="102" cy="36" r="5" stroke="white" strokeWidth="0.8" fill="none" opacity=".25"/>
        {/* Connecting lines to microscope eye */}
        <line x1="57" y1="9" x2="80" y2="22"  stroke="white" strokeWidth="0.8" strokeDasharray="2 2" opacity=".25"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <path d="M15 15L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" fill="none"/>
      </svg>
    ),
  },

  pharmacology: {
    cls: 'subject-pharma',
    accent: 'rgba(37,99,235,0.72)',
    /* Pill capsule + molecular bonds */
    watermark: (
      <svg viewBox="0 0 140 100" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Large pill */}
        <rect x="20" y="36" width="60" height="28" rx="14" stroke="white" strokeWidth="1.4" fill="none" opacity=".52"/>
        <line x1="50" y1="36" x2="50" y2="64" stroke="white" strokeWidth="1.2" opacity=".4"/>
        {/* Pill highlight */}
        <path d="M22 48 Q30 38 50 38" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity=".32"/>
        {/* Small pill at angle */}
        <rect x="88" y="18" width="36" height="16" rx="8" stroke="white" strokeWidth="1.2" fill="none" opacity=".4"
              transform="rotate(-22 106 26)"/>
        {/* Molecular bonds */}
        <circle cx="108" cy="70" r="5"  stroke="white" strokeWidth="1" fill="none" opacity=".42"/>
        <circle cx="122" cy="62" r="4"  stroke="white" strokeWidth="1" fill="none" opacity=".38"/>
        <circle cx="122" cy="78" r="4"  stroke="white" strokeWidth="1" fill="none" opacity=".38"/>
        <circle cx="94"  cy="62" r="4"  stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
        <circle cx="94"  cy="78" r="4"  stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
        <line x1="108" y1="65" x2="122" y2="62"  stroke="white" strokeWidth="0.9" opacity=".32"/>
        <line x1="108" y1="65" x2="94"  y2="62"  stroke="white" strokeWidth="0.9" opacity=".32"/>
        <line x1="108" y1="75" x2="122" y2="78"  stroke="white" strokeWidth="0.9" opacity=".32"/>
        <line x1="108" y1="75" x2="94"  y2="78"  stroke="white" strokeWidth="0.9" opacity=".32"/>
        {/* Cross symbol */}
        <path d="M130 82 L130 94M124 88 L136 88" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity=".45"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="8" width="16" height="9" rx="4.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <line x1="11" y1="8" x2="11" y2="17" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5h6M9 3h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },

  microbiology: {
    cls: 'subject-micro',
    accent: 'rgba(14,165,233,0.72)',
    /* Petri dish + bacteria + DNA spiral */
    watermark: (
      <svg viewBox="0 0 130 130" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Petri dish outer */}
        <circle cx="55" cy="65" r="42" stroke="white" strokeWidth="1.3" fill="none" opacity=".4"/>
        {/* Petri dish inner */}
        <circle cx="55" cy="65" r="36" stroke="white" strokeWidth="0.9" fill="none" opacity=".25"/>
        {/* Bacteria colonies */}
        {[
          [55,65,7],[45,52,5],[65,52,5],[42,70,4],[68,70,4],
          [52,80,4],[62,80,4],[55,56,3],[48,62,3],[62,62,3],
        ].map(([x,y,r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} stroke="white" strokeWidth="0.9" fill="none" opacity=".36"/>
        ))}
        {/* DNA double helix - right side */}
        <path d="M100 10 C100 10 116 20 116 35 C116 50 100 60 100 60"  stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".48"/>
        <path d="M116 10 C116 10 100 20 100 35 C100 50 116 60 116 60" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".48"/>
        <line x1="100" y1="18" x2="116" y2="18" stroke="white" strokeWidth="1"  opacity=".32"/>
        <line x1="102" y1="27" x2="114" y2="27" stroke="white" strokeWidth="1"  opacity=".32"/>
        <line x1="100" y1="35" x2="116" y2="35" stroke="white" strokeWidth="1"  opacity=".32"/>
        <line x1="102" y1="43" x2="114" y2="43" stroke="white" strokeWidth="1"  opacity=".32"/>
        <line x1="100" y1="52" x2="116" y2="52" stroke="white" strokeWidth="1"  opacity=".32"/>
        {/* Magnifier handle lines */}
        <line x1="88" y1="95"  x2="100" y2="110" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".35"/>
        <circle cx="78" cy="84" r="12" stroke="white" strokeWidth="1.2" fill="none" opacity=".38"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <circle cx="11" cy="11" r="2" fill="currentColor" opacity="0.7"/>
        <path d="M11 2v3M11 17v3M2 11h3M17 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
        <path d="M4.9 4.9l2 2M15.1 15.1l2 2M4.9 17.1l2-2M15.1 6.9l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
      </svg>
    ),
  },

  'forensic-medicine': {
    cls: 'subject-forensic',
    accent: 'rgba(100,116,139,0.72)',
    /* Magnifying glass + fingerprint */
    watermark: (
      <svg viewBox="0 0 130 130" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Magnifying glass */}
        <circle cx="52" cy="52" r="34" stroke="white" strokeWidth="1.6" fill="none" opacity=".48"/>
        <line x1="76"  y1="76"  x2="110" y2="110" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity=".52"/>
        {/* Fingerprint swirls inside glass */}
        <circle cx="52" cy="52" r="8"  stroke="white" strokeWidth="1" fill="none" opacity=".38"/>
        <circle cx="52" cy="52" r="14" stroke="white" strokeWidth="0.9" fill="none" opacity=".30"/>
        <circle cx="52" cy="52" r="20" stroke="white" strokeWidth="0.8" fill="none" opacity=".24"/>
        <circle cx="52" cy="52" r="26" stroke="white" strokeWidth="0.7" fill="none" opacity=".18"/>
        {/* Partial arcs for realistic fingerprint */}
        <path d="M52 30 Q66 36 68 52" stroke="white" strokeWidth="0.8" fill="none" opacity=".22"/>
        <path d="M30 52 Q34 38 48 32" stroke="white" strokeWidth="0.8" fill="none" opacity=".22"/>
        {/* Document outline top-right */}
        <rect x="88" y="10" width="28" height="36" rx="4" stroke="white" strokeWidth="1.1" fill="none" opacity=".3"/>
        <line x1="93" y1="20" x2="111" y2="20" stroke="white" strokeWidth="0.9" opacity=".25"/>
        <line x1="93" y1="26" x2="111" y2="26" stroke="white" strokeWidth="0.9" opacity=".25"/>
        <line x1="93" y1="32" x2="104" y2="32" stroke="white" strokeWidth="0.9" opacity=".25"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <line x1="3" y1="19" x2="8.5" y2="13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="14" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" fill="none"/>
        <path d="M11.5 9h5M14 6.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"/>
      </svg>
    ),
  },

  default: {
    cls: 'subject-default',
    accent: 'rgba(67,56,202,0.72)',
    /* Medical book + caduceus */
    watermark: (
      <svg viewBox="0 0 130 120" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Book outline */}
        <path d="M16 14 L60 14 L80 26 L80 106 L16 106 Z" stroke="white" strokeWidth="1.3" fill="none" opacity=".45"/>
        <path d="M60 14 L60 106" stroke="white" strokeWidth="1.1" opacity=".3"/>
        <line x1="24" y1="40" x2="72" y2="40" stroke="white" strokeWidth="1" opacity=".3"/>
        <line x1="24" y1="52" x2="72" y2="52" stroke="white" strokeWidth="1" opacity=".3"/>
        <line x1="24" y1="64" x2="60" y2="64" stroke="white" strokeWidth="1" opacity=".3"/>
        {/* Medical cross over book */}
        <rect x="30" y="70" width="10" height="28" rx="2.5" stroke="white" strokeWidth="1.1" fill="none" opacity=".4"/>
        <rect x="20" y="80" width="30" height="10" rx="2.5" stroke="white" strokeWidth="1.1" fill="none" opacity=".4"/>
        {/* Caduceus - right side */}
        <line x1="100" y1="14" x2="100" y2="100" stroke="white" strokeWidth="1.3" opacity=".42"/>
        <path d="M88 30 C88 22 100 20 100 28 C100 36 112 36 112 44 C112 52 100 52 100 44 C100 36 88 36 88 44 C88 52 100 52 100 60"
              stroke="white" strokeWidth="1.1" fill="none" opacity=".35"/>
        {/* Wings */}
        <path d="M96 20 Q86 14 84 18 Q86 22 100 22" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
        <path d="M104 20 Q114 14 116 18 Q114 22 100 22" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
      </svg>
    ),
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 3H16L20 7V21H4V3Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
        <path d="M16 3V7H20" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7 11h8M7 15h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
};

// ─── Course visual matcher ────────────────────────────────────────────────────

const courseVisuals = [
  { key: 'anatomy',    keywords: ['anatomy','muscle','skeletal','skeleton','gross'] },
  { key: 'physiology', keywords: ['physiology','cardio','respiratory','heart','lung','system'] },
  { key: 'biochemistry', keywords: ['biochemistry','biochem','molecule','metabolism','enzyme'] },
  { key: 'pathology',  keywords: ['pathology','patho','histology','disease','microscope'] },
  { key: 'pharmacology', keywords: ['pharmacology','pharma','drug','medicine','therapeutic'] },
  { key: 'microbiology', keywords: ['microbiology','microbe','bacteria','virus','infection'] },
  { key: 'forensic-medicine', keywords: ['forensic','legal','toxicology','autopsy'] },
];

function getCourseVisual(course, index) {
  const searchable = [course.courseTitle, course.description, course.courseCode, course.examType]
    .filter(Boolean).join(' ').toLowerCase();
  return courseVisuals.find(v => v.keywords.some(k => searchable.includes(k)))
    || courseVisuals[index % courseVisuals.length];
}

function getCourseState(p) {
  if (p >= 100) return { label: 'Completed',   tone: 'completed' };
  if (p > 0)    return { label: 'In Progress',  tone: 'in_progress' };
  return                { label: 'Ready',       tone: '' };
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function CourseSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface-card shadow-sm">
      <div className={cx(ui.shimmer, 'h-[108px] rounded-none')}/>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <div className={cx(ui.shimmer, 'h-5 w-16 rounded-full')}/>
          <div className={cx(ui.shimmer, 'h-5 w-12 rounded-full')}/>
        </div>
        <div className="grid gap-1.5">
          <div className={cx(ui.shimmer, 'h-5 w-4/5 rounded-md')}/>
          <div className={cx(ui.shimmer, 'h-4 w-full rounded-md')}/>
          <div className={cx(ui.shimmer, 'h-4 w-2/3 rounded-md')}/>
        </div>
        <div className={cx(ui.shimmer, 'h-2 w-full rounded-full')}/>
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2].map(i => <div key={i} className={cx(ui.shimmer, 'h-14 rounded-xl')}/>)}
        </div>
        <div className={cx(ui.shimmer, 'h-10 w-full rounded-xl')}/>
      </div>
    </div>
  );
}

// ─── Course card ──────────────────────────────────────────────────────────────

function CourseCard({ course, index, onClick }) {
  const visual   = getCourseVisual(course, index);
  const subj     = subjectConfig[visual.key] || subjectConfig.default;
  const progress = Math.max(0, Math.min(100, Number(course.progressPercent || 0)));
  const state    = getCourseState(progress);
  const remaining = Math.max(0, Number(course.totalLessonsCount || 0) - Number(course.completedLessonsCount || 0));

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${course.courseTitle}`}
      className="lms-course-card student-course-card group/card relative flex min-h-[286px] flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface-card text-left shadow-sm outline-none transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-brand-primary/24 hover:shadow-[0_18px_44px_rgba(0,0,0,0.14)] focus-visible:ring-4 focus-visible:ring-brand-primary/22 dark:border-white/[0.08] dark:bg-[rgba(6,10,18,0.96)] dark:hover:border-white/[0.14]"
    >
      {/* Subject header */}
      <div className={cx('student-course-card__visual relative flex items-end justify-between overflow-hidden px-5 py-4', subj.cls)}>
        {/* Radial highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_85%,rgba(255,255,255,0.13),transparent_60%)] pointer-events-none"/>
        {/* Decorative watermark illustration */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[55%] opacity-35">
          {subj.watermark}
        </div>
        {/* Subject icon box */}
        <div className="relative z-[1] flex size-[52px] items-center justify-center rounded-[14px] border border-white/22 bg-black/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] text-white">
          {subj.icon}
        </div>
        {/* Progress percentage */}
        <div className="relative z-[1] flex flex-col items-end gap-0.5">
          {progress > 0 ? (
            <>
              <span className="text-[24px] font-black leading-none text-white drop-shadow-sm">{progress}%</span>
              <span className="text-[10px] font-bold text-white/65 uppercase tracking-[0.10em]">complete</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Card body */}
      <div className="student-course-card__body flex flex-1 flex-col gap-3 p-4">
        {/* Title */}
        <h2 className="m-0 line-clamp-2 text-[15px] font-extrabold leading-snug text-ink-strong">
          {course.courseTitle}
        </h2>

        {/* Description */}
        <p className="student-course-card__description m-0 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
          {course.description || 'Course content and lessons are available inside this module.'}
        </p>

        {/* Progress bar */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-ink-medium">Progress</span>
            <span className="font-extrabold text-ink-strong">{progress}%</span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.07]">
            <span
              className="block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max(progress > 0 ? 5 : 0, progress)}%`,
                background: `linear-gradient(90deg, ${subj.accent.replace('0.72','1')} 0%, rgba(255,255,255,0.9) 180%)`,
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="student-course-card__stats grid grid-cols-3 gap-2">
          {[
            { label: 'Subjects',   value: course.subjectCount ?? '—' },
            { label: 'Lessons',    value: course.totalLessonsCount ?? '—' },
            { label: 'Remaining',  value: remaining },
          ].map(stat => (
            <div
              key={stat.label}
              className="student-course-card__stat flex min-w-0 flex-col items-center gap-0.5 rounded-xl border border-line-soft bg-surface-0 px-1 py-3 dark:bg-white/[0.032] dark:border-white/[0.07]"
            >
              <strong className="text-[16px] font-extrabold text-ink-strong">{stat.value}</strong>
              <small className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">{stat.label}</small>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <div className="student-course-card__cta mt-auto inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-brand-primary/22 bg-[var(--color-primary-light)] text-[12.5px] font-extrabold text-brand-primary transition-[background,border-color,transform] duration-150 group-hover/card:border-brand-primary/35 group-hover/card:bg-brand-primary/15 active:scale-[0.98]">
          {course.actionLabel || (progress > 0 ? 'Continue Course' : 'Start Now')}
          <svg className="size-3.5 opacity-75" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function StudentCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchStudentCourses();
        if (!cancelled) setCourses(data);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, 'Unable to load courses'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="All Courses"
          subtitle="Continue your active courses with subject, lesson, and progress tracking."
        />

        {error && <div className={ui.feedbackError}>{error}</div>}

        <StudentPageHero
          title="All Courses"
          subtitle="Continue your active courses with live subject, lesson, and progress tracking."
          tone="blue"
          metrics={[
            { label: 'Active Courses', value: loading ? '-' : courses.length },
            { label: 'In Progress', value: loading ? '-' : courses.filter((course) => course.status === 'in_progress').length },
            { label: 'Completed', value: loading ? '-' : courses.filter((course) => course.status === 'completed').length },
          ]}
        />

        <section className={cx(ui.panelCard, 'animate-fadePop')}>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className={ui.eyebrow}>My Courses</span>
              <h2 className="m-0 mt-2 font-display text-[clamp(20px,2.4vw,26px)] font-extrabold leading-tight text-ink-strong">
                Your active learning tracks
              </h2>
            </div>
            {!loading && (
              <span className={statusPill(courses.length ? 'active' : '')}>
                {courses.length} {courses.length === 1 ? 'course' : 'courses'}
              </span>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,264px),1fr))] gap-5 max-[900px]:grid-cols-1 max-[520px]:gap-4">
            {loading && [1,2,3,4,5,6].map(n => <CourseSkeleton key={n}/>)}

            {!loading && courses.length === 0 && (
              <div className={cx(ui.emptyBox, 'col-span-full')}>
                No active courses available yet.
              </div>
            )}

            {!loading && courses.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                index={index}
                onClick={() => navigate(`/courses/${course.id}`)}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
