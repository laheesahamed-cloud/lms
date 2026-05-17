import { useEffect, useState } from 'react';
import { answerLessonDoubt, fetchAdminDoubts } from '../../../../shared/api/workspace.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const doubtUi = {
  thread: 'grid gap-2',
  bubble: 'rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft dark:border-white/10 dark:bg-white/[0.03]',
  meta: 'mt-2 flex flex-wrap gap-1.5',
  tag: 'rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-medium',
};

export function AdminDoubtsPage() {
  const [items, setItems] = useState([]);
  const [replyById, setReplyById] = useState({});
  const [faqById, setFaqById] = useState({});
  async function load() { setItems(await fetchAdminDoubts()); }
  useEffect(() => { load().catch(() => {}); }, []);
  return <main className={ui.screenShell}><section className={ui.managementLayout}>
    <AppHeader title="Lesson Doubts" subtitle="Answer student questions from lessons and revision work." />
    <section className="grid gap-3">{items.length ? items.map((item) => <article className={ui.panelCard} key={item.id}><div className={ui.panelTop}><div><h2>{item.subject}</h2><p>{item.fullName} · {item.email}</p><div className={doubtUi.meta}>{item.lessonTitle ? <span className={doubtUi.tag}>Lesson: {item.lessonTitle}</span> : null}{item.questionId ? <span className={doubtUi.tag}>Question #{item.questionId}</span> : null}<span className={doubtUi.tag}>{item.contextType}</span>{item.convertedToFaq ? <span className={doubtUi.tag}>FAQ</span> : null}</div></div><span className={statusPill(item.status)}>{item.status}</span></div><div className={doubtUi.thread}><div className={doubtUi.bubble}><strong className="block text-ink-strong">Student</strong>{item.message}{item.questionText ? <span className="mt-2 block text-xs text-ink-muted">{item.questionText}</span> : null}</div>{item.reply ? <div className={cx(doubtUi.bubble, 'border-brand-success/20 bg-brand-success/10')}><strong className="block text-ink-strong">Admin reply</strong>{item.reply}</div> : null}</div><textarea className={ui.textarea} value={replyById[item.id] || ''} onChange={(e) => setReplyById((r) => ({ ...r, [item.id]: e.target.value }))} placeholder="Reply to student" /><textarea className={ui.textarea} value={faqById[item.id] || ''} onChange={(e) => setFaqById((r) => ({ ...r, [item.id]: e.target.value }))} placeholder="Optional FAQ answer for repeated doubts" /><div className={ui.buttonRow}><button className={ui.primaryAction} onClick={async () => { await answerLessonDoubt(item.id, { reply: replyById[item.id] || item.reply || '', status: 'answered' }); await load(); }}>Answer</button><button className={ui.secondaryAction} onClick={async () => { await answerLessonDoubt(item.id, { reply: replyById[item.id] || item.reply || '', faqAnswer: faqById[item.id] || replyById[item.id] || item.reply || '', convertedToFaq: true, status: 'answered' }); await load(); }}>Save FAQ</button><button className={ui.secondaryAction} onClick={async () => { await answerLessonDoubt(item.id, { reply: item.reply || '', status: 'closed' }); await load(); }}>Close</button></div></article>) : <div className={ui.emptyBox}>No doubts yet.</div>}</section>
  </section></main>;
}
