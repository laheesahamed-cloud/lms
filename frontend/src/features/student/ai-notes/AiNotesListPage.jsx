import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listAiNotes } from '../../../api/aiNotes.api.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../api/studyBookmarks.api.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

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
function CourseIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 5.5C5.5 5.5 8 6 10 7.5C12 6 14.5 5.5 16.5 5.5V16C14.5 16 12 16.5 10 18C8 16.5 5.5 16 3.5 16V5.5Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round"/><path d="M10 7.5V18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function LessonIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.55"/><path d="M7 7.5H13M7 10.5H13M7 13.5H10.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/></svg>;
}
function SubjectIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.55"/><path d="M6.5 8H13.5M6.5 12H11" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/></svg>;
}
function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ChevronIcon({ open }) {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}><path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 7V5.6C4.5 3.7 6 2.25 8 2.25S11.5 3.7 11.5 5.6V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3.25" y="7" width="9.5" height="6.25" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 9.3v1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Course card (hub view) ────────────────────────────────────────────────────
function CourseCard({ course, onClick, isDark }) {
  const subjects = [...course.subjects.values()];
  const count = subjects.reduce((n, s) => n + s.notes.length, 0);
  const labels = subjects.map(s => s.label).filter(Boolean).slice(0, 3);
  const moreCount = Math.max(0, subjects.filter(s => s.label).length - labels.length);

  return (
    <button
      onClick={onClick}
      className="lms-student-delight group flex min-h-[180px] w-full cursor-pointer flex-col justify-between rounded-2xl border border-line-soft bg-surface-card text-left shadow-sm outline-none transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-brand-primary/24 hover:shadow-[0_18px_44px_rgba(0,0,0,0.10)] focus-visible:ring-4 focus-visible:ring-brand-primary/22 dark:border-white/[0.08] dark:bg-[rgba(6,10,18,0.96)]"
    >
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary">
            <CourseIcon />
          </span>
          <div>
            <div className="line-clamp-2 text-[15px] font-extrabold leading-snug text-ink-strong">
              {course.label || 'General'}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-ink-muted">
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[30px] font-extrabold leading-none text-ink-strong">{count}</div>
          <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">lessons</div>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {labels.map((s, i) => (
            <span key={i} className="rounded-full border border-line-soft bg-surface-2 px-2.5 py-0.5 text-[10px] font-bold text-ink-medium">
              {s}
            </span>
          ))}
          {moreCount > 0 && (
            <span className="text-[10px] font-semibold text-ink-muted">+{moreCount} more</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary">Open course</span>
        <span className="text-base font-bold text-ink-muted transition-opacity group-hover:text-brand-primary">›</span>
      </div>
    </button>
  );
}

// ── Note card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onClick, bookmarked, onToggleBookmark, isDark }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={onClick}
      className="lms-student-delight group cursor-pointer overflow-hidden rounded-xl border border-line-soft bg-surface-card shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand-primary/22 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.035]"
    >
      <div className="p-4">
        <div className="mb-2.5 flex items-start gap-2.5">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary">
            <LessonIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[13px] font-extrabold leading-snug text-ink-strong">{note.title}</div>
            {note.lessonTitle && note.lessonTitle !== note.title && (
              <div className="mt-0.5 truncate text-[11px] font-semibold text-ink-muted">{note.lessonTitle}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {note.isFree && (
            <span className="rounded-full border border-emerald-500/22 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
              Free lesson
            </span>
          )}
          {note.subtopicName && (
            <span className="rounded-full border border-line-soft bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-medium">
              {note.subtopicName}
            </span>
          )}
          {note.accessLocked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-error/20 bg-brand-error/8 px-2 py-0.5 text-[10px] font-semibold text-brand-error">
              <LockIcon /> Plan access needed
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-2.5">
        <span className="text-[10.5px] font-bold text-ink-muted transition-colors group-hover:text-brand-primary">
          {note.accessLocked ? 'Included with selected plans' : 'Open lesson'}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {!note.accessLocked && (
            <button type="button" className="rounded-full border border-line-soft bg-surface-2 px-2 py-1 text-[10px] font-black text-ink-medium transition hover:text-brand-primary"
              onClick={e => { e.stopPropagation(); navigate(`/flashcards?noteId=${note.id}`); }}
            >
              Cards
            </button>
          )}
          <span className="hidden text-[10px] text-ink-muted min-[420px]:inline">{fmtDate(note.updatedAt)}</span>
          <button type="button" className={cx(
              'rounded-full border px-2 py-1 text-[10px] font-black transition',
              bookmarked
                ? 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary'
                : 'border-line-soft bg-surface-2 text-ink-muted hover:text-ink-strong'
            )}
            onClick={e => { e.stopPropagation(); onToggleBookmark(note.id); }}
          >
            {bookmarked ? 'Saved' : 'Save'}
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 py-3 shadow-sm dark:border-white/[0.08] dark:bg-[rgba(6,10,18,0.92)] max-[520px]:px-3 max-[520px]:py-2.5">
        <button className={cx(ui.secondaryButton, 'min-h-9 px-3 text-[12px]')}
          onClick={onBack}>
          <BackIcon /> All Courses
        </button>
        <div className="h-4 w-px bg-line-soft" />
        <span className="min-w-0 truncate text-[13px] font-extrabold text-ink-strong">{course.label || 'General'}</span>
        {subjects.length > 1 && (
          <>
            <div className="h-4 w-px bg-line-soft" />
            {subjects.map((s, i) => (
              <button key={i} className={cx('rounded-xl border px-3 py-1.5 text-[11px] font-bold transition',
                  activeSubj === s.label
                    ? 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary'
                    : 'border-line-soft bg-surface-1 text-ink-medium hover:text-ink-strong'
                )}
                onClick={() => setActiveSubj(activeSubj === s.label ? null : s.label)}>
                {s.label || 'General'}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Subject accordions */}
      {filtered.map((subj) => {
        const key = subj.label || '__none__';
        const isOpen = open.has(key);

        return (
          <div key={key}>
            <button
              className="flex w-full items-center justify-between rounded-xl border border-line-soft bg-surface-card px-5 py-3.5 text-left shadow-sm transition hover:border-brand-primary/22 dark:border-white/[0.08] dark:bg-[rgba(6,10,18,0.92)]"
              onClick={() => toggle(key)}
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary">
                  <SubjectIcon />
                </span>
                <span className="text-[14px] font-extrabold text-ink-strong">
                  {subj.label || 'General'}
                </span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-extrabold text-ink-muted">
                  {subj.notes.length}
                </span>
              </div>
              <span className="text-ink-muted"><ChevronIcon open={isOpen} /></span>
            </button>

            {isOpen && (
              <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 max-[900px]:grid-cols-1">
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
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={headerTitle}
          subtitle={selectedCourse ? selectedCourse : defaultSubtitle}
        />

        {!selectedCourse ? (
          <StudentPageHero
            title={headerTitle}
            subtitle={defaultSubtitle}
            tone="blue"
            metrics={[
              { label: 'Lessons', value: loading ? '-' : notes.length },
              { label: 'Courses', value: loading ? '-' : hierarchy.length },
              { label: 'Subjects', value: loading ? '-' : subjectCount },
            ]}
          />
        ) : null}

        {/* Search */}
        <div className="rounded-lg border border-line-soft bg-surface-card p-3 shadow-sm dark:border-white/[0.07] dark:bg-[rgba(6,10,18,0.92)] max-[520px]:p-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <SearchIcon />
            </span>
            <input
              className={cx(ui.input, 'pl-10 pr-11 max-[520px]:min-h-10 max-[520px]:text-[13px]')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search lessons, topics, courses..."
            />
            {search && (
              <button className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[13px] font-black text-ink-muted transition hover:bg-surface-2 hover:text-ink-strong" onClick={() => setSearch('')} aria-label="Clear lesson search">✕</button>
            )}
          </div>
        </div>

        {error && (
          <div className={cx(ui.feedbackError, 'flex items-center justify-between gap-3')}>
            {error}
            <button className="ml-3 font-bold" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={cx(ui.skeletonCard, 'h-[160px] max-[520px]:h-[132px]')} />
            ))}
          </div>
        ) : !selectedCourse || !activeCourse ? (
          hierarchy.length === 0 ? (
            <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3 py-10')}>
              <span className="grid size-12 place-items-center rounded-xl border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary">
                <LessonIcon />
              </span>
              <p className="m-0 text-center text-[15px] font-semibold text-ink-medium">
                {search ? 'No lessons match your search.' : 'No lessons yet.'}
              </p>
              <p className="m-0 text-center text-[13px] text-ink-muted">
                {search ? 'Try different keywords.' : 'Lessons will appear here once published by your instructor.'}
              </p>
              {search && (
                <button className={cx(ui.secondaryButton, 'min-h-10 px-4 text-xs')}
                  onClick={() => setSearch('')}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <section className={cx(ui.panelCard, 'animate-fadePop max-[640px]:border-0 max-[640px]:bg-transparent max-[640px]:p-0 max-[640px]:shadow-none')}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 max-[640px]:hidden">
                <div>
                  <span className={ui.eyebrow}>Lessons</span>
                  <h2 className="m-0 mt-2 text-[18px] font-extrabold leading-tight text-ink-strong">Choose a course</h2>
                </div>
                <span className="rounded-full border border-line-soft bg-surface-2 px-3 py-1 text-[11px] font-extrabold text-ink-muted">
                  {hierarchy.length} {hierarchy.length === 1 ? 'course' : 'courses'}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
                {hierarchy.map((course, i) => (
                  <CourseCard key={i} course={course} isDark={isDark} onClick={() => selectCourse(course.label)} />
                ))}
              </div>
            </section>
          )
        ) : (
          <section className={cx(ui.panelCard, 'animate-fadePop max-[640px]:border-0 max-[640px]:bg-transparent max-[640px]:p-0 max-[640px]:shadow-none')}>
            <CourseDetail
              course={activeCourse}
              onBack={() => selectCourse(null)}
              bookmarkedIds={bookmarkedIds}
              onToggleBookmark={handleToggleBookmark}
              routeBase={routeBase}
              isDark={isDark}
            />
          </section>
        )}
      </section>
    </main>
  );
}
