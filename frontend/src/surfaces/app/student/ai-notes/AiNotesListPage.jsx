import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { StudyMascot } from '../../../../shared/ui/StudyMascot.jsx';

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
  cardiology:   { l:{ bg:'#fdf2f8', bd:'#f9a8d4', tx:'#d65b91' }, d:{ bg:'rgba(244,114,182,.10)', bd:'rgba(249,168,212,.22)', tx:'#f9a8d4' }, icon:'🫀' },
  hematology:   { l:{ bg:'#fef2f2', bd:'#fca5a5', tx:'#d85f62' }, d:{ bg:'rgba(248,113,113,.10)', bd:'rgba(252,165,165,.22)', tx:'#fca5a5' }, icon:'🩸' },
  haematology:  { l:{ bg:'#fef2f2', bd:'#fca5a5', tx:'#d85f62' }, d:{ bg:'rgba(248,113,113,.10)', bd:'rgba(252,165,165,.22)', tx:'#fca5a5' }, icon:'🩸' },
  rheumatology: { l:{ bg:'#f0fdf4', bd:'#86efac', tx:'#35a86b' }, d:{ bg:'rgba(74,222,128,.10)', bd:'rgba(134,239,172,.22)', tx:'#86efac' }, icon:'🦵' },
  respiratory:  { l:{ bg:'#ecfeff', bd:'#67e8f9', tx:'#22a6b8' }, d:{ bg:'rgba(34,211,238,.10)', bd:'rgba(103,232,249,.22)', tx:'#67e8f9' }, icon:'🫁' },
  renal:        { l:{ bg:'#eef2ff', bd:'#a5b4fc', tx:'#6677d8' }, d:{ bg:'rgba(129,140,248,.10)', bd:'rgba(165,180,252,.22)', tx:'#a5b4fc' }, icon:'🫘' },
  endocrine:    { l:{ bg:'#fff7ed', bd:'#fdba74', tx:'#cf7d3c' }, d:{ bg:'rgba(251,146,60,.10)', bd:'rgba(253,186,116,.22)', tx:'#fdba74' }, icon:'⚕️' },
  neurology:    { l:{ bg:'#eff6ff', bd:'#93c5fd', tx:'#4f85d8' }, d:{ bg:'rgba(96,165,250,.10)',  bd:'rgba(147,197,253,.22)', tx:'#93c5fd' }, icon:'🧠' },
  pharmacology: { l:{ bg:'#f5f3ff', bd:'#c4b5fd', tx:'#8b6bd9' }, d:{ bg:'rgba(167,139,250,.10)', bd:'rgba(196,181,253,.22)', tx:'#c4b5fd' }, icon:'💊' },
  pathology:    { l:{ bg:'#fff7ed', bd:'#fdba74', tx:'#c97c3c' }, d:{ bg:'rgba(251,146,60,.10)',  bd:'rgba(253,186,116,.22)', tx:'#fdba74' }, icon:'🔬' },
  anatomy:      { l:{ bg:'#f0fdf4', bd:'#86efac', tx:'#3aa96f' }, d:{ bg:'rgba(74,222,128,.10)',  bd:'rgba(134,239,172,.22)', tx:'#86efac' }, icon:'🦴' },
  physiology:   { l:{ bg:'#fefce8', bd:'#fde68a', tx:'#c99734' }, d:{ bg:'rgba(250,204,21,.10)',  bd:'rgba(253,230,138,.22)', tx:'#fde68a' }, icon:'⚡' },
  biochemistry: { l:{ bg:'#f0fdfa', bd:'#5eead4', tx:'#2ba99b' }, d:{ bg:'rgba(45,212,191,.10)',  bd:'rgba(94,234,212,.22)',  tx:'#5eead4' }, icon:'🧬' },
  surgery:      { l:{ bg:'#fef2f2', bd:'#fca5a5', tx:'#d46666' }, d:{ bg:'rgba(248,113,113,.10)', bd:'rgba(252,165,165,.22)', tx:'#fca5a5' }, icon:'🏥' },
  microbiology: { l:{ bg:'#fffbeb', bd:'#fcd34d', tx:'#c7972b' }, d:{ bg:'rgba(252,211,77,.10)',  bd:'rgba(252,211,77,.22)',  tx:'#fcd34d' }, icon:'🦠' },
  pediatrics:   { l:{ bg:'#f0f9ff', bd:'#7dd3fc', tx:'#3a9fcd' }, d:{ bg:'rgba(125,211,252,.10)', bd:'rgba(125,211,252,.22)', tx:'#7dd3fc' }, icon:'👶' },
  default:      { l:{ bg:'#f8fafc', bd:'#cbd5e1', tx:'#7a8ca6' }, d:{ bg:'rgba(148,163,184,.10)', bd:'rgba(148,163,184,.22)', tx:'#94a3b8' }, icon:'📖' },
};

const FALLBACK_MED = [
  { l:{ bg:'#fdf2f8', bd:'#f9a8d4', tx:'#d65b91' }, d:{ bg:'rgba(244,114,182,.10)', bd:'rgba(249,168,212,.22)', tx:'#f9a8d4' } },
  { l:{ bg:'#eff6ff', bd:'#93c5fd', tx:'#4f85d8' }, d:{ bg:'rgba(96,165,250,.10)', bd:'rgba(147,197,253,.22)', tx:'#93c5fd' } },
  { l:{ bg:'#f0fdf4', bd:'#86efac', tx:'#35a86b' }, d:{ bg:'rgba(74,222,128,.10)', bd:'rgba(134,239,172,.22)', tx:'#86efac' } },
  { l:{ bg:'#fff7ed', bd:'#fdba74', tx:'#cf7d3c' }, d:{ bg:'rgba(251,146,60,.10)', bd:'rgba(253,186,116,.22)', tx:'#fdba74' } },
  { l:{ bg:'#f5f3ff', bd:'#c4b5fd', tx:'#8b6bd9' }, d:{ bg:'rgba(167,139,250,.10)', bd:'rgba(196,181,253,.22)', tx:'#c4b5fd' } },
  { l:{ bg:'#ecfeff', bd:'#67e8f9', tx:'#22a6b8' }, d:{ bg:'rgba(34,211,238,.10)', bd:'rgba(103,232,249,.22)', tx:'#67e8f9' } },
  { l:{ bg:'#fefce8', bd:'#fde68a', tx:'#c99734' }, d:{ bg:'rgba(250,204,21,.10)', bd:'rgba(253,230,138,.22)', tx:'#fde68a' } },
  { l:{ bg:'#eef2ff', bd:'#a5b4fc', tx:'#6677d8' }, d:{ bg:'rgba(129,140,248,.10)', bd:'rgba(165,180,252,.22)', tx:'#a5b4fc' } },
];

function hashSubject(label) {
  return [...(label || 'general')].reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }, 0);
}

function getMed(label) {
  const l = (label || '').toLowerCase();
  for (const [k, v] of Object.entries(MED)) {
    if (k !== 'default' && l.includes(k)) return v;
  }
  return FALLBACK_MED[Math.abs(hashSubject(l)) % FALLBACK_MED.length] || MED.default;
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
function CourseIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 5.5C5.5 5.5 8 6 10 7.5C12 6 14.5 5.5 16.5 5.5V16C14.5 16 12 16.5 10 18C8 16.5 5.5 16 3.5 16V5.5Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round"/><path d="M10 7.5V18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function LessonIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.55"/><path d="M7 7.5H13M7 10.5H13M7 13.5H10.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/></svg>;
}
function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ChevronIcon({ open }) {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" className={cx('student-lessons-category__chevron', open && 'is-open')}><path d="M3 5l3.5 3.5L10 5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.25 8.2l3.05 3.05 6.45-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function SaveIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 3.6C4.5 2.85 5.1 2.25 5.85 2.25h4.3c.75 0 1.35.6 1.35 1.35v10.15L8 11.65l-3.5 2.1V3.6Z" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/></svg>;
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

  return (
    <button
      onClick={onClick}
      className="glass-card student-lessons-course-card group flex min-h-[132px] w-full cursor-pointer flex-col justify-center text-left outline-none transition-[transform,border-color,box-shadow] duration-200 focus-visible:ring-4 focus-visible:ring-brand-primary/22"
    >
      <div className="student-lessons-course-card__top flex items-start justify-between gap-4 px-5 py-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="student-lessons-course-card__icon grid size-11 shrink-0 place-items-center rounded-xl border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary">
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
        <div className="student-lessons-course-card__count text-right shrink-0">
          <div className="text-[30px] font-extrabold leading-none text-ink-strong">{count}</div>
          <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">lessons</div>
        </div>
      </div>
    </button>
  );
}

// ── Lesson text row ───────────────────────────────────────────────────────────
function LessonTextRow({ note, index, isSaved, onStart, onSave, style }) {
  const title = note.title || note.lessonTitle || 'Untitled lesson';
  const statusLabel = note.accessLocked ? 'Locked' : note.isFree ? 'Free lesson' : '';
  const isCompleted = note.lessonCompleted || note.lessonProgressStatus === 'completed' || Number(note.lessonProgressPercent || 0) >= 100;

  return (
    <div className={cx('student-lessons-lesson-row', isCompleted && 'is-completed')} style={style}>
      <strong>{String(index + 1).padStart(2, '0')}.</strong>
      <button
        type="button"
        className="student-lessons-lesson-row__title"
        onClick={onStart}
      >
        <span className="student-lessons-lesson-row__title-line">
          <span className="student-lessons-lesson-row__title-text">{title}</span>
          {isCompleted ? (
            <i className="student-lessons-lesson-row__done" aria-label="Completed">
              <CheckIcon />
            </i>
          ) : null}
        </span>
        {statusLabel ? <small>{statusLabel}</small> : null}
      </button>
      <div className="student-lessons-lesson-row__actions">
        <button
          type="button"
          className="student-lessons-lesson-row__start"
          onClick={onStart}
        >
          Start
        </button>
        <button
          type="button"
          className={cx('student-lessons-lesson-row__save', isSaved && 'is-saved')}
          onClick={() => onSave(note.id)}
          aria-label={isSaved ? `Saved ${title}` : `Save ${title}`}
        >
          {isSaved ? <CheckIcon /> : <SaveIcon />}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}

function LessonHeaderTitle({ label }) {
  return (
    <div className="student-lessons-category__title">
      <h2>{label || 'General'}</h2>
    </div>
  );
}

// ── Course detail (flat lesson cards) ────────────────────────────────────────
function CourseDetail({ course, onBack, bookmarkedIds, onToggleBookmark, routeBase, isDark }) {
  const navigate = useNavigate();
  const subjects = [...course.subjects.values()];
  const [activeSubj, setActiveSubj] = useState(null);
  const [collapsedSubjects, setCollapsedSubjects] = useState(new Set());
  const visibleSubjects = activeSubj ? subjects.filter(s => s.label === activeSubj) : subjects;
  const visibleNotes = visibleSubjects.flatMap((subject) => subject.notes);

  useEffect(() => {
    setCollapsedSubjects(new Set());
  }, [course.label, activeSubj]);

  function toggleSubject(key) {
    setCollapsedSubjects((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="student-lessons-detail space-y-4">
      <div className="student-lessons-detail-toolbar">
        <button className={cx(ui.secondaryButton, 'student-lessons-back-button')}
          onClick={onBack}>
          <BackIcon />
          <span>Back</span>
        </button>
        <div className="student-lessons-detail-course-name">
          {course.label || 'General'}
        </div>
        <div className="student-lessons-detail-title">
          <strong>{visibleNotes.length} {visibleNotes.length === 1 ? 'Lesson' : 'Lessons'}</strong>
        </div>
      </div>

      {subjects.length > 1 ? (
        <div className="student-lessons-filter-bar">
          <button
            className={cx(
              'student-lessons-filter-chip',
              !activeSubj && 'is-active'
            )}
            onClick={() => setActiveSubj(null)}
          >
            All subjects
          </button>
          {subjects.map((s, i) => (
            <button key={i} className={cx(
                'student-lessons-filter-chip',
                activeSubj === s.label && 'is-active'
              )}
              onClick={() => setActiveSubj(activeSubj === s.label ? null : s.label)}>
              {s.label || 'General'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="student-lessons-category-list">
        {visibleSubjects.map((subject, subjectIndex) => {
          const subjectKey = subject.label || `general-${subjectIndex}`;
          const palette = p(getMed(subject.label), isDark);
          const isCollapsed = collapsedSubjects.has(subjectKey);
          return (
            <section
              className={cx('student-lessons-category', isCollapsed && 'is-collapsed')}
              key={subjectKey}
              style={{
                '--lesson-topic-bg': palette.bg,
                '--lesson-topic-border': palette.bd,
                '--lesson-topic-text': palette.tx,
              }}
            >
              <button
                type="button"
                className="student-lessons-category__head"
                onClick={() => toggleSubject(subjectKey)}
                aria-expanded={!isCollapsed}
              >
                <div>
                  <LessonHeaderTitle label={subject.label} />
                </div>
                <small>
                  {subject.notes.length} {subject.notes.length === 1 ? 'lesson' : 'lessons'}
                  <ChevronIcon open={!isCollapsed} />
                </small>
              </button>

              <div className="student-lessons-lesson-list-shell" aria-hidden={isCollapsed}>
                <div className="student-lessons-lesson-list">
                  {subject.notes.map((note, index) => (
                    <LessonTextRow key={note.id} note={note} index={index}
                      isSaved={bookmarkedIds.has(note.id)}
                      onSave={onToggleBookmark}
                      style={{ '--lesson-row-delay': `${Math.min(index, 8) * 18}ms` }}
                      onStart={() => navigate(`${routeBase}/${note.id}`, {
                        state: {
                          lessonId: note.lessonId || null,
                          returnToPath: `${routeBase}${course.label ? `?course=${encodeURIComponent(course.label)}` : ''}`,
                          returnTo: 'list',
                          sourceCourse: course.label || null,
                        },
                      })}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function handleLessonProgress(event) {
      const detail = event.detail || {};
      const completed = detail.status === 'completed' || Number(detail.progressPercent || 0) >= 100;
      if (!completed) return;
      const lessonId = Number(detail.lessonId || 0);
      const aiNoteId = Number(detail.aiNoteId || 0);
      setNotes((current) => current.map((note) => {
        const matchesLesson = lessonId > 0 && Number(note.lessonId || 0) === lessonId;
        const matchesNote = aiNoteId > 0 && Number(note.id || 0) === aiNoteId;
        if (!matchesLesson && !matchesNote) return note;
        return {
          ...note,
          lessonCompleted: true,
          lessonProgressStatus: 'completed',
          lessonProgressPercent: 100,
        };
      }));
    }
    window.addEventListener('lms:lesson-progress-updated', handleLessonProgress);
    return () => window.removeEventListener('lms:lesson-progress-updated', handleLessonProgress);
  }, []);

  const hierarchy = useMemo(() => buildHierarchy(notes), [notes]);
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

  return (
    <main className="dashboard-page study-hub-page student-lessons-page">
      <section className="study-hub-shell">
        <AppHeader
          title={headerTitle}
          subtitle="Lesson Notes"
        />

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
                No lessons yet.
              </p>
              <p className="m-0 text-center text-[13px] text-ink-muted">
                Lessons will appear here once published by your instructor.
              </p>
            </div>
          ) : (
            <section className="student-lessons-hub animate-fadePop">
              <div className="student-lessons-section-head mb-5 flex flex-wrap items-end justify-between gap-3">
                <div className="lms-quiz-mascot-strip student-lessons-mascot-strip">
                  <StudyMascot variant="stetho" mood="lesson" size="md" label="Lessons study buddy" />
                  <div>
                    <h2 className="m-0 text-[19px] font-black uppercase leading-tight text-ink-strong dark:text-white max-[520px]:text-[16px]">Choose a Lesson</h2>
                    <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft max-[520px]:text-[12px]">{notes.length} lesson{notes.length !== 1 ? 's' : ''} available</p>
                  </div>
                </div>
                <span className="student-lessons-count-pill rounded-full border border-line-soft bg-surface-2 px-3 py-1 text-[11px] font-extrabold text-ink-muted">
                  {hierarchy.length} {hierarchy.length === 1 ? 'course' : 'courses'}
                </span>
              </div>
              <div className="student-lessons-course-grid grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[900px]:grid-cols-1 max-[520px]:gap-3">
                {hierarchy.map((course, i) => (
                  <CourseCard key={i} course={course} isDark={isDark} onClick={() => selectCourse(course.label)} />
                ))}
              </div>
            </section>
          )
        ) : (
          <section className="animate-fadePop">
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
