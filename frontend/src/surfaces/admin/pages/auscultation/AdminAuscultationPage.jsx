import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminListAuscTopics, adminCreateAuscTopic, adminUpdateAuscTopic,
  adminToggleAuscTopic, adminDeleteAuscTopic,
  adminListAuscCards, adminCreateAuscCard, adminUpdateAuscCard,
  adminToggleAuscCard, adminDeleteAuscCard,
  adminListAuscSounds,
  adminListAuscQuiz, adminCreateAuscQuiz, adminUpdateAuscQuiz,
  adminToggleAuscQuiz, adminDeleteAuscQuiz,
} from '../../../../shared/api/auscultation.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { HeartIcon, LungIcon, SpeakerIcon, AlertIcon } from '../../../app/student/auscultation/components/icons.jsx';
import '../ecg/AdminEcgPage.css';
import './AdminAuscultationPage.css';

function AudioBadge({ has }) {
  return (
    <span className={`auscadm-audio-badge ${has ? 'has' : 'no'}`}>
      {has ? <SpeakerIcon size={13} /> : <AlertIcon size={13} />}
      {has ? 'Audio attached' : 'No audio'}
    </span>
  );
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

function readAudioFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read audio file'));
    reader.readAsDataURL(file);
  });
}

function CategoryFilter({ value, onChange }) {
  return (
    <div className="auscadm-cat">
      <button className={`auscadm-cat-btn ${value === 'heart' ? 'is-active' : ''}`} onClick={() => onChange('heart')}><HeartIcon size={15} /> Heart</button>
      <button className={`auscadm-cat-btn ${value === 'lung' ? 'is-active' : ''}`} onClick={() => onChange('lung')}><LungIcon size={15} /> Lung</button>
    </div>
  );
}

export function AdminAuscultationPage() {
  const [tab, setTab] = useState('topics'); // 'topics' | 'quiz'
  const [category, setCategory] = useState('heart');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topicModal, setTopicModal] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminListAuscTopics(category);
      setTopics(res.topics || []);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { if (tab === 'topics') void load(); }, [load, tab]);

  async function handleToggleTopic(id) { await adminToggleAuscTopic(id); void load(); }
  async function handleDeleteTopic(t) {
    if (!confirm(`Delete topic "${t.title}" and all its sounds? This cannot be undone.`)) return;
    await adminDeleteAuscTopic(t.id); void load();
  }

  if (activeTopic) {
    return <AuscCardsManager topic={activeTopic} onBack={() => { setActiveTopic(null); void load(); }} />;
  }

  return (
    <div className="aep-root">
      <div className="aep-header">
        <div>
          <h1 className="aep-title">Auscultation</h1>
          <p className="aep-sub">Heart &amp; lung sounds</p>
        </div>
        {tab === 'topics' && (
          <button className="aep-btn aep-btn--primary" onClick={() => setTopicModal({ mode: 'create' })}>+ Add Topic</button>
        )}
      </div>

      <div className="aep-tabs">
        <button className={`aep-tab ${tab === 'topics' ? 'is-active' : ''}`} onClick={() => setTab('topics')}>Topics &amp; Sounds</button>
        <button className={`aep-tab ${tab === 'quiz' ? 'is-active' : ''}`} onClick={() => setTab('quiz')}>Quiz</button>
      </div>

      <CategoryFilter value={category} onChange={setCategory} />

      {tab === 'quiz' ? (
        <AuscQuizManager category={category} />
      ) : (
        <>
          {error && <p className="aep-error">{error}</p>}
          <div className="aep-topic-grid">
            {loading && <p className="aep-loading">Loading…</p>}
            {!loading && topics.length === 0 && <p className="aep-empty">No {category} topics yet.</p>}
            {topics.map((t, idx) => (
              <div key={t.id} className={`aep-topic ${t.is_active ? '' : 'aep-topic--inactive'}`}>
                <div className="aep-topic-num">{String(idx + 1).padStart(2, '0')}</div>
                <div className="aep-topic-main">
                  <div className="aep-topic-title-row">
                    <h3 className="aep-topic-title">{t.title}</h3>
                    <span className={`aep-status aep-status--${t.is_active ? 'active' : 'hidden'}`}>{t.is_active ? 'Active' : 'Hidden'}</span>
                  </div>
                  {t.description && <p className="aep-topic-desc">{t.description}</p>}
                  <span className="aep-topic-count">{Number(t.card_count ?? 0)} sound{Number(t.card_count) === 1 ? '' : 's'}</span>
                </div>
                <div className="aep-topic-actions">
                  <button className="aep-btn aep-btn--primary aep-btn--sm" onClick={() => setActiveTopic(t)}>Manage Sounds</button>
                  <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => setTopicModal({ mode: 'edit', topic: t })}>Edit</button>
                  <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => handleToggleTopic(t.id)}>{t.is_active ? 'Hide' : 'Show'}</button>
                  <button className="aep-btn aep-btn--danger aep-btn--sm" onClick={() => handleDeleteTopic(t)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {topicModal && (
        <AuscTopicModal
          mode={topicModal.mode} topic={topicModal.topic} defaultCategory={category}
          onClose={() => setTopicModal(null)}
          onSaved={() => { setTopicModal(null); void load(); }}
        />
      )}
    </div>
  );
}

/* ── Topic modal ── */
function AuscTopicModal({ mode, topic, defaultCategory, onClose, onSaved }) {
  const [title, setTitle] = useState(topic?.title || '');
  const [description, setDescription] = useState(topic?.description || '');
  const [cat, setCat] = useState(topic?.category || defaultCategory || 'heart');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { category: cat, title: title.trim(), description: description.trim() || null, position: topic?.position };
      if (mode === 'edit') await adminUpdateAuscTopic(topic.id, payload);
      else await adminCreateAuscTopic(payload);
      onSaved();
    } catch (e2) { setErr(getErrorMessage(e2)); setSaving(false); }
  }

  return (
    <div className="aep-modal-overlay" onClick={onClose}>
      <form className="aep-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="aep-modal-title">{mode === 'edit' ? 'Edit Topic' : 'New Topic'}</h2>
        <label className="aep-field">
          <span>Category</span>
          <div className="auscadm-cat auscadm-cat--inline">
            <button type="button" className={`auscadm-cat-btn ${cat === 'heart' ? 'is-active' : ''}`} onClick={() => setCat('heart')}><HeartIcon size={15} /> Heart</button>
            <button type="button" className={`auscadm-cat-btn ${cat === 'lung' ? 'is-active' : ''}`} onClick={() => setCat('lung')}><LungIcon size={15} /> Lung</button>
          </div>
        </label>
        <label className="aep-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mitral Stenosis" autoFocus />
        </label>
        <label className="aep-field">
          <span>Description (optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Short summary under the topic title" />
        </label>
        {err && <p className="aep-error">{err}</p>}
        <div className="aep-modal-actions">
          <button type="button" className="aep-btn aep-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="aep-btn aep-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

/* ── Cards manager ── */
function AuscCardsManager({ topic, onBack }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await adminListAuscCards(topic.id); setCards(res.cards || []); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [topic.id]);
  useEffect(() => { void load(); }, [load]);

  async function handleToggle(id) { await adminToggleAuscCard(id); void load(); }
  async function handleDelete(c) { if (!confirm(`Delete sound "${c.title}"?`)) return; await adminDeleteAuscCard(c.id); void load(); }

  return (
    <div className="aep-root">
      <button className="aep-back" onClick={onBack}>‹ All topics</button>
      <div className="aep-header">
        <div>
          <h1 className="aep-title">{topic.title}</h1>
          <p className="aep-sub">{cards.length} sound{cards.length === 1 ? '' : 's'} · {topic.category}</p>
        </div>
        <button className="aep-btn aep-btn--primary" onClick={() => setModal({ mode: 'create' })}>+ Add Sound</button>
      </div>
      {error && <p className="aep-error">{error}</p>}
      <div className="aep-card-grid">
        {loading && <p className="aep-loading">Loading…</p>}
        {!loading && cards.length === 0 && <p className="aep-empty">No sounds yet. Add the first one.</p>}
        {cards.map((c) => (
          <div key={c.id} className={`aep-card ${c.is_active ? '' : 'aep-card--inactive'}`}>
            <div className="aep-card-body">
              <div className="aep-card-title-row">
                <h4 className="aep-card-title">{c.title}</h4>
                <span className={`aep-status aep-status--${c.is_active ? 'active' : 'hidden'}`}>{c.is_active ? 'Active' : 'Hidden'}</span>
              </div>
              <AudioBadge has={c.hasAudio} />
              {c.explanation && <p className="aep-card-explanation">{c.explanation}</p>}
              <div className="aep-card-actions">
                <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => setModal({ mode: 'edit', card: c })}>Edit</button>
                <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => handleToggle(c.id)}>{c.is_active ? 'Hide' : 'Show'}</button>
                <button className="aep-btn aep-btn--danger aep-btn--sm" onClick={() => handleDelete(c)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <AuscCardModal mode={modal.mode} card={modal.card} topicId={topic.id}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />
      )}
    </div>
  );
}

/* ── Audio upload field (shared by card + quiz modals) ── */
function AudioUploadField({ hasExisting, audioDataUrl, onPicked, onClear }) {
  const previewUrl = useRef(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_AUDIO_BYTES) { setErr('Audio is too large (max 5 MB).'); return; }
    setErr(null);
    setName(file.name);
    const dataUrl = await readAudioFile(file);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(file);
    onPicked(dataUrl);
  }

  return (
    <div className="aep-field">
      <span>Audio clip {hasExisting && !audioDataUrl ? '(replace optional)' : ''}</span>
      {audioDataUrl ? (
        <div className="auscadm-audio-picked">
          <audio controls src={audioDataUrl} className="auscadm-audio-el" />
          <div className="auscadm-audio-row">
            <span className="auscadm-audio-name">{name || 'New clip selected'}</span>
            <button type="button" className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => { onClear(); setName(''); }}>Remove</button>
          </div>
        </div>
      ) : (
        <>
          {hasExisting && (
            <span className="auscadm-audio-badge has" style={{ marginBottom: 6 }}>
              <SpeakerIcon size={13} /> Current audio kept (upload to replace)
            </span>
          )}
          <label className="aep-image-drop">
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/*" style={{ display: 'none' }} onChange={handleFile} />
            Click to upload audio (MP3 / M4A / WAV / OGG, max 5 MB)
          </label>
        </>
      )}
      {err && <small className="aep-error">{err}</small>}
    </div>
  );
}

/* ── Card modal ── */
function AuscCardModal({ mode, card, topicId, onClose, onSaved }) {
  const [title, setTitle] = useState(card?.title || '');
  const [explanation, setExplanation] = useState(card?.explanation || '');
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    if (mode === 'create' && !audioDataUrl) { setErr('Please upload an audio clip'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { topic_id: topicId, title: title.trim(), explanation: explanation.trim() || null, position: card?.position };
      if (audioDataUrl) payload.audio_data_url = audioDataUrl;
      if (mode === 'edit') await adminUpdateAuscCard(card.id, payload);
      else await adminCreateAuscCard(payload);
      onSaved();
    } catch (e2) { setErr(getErrorMessage(e2)); setSaving(false); }
  }

  return (
    <div className="aep-modal-overlay" onClick={onClose}>
      <form className="aep-modal aep-modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="aep-modal-title">{mode === 'edit' ? 'Edit Sound' : 'New Sound'}</h2>
        <label className="aep-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-diastolic murmur" autoFocus />
        </label>
        <AudioUploadField hasExisting={!!card?.hasAudio} audioDataUrl={audioDataUrl}
          onPicked={setAudioDataUrl} onClear={() => setAudioDataUrl('')} />
        <label className="aep-field">
          <span>Explanation</span>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={5} placeholder="What to listen for and why it matters." />
        </label>
        {err && <p className="aep-error">{err}</p>}
        <div className="aep-modal-actions">
          <button type="button" className="aep-btn aep-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="aep-btn aep-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Sound'}</button>
        </div>
      </form>
    </div>
  );
}

/* ── Quiz manager ── */
function AuscQuizManager({ category }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await adminListAuscQuiz(category); setQuestions(res.questions || []); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  async function handleToggle(id) { await adminToggleAuscQuiz(id); void load(); }
  async function handleDelete(q) { if (!confirm('Delete this quiz question?')) return; await adminDeleteAuscQuiz(q.id); void load(); }

  return (
    <>
      <div className="aep-quiz-head">
        <p className="aep-sub">{questions.length} {category} question{questions.length === 1 ? '' : 's'}</p>
        <button className="aep-btn aep-btn--primary" onClick={() => setModal({ mode: 'create' })}>+ Add Question</button>
      </div>
      {error && <p className="aep-error">{error}</p>}
      <div className="aep-card-grid">
        {loading && <p className="aep-loading">Loading…</p>}
        {!loading && questions.length === 0 && <p className="aep-empty">No {category} quiz questions yet.</p>}
        {questions.map((q) => (
          <div key={q.id} className={`aep-card ${q.is_active ? '' : 'aep-card--inactive'}`}>
            <div className="aep-card-body">
              <div className="aep-card-title-row">
                <h4 className="aep-card-title">{q.question_text}</h4>
                <span className={`aep-status aep-status--${q.is_active ? 'active' : 'hidden'}`}>{q.is_active ? 'Active' : 'Hidden'}</span>
              </div>
              <AudioBadge has={q.hasAudio} />
              <div className="aep-quiz-options-preview">
                {(q.options || []).map((o, i) => (
                  <span key={i} className={`aep-quiz-opt ${o.correct ? 'is-correct' : ''}`}>{o.correct ? '✓ ' : ''}{o.text}</span>
                ))}
              </div>
              <div className="aep-card-actions">
                <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => setModal({ mode: 'edit', question: q })}>Edit</button>
                <button className="aep-btn aep-btn--ghost aep-btn--sm" onClick={() => handleToggle(q.id)}>{q.is_active ? 'Hide' : 'Show'}</button>
                <button className="aep-btn aep-btn--danger aep-btn--sm" onClick={() => handleDelete(q)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <AuscQuizModal mode={modal.mode} question={modal.question} category={category}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />
      )}
    </>
  );
}

/* ── Quiz modal ── */
function AuscQuizModal({ mode, question, category, onClose, onSaved }) {
  const [questionText, setQuestionText] = useState(question?.question_text || 'What is this sound?');
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const initial = question?.options?.length
    ? question.options.map((o) => ({ text: o.text, correct: !!o.correct }))
    : [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }];
  const [options, setOptions] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Audio source: reuse an existing sound, or upload a new clip
  const [audioMode, setAudioMode] = useState(
    question?.source_card_id ? 'reuse' : (question?.hasAudio ? 'upload' : 'reuse'),
  );
  const [sourceCardId, setSourceCardId] = useState(question?.source_card_id ? String(question.source_card_id) : '');
  const [sounds, setSounds] = useState([]);
  const [soundsLoading, setSoundsLoading] = useState(true);

  useEffect(() => {
    adminListAuscSounds(category)
      .then((res) => setSounds(res.sounds || []))
      .catch(() => setSounds([]))
      .finally(() => setSoundsLoading(false));
  }, [category]);

  function setOptionText(i, text) { setOptions((p) => p.map((o, idx) => idx === i ? { ...o, text } : o)); }
  function setCorrect(i) { setOptions((p) => p.map((o, idx) => ({ ...o, correct: idx === i }))); }
  function addOption() { setOptions((p) => [...p, { text: '', correct: false }]); }
  function removeOption(i) { setOptions((p) => { const n = p.filter((_, idx) => idx !== i); if (!n.some((o) => o.correct) && n.length) n[0].correct = true; return n; }); }

  function pickSound(id) {
    setSourceCardId(id);
    const snd = sounds.find((s) => String(s.id) === String(id));
    // Convenience: if options are still blank, prefill the correct answer with the sound's name
    if (snd && options.every((o) => !o.text.trim())) {
      setOptions((p) => p.map((o, idx) => idx === 0 ? { text: snd.title, correct: true } : { ...o, correct: false }));
    }
  }

  async function submit(e) {
    e.preventDefault();
    const cleaned = options.map((o) => ({ text: o.text.trim(), correct: o.correct })).filter((o) => o.text);
    if (cleaned.length < 2) { setErr('Add at least 2 options'); return; }
    if (!cleaned.some((o) => o.correct)) { setErr('Mark one option as correct'); return; }
    if (mode === 'create') {
      if (audioMode === 'upload' && !audioDataUrl) { setErr('Please upload an audio clip'); return; }
      if (audioMode === 'reuse' && !sourceCardId) { setErr('Please choose an existing sound'); return; }
    }
    setSaving(true); setErr(null);
    try {
      const payload = { category, question_text: questionText.trim() || 'What is this sound?', options: cleaned, explanation: explanation.trim() || null, position: question?.position };
      if (audioMode === 'upload' && audioDataUrl) payload.audio_data_url = audioDataUrl;
      else if (audioMode === 'reuse' && sourceCardId) payload.source_card_id = Number(sourceCardId);
      if (mode === 'edit') await adminUpdateAuscQuiz(question.id, payload);
      else await adminCreateAuscQuiz(payload);
      onSaved();
    } catch (e2) { setErr(getErrorMessage(e2)); setSaving(false); }
  }

  return (
    <div className="aep-modal-overlay" onClick={onClose}>
      <form className="aep-modal aep-modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="aep-modal-title">{mode === 'edit' ? 'Edit Question' : 'New Quiz Question'} · {category}</h2>

        <div className="aep-field">
          <span>Sound</span>
          <div className="auscadm-source-toggle">
            <button type="button" className={`auscadm-source-btn ${audioMode === 'reuse' ? 'is-active' : ''}`} onClick={() => setAudioMode('reuse')}>Reuse existing</button>
            <button type="button" className={`auscadm-source-btn ${audioMode === 'upload' ? 'is-active' : ''}`} onClick={() => setAudioMode('upload')}>Upload new</button>
          </div>
          {audioMode === 'reuse' ? (
            soundsLoading ? <small className="aep-hint">Loading sounds…</small>
            : sounds.length === 0 ? <small className="aep-hint">No {category} sounds added yet — add sounds under a topic, or upload new.</small>
            : (
              <select className="auscadm-sound-select" value={sourceCardId} onChange={(e) => pickSound(e.target.value)}>
                <option value="">Choose a sound…</option>
                {sounds.map((s) => (
                  <option key={s.id} value={s.id}>{s.topicTitle} — {s.title}</option>
                ))}
              </select>
            )
          ) : (
            <AudioUploadField hasExisting={!!question?.hasAudio} audioDataUrl={audioDataUrl}
              onPicked={setAudioDataUrl} onClear={() => setAudioDataUrl('')} />
          )}
        </div>

        <label className="aep-field">
          <span>Question</span>
          <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="What is this sound?" />
        </label>
        <div className="aep-field">
          <span>Options <small className="aep-hint">(select the correct one)</small></span>
          <div className="aep-quiz-opts">
            {options.map((o, i) => (
              <div key={i} className="aep-quiz-opt-row">
                <input type="radio" name="ausc-correct" checked={o.correct} onChange={() => setCorrect(i)} title="Correct answer" />
                <input className="aep-quiz-opt-input" value={o.text} onChange={(e) => setOptionText(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                {options.length > 2 && <button type="button" className="aep-quiz-opt-del" onClick={() => removeOption(i)} aria-label="Remove">✕</button>}
              </div>
            ))}
          </div>
          <button type="button" className="aep-btn aep-btn--ghost aep-btn--sm aep-quiz-add-opt" onClick={addOption}>+ Add option</button>
        </div>
        <label className="aep-field">
          <span>Explanation (optional)</span>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} placeholder="Shown after the student answers." />
        </label>
        {err && <p className="aep-error">{err}</p>}
        <div className="aep-modal-actions">
          <button type="button" className="aep-btn aep-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="aep-btn aep-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button>
        </div>
      </form>
    </div>
  );
}
