import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchEcgQuiz } from '../../../../shared/api/ecg.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import './EcgQuizPage.css';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function EcgQuizPage() {
  const nav = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchEcgQuiz(10)
      .then((res) => setQuestions(res.questions || []))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const current = questions[idx];

  // Options are stable per question (shuffled once)
  const options = useMemo(() => {
    if (!current) return [];
    return shuffle(current.options || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function handlePick(opt) {
    if (picked != null) return;
    setPicked(opt);
    if (opt === current.answer) setScore((s) => s + 1);
  }

  function handleNext() {
    if (idx + 1 >= questions.length) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  }

  function restart() {
    setLoading(true);
    setError(null);
    setIdx(0); setPicked(null); setScore(0); setDone(false);
    fetchEcgQuiz(10)
      .then((res) => setQuestions(res.questions || []))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader title="ECG Quiz" subtitle="Identify the ECG from the image" />

        <button className="ecg-back" onClick={() => nav('/app/ecg')}>‹ Back to ECG</button>

        {error && <p className="ecg-error" role="alert">{error}</p>}

        {loading ? (
          <div className="ecgq-card ecgq-card--skeleton" />
        ) : questions.length === 0 ? (
          <p className="ecg-empty">No ECG questions available yet. Add some ECG cards with images first.</p>
        ) : done ? (
          <div className="ecgq-result">
            <div className="ecgq-result-score">{score} / {questions.length}</div>
            <p className="ecgq-result-label">
              {score === questions.length ? 'Perfect! 🎉'
                : score >= questions.length * 0.7 ? 'Great work!'
                : score >= questions.length * 0.4 ? 'Keep practising.'
                : 'Review the topics and try again.'}
            </p>
            <div className="ecgq-result-actions">
              <button className="ecgq-btn ecgq-btn--primary" onClick={restart}>Try again</button>
              <button className="ecgq-btn" onClick={() => nav('/app/ecg')}>Back to ECG</button>
            </div>
          </div>
        ) : current ? (
          <>
            <div className="ecgq-progress">
              <div className="ecgq-progress-bar" style={{ width: `${((idx) / questions.length) * 100}%` }} />
            </div>
            <div className="ecgq-meta">
              <span>Question {idx + 1} of {questions.length}</span>
              <span>Score: {score}</span>
            </div>

            <div className="ecgq-card">
              <div className="ecgq-image">
                <img src={current.image_url} alt="ECG to identify" />
              </div>
              <p className="ecgq-prompt">{current.question_text || 'What does this ECG show?'}</p>

              <div className="ecgq-options">
                {options.map((opt) => {
                  let cls = 'ecgq-option';
                  if (picked != null) {
                    if (opt === current.answer) cls += ' ecgq-option--correct';
                    else if (opt === picked) cls += ' ecgq-option--wrong';
                    else cls += ' ecgq-option--dim';
                  }
                  return (
                    <button key={opt} className={cls} onClick={() => handlePick(opt)} disabled={picked != null}>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {picked != null && (
                <div className={`ecgq-feedback ${picked === current.answer ? 'is-correct' : 'is-wrong'}`}>
                  <strong>{picked === current.answer ? 'Correct!' : `Answer: ${current.answer}`}</strong>
                  {current.explanation && <p>{current.explanation}</p>}
                  <button className="ecgq-btn ecgq-btn--primary" onClick={handleNext}>
                    {idx + 1 >= questions.length ? 'See result' : 'Next question'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
