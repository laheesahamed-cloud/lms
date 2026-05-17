import { useEffect, useState } from 'react';
import { createQuestionReviewItem, fetchQuestionReviewItems, updateQuestionReviewItem } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const reviewUi = {
  card: cx(ui.panelCard, 'animate-fadePop'),
  metaGrid: 'grid gap-2 min-[760px]:grid-cols-[1fr_auto]',
  tagRow: 'mt-3 flex flex-wrap gap-1.5',
  tag: 'rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-medium',
  flag: 'rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300',
  score: 'min-w-[92px] rounded-lg border border-line-soft bg-surface-0 px-3 py-2 text-right dark:border-white/10 dark:bg-white/[0.03]',
};

export function QuestionReviewPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', questionId: '', source: 'manual', notes: '' });
  async function load() { setItems(await fetchQuestionReviewItems()); }
  useEffect(() => { load().catch(() => {}); }, []);
  async function save(event) { event.preventDefault(); await createQuestionReviewItem({ ...form, questionId: form.questionId || null }); setForm({ title: '', questionId: '', source: 'manual', notes: '' }); await load(); }
  return <main className={ui.screenShell}><section className={ui.managementLayout}>
    <AppHeader title="Question Review" subtitle="Queue imported, AI-generated, reported, or manual questions before they become trusted material." />
    <section className={ui.panelCard}><form className={ui.stackForm} onSubmit={save}><div className={ui.formGrid}><label className={ui.formLabel}>Title<input className={ui.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label><label className={ui.formLabel}>Question ID<input className={ui.input} value={form.questionId} onChange={(e) => setForm((f) => ({ ...f, questionId: e.target.value.replace(/\D/g, '') }))} /></label><label className={ui.formLabel}>Source<select className={ui.input} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}><option value="manual">Manual</option><option value="ai">AI</option><option value="import">Import</option><option value="report">Report</option></select></label></div><label className={ui.formLabel}>Notes<textarea className={ui.textarea} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></label><button className={ui.primaryAction}>Add to review</button></form></section>
    <section className="grid gap-3">{items.length ? items.map((item) => <article className={reviewUi.card} key={item.id}>
      <div className={ui.panelTop}>
        <div>
          <h2>{item.title}</h2>
          <p>{item.questionText || item.notes || 'No linked question text.'}</p>
        </div>
        <span className={statusPill(item.status)}>{item.status}</span>
      </div>
      <div className={reviewUi.metaGrid}>
        <div>
          <p className={ui.panelText}>Source: {item.source}{item.questionId ? ` · Question #${item.questionId}` : ''}{item.duplicateCount > 1 ? ` · ${item.duplicateCount} duplicates` : ''}</p>
          <div className={reviewUi.tagRow}>
            {(item.reviewTags || []).map((tag) => <span className={reviewUi.tag} key={tag}>{tag}</span>)}
            {(item.qualityFlags || []).map((flag) => <span className={reviewUi.flag} key={flag}>{flag}</span>)}
            {(!item.reviewTags?.length && !item.qualityFlags?.length) ? <span className={reviewUi.tag}>No quality flags</span> : null}
          </div>
        </div>
        <div className={reviewUi.score}>
          <span className={ui.eyebrow}>Explanation</span>
          <strong className="block text-xl text-ink-strong">{item.explanationScore ?? 0}</strong>
        </div>
      </div>
      <div className={ui.buttonRow}>{['reviewing','approved','rejected'].map((next) => <button key={next} className={ui.secondaryAction} onClick={async () => { await updateQuestionReviewItem(item.id, { status: next }); await load(); }}>{next}</button>)}</div>
    </article>) : <div className={ui.emptyBox}>No review items yet.</div>}</section>
  </section></main>;
}
