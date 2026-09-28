import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { fetchEcgTopics } from '../../../../shared/api/ecg.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import './EcgPage.css';

// Topics with a category are grouped under a heading; topics without one
// (the original, uncategorized content) render as a plain trailing list,
// exactly like before — nothing regresses for existing topics.
function groupTopics(topics) {
  const groups = [];
  const groupByName = new Map();
  const ungrouped = [];
  topics.forEach((t) => {
    if (!t.category) { ungrouped.push(t); return; }
    if (!groupByName.has(t.category)) {
      const group = { name: t.category, topics: [] };
      groupByName.set(t.category, group);
      groups.push(group);
    }
    groupByName.get(t.category).topics.push(t);
  });
  return { groups, ungrouped };
}

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

  const numByTopicId = useMemo(() => {
    const m = new Map();
    topics.forEach((t, idx) => m.set(t.id, idx + 1));
    return m;
  }, [topics]);

  const { groups, ungrouped } = useMemo(() => groupTopics(topics), [topics]);

  const renderTopicCard = (t) => (
    <button
      key={t.id}
      className="ecg-topic-card"
      onClick={() => nav(`/app/ecg/topic/${t.id}`)}
    >
      <span className="ecg-topic-num">{String(numByTopicId.get(t.id) || 0).padStart(2, '0')}</span>
      <span className="ecg-topic-body">
        <span className="ecg-topic-title">{t.title}</span>
        {t.description && <span className="ecg-topic-desc">{t.description}</span>}
        <span className="ecg-topic-count">{t.cardCount} ECG{t.cardCount === 1 ? '' : 's'}</span>
      </span>
      <span className="ecg-topic-chevron" aria-hidden="true">›</span>
    </button>
  );

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
          <>
            {groups.map((g) => (
              <details key={g.name} className="ecg-category" open>
                <summary>
                  <span className="ecg-category-chevron" aria-hidden="true">›</span>
                  <span className="ecg-category-name">{g.name}</span>
                  <span className="ecg-category-count">{g.topics.length}</span>
                </summary>
                <div className="ecg-topic-list">
                  {g.topics.map(renderTopicCard)}
                </div>
              </details>
            ))}
            {ungrouped.length > 0 && (
              <div className="ecg-topic-list">
                {ungrouped.map(renderTopicCard)}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
