import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../../shared/api/dashboard.api.js';
import {
  createPlannerTask,
  fetchPlannerSuggestions,
  fetchPlannerTasks,
  updatePlannerTask,
} from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import './StudyPlannerPage.css';

function appRoute(path) {
  return `/app${path.startsWith('/') ? path : `/${path}`}`;
}

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isoFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysUntil(value, todayValue = todayIso()) {
  const dueDate = parseLocalDate(value);
  const startDate = parseLocalDate(todayValue);
  if (!dueDate || !startDate) return null;
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((end - start) / 86400000);
}

function formatDaysLeft(value, todayValue = todayIso()) {
  const days = daysUntil(value, todayValue);
  if (days === null) return 'No due date';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} late`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `${days} days left`;
}

function formatShortDate(value) {
  const date = parseLocalDate(value);
  if (!date) return 'Anytime';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function parsePercent(text, fallback = 32) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)%/);
  return clampPercent(match ? Number(match[1]) : fallback);
}

function timeMinutes(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function routeForAction(actionType) {
  if (actionType === 'quiz' || actionType === 'Q-Bank') return appRoute('/quizzes');
  if (actionType === 'results' || actionType === 'Review') return appRoute('/results');
  return appRoute('/ai-notes');
}

const fallbackPlan = [
  {
    id: 'fallback-lesson',
    type: 'Lesson',
    title: 'Mitral Stenosis',
    reason: 'Start with a short lesson so the topic feels clear before practice.',
    time: '25 min',
    action: 'Start lesson',
    route: appRoute('/ai-notes'),
    ready: 32,
  },
  {
    id: 'fallback-qbank',
    type: 'Q-Bank',
    title: 'Valvular Heart Diseases',
    reason: 'Answer a small set while the lesson is fresh.',
    time: '25 min',
    action: 'Practice',
    route: appRoute('/quizzes'),
    ready: 28,
  },
  {
    id: 'fallback-review',
    type: 'Review',
    title: 'Wrong Answers',
    reason: 'Finish by reviewing missed points.',
    time: '10 min',
    action: 'Review',
    route: appRoute('/results'),
    ready: 24,
  },
];

const fallbackWeakAreas = [
  { label: 'Pathophysiology', value: 18 },
  { label: 'Echocardiography', value: 28 },
  { label: 'Clinical Features', value: 35 },
];

function Icon({ name }) {
  if (name === 'book') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5h8a2 2 0 0 1 2 2v11H6.5A2.5 2.5 0 0 1 4 14V4.5a1 1 0 0 1 1-1Z" /><path d="M7 8h5M7 11h4" /></svg>;
  }
  if (name === 'question') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="13" height="13" rx="3" /><path d="M8 8a2.2 2.2 0 1 1 3.05 2.03c-.5.25-.8.66-.8 1.32" /><path d="M10.25 14h.01" /></svg>;
  }
  if (name === 'review') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 5.5h11M4.5 10h7M4.5 14.5h5" /><path d="M14 11.5l1.6 1.6 2.7-3" /></svg>;
  }
  if (name === 'tools') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h4M12 6h4M8 4v4M4 14h7M15 14h1M12 12v4" /></svg>;
  }
  if (name === 'check') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 3.8 3.8L16 6" /></svg>;
  }
  if (name === 'calendar') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="12" rx="2.5" /><path d="M7 2.8v3.4M13 2.8v3.4M4 8h12" /></svg>;
  }
  if (name === 'plus') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>;
  }
  if (name === 'clock') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5v4l2.7 1.8" /></svg>;
  }
  if (name === 'target') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="2.5" /><path d="M10 1.8v3M10 15.2v3M1.8 10h3M15.2 10h3" /></svg>;
  }
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M3 10h14" /></svg>;
}

function StethoBuddy() {
  return (
    <div className="planner-buddy" aria-hidden="true">
      <svg viewBox="0 0 88 88">
        <path className="planner-buddy__tube" d="M23 17c-11 0-14 8-14 19 0 14 9 24 21 24s21-10 21-24c0-11-3-19-14-19" />
        <path className="planner-buddy__tube" d="M51 39c10 0 18 7 18 17 0 9-6 16-15 16-7 0-13-5-13-12" />
        <circle className="planner-buddy__face" cx="30" cy="38" r="19" />
        <path className="planner-buddy__tube" d="M20 18v-6M40 18v-6" />
        <circle className="planner-buddy__cap" cx="20" cy="12" r="5" />
        <circle className="planner-buddy__cap" cx="40" cy="12" r="5" />
        <circle className="planner-buddy__eye" cx="24" cy="35" r="2.6" />
        <circle className="planner-buddy__eye" cx="36" cy="35" r="2.6" />
        <path className="planner-buddy__smile" d="M25 45c3 4 8 4 11 0" />
        <circle className="planner-buddy__disc" cx="69" cy="53" r="9" />
        <circle className="planner-buddy__disc-inner" cx="69" cy="53" r="4" />
      </svg>
      <span>First step</span>
    </div>
  );
}

function taskIcon(type) {
  if (type === 'Q-Bank') return 'question';
  if (type === 'Review') return 'review';
  return 'book';
}

function actionLabel(type, actionType) {
  if (actionType === 'quiz' || type === 'Q-Bank') return 'Practice';
  if (actionType === 'results' || type === 'Review') return 'Review';
  return 'Start lesson';
}

function typeFromTitle(title, fallback = 'Lesson') {
  const [prefix] = String(title || '').split(':');
  if (/q-bank|quiz|practice/i.test(prefix)) return 'Q-Bank';
  if (/review|wrong|result/i.test(prefix)) return 'Review';
  return fallback;
}

function cleanTitle(title) {
  return String(title || '').replace(/^(Lesson|Q-Bank|Review|Quiz|Practice|Study):\s*/i, '').trim() || 'Study task';
}

function mapDatabaseTask(task, index) {
  const type = typeFromTitle(task.title);
  return {
    id: `task-${task.id}`,
    dbId: task.id,
    type,
    title: cleanTitle(task.title),
    reason: task.description || (task.status === 'done' ? 'Completed from your planner' : 'Saved in your planner'),
    time: type === 'Review' ? '10 min' : '25 min',
    action: actionLabel(type),
    route: routeForAction(type),
    ready: 100 - Math.min(index * 8 + 20, 60),
    dueDate: task.dueDate || '',
    done: task.status === 'done',
  };
}

function mapDashboardPlan(item, index, dashboard) {
  const type = item.actionType === 'quiz' ? 'Q-Bank' : item.actionType === 'results' ? 'Review' : 'Lesson';
  const weakTopic = dashboard?.weakTopics?.[0];
  return {
    id: item.key || `adaptive-${index}`,
    type,
    title: item.title || weakTopic?.topicName || fallbackPlan[index]?.title || 'Study task',
    reason: item.description || 'Based on your latest weak area and quiz history.',
    time: type === 'Review' ? '10 min' : '25 min',
    action: actionLabel(type, item.actionType),
    route: routeForAction(item.actionType),
    ready: clampPercent(weakTopic?.averagePercentage || dashboard?.performanceSnapshot?.readinessScore || fallbackPlan[index]?.ready),
    dueDate: todayIso(),
    done: item.status === 'done',
  };
}

function mapSuggestion(item, index) {
  const isWrongLoop = /wrong|missed|redo/i.test(`${item.title} ${item.description}`);
  const type = isWrongLoop ? 'Review' : 'Q-Bank';
  return {
    id: item.key || `suggestion-${index}`,
    type,
    title: cleanTitle(item.title),
    reason: item.description || 'Suggested from your weak areas.',
    time: type === 'Review' ? '10 min' : '25 min',
    action: actionLabel(type),
    route: routeForAction(type),
    ready: parsePercent(item.description, item.priority === 'high' ? 25 : 40),
    dueDate: todayIso(),
    done: false,
  };
}

function buildWeek(tasks, todayValue) {
  const start = parseLocalDate(todayValue) || new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const iso = isoFromDate(date);
    const dueCount = tasks.filter((task) => task.dueDate === iso).length;
    return {
      key: iso,
      day: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      date: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(date),
      label: index === 0 ? (dueCount ? `${dueCount} due` : 'Today') : dueCount ? `${dueCount} due` : 'Free',
      tone: index === 0 ? 'today' : dueCount ? 'planned' : 'rest',
    };
  });
}

export function StudyPlannerPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [reminderForm, setReminderForm] = useState({
    title: '',
    dueDate: todayIso(),
    note: '',
  });

  async function loadPlanner() {
    setLoading(true);
    const [taskRows, suggestionRows, dashboardData] = await Promise.all([
      fetchPlannerTasks().catch(() => []),
      fetchPlannerSuggestions().catch(() => []),
      fetchStudentDashboard().catch(() => null),
    ]);
    setTasks(Array.isArray(taskRows) ? taskRows : []);
    setSuggestions(Array.isArray(suggestionRows) ? suggestionRows : []);
    setDashboard(dashboardData);
    setLoading(false);
  }

  useEffect(() => {
    loadPlanner().catch(() => setLoading(false));
  }, []);

  const today = todayIso();
  const todaysSavedTasks = useMemo(
    () => tasks.filter((task) => !task.dueDate || task.dueDate <= today).slice(0, 3).map(mapDatabaseTask),
    [tasks, today],
  );
  const adaptiveTasks = useMemo(
    () => (dashboard?.adaptivePlan || []).slice(0, 3).map((item, index) => mapDashboardPlan(item, index, dashboard)),
    [dashboard],
  );
  const suggestedTasks = useMemo(
    () => suggestions.slice(0, 3).map(mapSuggestion),
    [suggestions],
  );

  const prescription = todaysSavedTasks.length
    ? todaysSavedTasks
    : adaptiveTasks.length
      ? adaptiveTasks
      : suggestedTasks.length
        ? suggestedTasks
        : fallbackPlan;

  const planSource = todaysSavedTasks.length
    ? 'Saved reminders'
    : adaptiveTasks.length
      ? 'Based on results'
      : suggestedTasks.length
        ? 'Suggested plan'
        : 'Starter plan';

  const weakAreas = useMemo(() => {
    const dashboardWeakAreas = (dashboard?.weakTopics || []).slice(0, 3).map((topic) => ({
      label: topic.topicName || 'Weak topic',
      value: clampPercent(topic.averagePercentage),
    }));
    if (dashboardWeakAreas.length) return dashboardWeakAreas;
    const suggestionWeakAreas = suggestions.slice(0, 3).map((item) => ({
      label: cleanTitle(item.title).replace(/^Review\s+/i, ''),
      value: parsePercent(item.description, 35),
    }));
    return suggestionWeakAreas.length ? suggestionWeakAreas : fallbackWeakAreas;
  }, [dashboard, suggestions]);

  const activePlannerTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done'),
    [tasks],
  );
  const reminderList = useMemo(
    () => [...activePlannerTasks].sort((a, b) => {
      const aDays = daysUntil(a.dueDate, today);
      const bDays = daysUntil(b.dueDate, today);
      const aOrder = aDays === null ? Number.POSITIVE_INFINITY : aDays;
      const bOrder = bDays === null ? Number.POSITIVE_INFINITY : bDays;
      return aOrder - bOrder || Number(b.id || 0) - Number(a.id || 0);
    }).slice(0, 4),
    [activePlannerTasks, today],
  );
  const weekItems = useMemo(() => buildWeek(activePlannerTasks, today), [activePlannerTasks, today]);

  const readiness = clampPercent(dashboard?.performanceSnapshot?.readinessScore || dashboard?.avgScore || weakAreas[0]?.value || 32);
  const done = tasks.filter((task) => task.status === 'done').length;
  const open = Math.max(tasks.length - done, 0);
  const dueTodayCount = activePlannerTasks.filter((task) => daysUntil(task.dueDate, today) === 0).length;
  const overdueCount = activePlannerTasks.filter((task) => {
    const days = daysUntil(task.dueDate, today);
    return days !== null && days < 0;
  }).length;
  const routeDone = prescription.filter((task) => task.done).length;
  const totalMinutes = prescription.reduce((sum, item) => sum + timeMinutes(item.time), 0);
  const mainTask = prescription[0] || fallbackPlan[0];
  const mainWeakArea = weakAreas[0]?.label || 'your weakest topic';

  async function saveTask(item) {
    await createPlannerTask({
      title: `${item.type}: ${item.title}`,
      description: item.reason,
      dueDate: todayIso(),
    });
  }

  async function startTask(item = mainTask) {
    setSaving(item.id);
    setMessage('');
    try {
      if (!item.dbId) {
        await saveTask(item);
        await loadPlanner();
      }
      navigate(item.route);
    } catch {
      setMessage('Planner save failed, but you can still study now.');
      navigate(item.route);
    } finally {
      setSaving('');
    }
  }

  async function markDone(item) {
    if (!item.dbId || item.done) return;
    setSaving(`done-${item.dbId}`);
    setMessage('');
    try {
      await updatePlannerTask(item.dbId, {
        title: `${item.type}: ${item.title}`,
        description: item.reason,
        dueDate: item.dueDate || todayIso(),
        status: 'done',
      });
      setMessage('Task marked done.');
      await loadPlanner();
    } catch {
      setMessage('Could not mark done. Try again when the API is reachable.');
    } finally {
      setSaving('');
    }
  }

  async function addReminder(event) {
    event.preventDefault();
    const title = cleanTitle(reminderForm.title);
    if (!title) {
      setMessage('Add a topic first.');
      return;
    }

    setSaving('reminder');
    setMessage('');
    try {
      await createPlannerTask({
        title: `Lesson: ${title}`,
        description: reminderForm.note.trim() || 'Study reminder from Planner.',
        dueDate: reminderForm.dueDate || todayIso(),
      });
      setReminderForm({ title: '', dueDate: todayIso(), note: '' });
      setMessage('Reminder added. It will appear on your dashboard.');
      await loadPlanner();
    } catch {
      setMessage('Could not add reminder right now. Try again when the API is reachable.');
    } finally {
      setSaving('');
    }
  }

  async function addCatchUp() {
    setSaving('fix');
    setMessage('');
    try {
      const focus = weakAreas[0]?.label || mainTask.title;
      await createPlannerTask({
        title: `Review: ${focus}`,
        description: 'Catch-up reminder for your weakest current area.',
        dueDate: todayIso(),
      });
      setMessage('Catch-up reminder added.');
      await loadPlanner();
    } catch {
      setMessage('Could not add catch-up right now.');
    } finally {
      setSaving('');
    }
  }

  return (
    <main className="student-route-page dashboard-page study-hub-page study-planner-page">
      <div className="study-hub-shell study-planner-shell">
        <AppHeader title="Planner" subtitle="Today, reminders, and weak spots" />

        <section className="planner-hero-card">
          <div className="planner-hero-copy">
            <span className="planner-eyebrow">{loading ? 'Building plan' : planSource}</span>
            <h1>Start with {mainTask.title}</h1>
            <p>{mainTask.reason || `Focus on ${mainWeakArea} first, then practice and review.`}</p>
            <div className="planner-hero-actions">
              <button className="planner-primary" type="button" onClick={() => startTask(mainTask)} disabled={saving === mainTask.id}>
                {saving === mainTask.id ? 'Opening...' : mainTask.action}
              </button>
              <button className="planner-secondary" type="button" onClick={() => navigate(appRoute('/quizzes'))}>
                Q-Bank
              </button>
            </div>
          </div>

          <div className="planner-hero-side">
            <StethoBuddy />
            <div className="planner-stat-stack" aria-label="Planner summary">
              <div>
                <span>Due today</span>
                <strong>{dueTodayCount}</strong>
              </div>
              <div>
                <span>Open</span>
                <strong>{open}</strong>
              </div>
              <div>
                <span>Ready</span>
                <strong>{readiness}%</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="planner-main-grid">
          <section className="planner-panel planner-today-card">
            <div className="planner-section-title">
              <div>
                <span className="planner-eyebrow">Today's route</span>
                <h2>{prescription.length} clear steps</h2>
              </div>
              <small>{routeDone}/{prescription.length} done · {totalMinutes} min</small>
            </div>

            <div className="planner-simple-list">
              {prescription.map((item, index) => (
                <article className={`planner-simple-task${item.done ? ' is-complete' : ''}`} key={item.id}>
                  <button
                    className="planner-step"
                    type="button"
                    onClick={() => markDone(item)}
                    disabled={!item.dbId || item.done || saving === `done-${item.dbId}`}
                    aria-label={item.done ? `${item.title} completed` : `Mark ${item.title} done`}
                  >
                    {item.done ? <Icon name="check" /> : index + 1}
                  </button>
                  <div className="planner-task-icon"><Icon name={taskIcon(item.type)} /></div>
                  <div className="planner-task-text">
                    <span>{item.type} · {item.time}</span>
                    <h3>{item.title}</h3>
                    <p>{item.reason}</p>
                  </div>
                  <button type="button" onClick={() => startTask(item)} disabled={saving === item.id}>
                    {saving === item.id ? 'Opening' : item.action}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="planner-panel planner-reminder-card">
            <div className="planner-section-title">
              <div>
                <span className="planner-eyebrow">Reminders</span>
                <h2>Add a study plan</h2>
              </div>
              <small>{overdueCount ? `${overdueCount} late` : `${reminderList.length} saved`}</small>
            </div>

            <form className="planner-reminder-form" onSubmit={addReminder}>
              <label>
                <span>Topic</span>
                <input
                  type="text"
                  value={reminderForm.title}
                  onChange={(event) => setReminderForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Cardiology revision"
                />
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="date"
                  value={reminderForm.dueDate}
                  min={today}
                  onChange={(event) => setReminderForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </label>
              <label className="planner-reminder-note">
                <span>Note</span>
                <textarea
                  rows="2"
                  value={reminderForm.note}
                  onChange={(event) => setReminderForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="What should you revise?"
                />
              </label>
              <button type="submit" disabled={saving === 'reminder'}>
                <Icon name="plus" /> {saving === 'reminder' ? 'Adding...' : 'Add reminder'}
              </button>
            </form>

            <div className="planner-reminder-list">
              {reminderList.length ? reminderList.map((task, index) => {
                const mapped = mapDatabaseTask(task, index);
                return (
                  <article className="planner-reminder-item" key={task.id}>
                    <span><Icon name="calendar" /></span>
                    <div>
                      <strong>{cleanTitle(task.title)}</strong>
                      <p>{formatDaysLeft(task.dueDate, today)} · {formatShortDate(task.dueDate)}</p>
                    </div>
                    <button type="button" onClick={() => markDone(mapped)} disabled={saving === `done-${task.id}`}>
                      Done
                    </button>
                  </article>
                );
              }) : (
                <div className="planner-empty-state">
                  <strong>No reminders yet</strong>
                  <p>Add one topic and it will show on the dashboard with days left.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {message ? <p className="planner-message" role="status">{message}</p> : null}

        <div className="planner-bottom-grid">
          <section className="planner-panel planner-focus-card">
            <div className="planner-section-title">
              <div>
                <span className="planner-eyebrow">Study focus</span>
                <h2>Lowest scores</h2>
              </div>
              <small>{dashboard?.totalAttempts || 0} attempts</small>
            </div>
            <div className="planner-weak-simple">
              {weakAreas.map((area) => (
                <div key={area.label}>
                  <p><span>{area.label}</span><strong>{area.value}%</strong></p>
                  <i><b style={{ width: `${area.value}%` }} /></i>
                </div>
              ))}
            </div>
            <p className="planner-plain-note">Focus on {mainWeakArea} today. This updates after more quizzes and reviews.</p>
          </section>

          <section className="planner-panel planner-week-simple" aria-label="This week plan">
            <div className="planner-section-title">
              <div>
                <span className="planner-eyebrow">Next 7 days</span>
                <h2>Reminder map</h2>
              </div>
              <button type="button" onClick={addCatchUp} disabled={saving === 'fix'}>
                <Icon name="tools" /> {saving === 'fix' ? 'Adding...' : 'Add catch-up'}
              </button>
            </div>
            <div className="planner-week-row">
              {weekItems.map((item) => (
                <div className={`planner-week-day is-${item.tone}`} key={item.key}>
                  <span>{item.day}</span>
                  <b>{item.date}</b>
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
