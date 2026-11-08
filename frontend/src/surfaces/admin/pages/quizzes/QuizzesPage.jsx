import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bulkDeleteQuizzes, bulkSetQuizStatus, fetchQuizzes, fetchQuizzesMeta, fetchQuizzesSummary, previewBulkDeleteQuizzes } from '../../../../shared/api/quizzes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const overviewGrid = 'grid grid-cols-3 gap-4 max-[900px]:grid-cols-1';
const overviewCard = cx(
  ui.panelCard,
  'grid gap-1 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(14,165,233,0.04)),var(--surface-1)] px-4 py-3'
);
const overviewLabel = 'text-[11px] font-bold uppercase tracking-[0.06em] text-ink-soft';
const overviewValue = 'text-[24px] max-[640px]:text-[20px] leading-none text-ink-strong';
const overviewText = 'm-0 text-[12.5px] text-ink-soft';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const PAGE_SIZE = 50;

function subjectKey(row) {
  return `${row.courseId}:${row.isGeneral ? 'general' : row.topicId ?? 'none'}`;
}

/** The name students see; falls back to the admin name only if there is none. */
function getStudentName(quiz) {
  return quiz.studentTitle || quiz.quizTitle || quiz.adminName || `Assessment #${quiz.id}`;
}

function StatusChip({ status }) {
  const active = status === 'active';
  return (
    <span className={cx(
      'inline-flex h-[18px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[10.5px] font-extrabold uppercase leading-none tracking-[0.04em]',
      active
        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
        : 'border-amber-400/25 bg-amber-400/10 text-amber-700 dark:text-amber-300',
    )}>
      <span className={cx('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-amber-400')} />
      {active ? 'Active' : 'Draft'}
    </span>
  );
}

/** The assessments inside one folder, as a table. `withTrail` adds a Location column (search results). */
function QuizTable({ quizzes, withTrail, selected, onToggle, onToggleAll, onEdit, onDelete, deletingId }) {
  const allSelected = quizzes.length > 0 && quizzes.every((quiz) => selected.has(quiz.id));
  const someSelected = !allSelected && quizzes.some((quiz) => selected.has(quiz.id));
  return (
    <div className={ui.tableShell}>
      {/* Inline: the shared `.lms-table-shell table` rule would otherwise shrink it to the card and wrap every cell. */}
      <table className={ui.modernTable} style={{ width: '100%', minWidth: withTrail ? 740 : 540 }}>
        <thead>
          <tr>
            <th className={cx(ui.tableHeadCell, 'w-10')}>
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-brand-primary"
                aria-label="Select all assessments in this list"
                checked={allSelected}
                ref={(node) => { if (node) node.indeterminate = someSelected; }}
                onChange={(event) => onToggleAll(quizzes.map((quiz) => quiz.id), event.target.checked)}
              />
            </th>
            <th className={cx(ui.tableHeadCell, 'w-12')}>#</th>
            <th className={ui.tableHeadCell}>Assessment</th>
            {withTrail ? <th className={ui.tableHeadCell}>Location</th> : null}
            <th className={ui.tableHeadCell}>Questions</th>
            <th className={ui.tableHeadCell}>Time</th>
            <th className={ui.tableHeadCell}>Status</th>
            <th className={cx(ui.tableHeadCell, 'text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quizzes.map((quiz, index) => {
            const name = getStudentName(quiz);
            return (
              <tr key={quiz.id} className={cx('transition hover:bg-surface-2/50 [&>td]:!py-2', selected.has(quiz.id) && 'bg-brand-primary/[0.06]')}>
                <td className={ui.tableCell}>
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-brand-primary"
                    aria-label={`Select ${name}`}
                    checked={selected.has(quiz.id)}
                    onChange={() => onToggle(quiz.id)}
                  />
                </td>
                <td className={cx(ui.tableCell, 'whitespace-nowrap text-ink-muted')}>{index + 1}</td>
                <td className={cx(ui.tableCell, 'min-w-[200px]')}>
                  <button
                    type="button"
                    className="block max-w-full truncate border-0 !bg-transparent p-0 text-left text-[13.5px] font-extrabold text-ink-strong shadow-none hover:text-brand-primary hover:underline"
                    onClick={() => onEdit(quiz.id)}
                    title={name}
                  >
                    {name}
                  </button>
                </td>
                {withTrail ? (
                  <td className={cx(ui.tableCell, 'text-ink-soft')}>
                    {[quiz.courseTitle, quiz.isGeneral === 1 ? 'General / Full Course' : quiz.subjectName].filter(Boolean).join(' › ')}
                  </td>
                ) : null}
                <td className={cx(ui.tableCell, 'whitespace-nowrap font-bold')}>{Number(quiz.totalQuestions || 0)}</td>
                <td className={cx(ui.tableCell, 'whitespace-nowrap')}>{quiz.hideTimeLimit === 1 ? '—' : `${Number(quiz.timeLimit || 0)} min`}</td>
                <td className={cx(ui.tableCell, 'whitespace-nowrap')}><StatusChip status={quiz.status} /></td>
                <td className={cx(ui.tableCell, 'whitespace-nowrap')}>
                  <div className="flex items-center justify-end gap-2">
                    <button className={cx(ui.iconButton, '!size-8 !min-h-0 !min-w-0')} type="button" aria-label={`Edit assessment ${name}`} title="Edit assessment" onClick={() => onEdit(quiz.id)}>
                      <EditActionIcon />
                    </button>
                    <button className={cx(ui.dangerIconButton, '!size-8 !min-h-0 !min-w-0')} type="button" aria-label={`Delete assessment ${name}`} title="Delete assessment"
                            onClick={() => onDelete(quiz)} disabled={deletingId === quiz.id}>
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
  );
}

function FolderIcon({ className }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2c.5 0 .98.2 1.33.55l1.1 1.1c.35.35.83.55 1.33.55H18.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CountPills({ total, active }) {
  const draft = Math.max(0, total - active);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.05em] text-ink-soft">
      <span className="rounded-full border border-line-soft bg-surface-2 px-2.5 py-0.5">{total} {total === 1 ? 'assessment' : 'assessments'}</span>
      {draft ? <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 text-amber-700 dark:text-amber-300">{draft} draft</span> : null}
    </div>
  );
}

function FolderCard({ name, total, active, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-line-soft !bg-surface-card p-4 text-left shadow-none transition hover:border-brand-primary/30 hover:!bg-surface-2/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/16"
    >
      <FolderIcon className="size-11 text-brand-primary" />
      <span className="grid min-w-0 gap-2">
        <span className="min-w-0">
          <strong className="block truncate text-[16px] font-black text-ink-strong" title={name}>{name}</strong>
        </span>
        <CountPills total={total} active={active} />
      </span>
    </button>
  );
}

/**
 * File-manager style navigation. The map shows the course folders; opening one
 * goes inside to its subject folders; opening a subject goes inside to its
 * assessments. A path bar and a Back button climb back out. A folder's
 * assessments are fetched when you go in (and paged), so the page stays fast
 * and nothing is cut off however many assessments exist.
 */
function QuizMap({
  groups, loading, course, subject, folder, searching, searchResults,
  selected, onToggle, onToggleAll, onClearSelection, onDeleteSelected, onSetStatus, statusBusy,
  onGoRoot, onOpenCourse, onOpenSubject, onBack, onLoadMore, onEdit, onDelete, deletingId,
}) {
  const crumbs = [{ label: 'All courses', onClick: onGoRoot }];
  if (course) crumbs.push({ label: course.courseTitle || 'General Library', onClick: subject ? () => onOpenCourse(course) : null });
  if (subject) crumbs.push({ label: subject.isGeneral ? 'General / Full Course' : subject.subjectName || 'Unmapped Subject', onClick: null });

  const items = folder?.items || [];
  const table = (list, withTrail) => (
    <QuizTable quizzes={list} withTrail={withTrail} selected={selected} onToggle={onToggle} onToggleAll={onToggleAll} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} />
  );

  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div className={cx(ui.panelTop, '!mb-0')}>
        <div>
          <h2 className={ui.panelTitle}>Assessment Map</h2>
          <p className={ui.panelText}>
            {searching ? 'Search results across every course.' : 'Open a folder to go inside it.'}
          </p>
        </div>
      </div>

      {!searching ? (
        <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
          {course ? (
            <button type="button" className={cx(ui.secondaryAction, 'min-h-9 px-3')} onClick={onBack}>← Back</button>
          ) : null}
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index ? <span className="text-ink-soft" aria-hidden="true">/</span> : null}
              {crumb.onClick ? (
                <button type="button" className="rounded-md border-0 !bg-transparent p-0 font-bold text-brand-primary shadow-none hover:underline" onClick={crumb.onClick}>
                  {crumb.label}
                </button>
              ) : (
                <span className="text-ink-strong">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      {selected.size ? (
        <div className="sticky top-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-primary/30 bg-surface-card-elevated px-3.5 py-2.5 shadow-[var(--ds-card-shadow)]">
          <strong className="text-[13.5px] text-ink-strong">{selected.size} selected</strong>
          <div className="flex items-center gap-2">
            <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} onClick={onClearSelection}>Clear</button>
            <button type="button" disabled={statusBusy} className={cx(ui.secondaryAction, '!min-h-9 !px-3')} onClick={() => onSetStatus('inactive')}>
              Move to draft
            </button>
            <button type="button" disabled={statusBusy} className={cx(ui.primaryAction, '!min-h-9 !px-3')} onClick={() => onSetStatus('active')}>
              {statusBusy ? 'Working…' : 'Approve (draft → active)'}
            </button>
            <button type="button" className={cx(ui.dangerAction || ui.secondaryAction, '!min-h-9 !px-3 !border-red-500/40 !bg-red-500/10 !text-red-600 dark:!text-red-300')} onClick={onDeleteSelected}>
              Delete selected
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-dashed border-line-medium bg-surface-2/50 px-5 py-8 text-center text-sm font-bold text-ink-soft">
          Loading assessments...
        </div>
      ) : null}

      {!loading && !searching && groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-medium bg-surface-2/50 px-5 py-8 text-center text-sm font-bold text-ink-soft">
          No assessments found for the selected filters.
        </div>
      ) : null}

      {/* Search: a flat list with where each result lives. */}
      {!loading && searching ? (
        <div className="grid gap-2">
          {searchResults.error ? <div className={ui.feedbackError}>{searchResults.error}</div> : null}
          {searchResults.items.length ? table(searchResults.items, true) : null}
          {searchResults.loading ? <p className="m-0 py-2 text-center text-[12.5px] font-bold text-ink-soft">Loading…</p> : null}
          {!searchResults.loading && !searchResults.error && searchResults.items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line-medium bg-surface-2/50 px-5 py-8 text-center text-sm font-bold text-ink-soft">
              No assessments match this search.
            </div>
          ) : null}
          {!searchResults.loading && searchResults.more ? (
            <button type="button" className={ui.secondaryAction} onClick={onLoadMore}>Load more</button>
          ) : null}
        </div>
      ) : null}

      {/* Level 0: course folders. */}
      {!loading && !searching && !course ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {groups.map((group) => (
            <FolderCard key={group.courseId} name={group.courseTitle || 'General Library'}
                        total={group.total} active={group.active} onOpen={() => onOpenCourse(group)} />
          ))}
        </div>
      ) : null}

      {/* Level 1: subject folders inside a course. */}
      {!loading && !searching && course && !subject ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {course.subjects.map((row) => (
            <FolderCard key={subjectKey(row)}
                        name={row.isGeneral ? 'General / Full Course' : row.subjectName || 'Unmapped Subject'}
                        total={row.total} active={row.active} onOpen={() => onOpenSubject(row)} />
          ))}
        </div>
      ) : null}

      {/* Level 2: the assessments inside a subject. */}
      {!loading && !searching && course && subject ? (
        <div className="grid gap-2">
          {folder?.error ? <div className={ui.feedbackError}>{folder.error}</div> : null}
          {items.length ? table(items, false) : null}
          {folder?.loading ? <p className="m-0 py-2 text-center text-[12.5px] font-bold text-ink-soft">Loading…</p> : null}
          {!folder?.loading && items.length < subject.total && !folder?.error ? (
            <button type="button" className={ui.secondaryAction} onClick={() => onLoadMore()}>
              Load more ({items.length} of {subject.total})
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Asks what a delete should include. Counts come from the server (the preview
 * changes nothing), so the admin sees exactly what each choice would remove.
 */
function DeleteDialog({ state, onChoose, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !state.busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.busy, onCancel]);

  const { count, preview, withQuestions, busy, error } = state;
  const noun = count === 1 ? 'assessment' : 'assessments';
  const onlyHere = preview?.questionsOnlyHere ?? 0;
  const shared = preview?.questionsShared ?? 0;
  const inside = preview?.questionsInside ?? 0;
  const confirmLabel = withQuestions && onlyHere
    ? `Delete ${count} ${noun} and ${onlyHere} question${onlyHere === 1 ? '' : 's'}`
    : `Delete ${count} ${noun}`;

  return (
    <div className="fixed inset-0 z-[11000] grid place-items-center bg-[rgba(15,23,42,0.45)] p-4 backdrop-blur-[3px]" onClick={() => { if (!busy) onCancel(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-assessments-title"
        className="grid max-h-[90dvh] w-[min(520px,100%)] gap-4 overflow-y-auto rounded-2xl border border-line-soft bg-surface-card-elevated p-5 shadow-[var(--ds-floating-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-1">
          <h3 id="delete-assessments-title" className="m-0 text-[17px] font-black text-ink-strong">Delete {count} {noun}?</h3>
          <p className="m-0 text-[13px] text-ink-soft">
            {preview ? `They contain ${inside} question${inside === 1 ? '' : 's'}. Choose what should happen to them.` : 'Checking what is inside…'}
          </p>
        </div>

        {preview ? (
          <div className="grid gap-2" role="radiogroup" aria-label="What to delete">
            <label className={cx('grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-xl border p-3.5', !withQuestions ? 'border-brand-primary/50 bg-brand-primary/[0.06]' : 'border-line-soft')}>
              <input type="radio" name="delete-scope" className="mt-0.5 size-4 accent-brand-primary" checked={!withQuestions} disabled={busy} onChange={() => onChoose(false)} />
              <span className="grid gap-0.5">
                <strong className="text-[14px] text-ink-strong">Delete the {noun} only</strong>
                <span className="text-[12.5px] leading-relaxed text-ink-soft">
                  All {inside} question{inside === 1 ? '' : 's'} stay in the question bank, so you can reuse them in other assessments.
                </span>
              </span>
            </label>

            <label className={cx('grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-xl border p-3.5', withQuestions ? 'border-red-500/50 bg-red-500/[0.06]' : 'border-line-soft', !onlyHere && 'opacity-60')}>
              <input type="radio" name="delete-scope" className="mt-0.5 size-4 accent-red-600" checked={withQuestions} disabled={busy || !onlyHere} onChange={() => onChoose(true)} />
              <span className="grid gap-0.5">
                <strong className="text-[14px] text-ink-strong">Delete the {noun} and their questions</strong>
                <span className="text-[12.5px] leading-relaxed text-ink-soft">
                  {onlyHere
                    ? `Permanently deletes the ${onlyHere} question${onlyHere === 1 ? '' : 's'} used only here, with their answer options, quick theory, reports and students' saved answers.`
                    : 'There are no questions used only by these assessments.'}
                  {shared ? ` ${shared} question${shared === 1 ? ' is' : 's are'} also used by other assessments and will be kept.` : ''}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {preview?.attempts ? (
          <p className="m-0 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
            Students have taken these {preview.attempts} time{preview.attempts === 1 ? '' : 's'}. Those attempts will no longer show in their results.
          </p>
        ) : null}

        {withQuestions ? <p className="m-0 text-[12.5px] font-bold text-red-600 dark:text-red-300">This cannot be undone.</p> : null}
        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={ui.secondaryAction} disabled={busy} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            disabled={busy || !preview}
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-600 bg-red-600 px-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const quizInitialFilters = { search: '', courseId: '', subjectId: '', status: '' };

export function QuizzesPage() {
  const navigate = useNavigate();
  // Where you are in the folders lives in the URL (?course=10&subject=15), so
  // the browser's Back button climbs out of a folder and a refresh stays put.
  const [searchParams, setSearchParams] = useSearchParams();
  const courseParam = searchParams.get('course') || '';
  const subjectParam = searchParams.get('subject') || '';
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [summary, setSummary] = useState([]);
  const [folders, setFolders] = useState({});
  const [searchResults, setSearchResults] = useState({ items: [], loading: false, more: false, error: '' });
  const [filters, setFilters] = useState(quizInitialFilters);
  const [loading, setLoading] = useState(true);
  const deletingId = null;
  const [selected, setSelected] = useState(() => new Set());
  // The open delete question: which ids, the server's preview, and the choice.
  const [deleteState, setDeleteState] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // The filters the current summary/folders were loaded with, so opening a
  // folder lists exactly what its count promised.
  const appliedFilters = useRef(quizInitialFilters);

  const visibleSubjects = useMemo(
    () => subjects.filter((subject) => !filters.courseId || String(subject.courseId) === String(filters.courseId)),
    [subjects, filters.courseId]
  );

  const groups = useMemo(() => {
    const byCourse = new Map();
    for (const row of summary) {
      if (!byCourse.has(row.courseId)) {
        byCourse.set(row.courseId, { courseId: row.courseId, courseTitle: row.courseTitle, total: 0, active: 0, subjects: [] });
      }
      const group = byCourse.get(row.courseId);
      group.total += row.total;
      group.active += row.active;
      group.subjects.push(row);
    }
    const list = Array.from(byCourse.values());
    list.sort((x, y) => collator.compare(x.courseTitle, y.courseTitle));
    list.forEach((group) => group.subjects.sort((x, y) => (
      Number(y.isGeneral) - Number(x.isGeneral) || collator.compare(x.subjectName, y.subjectName)
    )));
    return list;
  }, [summary]);

  const totals = useMemo(() => ({
    total: summary.reduce((sum, row) => sum + row.total, 0),
    active: summary.reduce((sum, row) => sum + row.active, 0),
  }), [summary]);

  const currentCourse = groups.find((group) => String(group.courseId) === courseParam) || null;
  const currentSubject = currentCourse
    ? currentCourse.subjects.find((row) => (row.isGeneral ? 'general' : String(row.topicId)) === subjectParam) || null
    : null;
  const currentFolder = currentSubject ? folders[subjectKey(currentSubject)] : null;
  const searching = Boolean(appliedFilters.current.search.trim());

  const loadMeta = useCallback(async () => {
    try {
      const meta = await fetchQuizzesMeta();
      setCourses(meta.courses || []);
      setSubjects(meta.subjects || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load assessment metadata'));
    }
  }, []);

  const buildParams = (nextFilters) => {
    const params = {};
    if (nextFilters.search.trim()) params.search = nextFilters.search.trim();
    if (nextFilters.courseId) params.courseId = nextFilters.courseId;
    if (nextFilters.subjectId) params.topicId = nextFilters.subjectId;
    if (nextFilters.status) params.status = nextFilters.status === 'draft' ? 'inactive' : nextFilters.status;
    return params;
  };

  /** Fetch one page of a folder's assessments. */
  const loadFolder = useCallback(async (subject, { reset = false } = {}) => {
    const key = subjectKey(subject);
    setFolders((current) => ({ ...current, [key]: { ...(reset ? {} : current[key]), loading: true, error: '' } }));
    try {
      const have = reset ? 0 : (foldersRef.current[key]?.items?.length || 0);
      const data = await fetchQuizzes({
        ...buildParams(appliedFilters.current),
        courseId: subject.courseId,
        topicId: subject.isGeneral ? 'general' : subject.topicId,
        limit: PAGE_SIZE,
        offset: have,
        order: 'asc',
      });
      setFolders((current) => ({
        ...current,
        [key]: { items: [...(reset ? [] : current[key]?.items || []), ...data], loading: false, error: '' },
      }));
    } catch (loadError) {
      setFolders((current) => ({
        ...current,
        [key]: { items: reset ? [] : current[key]?.items || [], loading: false, error: getErrorMessage(loadError, 'Unable to load this folder') },
      }));
    }
  }, []);

  const foldersRef = useRef({});
  useEffect(() => { foldersRef.current = folders; }, [folders]);

  /** Search mode: one flat, paged list instead of folders. */
  const loadSearch = useCallback(async (nextFilters, { reset = true } = {}) => {
    setSearchResults((current) => ({ ...(reset ? { items: [] } : current), loading: true, more: false, error: '' }));
    try {
      const have = reset ? 0 : searchRef.current.items.length;
      const data = await fetchQuizzes({ ...buildParams(nextFilters), limit: PAGE_SIZE, offset: have, order: 'asc' });
      setSearchResults((current) => ({
        items: [...(reset ? [] : current.items), ...data], loading: false, more: data.length === PAGE_SIZE, error: '',
      }));
    } catch (loadError) {
      setSearchResults((current) => ({ ...current, loading: false, error: getErrorMessage(loadError, 'Unable to search') }));
    }
  }, []);

  const searchRef = useRef(searchResults);
  useEffect(() => { searchRef.current = searchResults; }, [searchResults]);

  const loadQuizzes = useCallback(async (nextFilters = quizInitialFilters) => {
    setLoading(true);
    try {
      appliedFilters.current = nextFilters;
      const rows = await fetchQuizzesSummary(buildParams(nextFilters));
      setSummary(Array.isArray(rows) ? rows : []);
      setFolders({});
      if (nextFilters.search.trim()) loadSearch(nextFilters);
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load assessments'));
    } finally {
      setLoading(false);
    }
  }, [loadSearch]);

  useEffect(() => {
    loadMeta();
    loadQuizzes(quizInitialFilters);
  }, [loadMeta, loadQuizzes]);

  // Going inside a subject (by click, Back button, or a refreshed URL) loads it.
  useEffect(() => {
    if (searching || !currentSubject) return;
    if (!foldersRef.current[subjectKey(currentSubject)]) loadFolder(currentSubject, { reset: true });
  }, [currentSubject, searching, loadFolder]);

  const go = (course, subject) => {
    const next = new URLSearchParams();
    if (course) next.set('course', String(course));
    if (subject) next.set('subject', subject);
    setSearchParams(next);
  };

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => {
      const next = { ...current, [name]: value };
      if (name === 'courseId') {
        next.subjectId = '';
      }
      return next;
    });
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    go();
    await loadQuizzes(filters);
  }

  async function handleReset() {
    const nextFilters = { search: '', courseId: '', subjectId: '', status: '' };
    setFilters(nextFilters);
    go();
    await loadQuizzes(nextFilters);
  }

  /** Opens the delete question for these assessments (one or many). */
  async function openDelete(ids) {
    setError('');
    setSuccess('');
    setDeleteState({ ids, count: ids.length, preview: null, withQuestions: false, busy: false, error: '' });
    try {
      const preview = await previewBulkDeleteQuizzes(ids);
      setDeleteState((current) => (current ? { ...current, preview } : current));
    } catch (previewError) {
      setDeleteState((current) => (current ? { ...current, error: getErrorMessage(previewError, 'Unable to check these assessments') } : current));
    }
  }

  async function confirmDelete() {
    if (!deleteState?.preview) return;
    setDeleteState((current) => ({ ...current, busy: true, error: '' }));
    try {
      const result = await bulkDeleteQuizzes(deleteState.ids, deleteState.withQuestions);
      const parts = [`${result.deletedQuizzes} assessment${result.deletedQuizzes === 1 ? '' : 's'} deleted`];
      if (result.deletedQuestions) parts.push(`${result.deletedQuestions} question${result.deletedQuestions === 1 ? '' : 's'} deleted`);
      if (result.keptQuestions) parts.push(`${result.keptQuestions} question${result.keptQuestions === 1 ? '' : 's'} kept in the question bank`);
      setSuccess(`${parts.join(', ')}.`);
      setDeleteState(null);
      setSelected(new Set());
      await loadQuizzes(appliedFilters.current);
    } catch (deleteError) {
      setDeleteState((current) => (current ? { ...current, busy: false, error: getErrorMessage(deleteError, 'Unable to delete') } : current));
    }
  }

  /** Approve (draft → active) or move back to draft for everything selected. */
  async function changeSelectedStatus(status) {
    const ids = [...selected];
    if (!ids.length || statusBusy) return;
    const approving = status === 'active';
    const question = approving
      ? `Approve ${ids.length} assessment${ids.length === 1 ? '' : 's'}? Students will see them in the Q-Bank and get one notification.`
      : `Move ${ids.length} assessment${ids.length === 1 ? '' : 's'} back to draft? Students will no longer see them.`;
    if (!window.confirm(question)) return;
    setError('');
    setSuccess('');
    setStatusBusy(true);
    try {
      const result = await bulkSetQuizStatus(ids, status);
      const done = `${result.changed} assessment${result.changed === 1 ? '' : 's'} ${approving ? 'approved' : 'moved to draft'}`;
      const skipped = Array.isArray(result.skipped) ? result.skipped : [];
      const reasons = [...new Set(skipped.map((item) => item.reason))].slice(0, 3).join('; ');
      setSuccess(skipped.length ? `${done}. ${skipped.length} skipped (${reasons}).` : `${done}.`);
      setSelected(new Set());
      await loadQuizzes(appliedFilters.current);
    } catch (statusError) {
      setError(getErrorMessage(statusError, 'Unable to change the status'));
    } finally {
      setStatusBusy(false);
    }
  }

  function handleDelete(quiz) {
    openDelete([quiz.id]);
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(ids, checked) {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  // A selection belongs to the folder it was made in.
  useEffect(() => {
    setSelected(new Set());
  }, [courseParam, subjectParam, searching]);

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Assessments"
          subtitle="Assessment Library"
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {success ? <div className={ui.feedbackSuccess}>{success}</div> : null}

        <section className={overviewGrid}>
          <article className={overviewCard}>
            <span className={overviewLabel}>Assessments</span>
            <strong className={overviewValue}>{totals.total}</strong>
            <p className={overviewText}>All assessments matching the current search and filters.</p>
          </article>
          <article className={overviewCard}>
            <span className={overviewLabel}>Active</span>
            <strong className={overviewValue}>{totals.active}</strong>
            <p className={overviewText}>Published assessments students can access right now.</p>
          </article>
          <article className={overviewCard}>
            <span className={overviewLabel}>Drafts</span>
            <strong className={overviewValue}>{totals.total - totals.active}</strong>
            <p className={overviewText}>Works in progress waiting for review or activation.</p>
          </article>
        </section>

        <section className={cx(ui.panelCard, 'grid gap-3 !p-4')}>
          <div className={cx(ui.panelTop, '!mb-0')}>
            <div>
              <h2>Assessment Library</h2>
              <p>Filter the catalog, review status, and jump into the builder when needed.</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 max-[560px]:grid max-[560px]:w-full max-[560px]:grid-cols-2">
              <button className={cx(ui.secondaryAction, '!min-h-10 whitespace-nowrap !px-4')} type="button" onClick={() => navigate('/quizzes/import-sets')}>Import sets (JSON)</button>
              <button className={cx(ui.primaryAction, '!min-h-10 whitespace-nowrap !px-4')} type="button" onClick={() => navigate('/quizzes/new')}>Create Assessment</button>
            </div>
          </div>

          <form className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto] items-end gap-3 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1 [&_label]:min-w-0" onSubmit={handleFilterSubmit}>
            <label className={ui.formLabel}>
              Search
              <input className={ui.input} name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search admin or student title" />
            </label>
            <label className={ui.formLabel}>
              Course
              <select className={ui.input} name="courseId" value={filters.courseId} onChange={handleFilterChange}>
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.courseTitle}</option>
                ))}
              </select>
            </label>
            <label className={ui.formLabel}>
              Subject
              <select className={ui.input} name="subjectId" value={filters.subjectId} onChange={handleFilterChange}>
                <option value="">All subjects</option>
                {visibleSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                ))}
              </select>
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input} name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <div className="flex items-center gap-2 max-[1000px]:col-span-2 max-[560px]:col-span-1 max-[560px]:grid max-[560px]:grid-cols-2">
              <button className={cx(ui.primaryAction, '!min-h-10 whitespace-nowrap !px-4')} type="submit">Apply Filters</button>
              <button type="button" className={cx(ui.secondaryAction, '!min-h-10 whitespace-nowrap !px-4')} onClick={handleReset}>Reset</button>
            </div>
          </form>
        </section>

        <QuizMap
          groups={groups}
          loading={loading}
          course={currentCourse}
          subject={currentSubject}
          folder={currentFolder}
          searching={searching}
          searchResults={searchResults}
          selected={selected}
          onToggle={toggleSelected}
          onToggleAll={toggleAll}
          onClearSelection={() => setSelected(new Set())}
          onDeleteSelected={() => openDelete([...selected])}
          onSetStatus={changeSelectedStatus}
          statusBusy={statusBusy}
          onGoRoot={() => go()}
          onOpenCourse={(group) => go(group.courseId)}
          onOpenSubject={(row) => go(row.courseId, row.isGeneral ? 'general' : String(row.topicId))}
          onBack={() => (currentSubject ? go(currentCourse.courseId) : go())}
          onLoadMore={() => (searching ? loadSearch(appliedFilters.current, { reset: false }) : loadFolder(currentSubject))}
          onEdit={(id) => navigate(`/quizzes/${id}/edit`)}
          onDelete={handleDelete}
          deletingId={deletingId}
        />

        {deleteState ? (
          <DeleteDialog
            state={deleteState}
            onChoose={(withQuestions) => setDeleteState((current) => ({ ...current, withQuestions }))}
            onCancel={() => setDeleteState(null)}
            onConfirm={confirmDelete}
          />
        ) : null}
      </section>
    </main>
  );
}
