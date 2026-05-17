import { useEffect, useState } from 'react';
import { createLessonDoubt, fetchStudentDoubts } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const doubtUi = {
  meta: 'mt-2 flex flex-wrap gap-1.5',
  tag: 'rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-medium',
  bubble: 'rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft dark:border-white/10 dark:bg-white/[0.03]',
};

export function StudentDoubtsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ subject: '', message: '', lessonId: '', questionId: '' });
  async function load() { setItems(await fetchStudentDoubts()); }
  useEffect(() => { load().catch(() => {}); }, []);
  async function save(event) { event.preventDefault(); await createLessonDoubt({ ...form, lessonId: form.lessonId || null, questionId: form.questionId || null }); setForm({ subject: '', message: '', lessonId: '', questionId: '' }); await load(); }
  return <main className={ui.screenShell}><section className={ui.managementLayout}>
    <AppHeader title="Doubt Box" subtitle="Send lesson or revision questions to the admin team." />
    <StudentPageHero
      title="Doubt Box"
      subtitle="Send lesson or revision questions to the admin team and keep every reply in one place."
      tone="teal"
      metrics={[
        { label: 'Questions', value: items.length },
        { label: 'Open', value: items.filter((item) => item.status !== 'resolved' && item.status !== 'closed').length },
        { label: 'Answered', value: items.filter((item) => item.reply).length },
      ]}
    />
    <section className={ui.panelCard}><form className={ui.stackForm} onSubmit={save}><div className={ui.formGrid}><label className={ui.formLabel}>Subject<input className={ui.input} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></label><label className={ui.formLabel}>Lesson ID<input className={ui.input} value={form.lessonId} onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value.replace(/\D/g, '') }))} /></label><label className={ui.formLabel}>Question ID<input className={ui.input} value={form.questionId} onChange={(e) => setForm((f) => ({ ...f, questionId: e.target.value.replace(/\D/g, '') }))} /></label></div><label className={ui.formLabel}>Question<textarea className={ui.textarea} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></label><button className={ui.primaryAction}>Ask question</button></form></section>
    <section className="grid gap-3">{items.length ? items.map((item) => <article className={ui.panelCard} key={item.id}><div className={ui.panelTop}><div><h2>{item.subject}</h2><div className={doubtUi.meta}>{item.lessonTitle ? <span className={doubtUi.tag}>Lesson: {item.lessonTitle}</span> : null}{item.questionId ? <span className={doubtUi.tag}>Question #{item.questionId}</span> : null}<span className={doubtUi.tag}>{item.contextType}</span></div></div><span className={statusPill(item.status)}>{item.status}</span></div><div className={doubtUi.bubble}><strong className="block text-ink-strong">You asked</strong>{item.message}</div>{item.reply ? <div className={cx(doubtUi.bubble, 'mt-2 border-brand-success/20 bg-brand-success/10')}><strong className="block text-ink-strong">Admin reply</strong>{item.reply}</div> : null}</article>) : <div className={ui.emptyBox}>No questions yet.</div>}</section>
  </section></main>;
}
