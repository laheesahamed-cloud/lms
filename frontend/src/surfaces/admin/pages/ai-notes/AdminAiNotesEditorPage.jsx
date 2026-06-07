import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoteCanvas } from '../../../app/student/ai-notes/NoteCanvas.jsx';
import {
  adminCreateLessonFlashcard,
  adminDeleteLessonFlashcard,
  adminGenerateAiNotes,
  adminGenerateLessonFlashcards,
  adminGetAiNote,
  adminGetCourses,
  adminGetSubtopics,
  adminGetTopics,
  adminListLessonFlashcards,
  adminUpdateAiNote,
  adminUpdateLessonFlashcard,
} from '../../../../shared/api/aiNotes.api.js';
import { createLesson, updateLesson } from '../../../../shared/api/lessons.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { BreadcrumbTrail } from '../../../../shared/ui/BreadcrumbTrail.jsx';

function BackIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function SparkleIcon() { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>; }
function DownloadIcon(){ return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function PrintIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="1" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 6H1.5A.5.5 0 0 0 1 6.5v5a.5.5 0 0 0 .5.5H12.5a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5H11" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="8" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="11.5" cy="7.5" r="0.75" fill="currentColor"/></svg>; }
function PublishIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function EditIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>; }
function DoneIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function QuizIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4.2 5h5.6M4.2 7.2h3.7M4.2 9.4h5.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/><circle cx="10.4" cy="7.2" r=".65" fill="currentColor"/></svg>; }
function TrashIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 1.8h3l.6 1.7M4 3.5l.4 8.2a1 1 0 0 0 1 .9h3.2a1 1 0 0 0 1-.9l.4-8.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

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

const FLASHCARD_IMAGE_MAX_BYTES = 1024 * 1024;
const FLASHCARD_IMAGE_TARGET_BYTES = 900 * 1024;
const FLASHCARD_IMAGE_LIMIT = 3;

function dataUrlByteLength(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function normalizeFlashcardImageUrls(card) {
  const rawItems = Array.isArray(card?.imageUrls) ? card.imageUrls : [card?.imageUrl];
  const urls = rawItems
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(urls)).slice(0, FLASHCARD_IMAGE_LIMIT);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Image read failed'));
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas, type, quality) {
  const dataUrl = canvas.toDataURL(type, quality);
  return type === 'image/webp' && !dataUrl.startsWith('data:image/webp')
    ? canvas.toDataURL('image/jpeg', quality)
    : dataUrl;
}

async function optimizeFlashcardImage(file) {
  const original = await readFileAsDataUrl(file);
  if (file.size <= FLASHCARD_IMAGE_MAX_BYTES && dataUrlByteLength(original) <= FLASHCARD_IMAGE_MAX_BYTES) {
    return { src: original, optimized: false, size: file.size };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const attempts = [
      [1400, 0.92],
      [1400, 0.88],
      [1200, 0.9],
      [1200, 0.86],
      [1000, 0.88],
      [1000, 0.82],
      [800, 0.84],
    ];

    let best = '';
    for (const [maxWidth, quality] of attempts) {
      let width = image.naturalWidth || image.width;
      let height = image.naturalHeight || image.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d', { alpha: true }).drawImage(image, 0, 0, width, height);
      const next = canvasToDataUrl(canvas, 'image/webp', quality);
      if (!best || dataUrlByteLength(next) < dataUrlByteLength(best)) best = next;
      if (dataUrlByteLength(next) <= FLASHCARD_IMAGE_TARGET_BYTES) {
        return { src: next, optimized: true, size: dataUrlByteLength(next), width, height };
      }
    }

    return { src: best, optimized: true, size: dataUrlByteLength(best) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function flashcardStatusClass(status) {
  if (status === 'approved') return 'border-brand-success/28 bg-[var(--color-success-light)] text-brand-success';
  if (status === 'rejected') return 'border-brand-error/24 bg-brand-error/8 text-brand-error';
  return 'border-brand-primary/20 bg-[var(--color-primary-light)] text-brand-primary';
}

function flashcardStatusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Draft';
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
  flashcardPanel:
    'lms-card-compact mx-auto mb-4 mt-4 grid w-[min(980px,calc(100%-28px))] gap-3 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-card p-4 shadow-[var(--ds-card-shadow)] max-[640px]:w-[calc(100%-20px)] max-[640px]:p-3',
  flashcardHead:
    'flex flex-wrap items-start justify-between gap-3',
  flashcardKicker:
    'm-0 text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-primary',
  flashcardTitle:
    'm-0 mt-1 text-[15px] font-extrabold text-ink-strong',
  flashcardText:
    'm-0 mt-1 text-[12px] leading-relaxed text-ink-soft',
  flashcardActions:
    'flex flex-wrap items-center gap-2',
  flashcardCountInput:
    'min-h-9 w-20 rounded-[var(--radius-sm)] border border-line-soft bg-surface-1 px-2 text-sm font-bold text-ink-strong outline-none focus:border-brand-primary',
  flashcardGrid:
    'grid gap-3',
  flashcardItem:
    'grid gap-2 rounded-[var(--radius-sm)] border border-line-soft bg-surface-1 p-3',
  flashcardItemHead:
    'flex flex-wrap items-center justify-between gap-2',
  flashcardStatus:
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em]',
  flashcardFields:
    'grid gap-2 md:grid-cols-2',
  flashcardLabel:
    'grid gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted',
  flashcardTextarea:
    'min-h-[86px] resize-y rounded-[var(--radius-sm)] border border-line-soft bg-surface-card px-3 py-2 text-[13px] font-semibold leading-relaxed text-ink-strong outline-none transition-colors focus:border-brand-primary',
  flashcardSource:
    'text-[11px] font-semibold leading-relaxed text-ink-muted',
  flashcardImagePreview:
    'mt-2 aspect-video w-full rounded-[var(--radius-sm)] border border-line-soft bg-surface-card p-1',
  flashcardEmpty:
    'rounded-[var(--radius-sm)] border border-dashed border-line-medium bg-surface-1 p-4 text-center text-[13px] font-semibold leading-relaxed text-ink-soft',
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
    'whitespace-nowrap rounded-full border border-line-soft bg-surface-card px-3.5 py-[5px] text-[11px] font-semibold tracking-[0.02em] text-ink-muted shadow-[var(--ds-card-shadow)]',
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
  const saveStatusTimer = useRef(null);
  const exportMsgTimer = useRef(null);

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
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [flashcardsGenerating, setFlashcardsGenerating] = useState(false);
  const [flashcardCount, setFlashcardCount] = useState(24);
  const [flashcardMessage, setFlashcardMessage] = useState('');
  const [savingCardId, setSavingCardId] = useState(null);
  const [bulkApprovingFlashcards, setBulkApprovingFlashcards] = useState(false);

  useEffect(() => (
    () => {
      clearTimeout(saveTimer.current);
      clearTimeout(saveStatusTimer.current);
      clearTimeout(exportMsgTimer.current);
    }
  ), []);

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

  useEffect(() => {
    let cancelled = false;
    setFlashcardsLoading(true);
    adminListLessonFlashcards(Number(id), { engine: engineKey })
      .then((items) => {
        if (!cancelled) setFlashcards(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelled) setFlashcardMessage('Flashcards could not be loaded yet.');
      })
      .finally(() => {
        if (!cancelled) setFlashcardsLoading(false);
      });
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

  const clearSaveStatusLater = useCallback((delay) => {
    clearTimeout(saveStatusTimer.current);
    saveStatusTimer.current = setTimeout(() => {
      setSaveStatus('');
      saveStatusTimer.current = null;
    }, delay);
  }, []);

  const clearExportMsgLater = useCallback((delay) => {
    clearTimeout(exportMsgTimer.current);
    exportMsgTimer.current = setTimeout(() => {
      setExportMsg('');
      exportMsgTimer.current = null;
    }, delay);
  }, []);

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
        clearSaveStatusLater(2000);
      } catch (err) {
        setSaveStatus(`save failed: ${getErrorMessage(err, 'Could not save')}`);
      }
    }, 800);
  }, [clearSaveStatusLater, engineKey, id, isFree, linkedLessonId, rawText, selCourse, selSubtopic, selTopic, status, title, videoUrl]);

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
      clearSaveStatusLater(2000);
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
      clearSaveStatusLater(3500);
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
      clearSaveStatusLater(3500);
    } catch (err) {
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

  function handleFlashcardField(cardId, field, value) {
    setFlashcards((current) => current.map((card) => (
      String(card.id) === String(cardId)
        ? { ...card, [field]: value, dirty: true }
        : card
    )));
  }

  function handleFlashcardImageAt(cardId, index, value) {
    setFlashcards((current) => current.map((card) => {
      if (String(card.id) !== String(cardId)) return card;
      const nextImages = normalizeFlashcardImageUrls(card);
      nextImages[index] = value;
      const imageUrls = nextImages.map((item) => String(item || '').trim()).filter(Boolean).slice(0, FLASHCARD_IMAGE_LIMIT);
      return { ...card, imageUrl: imageUrls[0] || '', imageUrls, dirty: true };
    }));
  }

  function handleRemoveFlashcardImage(cardId, index) {
    handleFlashcardImageAt(cardId, index, '');
  }

  async function handleFlashcardImageFile(cardId, file) {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setFlashcardMessage('Choose a PNG, JPG, WebP, or GIF image for the flashcard.');
      return;
    }
    setFlashcardMessage('Optimizing flashcard image...');
    try {
      const image = await optimizeFlashcardImage(file);
      if (!image.src || image.size > FLASHCARD_IMAGE_MAX_BYTES) {
        setFlashcardMessage('Could not reduce this image below 1 MB. Try a simpler JPG/WebP around 1200 x 800 px.');
        return;
      }
      setFlashcards((current) => current.map((card) => {
        if (String(card.id) !== String(cardId)) return card;
        const imageUrls = normalizeFlashcardImageUrls(card);
        const targetIndex = imageUrls.length < FLASHCARD_IMAGE_LIMIT ? imageUrls.length : FLASHCARD_IMAGE_LIMIT - 1;
        imageUrls[targetIndex] = image.src;
        return { ...card, imageUrl: imageUrls[0] || '', imageUrls, dirty: true };
      }));
      setFlashcardMessage(image.optimized
        ? `Image optimized to ${Math.max(1, Math.round(image.size / 1024))} KB. Save the flashcard to keep it.`
        : 'Image is already under 1 MB. Save the flashcard to keep it.');
    } catch {
      setFlashcardMessage('Could not optimize that image. Try a PNG, JPG, WebP, or GIF under 1 MB.');
    }
  }

  function handleAddFlashcard() {
    const tempId = `new-${Date.now()}`;
    setFlashcards((current) => [
      {
        id: tempId,
        question: '',
        answer: '',
        sourceHint: title || note?.title || '',
        status: 'draft',
        generatedBy: 'manual',
        dirty: true,
        isNew: true,
      },
      ...current,
    ]);
    setFlashcardMessage('Draft card added. Write the question and answer, then approve it.');
  }

  function buildFlashcardPayload(card, nextStatus) {
    const statusValue = nextStatus || card.status || 'draft';
    const payload = {
      question: String(card.question || '').trim(),
      answer: String(card.answer || '').trim(),
      sourceHint: String(card.sourceHint || '').trim(),
      status: statusValue,
    };
    const imageUrls = normalizeFlashcardImageUrls(card);
    payload.imageUrls = imageUrls;
    if (imageUrls.length) {
      payload.imageUrl = imageUrls[0];
    }
    payload.imageFit = card.imageFit === 'cover' ? 'cover' : 'contain';
    return payload;
  }

  async function handleSaveFlashcard(card, nextStatus) {
    const payload = buildFlashcardPayload(card, nextStatus);
    setSavingCardId(card.id);
    setFlashcardMessage('');
    try {
      const saved = card.isNew
        ? await adminCreateLessonFlashcard(Number(id), payload, { engine: engineKey })
        : await adminUpdateLessonFlashcard(Number(id), card.id, payload, { engine: engineKey });
      setFlashcards((current) => current.map((item) => (
        String(item.id) === String(card.id) ? { ...saved, dirty: false, isNew: false } : item
      )));
      setFlashcardMessage(payload.status === 'approved' ? 'Flashcard approved for students.' : 'Flashcard saved.');
    } catch (err) {
      setFlashcardMessage(getErrorMessage(err, 'Could not save flashcard'));
    } finally {
      setSavingCardId(null);
    }
  }

  async function handleBulkApproveFlashcards() {
    const drafts = flashcards.filter((card) => card.status === 'draft');
    if (!drafts.length || bulkApprovingFlashcards) return;
    setBulkApprovingFlashcards(true);
    setSavingCardId('bulk');
    setFlashcardMessage(`Approving ${drafts.length} flashcard${drafts.length === 1 ? '' : 's'}...`);
    const savedCards = [];
    try {
      for (const card of drafts) {
        const payload = buildFlashcardPayload(card, 'approved');
        const saved = card.isNew
          ? await adminCreateLessonFlashcard(Number(id), payload, { engine: engineKey })
          : await adminUpdateLessonFlashcard(Number(id), card.id, payload, { engine: engineKey });
        savedCards.push({ previousId: card.id, saved });
      }
      setFlashcards((current) => current.map((item) => {
        const match = savedCards.find((row) => String(row.previousId) === String(item.id));
        return match ? { ...match.saved, dirty: false, isNew: false } : item;
      }));
      setFlashcardMessage(`${savedCards.length} flashcard${savedCards.length === 1 ? '' : 's'} approved for students.`);
    } catch (err) {
      setFlashcardMessage(getErrorMessage(err, 'Could not bulk approve flashcards'));
    } finally {
      setSavingCardId(null);
      setBulkApprovingFlashcards(false);
    }
  }

  async function handleDeleteFlashcard(card) {
    if (!window.confirm('Delete this flashcard?')) return;
    if (card.isNew) {
      setFlashcards((current) => current.filter((item) => String(item.id) !== String(card.id)));
      return;
    }

    setSavingCardId(card.id);
    setFlashcardMessage('');
    try {
      await adminDeleteLessonFlashcard(Number(id), card.id, { engine: engineKey });
      setFlashcards((current) => current.filter((item) => String(item.id) !== String(card.id)));
      setFlashcardMessage('Flashcard removed.');
    } catch (err) {
      setFlashcardMessage(getErrorMessage(err, 'Could not delete flashcard'));
    } finally {
      setSavingCardId(null);
    }
  }

  async function handleGenerateFlashcards() {
    if (rawText.trim().length < 10 && !noteData?.pages?.length) {
      setFlashcardMessage('Add lesson notes before generating Q&A flashcards.');
      return;
    }

    setFlashcardsGenerating(true);
    setFlashcardMessage(`Creating Q&A drafts with ${generatorLabel}...`);
    try {
      let lessonId = linkedLessonId;
      if (selCourse && selTopic && selSubtopic) {
        lessonId = await ensureLinkedLesson();
      }
      const cleanData = noteData ? cleanNoteDataForSave(noteData) : null;
      await adminUpdateAiNote(Number(id), {
        title,
        rawText,
        noteData: cleanData,
        lessonId: lessonId ?? linkedLessonId ?? null,
        videoUrl: cleanVideoUrl(videoUrl),
      }, { timeout: 60000 }, { engine: engineKey });
      if (cleanData) {
        setNoteData(cleanData);
        setSavedData(cleanData);
      }
      const result = await adminGenerateLessonFlashcards(Number(id), {
        count: Math.max(6, Math.min(60, Number(flashcardCount) || 24)),
      }, { engine: engineKey });
      setFlashcards(Array.isArray(result?.items) ? result.items : []);
      setFlashcardMessage(result?.createdCount
        ? `${result.createdCount} draft Q&A flashcard${result.createdCount === 1 ? '' : 's'} created. Review before students see them.`
        : 'No new drafts were added because matching flashcards already exist.');
    } catch (err) {
      setFlashcardMessage(getErrorMessage(err, 'Could not generate Q&A flashcards'));
    } finally {
      setFlashcardsGenerating(false);
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
    finally { clearExportMsgLater(2500); }
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
  const approvedFlashcardCount = flashcards.filter((card) => card.status === 'approved').length;
  const draftFlashcardCount = flashcards.filter((card) => card.status === 'draft').length;

  if (loading) return <div className={editorUi.loadingFallback}>Loading…</div>;
  if (!note)   return <div className={editorUi.notFoundFallback}>Not found. <button className={ui.secondaryAction} onClick={() => navigate(routeBase)}>Back</button></div>;

  return (
    <div className={editorUi.editorShell}>

      {/* top bar */}
      <div className={editorUi.topBar}>
        <button className={cx(ui.secondaryAction, 'px-3 py-1.5 text-[13px]')}
                onClick={() => navigate(routeBase)}><BackIcon/> {listLabel}</button>
        <BreadcrumbTrail
          className="lms-editor-breadcrumb"
          items={[
            { label: listLabel, to: routeBase },
            { label: title || note?.title || 'Lesson' },
          ]}
        />
        <input className={editorUi.titleInput}
               aria-label="Lesson title"
               value={title} onChange={handleTitleChange} placeholder="Lesson title" maxLength={255}/>

        {saveStatus && (
          <span
            className={cx(
            editorUi.statusText,
            saveStatus.startsWith('save failed')
              ? 'text-brand-error'
              : saveStatus.includes('published') || saveStatus === 'saved'
                ? 'text-brand-success'
                : 'text-ink-muted'
            )}
            role="status"
            aria-live="polite"
          >
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
            aria-label="Source text for generated lesson"
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
                      aria-label="Lesson course"
                      onChange={e => { initialLoad.current = false; setSelCourse(e.target.value); }}
              >
                <option value="">— Course (optional) —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={cx(ui.input, editorUi.compactInput)} value={selTopic} disabled={!selCourse}
                      aria-label="Lesson subject"
                      onChange={e => { initialLoad.current = false; setSelTopic(e.target.value); }}
              >
                <option value="">— Subject (optional) —</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className={cx(ui.input, editorUi.compactInput)} value={selSubtopic} disabled={!selTopic}
                      aria-label="Lesson topic"
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
                aria-label="Student video link"
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
          <section className={editorUi.flashcardPanel} aria-labelledby="lesson-flashcards-title">
            <div className={editorUi.flashcardHead}>
              <div>
                <p className={editorUi.flashcardKicker}>Reviewed Q&amp;A flashcards</p>
                <h2 id="lesson-flashcards-title" className={editorUi.flashcardTitle}>Question and answer cards from this lesson</h2>
                <p className={editorUi.flashcardText}>
                  Students see approved cards only. Drafts stay here until the question and answer are checked.
                </p>
              </div>
              <div className={editorUi.flashcardActions}>
                <input
                  className={editorUi.flashcardCountInput}
                  type="number"
                  min="6"
                  max="60"
                  value={flashcardCount}
                  aria-label="Number of Q&A flashcards to generate"
                  onChange={(event) => setFlashcardCount(event.target.value)}
                />
                <button
                  className={cx(ui.primaryAction, editorUi.smallAction)}
                  type="button"
                  onClick={handleGenerateFlashcards}
                  disabled={flashcardsGenerating}
                >
                  <SparkleIcon/> {flashcardsGenerating ? 'Creating...' : 'Generate Q&A'}
                </button>
                <button
                  className={cx(ui.secondaryAction, editorUi.smallAction)}
                  type="button"
                  onClick={handleAddFlashcard}
                  disabled={flashcardsGenerating}
                >
                  <EditIcon/> Add Draft
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-extrabold text-ink-muted">
              <span className={cx(editorUi.flashcardStatus, 'border-brand-success/28 bg-[var(--color-success-light)] text-brand-success')}>
                {approvedFlashcardCount} approved
              </span>
              <span className={cx(editorUi.flashcardStatus, 'border-brand-primary/20 bg-[var(--color-primary-light)] text-brand-primary')}>
                {draftFlashcardCount} draft
              </span>
              <button
                className={cx(ui.successAction, 'min-h-7 px-2.5 py-0.5 text-[11px]')}
                type="button"
                onClick={handleBulkApproveFlashcards}
                disabled={bulkApprovingFlashcards || flashcardsGenerating || savingCardId || draftFlashcardCount === 0}
              >
                <DoneIcon/> {bulkApprovingFlashcards ? 'Approving...' : `Approve Drafts`}
              </button>
            </div>

            {flashcardMessage && (
              <div className={cx(
                flashcardMessage.toLowerCase().includes('could not') || flashcardMessage.toLowerCase().includes('failed')
                  ? ui.feedbackError
                  : ui.feedbackSuccess,
                'py-2 text-xs'
              )}>
                {flashcardMessage}
              </div>
            )}

            {flashcardsLoading ? (
              <div className={editorUi.flashcardEmpty}>Loading Q&amp;A flashcards...</div>
            ) : flashcards.length === 0 ? (
              <div className={editorUi.flashcardEmpty}>
                No Q&amp;A flashcards yet. Generate drafts from the lesson notes, then approve the accurate ones.
              </div>
            ) : (
              <div className={editorUi.flashcardGrid}>
                {flashcards.map((card, index) => {
                  const isSaving = String(savingCardId) === String(card.id);
                  const imageUrls = normalizeFlashcardImageUrls(card);
                  return (
                    <article key={card.id} className={editorUi.flashcardItem}>
                      <div className={editorUi.flashcardItemHead}>
                        <span className={cx(editorUi.flashcardStatus, flashcardStatusClass(card.status))}>
                          {flashcardStatusLabel(card.status)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className={cx(ui.secondaryAction, 'min-h-9 px-3 py-1 text-xs')}
                            type="button"
                            onClick={() => handleSaveFlashcard(card)}
                            disabled={isSaving || flashcardsGenerating || (!card.dirty && !card.isNew)}
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className={cx(card.status === 'approved' ? ui.successAction : ui.primaryAction, 'min-h-9 px-3 py-1 text-xs')}
                            type="button"
                            onClick={() => handleSaveFlashcard(card, 'approved')}
                            disabled={isSaving || flashcardsGenerating}
                          >
                            <DoneIcon/> {card.status === 'approved' ? 'Approved' : 'Approve'}
                          </button>
                          {card.status !== 'rejected' && (
                            <button
                              className={cx(ui.ghostSmallDanger, 'min-h-9 px-3 py-1 text-xs')}
                              type="button"
                              onClick={() => handleSaveFlashcard(card, 'rejected')}
                              disabled={isSaving || flashcardsGenerating}
                            >
                              Reject
                            </button>
                          )}
                          <button
                            className={cx(ui.dangerIconButton, 'size-9 min-h-9')}
                            type="button"
                            aria-label={`Delete flashcard ${index + 1}`}
                            onClick={() => handleDeleteFlashcard(card)}
                            disabled={isSaving || flashcardsGenerating}
                          >
                            <TrashIcon/>
                          </button>
                        </div>
                      </div>
                      <div className={editorUi.flashcardFields}>
                        <label className={editorUi.flashcardLabel}>
                          Question
                          <textarea
                            className={editorUi.flashcardTextarea}
                            value={card.question || ''}
                            onChange={(event) => handleFlashcardField(card.id, 'question', event.target.value)}
                            placeholder="What is the key mechanism of mitral stenosis?"
                          />
                        </label>
                        <label className={editorUi.flashcardLabel}>
                          Answer
                          <textarea
                            className={editorUi.flashcardTextarea}
                            value={card.answer || ''}
                            onChange={(event) => handleFlashcardField(card.id, 'answer', event.target.value)}
                            placeholder="The narrowed mitral valve obstructs left atrial emptying during diastole..."
                          />
                        </label>
                      </div>
                      <label className={editorUi.flashcardLabel}>
                        Source hint
                        <input
                          className={cx(ui.input, 'min-h-9 py-1.5 text-xs')}
                          value={card.sourceHint || ''}
                          onChange={(event) => handleFlashcardField(card.id, 'sourceHint', event.target.value)}
                          placeholder="Pathophysiology"
                        />
                      </label>
                      <div className={editorUi.flashcardLabel}>
                        Images
                        {Array.from({ length: FLASHCARD_IMAGE_LIMIT }).map((_, imageIndex) => (
                          <div key={imageIndex} className="flex items-center gap-2">
                            <input
                              className={cx(ui.input, 'min-h-9 py-1.5 text-xs')}
                              value={imageUrls[imageIndex] || ''}
                              onChange={(event) => handleFlashcardImageAt(card.id, imageIndex, event.target.value)}
                              placeholder={`Image ${imageIndex + 1} URL`}
                            />
                            {imageUrls[imageIndex] ? (
                              <button
                                type="button"
                                className={cx(ui.ghostSmallDanger, 'min-h-8 px-2 text-[11px]')}
                                onClick={() => handleRemoveFlashcardImage(card.id, imageIndex)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <input
                          className="text-[11px] font-semibold normal-case tracking-normal text-ink-muted file:mr-3 file:min-h-8 file:rounded-[var(--radius-sm)] file:border file:border-line-soft file:bg-surface-card file:px-3 file:text-xs file:font-extrabold file:text-ink-strong"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(event) => handleFlashcardImageFile(card.id, event.target.files?.[0])}
                        />
                        <span className={editorUi.flashcardSource}>
                          Add up to 3 images. Recommended: 1200 x 675 px or 16:9, WebP/JPG under 500 KB. Upload any shape, then choose fit full image or crop to fill.
                        </span>
                        <div className="inline-flex w-fit rounded-[var(--radius-sm)] border border-line-soft bg-surface-card p-1 normal-case tracking-normal">
                          {[
                            ['contain', 'Fit full image'],
                            ['cover', 'Crop to fill'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              className={cx(
                                'min-h-8 rounded-[var(--radius-xs)] px-3 text-[11px] font-extrabold transition-colors',
                                (card.imageFit || 'contain') === value
                                  ? 'bg-brand-primary text-white'
                                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink-strong'
                              )}
                              onClick={() => handleFlashcardField(card.id, 'imageFit', value)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {imageUrls.length ? (
                          <div className="grid gap-2 sm:grid-cols-3">
                            {imageUrls.map((imageUrl, imageIndex) => (
                              <div key={`${imageUrl.slice(0, 30)}-${imageIndex}`} className={editorUi.flashcardImagePreview}>
                                <img
                                  className={cx('h-full w-full rounded-[calc(var(--radius-sm)-2px)]', (card.imageFit || 'contain') === 'cover' ? 'object-cover' : 'object-contain')}
                                  src={imageUrl}
                                  alt=""
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

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
