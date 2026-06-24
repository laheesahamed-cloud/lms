import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCourse, deleteCourse, fetchCourses, updateCourse } from '../../../../shared/api/courses.api.js';
import { createTopic, deleteTopic, fetchTopic, fetchTopics, updateTopic } from '../../../../shared/api/topics.api.js';
import { createSubtopic, deleteSubtopic, fetchSubtopics, updateSubtopic } from '../../../../shared/api/subtopics.api.js';
import { adminDeleteAiNote, adminListAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const courseDefaults = {
  courseTitle: '',
  courseCode: '',
  description: '',
  examType: 'ERPM',
  status: 'active',
};

const subjectDefaults = {
  topicName: '',
  topicDescription: '',
  subtopics: [],
  status: 'active',
};

const topicDefaults = {
  subtopicName: '',
  status: 'active',
};

const structureUi = {
  modal: 'max-w-[760px]',
  hero:
    'grid grid-cols-[minmax(0,1fr)_minmax(280px,440px)] items-start gap-[18px] px-6 py-5 max-[1180px]:grid-cols-1',
  heroCopy:
    '[&_h2]:my-2 [&_h2]:mb-2 [&_h2]:text-[1.5rem] max-[640px]:[&_h2]:text-[1.2rem] [&_h2]:leading-[1.15] [&_p]:max-w-[640px] [&_p]:text-[0.92rem] [&_p]:leading-[1.55] [&_p]:text-ink-soft',
  heroStats:
    'flex max-w-[440px] flex-wrap items-start justify-end gap-2 justify-self-end overflow-y-hidden pb-0 max-[1180px]:max-w-none max-[1180px]:justify-start max-[1180px]:justify-self-stretch',
  miniStat:
    'min-h-[58px] min-w-[82px] flex-[0_0_82px] rounded-[14px] border border-line-soft bg-surface-glass-subtle px-2.5 py-2 [&_strong]:block [&_strong]:text-[0.95rem] [&_strong]:leading-[1.1] [&_span]:mt-[3px] [&_span]:block [&_span]:text-[0.68rem] [&_span]:leading-[1.15] [&_span]:text-ink-soft',
  levelOne: 'grid min-w-0 grid-cols-1 gap-4',
  gridThree:
    'grid min-w-0 grid-cols-3 items-stretch gap-6 max-[1180px]:grid-cols-2 max-[980px]:grid-cols-1',
  column:
    'flex min-h-[620px] min-w-0 flex-col gap-4 rounded-2xl p-6 max-[820px]:min-h-0 max-[820px]:p-5',
  levelOneColumn: 'min-h-0 gap-2.5 rounded-xl p-3',
  columnHead:
    'mb-0 flex min-h-[88px] items-start justify-between gap-4 max-[820px]:flex-wrap [&>div]:min-w-0 [&_h2]:my-2 [&_h2]:text-xl [&_h2]:leading-tight [&_p]:m-0 [&_p]:text-[0.92rem] [&_p]:leading-normal [&_p]:text-ink-soft',
  levelOneHead:
    'min-h-0 items-center gap-3 [&_h2]:my-0.5 [&_h2]:text-[1rem] [&_p]:text-[0.76rem] [&_p]:leading-snug',
  columnAddButton: 'shrink-0 self-start min-w-[88px] max-[820px]:w-full',
  levelOneAddButton: 'min-h-[30px] min-w-0 self-center rounded-[var(--radius-sm)] px-3 text-xs max-[820px]:w-auto',
  columnMeta:
    'rounded-[18px] border border-line-soft bg-surface-glass-subtle p-4 text-[0.92rem] leading-normal text-ink-soft',
  levelOneMeta:
    'w-fit rounded-full px-3 py-1 text-[0.72rem] font-semibold leading-tight',
  list: 'flex flex-1 flex-col content-start gap-4',
  levelOneList:
    'flex-row flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-0.5 max-[820px]:flex-wrap max-[820px]:overflow-x-visible',
  node:
    'flex min-h-[88px] items-center gap-4 rounded-xl border border-line-soft bg-surface-glass-subtle p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition max-[820px]:flex-wrap max-[820px]:items-start',
  nodeSelectable:
    'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
  nodeSelected:
    'border-brand-primary/35 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(6,182,212,0.08))] shadow-[0_14px_30px_rgba(15,23,42,0.06),inset_0_0_0_1px_rgba(37,99,235,0.14)]',
  levelOneNode:
    'min-h-9 min-w-[152px] flex-none gap-2 rounded-full px-2.5 py-1.5 shadow-none max-[820px]:min-w-[min(100%,190px)]',
  status:
    'w-2.5 shrink-0 self-stretch rounded-full bg-slate-400/40',
  statusActive: 'bg-[linear-gradient(180deg,#06b6d4,#2563eb)]',
  statusInactive: 'bg-[linear-gradient(180deg,#94a3b8,#64748b)]',
  levelOneStatus: 'w-2',
  nodeBody:
    'grid min-w-0 flex-1 content-center gap-1 text-left [&_span]:text-[0.86rem] [&_span]:leading-normal [&_span]:text-ink-soft [&_strong]:text-base [&_strong]:font-bold [&_strong]:leading-snug',
  levelOneBody:
    'gap-0 [&_span]:truncate [&_span]:text-[0.68rem] [&_strong]:truncate [&_strong]:text-[0.76rem]',
  nodeActions:
    'flex shrink-0 items-center justify-end gap-2 max-[820px]:w-full',
  levelOneActions: 'hidden',
  tableStack: 'grid min-w-0 gap-4',
  tablePanel: 'grid min-w-0 gap-3 rounded-xl p-4 max-[640px]:p-3',
  tableHeader:
    'flex min-w-0 items-center justify-between gap-3 max-[640px]:grid max-[640px]:grid-cols-1 [&_h2]:m-0 [&_h2]:text-base [&_h2]:font-extrabold [&_p]:m-0 [&_p]:mt-1 [&_p]:text-xs [&_p]:leading-normal [&_p]:text-ink-soft',
  tableHeaderCopy: 'min-w-0',
  tableMeta: 'inline-flex min-h-7 w-fit items-center rounded-full border border-line-soft bg-surface-glass-subtle px-3 text-[11px] font-bold text-ink-soft',
  table: 'w-full min-w-[780px] border-collapse',
  tableRow:
    'transition-[background,color] duration-150 ease-[var(--ease-out)] hover:bg-surface-2/70',
  tableRowSelectable: 'cursor-pointer',
  tableRowSelected:
    'bg-[linear-gradient(90deg,rgba(37,99,235,0.16),rgba(20,184,166,0.08))]',
  tableCellName: 'grid min-w-0 gap-1 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_span]:truncate [&_span]:text-xs [&_span]:text-ink-muted',
  tableStatus:
    'inline-flex min-h-7 w-fit items-center gap-2 rounded-full border border-line-soft bg-surface-glass-subtle px-2.5 text-[11px] font-extrabold capitalize text-ink-soft',
  tableStatusDot: 'size-2 rounded-full bg-slate-400/70',
  tableStatusDotActive: 'bg-brand-primary shadow-[0_0_0_3px_rgba(37,99,235,0.12)]',
  tableActions: 'flex min-w-[84px] justify-end gap-2',
  folderHead:
    'flex min-w-0 flex-wrap items-end justify-between gap-3',
  folderHeadCopy:
    'min-w-0 [&_h2]:m-0 [&_h2]:text-[19px] [&_h2]:font-black [&_h2]:uppercase [&_h2]:leading-tight [&_p]:m-0 [&_p]:mt-1 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-ink-soft',
  folderGrid:
    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-4 max-[520px]:gap-3',
  folderCard:
    'glass-card group flex min-h-[132px] min-w-0 w-full cursor-pointer flex-col justify-center overflow-hidden rounded-xl border border-line-soft bg-surface-card text-left outline-none transition-[transform,border-color,box-shadow] duration-150 ease-[var(--ease-out)] active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand-primary/22 hover:border-brand-primary/24 hover:shadow-md',
  folderCardTop:
    'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-5 py-5 max-[520px]:grid-cols-1 max-[520px]:px-4 max-[520px]:py-4',
  folderIcon:
    'grid size-11 shrink-0 place-items-center rounded-xl border border-brand-primary/18 bg-[var(--color-primary-light)] text-brand-primary',
  folderTitle:
    'line-clamp-2 text-[15px] font-extrabold leading-snug text-ink-strong',
  folderMeta:
    'mt-1 text-[11px] font-semibold text-ink-muted',
  folderCount:
    'shrink-0 text-right max-[520px]:text-left [&_strong]:block [&_strong]:text-[30px] [&_strong]:font-extrabold [&_strong]:leading-none [&_strong]:text-ink-strong max-[520px]:[&_strong]:text-[26px] [&_span]:mt-0.5 [&_span]:block [&_span]:text-[11px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[0.12em] [&_span]:text-ink-muted',
  cardActions:
    'flex shrink-0 items-center justify-end gap-2',
  folderToolbar:
    'grid gap-3 rounded-xl border border-line-soft bg-surface-card p-3 shadow-[var(--card-shadow)]',
  folderToolbarMain:
    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 max-[700px]:grid-cols-1',
  folderToolbarTitle:
    'min-w-0 text-[18px] font-extrabold text-brand-primary',
  folderToolbarContext:
    'mt-1 truncate text-[12px] font-semibold text-ink-soft',
  pathBar:
    'flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-line-soft/80 bg-surface-2/70 px-3 py-2',
  pathLabel:
    'text-[11px] font-extrabold uppercase text-ink-muted',
  breadcrumb:
    'flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] font-extrabold text-ink-muted',
  breadcrumbItem:
    'inline-flex min-h-7 max-w-[210px] items-center truncate rounded-full border border-line-soft bg-surface-2 px-3 text-ink-soft',
  breadcrumbCurrent:
    'border-brand-primary/22 bg-[var(--color-primary-light)] text-brand-primary',
  breadcrumbSeparator:
    'text-ink-muted',
  countPill:
    'inline-flex min-h-9 items-center justify-center rounded-full border border-line-soft bg-surface-2 px-3 text-[12px] font-extrabold text-ink-soft',
  rowList:
    'grid gap-3',
  rowShell:
    'glass-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-xl border border-line-soft bg-surface-card pr-3 max-[920px]:grid-cols-1 max-[920px]:pr-0',
  folderRow:
    'grid min-h-[76px] w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-0 bg-transparent px-4 py-3 text-left transition-[background] duration-150 ease-[var(--ease-out)] hover:bg-surface-2/70 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/22 max-[760px]:grid-cols-[auto_minmax(0,1fr)] max-[420px]:gap-3 max-[420px]:px-3',
  rowIndex:
    'grid size-9 place-items-center rounded-full border border-line-soft bg-surface-2 text-[12px] font-extrabold text-ink-muted',
  rowBody:
    'grid min-w-0 gap-1 [&_strong]:truncate [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:truncate [&_span]:text-[12px] [&_span]:font-semibold [&_span]:text-ink-muted',
  rowActions:
    'flex flex-wrap items-center justify-end gap-2 max-[760px]:col-span-2 max-[760px]:justify-start max-[760px]:pl-[52px] max-[420px]:pl-0',
  inlineActions:
    'px-3 py-3 max-[920px]:justify-start max-[920px]:border-t max-[920px]:border-line-soft/70 max-[920px]:px-4',
};

function countActive(items) {
  return items.filter((item) => item.status === 'active').length;
}

function buildCourseSubjectCounts(subjectItems) {
  return subjectItems.reduce((counts, subject) => {
    const key = String(subject.courseId || '');
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function EntityModal({ open, title, subtitle, children, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, structureUi.modal)} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{title}</h2>
            {subtitle ? <p className={ui.entityModalText}>{subtitle}</p> : null}
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SparkleIcon() {
  return <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ display:'inline-block', verticalAlign:'middle' }}><path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>;
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9.5 1.5 12.5 4.5 5 12H2V9L9.5 1.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.25 3.5h9.5M5.25 1.75h3.5M5 5.25v5M9 5.25v5M3.35 3.5l.45 7.5a1.25 1.25 0 0 0 1.25 1.18h3.9A1.25 1.25 0 0 0 10.2 11l.45-7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 6.5A2.5 2.5 0 0 1 5 4h3.1l1.6 1.7H15A2.5 2.5 0 0 1 17.5 8v5.5A2.5 2.5 0 0 1 15 16H5a2.5 2.5 0 0 1-2.5-2.5v-7Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M2.8 8h14.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3.5 8.5 7 5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8.5 3 4.5 7l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status = 'active' }) {
  return (
    <span className={structureUi.tableStatus}>
      <span className={cx(structureUi.tableStatusDot, status === 'active' && structureUi.tableStatusDotActive)} aria-hidden="true" />
      {status}
    </span>
  );
}

function StructureBreadcrumb({ items }) {
  return (
    <nav className={structureUi.breadcrumb} aria-label="Structure hierarchy">
      {items.map((item, index) => (
        <span className="contents" key={`${item}-${index}`}>
          {index > 0 ? <span className={structureUi.breadcrumbSeparator} aria-hidden="true">&gt;</span> : null}
          <span className={cx(structureUi.breadcrumbItem, index === items.length - 1 && structureUi.breadcrumbCurrent)}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

function FolderToolbar({ title, contextLabel, onBack, countLabel, actionLabel, onAction, breadcrumbItems }) {
  return (
    <div className={structureUi.folderToolbar}>
      <div className={structureUi.folderToolbarMain}>
        <button type="button" className={cx(ui.secondaryButton, 'min-h-11 px-4 max-[640px]:w-fit')} onClick={onBack}>
          <BackIcon />
          <span>Back</span>
        </button>
        <div className="min-w-0">
          <div className={structureUi.folderToolbarTitle}>{title || 'Structure'}</div>
          {contextLabel ? <div className={structureUi.folderToolbarContext}>{contextLabel}</div> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start">
          <span className={structureUi.countPill}>{countLabel}</span>
          {actionLabel ? (
            <button type="button" className={cx(ui.panelAddButton, 'min-h-9')} onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className={structureUi.pathBar}>
        <span className={structureUi.pathLabel}>Path</span>
        <StructureBreadcrumb items={breadcrumbItems || [title || 'Structure']} />
      </div>
    </div>
  );
}

function FolderActions({ label, onEdit, onDelete, extraAction, className }) {
  return (
    <div className={cx(structureUi.cardActions, className)}>
      {extraAction || null}
      <button type="button" className={ui.squareIconButton} onClick={onEdit} aria-label={`Edit ${label}`}>
        <EditIcon />
      </button>
      <button type="button" className={ui.squareDangerIconButton} onClick={onDelete} aria-label={`Delete ${label}`}>
        <DeleteIcon />
      </button>
    </div>
  );
}

function FolderCard({ title, meta, count, countLabel, status, onOpen, onEdit, onDelete }) {
  return (
    <article className={cx(structureUi.folderCard, 'grid grid-cols-[minmax(0,1fr)_auto] items-center max-[700px]:grid-cols-1')}>
      <button type="button" className="grid min-w-0 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        <div className={structureUi.folderCardTop}>
            <div className="flex min-w-0 items-start gap-3">
              <span className={structureUi.folderIcon}>
                <FolderIcon />
              </span>
              <div className="min-w-0">
                <div className={structureUi.folderTitle}>{title}</div>
                <div className={structureUi.folderMeta}>{meta}</div>
                <div className="mt-2">
                  <StatusPill status={status} />
                </div>
              </div>
            </div>
            <div className={structureUi.folderCount}>
              <strong>{count}</strong>
              <span>{countLabel}</span>
            </div>
        </div>
      </button>
      <FolderActions label={title} onEdit={onEdit} onDelete={onDelete} className={structureUi.inlineActions} />
    </article>
  );
}

function FolderHeader({ eyebrow, title, description, countLabel, actionLabel, onAction, breadcrumbItems }) {
  return (
    <div className={structureUi.folderHead}>
      <div className={structureUi.folderHeadCopy}>
        <span className={ui.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="mt-3">
          <StructureBreadcrumb items={breadcrumbItems || [title]} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start">
        <span className={structureUi.countPill}>{countLabel}</span>
        <button type="button" className={cx(ui.panelAddButton, 'min-h-9')} onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function EmptyFolder({ children }) {
  return (
    <div className={cx(ui.emptyBox, 'rounded-xl py-10 text-center')}>
      {children}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className={structureUi.folderGrid}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className={cx(ui.skeletonCard, 'h-[132px]')} />
      ))}
    </div>
  );
}

function StructureRow({ index, title, meta, countLabel, status, onOpen, onEdit, onDelete, extraAction }) {
  return (
    <article className={structureUi.rowShell}>
      <button type="button" className={structureUi.folderRow} onClick={onOpen}>
        <strong className={structureUi.rowIndex}>{String(index + 1).padStart(2, '0')}</strong>
        <span className={structureUi.rowBody}>
          <strong>{title}</strong>
          <span>{meta}</span>
        </span>
        <span className={structureUi.rowActions}>
          {countLabel ? <span className={structureUi.countPill}>{countLabel}</span> : null}
          <StatusPill status={status} />
          <span className="grid size-9 place-items-center text-ink-muted" aria-hidden="true">
            <ChevronIcon />
          </span>
        </span>
      </button>
      <FolderActions label={title} onEdit={onEdit} onDelete={onDelete} extraAction={extraAction} className={structureUi.inlineActions} />
    </article>
  );
}

function stopAndRun(event, action) {
  event.stopPropagation();
  action(event);
}

export function StructurePage() {
  const navigate = useNavigate();
  const feedbackTimerRef = useRef(null);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [aiLessons, setAiLessons] = useState([]);
  const [courseSubjectCounts, setCourseSubjectCounts] = useState({});

  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [activeLevel, setActiveLevel] = useState('courses');

  const [courseForm, setCourseForm] = useState(courseDefaults);
  const [subjectForm, setSubjectForm] = useState(subjectDefaults);
  const [topicForm, setTopicForm] = useState(topicDefaults);

  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingTopicId, setEditingTopicId] = useState(null);

  const [tagInput, setTagInput] = useState('');
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [loading, setLoading] = useState({
    courses: true,
    subjects: false,
    topics: false,
    lessons: false,
  });
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState({
    course: false,
    subject: false,
    topic: false,
    lesson: false,
  });

  useEffect(() => (
    () => window.clearTimeout(feedbackTimerRef.current)
  ), []);

  useEffect(() => {
    loadCourses();
    loadAiLessons();
  }, []);

  async function loadAiLessons() {
    setLoading((current) => ({ ...current, lessons: true }));
    try {
      const data = await adminListAiNotes();
      setAiLessons(data);
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load lessons'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, lessons: false }));
    }
  }

  useEffect(() => {
    if (!selectedCourseId) {
      setSubjects([]);
      setSelectedSubjectId(null);
      return;
    }

    loadSubjects(selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setTopics([]);
      setSelectedTopicId(null);
      return;
    }

    loadTopics(selectedSubjectId);
  }, [selectedSubjectId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) || null,
    [topics, selectedTopicId]
  );

  function openCourseFolder(course) {
    setSelectedCourseId(course.id);
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setActiveLevel('subjects');
  }

  function openSubjectFolder(subject) {
    setSelectedSubjectId(subject.id);
    setSelectedTopicId(null);
    setActiveLevel('topics');
  }

  function openTopicFolder(topic) {
    setSelectedTopicId(topic.id);
    setActiveLevel('lessons');
  }

  function goBackFolder() {
    if (activeLevel === 'lessons') {
      setActiveLevel('topics');
      return;
    }

    if (activeLevel === 'topics') {
      setActiveLevel('subjects');
      return;
    }

    setActiveLevel('courses');
  }

  async function loadCourses() {
    setLoading((current) => ({ ...current, courses: true }));
    try {
      const [data, allSubjects] = await Promise.all([
        fetchCourses(),
        fetchTopics().catch(() => []),
      ]);
      setCourses(data);
      setCourseSubjectCounts(buildCourseSubjectCounts(allSubjects));
      setSelectedCourseId((current) => (current && data.some((course) => course.id === current) ? current : null));
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load courses'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, courses: false }));
    }
  }

  async function loadCourseSubjectCounts() {
    try {
      const allSubjects = await fetchTopics();
      setCourseSubjectCounts(buildCourseSubjectCounts(allSubjects));
    } catch {
      setCourseSubjectCounts({});
    }
  }

  async function loadSubjects(courseId) {
    setLoading((current) => ({ ...current, subjects: true }));
    try {
      const data = await fetchTopics(courseId);
      setSubjects(data);
      setSelectedSubjectId((current) => (current && data.some((subject) => subject.id === current) ? current : null));
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load subjects'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, subjects: false }));
    }
  }

  async function loadTopics(subjectId) {
    setLoading((current) => ({ ...current, topics: true }));
    try {
      const data = await fetchSubtopics(subjectId);
      setTopics(data);
      setSelectedTopicId((current) => (current && data.some((topic) => topic.id === current) ? current : null));
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load topics'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, topics: false }));
    }
  }

  function flashMessage(next) {
    window.clearTimeout(feedbackTimerRef.current);
    setFeedback(next);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback((current) => (current === next ? { error: '', success: '' } : current));
      feedbackTimerRef.current = null;
    }, 2400);
  }

  function resetCourseForm() {
    setEditingCourseId(null);
    setCourseForm(courseDefaults);
  }

  function resetSubjectForm() {
    setEditingSubjectId(null);
    setSubjectForm(subjectDefaults);
    setTagInput('');
  }

  function resetTopicForm() {
    setEditingTopicId(null);
    setTopicForm(topicDefaults);
  }

  function closeModal() {
    setModal(null);
    resetCourseForm();
    resetSubjectForm();
    resetTopicForm();
  }

  function openCourseCreate() {
    resetCourseForm();
    setModal('course');
  }

  function openSubjectCreate() {
    if (!selectedCourseId) {
      flashMessage({ error: 'Select a course first', success: '' });
      return;
    }

    resetSubjectForm();
    setModal('subject');
  }

  function openTopicCreate() {
    if (!selectedSubjectId) {
      flashMessage({ error: 'Select a subject first', success: '' });
      return;
    }

    resetTopicForm();
    setModal('topic');
  }

  function openCourseEdit(course, event) {
    event.stopPropagation();
    setEditingCourseId(course.id);
    setCourseForm({
      courseTitle: course.courseTitle,
      courseCode: course.courseCode,
      description: course.description,
      examType: course.examType,
      status: course.status,
    });
    setModal('course');
  }

  async function openSubjectEdit(subject, event) {
    event.stopPropagation();

    try {
      const fullSubject = await fetchTopic(subject.id);
      setEditingSubjectId(subject.id);
      setSubjectForm({
        topicName: fullSubject.topicName,
        topicDescription: fullSubject.topicDescription,
        subtopics: fullSubject.subtopics || [],
        status: fullSubject.status,
      });
      setModal('subject');
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to load subject'), success: '' });
    }
  }

  function openTopicEdit(topic, event) {
    event.stopPropagation();
    setEditingTopicId(topic.id);
    setTopicForm({
      subtopicName: topic.subtopicName,
      status: topic.status,
    });
    setModal('topic');
  }

  function addTagFromInput() {
    const value = tagInput.trim();
    if (!value) {
      return;
    }

    setSubjectForm((current) => ({
      ...current,
      subtopics: current.subtopics.includes(value) ? current.subtopics : [...current.subtopics, value],
    }));
    setTagInput('');
  }

  function removeTag(name) {
    setSubjectForm((current) => ({
      ...current,
      subtopics: current.subtopics.filter((item) => item !== name),
    }));
  }

  async function handleCourseSubmit(event) {
    event.preventDefault();
    setSubmitting((current) => ({ ...current, course: true }));

    try {
      if (editingCourseId) {
        await updateCourse(editingCourseId, courseForm);
        flashMessage({ error: '', success: 'Course updated' });
      } else {
        await createCourse(courseForm);
        flashMessage({ error: '', success: 'Course created' });
      }

      closeModal();
      await loadCourses();
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to save course'), success: '' });
    } finally {
      setSubmitting((current) => ({ ...current, course: false }));
    }
  }

  async function handleSubjectSubmit(event) {
    event.preventDefault();
    setSubmitting((current) => ({ ...current, subject: true }));

    try {
      const payload = { ...subjectForm, courseId: selectedCourseId };

      if (editingSubjectId) {
        await updateTopic(editingSubjectId, payload);
        flashMessage({ error: '', success: 'Subject updated' });
      } else {
        await createTopic(payload);
        flashMessage({ error: '', success: 'Subject created' });
      }

      closeModal();
      await Promise.all([
        loadSubjects(selectedCourseId),
        loadCourseSubjectCounts(),
      ]);
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to save subject'), success: '' });
    } finally {
      setSubmitting((current) => ({ ...current, subject: false }));
    }
  }

  async function handleTopicSubmit(event) {
    event.preventDefault();
    setSubmitting((current) => ({ ...current, topic: true }));

    try {
      const payload = { ...topicForm, topicId: selectedSubjectId };

      if (editingTopicId) {
        await updateSubtopic(editingTopicId, payload);
        flashMessage({ error: '', success: 'Topic updated' });
      } else {
        await createSubtopic(payload);
        flashMessage({ error: '', success: 'Topic created' });
      }

      closeModal();
      await loadTopics(selectedSubjectId);
      await loadSubjects(selectedCourseId);
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to save topic'), success: '' });
    } finally {
      setSubmitting((current) => ({ ...current, topic: false }));
    }
  }

  async function handleCourseDelete(course, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${course.courseTitle}"?`)) {
      return;
    }

    try {
      await deleteCourse(course.id);
      if (selectedCourseId === course.id) {
        setSelectedCourseId(null);
        setSelectedSubjectId(null);
        setSelectedTopicId(null);
        setActiveLevel('courses');
      }
      await loadCourses();
      flashMessage({ error: '', success: 'Course deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete course'), success: '' });
    }
  }

  async function handleSubjectDelete(subject, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${subject.topicName}"?`)) {
      return;
    }

    try {
      await deleteTopic(subject.id);
      if (selectedSubjectId === subject.id) {
        setSelectedSubjectId(null);
        setSelectedTopicId(null);
        setActiveLevel('subjects');
      }
      await Promise.all([
        loadSubjects(selectedCourseId),
        loadCourseSubjectCounts(),
      ]);
      flashMessage({ error: '', success: 'Subject deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete subject'), success: '' });
    }
  }

  async function handleTopicDelete(topic, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${topic.subtopicName}"?`)) {
      return;
    }

    try {
      await deleteSubtopic(topic.id);
      if (selectedTopicId === topic.id) {
        setSelectedTopicId(null);
        setActiveLevel('topics');
      }
      await loadTopics(selectedSubjectId);
      await loadSubjects(selectedCourseId);
      flashMessage({ error: '', success: 'Topic deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete topic'), success: '' });
    }
  }

  async function handleLessonDelete(lesson, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete lesson "${lesson.title}"?`)) {
      return;
    }

    try {
      await adminDeleteAiNote(lesson.id);
      await loadAiLessons();
      flashMessage({ error: '', success: 'Lesson deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete lesson'), success: '' });
    }
  }

  const lessons = useMemo(
    () => aiLessons.filter((note) =>
      String(note.courseId || '') === String(selectedCourseId || '')
      && String(note.topicId || '') === String(selectedSubjectId || '')
      && String(note.subtopicId || '') === String(selectedTopicId || '')
    ),
    [aiLessons, selectedCourseId, selectedSubjectId, selectedTopicId]
  );

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Structure"
          subtitle="Curriculum Builder"
        />

        {feedback.error ? <div className={ui.feedbackError}>{feedback.error}</div> : null}
        {feedback.success ? <div className={ui.feedbackSuccess}>{feedback.success}</div> : null}

        <section className={cx(ui.panelCard, structureUi.hero)}>
          <div className={structureUi.heroCopy}>
            <span className={ui.eyebrow}>Hierarchy Engine</span>
            <h2>Build the academic tree.</h2>
            <p>
              Select a course, then drill down into subjects, topics, and lessons.
            </p>
          </div>

          <div className={structureUi.heroStats}>
            <div className={structureUi.miniStat}>
              <strong>{courses.length}</strong>
              <span>Courses</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{subjects.length}</strong>
              <span>Subjects</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{topics.length}</strong>
              <span>Topics</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{lessons.length}</strong>
              <span>Lessons</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{countActive(courses)}</strong>
              <span>Active</span>
            </div>
          </div>
        </section>

        <section className={cx(ui.panelCard, 'grid gap-4')}>
          {activeLevel === 'courses' ? (
            <>
              <FolderHeader
                eyebrow="Level 1"
                title="Choose a Course"
                description="Open a course folder to manage its subjects, topics, and lessons."
                countLabel={loading.courses ? 'Loading...' : `${courses.length} courses`}
                actionLabel="+ Add Course"
                onAction={openCourseCreate}
                breadcrumbItems={['Courses']}
              />

              {loading.courses ? <LoadingGrid /> : null}
              {!loading.courses && courses.length === 0 ? <EmptyFolder>No courses yet.</EmptyFolder> : null}
              {!loading.courses && courses.length > 0 ? (
                <div className={structureUi.folderGrid}>
                  {courses.map((course) => {
                    const rawSubjectCount = course.subjectCount
                      ?? course.totalSubjectsCount
                      ?? courseSubjectCounts[String(course.id)]
                      ?? course.topics?.length
                      ?? course.subjects?.length;
                    const subjectCount = rawSubjectCount == null ? 0 : Number(rawSubjectCount);
                    const title = course.courseTitle || 'Untitled course';
                    return (
                      <FolderCard
                        key={course.id}
                        title={title}
                        meta={course.description || `${course.examType} • ${course.courseCode}`}
                        count={subjectCount}
                        countLabel={subjectCount === 1 ? 'subject' : 'subjects'}
                        status={course.status || 'active'}
                        onOpen={() => openCourseFolder(course)}
                        onEdit={(event) => openCourseEdit(course, event)}
                        onDelete={(event) => handleCourseDelete(course, event)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}

          {activeLevel === 'subjects' ? (
            <>
              <FolderToolbar
                title="Subjects"
                contextLabel={selectedCourse?.courseTitle ? `Inside ${selectedCourse.courseTitle}` : 'Inside selected course'}
                onBack={goBackFolder}
                countLabel={loading.subjects ? 'Loading...' : `${subjects.length} subjects`}
                actionLabel="+ Add Subject"
                onAction={openSubjectCreate}
                breadcrumbItems={['Courses', selectedCourse?.courseTitle || 'Selected course']}
              />
              {loading.subjects ? <LoadingGrid /> : null}
              {!loading.subjects && subjects.length === 0 ? <EmptyFolder>No subjects in this course.</EmptyFolder> : null}
              {!loading.subjects && subjects.length > 0 ? (
                <div className={structureUi.rowList}>
                  {subjects.map((subject, index) => {
                    const topicCount = Number(subject.subtopicCount || 0);
                    const title = subject.topicName || 'Untitled subject';
                    return (
                      <StructureRow
                        key={subject.id}
                        index={index}
                        title={title}
                        meta={`In ${selectedCourse?.courseTitle || 'course'}`}
                        countLabel={`${topicCount} topic${topicCount === 1 ? '' : 's'}`}
                        status={subject.status || 'active'}
                        onOpen={() => openSubjectFolder(subject)}
                        onEdit={(event) => stopAndRun(event, () => openSubjectEdit(subject, event))}
                        onDelete={(event) => stopAndRun(event, () => handleSubjectDelete(subject, event))}
                      />
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}

          {activeLevel === 'topics' ? (
            <>
              <FolderToolbar
                title="Topics"
                contextLabel={selectedSubject?.topicName ? `Inside ${selectedSubject.topicName}` : 'Inside selected subject'}
                onBack={goBackFolder}
                countLabel={loading.topics ? 'Loading...' : `${topics.length} topics`}
                actionLabel="+ Add Topic"
                onAction={openTopicCreate}
                breadcrumbItems={['Courses', selectedCourse?.courseTitle || 'Selected course', selectedSubject?.topicName || 'Selected subject']}
              />
              {loading.topics ? <LoadingGrid /> : null}
              {!loading.topics && topics.length === 0 ? <EmptyFolder>No topics in this subject.</EmptyFolder> : null}
              {!loading.topics && topics.length > 0 ? (
                <div className={structureUi.rowList}>
                  {topics.map((topic, index) => {
                    const topicLessons = aiLessons.filter((note) =>
                      String(note.courseId || '') === String(selectedCourseId || '')
                      && String(note.topicId || '') === String(selectedSubjectId || '')
                      && String(note.subtopicId || '') === String(topic.id || '')
                    );
                    const title = topic.subtopicName || 'Untitled topic';
                    return (
                      <StructureRow
                        key={topic.id}
                        index={index}
                        title={title}
                        meta={`In ${selectedSubject?.topicName || 'subject'}`}
                        countLabel={`${topicLessons.length} lesson${topicLessons.length === 1 ? '' : 's'}`}
                        status={topic.status || 'active'}
                        onOpen={() => openTopicFolder(topic)}
                        onEdit={(event) => stopAndRun(event, () => openTopicEdit(topic, event))}
                        onDelete={(event) => stopAndRun(event, () => handleTopicDelete(topic, event))}
                      />
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}

          {activeLevel === 'lessons' ? (
            <>
              <FolderToolbar
                title="Lessons"
                contextLabel={selectedTopic?.subtopicName ? `Inside ${selectedTopic.subtopicName}` : 'Inside selected topic'}
                onBack={goBackFolder}
                countLabel={loading.lessons ? 'Loading...' : `${lessons.length} lessons`}
                actionLabel="+ Lesson"
                onAction={() => navigate('/ai-notes')}
                breadcrumbItems={['Courses', selectedCourse?.courseTitle || 'Selected course', selectedSubject?.topicName || 'Selected subject', selectedTopic?.subtopicName || 'Selected topic']}
              />
              {loading.lessons ? <LoadingGrid /> : null}
              {!loading.lessons && lessons.length === 0 ? <EmptyFolder>No lessons in this topic.</EmptyFolder> : null}
              {!loading.lessons && lessons.length > 0 ? (
                <div className={structureUi.rowList}>
                  {lessons.map((lesson, index) => {
                    const title = lesson.title || 'Untitled lesson';
                    return (
                      <StructureRow
                        key={lesson.id}
                        index={index}
                        title={title}
                        meta={`${lesson.status === 'active' ? 'Published' : 'Inactive'} • ${selectedTopic?.subtopicName || 'Topic'}`}
                        status={lesson.status || 'active'}
                        onOpen={() => navigate(`/ai-notes/${lesson.id}`)}
                        onEdit={(event) => stopAndRun(event, () => navigate(`/ai-notes/${lesson.id}`))}
                        onDelete={(event) => stopAndRun(event, () => handleLessonDelete(lesson, event))}
                        extraAction={(
                          <button
                            className={cx(ui.squareIconButton, 'border-brand-primary text-brand-primary')}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/ai-notes/${lesson.id}`);
                            }}
                            aria-label={`Open ${title}`}
                            title="Open lesson"
                          >
                            <SparkleIcon />
                          </button>
                        )}
                      />
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <EntityModal
          open={modal === 'course'}
          title={editingCourseId ? 'Edit course' : 'Create course'}
          subtitle="Program Details"
          onClose={closeModal}
        >
          <form className={cx(ui.stackForm, ui.modalForm)} onSubmit={handleCourseSubmit}>
            <label className={ui.formLabel}>
              Course title
              <input className={ui.input}
                name="courseTitle"
                value={courseForm.courseTitle}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Course code
              <input className={ui.input}
                name="courseCode"
                value={courseForm.courseCode}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Exam type
              <input className={ui.input}
                name="examType"
                value={courseForm.examType}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input}
                name="status"
                value={courseForm.status}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className={ui.formLabel}>
              Description
              <textarea className={ui.textarea}
                name="description"
                rows="4"
                value={courseForm.description}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              />
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting.course}>
                {submitting.course ? 'Saving...' : editingCourseId ? 'Update course' : 'Create course'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </EntityModal>

        <EntityModal
          open={modal === 'subject'}
          title={editingSubjectId ? 'Edit subject' : 'Create subject'}
          subtitle="Subject Setup"
          onClose={closeModal}
        >
          <form className={cx(ui.stackForm, ui.modalForm)} onSubmit={handleSubjectSubmit}>
            <label className={ui.formLabel}>
              Subject name
              <input className={ui.input}
                name="topicName"
                value={subjectForm.topicName}
                onChange={(event) => setSubjectForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Description
              <textarea className={ui.textarea}
                name="topicDescription"
                rows="4"
                value={subjectForm.topicDescription}
                onChange={(event) => setSubjectForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              />
            </label>
            <label className={ui.formLabel}>
              Starter topics
              <div className={ui.tagInputShell}>
                <div className={ui.tagList}>
                  {subjectForm.subtopics.map((name) => (
                    <span className={ui.tagChip} key={name}>
                      {name}
                      <button className={ui.primaryAction} type="button" onClick={() => removeTag(name)}>x</button>
                    </span>
                  ))}
                  <input className={ui.input}
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTagFromInput();
                      }
                    }}
                    placeholder="Type and press Enter"
                  />
                </div>
              </div>
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input}
                name="status"
                value={subjectForm.status}
                onChange={(event) => setSubjectForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting.subject}>
                {submitting.subject ? 'Saving...' : editingSubjectId ? 'Update subject' : 'Create subject'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </EntityModal>

        <EntityModal
          open={modal === 'topic'}
          title={editingTopicId ? 'Edit topic' : 'Create topic'}
          subtitle="Topic Setup"
          onClose={closeModal}
        >
          <form className={cx(ui.stackForm, ui.modalForm)} onSubmit={handleTopicSubmit}>
            <label className={ui.formLabel}>
              Topic name
              <input className={ui.input}
                name="subtopicName"
                value={topicForm.subtopicName}
                onChange={(event) => setTopicForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input}
                name="status"
                value={topicForm.status}
                onChange={(event) => setTopicForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting.topic}>
                {submitting.topic ? 'Saving...' : editingTopicId ? 'Update topic' : 'Create topic'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </EntityModal>

      </section>
    </main>
  );
}
