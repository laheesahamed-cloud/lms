import { useEffect, useRef, useState, useCallback } from 'react';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { batchFetchDrugs, recordDrugSpin } from '../../../../shared/api/drugs.api.js';
import { LotterySpinner } from './components/LotterySpinner.jsx';
import { DrugMCQ } from './components/DrugMCQ.jsx';
import { DrugCard } from './components/DrugCard.jsx';
import { UpgradePrompt } from './components/UpgradePrompt.jsx';
import './DrugRandomizerPage.css';

const PHASE        = { IDLE: 'idle', SPINNING: 'spinning', MCQ: 'mcq', CARD: 'card' };
const BATCH_SIZE   = 10;
const REFILL_AT    = 3;
const REFILL_COUNT = 7;
const CACHE_KEY    = 'dr_queue';
const CACHE_TTL    = 30 * 60 * 1000; // 30 min — stale drugs after this

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c?.drugs?.length) return null;
    if (Date.now() - c.cachedAt > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null; }
    return c;
  } catch { return null; }
}

function writeCache(drugs, meta) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      drugs,
      useCount: meta.useCount,
      freeLimit: meta.freeLimit,
      hasSub: meta.hasSub,
      cachedAt: Date.now(),
    }));
  } catch { /* storage full — ignore */ }
}

function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

export function DrugRandomizerPage() {
  const [phase, setPhase]             = useState(PHASE.IDLE);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);
  const [mcqCorrect, setMcqCorrect]   = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [useCount, setUseCount]   = useState(0);
  const [freeLimit, setFreeLimit] = useState(5);
  const [hasSub, setHasSub]       = useState(false);
  const [ready, setReady]         = useState(false);

  const queueRef    = useRef([]);
  const fetchingRef = useRef(false);
  const useCountRef = useRef(0);
  const metaRef     = useRef({ useCount: 0, freeLimit: 5, hasSub: false });
  const spinDataRef = useRef(null);

  function persistQueue() {
    writeCache(queueRef.current, metaRef.current);
  }

  const fetchBatch = useCallback(async (count, isInit = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await batchFetchDrugs(count);
      if (data.blocked) return;
      queueRef.current = [...queueRef.current, ...(data.drugs || [])];
      if (isInit) {
        // Server is source of truth for useCount on fresh load
        useCountRef.current = data.useCount ?? 0;
        metaRef.current = { useCount: data.useCount ?? 0, freeLimit: data.freeLimit ?? 5, hasSub: !!data.hasSubscription };
        setUseCount(data.useCount ?? 0);
        setFreeLimit(data.freeLimit ?? 5);
        setHasSub(!!data.hasSubscription);
        setReady(true);
      }
      persistQueue();
    } catch {
      // silent — error surfaces on spin if queue stays empty
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Mount: restore from cache first, then top up from server if needed
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      queueRef.current  = cached.drugs;
      useCountRef.current = cached.useCount ?? 0;
      metaRef.current   = { useCount: cached.useCount ?? 0, freeLimit: cached.freeLimit ?? 5, hasSub: !!cached.hasSub };
      setUseCount(cached.useCount ?? 0);
      setFreeLimit(cached.freeLimit ?? 5);
      setHasSub(!!cached.hasSub);
      setReady(true);

      // Top up if cache is low — but fetch fresh useCount from server too
      const needed = BATCH_SIZE - cached.drugs.length;
      if (needed > 0) void fetchBatch(needed, false);
      else {
        // Still sync useCount from server silently (might have changed on another device)
        batchFetchDrugs(0).then(d => {
          if (!d?.blocked) {
            useCountRef.current = d.useCount ?? useCountRef.current;
            metaRef.current.useCount = useCountRef.current;
            setUseCount(useCountRef.current);
          }
        }).catch(() => {});
      }
    } else {
      void fetchBatch(BATCH_SIZE, true);
    }
  }, []);

  // Save remaining queue when leaving the page
  useEffect(() => () => persistQueue(), []);

  async function handleSpin() {
    if (phase === PHASE.SPINNING) return;
    setError(null);
    setMcqCorrect(null);
    setResult(null);

    if (!hasSub && useCountRef.current >= freeLimit) {
      setShowUpgrade(true);
      return;
    }

    let item = queueRef.current.shift();

    if (!item) {
      // Queue empty — wait for fetch (rare edge case)
      await fetchBatch(BATCH_SIZE, !ready);
      item = queueRef.current.shift();
      if (!item) { setError('Could not load a drug. Please try again.'); return; }
    }

    useCountRef.current += 1;
    metaRef.current.useCount = useCountRef.current;
    setUseCount(useCountRef.current);

    void recordDrugSpin(); // fire-and-forget

    if (queueRef.current.length <= REFILL_AT) {
      void fetchBatch(REFILL_COUNT, false);
    } else {
      persistQueue(); // update cache with popped item
    }

    spinDataRef.current = item;
    setPhase(PHASE.SPINNING);
  }

  const handleSpinDone = useCallback(() => {
    setResult(spinDataRef.current);
    setPhase(PHASE.MCQ);
  }, []);

  function handleMCQAnswered(correct) {
    setMcqCorrect(correct);
    setPhase(PHASE.CARD);
  }

  function handleSpinAgain() {
    setPhase(PHASE.IDLE);
    setResult(null);
    setMcqCorrect(null);
  }

  const data       = result || spinDataRef.current;
  const isSpinning = phase === PHASE.SPINNING;

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader title="Drugs" subtitle="Spin to study a random drug" />

        {!hasSub && (
          <div className="dr-usage-bar">
            <span className="dr-usage-label">
              {Math.min(useCount, freeLimit)} / {freeLimit} free spins used
            </span>
            <div className="dr-usage-track">
              <div
                className="dr-usage-fill"
                style={{ width: `${Math.min((useCount / freeLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="dr-body">
          {(phase === PHASE.IDLE || isSpinning) && (
            <div className="dr-spin-area">
              <div className="dr-spin-hero">
                <h2 className="dr-spin-title">
                  {phase === PHASE.IDLE ? 'Ready to study?' : 'Drawing a drug…'}
                </h2>
                <p className="dr-spin-sub">
                  {phase === PHASE.IDLE
                    ? 'Hit spin to get a random drug, answer a quick question, then see the full drug card.'
                    : ''}
                </p>
              </div>

              {isSpinning && data && (
                <LotterySpinner
                  spinning={isSpinning}
                  finalName={data.drug.name}
                  onDone={handleSpinDone}
                />
              )}

              {error && <p className="dr-error" role="alert">{error}</p>}

              {!isSpinning && (
                <button
                  className="dr-spin-btn"
                  onClick={handleSpin}
                  disabled={!ready}
                  aria-label="Spin for a random drug"
                >
                  Spin
                </button>
              )}
            </div>
          )}

          {phase === PHASE.MCQ && data && (
            <div className="dr-mcq-area">
              <DrugMCQ
                drug={data.drug}
                distractors={data.distractors}
                questionType={data.questionType}
                onAnswered={handleMCQAnswered}
              />
            </div>
          )}

          {phase === PHASE.CARD && data && (
            <div className="dr-card-area">
              <div className={`dr-result-badge dr-result-badge--${mcqCorrect ? 'correct' : 'wrong'}`}>
                {mcqCorrect ? 'Correct!' : 'Not quite — here\'s the full answer'}
              </div>
              <DrugCard drug={data.drug} />
              <button className="dr-again-btn" onClick={handleSpinAgain}>
                Spin Again
              </button>
            </div>
          )}
        </div>

        {showUpgrade && <UpgradePrompt freeLimit={freeLimit} />}
      </div>
    </main>
  );
}
