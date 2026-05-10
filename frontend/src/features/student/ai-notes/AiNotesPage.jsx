import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAiNote, getLessonAiNote } from '../../../api/aiNotes.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { recordStudyActivity } from '../../../api/dashboard.api.js';
import { getVideoEmbed, getVideoThumbnail } from '../../../utils/videoEmbed.js';
import { NoteCanvas } from './NoteCanvas.jsx';

// ── Fonts ─────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('canvas-hand-font')) {
  const lnk = document.createElement('link');
  lnk.id = 'canvas-hand-font'; lnk.rel = 'stylesheet';
  lnk.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(lnk);
}
const KL = { fontFamily: "'Patrick Hand', cursive" };

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
const LABEL_CHIPS = [
  { text: 'Definition', c: '#1d4ed8', bg: '#dbeafe' },
  { text: 'Clinical', c: '#047857', bg: '#d1fae5' },
  { text: 'Exam Tip', c: '#92400e', bg: '#fef3c7' },
  { text: 'Pathway', c: '#6d28d9', bg: '#ede9fe' },
  { text: 'Warning', c: '#b91c1c', bg: '#fee2e2' },
];

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
          className="rounded-xl border border-amber-300/70 bg-amber-100/95 p-3 text-slate-900 shadow-[0_12px_24px_rgba(120,72,20,.16)]"
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
      }
      @media (max-width: 760px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: 1fr !important;
          align-items: stretch !important;
        }
        .lms-ai-note-topbar-actions {
          justify-content: flex-start !important;
          flex-wrap: wrap;
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
  const text = isDark ? '#f8fafc' : '#0f172a';
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

function StudyStructurePanel({ note, pages, isDark }) {
  const bg = isDark ? '#12141f' : '#fff';
  const bd = isDark ? 'rgba(255,255,255,.09)' : '#e5e7eb';
  const text = isDark ? 'rgba(240,244,255,.92)' : '#111827';
  const muted = isDark ? 'rgba(200,210,255,.52)' : '#64748b';
  const tones = ['#2563eb', '#7c3aed', '#0891b2', '#059669'];
  const baseItems = [
    note?.courseTitle && { label:'Course', title:note.courseTitle, icon:'📚' },
    note?.topicName && { label:'Subject', title:note.topicName, icon:'🏷️' },
    note?.subtopicName && { label:'Subtopic', title:note.subtopicName, icon:'📌' },
    (note?.lessonTitle || note?.title) && { label:'Lesson', title:note.lessonTitle || note.title, icon:'▶' },
  ].filter(Boolean);
  const pageItems = (pages || []).map((p, i) => ({
    label:`Page ${i + 1}`,
    title:p?.title || (i === 0 ? note?.title : 'Study section'),
    icon:'📄',
  }));
  const items = baseItems.length ? baseItems : [{ label:'Lesson', title:note?.title || 'Study Lesson', icon:'📝' }];
  return (
    <div style={{ position:'sticky', top:72 }}>
      <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:18, padding:'14px 15px', marginBottom:12, boxShadow:isDark?'0 18px 48px rgba(0,0,0,.22)':'0 16px 34px rgba(15,23,42,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontFamily:'sans-serif', fontSize:9, fontWeight:900, letterSpacing:'0.12em', textTransform:'uppercase', color:muted }}>Study Structure</div>
            <div style={{ ...KL, fontSize:20, fontWeight:800, color:text, lineHeight:1.05 }}>Selected lesson map</div>
          </div>
          <span style={{ display:'grid', placeItems:'center', width:34, height:34, borderRadius:12, background:isDark?'rgba(124,58,237,.16)':'#f3e8ff', color:'#7c3aed', fontSize:17 }}>☰</span>
        </div>
        <div style={{ position:'relative', display:'grid', gap:9 }}>
          <span aria-hidden="true" style={{ position:'absolute', left:15, top:22, bottom:22, width:1, background:isDark?'rgba(255,255,255,.08)':'#e2e8f0' }} />
          {items.map((it, i) => {
            const tone = tones[i % tones.length];
            return (
              <div key={`${it.label}-${i}`} style={{ position:'relative', display:'grid', gridTemplateColumns:'32px 1fr', gap:10, alignItems:'start' }}>
                <span style={{ zIndex:1, display:'grid', placeItems:'center', width:32, height:32, borderRadius:12, background:isDark?`${tone}24`:`${tone}14`, border:`1px solid ${tone}35`, fontSize:14 }}>{it.icon}</span>
                <div style={{ minWidth:0, border:`1px solid ${bd}`, background:isDark?'rgba(255,255,255,.035)':'#f8fafc', borderRadius:14, padding:'8px 10px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', border:`1px solid ${tone}35`, background:isDark?`${tone}1e`:`${tone}12`, color:tone, borderRadius:999, padding:'1px 8px', fontSize:9, fontWeight:900, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 }}>{it.label}</span>
                  <div style={{ ...KL, fontSize:15, fontWeight:800, color:text, lineHeight:1.12, wordBreak:'break-word' }}>{it.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:18, padding:'14px 15px' }}>
        <div style={{ fontFamily:'sans-serif', fontSize:9, fontWeight:900, letterSpacing:'0.12em', textTransform:'uppercase', color:muted, marginBottom:10 }}>Lesson Sections</div>
        <div style={{ display:'grid', gap:7 }}>
          {(pageItems.length ? pageItems : [{ label:'Page 1', title:'Main lesson', icon:'📄' }]).map((it, i) => (
            <div key={`${it.label}-${i}`} style={{ display:'flex', alignItems:'center', gap:8, border:`1px solid ${bd}`, borderRadius:12, padding:'7px 9px', background:isDark?'rgba(255,255,255,.035)':'#f8fafc' }}>
              <span style={{ fontSize:13 }}>{it.icon}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:9, fontWeight:800, color:muted, textTransform:'uppercase', letterSpacing:'.08em' }}>{it.label}</div>
                <div style={{ ...KL, fontSize:13.5, fontWeight:700, color:text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
function RightPanel({ onStickerAdd, onNoteAdd, note, isDark, pages, isEditing, videoUrl, onOpenVideo }) {
  const [stickerOpen, setStickerOpen] = useState(false);
  const navigate = useNavigate();
  const mcq = getMCQTag(note);
  const bg  = isDark?'#12141f':'#fff', bd=isDark?'rgba(255,255,255,.09)':'#e5e7eb';
  const lbl = isDark?'rgba(200,210,255,.4)':'#9ca3af', tx=isDark?'rgba(220,230,255,.82)':'#374151';
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
          style={{ width:'100%', background:'#7c3aed', color:'#fff', borderRadius:11, padding:'8px 0', fontSize:11, fontWeight:800, border:'none', cursor:'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background='#6d28d9'}
          onMouseLeave={e => e.currentTarget.style.background='#7c3aed'}>
          Start MCQ Session →
        </button>
      </>)}
      {C(<>
        {L('Headers & Labels')}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {LABEL_CHIPS.map((c,i) => <span key={i} style={{ background:isDark?`${c.bg}18`:c.bg, color:c.c, border:`1px solid ${c.c}35`, borderRadius:99, padding:'2px 10px', fontSize:10, fontWeight:600 }}>{c.text}</span>)}
        </div>
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
      {note && C(<>
        {L('Lesson Info')}
        {[note.courseTitle&&{icon:'📚',label:'Course',val:note.courseTitle}, note.topicName&&{icon:'🏷️',label:'Subject',val:note.topicName}, note.subtopicName&&{icon:'📌',label:'Topic',val:note.subtopicName}, {icon:'📄',label:'Pages',val:`${pages.length} page${pages.length!==1?'s':''}`}]
          .filter(Boolean).map((it,i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:8 }}>
            <span style={{ fontSize:13 }}>{it.icon}</span>
            <div><div style={{ fontSize:10, color:lbl, fontFamily:'sans-serif' }}>{it.label}</div><div style={{ fontSize:12, fontWeight:600, color:tx }}>{it.val}</div></div>
          </div>
        ))}
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

const MemoStudyStructurePanel = memo(StudyStructurePanel);
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
function DownloadIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v6.5M4 6l2.5 3 2.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function PrintIcon()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2.5" y="1" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 6H1a.5.5 0 0 0-.5.5v4.5c0 .276.224.5.5.5H12a.5.5 0 0 0 .5-.5V6.5A.5.5 0 0 0 12 6H10.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2.5" y="7.5" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg>; }

// ── Main page ─────────────────────────────────────────────────────────────────
export function AiNotesPage({ engineKey='gemini', headerTitle='Lesson', backLabel='Lessons' }) {
  const { id, lessonId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useDark();
  const canvasRef = useRef(null);

  const [note,      setNote]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const [localData, setLocalData] = useState(null);
  const [stickers,  setStickers]  = useState([]);
  const [toast,     setToast]     = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [videoUrl,  setVideoUrl]  = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
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
      }
        recordStudyActivity({ activityType:'ai_note_viewed', itemId:Number(data.id||id||lessonId) }).catch(()=>{});
      })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e,'Failed to load lesson.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [engineKey, id, lessonId]);

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

  async function handleExportPng() {
    if (!canvasRef.current) return; setExportMsg('Capturing…');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const cv = await html2canvas(canvasRef.current, { scale:2, useCORS:true, backgroundColor:isDark?'#0d0f1a':'#fefcf8', logging:false });
      const a = document.createElement('a'); a.href = cv.toDataURL('image/png');
      a.download = `${(note?.title||'canvas').replace(/\s+/g,'-').toLowerCase()}.png`; a.click();
      setExportMsg('PNG saved!');
    } catch { setExportMsg('Export failed'); }
    finally { setTimeout(() => setExportMsg(''), 2500); }
  }

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

  const pageBg = isDark?'#0d0f1a':'#faf8f4';
  const topBg  = isDark?'rgba(13,15,26,.96)':'rgba(255,255,255,.96)';
  const topBd  = isDark?'rgba(255,255,255,.08)':'#e5e7eb';
  const btnBg  = isDark?'rgba(255,255,255,.06)':'#f9fafb';
  const btnBd  = isDark?'rgba(255,255,255,.12)':'#e5e7eb';
  const btnTx  = isDark?'rgba(220,230,255,.75)':'#374151';

  if (loading) return (
    <main style={{ minHeight:'100vh', background:pageBg }}>
      <div className="mx-auto grid max-w-[1680px] grid-cols-[280px_minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:grid-cols-1 max-[1180px]:px-4 max-[520px]:px-3">
        <div className="animate-pulse" style={{ height:360, borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb' }}/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, alignItems:'start' }}>
          {[1,2,3,4,5,6].map((i,j) => <div key={i} className="animate-pulse" style={{ height:[220,160,200,180,240,140][j], borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb', gridColumn:j===0?'1/-1':'span 1' }}/>)}
        </div>
        <div className="animate-pulse" style={{ height:320, borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb' }}/>
      </div>
    </main>
  );

  if (error) return (
    <main style={{ minHeight:'100vh', background:pageBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
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
    <main style={{ minHeight:'100vh', background:pageBg }}>
      <SmoothCanvasMotion />
      {/* Top bar */}
      <div className="lms-ai-note-topbar" style={{ position:'sticky', top:0, zIndex:40, background:topBg, borderBottom:`1px solid ${topBd}`, backdropFilter:'blur(12px)' }}>
        <div className="lms-ai-note-topbar-inner" style={{ display:'grid', gridTemplateColumns:'280px minmax(0,1fr) 280px', alignItems:'center', gap:20, maxWidth:1680, margin:'0 auto', padding:'10px 24px' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', minWidth:0 }}>
            <button className="lms-smooth-action inline-flex items-center justify-center" onClick={handleBack} style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'6px 12px', fontSize:12, fontWeight:600, color:btnTx, cursor:'pointer', flexShrink:0 }}>
              <BackIcon/> Lessons
            </button>
          </div>
          <div style={{ minWidth:0, overflow:'hidden' }}>
            <div style={{ ...KL, fontSize:16, fontWeight:700, color:isDark?'#f0f4ff':'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasTitle}</div>
            {canvasContext && <div style={{ fontSize:11, color:isDark?'rgba(200,210,255,.45)':'#9ca3af', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasContext}</div>}
          </div>
          <div className="lms-ai-note-topbar-actions" style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, minWidth:0 }}>
            <button className="lms-smooth-action inline-flex items-center justify-center"
              onClick={() => navigate(`/flashcards?noteId=${note.id || id || lessonId}`)}
              disabled={isLocked}
              style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'6px 12px', fontSize:11, fontWeight:800, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : 1 }}>
              Flashcards
            </button>
            <button className="lms-smooth-action inline-flex items-center justify-center"
              onClick={toggleEditing}
              disabled={isLocked}
              style={{
                display:'flex',
                alignItems:'center',
                gap:6,
                border:`1px solid ${isEditing ? '#7c3aed' : btnBd}`,
                background:isEditing ? '#7c3aed' : btnBg,
                borderRadius:12,
                padding:'6px 12px',
                fontSize:11,
                fontWeight:800,
                color:isEditing ? '#fff' : btnTx,
                cursor:'pointer',
                opacity:isLocked ? 0.4 : 1,
              }}
            >
              {isEditing ? 'Done' : 'Personalize'}
            </button>
            <button className="lms-smooth-action inline-flex items-center justify-center" onClick={handleExportPng} disabled={isLocked} style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'6px 12px', fontSize:11, fontWeight:600, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : 1 }}><DownloadIcon/> PNG</button>
            <button className="lms-smooth-action inline-flex items-center justify-center" onClick={() => window.print()} disabled={isLocked} style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'6px 12px', fontSize:11, fontWeight:600, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : 1 }}><PrintIcon/> PDF</button>
            {exportMsg && <span style={{ fontSize:11, color:isDark?'#94a3b8':'#6b7280' }}>{exportMsg}</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="lms-ai-canvas-shell mx-auto grid max-w-[1680px] grid-cols-[280px_minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:grid-cols-1 max-[1180px]:px-4 max-[520px]:gap-4 max-[520px]:px-3">
        <aside>
          <MemoStudyStructurePanel note={note} pages={pages} isDark={isDark} />
        </aside>
        <section>
          <div ref={canvasRef} style={{ position:'relative' }}>
            {!isLocked && (
              <button className="lms-smooth-action inline-flex items-center justify-center"
                onClick={toggleEditing}
                style={{
                  position:'sticky',
                  top:64,
                  zIndex:35,
                  float:'right',
                  display:'flex',
                  alignItems:'center',
                  gap:7,
                  margin:'0 8px -42px 0',
                  border:`1px solid ${isEditing ? '#7c3aed' : btnBd}`,
                  background:isEditing ? '#7c3aed' : (isDark ? 'rgba(18,20,31,.94)' : 'rgba(255,255,255,.94)'),
                  borderRadius:999,
                  padding:'8px 14px',
                  fontSize:12,
                  fontWeight:900,
                  color:isEditing ? '#fff' : btnTx,
                  cursor:'pointer',
                  boxShadow:isDark ? '0 10px 28px rgba(0,0,0,.35)' : '0 10px 24px rgba(15,23,42,.10)',
                  backdropFilter:'blur(12px)',
                }}
              >
                {isEditing ? 'Done' : 'Personalize'}
              </button>
            )}
            {stickers.map(s => <FloatingSticker key={s.id} s={s} editable={canEdit} onUpdate={updateSticker} onDelete={deleteSticker} canvasRef={canvasRef}/>)}

            {isLocked ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fff', padding:48, textAlign:'center' }}>
                <span style={{ fontSize:48 }}>🔒</span>
                <div style={{ fontSize:15, fontWeight:800, color:isDark?'#f0f4ff':'#111827' }}>{note.upgradeLabel||'Available in Standard plan'}</div>
                <div style={{ fontSize:13, color:isDark?'#94a3b8':'#6b7280' }}>{note.lockReason||'Upgrade to unlock full lesson access.'}</div>
                <button className="inline-flex items-center justify-center" onClick={() => navigate('/subscriptions',{state:{from:location.pathname}})}
                  style={{ background:'#7c3aed', color:'#fff', borderRadius:12, padding:'10px 20px', fontSize:12, fontWeight:800, border:'none', cursor:'pointer' }}>Unlock Access</button>
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
        <aside>
          <MemoRightPanel
            onStickerAdd={addSticker}
            note={note}
            isDark={isDark}
            pages={pages}
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
