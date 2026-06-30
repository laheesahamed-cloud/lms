import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchEcgTopic } from '../../../../shared/api/ecg.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import './EcgTopicPage.css';

export function EcgTopicPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [topic, setTopic] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchEcgTopic(id)
      .then((res) => { setTopic(res.topic); setCards(res.cards || []); })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader
          title={topic?.title || 'ECG'}
          subtitle={topic?.description || 'ECG topic'}
        />

        <button className="ecg-back" onClick={() => nav('/app/ecg')}>‹ All ECG topics</button>

        {error && <p className="ecg-error" role="alert">{error}</p>}

        {loading ? (
          <div className="ecg-card-stack">
            {[0, 1].map((i) => <div key={i} className="ecg-card ecg-card--skeleton" />)}
          </div>
        ) : cards.length === 0 ? (
          <p className="ecg-empty">No ECGs in this topic yet.</p>
        ) : (
          <div className="ecg-card-stack">
            {cards.map((c, idx) => (
              <article key={c.id} className="ecg-card">
                <div className="ecg-card-head">
                  <span className="ecg-card-num">{idx + 1}</span>
                  <h2 className="ecg-card-title">{c.title}</h2>
                </div>
                {c.image_url && (
                  <div className="ecg-card-image">
                    <img src={c.image_url} alt={c.title} loading="lazy" />
                  </div>
                )}
                {c.explanation && (
                  <p className="ecg-card-explanation">{c.explanation}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
