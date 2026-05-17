import { useEffect, useState } from 'react';
import { createPlannerTask, deletePlannerTask, fetchPlannerSuggestions, fetchPlannerTasks, updatePlannerTask } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

export function StudyPlannerPage() {
  const [tasks, setTasks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm] = useState({ title: '', dueDate: '', description: '' });
  async function load() {
    const [taskRows, suggestionRows] = await Promise.all([
      fetchPlannerTasks(),
      fetchPlannerSuggestions().catch(() => []),
    ]);
    setTasks(taskRows);
    setSuggestions(suggestionRows);
  }
  useEffect(() => { load().catch(() => {}); }, []);
  async function save(event) { event.preventDefault(); await createPlannerTask(form); setForm({ title: '', dueDate: '', description: '' }); await load(); }
  async function addSuggestion(suggestion) {
    const due = new Date();
    due.setDate(due.getDate() + Number(suggestion.dueInDays || 0));
    await createPlannerTask({
      title: suggestion.title,
      description: suggestion.description,
      dueDate: due.toISOString().slice(0, 10),
    });
    await load();
  }
  return <main className={ui.screenShell}><section className={ui.managementLayout}>
    <AppHeader title="Study Planner" subtitle="Turn exam prep into small daily tasks." />
    <StudentPageHero
      title="Study Planner"
      subtitle="Turn exam prep into small daily tasks with adaptive suggestions from your progress."
      tone="amber"
      metrics={[
        { label: 'Tasks', value: tasks.length },
        { label: 'Done', value: tasks.filter((task) => task.status === 'done').length },
        { label: 'Suggestions', value: suggestions.length },
      ]}
    />
    <section className={ui.panelCard}><form className={ui.stackForm} onSubmit={save}><div className={ui.formGrid}><label className={ui.formLabel}>Task<input className={ui.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label><label className={ui.formLabel}>Due date<input type="date" className={ui.input} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></label></div><label className={ui.formLabel}>Notes<textarea className={ui.textarea} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label><button className={ui.primaryAction}>Add task</button></form></section>
    <section className={ui.panelCard}>
      <div className={ui.panelTop}><div><h2>Adaptive Suggestions</h2><p>Generated from weak topics, wrong-answer patterns, and current momentum.</p></div></div>
      <div className="grid gap-2">
        {suggestions.length ? suggestions.map((suggestion) => <div className={ui.alert} key={suggestion.key}><strong>{suggestion.title}</strong><br />{suggestion.description}<div className={ui.buttonRow}><span className={ui.tablePill}>{suggestion.priority}</span><button className={ui.secondaryAction} onClick={() => addSuggestion(suggestion)}>Add task</button></div></div>) : <div className={ui.emptyBox}>Complete a quiz to unlock adaptive suggestions.</div>}
      </div>
    </section>
    <section className="grid gap-3">{tasks.length ? tasks.map((task) => <article key={task.id} className={cx(ui.panelCard, task.status === 'done' && 'opacity-70')}><div className={ui.panelTop}><div><h2>{task.title}</h2><p>{task.description || 'No notes'} {task.dueDate ? `· Due ${task.dueDate}` : ''}</p></div><span className={ui.tablePill}>{task.status}</span></div><div className={ui.buttonRow}><button className={ui.secondaryAction} onClick={async () => { await updatePlannerTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }); await load(); }}>{task.status === 'done' ? 'Reopen' : 'Mark done'}</button><button className={ui.dangerAction} onClick={async () => { await deletePlannerTask(task.id); await load(); }}>Delete</button></div></article>) : <div className={ui.emptyBox}>No study tasks yet.</div>}</section>
  </section></main>;
}
