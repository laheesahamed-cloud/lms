import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchEcgTopics } from '../../../../shared/api/ecg.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import './EcgPage.css';

export function EcgPage() {
  const nav = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEcgTopics()
      .then((res) => setTopics(res.topics || []))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader title="ECG" subtitle="Learn to read the ECG, topic by topic" />

        <div className="ecg-quiz-banner" onClick={() => nav('/app/ecg/quiz')} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter') nav('/app/ecg/quiz'); }}>
          <div className="ecg-quiz-banner__icon" aria-hidden="true">📈</div>
          <div className="ecg-quiz-banner__copy">
            <strong>ECG Quiz</strong>
            <span>Test yourself — identify ECGs from the image</span>
          </div>
          <div className="ecg-quiz-banner__arrow" aria-hidden="true">›</div>
        </div>

        {error && <p className="ecg-error" role="alert">{error}</p>}

        {loading ? (
          <div className="ecg-topic-list">
            {[0, 1, 2, 3].map((i) => <div key={i} className="ecg-topic-card ecg-topic-card--skeleton" />)}
          </div>
        ) : topics.length === 0 ? (
          <p className="ecg-empty">No ECG topics yet. Check back soon.</p>
        ) : (
          <div className="ecg-topic-list">
            {topics.map((t, idx) => (
              <button
                key={t.id}
                className="ecg-topic-card"
                onClick={() => nav(`/app/ecg/topic/${t.id}`)}
              >
                <span className="ecg-topic-num">{String(idx + 1).padStart(2, '0')}</span>
                <span className="ecg-topic-body">
                  <span className="ecg-topic-title">{t.title}</span>
                  {t.description && <span className="ecg-topic-desc">{t.description}</span>}
                  <span className="ecg-topic-count">{t.cardCount} ECG{t.cardCount === 1 ? '' : 's'}</span>
                </span>
                <span className="ecg-topic-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
