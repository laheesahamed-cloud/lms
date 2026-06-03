import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudyBookmarks, readStudyBookmarksCache, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';

function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4.5 1.75h3M4 3v6.25m4-6.25v6.25M3 3l.4 6.2A1 1 0 0 0 4.4 10h3.2a1 1 0 0 0 1-.8L9 3" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

const TYPE_FILTERS = [
  { key: 'all',  label: 'All' },
  { key: 'quiz', label: 'Quizzes' },
  { key: 'exam', label: 'Exams' },
  { key: 'question', label: 'Questions' },
  { key: 'note', label: 'Notes' },
];

function isExamBookmark(item) {
  return item.itemType === 'quiz' && (item.examModeOnly === true || Number(item.examModeOnly) === 1);
}

function getItemMeta(item) {
  const isExam = isExamBookmark(item);
  const isQuiz = item.itemType === 'quiz' && !isExam;
  const isQuestion = item.itemType === 'question';
  const label = isQuestion ? 'Question' : isExam ? 'Exam' : isQuiz ? 'Quiz' : 'Note';
  const action = isQuestion ? 'Open' : isExam ? 'Start exam' : isQuiz ? 'Practice' : 'Open';
  const fallbackTitle = `${label} #${item.itemId}`;

  return { isExam, isQuiz, isQuestion, label, action, title: item.title || fallbackTitle };
}

function getContextLine(item, title) {
  const titleKey = String(title || '').trim().toLowerCase();
  const seen = new Set();
  return [item.courseTitle, item.topicName]
    .map((part) => String(part || '').trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!key || key === titleKey || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' / ');
}

function formatSavedDate(value) {
  if (!value) return 'Bookmarked';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bookmarked';
  return `Bookmarked ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)}`;
}

export function BookmarksPage() {
  const navigate  = useNavigate();
  const [items,   setItems]   = useState(() => readStudyBookmarksCache() || []);
  const [loading, setLoading] = useState(() => readStudyBookmarksCache() === undefined);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    let cancelled = false;
    fetchStudyBookmarks()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e, 'Unable to load bookmarks')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(e, item) {
    e.stopPropagation();
    if (!window.confirm('Remove this saved item from bookmarks?')) return;
    try {
      await toggleStudyBookmark({ itemType: item.itemType, itemId: item.itemId });
      setItems(prev => prev.filter(b => !(b.itemType === item.itemType && b.itemId === item.itemId)));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove bookmark'));
    }
  }

  const quizCount = items.filter(i => i.itemType === 'quiz' && !isExamBookmark(i)).length;
  const examCount = items.filter(isExamBookmark).length;
  const questionCount = items.filter(i => i.itemType === 'question').length;
  const noteCount = items.filter(i => i.itemType === 'note' || i.itemType === 'ai_note').length;

  const visible = items.filter(item => {
    if (filter === 'quiz') return item.itemType === 'quiz' && !isExamBookmark(item);
    if (filter === 'exam') return isExamBookmark(item);
    if (filter === 'question') return item.itemType === 'question';
    if (filter === 'note') return item.itemType === 'note' || item.itemType === 'ai_note';
    return true;
  });

  function openItem(item) {
    if (item.itemType === 'quiz') navigate(`/quizzes/${item.itemId}?mode=${isExamBookmark(item) ? 'exam' : 'practice'}`);
    else if (item.itemType === 'question') navigate(item.quizId ? `/quizzes/${item.quizId}?mode=practice&questionId=${item.itemId}` : '/quizzes');
    else navigate(`/ai-notes/${item.itemId}`);
  }

  return (
    <main className="dashboard-page study-hub-page student-bookmarks-page">
      <section className="study-hub-shell">
        <AppHeader title="Saved" subtitle="Bookmarks" />

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

        <StudentPageHero
          title="Saved items"
          subtitle="Your bookmarked notes, questions, quizzes, and exams in one clean place."
          metrics={[
            { label: 'Bookmarked', value: items.length },
            { label: 'Quizzes', value: quizCount },
            { label: 'Exams', value: examCount },
            { label: 'Questions', value: questionCount },
            { label: 'Notes', value: noteCount },
          ]}
        />

        <div className="flex flex-wrap gap-2 rounded-lg border border-line-soft bg-surface-glass-strong p-2 shadow-xs">
          {TYPE_FILTERS.map(f => (
            <button className={cx(
                'min-h-10 rounded-md border px-3 text-sm font-bold shadow-none transition',
                filter === f.key
                  ? 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary'
                  : 'border-line-soft bg-surface-1 text-ink-medium hover:bg-surface-2'
              )}
              key={f.key}
              type="button"
             
              onClick={() => setFilter(f.key)}
            >
              <span>{f.label}</span>
              <small className={cx('ml-2 rounded-full px-2 py-0.5 text-[11px]', filter === f.key ? 'bg-white/60 text-brand-primary dark:bg-white/10 dark:text-sky-100' : 'bg-brand-primary-light text-brand-primary')}>
                {f.key === 'quiz' ? quizCount : f.key === 'exam' ? examCount : f.key === 'question' ? questionCount : f.key === 'note' ? noteCount : items.length}
              </small>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-2.5">
            {[1,2,3,4,5,6].map(i => <div key={i} className={cx(ui.shimmer, 'min-h-[86px] rounded-lg border border-line-soft bg-surface-1')} />)}
          </div>
        ) : visible.length === 0 ? (
          <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3')}>
            <div className="grid size-16 place-items-center rounded-2xl bg-brand-primary-light text-brand-primary">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M14 6h24a3 3 0 0 1 3 3v34l-15-9-15 9V9a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" opacity="0.3"/>
              <path d="M20 20h12M20 26h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            <h3 className="m-0 text-xl font-extrabold text-ink-strong">{items.length === 0 ? 'Your saved shelf is ready when you are' : 'Nothing saved in this view'}</h3>
            <p className="m-0 max-w-[340px] text-sm leading-relaxed text-ink-soft">{items.length === 0
              ? 'Bookmark a note, question, or quiz when you want to review it again later. It will appear here neatly for your next study pass.'
              : 'Try another filter to see the rest of your bookmarked revision items.'
            }</p>
            <button className={ui.primaryAction} type="button" onClick={() => navigate('/quizzes')}>
              Browse quizzes
            </button>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {visible.map(item => {
              const meta = getItemMeta(item);
              const contextLine = getContextLine(item, meta.title);
              const savedDate = formatSavedDate(item.createdAt);
              return (
                <article
                  key={`${item.itemType}-${item.itemId}`}
                  className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line-soft bg-surface-1 px-4 py-3 shadow-xs transition-[background,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:border-line-medium hover:bg-surface-2/60 hover:shadow-sm max-[640px]:grid-cols-1 max-[640px]:items-start max-[640px]:gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-2">
                      <span className={cx(
                        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em]',
                        meta.isQuiz || meta.isQuestion
                          ? 'border-violet-500/18 bg-violet-500/8 text-violet-600 dark:text-violet-200'
                          : 'border-emerald-500/18 bg-emerald-500/8 text-emerald-600 dark:text-emerald-200'
                      )}>{meta.label}</span>
                      <span className="text-[11.5px] font-semibold text-ink-muted">{savedDate}</span>
                    </div>
                    <h3 className="m-0 overflow-hidden text-[14.5px] font-extrabold leading-snug text-ink-strong [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                      {meta.title}
                    </h3>
                    {contextLine ? (
                      <p className="m-0 mt-1 truncate text-[12px] font-medium text-ink-muted">{contextLine}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 max-[640px]:w-full max-[640px]:justify-between">
                    <button
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-brand-primary/22 bg-[var(--color-primary-light)] px-3 text-[12.5px] font-extrabold text-brand-primary shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/35 hover:bg-brand-primary/12 active:scale-[0.98]"
                      type="button"
                      onClick={() => openItem(item)}
                      aria-label={`${meta.action} saved ${meta.label.toLowerCase()}`}
                    >
                      {meta.action}
                    </button>
                    <button className={ui.dangerIconButton}
                      type="button"
                      onClick={e => handleRemove(e, item)}
                      title="Remove bookmark"
                      aria-label="Remove saved item"
                    >
                      <TrashIcon/>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
