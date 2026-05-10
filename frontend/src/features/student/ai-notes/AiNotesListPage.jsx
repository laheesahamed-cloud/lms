import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listAiNotes } from '../../../api/aiNotes.api.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../api/studyBookmarks.api.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { cx } from '../../../styles/tailwindClasses.js';

function runWhenIdle(task) {
  if (typeof window === 'undefined') {
    task();
    return () => {};
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(task, 300);
  return () => window.clearTimeout(timer);
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function useDark() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Medical subject palette (light + dark) ────────────────────────────────────
const MED = {
  cardiology:   { l:{ bg:'#fce7f3', bd:'#f9a8d4', tx:'#9d174d' }, d:{ bg:'rgba(244,114,182,.10)', bd:'rgba(249,168,212,.22)', tx:'#f9a8d4' }, icon:'🫀' },
  neurology:    { l:{ bg:'#dbeafe', bd:'#93c5fd', tx:'#1e3a5f' }, d:{ bg:'rgba(96,165,250,.10)',  bd:'rgba(147,197,253,.22)', tx:'#93c5fd' }, icon:'🧠' },
  pharmacology: { l:{ bg:'#ede9fe', bd:'#c4b5fd', tx:'#4a1d96' }, d:{ bg:'rgba(167,139,250,.10)', bd:'rgba(196,181,253,.22)', tx:'#c4b5fd' }, icon:'💊' },
  pathology:    { l:{ bg:'#fff7ed', bd:'#fdba74', tx:'#7c2d12' }, d:{ bg:'rgba(251,146,60,.10)',  bd:'rgba(253,186,116,.22)', tx:'#fdba74' }, icon:'🔬' },
  anatomy:      { l:{ bg:'#dcfce7', bd:'#86efac', tx:'#14532d' }, d:{ bg:'rgba(74,222,128,.10)',  bd:'rgba(134,239,172,.22)', tx:'#86efac' }, icon:'🦴' },
  physiology:   { l:{ bg:'#fef9c3', bd:'#fde68a', tx:'#92400e' }, d:{ bg:'rgba(250,204,21,.10)',  bd:'rgba(253,230,138,.22)', tx:'#fde68a' }, icon:'⚡' },
  biochemistry: { l:{ bg:'#ccfbf1', bd:'#5eead4', tx:'#134e4a' }, d:{ bg:'rgba(45,212,191,.10)',  bd:'rgba(94,234,212,.22)',  tx:'#5eead4' }, icon:'🧬' },
  surgery:      { l:{ bg:'#fee2e2', bd:'#fca5a5', tx:'#7f1d1d' }, d:{ bg:'rgba(248,113,113,.10)', bd:'rgba(252,165,165,.22)', tx:'#fca5a5' }, icon:'🏥' },
  microbiology: { l:{ bg:'#fef3c7', bd:'#fcd34d', tx:'#78350f' }, d:{ bg:'rgba(252,211,77,.10)',  bd:'rgba(252,211,77,.22)',  tx:'#fcd34d' }, icon:'🦠' },
  pediatrics:   { l:{ bg:'#e0f2fe', bd:'#7dd3fc', tx:'#0c4a6e' }, d:{ bg:'rgba(125,211,252,.10)', bd:'rgba(125,211,252,.22)', tx:'#7dd3fc' }, icon:'👶' },
  default:      { l:{ bg:'#f1f5f9', bd:'#cbd5e1', tx:'#334155' }, d:{ bg:'rgba(148,163,184,.10)', bd:'rgba(148,163,184,.22)', tx:'#94a3b8' }, icon:'📖' },
};

function getMed(label) {
  const l = (label || '').toLowerCase();
  for (const [k, v] of Object.entries(MED)) {
    if (k !== 'default' && l.includes(k)) return v;
  }
  return MED.default;
}
const p = (med, dark) => (dark ? med.d : med.l);

// ── Data helpers ──────────────────────────────────────────────────────────────
function buildHierarchy(notes) {
  const map = new Map();
  for (const n of notes) {
    const ck = n.courseTitle || '__none__';
    if (!map.has(ck)) map.set(ck, { label: n.courseTitle || null, subjects: new Map() });
    const course = map.get(ck);
    const sk = n.topicName || '__none__';
    if (!course.subjects.has(sk)) course.subjects.set(sk, { label: n.topicName || null, notes: [] });
    course.subjects.get(sk).notes.push(n);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a === '__none__' ? 1 : b === '__none__' ? -1 : a.localeCompare(b))
    .map(([, v]) => v);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ChevronIcon({ open }) {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}><path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// ── Course card (hub view) ────────────────────────────────────────────────────
function CourseCard({ course, onClick, isDark }) {
  const subjects = [...course.subjects.values()];
  const count = subjects.reduce((n, s) => n + s.notes.length, 0);
  const labels = subjects.map(s => s.label).filter(Boolean).slice(0, 3);
  const moreCount = Math.max(0, subjects.filter(s => s.label).length - labels.length);
  const m = getMed(subjects[0]?.label || '');
  const pal = p(m, isDark);

  return (
    <button onClick={onClick} className="group w-full cursor-pointer text-left transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ background: pal.bg, borderRadius: 16, border: `1.5px solid ${pal.bd}` }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[32px] leading-none">{m.icon}</span>
          <div>
            <div className="text-[15px] font-extrabold leading-snug" style={{ color: pal.tx }}>
              {course.label || 'General'}
            </div>
            <div className="mt-0.5 text-[11px] font-medium" style={{ color: pal.tx, opacity: 0.6 }}>
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[32px] font-extrabold leading-none" style={{ color: pal.tx }}>{count}</div>
          <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em]" style={{ color: pal.tx, opacity: 0.5 }}>lessons</div>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {labels.map((s, i) => (
            <span key={i} className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${pal.bd}`, color: pal.tx }}>
              {s}
            </span>
          ))}
          {moreCount > 0 && (
            <span className="text-[10px] font-semibold" style={{ color: pal.tx, opacity: 0.55 }}>+{moreCount} more</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: `1px solid ${pal.bd}` }}>
        <span className="text-[11px] font-semibold" style={{ color: pal.tx, opacity: 0.7 }}>Open course</span>
        <span className="text-base font-bold opacity-50 transition-opacity group-hover:opacity-100" style={{ color: pal.tx }}>›</span>
      </div>
    </button>
  );
}

// ── Note card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onClick, bookmarked, onToggleBookmark, isDark }) {
  const navigate = useNavigate();
  const m = getMed(note.topicName || '');
  const pal = p(m, isDark);

  return (
    <div onClick={onClick} className="group cursor-pointer transition-all hover:-translate-y-0.5"
      style={{ background: pal.bg, borderRadius: 14, border: `1.5px solid ${pal.bd}` }}>
      <div className="p-4">
        <div className="mb-2.5 flex items-start gap-2.5">
          <span className="mt-0.5 text-[18px] leading-none shrink-0">{m.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold leading-snug" style={{ color: pal.tx }}>{note.title}</div>
            {note.lessonTitle && note.lessonTitle !== note.title && (
              <div className="mt-0.5 truncate text-[11px]" style={{ color: pal.tx, opacity: 0.6 }}>{note.lessonTitle}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {note.subtopicName && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${pal.bd}`, color: pal.tx }}>
              {note.subtopicName}
            </span>
          )}
          {note.accessLocked && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}>
              🔒 Locked
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: `1px solid ${pal.bd}` }}>
        <span className="text-[10.5px] font-semibold opacity-60 group-hover:opacity-90 transition-opacity"
          style={{ color: pal.tx }}>
          {note.accessLocked ? (note.upgradeLabel || 'Upgrade to access') : 'Open lesson ->'}
        </span>
        <div className="flex items-center gap-2">
          {!note.accessLocked && (
            <button type="button" className="rounded-full px-2 py-1 text-[10px] font-black transition hover:opacity-100"
              onClick={e => { e.stopPropagation(); navigate(`/flashcards?noteId=${note.id}`); }}
              style={{ color: pal.tx, background: 'rgba(255,255,255,0.45)', border: `1px solid ${pal.bd}` }}>
              Cards
            </button>
          )}
          <span className="text-[10px]" style={{ color: pal.tx, opacity: 0.45 }}>{fmtDate(note.updatedAt)}</span>
          <button type="button" className="text-[11px] font-bold transition hover:opacity-100"
            onClick={e => { e.stopPropagation(); onToggleBookmark(note.id); }}
            style={{ color: pal.tx, opacity: bookmarked ? 1 : 0.4 }}>
            {bookmarked ? '🔖' : '+ Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Course detail (subject accordion) ────────────────────────────────────────
function CourseDetail({ course, onBack, bookmarkedIds, onToggleBookmark, routeBase, isDark }) {
  const navigate = useNavigate();
  const subjects = [...course.subjects.values()];
  const [open, setOpen] = useState(() => new Set(subjects.map(s => s.label || '__none__')));
  const [activeSubj, setActiveSubj] = useState(null);

  const filtered = activeSubj ? subjects.filter(s => s.label === activeSubj) : subjects;

  function toggle(key) {
    setOpen(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  return (
    <div className="space-y-4">
      {/* Back + subject filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex items-center gap-1.5 rounded-xl border border-line-soft bg-surface-1 px-3.5 py-2 text-[12px] font-semibold text-ink-medium transition hover:text-ink-strong"
          onClick={onBack}>
          <BackIcon /> All Courses
        </button>
        <div className="h-4 w-px bg-line-soft" />
        <span className="text-[13px] font-extrabold text-ink-strong">{course.label || 'General'}</span>
        {subjects.length > 1 && (
          <>
            <div className="h-4 w-px bg-line-soft" />
            {subjects.map((s, i) => (
              <button key={i} className={cx('rounded-xl border px-3 py-1.5 text-[11px] font-bold transition',
                  activeSubj === s.label
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-line-soft bg-surface-1 text-ink-medium hover:text-ink-strong'
                )}
                onClick={() => setActiveSubj(activeSubj === s.label ? null : s.label)}>
                {getMed(s.label || '').icon} {s.label || 'General'}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Subject accordions */}
      {filtered.map((subj) => {
        const key = subj.label || '__none__';
        const isOpen = open.has(key);
        const m = getMed(subj.label || '');
        const pal = p(m, isDark);

        return (
          <div key={key}>
            <button className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:opacity-90"
              onClick={() => toggle(key)}
              style={{ background: pal.bg, border: `1.5px solid ${pal.bd}`, borderRadius: 14 }}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{m.icon}</span>
                <span className="text-[14px] font-extrabold" style={{ color: pal.tx }}>
                  {subj.label || 'General'}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                  style={{ background: 'rgba(255,255,255,0.5)', color: pal.tx }}>
                  {subj.notes.length}
                </span>
              </div>
              <span style={{ color: pal.tx, opacity: 0.7 }}><ChevronIcon open={isOpen} /></span>
            </button>

            {isOpen && (
              <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
                {subj.notes.map(note => (
                  <NoteCard key={note.id} note={note} isDark={isDark}
                    bookmarked={bookmarkedIds.has(note.id)}
                    onToggleBookmark={onToggleBookmark}
                    onClick={() => navigate(`${routeBase}/${note.id}`, {
                      state: {
                        returnToPath: `${routeBase}${course.label ? `?course=${encodeURIComponent(course.label)}` : ''}`,
                        returnTo: 'list',
                        sourceCourse: course.label || null,
                      },
                    })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AiNotesListPage({
  engineKey = 'gemini',
  routeBase = '/ai-notes',
  headerTitle = 'Lessons',
  defaultSubtitle = 'Illustrated clinical lessons for focused revision.',
}) {
  const isDark = useDark();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const selectedCourse = searchParams.get('course');

  useEffect(() => {
    let cancelled = false;
    let cancelBookmarks = () => {};
    async function load() {
    try {
      setLoading(true); setError('');
      const noteRows = await listAiNotes({ engine: engineKey });
      if (cancelled) return;
      setNotes(noteRows);
      cancelBookmarks = runWhenIdle(async () => {
        const bookmarkRows = await fetchStudyBookmarks().catch(() => []);
        if (cancelled) return;
        setBookmarkedIds(new Set(
          bookmarkRows.filter(b => b.itemType === 'ai_note').map(b => b.itemId)
        ));
      });
    } catch { if (!cancelled) setError('Failed to load lessons.'); }
    finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => {
      cancelled = true;
      cancelBookmarks();
    };
  }, [engineKey]);

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(n =>
      n.title?.toLowerCase().includes(q) ||
      n.topicName?.toLowerCase().includes(q) ||
      n.courseTitle?.toLowerCase().includes(q) ||
      n.subtopicName?.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const hierarchy = useMemo(() => buildHierarchy(filteredNotes), [filteredNotes]);
  const activeCourse = useMemo(
    () => hierarchy.find(c => c.label === selectedCourse) || null,
    [hierarchy, selectedCourse]
  );

  function selectCourse(label) {
    const next = new URLSearchParams(searchParams);
    label ? next.set('course', label) : next.delete('course');
    setSearchParams(next, { replace: false });
  }

  async function handleToggleBookmark(noteId) {
    try {
      const result = await toggleStudyBookmark({ itemType: 'ai_note', itemId: noteId });
      setBookmarkedIds(cur => {
        const next = new Set(cur);
        result.saved ? next.add(noteId) : next.delete(noteId);
        return next;
      });
    } catch { /* silent */ }
  }

  const subjectCount = useMemo(
    () => new Set(notes.map(n => n.topicName).filter(Boolean)).size,
    [notes]
  );

  return (
    <main className="min-h-screen bg-surface-0">
      <section className="mx-auto max-w-[1400px] px-6 pb-12 pt-6 max-[640px]:px-4 max-[420px]:px-3">
        <AppHeader
          title={headerTitle}
          subtitle={selectedCourse ? selectedCourse : defaultSubtitle}
        />

        {/* Stats bar — only on hub view when loaded */}
        {!selectedCourse && !loading && notes.length > 0 && (
          <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3">
            {[
              { icon: '📚', val: notes.length, label: 'Total Lessons' },
              { icon: '🗂️', val: hierarchy.length, label: 'Courses' },
              { icon: '🏷️', val: subjectCount, label: 'Subjects' },
            ].map((item, i) => (
              <div key={i} className="flex min-w-0 items-center gap-2 rounded-2xl border border-line-soft bg-surface-1 px-4 py-2.5">
                <span className="text-[18px]">{item.icon}</span>
                <span className="text-[20px] font-extrabold leading-none text-ink-strong">{item.val}</span>
                <span className="text-[11px] text-ink-muted">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="mb-5 flex min-h-11 items-center gap-3 rounded-2xl border border-line-soft bg-surface-1 px-4 py-2.5">
          <span className="text-ink-muted"><SearchIcon /></span>
          <input className="flex-1 bg-transparent text-[13px] text-ink-strong outline-none placeholder:text-ink-muted"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lessons, topics, courses..."
          />
          {search && (
            <button className="text-[13px] text-ink-muted transition hover:text-ink-strong" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
            <button className="ml-3 font-bold" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[520px]:gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-[160px] animate-pulse rounded-2xl bg-surface-2 max-[520px]:h-[132px]" />
            ))}
          </div>
        ) : !selectedCourse || !activeCourse ? (
          hierarchy.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="mb-4 text-6xl">🩺</span>
              <p className="text-[15px] font-semibold text-ink-medium">
                {search ? 'No lessons match your search.' : 'No lessons yet.'}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {search ? 'Try different keywords.' : 'Lessons will appear here once published by your instructor.'}
              </p>
              {search && (
                <button className="mt-4 rounded-xl border border-line-soft bg-surface-1 px-4 py-2 text-[12px] font-semibold text-ink-medium transition hover:text-ink-strong"
                  onClick={() => setSearch('')}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[520px]:gap-3">
              {hierarchy.map((course, i) => (
                <CourseCard key={i} course={course} isDark={isDark} onClick={() => selectCourse(course.label)} />
              ))}
            </div>
          )
        ) : (
          <CourseDetail
            course={activeCourse}
            onBack={() => selectCourse(null)}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={handleToggleBookmark}
            routeBase={routeBase}
            isDark={isDark}
          />
        )}
      </section>
    </main>
  );
}
