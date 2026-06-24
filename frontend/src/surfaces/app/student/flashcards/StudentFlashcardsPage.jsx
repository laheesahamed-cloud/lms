import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEdgeSwipeBack } from '../../../../shared/hooks/useEdgeSwipeBack.js';
import { safeNavigateBack } from '../../../../shared/routing/safeBack.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { getFlashcardDecks } from '../../../../shared/api/flashcards.api.js';
import { nativeSelection, nativeSuccess, nativeImpact, ImpactStyle } from '../../../../shared/utils/nativeHaptics.js';
import { startOfflineSync, pendingReviewCount, flushReviews } from '../../../../shared/flashcards/offlineQueue.js';
import { renderClozeFront, renderClozeBack, hasCloze } from './cloze.js';
import { serverDriver, localDriver } from './drivers.js';
import { AddCardModal, CardBrowserModal, loadLocalDeckTree, createDeck, deleteDeck } from './management.jsx';
import { StatsModal } from './StatsModal.jsx';
import './flashcards.css';

/* ───────────────────────── helpers ───────────────────────── */

const GRADES = [
  { rating: 1, label: 'Again', cls: 'again' },
  { rating: 2, label: 'Hard', cls: 'hard' },
  { rating: 3, label: 'Good', cls: 'good' },
  { rating: 4, label: 'Easy', cls: 'easy' },
];

function cleanText(value) {
  return String(value || '')
    .replace(/={2,}/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function previewLabel(previews, rating) {
  const hit = (previews || []).find((p) => p.rating === rating);
  return hit ? hit.label : '';
}

function questionNode(card) {
  if (card.clozeText != null) return renderClozeFront(card.clozeText, card.clozeIndex);
  if (hasCloze(card.question)) return renderClozeFront(card.question);
  return cleanText(card.question);
}

function answerNode(card) {
  if (card.clozeText != null) return renderClozeBack(card.clozeText, card.answer, card.clozeIndex);
  if (hasCloze(card.question)) return renderClozeBack(card.question, card.answer);
  return cleanText(card.answer);
}

/* ───────────────────────── icons ─────────────────────────── */

function IcBack() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 12 6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IcUndo() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8a5 5 0 1 1 1.5 3.5M3 5v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IcChevron({ open }) {
  return <svg className="xfc-chevron" data-open={open ? 'true' : 'false'} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 2.75 7.75 6 4.5 9.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IcLock() {
  return <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="2.8" y="6" width="8.4" height="5.5" rx="1.45" stroke="currentColor" strokeWidth="1.45" /><path d="M4.8 6V4.65A2.2 2.2 0 0 1 7 2.45a2.2 2.2 0 0 1 2.2 2.2V6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" /></svg>;
}
function IcTrash() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M5 4.5l.5 8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ─────────────────────── grade buttons ───────────────────── */

function GradeButtons({ previews, onGrade, disabled }) {
  return (
    <div className="xfc-grades" role="group" aria-label="Grade this card">
      {GRADES.map((g) => (
        <button key={g.cls} type="button" className={`xfc-grade xfc-grade--${g.cls}`} disabled={disabled} onClick={() => onGrade(g.rating)}>
          <span className="xfc-grade-interval">{previewLabel(previews, g.rating)}</span>
          <span className="xfc-grade-label">{g.label}</span>
          <span className="xfc-grade-key" aria-hidden="true">{g.rating}</span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────── review session ──────────────────── */

function ReviewSessionView({ scope, driver, onExit }) {
  const pageRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ reviewed: 0, again: 0 });

  const current = queue[index] || null;
  const finished = !loading && !error && index >= queue.length;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.resolve(driver.loadQueue())
      .then((cards) => {
        if (!alive) return;
        setQueue(Array.isArray(cards) ? cards : []);
        setIndex(0);
        setRevealed(false);
      })
      .catch((err) => { if (alive) setError(getErrorMessage(err)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [driver]);

  const reveal = useCallback(() => {
    if (!current || revealed) return;
    setRevealed(true);
    nativeSelection();
  }, [current, revealed]);

  const grade = useCallback((rating) => {
    if (!current || !revealed || busy) return;
    setBusy(true);
    const item = current;
    if (rating === 1) nativeImpact(ImpactStyle.Medium); else nativeSuccess();
    Promise.resolve(driver.grade(item.card, rating))
      .catch(() => {})
      .finally(() => {
        setHistory((h) => [...h, item]);
        setStats((s) => ({ reviewed: s.reviewed + 1, again: s.again + (rating === 1 ? 1 : 0) }));
        setIndex((i) => i + 1);
        setRevealed(false);
        setBusy(false);
      });
  }, [current, revealed, busy, driver]);

  const undo = useCallback(() => {
    if (!history.length || busy) return;
    setBusy(true);
    const last = history[history.length - 1];
    Promise.resolve(driver.undo(last.card))
      .catch(() => {})
      .finally(() => {
        setQueue((q) => {
          const next = [...q];
          next.splice(Math.max(0, index - 1), 0, last);
          return next;
        });
        setHistory((h) => h.slice(0, -1));
        setStats((s) => ({ reviewed: Math.max(0, s.reviewed - 1), again: s.again }));
        setIndex((i) => Math.max(0, i - 1));
        setRevealed(true);
        setBusy(false);
      });
  }, [history, busy, index, driver]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!revealed) reveal(); return; }
      if (e.key.toLowerCase() === 'u') { e.preventDefault(); undo(); return; }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); grade(Number(e.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, reveal, grade, undo]);

  const remaining = Math.max(0, queue.length - index);
  const progress = queue.length ? Math.round((index / queue.length) * 100) : 0;

  return (
    <main ref={pageRef} className="dashboard-page study-hub-page student-flashcards-page">
      <div className="study-hub-shell">
       <div className="xfc-body">
        <header className="xfc-session-bar">
          <button type="button" className="xfc-iconbtn" onClick={onExit} aria-label="Back to decks"><IcBack /></button>
          <div className="xfc-session-title">
            <span className="xfc-session-name">{scope.label}</span>
            <span className="xfc-session-count">{finished ? 'Done' : `${remaining} left`}</span>
          </div>
          <button type="button" className="xfc-iconbtn" onClick={undo} disabled={!history.length || busy} aria-label="Undo last review"><IcUndo /></button>
        </header>

        <div className="xfc-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

        {loading ? (
          <div className="xfc-loading"><div className="xfc-spinner" /><p>Building your review queue…</p></div>
        ) : error ? (
          <div className="xfc-empty">
            <FeedbackNotice tone="error">{error}</FeedbackNotice>
            <button type="button" className="xfc-primary" onClick={onExit}>Back to decks</button>
          </div>
        ) : finished || !current ? (
          <DoneForToday stats={stats} onExit={onExit} />
        ) : (
          <div className="xfc-stage">
            <div
              className={`xfc-card ${revealed ? 'is-flipped' : ''}`}
              onClick={revealed ? undefined : reveal}
              role="button"
              tabIndex={0}
              aria-label={revealed ? 'Card answer' : 'Show answer'}
              onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !revealed) { e.preventDefault(); reveal(); } }}
            >
              <div className="xfc-card-inner">
                <div className="xfc-face xfc-face--front" aria-hidden={revealed}>
                  <CardImage card={current.card} />
                  <div className="xfc-q">{questionNode(current.card)}</div>
                  <div className="xfc-hint">Tap or press Space to flip</div>
                </div>
                <div className="xfc-face xfc-face--back" aria-hidden={!revealed}>
                  <div className="xfc-a-label">Answer</div>
                  <div className="xfc-a">{answerNode(current.card)}</div>
                  {current.card.sourceHint ? <div className="xfc-source">{cleanText(current.card.sourceHint)}</div> : null}
                </div>
              </div>
            </div>

            {revealed ? (
              <GradeButtons previews={current.previews} onGrade={grade} disabled={busy} />
            ) : (
              <button type="button" className="xfc-reveal" onClick={reveal}>Show answer</button>
            )}

            <p className="xfc-shortcuts">
              {revealed
                ? <><kbd>1</kbd> Again · <kbd>2</kbd> Hard · <kbd>3</kbd> Good · <kbd>4</kbd> Easy · <kbd>U</kbd> Undo</>
                : <><kbd>Space</kbd> to flip</>}
            </p>
          </div>
        )}
       </div>
      </div>
    </main>
  );
}

function CardImage({ card }) {
  const url = card?.imageUrls?.[0] || card?.imageUrl;
  if (!url) return null;
  return (
    <div className={`xfc-img xfc-img--${card.imageFit === 'cover' ? 'cover' : 'contain'}`}>
      <img src={url} alt="" loading="lazy" />
    </div>
  );
}

function DoneForToday({ stats, onExit }) {
  return (
    <div className="xfc-empty xfc-done">
      <div className="xfc-done-mark" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h2>Done for today</h2>
      <p>{stats.reviewed > 0 ? `You reviewed ${stats.reviewed} card${stats.reviewed === 1 ? '' : 's'}.` : 'No cards are due in this deck right now.'}</p>
      <button type="button" className="xfc-primary" onClick={onExit}>Back to decks</button>
    </div>
  );
}

/* ───────────────────────── deck list ─────────────────────── */

function Count({ value, tone }) {
  const active = Number(value) > 0;
  return <span className={`xfc-count xfc-count--${tone} ${active ? 'is-active' : ''}`}>{Number(value) || 0}</span>;
}

function DeckRow({ node, depth, expanded, onToggle, onStart, onDelete }) {
  const hasChildren = node.children && node.children.length > 0;
  const open = expanded.has(node.key);
  const canStudy = (node.newCount + node.learningCount + node.dueCount) > 0 && !node.locked;

  return (
    <>
      <div className={`xfc-deck-row xfc-deck-row--${node.type}`} style={{ '--xfc-depth': depth }}>
        <button type="button" className="xfc-deck-main" onClick={() => (hasChildren ? onToggle(node) : onStart(node))}>
          {hasChildren ? <IcChevron open={open} /> : <span className="xfc-chevron-spacer" aria-hidden="true" />}
          <span className="xfc-deck-label">{node.label}</span>
          {node.locked ? <span className="xfc-lock" title="Locked"><IcLock /></span> : null}
        </button>
        <div className="xfc-deck-counts">
          <Count value={node.newCount} tone="new" />
          <Count value={node.learningCount} tone="learn" />
          <Count value={node.dueCount} tone="due" />
        </div>
        {onDelete && depth === 0 ? (
          <button type="button" className="xfc-deck-play xfc-deck-del" onClick={() => onDelete(node)} aria-label={`Delete ${node.label}`}><IcTrash /></button>
        ) : (
          <button type="button" className="xfc-deck-play" disabled={!canStudy} onClick={() => onStart(node)} aria-label={`Study ${node.label}`}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 3.2 12.5 8l-8 4.8z" /></svg>
          </button>
        )}
      </div>
      {hasChildren && open
        ? node.children.map((child) => (
            <DeckRow key={child.key} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onStart={onStart} onDelete={onDelete} />
          ))
        : null}
    </>
  );
}

function SummaryStat({ label, value, tone }) {
  return (
    <div className={`xfc-sumstat xfc-sumstat--${tone}`}>
      <span className="xfc-sumstat-value">{Number(value) || 0}</span>
      <span className="xfc-sumstat-label">{label}</span>
    </div>
  );
}

function DeckListView({ onStart }) {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [tab, setTab] = useState('lesson');
  const [data, setData] = useState({ decks: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [localTree, setLocalTree] = useState([]);
  const [modal, setModal] = useState(null); // 'add' | 'browse' | 'stats'
  const [pending, setPending] = useState(0);

  const handleSwipeBack = useCallback(() => {
    const studyPath = window.location.pathname.startsWith('/app') ? '/app/study' : '/study';
    safeNavigateBack(navigate, { fallbackPath: studyPath });
  }, [navigate]);
  useEdgeSwipeBack({ containerRef: pageRef, onBack: handleSwipeBack });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getFlashcardDecks()
      .then((res) => setData(res || { decks: [], totals: {} }))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const refreshLocal = useCallback(() => setLocalTree(loadLocalDeckTree()), []);

  useEffect(() => { load(); refreshLocal(); setPending(pendingReviewCount()); }, [load, refreshLocal]);

  const syncNow = useCallback(() => {
    flushReviews().then((res) => { setPending(res.pending); load(); });
  }, [load]);

  const toggle = useCallback((node) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const keys = [node.key];
      const stack = [...(node.children || [])];
      while (stack.length) {
        const child = stack.pop();
        keys.push(child.key);
        if (child.children?.length) stack.push(...child.children);
      }
      if (next.has(node.key)) {
        keys.forEach((key) => next.delete(key));
      } else {
        keys.forEach((key) => next.add(key));
      }
      return next;
    });
  }, []);

  const onCreateDeck = () => {
    const name = window.prompt('New deck name');
    if (name && name.trim()) { createDeck(name.trim()); refreshLocal(); }
  };
  const onDeleteLocalDeck = (node) => {
    if (window.confirm(`Delete deck “${node.label}” and all its cards?`)) { deleteDeck(node.deckId); refreshLocal(); }
  };

  const totals = data.totals || {};
  const hasDue = (totals.learningCount || 0) + (totals.dueCount || 0) + (totals.newCount || 0) > 0;

  return (
    <main ref={pageRef} className="dashboard-page study-hub-page student-flashcards-page">
      <div className="study-hub-shell">
       <div className="xfc-body">
        <AppHeader title="Flashcards" subtitle="Spaced Review" compact />

        <div className="xfc-tabrow">
          <div className="xfc-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'lesson'} className={`xfc-tab ${tab === 'lesson' ? 'is-active' : ''}`} onClick={() => setTab('lesson')}>Lesson decks</button>
            <button type="button" role="tab" aria-selected={tab === 'mine'} className={`xfc-tab ${tab === 'mine' ? 'is-active' : ''}`} onClick={() => setTab('mine')}>My decks</button>
          </div>
          <button type="button" className="xfc-action" onClick={() => setModal('stats')}>Stats</button>
        </div>

        {pending > 0 ? (
          <div className="xfc-syncbar">
            <span>{pending} review{pending === 1 ? '' : 's'} waiting to sync.</span>
            <button type="button" className="xfc-mini" onClick={syncNow}>Sync now</button>
          </div>
        ) : null}

        {tab === 'lesson' ? (
          <>
            <div className="xfc-summary">
              <SummaryStat label="New" value={totals.newCount} tone="new" />
              <SummaryStat label="Learning" value={totals.learningCount} tone="learn" />
              <SummaryStat label="Due" value={totals.dueCount} tone="due" />
            </div>
            <div className="xfc-deck-head" aria-hidden="true">
              <span>Deck</span>
              <span className="xfc-deck-head-counts"><span>New</span><span>Learn</span><span>Due</span></span>
              <span className="xfc-deck-head-play" />
            </div>
            {loading ? (
              <div className="xfc-deck-skeleton">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="xfc-skel-row" />)}</div>
            ) : error ? (
              <div className="xfc-empty">
                <FeedbackNotice tone="error">{error}</FeedbackNotice>
                <button type="button" className="xfc-primary" onClick={load}>Try again</button>
              </div>
            ) : !data.decks.length ? (
              <div className="xfc-empty"><h2>No flashcards yet</h2><p>Flashcards appear here once your lessons have approved cards.</p></div>
            ) : (
              <div className="xfc-deck-list">
                {data.decks.map((node) => (
                  <DeckRow key={node.key} node={node} depth={0} expanded={expanded} onToggle={toggle} onStart={onStart} />
                ))}
              </div>
            )}
            {!loading && !error && data.decks.length > 0 && !hasDue ? (
              <p className="xfc-allclear">🎉 You’re all caught up — nothing due right now.</p>
            ) : null}
          </>
        ) : (
          <>
            <div className="xfc-mine-actions">
              <button type="button" className="xfc-action" onClick={() => setModal('add')}>＋ Add card</button>
              <button type="button" className="xfc-action" onClick={onCreateDeck}>New deck</button>
              <button type="button" className="xfc-action" onClick={() => setModal('browse')}>Browse cards</button>
            </div>
            {!localTree.length ? (
              <div className="xfc-empty">
                <h2>Your own decks</h2>
                <p>Create your own flashcards. They stay on this device and show up when it is time to review.</p>
                <button type="button" className="xfc-primary" onClick={() => setModal('add')}>Add your first card</button>
              </div>
            ) : (
              <>
                <div className="xfc-deck-head" aria-hidden="true">
                  <span>Deck</span>
                  <span className="xfc-deck-head-counts"><span>New</span><span>Learn</span><span>Due</span></span>
                  <span className="xfc-deck-head-play" />
                </div>
                <div className="xfc-deck-list">
                  {localTree.map((node) => (
                    <DeckRow key={node.key} node={node} depth={0} expanded={expanded} onToggle={toggle} onStart={onStart} onDelete={onDeleteLocalDeck} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
       </div>
      </div>

      {modal === 'add' ? <AddCardModal onClose={() => setModal(null)} onSaved={() => { setModal(null); refreshLocal(); }} /> : null}
      {modal === 'browse' ? <CardBrowserModal onClose={() => setModal(null)} onChanged={refreshLocal} /> : null}
      {modal === 'stats' ? <StatsModal onClose={() => setModal(null)} /> : null}
    </main>
  );
}

/* ───────────────────────── page shell ────────────────────── */

function SessionGate({ scope, onExit }) {
  // Memoize per scope so ReviewSessionView's load effect runs once per session.
  const driver = useMemo(() => (scope._local ? localDriver(scope) : serverDriver(scope)), [scope]);
  return <ReviewSessionView scope={scope} driver={driver} onExit={onExit} />;
}

export function StudentFlashcardsPage() {
  const [scope, setScope] = useState(null);

  useEffect(() => { startOfflineSync(); }, []);

  const handleStart = useCallback((node) => {
    if (node?._local) {
      setScope({ deckId: node.deckId, label: node.label, key: node.key, _local: true });
      return;
    }
    if (!node?.noteIds?.length) return;
    setScope({ noteIds: node.noteIds, label: node.label, key: node.key });
  }, []);

  const handleExit = useCallback(() => setScope(null), []);

  if (!scope) return <DeckListView onStart={handleStart} />;
  return <SessionGate scope={scope} onExit={handleExit} />;
}

export default StudentFlashcardsPage;
