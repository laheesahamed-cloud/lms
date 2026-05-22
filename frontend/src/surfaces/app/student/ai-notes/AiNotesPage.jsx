import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAiNote, getLessonAiNote } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { recordStudyActivity } from '../../../../shared/api/dashboard.api.js';
import { updateStudentLessonProgress } from '../../../../shared/api/courses.api.js';
import { getVideoEmbed, getVideoThumbnail } from '../../../../shared/utils/videoEmbed.js';
import { ThemeToggle } from '../../../../shared/layout/ThemeToggle.jsx';
import { NoteCanvas } from './NoteCanvas.jsx';

// ── Fonts ─────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('canvas-hand-font')) {
  const lnk = document.createElement('link');
  lnk.id = 'canvas-hand-font'; lnk.rel = 'stylesheet';
  lnk.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(lnk);
}
const KL = { fontFamily: "'Patrick Hand', cursive" };

function LockIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M15 21v-4.2C15 11.4 18.8 7.5 24 7.5s9 3.9 9 9.3V21" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <rect x="10.5" y="21" width="27" height="18.5" rx="4.5" stroke="currentColor" strokeWidth="3.2" />
      <path d="M24 27.8v4.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function useDark() {
  const [d, setD] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const ob = new MutationObserver(() => setD(document.documentElement.getAttribute('data-theme') === 'dark'));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => ob.disconnect();
  }, []);
  return d;
}

const ICONS_LIB = ['☆','💡','📚','🌿','📅','🏷️','💬','✅','⚠️','❓','🔄','📌','🩺','💊','🧬','🔬'];
const DECOS_LIB = ['✦','✧','♡','☁','〰','🌿','🍃','✿','✾','❋','◆','◇'];
const STICKERS  = ['⭐','🔥','💡','🏆','✅','⚠️','❤️','👍','🧠','📚','📌','❗','❓','🚀','✏️','✨','⏰','🚩','🎯','💊','🧬','🔬','🩺','📊'];
function getMCQTag(note) {
  const t = `${note?.title||''} ${note?.courseTitle||''} ${note?.topicName||''}`.toLowerCase();
  if (/cardiac|heart|coronar|arrhythm|myocard/.test(t)) return { tag:'Cardiology',   c:'#9d174d', bg:'#fce7f3' };
  if (/neuro|brain|stroke|parkinson|seizure/.test(t))    return { tag:'Neurology',    c:'#1e3a5f', bg:'#dbeafe' };
  if (/pharmac|drug|medication|antibiotic/.test(t))       return { tag:'Pharmacology', c:'#4a1d96', bg:'#ede9fe' };
  if (/pathol|cancer|tumour|neoplasm/.test(t))            return { tag:'Pathology',    c:'#7c2d12', bg:'#fff7ed' };
  if (/anatom|muscle|nerve|ligament/.test(t))             return { tag:'Anatomy',      c:'#14532d', bg:'#dcfce7' };
  return { tag:'Clinical Med.', c:'#334155', bg:'#f1f5f9' };
}

function studentCanvasPersonalStorageKey(noteId) {
  return noteId ? `lms.studentCanvas.personal.${noteId}` : '';
}

// ── Floating sticker ──────────────────────────────────────────────────────────
function FloatingSticker({ s, editable, onUpdate, onDelete, canvasRef }) {
  const dr = useRef(null), el = useRef(null);
  function onPD(e) {
    if (!editable) return;
    e.stopPropagation(); e.preventDefault();
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const w = s.type === 'note' ? (s.w || 180) : 40;
    const h = s.type === 'note' ? (s.h || 110) : 40;
    dr.current = { sx:e.clientX, sy:e.clientY, ox:s.x, oy:s.y, x:s.x, y:s.y, w, h, r };
    if (el.current) {
      el.current.style.cursor = 'grabbing';
      el.current.style.willChange = 'transform';
    }
    el.current?.setPointerCapture(e.pointerId);
  }
  function onPM(e) {
    const d = dr.current; if (!d) return;
    d.x = Math.max(0, Math.min(d.r.width - d.w, d.ox + e.clientX - d.sx));
    d.y = Math.max(0, Math.min(d.r.height - d.h, d.oy + e.clientY - d.sy));
    if (el.current) {
      el.current.style.transform = `translate3d(${d.x - d.ox}px, ${d.y - d.oy}px, 0) rotate(${s.r || 0}deg)`;
    }
  }
  function finishDrag(e) {
    const d = dr.current;
    if (!d) return;
    if (el.current) {
      el.current.style.cursor = editable ? 'grab' : 'default';
      el.current.style.willChange = '';
      el.current.style.transform = `rotate(${s.r || 0}deg)`;
    }
    dr.current = null;
    try { e?.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* pointer may already be released */ }
    if (Math.abs(d.x - d.ox) > 0.5 || Math.abs(d.y - d.oy) > 0.5) {
      onUpdate({ ...s, x:d.x, y:d.y });
    }
  }
  return (
    <div ref={el} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={finishDrag} onPointerCancel={finishDrag}
      className="group/fs absolute select-none leading-none"
      style={{ left:s.x, top:s.y, cursor:editable?'grab':'default', zIndex:20, transform:`rotate(${s.r||0}deg)`, touchAction:editable?'none':'auto' }}>
      {s.type === 'note' ? (
        <div
          className="rounded-xl border border-amber-300/70 bg-amber-100/95 p-3 text-slate-700 shadow-[0_12px_24px_rgba(120,72,20,.16)]"
          style={{ width:s.w || 180, minHeight:s.h || 96, ...KL }}
        >
          <div className="absolute left-1/2 top-[-5px] size-3 -translate-x-1/2 rounded-full bg-amber-400 shadow-sm" />
          {editable ? (
            <textarea className="block min-h-[72px] w-full resize-y border-0 bg-transparent text-[15px] font-bold leading-snug outline-none"
              value={s.text || ''}
              onPointerDown={e => e.stopPropagation()}
              onChange={e => onUpdate({ ...s, text:e.target.value })}
              placeholder="Write your note..."
            />
          ) : (
            <p className="m-0 whitespace-pre-wrap text-[15px] font-bold leading-snug">{s.text}</p>
          )}
        </div>
      ) : (
        <span className="text-2xl">{s.emoji}</span>
      )}
      {editable && <button className="absolute -right-2 -top-2 hidden size-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover/fs:flex"
        type="button"
        onClick={() => onDelete(s.id)}>✕</button>}
    </div>
  );
}

const CanvasPage = memo(function CanvasPage({ pageData, index, note, topBd, isDark }) {
  const data = useMemo(() => ({
    ...pageData,
    title: pageData.title || note.title,
    subtitle: pageData.subtitle || note.courseTitle || '',
    layout: pageData.layout || '3col',
  }), [note.courseTitle, note.title, pageData]);

  return (
    <div className="lms-canvas-page">
      {index > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:14, margin:'4px 0 16px' }}>
          <div style={{ flex:1, height:1, background:topBd }}/>
          <span style={{ ...KL, border:`1px solid ${topBd}`, background:isDark?'rgba(255,255,255,.04)':'#fff', borderRadius:99, padding:'3px 14px', fontSize:11, fontWeight:600, color:isDark?'#94a3b8':'#6b7280', whiteSpace:'nowrap' }}>
            Page {index+1}{pageData.title?` · ${pageData.title}`:''}
          </span>
          <div style={{ flex:1, height:1, background:topBd }}/>
        </div>
      )}
      <NoteCanvas data={data} editable={false} />
    </div>
  );
});

function SmoothCanvasMotion() {
  return (
    <style>{`
      @keyframes lmsCanvasFadeUp {
        from { opacity: 0; transform: translate3d(0, 12px, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      @keyframes lmsToastIn {
        from { opacity: 0; transform: translate3d(-50%, 10px, 0) scale(.98); }
        to { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
      }
      .lms-ai-canvas-shell {
        animation: lmsCanvasFadeUp 260ms cubic-bezier(.16,1,.3,1) both;
      }
      .lms-ai-note-topbar-inner > * {
        min-width: 0;
      }
      .lms-ai-note-back-slot {
        justify-content: flex-start !important;
      }
      .lms-ai-note-back-button,
      .lms-ai-note-action-button {
        min-height: 38px;
        white-space: nowrap;
      }
      .lms-ai-note-title-block {
        min-width: 0;
        overflow: hidden;
      }
      .lms-ai-note-topbar-actions {
        min-width: 0;
      }
      .lms-ai-note-control-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .lms-ai-note-progress-inline {
        display: grid;
        gap: 5px;
        width: 100%;
        border: 1px solid var(--lms-ai-note-progress-border);
        background: var(--lms-ai-note-progress-bg);
        border-radius: 12px;
        padding: 7px 9px;
      }
      .lms-ai-note-page {
        padding-bottom: calc(86px + env(safe-area-inset-bottom, 0px));
      }
      .lms-ai-note-reading-dock {
        position: fixed;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 9998;
        padding: 10px 24px calc(10px + env(safe-area-inset-bottom, 0px));
        pointer-events: none;
      }
      .lms-ai-note-reading-dock__inner {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        max-width: 1680px;
        margin: 0 auto;
        border: 1px solid var(--lms-ai-note-progress-border);
        border-radius: 18px;
        background: color-mix(in srgb, var(--lms-ai-note-progress-bg) 88%, transparent);
        box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
        padding: 10px;
        pointer-events: auto;
        -webkit-backdrop-filter: blur(18px) saturate(1.08);
        backdrop-filter: blur(18px) saturate(1.08);
      }
      .lms-ai-note-progress-inline--floating {
        min-height: 38px;
        align-content: center;
      }
      .lms-canvas-page {
        animation: lmsCanvasFadeUp 320ms cubic-bezier(.16,1,.3,1) both;
        contain: layout paint;
        content-visibility: auto;
        contain-intrinsic-size: 900px;
      }
      .lms-canvas-page:nth-child(2) { animation-delay: 45ms; }
      .lms-canvas-page:nth-child(3) { animation-delay: 90ms; }
      .lms-smooth-action {
        transition: transform 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease, color 180ms ease, opacity 180ms ease;
      }
      .lms-smooth-action:hover:not(:disabled) {
        transform: translate3d(0, -1px, 0);
      }
      .lms-toast {
        animation: lmsToastIn 190ms cubic-bezier(.16,1,.3,1) both;
      }
      @media (max-width: 1180px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
          gap: 12px !important;
        }
        .lms-ai-canvas-shell {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          align-items: start;
        }
        .lms-ai-note-main {
          grid-column: 1 / -1;
          order: 1;
        }
        .lms-ai-note-left-panel {
          order: 2;
        }
        .lms-ai-note-right-panel {
          order: 3;
        }
      }
      @media (max-width: 760px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
        }
        .lms-ai-note-topbar-actions {
          display: flex !important;
          justify-content: stretch !important;
          gap: 8px !important;
        }
        .lms-ai-note-control-row {
          gap: 7px;
        }
        .lms-ai-note-control-row > button,
        .lms-ai-note-control-row > .theme-toggle,
        .lms-ai-note-action-button {
          flex: 1 1 auto;
        }
        .lms-ai-note-page {
          padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
        }
        .lms-ai-note-reading-dock {
          bottom: 0;
          padding: 8px 12px calc(10px + env(safe-area-inset-bottom, 0px));
        }
        .lms-ai-note-reading-dock__inner {
          grid-template-columns: 1fr;
          gap: 8px;
          border-radius: 16px;
          padding: 9px;
        }
        .lms-ai-note-reading-dock .lms-ai-note-action-button {
          width: 100%;
        }
        .lms-ai-canvas-shell {
          grid-template-columns: 1fr !important;
        }
        .lms-ai-note-main,
        .lms-ai-note-left-panel,
        .lms-ai-note-right-panel {
          grid-column: auto;
        }
      }
      @media (max-width: 430px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: 1fr !important;
          align-items: stretch !important;
        }
        .lms-ai-note-back-button {
          justify-content: center !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .lms-ai-canvas-shell,
        .lms-canvas-page,
        .lms-toast {
          animation: none;
        }
        .lms-smooth-action {
          transition: none;
        }
        .lms-smooth-action:hover:not(:disabled) {
          transform: none;
        }
      }
    `}</style>
  );
}

function StickerPicker({ onPick, onClose }) {
  const r = useRef(null);
  useEffect(() => {
    const h = e => { if (r.current && !r.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={r} className="absolute bottom-full left-0 z-50 mb-2 grid grid-cols-6 gap-1 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-lg">
      {STICKERS.map((s,i) => (
        <button key={i} className="flex size-8 items-center justify-center rounded-lg border border-gray-100 text-base hover:border-violet-300 hover:bg-violet-50"
          onClick={() => { onPick(s); onClose(); }}>{s}</button>
      ))}
    </div>
  );
}

function WatchVideoModal({ open, url, onClose, isDark }) {
  if (!open || typeof document === 'undefined') return null;
  const embed = getVideoEmbed(url);
  const panelBg = isDark ? 'rgba(15,18,31,.98)' : '#ffffff';
  const line = isDark ? 'rgba(255,255,255,.10)' : '#e5e7eb';
  const muted = isDark ? 'rgba(226,232,240,.62)' : '#64748b';
  const text = isDark ? '#f8fafc' : '#334155';
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-lg"
      style={{ zIndex: 99999 }}
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes lmsVideoDialogIn {
          from { opacity: 0; transform: translateY(-34px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl" style={{ background:panelBg, borderColor:line, animation:'lmsVideoDialogIn 220ms cubic-bezier(.16,1,.3,1) both' }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor:line }}>
          <div>
            <div style={{ ...KL, fontSize:24, fontWeight:800, color:text }}>Watch lesson video</div>
            <div className="text-xs" style={{ color:muted }}>Video added by your instructor.</div>
          </div>
          <button className="inline-flex size-9 items-center justify-center rounded-full border text-sm font-black"
            type="button"
            onClick={onClose}
            style={{ borderColor:line, color:text, background:isDark?'rgba(255,255,255,.05)':'#f8fafc' }}
            aria-label="Close video popup"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          {url && (
            <div className="rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ borderColor:line, background:isDark?'rgba(255,255,255,.05)':'#f8fafc', color:muted }}>
              Protected lesson player. Sharing, copying, and opening the source URL are disabled in this workspace.
            </div>
          )}
          <div className="aspect-video overflow-hidden rounded-xl border" style={{ borderColor:line, background:isDark?'rgba(255,255,255,.035)':'#f8fafc' }}>
            {embed?.type === 'iframe' ? (
              <div className="relative h-full w-full bg-black">
                <iframe
                  title="Protected lesson video player"
                  src={embed.src}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                {embed.hideTopChrome ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-black"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ) : embed?.type === 'video' ? (
              <video
                className="h-full w-full bg-black object-contain"
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(event) => event.preventDefault()}
                src={embed.src}
              />
            ) : embed?.type === 'blocked' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div style={{ ...KL, fontSize:22, color:text }}>This lesson video cannot be played securely.</div>
                <div className="max-w-sm text-xs leading-relaxed" style={{ color:muted }}>Ask your instructor to upload an embeddable protected video instead of a public link.</div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <div style={{ fontSize:40 }}>🎬</div>
                <div style={{ ...KL, fontSize:20, fontWeight:800, color:text }}>No video available yet</div>
                <div className="max-w-sm text-xs leading-relaxed" style={{ color:muted }}>Your instructor hasn't added a video for this lesson yet.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WatchVideoPanel({ videoUrl, onOpenVideo, isDark }) {
  const bg = isDark ? '#12141f' : '#fff';
  const bd = isDark ? 'rgba(255,255,255,.09)' : '#e5e7eb';
  const muted = isDark ? 'rgba(200,210,255,.58)' : '#64748b';
  const thumb = getVideoThumbnail(videoUrl);
  return (
    <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:14, padding:10, marginBottom:12 }}>
      <button className="group relative block aspect-video w-full overflow-hidden rounded-xl border text-left shadow-[0_16px_34px_rgba(15,23,42,.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(37,99,235,.18)]"
        type="button"
        onClick={onOpenVideo}
        style={{ borderColor:bd, opacity:videoUrl ? 1 : 0.76, cursor:'pointer', background:isDark?'linear-gradient(135deg,rgba(37,99,235,.22),rgba(124,58,237,.18),rgba(15,23,42,.96))':'linear-gradient(135deg,#eff6ff,#f5f3ff,#ffffff)' }}
      >
        {thumb && <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-200 group-hover:scale-[1.03]" loading="lazy" decoding="async" />}
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(59,130,246,.15),transparent_36%),linear-gradient(180deg,rgba(2,6,23,.08),rgba(2,6,23,.66))]" />
        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
          Watch Video
        </span>
        <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-white/18 text-white shadow-[0_0_34px_rgba(59,130,246,.38)] backdrop-blur-md transition group-hover:scale-105">
          ▶
        </span>
        <span className="absolute inset-x-3 bottom-3">
          <span className="block truncate text-[13px] font-black text-white">{videoUrl ? 'Protected lesson video' : 'No video added yet'}</span>
          <span className="block text-[11px] font-semibold text-white/75">{videoUrl ? 'Click to play securely' : 'Instructor can add a protected video'}</span>
        </span>
      </button>
      <p style={{ ...KL, fontSize:11.5, lineHeight:1.45, color:muted, margin:'9px 3px 0' }}>
        {videoUrl ? 'Video plays inside the LMS without exposing the source link.' : 'Ask your instructor to add the lesson video.'}
      </p>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────
function RightPanel({ onStickerAdd, onNoteAdd, note, isDark, isEditing, videoUrl, onOpenVideo }) {
  const [stickerOpen, setStickerOpen] = useState(false);
  const navigate = useNavigate();
  const mcq = getMCQTag(note);
  const bg  = isDark?'#12141f':'#fff', bd=isDark?'rgba(255,255,255,.09)':'#e5e7eb';
  const lbl = isDark?'rgba(200,210,255,.4)':'#9ca3af';
  const C = ch => <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:16, padding:'13px 15px', marginBottom:12 }}>{ch}</div>;
  const L = t => <div style={{ fontFamily:'sans-serif', fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:lbl, marginBottom:9 }}>{t}</div>;
  const btnHov = (e,on) => {
    e.currentTarget.style.borderColor = on?'#a78bfa':bd;
    e.currentTarget.style.background  = on?(isDark?'rgba(167,139,250,.1)':'#f5f3ff'):(isDark?'rgba(255,255,255,.04)':'#f9fafb');
  };
  return (
    <div style={{ position:'sticky', top:72 }}>
      <WatchVideoPanel videoUrl={videoUrl} onOpenVideo={onOpenVideo} isDark={isDark} />
      {C(<>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:18 }}>🎯</span>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:isDark?'#a78bfa':'#6d28d9' }}>Practice MCQ</span>
        </div>
        <span style={{ background:isDark?`${mcq.bg}18`:mcq.bg, border:`1px solid ${mcq.c}40`, color:mcq.c, borderRadius:99, padding:'2px 9px', fontSize:10, fontWeight:700, display:'inline-block', marginBottom:10 }}>{mcq.tag}</span>
        <p style={{ ...KL, fontSize:11.5, lineHeight:1.55, color:isDark?'rgba(200,210,255,.65)':'#6b7280', marginBottom:12 }}>
          Test knowledge on <strong style={{ color:isDark?'#a78bfa':'#5b21b6' }}>{note?.title||'this topic'}</strong>.
        </p>
        <button className="w-full" onClick={() => navigate('/quizzes')}
          style={{ width:'100%', background:isDark?'rgba(167,139,250,.12)':'#f5f3ff', color:isDark?'#ddd6fe':'#6d28d9', borderRadius:11, padding:'8px 0', fontSize:11, fontWeight:800, border:`1px solid ${isDark?'rgba(167,139,250,.28)':'rgba(124,58,237,.24)'}`, cursor:'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark?'rgba(167,139,250,.18)':'#ede9fe'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isDark?'rgba(167,139,250,.12)':'#f5f3ff'; }}>
          Start MCQ Session →
        </button>
      </>)}
      {C(<>
        {L('Icons')}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {ICONS_LIB.map((ic,i) => <button key={i} className="inline-flex items-center justify-center" onClick={() => onStickerAdd(ic)} title="Pin to lesson"
            style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9, border:`1px solid ${bd}`, background:isDark?'rgba(255,255,255,.04)':'#f9fafb', fontSize:14, cursor:'pointer' }}
            onMouseEnter={e => btnHov(e,true)} onMouseLeave={e => btnHov(e,false)}>{ic}</button>)}
        </div>
        {L('Decorative Elements')}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {DECOS_LIB.map((d,i) => <button key={i} className="inline-flex items-center justify-center" onClick={() => onStickerAdd(d)} title="Pin to lesson"
            style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9, border:`1px solid ${bd}`, background:isDark?'rgba(255,255,255,.04)':'#f9fafb', fontSize:14, cursor:'pointer' }}
            onMouseEnter={e => btnHov(e,true)} onMouseLeave={e => btnHov(e,false)}>{d}</button>)}
        </div>
        <div style={{ position:'relative', marginTop:8 }}>
          <button className="mb-2 w-full" onClick={onNoteAdd}
            type="button"
            style={{ width:'100%', border:`1px dashed ${bd}`, borderRadius:9, padding:'5px 0', fontSize:10, fontWeight:700, color:isDark?'#f59e0b':'#92400e', background:isDark?'rgba(245,158,11,.08)':'#fffbeb', cursor:'pointer' }}
          >
            📝 Add sticky note
          </button>
          <button className="w-full" onClick={() => setStickerOpen(v => !v)}
            style={{ width:'100%', border:`1px dashed ${bd}`, borderRadius:9, padding:'5px 0', fontSize:10, fontWeight:600, color:lbl, background:'transparent', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#a78bfa'; e.currentTarget.style.color='#7c3aed'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=bd; e.currentTarget.style.color=lbl; }}>
            ✨ More stickers…
          </button>
          {stickerOpen && <StickerPicker onPick={onStickerAdd} onClose={() => setStickerOpen(false)} />}
        </div>
      </>)}
      <div style={{ borderRadius:16, border:isDark?'1px solid rgba(251,191,36,.2)':'1px solid #fde68a', background:isDark?'rgba(251,191,36,.05)':'#fffbeb', padding:'13px 15px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
          <span>💡</span>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:isDark?'#fbbf24':'#92400e', fontFamily:'sans-serif' }}>Revision Tip</span>
        </div>
        <p style={{ ...KL, fontSize:11.5, lineHeight:1.6, color:isDark?'#fde68a':'#78350f', margin:0 }}>
          {isEditing
            ? 'Personalize mode lets you move stickers and write your own sticky notes. The instructor lesson stays protected.'
            : 'Use Personalize when you want to pin icons or add your own sticky notes.'}
        </p>
      </div>
    </div>
  );
}

const MemoRightPanel = memo(RightPanel);

// ── Canvas card grid (one page) ───────────────────────────────────────────────
// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeNoteData(raw) {
  if (!raw) return null;
  if (raw.pages && Array.isArray(raw.pages)) return raw;
  return { pages: [raw] };
}
function cleanCanvasLabel(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parts = text
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(lms|study|lesson|lessons|ai-notes|canvas|canvases|\d+)$/i.test(part));
  return parts.length ? parts[parts.length - 1] : text;
}
function BackIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
// ── Main page ─────────────────────────────────────────────────────────────────
export function AiNotesPage({ engineKey='gemini', headerTitle='Lesson', backLabel='Lessons' }) {
  const { id, lessonId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useDark();
  const pageRef   = useRef(null);
  const canvasRef = useRef(null);

  const [note,      setNote]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [localData, setLocalData] = useState(null);
  const [stickers,  setStickers]  = useState([]);
  const [toast,     setToast]     = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [videoUrl,  setVideoUrl]  = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const sidRef = useRef(0);
  const saveTimerRef = useRef(null);

  const notify = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const toggleEditing = useCallback(() => setIsEditing(v => !v), []);

  useEffect(() => {
    let cancelled = false;
    (lessonId ? getLessonAiNote(Number(lessonId),{engine:engineKey}) : getAiNote(Number(id),{engine:engineKey}))
      .then(data => { if (!cancelled) {
        const baseData = normalizeNoteData(data.noteData);
        setNote(data);
        setLocalData(baseData);
        setVideoUrl(data.videoUrl || '');
        setLessonCompleted(Boolean(
          data.lessonCompleted ||
          data.lessonProgressStatus === 'completed' ||
          Number(data.lessonProgressPercent || 0) >= 100
        ));
      }
        recordStudyActivity({ activityType:'ai_note_viewed', itemId:Number(data.id||id||lessonId) }).catch(()=>{});
      })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e,'Failed to load lesson.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [engineKey, id, lessonId]);

  useEffect(() => {
    let frame = 0;
    const getScrollCandidates = () => {
      const pageNode = pageRef.current;
      const candidates = [
        document.scrollingElement,
        document.documentElement,
        document.body,
        document.querySelector('.lms-app-scroll-root'),
        document.querySelector('.portal-content'),
        document.querySelector('.portal-content__frame'),
        document.querySelector('.app-content'),
        document.querySelector('.page-content'),
      ].filter(Boolean);

      return Array.from(new Set(candidates)).filter((element) => {
        if (element === document.body || element === document.documentElement || element === document.scrollingElement) {
          return true;
        }
        return !pageNode || element.contains(pageNode) || pageNode.contains(element);
      });
    };

    const getScrollState = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
      const states = getScrollCandidates().map((element) => {
        const isDocument = element === document.body || element === document.documentElement || element === document.scrollingElement;
        const scrollTop = isDocument
          ? (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0)
          : element.scrollTop;
        const scrollHeight = isDocument
          ? Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
          : element.scrollHeight;
        const clientHeight = isDocument ? viewportHeight : element.clientHeight;
        return {
          element,
          scrollTop: Math.max(0, scrollTop || 0),
          scrollMax: Math.max(0, (scrollHeight || 0) - (clientHeight || 0)),
        };
      });

      return states.reduce((best, state) => (state.scrollMax > best.scrollMax ? state : best), {
        element: document.scrollingElement || document.documentElement,
        scrollTop: 0,
        scrollMax: 0,
      });
    };

    function updateProgress() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const { scrollTop, scrollMax } = getScrollState();
        const nextProgress = scrollMax <= 0 ? 0 : Math.round((scrollTop / scrollMax) * 100);
        setReadingProgress(Math.min(100, Math.max(0, nextProgress)));
      });
    }
    updateProgress();
    const appScrollers = getScrollCandidates();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    appScrollers.forEach((element) => element.addEventListener('scroll', updateProgress, { passive: true }));
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
      appScrollers.forEach((element) => element.removeEventListener('scroll', updateProgress));
    };
  }, [note?.id, localData?.pages?.length]);

  useEffect(() => {
    const key = studentCanvasPersonalStorageKey(note?.id || id || lessonId);
    if (!key || typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(key);
      setStickers(saved ? JSON.parse(saved) : []);
    } catch {
      setStickers([]);
    }
  }, [id, lessonId, note?.id]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const savePersonalItems = useCallback((nextItems) => {
    const key = studentCanvasPersonalStorageKey(note?.id || id || lessonId);
    if (!key || typeof window === 'undefined') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const write = () => {
        try { window.localStorage.setItem(key, JSON.stringify(nextItems)); } catch { /* personal overlay is optional */ }
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(write, { timeout:800 });
      } else {
        write();
      }
    }, 120);
  }, [id, lessonId, note?.id]);

  function handleBack() { if (location.state?.returnToPath) { navigate(location.state.returnToPath); return; } navigate(-1); }

  const addSticker    = useCallback(emoji => {
    if (!isEditing) {
      notify('Click Personalize first');
      return;
    }
    setStickers(ss => {
      const next = [...ss, { id:`st${++sidRef.current}`, type:'emoji', emoji, x:40+Math.random()*160, y:40+Math.random()*80, r:Math.round(Math.random()*16-8) }];
      savePersonalItems(next);
      return next;
    });
    notify(`${emoji} pinned`);
  }, [isEditing, savePersonalItems]);
  const addStickyNote = useCallback(() => {
    if (!isEditing) {
      notify('Click Personalize first to add sticky notes');
      return;
    }
    setStickers(ss => {
      const next = [...ss, { id:`st${++sidRef.current}`, type:'note', text:'My note', x:54+Math.random()*130, y:70+Math.random()*90, r:Math.round(Math.random()*8-4), w:180, h:96 }];
      savePersonalItems(next);
      return next;
    });
    notify('Sticky note added');
  }, [isEditing, savePersonalItems]);
  const updateSticker = useCallback(upd => setStickers(ss => {
    const next = ss.map(s => s.id===upd.id?upd:s);
    savePersonalItems(next);
    return next;
  }), [savePersonalItems]);
  const deleteSticker = useCallback(sid => setStickers(ss => {
    const next = ss.filter(s => s.id!==sid);
    savePersonalItems(next);
    return next;
  }), [savePersonalItems]);
  const openVideo = useCallback(() => {
    setVideoOpen(true);
  }, []);
  const markLessonComplete = useCallback(async () => {
    const resolvedLessonId = Number(note?.lessonId || location.state?.lessonId || lessonId || 0);
    setCompletionBusy(true);
    try {
      if (!resolvedLessonId) {
        throw new Error('This lesson is not linked to a course lesson yet.');
      }
      await updateStudentLessonProgress(resolvedLessonId, { status: 'completed', progressPercent: 100 });
      setNote((current) => current ? {
        ...current,
        lessonCompleted: true,
        lessonProgressStatus: 'completed',
        lessonProgressPercent: 100,
      } : current);
      setLessonCompleted(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lms:lesson-progress-updated', {
          detail: {
            lessonId: resolvedLessonId,
            aiNoteId: Number(note?.id || id || 0),
            status: 'completed',
            progressPercent: 100,
          },
        }));
      }
      notify('Lesson marked complete');
    } catch (completeError) {
      notify(getErrorMessage(completeError, 'Unable to mark lesson complete'));
    } finally {
      setCompletionBusy(false);
    }
  }, [id, lessonId, location.state?.lessonId, note?.id, note?.lessonId]);

  const pageBg = 'var(--sa-bg, #eff1fb)';
  const topBg  = isDark?'rgba(5,7,13,.86)':'rgba(255,255,255,.96)';
  const topBd  = isDark?'rgba(145,170,255,.16)':'#e5e7eb';
  const btnBg  = isDark?'linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.045))':'#f9fafb';
  const btnBd  = isDark?'rgba(145,170,255,.18)':'#e5e7eb';
  const btnTx  = isDark?'rgba(230,238,255,.84)':'#374151';
  const lessonButtonShadow = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,.08), 0 8px 22px rgba(0,0,0,.18)'
    : 'none';
  const progressPanelStyle = {
    '--lms-ai-note-progress-border': topBd,
    '--lms-ai-note-progress-bg': isDark ? 'rgba(15,20,36,.5)' : 'rgba(255,255,255,.72)',
  };
  const progressTrackStyle = {
    height: 4,
    overflow: 'hidden',
    borderRadius: 999,
    background: isDark ? 'rgba(148,163,184,.16)' : 'rgba(148,163,184,.2)',
  };
  const markCompleteStyle = {
    minHeight: 38,
    border: `1px solid ${lessonCompleted ? '#10b98155' : '#2563eb55'}`,
    background: lessonCompleted ? '#10b98122' : (isDark ? 'rgba(96,165,250,.14)' : '#eff6ff'),
    color: lessonCompleted ? (isDark ? '#a7f3d0' : '#047857') : (isDark ? '#bfdbfe' : '#1d4ed8'),
    borderRadius: 12,
    padding: '0 12px',
    fontSize: 11,
    fontWeight: 900,
    cursor: lessonCompleted ? 'default' : 'pointer',
    opacity: completionBusy ? 0.7 : 1,
    whiteSpace: 'nowrap',
    boxShadow: lessonButtonShadow,
  };

  if (loading) return (
    <main style={{ minHeight:'100dvh', background:pageBg }}>
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:grid-cols-1 max-[1180px]:px-4 max-[520px]:px-3">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, alignItems:'start' }}>
          {[1,2,3,4,5,6].map((i,j) => <div key={i} className="animate-pulse" style={{ height:[220,160,200,180,240,140][j], borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb', gridColumn:j===0?'1/-1':'span 1' }}/>)}
        </div>
        <div className="animate-pulse" style={{ height:320, borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb' }}/>
      </div>
    </main>
  );

  if (error) return (
    <main style={{ minHeight:'100dvh', background:pageBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <p style={{ fontSize:14, color:isDark?'#94a3b8':'#6b7280', marginBottom:16 }}>{error}</p>
        <button className="inline-flex items-center justify-center" onClick={handleBack} style={{ border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'8px 18px', fontSize:12, fontWeight:600, color:btnTx, cursor:'pointer' }}>Go back</button>
      </div>
    </main>
  );

  if (!note) return null;

  const isLocked = Boolean(note.accessLocked);
  const pages    = localData?.pages || [];
  const canEdit  = isEditing && !isLocked;
  const canvasTitle = cleanCanvasLabel(note.lessonTitle || note.title, 'Lesson');
  const canvasContext = [
    cleanCanvasLabel(note.courseTitle),
    cleanCanvasLabel(note.topicName),
    cleanCanvasLabel(note.subtopicName),
  ].filter(Boolean).join(' / ');

  return (
    <main ref={pageRef} className="lms-ai-note-page select-text [-webkit-user-select:text]" style={{ minHeight:'100dvh', background:pageBg }}>
      <SmoothCanvasMotion />
      {/* Top bar */}
      <div className="lms-ai-note-topbar" style={{ position:'relative', zIndex:40, background:topBg, borderBottom:`1px solid ${topBd}` }}>
        <div className="lms-ai-note-topbar-inner" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr)', alignItems:'center', gap:10, maxWidth:1680, margin:'0 auto', padding:'calc(10px + env(safe-area-inset-top, 0px)) 24px 12px' }}>
          <div className="lms-ai-note-title-block" style={{ minWidth:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
              <div style={{ ...KL, minWidth:0, fontSize:16, fontWeight:700, color:isDark?'#f0f4ff':'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasTitle}</div>
              {note.isFree ? (
                <span style={{ flexShrink:0, border:'1px solid rgba(16,185,129,.25)', background:'rgba(16,185,129,.12)', color:isDark?'#86efac':'#047857', borderRadius:999, padding:'2px 8px', fontSize:10, fontWeight:900, textTransform:'uppercase' }}>
                  Free lesson
                </span>
              ) : null}
            </div>
            {canvasContext && <div style={{ fontSize:11, color:isDark?'rgba(200,210,255,.45)':'#9ca3af', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasContext}</div>}
            <div className="lms-ai-note-control-row">
              <button className="lms-ai-note-back-button lms-smooth-action inline-flex items-center justify-center" onClick={handleBack} style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', fontSize:12, fontWeight:700, color:btnTx, cursor:'pointer', flexShrink:0, boxShadow:lessonButtonShadow }}>
                <BackIcon/> Lessons
              </button>
              <ThemeToggle />
              <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
                onClick={() => navigate(`/flashcards?noteId=${note.id || id || lessonId}`)}
                disabled={isLocked}
                style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', fontSize:11, fontWeight:800, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : 1, boxShadow:lessonButtonShadow }}>
                Flashcards
              </button>
              <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
                onClick={toggleEditing}
                disabled={isLocked}
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:6,
                  border:`1px solid ${isEditing ? (isDark ? 'rgba(167,139,250,.42)' : '#7c3aed') : btnBd}`,
                  background:isEditing ? (isDark ? 'linear-gradient(180deg,rgba(167,139,250,.22),rgba(96,165,250,.10))' : '#f5f3ff') : btnBg,
                  borderRadius:12,
                  padding:'0 12px',
                  fontSize:11,
                  fontWeight:800,
                  color:isEditing ? (isDark ? '#ddd6fe' : '#6d28d9') : btnTx,
                  cursor:'pointer',
                  opacity:isLocked ? 0.4 : 1,
                  boxShadow:isEditing && isDark ? '0 10px 24px rgba(88,28,135,.18), inset 0 1px 0 rgba(255,255,255,.12)' : lessonButtonShadow,
                }}
              >
                {isEditing ? 'Done' : 'Personalize'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!isLocked && pages.length > 0 && typeof document !== 'undefined' ? createPortal(
        <div className="lms-ai-note-reading-dock" style={progressPanelStyle}>
          <div className="lms-ai-note-reading-dock__inner">
            <div className="lms-ai-note-progress-inline lms-ai-note-progress-inline--floating">
              <div
                aria-label={`Reading progress ${readingProgress}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={readingProgress}
                role="progressbar"
                style={progressTrackStyle}
              >
                <span style={{ display:'block', width:`${readingProgress}%`, height:'100%', borderRadius:'inherit', background:'linear-gradient(90deg,#3b82f6,#6d35df)', transition:'width 120ms linear' }} />
              </div>
            </div>
            <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center" type="button" onClick={markLessonComplete} disabled={completionBusy || lessonCompleted} style={markCompleteStyle}>
              {completionBusy ? 'Saving...' : lessonCompleted ? 'Done' : 'Mark Complete'}
            </button>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Body */}
      <div className="lms-ai-canvas-shell mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:px-4 max-[640px]:px-0 max-[520px]:gap-3">
        <section className="lms-ai-note-main min-w-0">
          <div ref={canvasRef} style={{ position:'relative', minWidth:0, maxWidth:'100%' }}>
            {stickers.map(s => <FloatingSticker key={s.id} s={s} editable={canEdit} onUpdate={updateSticker} onDelete={deleteSticker} canvasRef={canvasRef}/>)}

            {isLocked ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fff', padding:48, textAlign:'center' }}>
                <span style={{ color:isDark?'#93c5fd':'#2563eb' }}><LockIcon /></span>
                <div style={{ fontSize:15, fontWeight:800, color:isDark?'#f0f4ff':'#374151' }}>{note.upgradeLabel||'Plan access needed'}</div>
                <div style={{ fontSize:13, color:isDark?'#94a3b8':'#6b7280' }}>{note.lockReason||'This lesson is included with selected subscriptions.'}</div>
                <button className="inline-flex items-center justify-center" onClick={() => navigate('/subscriptions',{state:{from:location.pathname}})}
                  style={{ background:isDark?'rgba(167,139,250,.14)':'#f5f3ff', color:isDark?'#ddd6fe':'#6d28d9', borderRadius:12, padding:'10px 20px', fontSize:12, fontWeight:800, border:`1px solid ${isDark?'rgba(167,139,250,.28)':'rgba(124,58,237,.24)'}`, cursor:'pointer' }}>View access options</button>
              </div>
            ) : pages.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
                {pages.map((pageData, i) => (
                  <CanvasPage
                    key={pageData.id || pageData.title || i}
                    pageData={pageData}
                    index={i}
                    note={note}
                    topBd={topBd}
                    isDark={isDark}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fff', textAlign:'center' }}>
                <span style={{ fontSize:48 }}>📋</span>
                <div style={{ fontSize:14, fontWeight:600, color:isDark?'#94a3b8':'#6b7280' }}>Lesson not yet published</div>
                <div style={{ fontSize:12, color:isDark?'#64748b':'#9ca3af' }}>This lesson is being prepared by your instructor.</div>
              </div>
            )}
          </div>
        </section>
        <aside className="lms-ai-note-right-panel min-w-0">
          <MemoRightPanel
            onStickerAdd={addSticker}
            note={note}
            isDark={isDark}
            isEditing={canEdit}
            videoUrl={videoUrl}
            onNoteAdd={addStickyNote}
            onOpenVideo={openVideo}
          />
        </aside>
      </div>

      <WatchVideoModal
        open={videoOpen}
        url={videoUrl}
        onClose={() => setVideoOpen(false)}
        isDark={isDark}
      />

      {toast && (
        <div className="lms-toast" style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:50 }}>
          <div style={{ ...KL, display:'flex', alignItems:'center', gap:8, border:`1px solid ${topBd}`, background:isDark?'#1a1d2e':'#fff', borderRadius:16, padding:'10px 20px', fontSize:13, fontWeight:600, color:isDark?'#f0f4ff':'#374151', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }}>{toast}</div>
        </div>
      )}

    </main>
  );
}
