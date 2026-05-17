import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListAiNotes, adminCreateAiNote, adminDeleteAiNote, adminUpdateAiNote, adminGetCourses, adminGetTopics, adminGetSubtopics, adminGetLessonCanvases } from '../../../../shared/api/aiNotes.api.js';
import { createLesson } from '../../../../shared/api/lessons.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

function PlusIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>; }
function SparkleIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="none"/></svg>; }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STRIP_COLORS = ['#3B82F6', '#8B5CF6', '#D946EF', '#06B6D4', '#4F46E5', '#0EA5E9'];
const adminCanvasUi = {
  page: 'grid gap-4',
  actions: 'flex justify-end',
  createForm:
    'rounded-xl border border-line-soft bg-surface-card px-6 py-5 shadow-card [&_h3]:m-0 [&_h3]:mb-3.5 [&_h3]:text-[15px] [&_h3]:font-extrabold [&_h3]:text-ink-strong',
  content: 'grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5 max-[980px]:grid-cols-1',
  library:
    'bg-surface-card',
  libraryHead:
    'mb-4 border-b border-line-soft pb-3.5 [&_h2]:text-ink-strong [&_p]:text-ink-soft',
  main: 'min-w-0',
  grid: 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3',
  card:
    'relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-line-soft bg-surface-card shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-lg',
  strip: 'h-1.5 shrink-0',
  cardBody: 'flex flex-1 flex-col gap-2 px-[13px] pb-[9px] pt-[13px]',
  cardTop: 'flex items-start justify-between gap-1.5',
  title: 'break-words text-sm font-extrabold leading-snug text-ink-strong',
  crumb: 'mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink-muted',
  meta: 'flex items-center justify-between gap-2 text-xs text-ink-muted',
  badge:
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary',
  actionsRow: 'mt-auto flex gap-1.5 border-t border-line-soft px-2.5 pb-2.5 pt-2',
  empty:
    'flex flex-col items-center justify-center gap-3.5 px-6 py-20 text-center text-ink-muted [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:text-ink-strong [&_p]:m-0 [&_p]:max-w-[340px] [&_p]:text-sm',
  status:
    'inline-flex shrink-0 cursor-pointer items-center gap-[5px] whitespace-nowrap rounded-full border border-transparent bg-transparent px-2 py-[3px] text-[11px] font-semibold tracking-[0.02em] transition-opacity disabled:cursor-default disabled:opacity-50',
  statusActive:
    'border-emerald-600/30 bg-emerald-600/10 text-emerald-600 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-400',
  statusInactive:
    'border-line-soft bg-surface-2 text-ink-muted',
  statusDot: 'inline-block size-1.5 rounded-full bg-current',
  side:
    'sticky top-[86px] rounded-xl border border-line-soft bg-surface-card p-4 shadow-card max-[980px]:static max-[980px]:order-first',
  sideHead:
    'mb-3.5 flex items-center gap-2.5 [&_h3]:m-0 [&_h3]:text-[15px] [&_h3]:text-ink-strong [&_p]:m-0 [&_p]:mt-0.5 [&_p]:text-xs [&_p]:text-ink-soft',
  sideIcon: 'inline-flex size-[34px] shrink-0 items-center justify-center rounded-sm bg-brand-secondary/10 text-brand-secondary',
  sideStats:
    'mb-3 grid grid-cols-3 gap-2 [&_div]:rounded-sm [&_div]:border [&_div]:border-line-soft [&_div]:bg-surface-glass-subtle [&_div]:px-2 [&_div]:py-[9px] [&_strong]:block [&_strong]:text-lg [&_strong]:leading-none [&_strong]:text-ink-strong [&_span]:mt-1.5 [&_span]:block [&_span]:text-[11px] [&_span]:text-ink-soft',
  linked:
    'flex items-center justify-between gap-2.5 border-y border-line-soft py-2.5 pb-3 text-xs text-ink-soft [&_strong]:text-lg [&_strong]:text-ink-strong',
  sideList: 'mt-3 flex flex-col gap-2',
  sideItem:
    'w-full cursor-pointer rounded-sm border border-line-soft bg-surface-card p-2.5 text-left text-ink-strong transition hover:-translate-y-px hover:border-brand-primary/35 hover:shadow-md [&_small]:mt-[3px] [&_small]:block [&_small]:overflow-hidden [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[11px] [&_small]:text-ink-soft [&_span]:block [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_span]:text-xs [&_span]:font-bold [&_span]:text-ink-strong',
  sideEmpty:
    'rounded-sm border border-dashed border-line-medium px-2.5 py-4 text-center text-xs text-ink-soft',
};

export function AdminAiNotesListPage({
  engineKey = 'gemini',
  routeBase = '/ai-notes',
  pageTitle = 'Lessons',
  pageSubtitle = 'Create lessons — students see active ones in their Lessons section',
  createLabel = 'New Lesson',
}) {
  const navigate = useNavigate();
  const [notes,      setNotes]      = useState([]);
  const [lessonCanvases, setLessonCanvases] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newTitle,     setNewTitle]     = useState('');
  const [creating,     setCreating]     = useState(false);
  const [courses,      setCourses]      = useState([]);
  const [topics,       setTopics]       = useState([]);
  const [subtopics,    setSubtopics]    = useState([]);
  const [selCourse,    setSelCourse]    = useState('');
  const [selTopic,     setSelTopic]     = useState('');
  const [selSubtopic,  setSelSubtopic]  = useState('');
  const [isFree,       setIsFree]       = useState(false);

  const [deletingId,   setDeletingId]   = useState(null);
  const [togglingId,   setTogglingId]   = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const [nextNotes, nextLessonCanvases] = await Promise.all([
        adminListAiNotes({ engine: engineKey }),
        adminGetLessonCanvases({ engine: engineKey }),
      ]);
      setNotes(nextNotes);
      setLessonCanvases(Array.isArray(nextLessonCanvases) ? nextLessonCanvases : []);
    } catch { setError('Failed to load lessons.'); }
    finally { setLoading(false); }
  }, [engineKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showCreate) return;
    adminGetCourses().then(setCourses).catch(() => {});
  }, [showCreate]);

  useEffect(() => {
    setSelTopic(''); setSelSubtopic(''); setTopics([]); setSubtopics([]);
    if (!selCourse) return;
    adminGetTopics(Number(selCourse)).then(setTopics).catch(() => {});
  }, [selCourse]);

  useEffect(() => {
    setSelSubtopic(''); setSubtopics([]);
    if (!selTopic) return;
    adminGetSubtopics(Number(selTopic)).then(setSubtopics).catch(() => {});
  }, [selTopic]);

  async function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      setCreating(true);
      let lessonId;
      if (selCourse && selTopic && selSubtopic) {
        const lesson = await createLesson({
          courseId: Number(selCourse),
          topicId: Number(selTopic),
          subtopicId: Number(selSubtopic),
          lessonTitle: title,
          isFree: isFree ? 1 : 0,
          status: 'active',
        });
        lessonId = lesson.id;
      }
      const { id } = await adminCreateAiNote({
        title,
        courseId:   selCourse   ? Number(selCourse)   : undefined,
        topicId:    selTopic    ? Number(selTopic)     : undefined,
        subtopicId: selSubtopic ? Number(selSubtopic)  : undefined,
        lessonId,
        isFree: isFree ? 1 : 0,
      }, { engine: engineKey });
      navigate(`${routeBase}/${id}`);
    } catch { setError('Failed to create lesson.'); setCreating(false); }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this lesson? Students will no longer see it.')) return;
    setDeletingId(id);
    try { await adminDeleteAiNote(id, { engine: engineKey }); setNotes(prev => prev.filter(n => n.id !== id)); }
    catch { setError('Failed to delete.'); }
    finally { setDeletingId(null); }
  }

  async function handleToggleStatus(e, note) {
    e.stopPropagation();
    const next = note.status === 'active' ? 'inactive' : 'active';
    setTogglingId(note.id);
    try {
      await adminUpdateAiNote(note.id, { status: next }, undefined, { engine: engineKey });
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: next } : n));
    } catch { setError('Failed to update status.'); }
    finally { setTogglingId(null); }
  }

  function breadcrumb(note) {
    const parts = [note.courseTitle, note.topicName, note.subtopicName, note.lessonTitle].filter(Boolean);
    return parts.join(' › ');
  }

  const publishedCount = notes.filter(note => note.noteData).length;
  const activeCount = notes.filter(note => note.status === 'active').length;
  const linkedCanvasCount = lessonCanvases.length;

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={pageTitle}
          subtitle={`${pageSubtitle} • ${notes.length} lesson${notes.length === 1 ? '' : 's'}`}
        />

        <div className={adminCanvasUi.page}>
          <div className={adminCanvasUi.actions}>
            <button className={cx(ui.primaryAction, 'gap-[7px]')}
             
              onClick={() => setShowCreate(v => !v)}
            >
              <PlusIcon/> {createLabel}
            </button>
          </div>

      {error && (
        <div className={cx(ui.feedbackError, 'mb-2')}>
          {error}
          <button className="ml-2.5 cursor-pointer border-0 bg-transparent font-bold text-inherit"
                  onClick={() => setError('')}>×</button>
        </div>
      )}

      {showCreate && (
        <form className={adminCanvasUi.createForm} onSubmit={handleCreate}>
          <h3>New Lesson</h3>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select className={cx(ui.input, 'min-w-0 flex-[1_1_160px]')} value={selCourse} onChange={e => setSelCourse(e.target.value)}>
              <option value="">— Course (optional) —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={cx(ui.input, 'min-w-0 flex-[1_1_160px]')} value={selTopic} onChange={e => setSelTopic(e.target.value)}
                    disabled={!selCourse}>
              <option value="">— Subject (optional) —</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className={cx(ui.input, 'min-w-0 flex-[1_1_160px]')} value={selSubtopic} onChange={e => setSelSubtopic(e.target.value)}
                    disabled={!selTopic}>
              <option value="">— Topic (optional) —</option>
              {subtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <input className={cx(ui.input, 'min-w-[180px] flex-[1_1_220px]')} type="text" placeholder="Lesson title (e.g. Heart Failure)" autoFocus
                   value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={255} required
            />
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink-muted">
            <input className="shrink-0" type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} />
            Mark as free content
          </label>
          <div className="mt-2.5 flex items-center gap-2">
            <button className={ui.primaryAction} type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create & Open'}
            </button>
            <button className={ui.secondaryAction} type="button"
                    onClick={() => { setShowCreate(false); setNewTitle(''); setSelCourse(''); setSelTopic(''); setSelSubtopic(''); setIsFree(false); }}>Cancel</button>
          </div>
        </form>
      )}

      <div className={adminCanvasUi.content}>
        <section className={cx(ui.panelCard, adminCanvasUi.library)}>
          <div className={cx(ui.panelTop, adminCanvasUi.libraryHead)}>
            <div>
              <h2>Lesson library</h2>
              <p>{loading ? 'Loading lessons...' : `${notes.length} lesson${notes.length === 1 ? '' : 's'} available`}</p>
            </div>
          </div>

          <div className={adminCanvasUi.main}>
            {loading ? (
              <div className={adminCanvasUi.grid}>
                {[1,2,3,4].map(i => <div key={i} className={cx(adminCanvasUi.card, ui.shimmer, 'h-40')} />)}
              </div>
            ) : notes.length === 0 ? (
              <div className={adminCanvasUi.empty}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect x="8" y="8" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.35"/>
                  <rect x="36" y="8" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.55"/>
                  <rect x="8" y="36" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.55"/>
                  <rect x="36" y="36" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.8"/>
                </svg>
                <h3>No lessons yet</h3>
                <p>Create your first lesson — students will see it in their Lessons section.</p>
                <button className={cx(ui.primaryAction, 'gap-[7px]')}
                        onClick={() => setShowCreate(true)}>
                  <PlusIcon/> Create First Lesson
                </button>
              </div>
            ) : (
              <div className={adminCanvasUi.grid}>
                {notes.map((note, idx) => (
                  <div key={note.id} className={adminCanvasUi.card} onClick={() => navigate(`${routeBase}/${note.id}`)}>
                    <div className={adminCanvasUi.strip} style={{ background: STRIP_COLORS[idx % STRIP_COLORS.length] }}/>
                    <div className={adminCanvasUi.cardBody}>
                      <div className={adminCanvasUi.cardTop}>
                        <div className={adminCanvasUi.title}>{note.title}</div>
                        {/* active / inactive pill */}
                        <button className={cx(adminCanvasUi.status, note.status === 'active' ? adminCanvasUi.statusActive : adminCanvasUi.statusInactive)}
                         
                          disabled={togglingId === note.id}
                          onClick={e => handleToggleStatus(e, note)}
                          title={note.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span className={adminCanvasUi.statusDot}/>
                          {togglingId === note.id ? '…' : note.status === 'active' ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      {breadcrumb(note) && (
                        <div className={adminCanvasUi.crumb}>{breadcrumb(note)}</div>
                      )}

                      <div className={adminCanvasUi.meta}>
                        <span>{formatDate(note.updatedAt)}</span>
                        {note.isFree ? (
                          <span className={adminCanvasUi.badge}>Free</span>
                        ) : null}
                        {note.noteData ? (
                          <span className={adminCanvasUi.badge}>Published</span>
                        ) : (
                          <span className={cx(adminCanvasUi.badge, 'opacity-50')}>Draft</span>
                        )}
                      </div>
                    </div>
                    <div className={adminCanvasUi.actionsRow}>
                      <button className={ui.iconButton}
                        type="button"
                       
                        aria-label={`Edit ${note.title}`}
                        title="Edit lesson"
                        onClick={e => { e.stopPropagation(); navigate(`${routeBase}/${note.id}`); }}
                      >
                        <EditActionIcon />
                      </button>
                      <button className={ui.dangerIconButton}
                        type="button"
                       
                        aria-label={`Delete ${note.title}`}
                        title="Delete lesson"
                        disabled={deletingId === note.id}
                        onClick={e => handleDelete(e, note.id)}
                      >
                        <DeleteActionIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className={adminCanvasUi.side} aria-label="Lessons summary">
          <div className={adminCanvasUi.sideHead}>
            <span className={adminCanvasUi.sideIcon}><SparkleIcon /></span>
            <div>
              <h3>Lesson Overview</h3>
              <p>Linked lessons</p>
            </div>
          </div>

          <div className={adminCanvasUi.sideStats}>
            <div>
              <strong>{loading ? '—' : notes.length}</strong>
              <span>Total</span>
            </div>
            <div>
              <strong>{loading ? '—' : activeCount}</strong>
              <span>Active</span>
            </div>
            <div>
              <strong>{loading ? '—' : publishedCount}</strong>
              <span>Published</span>
            </div>
          </div>

          <div className={adminCanvasUi.linked}>
            <span>Linked to lessons</span>
            <strong>{loading ? '—' : linkedCanvasCount}</strong>
          </div>

          <div className={adminCanvasUi.sideList}>
            {loading ? (
              <div className={adminCanvasUi.sideEmpty}>Loading lessons...</div>
            ) : lessonCanvases.length === 0 ? (
              <div className={adminCanvasUi.sideEmpty}>No linked lessons yet.</div>
            ) : (
              lessonCanvases.slice(0, 6).map(canvas => (
                <button className={adminCanvasUi.sideItem}
                  key={`${canvas.lessonId}-${canvas.canvasId}`}
                  type="button"
                 
                  onClick={() => navigate(`${routeBase}/${canvas.canvasId}`)}
                >
                  <span>{canvas.title || 'Untitled Lesson'}</span>
                  <small>Lesson #{canvas.lessonId}</small>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
        </div>
      </section>
    </main>
  );
}
