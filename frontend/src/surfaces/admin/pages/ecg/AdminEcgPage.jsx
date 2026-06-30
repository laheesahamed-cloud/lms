import { useCallback, useEffect, useState } from 'react';
import {
  adminListEcgTopics, adminCreateEcgTopic, adminUpdateEcgTopic,
  adminToggleEcgTopic, adminDeleteEcgTopic,
  adminListEcgCards, adminCreateEcgCard, adminUpdateEcgCard,
  adminToggleEcgCard, adminDeleteEcgCard,
  adminListEcgQuiz, adminCreateEcgQuiz, adminUpdateEcgQuiz,
  adminToggleEcgQuiz, adminDeleteEcgQuiz,
} from '../../../../shared/api/ecg.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { optimizeImageFile } from '../../../../shared/utils/imageOptimizer.js';
import './AdminEcgPage.css';

export function AdminEcgPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topicModal, setTopicModal] = useState(null); // null | { mode, topic? }
  const [activeTopic, setActiveTopic] = useState(null); // topic whose cards we're managing
  const [tab, setTab] = useState('topics'); // 'topics' | 'quiz'

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListEcgTopics();
      setTopics(res.topics || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleToggleTopic(id) {
    await adminToggleEcgTopic(id);
    void load();
  }

  async function handleDeleteTopic(t) {
    if (!confirm(`Delete topic "${t.title}" and all its ECGs? This cannot be undone.`)) return;
    await adminDeleteEcgTopic(t.id);
    void load();
  }

  if (activeTopic) {
    return (
      <EcgCardsManager
        topic={activeTopic}
        onBack={() => { setActiveTopic(null); void load(); }}
      />
    );
  }

  return (
    <div className="aep-root">
      <div className="aep-header">
        <div>
          <h1 className="aep-title">ECG Library</h1>
          <p className="aep-sub">
            {tab === 'topics'
              ? `${topics.length} topic${topics.length === 1 ? '' : 's'}`
              : 'Quiz questions'}
          </p>
        </div>
        {tab === 'topics' && (
          <button className="aep-btn aep-btn--primary" onClick={() => setTopicModal({ mode: 'create' })}>
            + Add Topic
          </button>
        )}
      </div>

      <div className="aep-tabs">
        <button className={`aep-tab ${tab === 'topics' ? 'is-active' : ''}`} onClick={() => setTab('topics')}>
          Topics &amp; ECGs
        </button>
        <button className={`aep-tab ${tab === 'quiz' ? 'is-active' : ''}`} onClick={() => setTab('quiz')}>
          Quiz
        </button>
      </div>

      {tab === 'quiz' ? (
        <EcgQuizManager />
      ) : (
      <>
      {error && <p className="aep-error">{error}</p>}

      <div className="aep-topic-grid">
        {loading && <p className="aep-loading">Loading…</p>}
        {!loading && topics.length === 0 && <p className="aep-empty">No topics yet. Add your first ECG topic.</p>}
        {topics.map((t, idx) => (
          <div key={t.id} className={`aep-topic ${t.is_active ? '' : 'aep-topic--inactive'}`}>
            <div className="aep-topic-num">{String(idx + 1).padStart(2, '0')}</div>
            <div className="aep-topic-main">
              <div className="aep-topic-title-row">
                <h3 className="aep-topic-title">{t.title}</h3>
                <span className={`aep-status aep-status--${t.is_active ? 'active' : 'hidden'}`}>
                  {t.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
              {t.description && <p className="aep-topic-desc">{t.description}</p>}
              <span className="aep-topic-count">{Number(t.card_count ?? 0)} ECG{Number(t.card_count) === 1 ? '' : 's'}</span>
            </div>
            <div className="aep-topic-actions">
              <button className="aep-btn aep-btn--primary aep-btn--sm" onClick={() => setActiveTopic(t)}>
                Manage ECGs
              </button>
              <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => setTopicModal({ mode: 'edit', topic: t })}>
                Edit
              </button>
              <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => handleToggleTopic(t.id)}>
                {t.is_active ? 'Hide' : 'Show'}
              </button>
              <button className="aep-btn aep-btn--danger aep-btn--sm" onClick={() => handleDeleteTopic(t)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {topicModal && (
        <EcgTopicModal
          mode={topicModal.mode}
          topic={topicModal.topic}
          onClose={() => setTopicModal(null)}
          onSaved={() => { setTopicModal(null); void load(); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────── Topic create/edit modal ─────────────────────── */
function EcgTopicModal({ mode, topic, onClose, onSaved }) {
  const [title, setTitle] = useState(topic?.title || '');
  const [description, setDescription] = useState(topic?.description || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = { title: title.trim(), description: description.trim() || null, position: topic?.position };
      if (mode === 'edit') await adminUpdateEcgTopic(topic.id, payload);
      else await adminCreateEcgTopic(payload);
      onSaved();
    } catch (e2) {
      setErr(getErrorMessage(e2));
      setSaving(false);
    }
  }

  return (
    <div className="aep-modal-overlay" onClick={onClose}>
      <form className="aep-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="aep-modal-title">{mode === 'edit' ? 'Edit Topic' : 'New Topic'}</h2>
        <label className="aep-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ST Elevation (STEMI)" autoFocus />
        </label>
        <label className="aep-field">
          <span>Description (optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Short summary shown under the topic title" />
        </label>
        {err && <p className="aep-error">{err}</p>}
        <div className="aep-modal-actions">
          <button type="button" className="aep-btn aep-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="aep-btn aep-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────── Cards manager (per topic) ─────────────────────── */
function EcgCardsManager({ topic, onBack }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cardModal, setCardModal] = useState(null); // null | { mode, card? }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListEcgCards(topic.id);
      setCards(res.cards || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [topic.id]);

  useEffect(() => { void load(); }, [load]);

  async function handleToggle(id) { await adminToggleEcgCard(id); void load(); }
  async function handleDelete(c) {
    if (!confirm(`Delete ECG "${c.title}"?`)) return;
    await adminDeleteEcgCard(c.id);
    void load();
  }

  return (
    <div className="aep-root">
      <button className="aep-back" onClick={onBack}>‹ All topics</button>
      <div className="aep-header">
        <div>
          <h1 className="aep-title">{topic.title}</h1>
          <p className="aep-sub">{cards.length} ECG{cards.length === 1 ? '' : 's'} in this topic</p>
        </div>
        <button className="aep-btn aep-btn--primary" onClick={() => setCardModal({ mode: 'create' })}>
          + Add ECG
        </button>
      </div>

      {error && <p className="aep-error">{error}</p>}

      <div className="aep-card-grid">
        {loading && <p className="aep-loading">Loading…</p>}
        {!loading && cards.length === 0 && <p className="aep-empty">No ECGs yet. Add the first one.</p>}
        {cards.map((c) => (
          <div key={c.id} className={`aep-card ${c.is_active ? '' : 'aep-card--inactive'}`}>
            <div className="aep-card-thumb">
              {c.image_url
                ? <img src={c.image_url} alt={c.title} />
                : <span className="aep-card-noimg">No image</span>}
            </div>
            <div className="aep-card-body">
              <div className="aep-card-title-row">
                <h4 className="aep-card-title">{c.title}</h4>
                <span className={`aep-status aep-status--${c.is_active ? 'active' : 'hidden'}`}>
                  {c.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
              {c.explanation && <p className="aep-card-explanation">{c.explanation}</p>}
              <div className="aep-card-actions">
                <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => setCardModal({ mode: 'edit', card: c })}>Edit</button>
                <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => handleToggle(c.id)}>{c.is_active ? 'Hide' : 'Show'}</button>
                <button className="aep-btn aep-btn--danger aep-btn--sm" onClick={() => handleDelete(c)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cardModal && (
        <EcgCardModal
          mode={cardModal.mode}
          card={cardModal.card}
          topicId={topic.id}
          onClose={() => setCardModal(null)}
          onSaved={() => { setCardModal(null); void load(); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────── Card create/edit modal ─────────────────────── */
function EcgCardModal({ mode, card, topicId, onClose, onSaved }) {
  const [title, setTitle] = useState(card?.title || '');
  const [explanation, setExplanation] = useState(card?.explanation || '');
  const [imageUrl, setImageUrl] = useState(card?.image_url || '');
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setOptimizing(true);
    setErr(null);
    try {
      const result = await optimizeImageFile(file);
      setImageUrl(result.src);
    } catch (e2) {
      setErr('Image failed: ' + getErrorMessage(e2));
    } finally {
      setOptimizing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        topic_id: topicId,
        title: title.trim(),
        image_url: imageUrl || null,
        explanation: explanation.trim() || null,
        position: card?.position,
      };
      if (mode === 'edit') await adminUpdateEcgCard(card.id, payload);
      else await adminCreateEcgCard(payload);
      onSaved();
    } catch (e2) {
      setErr(getErrorMessage(e2));
      setSaving(false);
    }
  }

  return (
    <div className="aep-modal-overlay" onClick={onClose}>
      <form className="aep-modal aep-modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="aep-modal-title">{mode === 'edit' ? 'Edit ECG' : 'New ECG'}</h2>

        <label className="aep-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Anterior STEMI" autoFocus />
        </label>

        <div className="aep-field">
          <span>ECG Image</span>
          <div className="aep-image-upload">
            {imageUrl ? (
              <div className="aep-image-preview">
                <img src={imageUrl} alt="ECG preview" />
                <button type="button" className="aep-image-remove" onClick={() => setImageUrl('')}>Remove</button>
              </div>
            ) : (
              <label className="aep-image-drop">
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} disabled={optimizing} />
                {optimizing ? 'Optimizing…' : 'Click to upload an ECG image'}
              </label>
            )}
          </div>
        </div>

        <label className="aep-field">
          <span>Explanation</span>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={5}
            placeholder="Describe the findings — what to look for and why it matters." />
        </label>

        {err && <p className="aep-error">{err}</p>}
        <div className="aep-modal-actions">
          <button type="button" className="aep-btn aep-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="aep-btn aep-btn--primary" disabled={saving || optimizing}>
            {saving ? 'Saving…' : 'Save ECG'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────── Quiz manager ─────────────────────── */
function EcgQuizManager() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode, question? }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListEcgQuiz();
      setQuestions(res.questions || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleToggle(id) { await adminToggleEcgQuiz(id); void load(); }
  async function handleDelete(q) {
    if (!confirm('Delete this quiz question?')) return;
    await adminDeleteEcgQuiz(q.id);
    void load();
  }

  return (
    <>
      <div className="aep-quiz-head">
        <p className="aep-sub">{questions.length} question{questions.length === 1 ? '' : 's'}</p>
        <button className="aep-btn aep-btn--primary" onClick={() => setModal({ mode: 'create' })}>
          + Add Question
        </button>
      </div>

      {error && <p className="aep-error">{error}</p>}

      <div className="aep-card-grid">
        {loading && <p className="aep-loading">Loading…</p>}
        {!loading && questions.length === 0 && <p className="aep-empty">No quiz questions yet. Add the first one.</p>}
        {questions.map((q) => {
          const correct = (q.options || []).find((o) => o.correct);
          return (
            <div key={q.id} className={`aep-card ${q.is_active ? '' : 'aep-card--inactive'}`}>
              <div className="aep-card-thumb">
                {q.image_url ? <img src={q.image_url} alt="ECG" /> : <span className="aep-card-noimg">No image</span>}
              </div>
              <div className="aep-card-body">
                <div className="aep-card-title-row">
                  <h4 className="aep-card-title">{q.question_text}</h4>
                  <span className={`aep-status aep-status--${q.is_active ? 'active' : 'hidden'}`}>
                    {q.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="aep-quiz-options-preview">
                  {(q.options || []).map((o, i) => (
                    <span key={i} className={`aep-quiz-opt ${o.correct ? 'is-correct' : ''}`}>
                      {o.correct ? '✓ ' : ''}{o.text}
                    </span>
                  ))}
                </div>
                <div className="aep-card-actions">
                  <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => setModal({ mode: 'edit', question: q })}>Edit</button>
                  <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => handleToggle(q.id)}>{q.is_active ? 'Hide' : 'Show'}</button>
                  <button className="aep-btn aep-btn--danger aep-btn--sm" onClick={() => handleDelete(q)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <EcgQuizModal
          mode={modal.mode}
          question={modal.question}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); void load(); }}
        />
      )}
    </>
  );
}

/* ─────────────────────── Quiz create/edit modal ─────────────────────── */
function EcgQuizModal({ mode, question, onClose, onSaved }) {
  const [questionText, setQuestionText] = useState(question?.question_text || 'What does this ECG show?');
  const [imageUrl, setImageUrl] = useState(question?.image_url || '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const initialOptions = question?.options?.length
    ? question.options.map((o) => ({ text: o.text, correct: !!o.correct }))
    : [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }];
  const [options, setOptions] = useState(initialOptions);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setOptimizing(true);
    setErr(null);
    try {
      const result = await optimizeImageFile(file);
      setImageUrl(result.src);
    } catch (e2) {
      setErr('Image failed: ' + getErrorMessage(e2));
    } finally {
      setOptimizing(false);
    }
  }

  function setOptionText(i, text) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, text } : o)));
  }
  function setCorrect(i) {
    setOptions((prev) => prev.map((o, idx) => ({ ...o, correct: idx === i })));
  }
  function addOption() {
    setOptions((prev) => [...prev, { text: '', correct: false }]);
  }
  function removeOption(i) {
    setOptions((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (!next.some((o) => o.correct) && next.length) next[0].correct = true;
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleaned = options.map((o) => ({ text: o.text.trim(), correct: o.correct })).filter((o) => o.text);
    if (cleaned.length < 2) { setErr('Add at least 2 options'); return; }
    if (!cleaned.some((o) => o.correct)) { setErr('Mark one option as correct'); return; }
    if (!imageUrl) { setErr('An ECG image is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        question_text: questionText.trim() || 'What does this ECG show?',
        image_url: imageUrl,
        options: cleaned,
        explanation: explanation.trim() || null,
        position: question?.position,
      };
      if (mode === 'edit') await adminUpdateEcgQuiz(question.id, payload);
      else await adminCreateEcgQuiz(payload);
      onSaved();
    } catch (e2) {
      setErr(getErrorMessage(e2));
      setSaving(false);
    }
  }

  return (
    <div className="aep-modal-overlay" onClick={onClose}>
      <form className="aep-modal aep-modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="aep-modal-title">{mode === 'edit' ? 'Edit Question' : 'New Quiz Question'}</h2>

        <div className="aep-field">
          <span>ECG Image</span>
          <div className="aep-image-upload">
            {imageUrl ? (
              <div className="aep-image-preview">
                <img src={imageUrl} alt="ECG preview" />
                <button type="button" className="aep-image-remove" onClick={() => setImageUrl('')}>Remove</button>
              </div>
            ) : (
              <label className="aep-image-drop">
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} disabled={optimizing} />
                {optimizing ? 'Optimizing…' : 'Click to upload an ECG image'}
              </label>
            )}
          </div>
        </div>

        <label className="aep-field">
          <span>Question</span>
          <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="What does this ECG show?" />
        </label>

        <div className="aep-field">
          <span>Options <small className="aep-hint">(select the correct one)</small></span>
          <div className="aep-quiz-opts">
            {options.map((o, i) => (
              <div key={i} className="aep-quiz-opt-row">
                <input
                  type="radio"
                  name="ecg-correct"
                  checked={o.correct}
                  onChange={() => setCorrect(i)}
                  title="Mark as correct answer"
                />
                <input
                  className="aep-quiz-opt-input"
                  value={o.text}
                  onChange={(e) => setOptionText(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                {options.length > 2 && (
                  <button type="button" className="aep-quiz-opt-del" onClick={() => removeOption(i)} aria-label="Remove option">✕</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="aep-btn aep-btn--ghost aep-btn--sm aep-quiz-add-opt" onClick={addOption}>
            + Add option
          </button>
        </div>

        <label className="aep-field">
          <span>Explanation (optional)</span>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3}
            placeholder="Shown after the student answers." />
        </label>

        {err && <p className="aep-error">{err}</p>}
        <div className="aep-modal-actions">
          <button type="button" className="aep-btn aep-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="aep-btn aep-btn--primary" disabled={saving || optimizing}>
            {saving ? 'Saving…' : 'Save Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
