import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchAuscQuiz } from '../../../../shared/api/auscultation.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AudioPlayer } from './components/AudioPlayer.jsx';
import './AuscQuizPage.css';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function AuscQuizPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const category = params.get('category') === 'lung' ? 'lung' : 'heart';

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    setIdx(0); setPicked(null); setScore(0); setDone(false);
    fetchAuscQuiz(category, 10)
      .then((res) => setQuestions(res.questions || []))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [category]);

  const current = questions[idx];
  const options = useMemo(() => current ? shuffle(current.options || []) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id]);

  function pick(opt) {
    if (picked != null) return;
    setPicked(opt);
    if (opt === current.answer) setScore((s) => s + 1);
  }
  function next() {
    if (idx + 1 >= questions.length) setDone(true);
    else { setIdx((i) => i + 1); setPicked(null); }
  }

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader title={`${category === 'lung' ? 'Lung' : 'Heart'} Sounds Quiz`} subtitle="Listen and identify the sound" />
        <button className="ausc-back" onClick={() => nav('/app/auscultation')}>‹ Back to Auscultation</button>

        {error && <p className="ausc-error" role="alert">{error}</p>}

        {loading ? (
          <div className="auscq-card auscq-card--skeleton" />
        ) : questions.length === 0 ? (
          <p className="ausc-empty">No {category} quiz questions yet. Add some in the admin panel.</p>
        ) : done ? (
          <div className="auscq-result">
            <div className="auscq-result-score">{score} / {questions.length}</div>
            <p className="auscq-result-label">
              {score === questions.length ? 'Perfect! 🎉'
                : score >= questions.length * 0.7 ? 'Great ear!'
                : score >= questions.length * 0.4 ? 'Keep practising.'
                : 'Listen again and retry.'}
            </p>
            <div className="auscq-result-actions">
              <button className="auscq-btn auscq-btn--primary" onClick={load}>Try again</button>
              <button className="auscq-btn" onClick={() => nav('/app/auscultation')}>Back</button>
            </div>
          </div>
        ) : current ? (
          <>
            <div className="auscq-progress"><div className="auscq-progress-bar" style={{ width: `${(idx / questions.length) * 100}%` }} /></div>
            <div className="auscq-meta"><span>Question {idx + 1} of {questions.length}</span><span>Score: {score}</span></div>

            <div className="auscq-card">
              {current.hasAudio && (
                <AudioPlayer kind="quiz" id={current.id} category={category} title="Listen to the sound" />
              )}
              <p className="auscq-prompt">{current.question_text || 'What is this sound?'}</p>

              <div className="auscq-options">
                {options.map((opt) => {
                  let cls = 'auscq-option';
                  if (picked != null) {
                    if (opt === current.answer) cls += ' auscq-option--correct';
                    else if (opt === picked) cls += ' auscq-option--wrong';
                    else cls += ' auscq-option--dim';
                  }
                  return (
                    <button key={opt} className={cls} onClick={() => pick(opt)} disabled={picked != null}>{opt}</button>
                  );
                })}
              </div>

              {picked != null && (
                <div className={`auscq-feedback ${picked === current.answer ? 'is-correct' : 'is-wrong'}`}>
                  <strong>{picked === current.answer ? 'Correct!' : `Answer: ${current.answer}`}</strong>
                  {current.explanation && <p>{current.explanation}</p>}
                  <button className="auscq-btn auscq-btn--primary" onClick={next}>
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
