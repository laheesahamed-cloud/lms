import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchAuscTopic } from '../../../../shared/api/auscultation.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AudioPlayer } from './components/AudioPlayer.jsx';
import './AuscTopicPage.css';

export function AuscTopicPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [topic, setTopic] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchAuscTopic(id)
      .then((res) => { setTopic(res.topic); setCards(res.cards || []); })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const category = topic?.category === 'lung' ? 'lung' : 'heart';

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader title={topic?.title || 'Auscultation'} subtitle={topic?.description || 'Sound topic'} />

        <button className="ausc-back" onClick={() => nav('/app/auscultation')}>‹ All sounds</button>

        {error && <p className="ausc-error" role="alert">{error}</p>}

        {loading ? (
          <div className="ausc-card-stack">
            {[0, 1].map((i) => <div key={i} className="ausc-snd-card ausc-snd-card--skeleton" />)}
          </div>
        ) : cards.length === 0 ? (
          <p className="ausc-empty">No sounds in this topic yet.</p>
        ) : (
          <div className="ausc-card-stack">
            {cards.map((c, idx) => (
              <article key={c.id} className="ausc-snd-card">
                <div className="ausc-snd-head">
                  <span className="ausc-snd-num">{idx + 1}</span>
                  <h2 className="ausc-snd-title">{c.title}</h2>
                </div>
                {c.hasAudio && (
                  <AudioPlayer kind="cards" id={c.id} category={category} title={c.title} />
                )}
                {c.explanation && <p className="ausc-snd-explanation">{c.explanation}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
