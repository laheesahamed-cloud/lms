import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListAiNotes, adminCreateAiNote, adminDeleteAiNote, adminUpdateAiNote, adminGetCourses, adminGetTopics, adminGetSubtopics } from '../../../../shared/api/aiNotes.api.js';
import { createLesson } from '../../../../shared/api/lessons.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

function PlusIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>; }

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const adminCanvasUi = {
  page: 'grid gap-4',
  actions: 'flex justify-end',
  createForm:
    'rounded-xl border border-line-soft bg-surface-card px-6 py-5 shadow-card [&_h3]:m-0 [&_h3]:mb-3.5 [&_h3]:text-[15px] [&_h3]:font-extrabold [&_h3]:text-ink-strong',
  content: 'grid gap-5',
  library:
    'bg-surface-card',
  libraryHead:
    'mb-4 border-b border-line-soft pb-3.5 [&_h2]:text-ink-strong [&_p]:text-ink-soft',
  filters:
    'mb-4 grid items-end gap-3 [grid-template-columns:minmax(220px,1.6fr)_repeat(3,minmax(135px,1fr))_auto] max-[960px]:grid-cols-2 max-[560px]:grid-cols-1',
  main: 'min-w-0',
  table: 'min-w-[980px]',
  titleButton:
    'max-w-[280px] cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-extrabold leading-snug text-ink-strong transition hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18',
  crumb: 'mt-1 max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-muted',
  badge:
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary',
  tableActions: 'flex min-w-0 items-center gap-2',
  empty:
    'flex flex-col items-center justify-center gap-3.5 px-6 py-20 text-center text-ink-muted [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:text-ink-strong [&_p]:m-0 [&_p]:max-w-[340px] [&_p]:text-sm',
};

export function AdminAiNotesListPage({
  engineKey = 'gemini',
  routeBase = '/ai-notes',
  pageTitle = 'Lessons',
  pageSubtitle: _pageSubtitle = 'Create lessons — students see active ones in their Lessons section',
  createLabel = 'New Lesson',
}) {
  const navigate = useNavigate();
  const [notes,      setNotes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    access: '',
    noteState: '',
  });

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
      const nextNotes = await adminListAiNotes({ engine: engineKey });
      setNotes(Array.isArray(nextNotes) ? nextNotes : []);
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

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleResetFilters() {
    setFilters({ search: '', status: '', access: '', noteState: '' });
  }

  const filteredNotes = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    return notes.filter((note) => {
      if (filters.status && note.status !== filters.status) return false;
      if (filters.access === 'free' && !note.isFree) return false;
      if (filters.access === 'paid' && note.isFree) return false;
      if (filters.noteState === 'published' && !note.noteData) return false;
      if (filters.noteState === 'draft' && note.noteData) return false;

      if (!query) return true;
      return [
        note.title,
        note.lessonTitle,
        note.courseTitle,
        note.topicName,
        note.subtopicName,
        note.lessonId,
        note.id,
        breadcrumb(note),
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [filters, notes]);

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={pageTitle}
          subtitle="Lesson Notes"
        />

        <div className={adminCanvasUi.page}>
          <div className={adminCanvasUi.actions}>
            <button className={cx(ui.primaryAction, 'gap-[7px]')}
              type="button"
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
            <select className={cx(ui.input, 'min-w-0 flex-[1_1_160px]')} value={selCourse} onChange={e => setSelCourse(e.target.value)} aria-label="New lesson course">
              <option value="">— Course (optional) —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={cx(ui.input, 'min-w-0 flex-[1_1_160px]')} value={selTopic} onChange={e => setSelTopic(e.target.value)}
                    disabled={!selCourse} aria-label="New lesson subject">
              <option value="">— Subject (optional) —</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className={cx(ui.input, 'min-w-0 flex-[1_1_160px]')} value={selSubtopic} onChange={e => setSelSubtopic(e.target.value)}
                    disabled={!selTopic} aria-label="New lesson topic">
              <option value="">— Topic (optional) —</option>
              {subtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <input className={cx(ui.input, 'min-w-[180px] flex-[1_1_220px]')} type="text" placeholder="Lesson title (e.g. Heart Failure)" autoFocus
                   value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={255} required
                   aria-label="New lesson title"
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
              <p>{loading ? 'Loading lessons...' : `${filteredNotes.length} of ${notes.length} lesson${notes.length === 1 ? '' : 's'} shown`}</p>
            </div>
          </div>

          <div className={adminCanvasUi.filters}>
            <label className={ui.formLabel}>
              Search
              <input
                className={ui.input}
                name="search"
                type="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Title, course, subject, topic..."
              />
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input} name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className={ui.formLabel}>
              Access
              <select className={ui.input} name="access" value={filters.access} onChange={handleFilterChange}>
                <option value="">All access</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label className={ui.formLabel}>
              Notes
              <select className={ui.input} name="noteState" value={filters.noteState} onChange={handleFilterChange}>
                <option value="">All notes</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <button className={ui.secondaryAction} type="button" onClick={handleResetFilters}>
              Reset
            </button>
          </div>

          <div className={adminCanvasUi.main}>
            {loading ? (
              <div className={ui.tableShell}>
                <table className={cx(ui.modernTable, adminCanvasUi.table)}>
                  <thead>
                    <tr>
                      <th className={ui.tableHeadCell}>Lesson</th>
                      <th className={ui.tableHeadCell}>Hierarchy</th>
                      <th className={ui.tableHeadCell}>Status</th>
                      <th className={ui.tableHeadCell}>Access</th>
                      <th className={ui.tableHeadCell}>Notes</th>
                      <th className={ui.tableHeadCell}>Updated</th>
                      <th className={ui.tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={ui.tableEmpty} colSpan="7">Loading lessons...</td>
                    </tr>
                  </tbody>
                </table>
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
                        type="button"
                        onClick={() => setShowCreate(true)}>
                  <PlusIcon/> Create First Lesson
                </button>
              </div>
            ) : (
              <div className={ui.tableShell}>
                <table className={cx(ui.modernTable, adminCanvasUi.table)}>
                  <thead>
                    <tr>
                      <th className={ui.tableHeadCell}>Lesson</th>
                      <th className={ui.tableHeadCell}>Hierarchy</th>
                      <th className={ui.tableHeadCell}>Status</th>
                      <th className={ui.tableHeadCell}>Access</th>
                      <th className={ui.tableHeadCell}>Notes</th>
                      <th className={ui.tableHeadCell}>Updated</th>
                      <th className={ui.tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotes.length === 0 ? (
                      <tr>
                        <td className={ui.tableEmpty} colSpan="7">No lessons match these filters.</td>
                      </tr>
                    ) : filteredNotes.map((note) => {
                      const noteBreadcrumb = breadcrumb(note);
                      return (
                        <tr key={note.id}>
                          <td className={ui.tableCell}>
                            <button
                              className={adminCanvasUi.titleButton}
                              type="button"
                              onClick={() => navigate(`${routeBase}/${note.id}`)}
                            >
                              {note.title || 'Untitled Lesson'}
                            </button>
                            <div className={ui.tableSubtext}>{note.lessonId ? `Lesson #${note.lessonId}` : `Note #${note.id}`}</div>
                          </td>
                          <td className={ui.tableCell}>
                            {noteBreadcrumb ? (
                              <div className={adminCanvasUi.crumb}>{noteBreadcrumb}</div>
                            ) : (
                              <span className={ui.tableSubtext}>Not linked</span>
                            )}
                          </td>
                          <td className={ui.tableCell}>
                            <button
                              className={cx(statusPill(note.status), 'cursor-pointer disabled:cursor-default disabled:opacity-60')}
                              type="button"
                              disabled={togglingId === note.id}
                              onClick={(event) => handleToggleStatus(event, note)}
                              title={note.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                            >
                              {togglingId === note.id ? 'Updating...' : note.status === 'active' ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className={ui.tableCell}>
                            {note.isFree ? (
                              <span className={adminCanvasUi.badge}>Free</span>
                            ) : (
                              <span className={ui.tablePill}>Paid</span>
                            )}
                          </td>
                          <td className={ui.tableCell}>
                            {note.noteData ? (
                              <span className={adminCanvasUi.badge}>Published</span>
                            ) : (
                              <span className={cx(adminCanvasUi.badge, 'opacity-60')}>Draft</span>
                            )}
                          </td>
                          <td className={ui.tableCell}>{formatDate(note.updatedAt || note.createdAt)}</td>
                          <td className={ui.tableCell}>
                            <div className={adminCanvasUi.tableActions}>
                              <button
                                className={ui.iconButton}
                                type="button"
                                aria-label={`Edit ${note.title || 'lesson'}`}
                                title="Edit lesson"
                                onClick={() => navigate(`${routeBase}/${note.id}`)}
                              >
                                <EditActionIcon />
                              </button>
                              <button
                                className={ui.dangerIconButton}
                                type="button"
                                aria-label={`Delete ${note.title || 'lesson'}`}
                                title="Delete lesson"
                                disabled={deletingId === note.id}
                                onClick={(event) => handleDelete(event, note.id)}
                              >
                                <DeleteActionIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </div>
        </div>
      </section>
    </main>
  );
}
