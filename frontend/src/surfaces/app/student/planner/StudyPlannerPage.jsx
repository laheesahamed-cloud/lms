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

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function parsePercent(text, fallback = 32) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)%/);
  return clampPercent(match ? Number(match[1]) : fallback);
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
    reason: 'Weak in Pathophysiology',
    time: '25 min',
    action: 'Start',
    route: appRoute('/ai-notes'),
    ready: 32,
  },
  {
    id: 'fallback-qbank',
    type: 'Q-Bank',
    title: 'Valvular Heart Diseases',
    reason: '15 focused questions',
    time: '25 min',
    action: 'Practice',
    route: appRoute('/quizzes'),
    ready: 28,
  },
  {
    id: 'fallback-review',
    type: 'Review',
    title: 'Wrong Answers',
    reason: '12 due today',
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

const week = [
  { day: 'Mon', label: 'Done', tone: 'done' },
  { day: 'Tue', label: 'Today', tone: 'today' },
  { day: 'Wed', label: '1h 10m', tone: 'planned' },
  { day: 'Thu', label: '1h 30m', tone: 'planned' },
  { day: 'Fri', label: '1h 15m', tone: 'planned' },
  { day: 'Sat', label: '2h', tone: 'planned' },
  { day: 'Sun', label: 'Rest', tone: 'rest' },
];

function Icon({ name }) {
  if (name === 'menu') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h13" /></svg>;
  }
  if (name === 'search') {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13.2 13.2 3.3 3.3" /></svg>;
  }
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
      <span>Do this first</span>
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
  return 'Start';
}

function typeFromTitle(title, fallback = 'Lesson') {
  const [prefix] = String(title || '').split(':');
  if (/q-bank|quiz|practice/i.test(prefix)) return 'Q-Bank';
  if (/review|wrong|result/i.test(prefix)) return 'Review';
  return fallback;
}

function cleanTitle(title) {
  return String(title || '').replace(/^(Lesson|Q-Bank|Review|Quiz|Practice):\s*/i, '').trim() || 'Study task';
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
    reason: item.description || 'Generated from your current performance.',
    time: type === 'Review' ? '10 min' : '25 min',
    action: actionLabel(type, item.actionType),
    route: routeForAction(item.actionType),
    ready: clampPercent(weakTopic?.averagePercentage || dashboard?.performanceSnapshot?.readinessScore || fallbackPlan[index]?.ready),
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
    done: false,
  };
}

export function StudyPlannerPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');

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

  const readiness = clampPercent(dashboard?.performanceSnapshot?.readinessScore || dashboard?.avgScore || weakAreas[0]?.value || 32);
  const target = Math.max(75, readiness);
  const done = tasks.filter((task) => task.status === 'done').length;
  const open = Math.max(tasks.length - done, 0);
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
        dueDate: todayIso(),
        status: 'done',
      });
      setMessage('Nice. Task marked done.');
      await loadPlanner();
    } catch {
      setMessage('Could not mark done. Try again when the API is reachable.');
    } finally {
      setSaving('');
    }
  }

  async function fixPlan() {
    setSaving('fix');
    setMessage('');
    try {
      const focus = weakAreas[0]?.label || mainTask.title;
      await createPlannerTask({
        title: `Review: ${focus}`,
        description: 'Catch-up block generated from your weakest current area.',
        dueDate: todayIso(),
      });
      setMessage('Plan fixed. One catch-up block added.');
      await loadPlanner();
    } catch {
      setMessage('Plan repair is ready when the API responds.');
    } finally {
      setSaving('');
    }
  }

  function openSearch() {
    window.dispatchEvent(new CustomEvent('lms:open-search'));
  }

  function toggleSidebar() {
    window.dispatchEvent(new CustomEvent('lms:toggle-sidebar'));
  }

  return (
    <main className="study-planner-page student-route-page">
      <div className="study-planner-shell">
        <AppHeader title="Study Planner" subtitle="What should I study today?" />

        <section className="planner-top-card">
          <div className="planner-actions">
            <button type="button" onClick={toggleSidebar} aria-label="Open menu"><Icon name="menu" /></button>
            <button type="button" onClick={openSearch} aria-label="Search"><Icon name="search" /></button>
          </div>

          <div className="planner-top-copy">
            <span>{loading ? 'Checking your plan' : 'Today study answer'}</span>
            <h1>Study {mainTask.title} first.</h1>
            <p>Because your weakest area is {mainWeakArea}. This comes from your planner, quiz results, and weak-topic map.</p>
          </div>

          <StethoBuddy />

          <button className="planner-primary" type="button" onClick={() => startTask(mainTask)} disabled={saving === mainTask.id}>
            {saving === mainTask.id ? 'Opening...' : mainTask.action}
          </button>
        </section>

        <section className="planner-goal-simple">
          <div>
            <span>{dashboard?.performanceSnapshot?.readinessLabel || 'Exam readiness'}</span>
            <strong>{readiness}% ready</strong>
          </div>
          <div className="planner-goal-bar" aria-label={`Readiness progress from ${readiness} percent to target ${target} percent`}>
            <i style={{ width: `${readiness}%` }} />
            <b style={{ left: `${target}%` }} />
          </div>
          <div className="planner-goal-labels">
            <span>Now {readiness}%</span>
            <span>Target {target}%</span>
          </div>
        </section>

        <section className="planner-today-card">
          <div className="planner-section-title">
            <div>
              <span>Today Prescription</span>
              <h2>{prescription.length} steps from your data</h2>
            </div>
            <small>{open} open · {done} done</small>
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
                  <span>{item.type} · {item.time} · {item.ready}% ready</span>
                  <h3>{item.title}</h3>
                  <p>{item.reason}</p>
                </div>
                <button type="button" onClick={() => startTask(item)} disabled={saving === item.id}>
                  {saving === item.id ? 'Opening' : item.action}
                </button>
              </article>
            ))}
          </div>
          {message ? <p className="planner-message" role="status">{message}</p> : null}
        </section>

        <section className="planner-focus-card">
          <div className="planner-section-title">
            <div>
              <span>Why this plan?</span>
              <h2>Your weak spots</h2>
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
          <p className="planner-plain-note">Focus on {mainWeakArea} today. The app will update this after more quizzes and reviews.</p>
        </section>

        <section className="planner-week-simple" aria-label="This week plan">
          <div className="planner-section-title">
            <div>
              <span>This week</span>
              <h2>Simple weekly view</h2>
            </div>
            <button type="button" onClick={fixPlan} disabled={saving === 'fix'}>
              <Icon name="tools" /> {saving === 'fix' ? 'Fixing...' : 'Fix My Plan'}
            </button>
          </div>
          <div className="planner-week-row">
            {week.map((item) => (
              <div className={`planner-week-day is-${item.tone}`} key={item.day}>
                <span>{item.day}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
