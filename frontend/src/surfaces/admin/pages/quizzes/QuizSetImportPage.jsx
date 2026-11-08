import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createQuiz, fetchQuizzesMeta } from '../../../../shared/api/quizzes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { retryOnRateLimit } from '../../../../shared/utils/retryOnRateLimit.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import {
  normalizeWhitespace,
  parseJsonQuestions,
  resolveQuestion,
  saveQuestionRecord,
  validateQuestion,
} from '../questions/bulkQuestionInputUtils.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** "Medicine_Set-03.json" -> "Medicine Set 03" */
function nameFromFile(fileName) {
  return String(fileName || '')
    .replace(/\.json$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const toId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function readMeta(payload = {}) {
  const courses = (payload.courses || []).map((c) => ({
    id: toId(c.id),
    title: String(c.courseTitle ?? c.course_title ?? c.title ?? c.name ?? '').trim(),
  })).filter((c) => c.id);
  const subjects = (payload.subjects || []).map((s) => ({
    id: toId(s.id),
    courseId: toId(s.courseId ?? s.course_id),
    name: String(s.subjectName ?? s.topic_name ?? s.name ?? '').trim(),
  })).filter((s) => s.id);
  const papers = (payload.papers || []).map((p) => ({
    id: toId(p.id),
    courseId: toId(p.courseId ?? p.course_id),
    title: String(p.paperTitle ?? p.paper_title ?? p.title ?? '').trim(),
  })).filter((p) => p.id);
  const categories = Array.from(new Set(['mock', 'past_paper', ...(payload.categories || []).filter(Boolean)]));
  return { courses, subjects, papers, categories };
}

const STATE_LABEL = {
  queued: 'Waiting',
  saving: 'Saving…',
  done: 'Created',
  failed: 'Failed',
  blocked: 'Blocked',
};

/**
 * Many JSON files -> many assessments. Each file becomes one assessment named
 * after the file, filed under one course/subject chosen once. Questions are
 * saved with the same checker and save code as the bulk question tool, and the
 * assessments are created as DRAFTS (never live, so nothing is announced to
 * students until each one is published).
 */
export function QuizSetImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const stopRef = useRef(false);
  const [meta, setMeta] = useState({ courses: [], subjects: [], papers: [], categories: ['mock', 'past_paper'] });
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [category, setCategory] = useState('mock');
  const [sets, setSets] = useState([]);
  const [busy, setBusy] = useState(false);
  // Live progress of a running import, and how the last one ended.
  const [progress, setProgress] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuizzesMeta()
      .then((payload) => setMeta(readMeta(payload)))
      .catch((err) => setError(getErrorMessage(err, 'Unable to load courses')));
  }, []);

  const subjects = useMemo(
    () => meta.subjects.filter((s) => !courseId || s.courseId === Number(courseId)),
    [meta.subjects, courseId],
  );
  const papers = useMemo(
    () => meta.papers.filter((p) => !courseId || !p.courseId || p.courseId === Number(courseId)),
    [meta.papers, courseId],
  );

  const defaults = useMemo(() => ({
    courseId, subjectId, topicId: '', lessonId: '', category, questionType: 'sba',
    paperId, keywordsText: '', courseWide: !subjectId,
  }), [courseId, subjectId, category, paperId]);

  const patchSet = (key, patch) => setSets((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const summarise = (questions) => {
    const dup = new Map();
    for (const q of questions) {
      const k = normalizeWhitespace(q.questionText).toLowerCase();
      if (k) dup.set(k, (dup.get(k) || 0) + 1);
    }
    let ready = 0; let review = 0; let blocked = 0;
    for (const q of questions) {
      const v = validateQuestion(q, resolveQuestion(q, defaults, false), dup);
      if (!v.canSave) blocked += 1;
      else if (v.isReady) ready += 1;
      else review += 1;
    }
    return { ready, review, blocked };
  };

  const choose = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    const added = [];
    for (const file of files) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      const entry = { key, fileName: file.name, name: nameFromFile(file.name), questions: [], state: 'queued', message: '', saved: 0 };
      if (!/\.json$/i.test(file.name)) {
        added.push({ ...entry, state: 'blocked', message: 'Not a .json file.' });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        added.push({ ...entry, state: 'blocked', message: 'File is over 4 MB.' });
        continue;
      }
      try {
        const questions = parseJsonQuestions(await file.text(), defaults);
        added.push(questions.length
          ? { ...entry, questions }
          : { ...entry, state: 'blocked', message: 'No questions found in this file.' });
      } catch (err) {
        added.push({ ...entry, state: 'blocked', message: getErrorMessage(err, 'Could not read this file.') });
      }
    }
    setSets((current) => {
      const known = new Set(current.map((s) => s.key));
      return [...current, ...added.filter((s) => !known.has(s.key))]
        .sort((a, b) => collator.compare(a.fileName, b.fileName));
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const rows = useMemo(() => sets.map((s) => ({ ...s, ...summarise(s.questions) })), [sets, defaults]); // eslint-disable-line react-hooks/exhaustive-deps
  const importable = rows.filter((r) => r.state === 'queued' || r.state === 'failed');
  const namesOk = importable.every((r) => r.name.trim());
  const canRun = Boolean(courseId) && importable.length > 0 && namesOk && !busy;

  async function runOne(setEntry) {
    patchSet(setEntry.key, { state: 'saving', message: '', saved: 0 });
    const questions = [...setEntry.questions];
    const dup = new Map();
    for (const q of questions) {
      const k = normalizeWhitespace(q.questionText).toLowerCase();
      if (k) dup.set(k, (dup.get(k) || 0) + 1);
    }
    const issues = [];
    const ids = [];
    for (let i = 0; i < questions.length; i += 1) {
      if (stopRef.current) throw new Error('Stopped.');
      const q = questions[i];
      const resolved = resolveQuestion(q, defaults, false);
      if (!validateQuestion(q, resolved, dup).canSave) {
        issues.push(`Q${i + 1} skipped (needs fixing)`);
        continue;
      }
      try {
        // Re-running a failed set updates the questions it already saved
        // instead of creating them twice.
        const saved = await saveQuestionRecord({ question: q, resolved });
        questions[i] = { ...q, savedId: saved.savedId, lastSavedHash: saved.signature };
        ids.push(saved.savedId);
        patchSet(setEntry.key, { saved: ids.length });
        setProgress((p) => (p ? { ...p, saved: ids.length } : p));
      } catch (err) {
        issues.push(`Q${i + 1}: ${getErrorMessage(err, 'could not save')}`);
      }
    }
    patchSet(setEntry.key, { questions });
    if (!ids.length) throw new Error(issues.join(' | ') || 'No question could be saved.');

    const title = setEntry.name.trim();
    await retryOnRateLimit(() => createQuiz({
      courseId: Number(courseId),
      topicId: subjectId ? Number(subjectId) : null,
      subtopicId: null,
      lessonId: null,
      paperId: paperId ? Number(paperId) : null,
      category,
      collectionTags: '',
      isFree: 0,
      subtopic: '',
      isGeneral: subjectId ? 0 : 1,
      examModeOnly: 0,
      adminName: title,
      studentTitle: title,
      quizTitle: title,
      displayTitleMode: 'title',
      quizDescription: '',
      blueprint: { sections: [] },
      randomizationMode: 'static',
      timeLimit: Math.max(1, ids.length),
      hideTimeLimit: 0,
      passingMarks: 45,
      hidePassingMarks: 0,
      status: 'inactive',
      questionIds: ids,
    }));
    patchSet(setEntry.key, {
      state: 'done',
      message: issues.length ? `${ids.length} questions saved. ${issues.join(' | ')}` : `${ids.length} questions saved.`,
    });
  }

  async function run() {
    setBusy(true); setError(''); setLastRun(null); stopRef.current = false;
    const queue = importable;
    let created = 0;
    let failed = 0;
    for (let index = 0; index < queue.length; index += 1) {
      if (stopRef.current) break;
      const entry = queue[index];
      const current = sets.find((s) => s.key === entry.key) || entry;
      setProgress({ total: queue.length, index, name: entry.name.trim() || entry.fileName, saved: 0, count: current.questions.length });
      try {
        await runOne(current);
        created += 1;
      } catch (err) {
        patchSet(entry.key, { state: 'failed', message: getErrorMessage(err, 'Import failed') });
        failed += 1;
        if (stopRef.current) break;
      }
    }
    setLastRun({ created, failed, stopped: stopRef.current, total: queue.length });
    setProgress(null);
    setBusy(false);
  }

  const overallPercent = progress
    ? Math.min(100, Math.round(((progress.index + (progress.count ? progress.saved / progress.count : 0)) / progress.total) * 100))
    : 0;

  const totals = {
    done: rows.filter((r) => r.state === 'done').length,
    failed: rows.filter((r) => r.state === 'failed').length,
  };

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title="Import Sets" subtitle="One JSON file = one assessment" />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        {busy && progress ? (
          <section className={cx(ui.panelCard, 'grid gap-5 !p-6')} aria-live="polite">
            <div className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-soft">
                Importing set {Math.min(progress.index + 1, progress.total)} of {progress.total}
              </span>
              <strong className="[overflow-wrap:anywhere] text-[22px] font-black leading-tight text-ink-strong">{progress.name}</strong>
            </div>

            <div className="grid gap-2">
              <div
                className="h-3 overflow-hidden rounded-full bg-surface-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallPercent}
                aria-label="Import progress"
              >
                <div
                  className="h-full rounded-full bg-brand-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[12.5px] font-bold text-ink-soft">
                <span>{progress.saved} / {progress.count} questions in this set</span>
                <span className="text-ink-strong">{overallPercent}%</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-[12.5px] text-ink-soft">Keep this page open. Assessments are created as drafts.</p>
              <button className={ui.secondaryAction} type="button" onClick={() => { stopRef.current = true; }}>Stop</button>
            </div>
          </section>
        ) : (
          <>
            {lastRun ? (
              <section className={cx(ui.panelCard, 'flex flex-wrap items-center justify-between gap-3 !p-4')}>
                <div className="grid gap-0.5">
                  <strong className="text-[15px] text-ink-strong">
                    {lastRun.stopped ? 'Stopped' : 'Finished'} — {lastRun.created} created{lastRun.failed ? `, ${lastRun.failed} failed` : ''}
                  </strong>
                  <span className="text-[12.5px] text-ink-soft">
                    {lastRun.failed ? 'Failed files are listed below. Fix them and import again; saved questions are not duplicated.' : 'All assessments were created as drafts.'}
                  </span>
                </div>
                {lastRun.created ? (
                  <button className={ui.primaryAction} type="button" onClick={() => navigate('/quizzes')}>Open assessments</button>
                ) : null}
              </section>
            ) : null}
        <section className={cx(ui.panelCard, 'grid gap-4')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>1. File them under</h2>
              <p>Chosen once, applied to every file below. Assessments are created as drafts.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            <label className={ui.formLabel}>
              Course
              <select className={ui.input} value={courseId} disabled={busy}
                      onChange={(e) => { setCourseId(e.target.value); setSubjectId(''); setPaperId(''); }}>
                <option value="">Choose a course…</option>
                {meta.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className={ui.formLabel}>
              Subject
              <select className={ui.input} value={subjectId} disabled={busy || !courseId}
                      onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Whole course</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={ui.formLabel}>
              Category
              <select className={ui.input} value={category} disabled={busy} onChange={(e) => setCategory(e.target.value)}>
                {meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className={ui.formLabel}>
              Paper (optional)
              <select className={ui.input} value={paperId} disabled={busy || !courseId}
                      onChange={(e) => setPaperId(e.target.value)}>
                <option value="">None</option>
                {papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className={cx(ui.panelCard, 'grid gap-4')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>2. Add the JSON files</h2>
              <p>Select as many as you like. The file name becomes the assessment name; you can rename any of them below.</p>
            </div>
            <div className={ui.buttonRow}>
              <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden
                     onChange={(e) => choose(e.target.files)} />
              <button className={ui.secondaryAction} type="button" disabled={busy}
                      onClick={() => fileRef.current?.click()}>Choose files…</button>
              {sets.length ? (
                <button className={ui.secondaryAction} type="button" disabled={busy} onClick={() => setSets([])}>Clear all</button>
              ) : null}
            </div>
          </div>

          {rows.length ? (
            <div className="grid gap-2">
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle px-3 py-2.5 max-[760px]:grid-cols-1">
                  <div className="grid min-w-0 gap-1">
                    <input className={ui.input} value={r.name} disabled={busy || r.state === 'done' || r.state === 'blocked'}
                           onChange={(e) => patchSet(r.key, { name: e.target.value })}
                           aria-label={`Assessment name for ${r.fileName}`} />
                    <span className="truncate text-[11.5px] text-ink-soft">{r.fileName}</span>
                  </div>
                  <div className="grid gap-0.5 text-[12.5px] text-ink-medium">
                    {r.state === 'blocked' ? null : (
                      <span>
                        {r.questions.length} questions · {r.ready} ready
                        {r.review ? ` · ${r.review} to review` : ''}
                        {r.blocked ? ` · ${r.blocked} blocked` : ''}
                      </span>
                    )}
                    {r.state === 'saving' ? <span>{r.saved}/{r.questions.length} saved</span> : null}
                    {r.message ? <span className={r.state === 'failed' || r.state === 'blocked' ? 'text-brand-error' : 'text-ink-soft'}>{r.message}</span> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-line-soft px-2.5 py-1 text-[11.5px] font-bold text-ink-soft">
                      {STATE_LABEL[r.state]}
                    </span>
                    {!busy && r.state !== 'done' ? (
                      <button className={ui.secondaryAction} type="button"
                              onClick={() => setSets((list) => list.filter((s) => s.key !== r.key))}>Remove</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={ui.emptyBox}>No files yet.</div>
          )}
        </section>

        <section className={cx(ui.panelCard, 'grid gap-3')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>3. Import</h2>
              <p>
                {busy
                  ? 'Importing — keep this page open. Questions save one at a time.'
                  : `${importable.length} file${importable.length === 1 ? '' : 's'} ready.`}
                {totals.done ? ` ${totals.done} created.` : ''}{totals.failed ? ` ${totals.failed} failed — fix and run again; saved questions are not duplicated.` : ''}
              </p>
            </div>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="button" disabled={!canRun} onClick={run}>
                {busy ? 'Importing…' : `Import ${importable.length} as drafts`}
              </button>
              {busy ? (
                <button className={ui.secondaryAction} type="button" onClick={() => { stopRef.current = true; }}>Stop</button>
              ) : null}
              {totals.done && !busy ? (
                <button className={ui.secondaryAction} type="button" onClick={() => navigate('/quizzes')}>Open assessments</button>
              ) : null}
            </div>
          </div>
          {!courseId && importable.length ? <p className="m-0 text-[12.5px] text-ink-soft">Choose a course above first.</p> : null}
        </section>
          </>
        )}
      </section>
    </main>
  );
}
