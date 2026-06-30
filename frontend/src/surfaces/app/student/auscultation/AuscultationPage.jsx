import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchAuscTopics } from '../../../../shared/api/auscultation.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { HeartIcon, LungIcon, HeadphonesIcon } from './components/icons.jsx';
import './AuscultationPage.css';

export function AuscultationPage() {
  const nav = useNavigate();
  const [category, setCategory] = useState('heart');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetchAuscTopics(category)
      .then((res) => { if (live) setTopics(res.topics || []); })
      .catch((e) => { if (live) setError(getErrorMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [category]);

  return (
    <main className="dashboard-page study-hub-page">
      <div className="study-hub-shell">
        <AppHeader title="Auscultation" subtitle="Heart & lung sounds" />

        {/* Heart / Lung tabs */}
        <div className="ausc-tabs" role="tablist">
          <button role="tab" aria-selected={category === 'heart'}
            className={`ausc-tab ${category === 'heart' ? 'is-active' : ''}`}
            onClick={() => setCategory('heart')}><HeartIcon size={16} /> Heart</button>
          <button role="tab" aria-selected={category === 'lung'}
            className={`ausc-tab ${category === 'lung' ? 'is-active' : ''}`}
            onClick={() => setCategory('lung')}><LungIcon size={16} /> Lung</button>
        </div>

        <div className={`ausc-quiz-banner ausc-quiz-banner--${category}`}
          role="button" tabIndex={0}
          onClick={() => nav(`/app/auscultation/quiz?category=${category}`)}
          onKeyDown={(e) => { if (e.key === 'Enter') nav(`/app/auscultation/quiz?category=${category}`); }}>
          <div className="ausc-quiz-banner__icon" aria-hidden="true"><HeadphonesIcon size={22} /></div>
          <div className="ausc-quiz-banner__copy">
            <strong>{category === 'heart' ? 'Heart' : 'Lung'} Sounds Quiz</strong>
            <span>Listen and identify the sound</span>
          </div>
          <div className="ausc-quiz-banner__arrow" aria-hidden="true">›</div>
        </div>

        {error && <p className="ausc-error" role="alert">{error}</p>}

        {loading ? (
          <div className="ausc-topic-list">
            {[0, 1, 2].map((i) => <div key={i} className="ausc-topic-card ausc-topic-card--skeleton" />)}
          </div>
        ) : topics.length === 0 ? (
          <p className="ausc-empty">No {category} sound topics yet. Check back soon.</p>
        ) : (
          <div className="ausc-topic-list">
            {topics.map((t, idx) => (
              <button key={t.id} className="ausc-topic-card"
                onClick={() => nav(`/app/auscultation/topic/${t.id}`)}>
                <span className="ausc-topic-num">{String(idx + 1).padStart(2, '0')}</span>
                <span className="ausc-topic-body">
                  <span className="ausc-topic-title">{t.title}</span>
                  {t.description && <span className="ausc-topic-desc">{t.description}</span>}
                  <span className="ausc-topic-count">{t.cardCount} sound{t.cardCount === 1 ? '' : 's'}</span>
                </span>
                <span className="ausc-topic-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
