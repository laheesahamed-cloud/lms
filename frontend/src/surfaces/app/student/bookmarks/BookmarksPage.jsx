import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudyBookmarks, toggleStudyBookmark } from '../../../../shared/api/studyBookmarks.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

function BookmarkIcon({ filled }) {
  return filled
    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5h8a1 1 0 0 1 1 1v9.5l-5-3-5 3V2.5a1 1 0 0 1 1-1z"/></svg>
    : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5h8a1 1 0 0 1 1 1v9.5l-5-3-5 3V2.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>;
}
function NoteIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1.5" width="9" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M4.5 5h4M4.5 7h4M4.5 9h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M11 3.5h1.5A1 1 0 0 1 13.5 4.5v9a1 1 0 0 1-1 1H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>; }
function QuizIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M5.5 7a2.5 2.5 0 1 1 3.5 2.3c-.4.2-.75.6-.75 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="12" r=".8" fill="currentColor"/></svg>; }
function PlayIcon()  { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2l7 4-7 4V2z" fill="currentColor"/></svg>; }
function ReadIcon()  { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4.5 1.75h3M4 3v6.25m4-6.25v6.25M3 3l.4 6.2A1 1 0 0 0 4.4 10h3.2a1 1 0 0 0 1-.8L9 3" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

const TYPE_FILTERS = [
  { key: 'all',  label: 'All' },
  { key: 'quiz', label: 'Quizzes' },
  { key: 'note', label: 'Lessons' },
];

export function BookmarksPage() {
  const navigate  = useNavigate();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    fetchStudyBookmarks()
      .then(setItems)
      .catch(e => setError(getErrorMessage(e, 'Unable to load bookmarks')))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(e, item) {
    e.stopPropagation();
    try {
      await toggleStudyBookmark({ itemType: item.itemType, itemId: item.itemId });
      setItems(prev => prev.filter(b => !(b.itemType === item.itemType && b.itemId === item.itemId)));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove bookmark'));
    }
  }

  const quizCount = items.filter(i => i.itemType === 'quiz').length;
  const noteCount = items.filter(i => i.itemType === 'note' || i.itemType === 'ai_note').length;

  const visible = items.filter(item => {
    if (filter === 'quiz') return item.itemType === 'quiz';
    if (filter === 'note') return item.itemType === 'note' || item.itemType === 'ai_note';
    return true;
  });
  const activeCount = visible.length;

  function openItem(item) {
    if (item.itemType === 'quiz') navigate(`/quizzes/${item.itemId}?mode=practice`);
    else navigate(`/ai-notes/${item.itemId}`);
  }

  return (
    <main className={ui.studentScreenShell}>
      <section className={ui.studentManagementLayout}>
        <AppHeader title="Saved Items" subtitle="Saved Queue" />

        {error && <div className={ui.feedbackError}>{error}</div>}

        <StudentPageHero
          title="Saved Items"
          subtitle="Saved Queue"
          tone="violet"
          metrics={[
            { label: 'Total Saved', value: items.length },
            { label: 'Practice', value: quizCount },
            { label: 'Lessons', value: noteCount },
            { label: 'Showing', value: activeCount },
          ]}
        />

        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3 max-[780px]:grid-cols-2" aria-label="Bookmark summary">
          <div className="rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs">
            <span className="block text-2xl font-extrabold text-ink-strong">{items.length}</span>
            <small className="mt-0.5 block text-[11px] text-ink-muted">Total saved</small>
          </div>
          <div className="rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs">
            <span className="block text-2xl font-extrabold text-ink-strong">{quizCount}</span>
            <small className="mt-0.5 block text-[11px] text-ink-muted">Quizzes</small>
          </div>
          <div className="rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs">
            <span className="block text-2xl font-extrabold text-ink-strong">{noteCount}</span>
            <small className="mt-0.5 block text-[11px] text-ink-muted">Lessons</small>
          </div>
          <div className="rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs">
            <span className="block text-2xl font-extrabold text-ink-strong">{activeCount}</span>
            <small className="mt-0.5 block text-[11px] text-ink-muted">Showing now</small>
          </div>
        </div>

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
                {f.key === 'quiz' ? quizCount : f.key === 'note' ? noteCount : items.length}
              </small>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[520px]:gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className={cx(ui.shimmer, 'min-h-[104px] rounded-lg border border-line-soft bg-surface-1')} />)}
          </div>
        ) : visible.length === 0 ? (
          <div className={cx(ui.emptyBox, 'grid justify-items-center gap-3')}>
            <div className="grid size-16 place-items-center rounded-2xl bg-brand-primary-light text-brand-primary">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M14 6h24a3 3 0 0 1 3 3v34l-15-9-15 9V9a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" opacity="0.3"/>
              <path d="M20 20h12M20 26h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            <h3 className="m-0 text-xl font-extrabold text-ink-strong">{items.length === 0 ? 'Your queue is ready when you are' : 'Nothing in this view'}</h3>
            <p className="m-0 max-w-[340px] text-sm leading-relaxed text-ink-soft">{items.length === 0
              ? 'Nothing saved yet. Hit "Save" on any quiz or lesson to build your revision queue.'
              : 'No items match this filter.'
            }</p>
            <button className={ui.primaryAction} type="button" onClick={() => navigate('/quizzes')}>
              Browse quizzes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 max-[520px]:gap-3">
            {visible.map(item => {
              const isQuiz = item.itemType === 'quiz';
              return (
                <article
                  key={`${item.itemType}-${item.itemId}`}
                  className="group relative flex min-h-[104px] cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-line-medium hover:shadow-md"
                  onClick={() => openItem(item)}
                >
                  <div className={cx('grid size-11 shrink-0 place-items-center rounded-md border', isQuiz ? 'border-violet-500/20 bg-violet-500/10 text-violet-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600')}>{isQuiz ? <QuizIcon/> : <NoteIcon/>}</div>
                  <div className="min-w-0 flex-1">
                    <div className={cx('mb-1 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]', isQuiz ? 'bg-violet-500/10 text-violet-600' : 'bg-emerald-500/10 text-emerald-600')}>{isQuiz ? 'Practice quiz' : 'Lesson'}</div>
                    <div className="truncate text-[13.5px] font-semibold text-ink-strong">{item.title || `${isQuiz ? 'Quiz' : 'Lesson'} #${item.itemId}`}</div>
                    {(item.courseTitle || item.topicName) && (
                      <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                        {[item.courseTitle, item.topicName].filter(Boolean).join(' › ')}
                      </div>
                    )}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-brand-primary/5 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                  <div className="relative z-[1] flex shrink-0 gap-1.5">
                    <button className={ui.iconButton}
                      type="button"
                     
                      onClick={() => openItem(item)}
                      title={isQuiz ? 'Practice' : 'Read'}
                      aria-label={isQuiz ? 'Open saved quiz' : 'Open saved lesson'}
                    >
                      {isQuiz ? <PlayIcon/> : <ReadIcon/>}
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
