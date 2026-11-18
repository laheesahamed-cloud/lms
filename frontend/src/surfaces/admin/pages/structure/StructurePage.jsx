import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createCourse, deleteCourse, fetchCourses, updateCourse } from '../../../../shared/api/courses.api.js';
import { createTopic, deleteTopic, fetchTopic, fetchTopics, updateTopic } from '../../../../shared/api/topics.api.js';
import { createSubtopic, deleteSubtopic, fetchSubtopics, updateSubtopic } from '../../../../shared/api/subtopics.api.js';
import { adminDeleteAiNote, adminFixCountsFinish, adminFixCountsSet, adminFixCountsStart, adminListStructureLessons, adminMoveStructureItem, adminSearch, adminUpdateAiNote } from '../../../../shared/api/aiNotes.api.js';
import { createLesson } from '../../../../shared/api/lessons.api.js';
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
    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4 max-[520px]:gap-3',
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
  // One row: [index] title/meta … [counts] [status] [↑ ↓ edit delete] [›].
  // Only very narrow screens drop the buttons onto a second line.
  rowShell:
    'glass-card grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 overflow-hidden rounded-xl border border-line-soft bg-surface-card pr-2 max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:pr-1',
  folderRow:
    'grid min-h-[64px] w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left transition-[background] duration-150 ease-[var(--ease-out)] hover:bg-surface-2/70 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/22 max-[560px]:col-span-2 max-[560px]:grid-cols-[auto_minmax(0,1fr)] max-[420px]:px-3',
  rowIndex:
    'grid size-9 place-items-center rounded-full border border-line-soft bg-surface-2 text-[12px] font-extrabold text-ink-muted',
  rowBody:
    'grid min-w-0 gap-1 [&_strong]:truncate [&_strong]:text-[15px] [&_strong]:font-extrabold [&_strong]:text-ink-strong [&_span]:truncate [&_span]:text-[12px] [&_span]:font-semibold [&_span]:text-ink-muted',
  rowActions:
    'flex shrink-0 items-center justify-end gap-2 max-[560px]:col-span-2 max-[560px]:justify-start max-[560px]:pl-[48px]',
  inlineActions:
    'gap-1.5 py-2 max-[560px]:justify-start max-[560px]:px-4 max-[560px]:pb-3 max-[560px]:pt-0',
  rowChevron:
    'grid size-9 place-items-center rounded-full border-0 !bg-transparent text-ink-muted shadow-none hover:!bg-surface-2 max-[560px]:pb-3',
  rowChildren:
    'col-span-full',
};

function countActive(items) {
  return items.filter((item) => item.status === 'active').length;
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

function UpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 8.5 7 4.5 11 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 5.5 7 9.5 11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

function FolderToolbar({ title, contextLabel, onBack, countLabel, actionLabel, onAction, breadcrumbItems, sorting = false, onToggleSort }) {
  return (
    <div className={structureUi.folderToolbar}>
      <div className={structureUi.folderToolbarMain}>
        <button type="button" className={cx(ui.secondaryButton, 'min-h-11 px-4 max-[640px]:w-fit')} onClick={onBack}>
          <BackIcon />
          <span>Back</span>
        </button>
        <div className="min-w-0">
          <div className={structureUi.folderToolbarTitle}>{title || 'Courses'}</div>
          {contextLabel ? <div className={structureUi.folderToolbarContext}>{contextLabel}</div> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start">
          <span className={structureUi.countPill}>{countLabel}</span>
          {onToggleSort ? (
            // The move arrows stay hidden until the admin asks to reorder.
            <button
              type="button"
              aria-pressed={sorting}
              className={cx(ui.secondaryButton, 'min-h-9 px-4', sorting ? 'border-brand-primary text-brand-primary' : '')}
              onClick={onToggleSort}
            >
              {sorting ? 'Done' : 'Sort'}
            </button>
          ) : null}
          {actionLabel ? (
            <button type="button" className={cx(ui.panelAddButton, 'min-h-9')} onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className={structureUi.pathBar}>
        <span className={structureUi.pathLabel}>Path</span>
        <StructureBreadcrumb items={breadcrumbItems || [title || 'Courses']} />
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
    <article className={cx(structureUi.folderCard, '!justify-between')}>
      <button type="button" className="grid min-w-0 flex-1 border-0 !bg-transparent p-0 text-left shadow-none" onClick={onOpen}>
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
      <FolderActions label={title} onEdit={onEdit} onDelete={onDelete} className="border-t border-line-soft/70 px-4 py-2" />
    </article>
  );
}

function FolderHeader({ eyebrow, title, description, countLabel, actionLabel, onAction, breadcrumbItems, secondaryLabel, onSecondary, secondaryBusy = false, secondaryBusyLabel = 'Checking…', progress = null }) {
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
        {secondaryLabel ? (
          <button type="button" className={cx(ui.secondaryButton, 'min-h-9 px-4')} onClick={onSecondary} disabled={secondaryBusy}>
            {secondaryBusy ? secondaryBusyLabel : secondaryLabel}
          </button>
        ) : null}
        {progress ? (
          <div className="flex w-full min-w-[180px] items-center gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Fix counts progress">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
              <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%` }} />
            </div>
            <span className="shrink-0 text-xs font-semibold text-ink-muted">{progress.fixed} fixed</span>
          </div>
        ) : null}
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

function StructureRow({ index, title, meta, countLabel, status, onOpen, onEdit, onDelete, extraAction, onMoveUp, onMoveDown, children }) {
  const canReorder = typeof onMoveUp === 'function' || typeof onMoveDown === 'function';
  const moveButtons = canReorder ? (
    <span className="flex items-center gap-0.5">
      <button type="button" className={ui.squareIconButton} disabled={!onMoveUp}
              aria-label={`Move ${title} up`} onClick={(event) => stopAndRun(event, onMoveUp)}>
        <UpIcon />
      </button>
      <button type="button" className={ui.squareIconButton} disabled={!onMoveDown}
              aria-label={`Move ${title} down`} onClick={(event) => stopAndRun(event, onMoveDown)}>
        <DownIcon />
      </button>
    </span>
  ) : null;

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
        </span>
      </button>
      <FolderActions label={title} onEdit={onEdit} onDelete={onDelete} extraAction={moveButtons || extraAction} className={structureUi.inlineActions} />
      <button type="button" className={structureUi.rowChevron} onClick={onOpen} aria-label={`Open ${title}`}>
        <ChevronIcon />
      </button>
      {children ? <div className={structureUi.rowChildren}>{children}</div> : null}
    </article>
  );
}

/// The lessons sitting under one hierarchy row, listed in place.
///
/// Every level shows them, because drilling three folders deep just to learn
/// whether a subject has any lessons made the hierarchy hard to read — and
/// ordering only makes sense when you can see what you are ordering.
// A subtopic divider is drawn wherever the subtopic changes while walking the
// lessons in server order. Lesson order is flat per course, so a subtopic can
// appear in more than one run; keys carry the position, not just the label.
function LessonPeek({ lessons, onOpen, showTopics = false }) {
  if (!lessons.length) return null;
  let previousTopic = null;
  return (
    <ol className="m-0 mx-3 mb-2.5 grid list-none gap-0.5 border-t border-line-soft p-0 pt-2">
      {lessons.map((lesson, index) => {
        const topic = String(lesson.subtopicName || '').trim();
        const topicChanged = showTopics && (index === 0 ? Boolean(topic) : topic !== previousTopic);
        previousTopic = topic;
        return (
          <Fragment key={lesson.id}>
            {topicChanged ? (
              <li
                className="flex items-center gap-2 px-1.5 pb-1 pt-2.5 before:h-px before:flex-1 before:bg-line-soft after:h-px after:flex-1 after:bg-line-soft"
                aria-hidden={topic ? undefined : true}
              >
                {/* An untitled run after a titled one gets a bare rule, or its
                    lessons would read as part of the topic above. */}
                {topic ? (
                  <span className="max-w-[75%] truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
                    {topic}
                  </span>
                ) : null}
              </li>
            ) : null}
            <li>
              <button type="button"
                      className="flex w-full items-center gap-2 rounded-md border-0 !bg-transparent px-1.5 py-1 text-left shadow-none hover:!bg-surface-2"
                      onClick={(event) => stopAndRun(event, () => onOpen(lesson))}>
                <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-ink-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-soft">
                  {lesson.title || 'Untitled lesson'}
                </span>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ol>
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
  // Lessons are fetched one subject at a time — only when that subject is opened —
  // and kept for the rest of the visit. Nothing loads every lesson any more; the
  // counts on the cards come from a small request.
  const [lessonsBySubject, setLessonsBySubject] = useState({}); // { [subjectId]: { status, rows } }
  // Lessons are managed here (the separate Lessons list was merged in): add in
  // the open topic, publish / hide in place, and search every lesson by title.
  const [lessonForm, setLessonForm] = useState(null); // { title, isFree, saving }
  const [togglingLessonId, setTogglingLessonId] = useState(null);
  const [lessonQuery, setLessonQuery] = useState('');
  const [lessonHits, setLessonHits] = useState(null); // null = not searched
  const lessonRequestsRef = useRef(new Map());
  // Subjects per course and topics per subject, remembered for this visit so
  // going back and forth doesn't ask the server again. Every change re-reads.
  const subjectsCacheRef = useRef(new Map());
  const topicsCacheRef = useRef(new Map());
  // Reorder arrows show only after "Sort" is pressed; leaving the level turns it off.
  const [sorting, setSorting] = useState(false);
  const [fixingCounts, setFixingCounts] = useState(false);
  const [fixProgress, setFixProgress] = useState(null); // { done, total, fixed }

  // Which folder you are in lives in the address (?course=&subject=&topic=), so
  // opening a lesson and coming back — or refreshing — lands on the same folder
  // instead of the first level.
  const [searchParams, setSearchParams] = useSearchParams();
  const toId = (value) => {
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  };
  const selectedCourseId = toId(searchParams.get('course'));
  const selectedSubjectId = selectedCourseId ? toId(searchParams.get('subject')) : null;
  const selectedTopicId = selectedSubjectId ? toId(searchParams.get('topic')) : null;
  const activeLevel = selectedTopicId ? 'lessons' : selectedSubjectId ? 'topics' : selectedCourseId ? 'subjects' : 'courses';
  const goTo = ({ course = null, subject = null, topic = null } = {}, { replace = false } = {}) => {
    const next = new URLSearchParams();
    if (course) next.set('course', String(course));
    if (course && subject) next.set('subject', String(subject));
    if (course && subject && topic) next.set('topic', String(topic));
    setSearchParams(next, { replace });
  };
  // Handed to the lesson page so its Back button returns to this exact folder.
  const returnState = { returnTo: `/structure${searchParams.toString() ? `?${searchParams.toString()}` : ''}` };
  // Opening a lesson hands the editor the lists this page already holds, in the
  // shape its dropdowns use (active items, { id, name }), so it doesn't fetch
  // them again. Opened any other way, the editor fetches them as before.
  const lessonNavState = () => ({
    ...returnState,
    structureContext: {
      courseId: selectedCourseId,
      topicId: selectedSubjectId,
      courses: courses
        .filter((course) => course.status === 'active')
        .map((course) => ({ id: course.id, name: course.courseTitle }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
      topics: subjects
        .filter((subject) => subject.status === 'active')
        .map((subject) => ({ id: subject.id, name: subject.topicName })),
      subtopics: topics
        .filter((topic) => topic.status === 'active')
        .map((topic) => ({ id: topic.id, name: topic.subtopicName })),
    },
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-read the course cards (and their stored counts) without the loading
  // placeholders, after a change elsewhere on the page.
  async function refreshCourses() {
    try {
      setCourses(await fetchCourses());
    } catch {
      // The cards keep their last numbers; the folders still open.
    }
  }

  // One request per subject per visit; `force` re-reads it after a change.
  function ensureSubjectLessons(subjectId, { force = false } = {}) {
    const key = String(subjectId || '');
    if (!key) return Promise.resolve();
    if (!force && lessonRequestsRef.current.has(key)) return lessonRequestsRef.current.get(key);
    setLessonsBySubject((current) => ({ ...current, [key]: { status: 'loading', rows: current[key]?.rows || [] } }));
    const request = adminListStructureLessons(subjectId)
      .then((rows) => {
        setLessonsBySubject((current) => ({ ...current, [key]: { status: 'ready', rows: Array.isArray(rows) ? rows : [] } }));
      })
      .catch((error) => {
        lessonRequestsRef.current.delete(key);
        setLessonsBySubject((current) => ({ ...current, [key]: { status: 'error', rows: [] } }));
        setFeedback({ error: getErrorMessage(error, 'Unable to load lessons'), success: '' });
      });
    lessonRequestsRef.current.set(key, request);
    return request;
  }

  useEffect(() => {
    setSorting(false);
  }, [activeLevel, selectedCourseId, selectedSubjectId, selectedTopicId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setSubjects([]);
      return;
    }

    // Coming back to a course opened earlier in this visit reuses its subjects.
    const remembered = subjectsCacheRef.current.get(selectedCourseId);
    if (remembered) setSubjects(remembered);
    else loadSubjects(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setTopics([]);
      return;
    }

    const rememberedTopics = topicsCacheRef.current.get(selectedSubjectId);
    if (rememberedTopics) setTopics(rememberedTopics);
    else loadTopics(selectedSubjectId);
    // Inside a subject its topic rows list their lessons, so load that one subject.
    ensureSubjectLessons(selectedSubjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    goTo({ course: course.id });
  }

  function openSubjectFolder(subject) {
    goTo({ course: selectedCourseId, subject: subject.id });
  }

  function openTopicFolder(topic) {
    goTo({ course: selectedCourseId, subject: selectedSubjectId, topic: topic.id });
  }

  function goBackFolder() {
    if (activeLevel === 'lessons') {
      goTo({ course: selectedCourseId, subject: selectedSubjectId });
      return;
    }

    if (activeLevel === 'topics') {
      goTo({ course: selectedCourseId });
      return;
    }

    goTo();
  }

  async function loadCourses() {
    setLoading((current) => ({ ...current, courses: true }));
    try {
      const data = await fetchCourses();
      setCourses(data);
      if (selectedCourseId && !data.some((course) => course.id === selectedCourseId)) goTo({}, { replace: true });
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load courses'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, courses: false }));
    }
  }

  // Always reads from the server (used on first open and after every change),
  // and remembers the answer for this visit.
  async function loadSubjects(courseId) {
    setLoading((current) => ({ ...current, subjects: true }));
    try {
      const data = await fetchTopics(courseId);
      subjectsCacheRef.current.set(courseId, data);
      setSubjects(data);
      if (selectedSubjectId && !data.some((subject) => subject.id === selectedSubjectId)) goTo({ course: courseId }, { replace: true });
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
      topicsCacheRef.current.set(subjectId, data);
      setTopics(data);
      if (selectedTopicId && !data.some((topic) => topic.id === selectedTopicId)) goTo({ course: selectedCourseId, subject: subjectId }, { replace: true });
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load topics'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, topics: false }));
    }
  }

  // Saves one move: the item and the two neighbours it now sits between. The
  // server changes that one row. If another screen changed the order first,
  // the list is re-read; any other failure puts the list back as it was.
  async function saveMove(kind, list, newIndex, undo, reload) {
    const above = list[newIndex - 1];
    const below = list[newIndex + 1];
    try {
      await adminMoveStructureItem({ kind, id: list[newIndex].id, aboveId: above?.id ?? null, belowId: below?.id ?? null });
    } catch (error) {
      if (error?.response?.status === 409) {
        flashMessage({ error: 'The order changed on another screen, so it was refreshed.', success: '' });
        reload();
      } else {
        undo();
        flashMessage({ error: getErrorMessage(error, 'Unable to save the new order'), success: '' });
      }
    }
  }

  function moveInList(list, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return null;
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return { next, target, moved };
  }

  async function moveSubject(index, direction) {
    const result = moveInList(subjects, index, direction);
    if (!result) return;
    const previous = subjects;
    const courseId = selectedCourseId;
    subjectsCacheRef.current.set(courseId, result.next);
    setSubjects(result.next);
    await saveMove('subject', result.next, result.target,
      () => { subjectsCacheRef.current.set(courseId, previous); setSubjects(previous); },
      () => loadSubjects(courseId));
  }

  async function moveTopic(index, direction) {
    const result = moveInList(topics, index, direction);
    if (!result) return;
    const previous = topics;
    const subjectId = selectedSubjectId;
    topicsCacheRef.current.set(subjectId, result.next);
    setTopics(result.next);
    await saveMove('topic', result.next, result.target,
      () => { topicsCacheRef.current.set(subjectId, previous); setTopics(previous); },
      () => loadTopics(subjectId));
  }

  // Lessons are ranked inside their topic. The page holds the whole subject's
  // lessons, so the moved lesson is put back into that list just before the
  // lesson now below it (or just after the one above, at the bottom).
  async function moveLesson(index, direction) {
    const result = moveInList(lessons, index, direction);
    if (!result) return;
    const key = String(selectedSubjectId || '');
    const previousRows = openSubjectRows;
    const below = result.next[result.target + 1];
    const above = result.next[result.target - 1];
    const rows = previousRows.filter((row) => row.id !== result.moved.id);
    const at = below ? rows.findIndex((row) => row.id === below.id) : rows.findIndex((row) => row.id === above?.id) + 1;
    rows.splice(at < 0 ? rows.length : at, 0, result.moved);
    const setRows = (nextRows) => setLessonsBySubject((current) => ({ ...current, [key]: { ...(current[key] || { status: 'ready' }), rows: nextRows } }));
    setRows(rows);
    await saveMove('lesson', result.next, result.target,
      () => setRows(previousRows),
      () => ensureSubjectLessons(selectedSubjectId, { force: true }));
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
        refreshCourses(),
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

  // Deleting a course or subject also deletes every lesson in it, for good
  // (database cascade), unlike a lesson's own "Delete", which only hides it.
  // With lessons inside, the admin must type DELETE to go ahead.
  function confirmPermanentDelete({ kind, name, lessons, children }) {
    const label = `${kind === 'course' ? 'course' : 'subject'} "${name}"`;
    if (lessons <= 0) {
      return window.confirm(`Delete ${label} and its ${children}?\n\nThis can't be undone.`);
    }
    const typed = window.prompt(
      `⚠️ Permanently delete ${label}?\n\n`
      + `This also PERMANENTLY deletes its ${lessons} lesson${lessons === 1 ? '' : 's'} (plus any hidden ones) and its ${children}. `
      + 'Their notes, flashcards and student progress are lost.\n\n'
      + 'This cannot be undone. Type DELETE to confirm.',
    );
    if (typed === null) return false;
    if (typed.trim() !== 'DELETE') {
      flashMessage({ error: 'Not deleted: type DELETE exactly to confirm.', success: '' });
      return false;
    }
    return true;
  }

  // Manual repair of the stored counts (after edits made outside the app, such
  // as an SQL import). Runs in small steps, one request at a time with a short
  // pause, so each request reads under ~1,000 rows and the database never gets
  // a burst. Only the wrong numbers are corrected.
  async function handleFixCounts() {
    const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    setFixingCounts(true);
    try {
      // Request 1: plan + first set (and the finish too when it all fits).
      const plan = await adminFixCountsStart();
      const remaining = Array.isArray(plan?.remaining) ? plan.remaining : [];
      const separateFinish = !plan?.done && !plan?.finishWithLast;
      const total = 1 + remaining.length + (separateFinish ? 1 : 0);
      const issues = [...(plan?.first?.fixed || [])];
      const changed = [...(plan?.first?.changed || [])];
      const courseLessons = { ...(plan?.first?.courseLessons || {}) };
      const finishTotals = () => (plan.courses || []).map((course) => ({
        id: course.id,
        lessons: courseLessons[course.id] || 0,
        expectedLessons: course.lessonCount,
        expectedSubjects: course.subjectCount,
      }));
      if (plan?.done) {
        issues.push(...(plan.finish?.fixed || []));
        changed.push(...(plan.finish?.changed || []));
      }
      setFixProgress({ done: 1, total, fixed: issues.length });

      for (let i = 0; i < remaining.length; i += 1) {
        await pause(300);
        const isLast = i === remaining.length - 1;
        const step = await adminFixCountsSet(plan.runId, remaining[i], isLast && plan.finishWithLast ? finishTotals() : null);
        issues.push(...(step?.fixed || []));
        changed.push(...(step?.changed || []));
        for (const [courseId, n] of Object.entries(step?.courseLessons || {})) {
          courseLessons[courseId] = (courseLessons[courseId] || 0) + Number(n || 0);
        }
        if (step?.finish) {
          issues.push(...(step.finish.fixed || []));
          changed.push(...(step.finish.changed || []));
        }
        setFixProgress({ done: i + 2, total, fixed: issues.length });
      }
      if (separateFinish) {
        await pause(300);
        const end = await adminFixCountsFinish(plan.runId, finishTotals());
        issues.push(...(end?.fixed || []));
        changed.push(...(end?.changed || []));
        setFixProgress({ done: total, total, fixed: issues.length });
      }

      if (issues.length) {
        subjectsCacheRef.current.clear();
        await loadCourses();
        if (selectedCourseId) await loadSubjects(selectedCourseId);
      }
      const label = { lesson_count: 'lessons', subject_count: 'subjects', subtopic_count: 'topics' };
      const shown = issues.slice(0, 3).map((i) => `${i.name} ${label[i.field] || i.field} ${i.stored} → ${i.actual}`).join('; ');
      const note = changed.length ? ` ${changed.length} changed during the fix; run it again to check them.` : '';
      flashMessage({
        error: '',
        success: issues.length
          ? `Fixed ${issues.length} count${issues.length === 1 ? '' : 's'}: ${shown}${issues.length > 3 ? '…' : ''}.${note}`
          : `All counts are correct.${note}`,
      });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to fix counts'), success: '' });
    } finally {
      setFixingCounts(false);
      window.setTimeout(() => setFixProgress(null), 1500);
    }
  }

  async function handleCourseDelete(course, event) {
    event.stopPropagation();
    if (!confirmPermanentDelete({
      kind: 'course',
      name: course.courseTitle,
      lessons: Number(course.lessonCount || 0),
      children: `${Number(course.subjectCount || 0)} subject(s) and all their topics`,
    })) {
      return;
    }

    try {
      await deleteCourse(course.id);
      if (selectedCourseId === course.id) {
        goTo({}, { replace: true });
      }
      await loadCourses();
      flashMessage({ error: '', success: 'Course deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete course'), success: '' });
    }
  }

  async function handleSubjectDelete(subject, event) {
    event.stopPropagation();
    if (!confirmPermanentDelete({
      kind: 'subject',
      name: subject.topicName,
      lessons: Number(subject.lessonCount || 0),
      children: `${Number(subject.subtopicCount || 0)} topic(s)`,
    })) {
      return;
    }

    try {
      await deleteTopic(subject.id);
      if (selectedSubjectId === subject.id) {
        goTo({ course: selectedCourseId }, { replace: true });
      }
      await Promise.all([
        loadSubjects(selectedCourseId),
        refreshCourses(),
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
        goTo({ course: selectedCourseId, subject: selectedSubjectId }, { replace: true });
      }
      await loadTopics(selectedSubjectId);
      await loadSubjects(selectedCourseId);
      flashMessage({ error: '', success: 'Topic deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete topic'), success: '' });
    }
  }

  // Lesson search across every course (replaces the old Lessons list's search):
  // up to 10 title matches from the server, 300 ms after typing stops.
  useEffect(() => {
    const q = lessonQuery.trim();
    if (q.length < 2) {
      setLessonHits(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      adminSearch(q, { only: 'lessons', signal: controller.signal })
        .then((hits) => { if (!controller.signal.aborted) setLessonHits(Array.isArray(hits?.lessons) ? hits.lessons : []); })
        .catch(() => { if (!controller.signal.aborted) setLessonHits([]); });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lessonQuery]);

  // Open a found lesson; Back from the editor returns to its folder here.
  function openFoundLesson(hit) {
    const params = new URLSearchParams();
    if (hit.courseId) params.set('course', String(hit.courseId));
    if (hit.courseId && hit.topicId) params.set('subject', String(hit.topicId));
    if (hit.courseId && hit.topicId && hit.subtopicId) params.set('topic', String(hit.subtopicId));
    navigate(`/ai-notes/${hit.id}`, { state: { returnTo: `/structure${params.toString() ? `?${params.toString()}` : ''}` } });
  }

  // New lesson in the open topic, then straight into the editor (as before).
  // The server adds it to the course and subject counts in the same save.
  async function handleLessonCreate(event) {
    event.preventDefault();
    const title = String(lessonForm?.title || '').trim();
    if (!title || !selectedCourseId || !selectedSubjectId) return;
    setLessonForm((current) => ({ ...current, saving: true }));
    try {
      const lesson = await createLesson({
        courseId: Number(selectedCourseId),
        topicId: Number(selectedSubjectId),
        subtopicId: selectedTopicId ? Number(selectedTopicId) : null,
        lessonTitle: title,
        isFree: lessonForm.isFree ? 1 : 0,
        status: 'active',
      });
      setLessonForm(null);
      navigate(`/ai-notes/${lesson.id}`, { state: lessonNavState() });
    } catch (error) {
      setLessonForm((current) => (current ? { ...current, saving: false } : current));
      flashMessage({ error: getErrorMessage(error, 'Unable to create lesson'), success: '' });
    }
  }

  // Publish / hide in place. Visibility to students only: the stored counts
  // don't change (they count lessons whatever their status).
  async function handleLessonToggle(lesson) {
    const next = lesson.status === 'active' ? 'inactive' : 'active';
    setTogglingLessonId(lesson.id);
    try {
      await adminUpdateAiNote(lesson.id, { status: next });
      const key = String(lesson.topicId || selectedSubjectId);
      setLessonsBySubject((current) => (current[key]
        ? { ...current, [key]: { ...current[key], rows: current[key].rows.map((row) => (row.id === lesson.id ? { ...row, status: next } : row)) } }
        : current));
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to update lesson'), success: '' });
    } finally {
      setTogglingLessonId(null);
    }
  }

  async function handleLessonDelete(lesson, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete lesson "${lesson.title}"?`)) {
      return;
    }

    try {
      await adminDeleteAiNote(lesson.id);
      // The server hid the lesson and took 1 off its course and subject counts
      // in the same statement, so the page does the same on screen instead of
      // reading the lists again.
      const subjectId = Number(lesson.topicId || selectedSubjectId);
      const courseId = Number(lesson.courseId || selectedCourseId);
      const key = String(subjectId);
      const minusOne = (value) => Math.max(0, Number(value || 0) - 1);
      setLessonsBySubject((current) => (current[key]
        ? { ...current, [key]: { ...current[key], rows: current[key].rows.filter((row) => row.id !== lesson.id) } }
        : current));
      const nextSubjects = subjects.map((subject) => (subject.id === subjectId ? { ...subject, lessonCount: minusOne(subject.lessonCount) } : subject));
      if (selectedCourseId) subjectsCacheRef.current.set(selectedCourseId, nextSubjects);
      setSubjects(nextSubjects);
      setCourses((current) => current.map((course) => (course.id === courseId ? { ...course, lessonCount: minusOne(course.lessonCount) } : course)));
      flashMessage({ error: '', success: 'Lesson deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete lesson'), success: '' });
    }
  }

  // The open subject's lessons (loaded when the subject was opened).
  const openSubjectLessons = lessonsBySubject[String(selectedSubjectId || '')];
  const openSubjectRows = useMemo(() => openSubjectLessons?.rows || [], [openSubjectLessons]);
  const lessonsLoading = Boolean(selectedSubjectId) && (!openSubjectLessons || openSubjectLessons.status === 'loading');
  const lessons = useMemo(
    () => openSubjectRows.filter((note) =>
      String(note.subtopicId || '') === String(selectedTopicId || '')
    ),
    [openSubjectRows, selectedTopicId]
  );

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Courses"
          subtitle="Curriculum Builder"
        />

        {feedback.error ? <div className={ui.feedbackError}>{feedback.error}</div> : null}
        {feedback.success ? <div className={ui.feedbackSuccess}>{feedback.success}</div> : null}

        <div className={cx(ui.panelCard, 'grid gap-2 p-3')}>
          <input
            className={ui.input}
            type="search"
            value={lessonQuery}
            onChange={(event) => setLessonQuery(event.target.value)}
            placeholder="Search lessons by title (all courses)"
            aria-label="Search lessons by title"
          />
          {lessonHits ? (
            lessonHits.length ? (
              <ul className="m-0 grid list-none gap-1 p-0">
                {lessonHits.map((hit) => (
                  <li key={hit.id}>
                    <button type="button" className="w-full cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1.5 text-left hover:bg-surface-2" onClick={() => openFoundLesson(hit)}>
                      <strong className="block text-sm text-ink-strong">{hit.title || 'Untitled lesson'}</strong>
                      <span className="text-xs text-ink-muted">
                        {[hit.courseTitle, hit.topicName, hit.subtopicName].filter(Boolean).join(' › ')}
                        {hit.status === 'active' ? '' : ' • Hidden'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <span className="px-2 text-xs text-ink-muted">No lessons match.</span>
          ) : null}
        </div>

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
                secondaryLabel="Fix counts"
                onSecondary={handleFixCounts}
                secondaryBusy={fixingCounts}
                secondaryBusyLabel={fixProgress ? `Fixing ${fixProgress.done}/${fixProgress.total}…` : 'Checking…'}
                progress={fixProgress}
              />

              {loading.courses ? <LoadingGrid /> : null}
              {!loading.courses && courses.length === 0 ? <EmptyFolder>No courses yet.</EmptyFolder> : null}
              {!loading.courses && courses.length > 0 ? (
                <div className={structureUi.folderGrid}>
                  {courses.map((course) => {
                    const rawSubjectCount = course.subjectCount
                      ?? course.totalSubjectsCount
                      ?? course.topics?.length
                      ?? course.subjects?.length;
                    const subjectCount = rawSubjectCount == null ? 0 : Number(rawSubjectCount);
                    const title = course.courseTitle || 'Untitled course';
                    return (
                      <FolderCard
                        key={course.id}
                        title={title}
                        meta={[
                          course.description || `${course.examType} • ${course.courseCode}`,
                          `${Number(course.lessonCount || 0)} lessons`,
                        ].join(' • ')}
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
                sorting={sorting}
                onToggleSort={subjects.length > 1 ? () => setSorting((current) => !current) : undefined}
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
                    const lessonCount = Number(subject.lessonCount || 0);
                    const title = subject.topicName || 'Untitled subject';
                    return (
                      <StructureRow
                        key={subject.id}
                        index={index}
                        title={title}
                        meta={`In ${selectedCourse?.courseTitle || 'course'}`}
                        countLabel={`${topicCount} topic${topicCount === 1 ? '' : 's'} · ${lessonCount} lesson${lessonCount === 1 ? '' : 's'}`}
                        status={subject.status || 'active'}
                        onOpen={() => openSubjectFolder(subject)}
                        onEdit={(event) => stopAndRun(event, () => openSubjectEdit(subject, event))}
                        onDelete={(event) => stopAndRun(event, () => handleSubjectDelete(subject, event))}
                        onMoveUp={sorting && index > 0 ? () => moveSubject(index, -1) : null}
                        onMoveDown={sorting && index < subjects.length - 1 ? () => moveSubject(index, 1) : null}
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
                sorting={sorting}
                onToggleSort={topics.length > 1 ? () => setSorting((current) => !current) : undefined}
                actionLabel="+ Add Topic"
                onAction={openTopicCreate}
                breadcrumbItems={['Courses', selectedCourse?.courseTitle || 'Selected course', selectedSubject?.topicName || 'Selected subject']}
              />
              {loading.topics ? <LoadingGrid /> : null}
              {!loading.topics && topics.length === 0 ? <EmptyFolder>No topics in this subject.</EmptyFolder> : null}
              {!loading.topics && topics.length > 0 ? (
                <div className={structureUi.rowList}>
                  {topics.map((topic, index) => {
                    const topicLessons = openSubjectRows.filter((note) =>
                      String(note.subtopicId || '') === String(topic.id || '')
                    );
                    const title = topic.subtopicName || 'Untitled topic';
                    return (
                      <StructureRow
                        key={topic.id}
                        index={index}
                        title={title}
                        meta={`In ${selectedSubject?.topicName || 'subject'}`}
                        countLabel={lessonsLoading ? 'Loading…' : `${topicLessons.length} lesson${topicLessons.length === 1 ? '' : 's'}`}
                        status={topic.status || 'active'}
                        onOpen={() => openTopicFolder(topic)}
                        onEdit={(event) => stopAndRun(event, () => openTopicEdit(topic, event))}
                        onDelete={(event) => stopAndRun(event, () => handleTopicDelete(topic, event))}
                        onMoveUp={sorting && index > 0 ? () => moveTopic(index, -1) : null}
                        onMoveDown={sorting && index < topics.length - 1 ? () => moveTopic(index, 1) : null}
                      >
                        <LessonPeek lessons={topicLessons} onOpen={(lesson) => navigate(`/ai-notes/${lesson.id}`, { state: lessonNavState() })} />
                      </StructureRow>
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
                countLabel={lessonsLoading ? 'Loading...' : `${lessons.length} lessons`}
                sorting={sorting}
                onToggleSort={lessons.length > 1 ? () => setSorting((current) => !current) : undefined}
                actionLabel="+ Lesson"
                onAction={() => setLessonForm((current) => current || { title: '', isFree: false, saving: false })}
                breadcrumbItems={['Courses', selectedCourse?.courseTitle || 'Selected course', selectedSubject?.topicName || 'Selected subject', selectedTopic?.subtopicName || 'Selected topic']}
              />
              {lessonForm ? (
                <form className={cx(ui.panelCard, 'mb-3 grid gap-3 p-4')} onSubmit={handleLessonCreate}>
                  <label className={ui.formLabel}>
                    New lesson in {selectedTopic?.subtopicName || 'this topic'}
                    <input className={ui.input} autoFocus value={lessonForm.title} maxLength={200} placeholder="Lesson title"
                           onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))} />
                  </label>
                  <label className={ui.checkboxLabel}>
                    <input type="checkbox" checked={lessonForm.isFree}
                           onChange={(event) => setLessonForm((current) => ({ ...current, isFree: event.target.checked }))} />
                    Free lesson (students without a plan can open it)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button className={ui.primaryAction} type="submit" disabled={lessonForm.saving || !lessonForm.title.trim()}>
                      {lessonForm.saving ? 'Creating…' : 'Create and open editor'}
                    </button>
                    <button className={ui.secondaryAction} type="button" onClick={() => setLessonForm(null)} disabled={lessonForm.saving}>Cancel</button>
                  </div>
                </form>
              ) : null}
              {lessonsLoading ? <LoadingGrid /> : null}
              {!lessonsLoading && lessons.length === 0 ? <EmptyFolder>No lessons in this topic.</EmptyFolder> : null}
              {!lessonsLoading && lessons.length > 0 ? (
                <div className={structureUi.rowList}>
                  {lessons.map((lesson, index) => {
                    const title = lesson.title || 'Untitled lesson';
                    return (
                      <StructureRow
                        key={lesson.id}
                        index={index}
                        title={title}
                        meta={[
                          lesson.status === 'active' ? 'Published' : 'Hidden',
                          lesson.isFree ? 'Free' : null,
                          lesson.hasNote ? null : 'Draft (no notes yet)',
                          selectedTopic?.subtopicName || 'Topic',
                        ].filter(Boolean).join(' • ')}
                        status={lesson.status || 'active'}
                        onOpen={() => navigate(`/ai-notes/${lesson.id}`, { state: lessonNavState() })}
                        onEdit={(event) => stopAndRun(event, () => navigate(`/ai-notes/${lesson.id}`, { state: lessonNavState() }))}
                        onDelete={(event) => stopAndRun(event, () => handleLessonDelete(lesson, event))}
                        onMoveUp={sorting && index > 0 ? () => moveLesson(index, -1) : null}
                        onMoveDown={sorting && index < lessons.length - 1 ? () => moveLesson(index, 1) : null}
                        extraAction={(
                          <button
                            className={cx(ui.secondaryButton, 'min-h-8 px-3 text-xs')}
                            type="button"
                            disabled={togglingLessonId === lesson.id}
                            onClick={(event) => stopAndRun(event, () => handleLessonToggle(lesson))}
                            aria-label={`${lesson.status === 'active' ? 'Hide' : 'Publish'} ${title}`}
                            title={lesson.status === 'active' ? 'Hide from students' : 'Show to students'}
                          >
                            {togglingLessonId === lesson.id ? '…' : lesson.status === 'active' ? 'Hide' : 'Publish'}
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
