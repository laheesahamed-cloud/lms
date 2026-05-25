import { useEffect, useState } from 'react';
import { fetchAdminQuestionReports, updateQuestionReport } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const reportFilters = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'rejected', label: 'Rejected' },
];

const reportUi = {
  meta: 'mt-2 flex flex-wrap gap-1.5',
  tag: 'rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-medium',
  question: 'rounded-lg border border-line-soft bg-surface-0 px-3.5 py-3 text-[13px] leading-relaxed text-ink-strong dark:border-white/10 dark:bg-white/[0.03]',
  comment: 'rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-ink-medium',
};

export function AdminQuestionReportsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextFilter = filter) {
    setLoading(true);
    setError('');
    try {
      const params = nextFilter === 'all' ? undefined : { status: nextFilter };
      setItems(await fetchAdminQuestionReports(params));
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load question reports'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function changeFilter(nextFilter) {
    setFilter(nextFilter);
    await load(nextFilter);
  }

  async function setStatus(item, status) {
    await updateQuestionReport(item.id, { status });
    await load();
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title="Question Reports" subtitle="Student Reported Questions" />
        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className="flex flex-wrap gap-2 rounded-lg border border-line-soft bg-surface-glass-strong p-2 shadow-xs">
          {reportFilters.map((item) => (
            <button
              className={cx(
                'min-h-10 rounded-md border px-3 text-sm font-bold transition',
                filter === item.key
                  ? 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary'
                  : 'border-line-soft bg-surface-1 text-ink-medium hover:bg-surface-2'
              )}
              key={item.key}
              type="button"
              onClick={() => changeFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={ui.emptyBox}>Loading question reports...</div>
        ) : items.length ? (
          <section className="grid gap-3">
            {items.map((item) => (
              <article className={ui.panelCard} key={item.id}>
                <div className={ui.panelTop}>
                  <div>
                    <h2>Question #{item.questionId}</h2>
                    <p>{item.fullName || item.email || `Student #${item.userId}`}</p>
                    <div className={reportUi.meta}>
                      {item.courseTitle ? <span className={reportUi.tag}>{item.courseTitle}</span> : null}
                      {item.topicName ? <span className={reportUi.tag}>{item.topicName}</span> : null}
                      {item.quizIds ? <span className={reportUi.tag}>Quiz IDs: {item.quizIds}</span> : null}
                      {item.questionType ? <span className={reportUi.tag}>{item.questionType}</span> : null}
                    </div>
                  </div>
                  <span className={statusPill(item.status)}>{item.status}</span>
                </div>

                <div className="grid gap-2">
                  <div className={reportUi.question}>
                    <strong className="mb-1 block text-ink-strong">Question text</strong>
                    {item.questionText || 'Question text unavailable.'}
                  </div>
                  <div className={reportUi.comment}>
                    <strong className="mb-1 block text-ink-strong">{item.reason || 'Student report'}</strong>
                    {item.comment || 'No extra comment provided.'}
                  </div>
                </div>

                <div className={ui.buttonRow}>
                  <button className={ui.primaryAction} type="button" onClick={() => setStatus(item, 'resolved')}>
                    Mark resolved
                  </button>
                  <button className={ui.secondaryAction} type="button" onClick={() => setStatus(item, 'open')}>
                    Reopen
                  </button>
                  <button className={ui.secondaryAction} type="button" onClick={() => setStatus(item, 'rejected')}>
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className={ui.emptyBox}>No question reports in this view.</div>
        )}
      </section>
    </main>
  );
}
