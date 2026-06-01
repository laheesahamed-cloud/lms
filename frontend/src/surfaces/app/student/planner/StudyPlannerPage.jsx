import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../../shared/api/dashboard.api.js';
import {
  createPlannerTask,
  deletePlannerTask,
  fetchPlannerAgenda,
  fetchPlannerSuggestions,
  updatePlannerTask,
} from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import './StudyPlannerPage.css';

const FLASHCARD_REVIEW_STATS_KEY = 'lms.flashcards.reviewStats.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

const VIEW_OPTIONS = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'week', label: 'Week' },
  { key: 'course', label: 'Course' },
  { key: 'completed', label: 'Completed' },
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

function formatDateLabel(value) {
  const date = parseDate(value);
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
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

function normalizeSuggestions(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item, index) => ({
    key: item?.key || `suggestion-${index}`,
    title: String(item?.title || '').trim(),
    description: String(item?.description || '').trim(),
    priority: normalizeTaskPriority(item?.priority),
    dueInDays: Number.isFinite(Number(item?.dueInDays)) ? Number(item.dueInDays) : null,
    task: {
      title: String(item?.task?.title || item?.title || '').trim(),
      description: String(item?.task?.description || item?.description || '').trim(),
      dueDate: item?.task?.dueDate || todayIso(),
      category: normalizeTaskCategory(item?.task?.category || 'review'),
      priority: normalizeTaskPriority(item?.task?.priority || item?.priority),
      estimatedMinutes: Number.isFinite(Number(item?.task?.estimatedMinutes)) ? Number(item.task.estimatedMinutes) : 30,
    },
  })).filter((item) => item.title);
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

function weekSections(items, today) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(parseDate(today));
    date.setDate(date.getDate() + index);
    const iso = todayIsoFromDate(date);
    const dayItems = items.filter((item) => item.status !== 'completed' && item.dueAt === iso);
    return {
      key: iso,
      title: index === 0 ? 'Today' : formatDateLabel(iso),
      hint: dayItems.length ? `${dayItems.length} item${dayItems.length === 1 ? '' : 's'}` : 'No dated items',
      items: dayItems,
    };
  });
}

function todayIsoFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function courseSections(items) {
  const grouped = items.reduce((acc, item) => {
    const key = item.course || 'No course';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, sectionItems]) => ({
      key: title,
      title,
      hint: `${sectionItems.length} planner item${sectionItems.length === 1 ? '' : 's'}`,
      items: sectionItems,
    }));
}

function completedSections(items) {
  const completed = items.filter((item) => item.status === 'completed');
  return completed.length ? [{ key: 'completed', title: 'Completed', hint: 'Finished study work', items: completed }] : [];
}

function buildPlannerInsights(items, today) {
  const activeItems = items.filter((item) => item.status !== 'completed');
  const dueWork = activeItems.filter((item) => ['overdue', 'due_today', 'in_progress'].includes(item.status));
  const weekWork = activeItems.filter((item) => {
    const days = daysFromToday(item.dueAt, today);
    return days !== null && days >= 0 && days <= 7;
  });
  const estimatedToday = dueWork.reduce((sum, item) => sum + itemEstimatedMinutes(item), 0);
  const estimatedWeek = weekWork.reduce((sum, item) => sum + itemEstimatedMinutes(item), 0);
  const highPriority = activeItems.filter((item) => itemPriority(item) === 'high').length;
  const nextDue = [...activeItems]
    .filter((item) => item.dueAt)
    .sort((left, right) => String(left.dueAt).localeCompare(String(right.dueAt)))[0];
  const completed = items.filter((item) => item.status === 'completed').length;

  return {
    active: activeItems.length,
    estimatedToday,
    estimatedWeek,
    highPriority,
    nextDueLabel: nextDue ? `${nextDue.title} · ${formatDue(nextDue.dueAt, nextDue.status)}` : 'No dated work yet',
    completionRate: items.length ? Math.round((completed / items.length) * 100) : 0,
    locked: activeItems.filter((item) => item.locked).length,
  };
}

function PlannerStatusChip({ status }) {
  return (
    <span className={`planner-status-chip is-${status || 'optional'}`}>
      {STATUS_LABELS[status] || 'Optional'}
    </span>
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
            <span style={{ width: `${progress}%` }} />
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

function PlannerSection({ section, onAction, onTaskStatus, onTaskEdit, onTaskDelete, saving, emptyText }) {
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
        )) : (
          <div className="planner-empty-row">{emptyText || 'Nothing here yet.'}</div>
        )}
      </div>
    </section>
  );
}

export function StudyPlannerPage() {
  const navigate = useNavigate();
  const [agenda, setAgenda] = useState(() => normalizeAgenda(null));
  const [dashboard, setDashboard] = useState(null);
  const [flashcardItem, setFlashcardItem] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [view, setView] = useState('agenda');
  const [courseFilter, setCourseFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState(() => emptyTaskForm());

  async function loadPlanner() {
    setLoading(true);
    setMessage('');
    try {
      const [agendaData, dashboardData, suggestionData] = await Promise.all([
        fetchPlannerAgenda(),
        fetchStudentDashboard().catch(() => null),
        fetchPlannerSuggestions().catch(() => []),
      ]);
      setAgenda(normalizeAgenda(agendaData));
      setDashboard(dashboardData);
      setSuggestions(normalizeSuggestions(suggestionData));
      setFlashcardItem(flashcardDueItem());
    } catch {
      setAgenda(normalizeAgenda(null));
      setSuggestions([]);
      setMessage('Planner data could not be loaded right now.');
    } finally {
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
  const filteredItems = useMemo(
    () => filterItems(allItems, { course: courseFilter, type: typeFilter, status: statusFilter, search: searchTerm }),
    [allItems, courseFilter, searchTerm, statusFilter, typeFilter]
  );
  const counts = useMemo(() => sectionCounts(allItems), [allItems]);
  const inProgressCount = counts.in_progress || 0;
  const dueTodayCount = (counts.due_today || 0) + inProgressCount;
  const overdueCount = counts.overdue || 0;
  const completedCount = counts.completed || 0;
  const upcomingCount = (counts.upcoming || 0) + (counts.optional || 0) + (counts.locked || 0);
  const personalTasks = allItems.filter((item) => item.source === 'planner_task');
  const plannerInsights = useMemo(() => buildPlannerInsights(allItems, today), [allItems, today]);
  const visibleSuggestions = useMemo(() => {
    const existingTitles = new Set(personalTasks.map((item) => item.title.trim().toLowerCase()));
    return suggestions.filter((item) => !existingTitles.has(item.task.title.trim().toLowerCase()));
  }, [personalTasks, suggestions]);

  const sections = useMemo(() => {
    if (view === 'week') return weekSections(filteredItems, today);
    if (view === 'course') return courseSections(filteredItems);
    if (view === 'completed') return completedSections(filteredItems);
    return agendaSections(filteredItems, today);
  }, [filteredItems, today, view]);

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
    setMessage('Editing task details.');
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm());
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

  async function addSuggestionTask(suggestion) {
    const payload = suggestion.task || {};
    if (!payload.title) return;
    setSaving(`suggestion:${suggestion.key}`);
    setMessage('');
    try {
      await createPlannerTask(payload);
      setMessage('Suggested task added to your planner.');
      await loadPlanner();
    } catch {
      setMessage('Could not add that suggestion right now.');
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
      setTaskForm(emptyTaskForm());
      await loadPlanner();
    } catch {
      setMessage(editingTaskId ? 'Could not update the task right now.' : 'Could not add the task right now.');
    } finally {
      setSaving('');
    }
  }

  return (
    <main className="student-route-page dashboard-page study-hub-page study-planner-page">
      <div className="study-hub-shell study-planner-shell">
        <AppHeader title="Planner" subtitle="Agenda, course timeline, and personal tasks" />

        <section className="planner-summary-strip" aria-label="Planner summary">
          <article>
            <span>Today</span>
            <strong>{loading ? '...' : dueTodayCount}</strong>
          </article>
          <article>
            <span>Overdue</span>
            <strong>{loading ? '...' : overdueCount}</strong>
          </article>
          <article>
            <span>In progress</span>
            <strong>{loading ? '...' : inProgressCount}</strong>
          </article>
          <article>
            <span>Upcoming</span>
            <strong>{loading ? '...' : upcomingCount}</strong>
          </article>
          <article>
            <span>Study load</span>
            <strong>{loading ? '...' : (formatMinutes(plannerInsights.estimatedToday) || '0')}</strong>
          </article>
          <article>
            <span>Completed</span>
            <strong>{loading ? '...' : completedCount}</strong>
          </article>
        </section>

        <div className="planner-control-bar">
          <div className="planner-tabs" role="tablist" aria-label="Planner views">
            {VIEW_OPTIONS.map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={view === option.key}
                className={view === option.key ? 'is-active' : ''}
                key={option.key}
                onClick={() => setView(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="planner-search">
            <span>Search planner</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tasks, lessons, topics"
            />
          </label>
        </div>

        <div className="planner-filter-grid">
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
              Clear filters
            </button>
          ) : null}
        </div>

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
              />
            )) : (
              <section className="planner-list-section">
                <div className="planner-empty-row">
                  No real planner items match this view yet.
                </div>
              </section>
            )}
          </div>

          <aside className="planner-side-column" aria-label="Planner details">
            <section className="planner-side-panel">
              <div className="planner-side-heading">
                <h2>Today's focus</h2>
                <span>{dashboard?.quizDayStreak ? `${dashboard.quizDayStreak} day streak` : 'Dashboard'}</span>
              </div>
              <div className="planner-focus-box">
                <strong>{dashboard?.focusTopic || 'No focus topic yet'}</strong>
                <p>{dashboard?.focusCourse || 'Complete lessons or quizzes to build planner signals.'}</p>
              </div>
              <div className="planner-goal-list">
                {(dashboard?.dailyGoals || []).map((goal) => (
                  <div className={goal.completed ? 'is-done' : ''} key={goal.key || goal.title}>
                    <span>{goal.completed ? 'Done' : 'Open'}</span>
                    <p>{goal.title}</p>
                    <small>{goal.progressText}</small>
                  </div>
                ))}
                {dashboard?.dailyGoals?.length ? null : (
                  <div>
                    <span>Open</span>
                    <p>Start a quiz or lesson to generate daily goals.</p>
                    <small>No dashboard goal yet</small>
                  </div>
                )}
              </div>
            </section>

            <section className="planner-side-panel">
              <div className="planner-side-heading">
                <h2>Study load</h2>
                <span>{plannerInsights.completionRate}% done</span>
              </div>
              <div className="planner-insight-grid">
                <div>
                  <span>Today</span>
                  <strong>{formatMinutes(plannerInsights.estimatedToday) || '0 min'}</strong>
                </div>
                <div>
                  <span>This week</span>
                  <strong>{formatMinutes(plannerInsights.estimatedWeek) || '0 min'}</strong>
                </div>
                <div>
                  <span>High priority</span>
                  <strong>{plannerInsights.highPriority}</strong>
                </div>
                <div>
                  <span>Locked</span>
                  <strong>{plannerInsights.locked}</strong>
                </div>
              </div>
              <div className="planner-focus-box">
                <strong>Next dated item</strong>
                <p>{plannerInsights.nextDueLabel}</p>
              </div>
            </section>

            <section className="planner-side-panel">
              <div className="planner-side-heading">
                <h2>Smart suggestions</h2>
                <span>{visibleSuggestions.length} ready</span>
              </div>
              <div className="planner-suggestion-list">
                {visibleSuggestions.length ? visibleSuggestions.map((suggestion) => (
                  <div key={suggestion.key}>
                    <span className={`planner-priority-pill is-${suggestion.priority}`}>{titleCase(suggestion.priority)}</span>
                    <strong>{suggestion.title}</strong>
                    <p>{suggestion.description}</p>
                    <small>{suggestion.dueInDays === 0 ? 'Suggested for today' : suggestion.dueInDays ? `Suggested in ${suggestion.dueInDays} day${suggestion.dueInDays === 1 ? '' : 's'}` : 'Suggested task'}</small>
                    <button
                      type="button"
                      className="planner-action is-secondary"
                      onClick={() => addSuggestionTask(suggestion)}
                      disabled={saving === `suggestion:${suggestion.key}`}
                    >
                      {saving === `suggestion:${suggestion.key}` ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                )) : (
                  <div className="planner-empty-row">No new suggestions right now.</div>
                )}
              </div>
            </section>

            <section className="planner-side-panel">
              <div className="planner-side-heading">
                <h2>{editingTaskId ? 'Edit task' : 'Personal tasks'}</h2>
                <span>{personalTasks.filter((item) => item.status !== 'completed').length} open</span>
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
                  {editingTaskId ? (
                    <button type="button" className="is-secondary" onClick={cancelEditTask}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
