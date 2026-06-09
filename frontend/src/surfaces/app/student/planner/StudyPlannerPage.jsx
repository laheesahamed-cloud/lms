import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createPlannerTask,
  deletePlannerTask,
  fetchPlannerAgenda,
  fetchPlannerTasks,
  readPlannerAgendaCache,
  updatePlannerTask,
} from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudyReminderSettingsCard } from './StudyReminderSettingsCard.jsx';
import './StudyPlannerPage.css';

const FLASHCARD_REVIEW_STATS_KEY = 'lms.flashcards.reviewStats.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

const VIEW_OPTIONS = [
  { key: 'open', label: 'Open' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'done', label: 'Done' },
];

const STATUS_LABELS = {
  due_today: 'Due today',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  completed: 'Completed',
  locked: 'Locked',
  optional: 'Optional',
};

const TYPE_LABELS = {
  task: 'Task',
  lesson: 'Lesson',
  quiz: 'Quiz',
  exam: 'Exam',
  review: 'Review',
  flashcards: 'Flashcards',
};

const TASK_CATEGORIES = [
  { value: 'general', label: 'General task' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'quiz', label: 'Quiz practice' },
  { value: 'exam', label: 'Exam block' },
  { value: 'review', label: 'Review' },
  { value: 'flashcards', label: 'Flashcards' },
];

const TASK_PRIORITIES = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
];

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'task', label: 'Tasks' },
  { value: 'lesson', label: 'Lessons' },
  { value: 'quiz', label: 'Quizzes' },
  { value: 'exam', label: 'Exams' },
  { value: 'review', label: 'Reviews' },
  { value: 'flashcards', label: 'Flashcards' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_today', label: 'Due today' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'optional', label: 'Optional' },
  { value: 'completed', label: 'Completed' },
  { value: 'locked', label: 'Locked' },
];

function appRoute(path) {
  if (!path) return '/app/planner';
  if (path.startsWith('/app/')) return path;
  return `/app${path.startsWith('/') ? path : `/${path}`}`;
}

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyTaskForm() {
  return {
    title: '',
    dueDate: todayIso(),
    description: '',
    category: 'general',
    priority: 'medium',
    estimatedMinutes: '30',
  };
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const dateText = text.slice(0, 10);
  const [year, month, day] = dateText.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function daysFromToday(value, todayValue = todayIso()) {
  const date = parseDate(value);
  const today = parseDate(todayValue);
  if (!date || !today) return null;
  return Math.round((date - today) / DAY_MS);
}

function formatDue(value, status) {
  const days = daysFromToday(value);
  if (status === 'in_progress') return 'Continue today';
  if (status === 'locked') return 'Access locked';
  if (status === 'completed') return 'Completed';
  if (days === null) return 'No due date';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(value));
}

function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeTaskCategory(value) {
  const text = String(value || '').trim().toLowerCase();
  return TASK_CATEGORIES.some((item) => item.value === text) ? text : 'general';
}

function normalizeTaskPriority(value) {
  const text = String(value || '').trim().toLowerCase();
  return TASK_PRIORITIES.some((item) => item.value === text) ? text : 'medium';
}

function normalizeAgenda(data) {
  return {
    generatedAt: data?.generatedAt || '',
    items: Array.isArray(data?.items) ? data.items : [],
    filters: {
      courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
      subjects: Array.isArray(data?.filters?.subjects) ? data.filters.subjects : [],
      topics: Array.isArray(data?.filters?.topics) ? data.filters.topics : [],
      lessons: Array.isArray(data?.filters?.lessons) ? data.filters.lessons : [],
    },
    summary: data?.summary || { today: 0, overdue: 0, upcoming: 0, completed: 0, total: 0 },
  };
}

function normalizePlannerTaskRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function plannerStatusForTask(task, todayValue = todayIso()) {
  const rawStatus = String(task?.status || '').trim().toLowerCase();
  if (rawStatus === 'done' || rawStatus === 'completed') return 'completed';
  if (rawStatus === 'in_progress') return 'in_progress';
  const dueAt = task?.dueDate || task?.dueAt || task?.due_date || task?.due_at || '';
  const days = daysFromToday(dueAt, todayValue);
  if (days === null) return 'optional';
  if (days < 0) return 'overdue';
  if (days === 0) return 'due_today';
  return 'upcoming';
}

function plannerTaskPriorityScore(status, priority) {
  const statusPriority = status === 'overdue'
    ? 100
    : status === 'due_today'
      ? 88
      : status === 'upcoming'
        ? 48
        : status === 'completed'
          ? 4
          : 28;
  const taskPriorityBoost = priority === 'high' ? 14 : priority === 'medium' ? 6 : 0;
  return status === 'completed' ? statusPriority : statusPriority + taskPriorityBoost;
}

function plannerTaskToAgendaItem(task, todayValue = todayIso()) {
  const sourceId = Number(task?.id || task?.sourceId || task?.source_id || 0);
  const title = String(task?.title || '').trim();
  if (!sourceId || !title) return null;
  const category = normalizeTaskCategory(task?.category);
  const priority = normalizeTaskPriority(task?.priority);
  const status = plannerStatusForTask(task, todayValue);
  const dueAt = task?.dueDate || task?.dueAt || task?.due_date || task?.due_at || '';
  const done = status === 'completed';
  return {
    id: `task-${sourceId}`,
    source: 'planner_task',
    sourceId,
    type: category === 'general' ? 'task' : category,
    title,
    course: '',
    subject: '',
    topic: '',
    lesson: '',
    status,
    dueAt,
    completedAt: done ? task?.updatedAt || task?.updated_at || task?.completedAt || task?.completed_at || task?.createdAt || task?.created_at || null : null,
    progress: done ? 100 : 0,
    actionUrl: '/planner',
    actionLabel: done ? 'View task' : 'Mark complete',
    locked: false,
    accessMessage: '',
    priority: plannerTaskPriorityScore(status, priority),
    meta: {
      description: String(task?.description || ''),
      category,
      priority,
      estimatedMinutes: Number.isFinite(Number(task?.estimatedMinutes ?? task?.estimated_minutes))
        ? Number(task?.estimatedMinutes ?? task?.estimated_minutes)
        : null,
      createdAt: task?.createdAt || task?.created_at || null,
      updatedAt: task?.updatedAt || task?.updated_at || null,
    },
  };
}

function mergeAgendaWithPlannerTasks(agenda, taskData, todayValue = todayIso()) {
  const normalizedAgenda = normalizeAgenda(agenda);
  const existingTaskIds = new Set(
    normalizedAgenda.items
      .filter((item) => item?.source === 'planner_task' && item?.sourceId)
      .map((item) => Number(item.sourceId))
  );
  const fallbackTaskItems = normalizePlannerTaskRows(taskData)
    .map((task) => plannerTaskToAgendaItem(task, todayValue))
    .filter(Boolean)
    .filter((item) => !existingTaskIds.has(Number(item.sourceId)));

  if (!fallbackTaskItems.length) return normalizedAgenda;
  return {
    ...normalizedAgenda,
    items: [...normalizedAgenda.items, ...fallbackTaskItems],
  };
}

function readFlashcardReviewStats() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FLASHCARD_REVIEW_STATS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function flashcardDueItem() {
  const rows = Object.values(readFlashcardReviewStats());
  if (!rows.length) return null;
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const counts = rows.reduce((acc, row) => {
    const dueAt = row?.dueAt ? Date.parse(row.dueAt) : 0;
    const learning = row?.state === 'learning' || row?.state === 'relearning' || Number(row?.learning || 0) > 0;
    if (Number.isFinite(dueAt) && dueAt > 0 && dueAt < todayStart.getTime()) acc.overdue += 1;
    else if (Number.isFinite(dueAt) && dueAt > 0 && dueAt <= now) acc.due += 1;
    if (learning && Number.isFinite(dueAt) && dueAt > 0 && dueAt <= now) acc.learning += 1;
    return acc;
  }, { due: 0, overdue: 0, learning: 0 });
  const totalDue = counts.due + counts.overdue + counts.learning;
  if (totalDue <= 0) return null;
  return {
    id: 'flashcards-due-local',
    source: 'flashcards_local',
    sourceId: null,
    type: 'flashcards',
    title: `${totalDue} flashcard${totalDue === 1 ? '' : 's'} ready`,
    course: '',
    subject: '',
    topic: '',
    lesson: '',
    status: counts.overdue > 0 ? 'overdue' : 'due_today',
    dueAt: todayIso(),
    completedAt: null,
    progress: null,
    actionUrl: '/flashcards?mode=due',
    actionLabel: 'Review flashcards',
    locked: false,
    accessMessage: '',
    priority: counts.overdue > 0 ? 98 : 86,
    meta: counts,
  };
}

function itemContext(item) {
  return [item.course, item.subject, item.topic, item.lesson]
    .map((part) => String(part || '').trim())
    .filter((part, index, all) => part && all.indexOf(part) === index && part !== item.title)
    .join(' / ');
}

function itemDescription(item) {
  return String(item?.meta?.description || item?.description || '').trim();
}

function itemEstimatedMinutes(item) {
  const value = Number(item?.meta?.estimatedMinutes);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function itemPriority(item) {
  return normalizeTaskPriority(item?.meta?.priority);
}

function taskFormFromItem(item) {
  return {
    title: item?.title || '',
    dueDate: item?.dueAt || todayIso(),
    description: itemDescription(item),
    category: normalizeTaskCategory(item?.meta?.category),
    priority: itemPriority(item),
    estimatedMinutes: itemEstimatedMinutes(item) ? String(itemEstimatedMinutes(item)) : '',
  };
}

function taskPayloadFromForm(form) {
  const rawMinutes = String(form.estimatedMinutes || '').trim();
  const estimatedMinutes = rawMinutes ? Number(rawMinutes) : null;
  return {
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    dueDate: form.dueDate || null,
    category: normalizeTaskCategory(form.category),
    priority: normalizeTaskPriority(form.priority),
    estimatedMinutes: Number.isFinite(estimatedMinutes) && estimatedMinutes >= 0 ? estimatedMinutes : null,
  };
}

function progressValue(item) {
  const value = Number(item.progress);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sectionCounts(items) {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

function filterItems(items, filters) {
  const query = String(filters.search || '').trim().toLowerCase();
  return items.filter((item) => {
    if (filters.course && item.course !== filters.course) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (!query) return true;
    return [
      item.title,
      item.course,
      item.subject,
      item.topic,
      item.lesson,
      itemDescription(item),
      item.accessMessage,
      item.meta?.questionType,
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });
}

function agendaSections(items, today) {
  const active = items.filter((item) => item.status !== 'completed');
  const overdue = active.filter((item) => item.status === 'overdue');
  const todayItems = active.filter((item) => item.status === 'due_today' || item.status === 'in_progress');
  const upcomingItems = active.filter((item) => !overdue.includes(item) && !todayItems.includes(item));
  const grouped = {
    tomorrow: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
  };

  for (const item of upcomingItems) {
    const days = daysFromToday(item.dueAt, today);
    if (days === 1) grouped.tomorrow.push(item);
    else if (days !== null && days >= 2 && days <= 7) grouped.thisWeek.push(item);
    else if (days !== null && days >= 8 && days <= 14) grouped.nextWeek.push(item);
    else grouped.later.push(item);
  }

  return [
    { key: 'overdue', title: 'Overdue', hint: 'Missed or late study work', items: overdue },
    { key: 'today', title: 'Today', hint: 'What should be handled now', items: todayItems },
    { key: 'tomorrow', title: 'Tomorrow', hint: 'Next day work', items: grouped.tomorrow },
    { key: 'this-week', title: 'This week', hint: 'Due in the next seven days', items: grouped.thisWeek },
    { key: 'next-week', title: 'Next week', hint: 'Coming soon', items: grouped.nextWeek },
    { key: 'later', title: 'Later', hint: 'Available without a strict due date', items: grouped.later },
  ].filter((section) => section.items.length);
}

function PlannerStatusChip({ status }) {
  return (
    <span className={`planner-status-chip is-${status || 'optional'}`}>
      {STATUS_LABELS[status] || 'Optional'}
    </span>
  );
}

function PlannerSegmentedControl({ currentView, onChange }) {
  return (
    <div className="planner-native-segment" role="tablist" aria-label="Planner views">
      {VIEW_OPTIONS.map((option) => (
        <button
          type="button"
          role="tab"
          aria-selected={currentView === option.key}
          className={currentView === option.key ? 'is-active' : ''}
          key={option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PlannerSummaryCard({ label, value, tone }) {
  return (
    <article className={`planner-native-stat is-${tone}`}>
      <span className={`planner-stat-icon is-${tone}`} aria-hidden="true" />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function PlannerEmptyState({ icon = 'calendar-add', title, message }) {
  return (
    <div className="planner-native-empty">
      <span className={`planner-empty-icon is-${icon}`} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function PlannerRow({ item, onAction, onTaskStatus, onTaskEdit, onTaskDelete, saving }) {
  const context = itemContext(item);
  const progress = progressValue(item);
  const description = itemDescription(item);
  const minutes = formatMinutes(itemEstimatedMinutes(item));
  const priority = itemPriority(item);
  const category = normalizeTaskCategory(item.meta?.category);
  const isPersonalTask = item.source === 'planner_task' && item.sourceId;
  const disabled = saving === item.id || item.locked;
  const savingStatus = saving === `${item.id}:status`;
  const savingDelete = saving === `${item.id}:delete`;
  const metaText = item.type === 'review' && item.meta?.missCount
    ? `${item.meta.missCount} missed signal${Number(item.meta.missCount) === 1 ? '' : 's'}`
    : item.type === 'quiz' && item.meta?.totalQuestions
      ? `${item.meta.totalQuestions} questions`
      : item.type === 'exam' && item.meta?.timeLimit
        ? `${item.meta.timeLimit} min`
        : '';
  const detailChips = [
    minutes,
    isPersonalTask ? `${titleCase(priority)} priority` : '',
    isPersonalTask && category !== 'general' ? titleCase(category) : '',
  ].filter(Boolean);

  return (
    <article className={`planner-row is-${item.status || 'optional'}`}>
      <div className="planner-row__chip">
        <PlannerStatusChip status={item.status} />
      </div>
      <div className="planner-row__body">
        <div className="planner-row__title-line">
          <span>{TYPE_LABELS[item.type] || 'Task'}</span>
          <h3>{item.title}</h3>
        </div>
        {context ? <p>{context}</p> : null}
        {description ? <p className="planner-row__description">{description}</p> : null}
        <div className="planner-row__meta">
          <span>{formatDue(item.dueAt, item.status)}</span>
          {item.completedAt ? <span>Finished {formatShortDate(item.completedAt)}</span> : null}
          {metaText ? <span>{metaText}</span> : null}
          {detailChips.map((label) => <span key={label}>{label}</span>)}
          {item.accessMessage ? <span>{item.accessMessage}</span> : null}
        </div>
        {progress !== null ? (
          <div className="planner-progress" role="progressbar" aria-label={`${progress}% progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: '100%', transform: `scaleX(${progress / 100})`, transformOrigin: 'left center' }} />
          </div>
        ) : null}
      </div>
      <div className="planner-row__actions">
        {isPersonalTask ? (
          <>
            <button
              type="button"
              className={item.status === 'completed' ? 'planner-action is-secondary' : 'planner-action'}
              onClick={() => onTaskStatus(item, item.status === 'completed' ? 'todo' : 'done')}
              disabled={disabled || savingStatus}
            >
              {savingStatus ? 'Saving...' : item.status === 'completed' ? 'Reopen' : 'Done'}
            </button>
            <button type="button" className="planner-action is-secondary" onClick={() => onTaskEdit(item)} disabled={disabled}>
              Edit
            </button>
            <button type="button" className="planner-action is-danger" onClick={() => onTaskDelete(item)} disabled={disabled || savingDelete}>
              {savingDelete ? 'Deleting...' : 'Delete'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={item.status === 'completed' ? 'planner-action is-secondary' : 'planner-action'}
            onClick={() => onAction(item)}
            disabled={disabled}
          >
            {saving === item.id ? 'Working...' : item.actionLabel || 'Open'}
          </button>
        )}
      </div>
    </article>
  );
}

function PlannerSection({ section, onAction, onTaskStatus, onTaskEdit, onTaskDelete, saving, emptyText, emptyState }) {
  return (
    <section className="planner-list-section" aria-labelledby={`planner-section-${section.key}`}>
      <div className="planner-section-heading">
        <div>
          <h2 id={`planner-section-${section.key}`}>{section.title}</h2>
          <p>{section.hint}</p>
        </div>
        <span>{section.items.length}</span>
      </div>
      <div className="planner-row-list">
        {section.items.length ? section.items.map((item) => (
          <PlannerRow
            item={item}
            key={item.id}
            onAction={onAction}
            onTaskStatus={onTaskStatus}
            onTaskEdit={onTaskEdit}
            onTaskDelete={onTaskDelete}
            saving={saving}
          />
        )) : emptyState || (
          <div className="planner-empty-row">{emptyText || 'Nothing here yet.'}</div>
        )}
      </div>
    </section>
  );
}

export function StudyPlannerPage() {
  const navigate = useNavigate();
  const taskComposerRef = useRef(null);
  const [agenda, setAgenda] = useState(() => normalizeAgenda(readPlannerAgendaCache()));
  const [flashcardItem, setFlashcardItem] = useState(null);
  const [view, setView] = useState('open');
  const [courseFilter, setCourseFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(() => readPlannerAgendaCache() === undefined);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskForm, setTaskForm] = useState(() => emptyTaskForm());

  async function loadPlanner() {
    setLoading(readPlannerAgendaCache() === undefined);
    setMessage('');
    try {
      const [agendaData, taskData] = await Promise.all([
        fetchPlannerAgenda(),
        fetchPlannerTasks().catch(() => []),
      ]);
      setAgenda(mergeAgendaWithPlannerTasks(agendaData, taskData));
      setLoading(false);
      setFlashcardItem(flashcardDueItem());
    } catch {
      setAgenda(normalizeAgenda(null));
      setMessage('Planner data could not be loaded right now.');
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlanner();
  }, []);

  const today = todayIso();
  const allItems = useMemo(() => {
    const merged = flashcardItem ? [flashcardItem, ...agenda.items] : agenda.items;
    return [...merged].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  }, [agenda.items, flashcardItem]);
  const counts = useMemo(() => sectionCounts(allItems), [allItems]);
  const inProgressCount = counts.in_progress || 0;
  const dueTodayCount = (counts.due_today || 0) + inProgressCount;
  const overdueCount = counts.overdue || 0;
  const completedCount = counts.completed || 0;
  const personalTasks = allItems.filter((item) => item.source === 'planner_task');
  const openPersonalTasks = personalTasks.filter((item) => item.status !== 'completed');
  const completedPersonalTasks = personalTasks.filter((item) => item.status === 'completed');
  const agendaItems = allItems.filter((item) => item.source !== 'planner_task');
  const summaryCards = [
    { key: 'open', label: 'Open', value: loading ? '...' : openPersonalTasks.length, tone: 'open' },
    { key: 'due', label: 'Due Today', value: loading ? '...' : dueTodayCount, tone: 'due' },
    { key: 'overdue', label: 'Overdue', value: loading ? '...' : overdueCount, tone: 'overdue' },
    { key: 'done', label: 'Done', value: loading ? '...' : completedCount, tone: 'done' },
  ];

  const sections = useMemo(() => {
    if (view === 'open') {
      return [{ key: 'open', title: 'Open Tasks', hint: '', items: openPersonalTasks }];
    }
    if (view === 'done') {
      return [{ key: 'done', title: 'Completed', hint: '', items: completedPersonalTasks }];
    }
    return agendaSections(filterItems(agendaItems, {
      course: courseFilter,
      type: typeFilter,
      status: statusFilter,
      search: searchTerm,
    }), today);
  }, [agendaItems, completedPersonalTasks, courseFilter, openPersonalTasks, searchTerm, statusFilter, today, typeFilter, view]);

  async function handleAction(item) {
    if (item.locked) return;
    setSaving(item.id);
    setMessage('');
    try {
      navigate(appRoute(item.actionUrl || '/planner'));
    } catch {
      setMessage('Action failed. Try again when the API is reachable.');
    } finally {
      setSaving('');
    }
  }

  function revealTaskComposer() {
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm());
    setShowTaskComposer(true);
    setMessage('');
  }

  async function setPersonalTaskStatus(item, status) {
    if (!item.sourceId) return;
    setSaving(`${item.id}:status`);
    setMessage('');
    try {
      await updatePlannerTask(item.sourceId, { status });
      setMessage(status === 'done' ? 'Task marked complete.' : 'Task reopened.');
      await loadPlanner();
    } catch {
      setMessage('Could not update the task right now.');
    } finally {
      setSaving('');
    }
  }

  function startEditTask(item) {
    setEditingTaskId(item.sourceId);
    setTaskForm(taskFormFromItem(item));
    setShowTaskComposer(true);
    setMessage('Editing task details.');
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm());
    setShowTaskComposer(false);
    setMessage('');
  }

  async function removePersonalTask(item) {
    if (!item.sourceId) return;
    if (!window.confirm(`Delete "${item.title || 'this task'}" from your study planner?`)) return;
    setSaving(`${item.id}:delete`);
    setMessage('');
    try {
      await deletePlannerTask(item.sourceId);
      if (editingTaskId === item.sourceId) {
        cancelEditTask();
      }
      setMessage('Task deleted.');
      await loadPlanner();
    } catch {
      setMessage('Could not delete the task right now.');
    } finally {
      setSaving('');
    }
  }

  async function addPersonalTask(event) {
    event.preventDefault();
    const payload = taskPayloadFromForm(taskForm);
    if (!payload.title) {
      setMessage('Add a task title first.');
      return;
    }
    setSaving('task-form');
    setMessage('');
    try {
      if (editingTaskId) {
        await updatePlannerTask(editingTaskId, payload);
        setMessage('Task updated.');
      } else {
        await createPlannerTask(payload);
        setMessage('Task added to your planner.');
      }
      setEditingTaskId(null);
      setShowTaskComposer(false);
      setTaskForm(emptyTaskForm());
      await loadPlanner();
    } catch {
      setMessage(editingTaskId ? 'Could not update the task right now.' : 'Could not add the task right now.');
    } finally {
      setSaving('');
    }
  }

  return (
    <main className="dashboard-page study-hub-page study-planner-page planner-native-page">
      <div className="study-hub-shell study-planner-shell">
        <AppHeader title="Planner" subtitle="Study schedule" />

        <section className="planner-native-topbar" aria-label="Planner controls">
          <button
            type="button"
            className="planner-native-round-button is-add"
            aria-label="Add task"
            onClick={revealTaskComposer}
          >
            <span className="planner-native-plus" aria-hidden="true" />
          </button>
        </section>

        <section className="planner-summary-strip" aria-label="Planner summary">
          {summaryCards.map((card) => (
            <PlannerSummaryCard key={card.key} label={card.label} value={card.value} tone={card.tone} />
          ))}
        </section>

        <PlannerSegmentedControl currentView={view} onChange={setView} />

        <StudyReminderSettingsCard />

        {view === 'agenda' ? (
          <section className="planner-agenda-tools" aria-label="Agenda filters">
            <label className="planner-search">
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tasks, lessons, topics"
              />
            </label>
            <label className="planner-course-filter">
              <span>Course</span>
              <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                <option value="">All courses</option>
                {agenda.filters.courses.map((course) => (
                  <option value={course} key={course}>{course}</option>
                ))}
              </select>
            </label>
            <label className="planner-course-filter">
              <span>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value || 'all-types'}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="planner-course-filter">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value || 'all-statuses'}>{option.label}</option>
                ))}
              </select>
            </label>
            {(courseFilter || typeFilter || statusFilter || searchTerm) ? (
              <button
                type="button"
                className="planner-action is-secondary"
                onClick={() => {
                  setCourseFilter('');
                  setTypeFilter('');
                  setStatusFilter('');
                  setSearchTerm('');
                }}
              >
                Clear
              </button>
            ) : null}
          </section>
        ) : null}

        {message ? <p className="planner-message" role="status">{message}</p> : null}

        <div className="planner-layout-grid">
          <div className="planner-agenda-column">
            {loading ? (
              <section className="planner-list-section">
                <div className="planner-section-heading">
                  <div>
                    <h2>Loading planner</h2>
                    <p>Getting your study agenda</p>
                  </div>
                </div>
                <div className="planner-skeleton-list" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </section>
            ) : sections.length ? sections.map((section) => (
              <PlannerSection
                section={section}
                key={section.key}
                onAction={handleAction}
                onTaskStatus={setPersonalTaskStatus}
                onTaskEdit={startEditTask}
                onTaskDelete={removePersonalTask}
                saving={saving}
                emptyState={
                  section.key === 'open' ? (
                    <PlannerEmptyState
                      title="No open personal tasks"
                      message="Add a study task when you want a reminder outside the generated agenda."
                    />
                  ) : section.key === 'done' ? (
                    <PlannerEmptyState
                      icon="check"
                      title="No completed tasks yet"
                      message="Finished personal tasks will collect here."
                    />
                  ) : null
                }
              />
            )) : (
              <section className="planner-list-section">
                <PlannerEmptyState
                  icon="calendar"
                  title="No agenda yet"
                  message="Your generated study agenda appears after lessons, quizzes, or planner tasks create study signals."
                />
              </section>
            )}

          </div>
        </div>

        {(showTaskComposer || editingTaskId) ? (
          <div className="planner-task-modal-backdrop" role="presentation" onMouseDown={cancelEditTask}>
            <section
              className="planner-task-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="planner-task-modal-title"
              ref={taskComposerRef}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="planner-side-heading planner-task-modal-heading">
                <h2 id="planner-task-modal-title">{editingTaskId ? 'Edit task' : 'Personal tasks'}</h2>
                <button type="button" className="planner-modal-close" onClick={cancelEditTask}>
                  Close
                </button>
              </div>
              <form className="planner-task-form" onSubmit={addPersonalTask}>
                <label>
                  <span>Task</span>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Add a study task"
                  />
                </label>
                <div className="planner-task-form__grid">
                  <label>
                    <span>Due date</span>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Minutes</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={taskForm.estimatedMinutes}
                      onChange={(event) => setTaskForm((current) => ({ ...current, estimatedMinutes: event.target.value }))}
                      placeholder="30"
                    />
                  </label>
                </div>
                <div className="planner-task-form__grid">
                  <label>
                    <span>Category</span>
                    <select
                      value={taskForm.category}
                      onChange={(event) => setTaskForm((current) => ({ ...current, category: event.target.value }))}
                    >
                      {TASK_CATEGORIES.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={taskForm.priority}
                      onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}
                    >
                      {TASK_PRIORITIES.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Note</span>
                  <textarea
                    rows="2"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <div className="planner-task-form__actions">
                  <button type="submit" disabled={saving === 'task-form'}>
                    {saving === 'task-form' ? (editingTaskId ? 'Saving...' : 'Adding...') : editingTaskId ? 'Save changes' : 'Add task'}
                  </button>
                  <button type="button" className="is-secondary" onClick={cancelEditTask}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
