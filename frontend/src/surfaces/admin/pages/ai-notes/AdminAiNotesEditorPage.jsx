import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoteCanvas } from '../../../app/student/ai-notes/NoteCanvas.jsx';
import { adminGetAiNote, adminUpdateAiNote, adminGenerateAiNotes, adminGetCourses, adminGetTopics, adminGetSubtopics } from '../../../../shared/api/aiNotes.api.js';
import { createLesson, updateLesson } from '../../../../shared/api/lessons.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

function BackIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function SparkleIcon() { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>; }
function DownloadIcon(){ return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function PrintIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="1" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 6H1.5A.5.5 0 0 0 1 6.5v5a.5.5 0 0 0 .5.5H12.5a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5H11" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="8" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="11.5" cy="7.5" r="0.75" fill="currentColor"/></svg>; }
function PublishIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function EditIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>; }
function DoneIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function QuizIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4.2 5h5.6M4.2 7.2h3.7M4.2 9.4h5.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/><circle cx="10.4" cy="7.2" r=".65" fill="currentColor"/></svg>; }

function normalizeNoteData(raw) {
  if (!raw) return null;
  if (raw.pages && Array.isArray(raw.pages)) return raw;
  return { pages: [raw] };
}

function cleanVideoUrl(value) {
  return String(value || '').trim() || null;
}

function cleanNoteDataForSave(data) {
  return {
    pages: (data?.pages || []).map(p => {
      // eslint-disable-next-line no-unused-vars
      const { illustrationData: _drop, ...clean } = p;
      if (!clean.sections) return clean;
      return {
        ...clean,
        sections: clean.sections.map(s => {
          if (s.type === 'image' && typeof s.src === 'string' && s.src.startsWith('data:')) {
            return { ...s, src: s.src };
          }
          return s;
        }),
      };
    }),
  };
}

function getNoteDataSize(data) {
  return JSON.stringify(data).length;
}

const editorUi = {
  layout:
    'grid min-h-0 flex-1 grid-cols-[380px_1fr] overflow-hidden max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_1fr]',
  inputPanel: 'flex flex-col overflow-hidden border-r border-line-soft bg-surface-1',
  inputTitle:
    'flex items-center justify-between border-b border-line-soft px-[18px] pb-2.5 pt-3.5 text-xs font-bold uppercase tracking-[0.8px] text-ink-muted',
  textarea:
    'min-h-0 flex-1 resize-none border-0 bg-surface-1 px-[18px] py-4 font-sans text-[13.5px] leading-[1.65] text-ink-body outline-none placeholder:text-ink-muted',
  inputFooter: 'flex items-center justify-between gap-3 border-t border-line-soft px-[18px] py-3',
  charCount: 'text-[11px] text-ink-muted',
  editorShell: 'flex h-full flex-col',
  topBar:
    'z-20 flex shrink-0 flex-wrap items-center gap-2.5 border-b border-line-soft bg-surface-glass-strong px-5 py-2.5 backdrop-blur-[12px]',
  titleInput:
    'min-w-[140px] flex-1 border-0 border-b border-line-soft bg-transparent px-0 py-1.5 text-[15px] font-semibold text-ink-strong shadow-none outline-none focus:border-brand-primary focus:bg-transparent focus:shadow-none',
  smallAction:
    'gap-[5px] px-[11px] py-[5px] text-xs',
  publishAction:
    'gap-[5px] px-[13px] py-[5px] text-xs',
  toolbarActions: 'flex items-center gap-1.5',
  statusText: 'max-w-[320px] text-xs',
  unsavedText: 'text-xs text-ink-muted opacity-60',
  exportText: 'self-center text-xs text-ink-muted',
  editorError: 'mx-5 mt-2.5 shrink-0',
  categoryPanel: 'mt-3 border-t border-line-soft pt-3',
  categoryTitle: 'mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted',
  categoryStack: 'flex flex-col gap-1.5',
  compactInput: 'px-2 py-[5px] text-[13px]',
  statusRow: 'mt-0.5 flex items-center gap-2',
  statusLabel: 'flex-1 text-xs font-semibold text-ink-muted',
  freeLabel: 'mt-1 flex items-center gap-2 text-xs font-semibold text-ink-muted',
  settingsButton: 'mt-0.5 px-3 py-[5px] text-xs',
  loadingFallback: 'p-12 text-center text-ink-muted',
  notFoundFallback: 'p-12 text-center',
  outputPanel:
    'flex min-w-0 flex-col overflow-y-auto bg-[radial-gradient(ellipse_55%_38%_at_14%_22%,color-mix(in_srgb,var(--color-primary)_10%,transparent)_0%,transparent_70%),radial-gradient(ellipse_45%_55%_at_86%_72%,color-mix(in_srgb,var(--color-secondary)_9%,transparent)_0%,transparent_70%),var(--surface-0)] print:overflow-visible',
  emptyState:
    'flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3.5 px-10 py-[60px] text-center text-ink-muted [&_h3]:m-0 [&_h3]:text-base [&_h3]:text-ink-body [&_p]:m-0 [&_p]:text-[13px]',
  loadingState:
    'flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3.5 px-10 py-[60px] text-center text-ink-muted [&_p]:m-0 [&_p]:text-sm [&_p]:font-semibold [&_p]:text-ink-body [&_span]:text-xs',
  loadingSpinner:
    'size-10 animate-[spin_0.8s_linear_infinite] rounded-full border-[3px] border-line-medium border-t-primary',
  book: 'flex flex-col px-2.5 pb-7 pt-4',
  bookPage: 'flex flex-col',
  pageTurn: 'my-9 mb-8 flex select-none items-center gap-3.5',
  pageTurnLine: 'h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--line-soft)_20%,var(--line-soft)_80%,transparent)]',
  pageTurnBadge:
    'whitespace-nowrap rounded-full border border-line-soft bg-surface-card px-3.5 py-[5px] text-[11px] font-semibold tracking-[0.02em] text-ink-muted shadow-[0_1px_4px_rgba(0,0,0,0.08)]',
  spinner:
    'inline-flex items-center gap-2 text-[13px] text-primary before:size-3.5 before:rounded-full before:border-2 before:border-current before:border-t-transparent before:content-[""] before:animate-[spin_0.7s_linear_infinite]',
  statusPill:
    'inline-flex shrink-0 cursor-pointer items-center gap-[5px] whitespace-nowrap rounded-full border border-transparent bg-transparent px-2 py-[3px] text-[11px] font-semibold tracking-[0.02em] transition-opacity disabled:cursor-default disabled:opacity-50',
  statusActive:
    'border-green-600/30 bg-green-600/10 text-green-600 dark:border-green-400/25 dark:bg-green-400/[0.12] dark:text-green-400',
  statusInactive:
    'border-border-base bg-bg-card text-ink-muted',
  statusDot: 'inline-block size-1.5 rounded-full bg-current',
};

export function AdminAiNotesEditorPage({
  engineKey = 'gemini',
  routeBase = '/ai-notes',
  listLabel = 'Lessons',
  generatorLabel = 'active AI provider',
}) {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const bookRef   = useRef(null);
  const saveTimer = useRef(null);

  const [note,       setNote]       = useState(null);
  const [linkedLessonId, setLinkedLessonId] = useState(null);
  const [title,      setTitle]      = useState('');
  const [rawText,    setRawText]    = useState('');
  const [videoUrl,   setVideoUrl]   = useState('');
  const [noteData,   setNoteData]   = useState(null);
  const [savedData,  setSavedData]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [editMode,   setEditMode]   = useState(false);
  const [error,      setError]      = useState('');
  const [exportMsg,  setExportMsg]  = useState('');

  // Hierarchy
  const [courses,     setCourses]    = useState([]);
  const [topics,      setTopics]     = useState([]);
  const [subtopics,   setSubtopics]  = useState([]);
  const [selCourse,   setSelCourse]  = useState('');
  const [selTopic,    setSelTopic]   = useState('');
  const [selSubtopic, setSelSubtopic]= useState('');
  const [status,      setStatus]     = useState('active');
  const [isFree,      setIsFree]     = useState(false);
  const [metaSaving,  setMetaSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminGetAiNote(Number(id), { engine: engineKey })
      .then(data => {
        if (cancelled) return;
        setNote(data);
        setTitle(data.title || '');
        setRawText(data.rawText || '');
        setVideoUrl(data.videoUrl || '');
        const nd = normalizeNoteData(data.noteData);
        setNoteData(nd);
        setSavedData(nd);
        setStatus(data.status || 'active');
        setIsFree(Boolean(data.isFree));
        setSelCourse(data.courseId ? String(data.courseId) : '');
        setSelTopic(data.topicId ? String(data.topicId) : '');
        setSelSubtopic(data.subtopicId ? String(data.subtopicId) : '');
        setLinkedLessonId(data.lessonId || null);
      })
      .catch(() => setError('Failed to load lesson.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [engineKey, id]);

  // Load courses once on mount
  useEffect(() => { adminGetCourses().then(setCourses).catch(() => {}); }, []);

  // Load topics when course changes (but don't reset if we're loading initial data)
  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) return;
    setSelTopic(''); setSelSubtopic(''); setTopics([]); setSubtopics([]);
    if (!selCourse) return;
    adminGetTopics(Number(selCourse)).then(setTopics).catch(() => {});
  }, [selCourse]);

  useEffect(() => {
    if (initialLoad.current) return;
    setSelSubtopic(''); setSubtopics([]);
    if (!selTopic) return;
    adminGetSubtopics(Number(selTopic)).then(setSubtopics).catch(() => {});
  }, [selTopic]);

  // After initial note loads, populate dropdowns then allow cascade
  useEffect(() => {
    if (!note) return;
    const loadDropdowns = async () => {
      if (note.courseId) {
        const t = await adminGetTopics(note.courseId).catch(() => []);
        setTopics(t);
        if (note.topicId) {
          const s = await adminGetSubtopics(note.topicId).catch(() => []);
          setSubtopics(s);
        }
      }
      initialLoad.current = false;
    };
    loadDropdowns();
  }, [note]);

  const scheduleSave = useCallback((patch) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('saving…');
    saveTimer.current = setTimeout(async () => {
      try {
        await adminUpdateAiNote(Number(id), patch, undefined, { engine: engineKey });
        if (linkedLessonId && selCourse && selTopic && selSubtopic) {
          await updateLesson(linkedLessonId, {
            courseId: Number(selCourse),
            topicId: Number(selTopic),
            subtopicId: Number(selSubtopic),
            lessonTitle: (patch.title ?? title).trim() || 'Untitled Lesson',
            lessonContent: typeof patch.rawText === 'string' ? patch.rawText : rawText,
            videoUrl: cleanVideoUrl(typeof patch.videoUrl === 'string' ? patch.videoUrl : videoUrl),
            isFree: isFree ? 1 : 0,
            status,
          });
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        setSaveStatus(`save failed: ${getErrorMessage(err, 'Could not save')}`);
      }
    }, 800);
  }, [engineKey, id, isFree, linkedLessonId, rawText, selCourse, selSubtopic, selTopic, status, title, videoUrl]);

  function handleTitleChange(e) {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value, rawText });
  }
  function handleRawChange(e) {
    setRawText(e.target.value);
    scheduleSave({ title, rawText: e.target.value });
  }

  async function ensureLinkedLesson({
    nextTitle = title,
    nextRawText = rawText,
    nextStatus = status,
    nextCourse = selCourse,
    nextTopic = selTopic,
    nextSubtopic = selSubtopic,
  } = {}) {
    if (!nextCourse || !nextTopic || !nextSubtopic) return linkedLessonId;

    const payload = {
      courseId: Number(nextCourse),
      topicId: Number(nextTopic),
      subtopicId: Number(nextSubtopic),
      lessonTitle: nextTitle.trim() || 'Untitled Lesson',
      lessonContent: nextRawText,
      videoUrl: cleanVideoUrl(videoUrl),
      isFree: isFree ? 1 : 0,
      status: nextStatus,
    };

    if (linkedLessonId) {
      await updateLesson(linkedLessonId, payload);
      return linkedLessonId;
    }

    const created = await createLesson(payload);
    const nextLessonId = created.id;
    setLinkedLessonId(nextLessonId);
    setNote(current => (current ? { ...current, lessonId: nextLessonId } : current));
    await adminUpdateAiNote(Number(id), { lessonId: nextLessonId }, undefined, { engine: engineKey });
    return nextLessonId;
  }

  async function handleSaveMeta() {
    setMetaSaving(true);
    try {
      let lessonId = linkedLessonId;
      if (selCourse && selTopic && selSubtopic) {
        lessonId = await ensureLinkedLesson();
      } else if (selCourse && linkedLessonId) {
        lessonId = linkedLessonId;
      } else {
        lessonId = null;
        setLinkedLessonId(null);
      }
      await adminUpdateAiNote(Number(id), {
        status,
        courseId:   selCourse   ? Number(selCourse)   : null,
        topicId:    selTopic    ? Number(selTopic)     : null,
        subtopicId: selSubtopic ? Number(selSubtopic)  : null,
        lessonId: lessonId ?? null,
        videoUrl: cleanVideoUrl(videoUrl),
        isFree: isFree ? 1 : 0,
      }, undefined, { engine: engineKey });
      setSaveStatus('settings saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      setSaveStatus(`save failed: ${getErrorMessage(err, 'Could not save settings')}`);
    }
    finally { setMetaSaving(false); }
  }

  async function handleGenerate() {
    if (rawText.trim().length < 10) { setError('Add at least a few lines of text first.'); return; }
    setError(''); setProcessing(true); setProcessMsg(`Sending to ${generatorLabel}…`);
    try {
      await adminUpdateAiNote(Number(id), { title, rawText }, undefined, { engine: engineKey });
      setProcessMsg('Building notes…');
      const result = await adminGenerateAiNotes(rawText, { engine: engineKey });
      const nd = normalizeNoteData(result);
      const cleanData = cleanNoteDataForSave(nd);
      const roughSize = getNoteDataSize(cleanData);
      if (roughSize > 55 * 1024 * 1024) {
        setSaveStatus('save failed: lesson is too large (>55 MB). Remove some large images and try again.');
        return;
      }

      setNoteData(cleanData);
      const firstTitle = nd.pages[0]?.title || title;
      if (nd.pages[0]?.title && (title === 'Untitled Lesson' || title === 'Untitled Canvas' || !title)) setTitle(firstTitle);
      setProcessMsg('Saving generated lesson…');
      let lessonId = linkedLessonId;
      if (selCourse && selTopic && selSubtopic) {
        lessonId = await ensureLinkedLesson({ nextTitle: firstTitle, nextRawText: rawText });
      }
      await adminUpdateAiNote(Number(id), { title: firstTitle, rawText, noteData: cleanData, lessonId: lessonId ?? null, videoUrl: cleanVideoUrl(videoUrl) }, { timeout: 60000 }, { engine: engineKey });
      setSavedData(cleanData);
      setSaveStatus('generated and saved');
      setTimeout(() => setSaveStatus(''), 3500);
    } catch (err) {
      const msg = err?.response?.data?.message
        || (err?.code === 'ECONNABORTED' ? 'Request timed out — try again.' : null)
        || err?.message
        || `Generation failed — check ${generatorLabel} API key in Settings.`;
      setError(msg);
    } finally { setProcessing(false); setProcessMsg(''); }
  }

  async function handlePublish() {
    if (!noteData?.pages?.length) return;
    setSaving(true); setSaveStatus('');
    try {
      const cleanData = cleanNoteDataForSave(noteData);
      const roughSize = getNoteDataSize(cleanData);
      if (roughSize > 55 * 1024 * 1024) {
        setSaveStatus('save failed: lesson is too large (>55 MB). Remove some large images and try again.');
        return;
      }

      let lessonId = linkedLessonId;
      if (selCourse && selTopic && selSubtopic) {
        lessonId = await ensureLinkedLesson();
      }
      await adminUpdateAiNote(Number(id), { title, noteData: cleanData, lessonId: lessonId ?? null, videoUrl: cleanVideoUrl(videoUrl) }, { timeout: 60000 }, { engine: engineKey });
      setNoteData(cleanData);
      setSavedData(cleanData);
      setSaveStatus('published — students can see this');
      setTimeout(() => setSaveStatus(''), 3500);
    } catch (err) {
      console.error('[Publish] save error:', err?.response?.status || 'unknown');
      const msg = getErrorMessage(err, 'Could not save — check server is running');
      setSaveStatus(`save failed: ${msg}`);
    }
    finally { setSaving(false); }
  }

  async function handleCreateQuiz() {
    setError('');
    setSaveStatus('');
    try {
      let lessonId = linkedLessonId;
      if (selCourse && selTopic && selSubtopic) {
        lessonId = await ensureLinkedLesson();
      }

      if (!lessonId || !selCourse || !selTopic) {
        setError('Choose at least a course and subject, then save the lesson before creating a quiz.');
        return;
      }

      const cleanData = noteData ? cleanNoteDataForSave(noteData) : null;
      await adminUpdateAiNote(Number(id), {
        title,
        rawText,
        noteData: cleanData,
        lessonId,
        videoUrl: cleanVideoUrl(videoUrl),
      }, { timeout: 60000 }, { engine: engineKey });
      if (cleanData) {
        setNoteData(cleanData);
        setSavedData(cleanData);
      }

      navigate('/ai/gemini', {
        state: {
          lessonQuiz: {
            noteId: Number(id),
            lessonId,
            courseId: selCourse ? Number(selCourse) : null,
            subjectId: selTopic ? Number(selTopic) : null,
            topicId: selSubtopic ? Number(selSubtopic) : null,
            title: title || note?.title || 'Lesson',
            rawText,
            noteData: cleanData,
          },
        },
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not prepare this lesson for quiz generation'));
    }
  }

  async function handleExportPng() {
    if (!bookRef.current) return;
    setExportMsg('Capturing…');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(bookRef.current, { scale: 2, useCORS: true, backgroundColor: '#0d0f1a', logging: false });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${(title || 'canvas').replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      setExportMsg('PNG saved!');
    } catch { setExportMsg('Export failed'); }
    finally { setTimeout(() => setExportMsg(''), 2500); }
  }

  function handlePageDataChange(idx, newPageData) {
    setNoteData(prev => ({
      ...prev,
      pages: prev.pages.map((p, i) => i === idx ? newPageData : p),
    }));
  }

  function handleVideoUrlChange(e) {
    const next = e.target.value;
    setVideoUrl(next);
    scheduleSave({ title, rawText, videoUrl: cleanVideoUrl(next) });
  }

  const pages     = noteData?.pages || [];
  const isUnsaved = noteData && noteData !== savedData;
  const hasCanvas = pages.length > 0;

  if (loading) return <div className={editorUi.loadingFallback}>Loading…</div>;
  if (!note)   return <div className={editorUi.notFoundFallback}>Not found. <button className={ui.secondaryAction} onClick={() => navigate(routeBase)}>Back</button></div>;

  return (
    <div className={editorUi.editorShell}>

      {/* top bar */}
      <div className={editorUi.topBar}>
        <button className={cx(ui.secondaryAction, 'px-3 py-1.5 text-[13px]')}
                onClick={() => navigate(routeBase)}><BackIcon/> {listLabel}</button>
        <input className={editorUi.titleInput}
               value={title} onChange={handleTitleChange} placeholder="Lesson title" maxLength={255}/>

        {saveStatus && (
          <span className={cx(
            editorUi.statusText,
            saveStatus.startsWith('save failed')
              ? 'text-brand-error'
              : saveStatus.includes('published') || saveStatus === 'saved'
                ? 'text-brand-success'
                : 'text-ink-muted'
          )}>
            {saveStatus}
          </span>
        )}
        {isUnsaved && !saveStatus && (
          <span className={editorUi.unsavedText}>unsaved lesson</span>
        )}

        {hasCanvas && (
          <div className={editorUi.toolbarActions}>
            <button className={cx(editMode ? ui.primaryAction : ui.secondaryAction, editorUi.smallAction)}
              onClick={() => setEditMode(m => !m)}
            >
              {editMode ? <><DoneIcon/> Done</> : <><EditIcon/> Edit Lesson</>}
            </button>
            <button className={cx(isUnsaved ? ui.primaryAction : ui.secondaryAction, editorUi.publishAction)}
              onClick={handlePublish}
              disabled={saving || !isUnsaved}
            >
              <PublishIcon/>
              {saving ? 'Publishing…' : isUnsaved ? 'Publish to Students' : 'Published'}
            </button>
            <button className={cx(ui.secondaryAction, editorUi.smallAction)}
              type="button"
              onClick={handleCreateQuiz}
            >
              <QuizIcon/> Create Quiz
            </button>
            <button className={cx(ui.secondaryAction, editorUi.smallAction)}
                    onClick={handleExportPng}><DownloadIcon/> PNG</button>
            <button className={cx(ui.secondaryAction, editorUi.smallAction)}
                    onClick={() => window.print()}><PrintIcon/> PDF</button>
            {exportMsg && <span className={editorUi.exportText}>{exportMsg}</span>}
          </div>
        )}
      </div>

      {error && (
        <div className={cx(ui.feedbackError, editorUi.editorError)}>
          {error}
          <button className="ml-2.5 cursor-pointer border-0 bg-transparent font-bold text-inherit"
                  onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className={editorUi.layout}>

        {/* input panel */}
        <div className={editorUi.inputPanel}>
          <div className={editorUi.inputTitle}>Source Text</div>
          <textarea className={editorUi.textarea}
            placeholder={`Paste the topic text here…\n\ne.g. Lecture notes, textbook content, clinical guidelines…`}
            value={rawText} onChange={handleRawChange}
          />
          <div className={editorUi.inputFooter}>
            <span className={editorUi.charCount}>{rawText.length.toLocaleString()} / 12,000</span>
            <button className={cx(ui.primaryAction, 'gap-[7px]')} onClick={handleGenerate} disabled={processing}>
              {processing
                ? <span className={editorUi.spinner}>{processMsg || 'Working…'}</span>
                : <><SparkleIcon/> Generate Lesson</>}
            </button>
          </div>

          {/* Category & status panel */}
          <div className={editorUi.categoryPanel}>
            <div className={editorUi.categoryTitle}>Category &amp; Status</div>
            <div className={editorUi.categoryStack}>
              <select className={cx(ui.input, editorUi.compactInput)} value={selCourse}
                      onChange={e => { initialLoad.current = false; setSelCourse(e.target.value); }}
              >
                <option value="">— Course (optional) —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={cx(ui.input, editorUi.compactInput)} value={selTopic} disabled={!selCourse}
                      onChange={e => { initialLoad.current = false; setSelTopic(e.target.value); }}
              >
                <option value="">— Subject (optional) —</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className={cx(ui.input, editorUi.compactInput)} value={selSubtopic} disabled={!selTopic}
                      onChange={e => { initialLoad.current = false; setSelSubtopic(e.target.value); }}
              >
                <option value="">— Topic (optional) —</option>
                {subtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className={cx(ui.input, editorUi.compactInput)}
                type="url"
                value={videoUrl}
                onChange={handleVideoUrlChange}
                placeholder="Video link for students (YouTube/Vimeo/MP4)"
              />
              <div className={editorUi.statusRow}>
                <label className={editorUi.statusLabel}>Status</label>
                <button className={cx(editorUi.statusPill, status === 'active' ? editorUi.statusActive : editorUi.statusInactive)}
                 
                  onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
                  type="button"
                >
                  <span className={editorUi.statusDot}/>
                  {status === 'active' ? 'Active' : 'Inactive'}
                </button>
              </div>
              <label className={editorUi.freeLabel}>
                <input className="shrink-0" type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} />
                Mark as free content
              </label>
              <button className={cx(ui.secondaryAction, editorUi.settingsButton)}
                      onClick={handleSaveMeta} disabled={metaSaving}>
                {metaSaving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* canvas panel */}
        <div className={editorUi.outputPanel}>
          {processing && (
            <div className={editorUi.loadingState}>
              <div className={editorUi.loadingSpinner}/>
              <p>{processMsg || 'Generating…'}</p>
              <span>Organizing pages · Adding mnemonics · Building logical connections</span>
            </div>
          )}

          {!processing && !hasCanvas && (
            <div className={editorUi.emptyState}>
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                <rect x="8"  y="8"  width="24" height="24" rx="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4"/>
                <rect x="40" y="8"  width="24" height="24" rx="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6"/>
                <rect x="8"  y="40" width="24" height="24" rx="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6"/>
                <rect x="40" y="40" width="24" height="24" rx="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9"/>
                <path d="M52 46v8M48 50h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <h3>Lesson is empty</h3>
              <p>Paste the topic text on the left then click <strong>Generate Lesson</strong></p>
            </div>
          )}

          {!processing && hasCanvas && (
            <div ref={bookRef} className={editorUi.book}>
              {pages.map((pageData, i) => (
                <div key={i} className={editorUi.bookPage}>
                  {/* page turn divider between pages */}
                  {i > 0 && (
                    <div className={editorUi.pageTurn}>
                      <div className={editorUi.pageTurnLine}/>
                      <div className={editorUi.pageTurnBadge}>
                        Page {i + 1} of {pages.length}
                        {pageData.title ? ` · ${pageData.title}` : ''}
                      </div>
                      <div className={editorUi.pageTurnLine}/>
                    </div>
                  )}
                  <NoteCanvas
                    data={{
                      ...pageData,
                      layout: pageData.layout || '3col',
                    }}
                    editable={editMode}
                    onDataChange={newData => handlePageDataChange(i, newData)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
