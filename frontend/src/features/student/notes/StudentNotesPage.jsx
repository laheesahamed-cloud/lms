import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createLessonAnnotation,
  deleteLessonAnnotation,
  fetchLessonAnnotations,
  fetchStudentLesson,
  fetchStudentLessons,
  updateLessonAnnotation,
} from '../../../api/lessons.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { recordStudyActivity } from '../../../api/dashboard.api.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../components/ui/ActionIcons.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';
import { getVideoEmbed } from '../../../utils/videoEmbed.js';

const notesLayoutClass = 'grid grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(280px,360px)] items-start gap-5 max-[900px]:grid-cols-1';
const notesStudyLayoutClass = 'grid-cols-[minmax(0,1fr)]';
const notesSidebarDrawerClass = 'max-[900px]:fixed max-[900px]:inset-4 max-[900px]:z-[90] max-[900px]:hidden max-[900px]:overflow-y-auto max-[900px]:shadow-2xl';
const notesSidebarOpenClass = 'max-[900px]:block';
const notesOverlayClass = 'fixed inset-0 z-[80] hidden bg-slate-950/35 backdrop-blur-sm max-[900px]:block';
const notesListClass = 'flex flex-col gap-3';
const notesTreeGroupClass = 'flex flex-col gap-2.5';
const notesToggleBaseClass = 'flex w-full items-center justify-between gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5 text-left text-inherit shadow-none filter-none';
const notesTopicToggleClass = 'ml-3 w-[calc(100%_-_12px)] bg-surface-1 max-[900px]:ml-0 max-[900px]:w-full';
const notesToggleOpenClass = 'border-brand-primary/20';
const notesToggleCopyClass = 'flex flex-col gap-1 [&_strong]:text-[15px] [&_strong]:text-ink-strong [&_small]:text-[11.5px] [&_small]:text-ink-soft';
const notesTreeCaretClass = 'grid size-7 shrink-0 place-items-center rounded-full bg-surface-1 text-base font-bold text-ink-medium';
const notesTopicLessonsClass = 'ml-7 flex flex-col gap-2.5 max-[900px]:ml-0';
const notesLessonChipClass = 'flex w-full flex-col items-start gap-1 rounded-md border border-line-soft bg-surface-glass-subtle px-3.5 py-3 text-left text-inherit shadow-none filter-none';
const notesLessonChipSelectedClass = 'border-brand-primary/30 bg-[color-mix(in_srgb,var(--surface-glass-subtle)_72%,rgba(37,99,235,0.1))] shadow-[0_0_0_1px_rgba(37,99,235,0.12)]';
const notesViewerPanelClass = 'overflow-hidden';
const notesStudyViewerPanelClass = 'p-[clamp(28px,4vw,40px)]';
const notesViewerShellClass = 'flex min-h-full flex-col gap-4';
const notesViewerHeadClass = 'flex flex-col gap-2 border-b border-line-soft pb-3.5 max-[900px]:flex-row max-[900px]:items-center max-[900px]:justify-between max-[900px]:gap-3 max-[900px]:[&_.eyebrow]:hidden max-[900px]:[&_h2]:hidden max-[900px]:[&_p]:hidden';
const notesViewerTitleClass = 'm-0 text-[22px] font-extrabold leading-tight text-ink-strong';
const notesViewerTextClass = 'm-0 text-[13px] leading-normal text-ink-soft';
const notesHintClass = 'rounded-lg border border-line-soft bg-surface-glass-subtle px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft [&_strong]:text-ink-strong';
const notesPaperClass = cx(ui.lessonNotebookContent, 'min-h-[70vh] cursor-text select-text [-webkit-user-select:text] [content-visibility:auto] [contain-intrinsic-size:760px]');
const notesStudyPaperClass = 'min-h-[78vh] text-base leading-[1.85]';
const notesCrudStackClass = 'flex flex-col gap-3';
const notesEditorCardClass = 'flex flex-col gap-3.5';
const annotationListClass = 'flex flex-col gap-3';
const annotationCardClass = 'flex flex-col gap-3';
const annotationCardHeadClass = 'flex items-center justify-between gap-2.5 [&_small]:text-[11px] [&_small]:text-ink-muted';
const annotationBadgeClass = 'inline-flex items-center rounded-full border border-line-soft bg-surface-1 px-2.5 py-1 text-[11px] font-bold text-ink-soft';
const annotationQuoteClass = 'm-0 rounded-lg border border-line-soft bg-surface-1 px-3.5 py-3 text-[13px] leading-relaxed text-ink-strong';
const annotationMarkBaseClass =
  'rounded-[0.45rem] bg-[color-mix(in_srgb,var(--annotation-color)_72%,transparent)] px-[0.14rem] py-[0.04rem] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]';
const annotationMarkToneClass = {
  note: 'shadow-[inset_0_-2px_0_rgba(99,102,241,0.16)]',
  highlight: 'shadow-[inset_0_-2px_0_rgba(234,179,8,0.16)]',
};

function toPlainText(content) {
  return String(content || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildAnnotatedHtml(plainText, annotations) {
  if (!plainText) {
    return '<p>No lesson content has been added yet.</p>';
  }

  const sorted = [...annotations]
    .filter((item) => Number.isInteger(item.startOffset) && Number.isInteger(item.endOffset))
    .sort((a, b) => a.startOffset - b.startOffset || a.id - b.id);

  let cursor = 0;
  let html = '';

  for (const annotation of sorted) {
    const start = Math.max(cursor, annotation.startOffset);
    const end = Math.min(plainText.length, annotation.endOffset);

    if (end <= start) {
      continue;
    }

    html += escapeHtml(plainText.slice(cursor, start));

    const annotatedText = escapeHtml(plainText.slice(start, end));
    const noteMarker =
      annotation.type === 'note'
        ? `<button type="button" class="ml-1.5 min-h-6 rounded-full border border-indigo-500/20 bg-indigo-200/90 px-2 py-0.5 text-[10.5px] font-extrabold text-indigo-800 shadow-none" data-annotation-id="${annotation.id}" title="Open note">Note</button>`
        : '';

    html += `<mark class="${annotationMarkBaseClass} ${annotationMarkToneClass[annotation.type] || annotationMarkToneClass.highlight}" data-annotation-id="${annotation.id}" style="--annotation-color: ${
      annotation.color || (annotation.type === 'note' ? '#c7d2fe' : '#fff59d')
    }">${annotatedText}${noteMarker}</mark>`;

    cursor = end;
  }

  html += escapeHtml(plainText.slice(cursor));

  return html
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function getSelectionOffsets(container, selection) {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;
  const selectedText = range.toString();

  return {
    selectedText,
    startOffset,
    endOffset: startOffset + selectedText.length,
  };
}

function buildLessonNote(lesson) {
  if (!lesson) {
    return 'Choose a lesson and highlight text to create your first note.';
  }

  return [lesson.courseTitle, lesson.topicName, lesson.subtopicName].filter(Boolean).join(' • ');
}

function buildLessonPills(lesson) {
  if (!lesson) {
    return [];
  }

  const pills = [lesson.courseTitle, lesson.topicName, lesson.subtopicName].filter(Boolean);
  if (lesson.videoUrl) {
    pills.push('Video linked');
  }
  return pills.slice(0, 4);
}

function createEmptyComposer() {
  return {
    mode: 'create',
    annotationId: null,
    selectedText: '',
    startOffset: null,
    endOffset: null,
    noteText: '',
  };
}

function LessonVideoModal({ open, url, onClose }) {
  if (!open) return null;
  const embed = getVideoEmbed(url);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line-soft bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="m-0 text-[18px] font-extrabold text-ink-strong">Lesson video</h2>
            <p className="m-0 mt-1 text-xs text-ink-soft">Video added by your instructor.</p>
          </div>
          <button className={ui.iconButton} type="button" onClick={onClose} aria-label="Close lesson video">×</button>
        </div>
        <div className="space-y-3 p-5">
          <div className="aspect-video overflow-hidden rounded-xl border border-line-soft bg-slate-950">
            {embed?.type === 'iframe' ? (
              <div className="relative h-full w-full bg-black">
                <iframe
                  title="Protected lesson video player"
                  src={embed.src}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                {embed.hideTopChrome ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-black"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ) : embed?.type === 'video' ? (
              <video className="h-full w-full bg-black object-contain" controls src={embed.src} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="m-0 text-sm font-semibold text-white">This link opens outside the lesson viewer.</p>
                {embed?.externalUrl ? <a className={ui.primaryAction} href={embed.externalUrl} target="_blank" rel="noreferrer">Open video</a> : null}
              </div>
            )}
          </div>
          {embed?.externalUrl ? (
            <div className="flex justify-end">
              <a className={ui.secondaryAction} href={embed.externalUrl} target="_blank" rel="noreferrer">Open video in new tab</a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StudentNotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLessonId = Number(searchParams.get('lessonId'));
  const [lessons, setLessons] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [composer, setComposer] = useState(createEmptyComposer);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [studyMode, setStudyMode] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState({ saving: false, deletingId: null });
  const contentRef = useRef(null);

  useEffect(() => {
    async function loadLessons() {
      try {
        const data = await fetchStudentLessons();
        setLessons(data);

        const firstOpenLesson = data.find((lesson) => !lesson.accessLocked && lesson.canAccess !== false);
        const hasRequestedLesson = requestedLessonId && data.some((lesson) => lesson.id === requestedLessonId);
        const requestedLesson = hasRequestedLesson ? data.find((lesson) => lesson.id === requestedLessonId) : null;
        const nextLessonId =
          requestedLesson && !requestedLesson.accessLocked && requestedLesson.canAccess !== false
            ? requestedLessonId
            : firstOpenLesson?.id || data[0]?.id || null;
        setActiveLessonId(nextLessonId);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load notebook lessons'));
      } finally {
        setLoading(false);
      }
    }

    loadLessons();
  }, [requestedLessonId]);

  useEffect(() => {
    if (!activeLessonId) {
      setActiveLesson(null);
      setAnnotations([]);
      setComposer(createEmptyComposer());
      return;
    }

    const summary = lessons.find((item) => item.id === activeLessonId);
    if (summary?.accessLocked || summary?.canAccess === false) {
      setActiveLesson(null);
      setAnnotations([]);
      setComposer(createEmptyComposer());
      setError(summary.lockReason || 'Your subscription does not include this premium lesson.');
      return;
    }

    async function loadLessonState() {
      setDetailLoading(true);
      try {
        const [lessonData, annotationData] = await Promise.all([
          fetchStudentLesson(activeLessonId),
          fetchLessonAnnotations(activeLessonId),
        ]);
        setActiveLesson(lessonData);
        recordStudyActivity({ activityType: 'lesson_viewed', itemId: activeLessonId }).catch(() => {});
        setAnnotations(annotationData);
        setComposer(createEmptyComposer());
        setError('');
      } catch (loadError) {
        setActiveLesson(null);
        setAnnotations([]);
        setError(getErrorMessage(loadError, 'Unable to load notebook lesson'));
      } finally {
        setDetailLoading(false);
      }
    }

    loadLessonState();
  }, [activeLessonId, lessons]);

  const activeLessonSummary = useMemo(
    () => lessons.find((item) => item.id === activeLessonId) || lessons[0] || null,
    [activeLessonId, lessons]
  );
  const groupedLessons = useMemo(() => {
    const subjectMap = new Map();

    for (const lesson of lessons) {
      const subjectKey = lesson.courseTitle || 'General';
      const topicKey = `${subjectKey}::${lesson.topicName || 'General topic'}`;

      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          id: subjectKey,
          title: subjectKey,
          topics: [],
          topicMap: new Map(),
        });
      }

      const subject = subjectMap.get(subjectKey);
      if (!subject.topicMap.has(topicKey)) {
        const topic = {
          id: topicKey,
          title: lesson.topicName || 'General topic',
          lessons: [],
        };
        subject.topicMap.set(topicKey, topic);
        subject.topics.push(topic);
      }

      subject.topicMap.get(topicKey).lessons.push(lesson);
    }

    return Array.from(subjectMap.values()).map((subject) => ({
      id: subject.id,
      title: subject.title,
      topics: subject.topics,
    }));
  }, [lessons]);
  const plainLessonText = useMemo(() => toPlainText(activeLesson?.lessonContent || ''), [activeLesson?.lessonContent]);
  const renderedLessonHtml = useMemo(() => buildAnnotatedHtml(plainLessonText, annotations), [annotations, plainLessonText]);
  const noteAnnotations = useMemo(() => annotations.filter((annotation) => annotation.type === 'note'), [annotations]);
  const activeVideoUrl = activeLesson?.videoUrl || activeLessonSummary?.videoUrl || '';

  useEffect(() => {
    if (!groupedLessons.length) {
      return;
    }

    setExpandedSubjects((current) => {
      const next = { ...current };
      for (const subject of groupedLessons) {
        if (!(subject.id in next)) {
          next[subject.id] = true;
        }
      }
      return next;
    });

    setExpandedTopics((current) => {
      const next = { ...current };
      for (const subject of groupedLessons) {
        for (const topic of subject.topics) {
          if (!(topic.id in next)) {
            next[topic.id] = true;
          }
        }
      }
      return next;
    });
  }, [groupedLessons]);

  useEffect(() => {
    if (!activeLessonSummary) {
      return;
    }

    const subjectKey = activeLessonSummary.courseTitle || 'General';
    const topicKey = `${subjectKey}::${activeLessonSummary.topicName || 'General topic'}`;
    setExpandedSubjects((current) => ({ ...current, [subjectKey]: true }));
    setExpandedTopics((current) => ({ ...current, [topicKey]: true }));
  }, [activeLessonSummary]);

  async function refreshAnnotations() {
    if (!activeLessonId) {
      return;
    }
    if (activeLessonSummary?.accessLocked || activeLessonSummary?.canAccess === false) {
      return;
    }

    const data = await fetchLessonAnnotations(activeLessonId);
    setAnnotations(data);
  }

  function handleSelectLesson(lessonId) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (lesson?.accessLocked || lesson?.canAccess === false) {
      setActiveLessonId(lessonId);
      setActiveLesson(null);
      setAnnotations([]);
      setError(lesson.lockReason || 'Your subscription does not include this premium lesson.');
      setLibraryOpen(false);
      return;
    }

    setActiveLessonId(lessonId);
    setLibraryOpen(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('lessonId', String(lessonId));
      return next;
    });
  }

  function toggleSubject(subjectId) {
    setExpandedSubjects((current) => ({
      ...current,
      [subjectId]: !current[subjectId],
    }));
  }

  function toggleTopic(topicId) {
    setExpandedTopics((current) => ({
      ...current,
      [topicId]: !current[topicId],
    }));
  }

  function handleSelectionCapture() {
    if (studyMode) {
      return;
    }
    const selection = window.getSelection();
    const range = getSelectionOffsets(contentRef.current, selection);

    if (!range || !range.selectedText.trim()) {
      return;
    }

    setComposer({
      mode: 'create',
      annotationId: null,
      selectedText: range.selectedText.trim(),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      noteText: '',
    });
  }

  function handleComposerChange(event) {
    const { value } = event.target;
    setComposer((current) => ({ ...current, noteText: value }));
  }

  function resetComposer() {
    setComposer(createEmptyComposer());
    window.getSelection()?.removeAllRanges();
  }

  async function handleSaveNote() {
    if (!activeLessonId) {
      return;
    }

    if (!composer.noteText.trim()) {
      setError('Note text is required before saving.');
      return;
    }

    if (composer.mode === 'create' && (!composer.selectedText || !Number.isInteger(composer.startOffset) || !Number.isInteger(composer.endOffset))) {
      setError('Select text from the notebook before creating a note.');
      return;
    }

    setActionState((current) => ({ ...current, saving: true }));
    try {
      if (composer.mode === 'edit' && composer.annotationId) {
        await updateLessonAnnotation(activeLessonId, composer.annotationId, {
          noteText: composer.noteText.trim(),
          color: '#c7d2fe',
        });
      } else {
        await createLessonAnnotation(activeLessonId, {
          type: 'note',
          selectedText: composer.selectedText,
          startOffset: composer.startOffset,
          endOffset: composer.endOffset,
          color: '#c7d2fe',
          noteText: composer.noteText.trim(),
        });
      }

      await refreshAnnotations();
      setError('');
      resetComposer();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save note'));
    } finally {
      setActionState((current) => ({ ...current, saving: false }));
    }
  }

  function handleEditNote(annotation) {
    setComposer({
      mode: 'edit',
      annotationId: annotation.id,
      selectedText: annotation.selectedText,
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      noteText: annotation.noteText || '',
    });
  }

  async function handleDeleteNote(annotationId) {
    if (!activeLessonId) {
      return;
    }

    setActionState((current) => ({ ...current, deletingId: annotationId }));
    try {
      await deleteLessonAnnotation(activeLessonId, annotationId);
      await refreshAnnotations();
      if (composer.annotationId === annotationId) {
        resetComposer();
      }
      setError('');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete note'));
    } finally {
      setActionState((current) => ({ ...current, deletingId: null }));
    }
  }

  function handleNotebookClick(event) {
    if (studyMode) {
      return;
    }
    const annotationTarget = event.target.closest('[data-annotation-id]');
    if (!annotationTarget) {
      return;
    }

    const annotationId = Number(annotationTarget.getAttribute('data-annotation-id'));
    const annotation = noteAnnotations.find((item) => item.id === annotationId);
    if (!annotation) {
      return;
    }

    handleEditNote(annotation);
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Notes"
          subtitle="Open the notebook in a calm study view first, then switch to workspace mode only when you want to manage notes."
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={cx(notesLayoutClass, studyMode && notesStudyLayoutClass)}>
          {libraryOpen ? (
            <button className={notesOverlayClass}
              type="button"
             
              onClick={() => setLibraryOpen(false)}
              aria-label="Close lesson notebooks"
            />
          ) : null}

          <section className={cx(ui.compactPanelCard, 'overflow-hidden', notesSidebarDrawerClass, libraryOpen && notesSidebarOpenClass)}>
            <div className={ui.panelTop}>
              <div>
                <h2>Lesson notebooks</h2>
                <p>{loading ? 'Loading lessons...' : `${lessons.length} lesson notebook(s) ready`}</p>
              </div>
              <button className={`${ui.secondaryAction} min-h-[34px]`}
                type="button"
               
                onClick={() => setLibraryOpen(false)}
              >
                Close
              </button>
            </div>

            <div className={notesListClass}>
              {!loading && lessons.length === 0 ? <div className={ui.emptyBox}>No active lessons yet.</div> : null}
              {groupedLessons.map((subject) => (
                <section key={subject.id} className={notesTreeGroupClass}>
                  <button className={cx(notesToggleBaseClass, expandedSubjects[subject.id] && notesToggleOpenClass)}
                    type="button"
                   
                    onClick={() => toggleSubject(subject.id)}
                    aria-expanded={expandedSubjects[subject.id] ? 'true' : 'false'}
                  >
                    <span className={notesToggleCopyClass}>
                      <strong>{subject.title}</strong>
                      <small>{subject.topics.length} topic(s)</small>
                    </span>
                    <span className={notesTreeCaretClass} aria-hidden="true">{expandedSubjects[subject.id] ? '−' : '+'}</span>
                  </button>

                  {expandedSubjects[subject.id] ? (
                    <div className={notesListClass}>
                      {subject.topics.map((topic) => (
                        <div key={topic.id} className={notesTreeGroupClass}>
                          <button className={cx(notesToggleBaseClass, notesTopicToggleClass, expandedTopics[topic.id] && notesToggleOpenClass)}
                            type="button"
                           
                            onClick={() => toggleTopic(topic.id)}
                            aria-expanded={expandedTopics[topic.id] ? 'true' : 'false'}
                          >
                            <span className={notesToggleCopyClass}>
                              <strong>{topic.title}</strong>
                              <small>{topic.lessons.length} notebook(s)</small>
                            </span>
                            <span className={notesTreeCaretClass} aria-hidden="true">{expandedTopics[topic.id] ? '−' : '+'}</span>
                          </button>

                          {expandedTopics[topic.id] ? (
                            <div className={notesTopicLessonsClass}>
                              {topic.lessons.map((lesson) => (
                                <button className={cx(
                                  notesLessonChipClass,
                                  activeLessonSummary?.id === lesson.id && notesLessonChipSelectedClass,
                                  (lesson.accessLocked || lesson.canAccess === false) && 'opacity-70'
                                )}
                                  key={lesson.id}
                                  type="button"
                                 
                                  onClick={() => handleSelectLesson(lesson.id)}
                                >
                                  <span className="m-0 text-[15px] text-ink-strong">
                                    {lesson.subtopicName || lesson.lessonTitle}
                                  </span>
                                  <small className="flex flex-wrap items-center gap-1.5">
                                    {lesson.isFree ? (
                                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                                        Free lesson
                                      </span>
                                    ) : null}
                                    <span>{lesson.accessLocked || lesson.canAccess === false ? 'Included with selected plans' : lesson.lessonTitle}</span>
                                  </small>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </section>

          <section className={cx(ui.panelCard, notesViewerPanelClass, studyMode && notesStudyViewerPanelClass)}>
            <div className={notesViewerShellClass}>
              <div className={notesViewerHeadClass}>
                <span className={ui.eyebrow}>{studyMode ? 'Study View' : 'Notebook Source'}</span>
                <h2 className={notesViewerTitleClass}>{activeLesson?.lessonTitle || activeLessonSummary?.lessonTitle || 'Select a lesson'}</h2>
                <p className={notesViewerTextClass}>{buildLessonNote(activeLesson || activeLessonSummary)}</p>
                <div className={`${ui.buttonRow} mt-3 max-[900px]:mt-0`}>
                  <button className={ui.secondaryAction}
                    type="button"
                   
                    onClick={() => setLibraryOpen(true)}
                  >
                    Lesson Notebooks
                  </button>
                  {activeVideoUrl ? (
                    <button className={ui.secondaryAction}
                      type="button"
                      onClick={() => setVideoOpen(true)}
                    >
                      Watch Video
                    </button>
                  ) : null}
                  <button className={studyMode ? ui.primaryAction : ui.secondaryAction}
                    type="button"
                   
                    onClick={() => setStudyMode(true)}
                  >
                    Study Only
                  </button>
                  <button className={studyMode ? ui.secondaryAction : ui.primaryAction}
                    type="button"
                   
                    onClick={() => setStudyMode(false)}
                  >
                    Open Workspace
                  </button>
                </div>
              </div>

              {!studyMode ? (
                <div className={notesHintClass}>
                  <strong>How to use:</strong> select text in the notebook, release your mouse, then write your note in the editor panel.
                </div>
              ) : null}

              <div className="min-h-0">
                {detailLoading ? <div className={ui.emptyBox}>Opening notebook...</div> : null}
                {!detailLoading && activeLesson ? (
                  <div className="relative">
                    <div
                      ref={contentRef}
                      className={cx(notesPaperClass, studyMode && notesStudyPaperClass, 'relative z-0')}
                      onMouseUp={handleSelectionCapture}
                      onClick={handleNotebookClick}
                      dangerouslySetInnerHTML={{ __html: renderedLessonHtml }}
                    />
                  </div>
                ) : null}
                {!detailLoading && !activeLesson && !loading ? (
                  <div className={ui.emptyBox}>
                    {activeLessonSummary?.accessLocked || activeLessonSummary?.canAccess === false
                      ? activeLessonSummary.lockReason || 'This lesson is included with selected subscriptions.'
                      : 'Select a lesson to open notebook view.'}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {!studyMode ? (
          <section className={cx(ui.compactPanelCard, 'overflow-hidden')}>
            <div className={ui.panelTop}>
              <div>
                <h2>{composer.mode === 'edit' ? 'Edit note' : 'Create note'}</h2>
                <p>{noteAnnotations.length} saved note(s) for this lesson</p>
              </div>
            </div>

            <div className={notesCrudStackClass}>
              <section className={notesEditorCardClass}>
                <span className={ui.eyebrow}>{composer.mode === 'edit' ? 'Update Existing' : 'New Note'}</span>
                <h3 className="m-0 text-[15px] text-ink-strong">{composer.selectedText ? 'Selected lesson text' : 'No text selected yet'}</h3>
                <blockquote className="m-0 rounded-lg border border-line-soft bg-surface-1 px-3.5 py-3 text-[13px] leading-relaxed text-ink-strong">
                  {composer.selectedText || 'Highlight text from the notebook viewer to prepare a new note.'}
                </blockquote>

                <label className="flex flex-col gap-2">
                  <span className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">Your note</span>
                  <textarea className="w-full resize-y"
                   
                    value={composer.noteText}
                    onChange={handleComposerChange}
                    placeholder="Write a concise revision note, memory hook, or reminder..."
                    rows={7}
                  />
                </label>

                <div className={ui.buttonRow}>
                  <button className={ui.primaryAction} type="button" onClick={handleSaveNote} disabled={actionState.saving || !activeLessonId}>
                    {actionState.saving ? 'Saving...' : composer.mode === 'edit' ? 'Update Note' : 'Save Note'}
                  </button>
                  <button type="button" className={ui.secondaryAction} onClick={resetComposer}>
                    Clear
                  </button>
                </div>
              </section>

              <section className={annotationListClass}>
                {noteAnnotations.length === 0 ? <div className={ui.emptyBox}>No notes yet. Select text and save your first one.</div> : null}
                {noteAnnotations.map((annotation) => (
                  <article key={annotation.id} className={annotationCardClass}>
                    <div className={annotationCardHeadClass}>
                      <span className={annotationBadgeClass}>Note</span>
                      <small>{annotation.selectedText.length} chars linked</small>
                    </div>
                    <div className={annotationQuoteClass}>"{annotation.selectedText}"</div>
                    <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">{annotation.noteText || 'No note text added.'}</p>
                    <div className={ui.buttonRow}>
                      <button type="button" className={ui.iconButton} aria-label="Edit note" title="Edit note" onClick={() => handleEditNote(annotation)}>
                        <EditActionIcon />
                      </button>
                      <button className={ui.dangerIconButton}
                        type="button"
                       
                        aria-label="Delete note"
                        title="Delete note"
                        onClick={() => handleDeleteNote(annotation.id)}
                        disabled={actionState.deletingId === annotation.id}
                      >
                        <DeleteActionIcon />
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </section>
          ) : null}
        </div>
      </section>
      <LessonVideoModal open={videoOpen} url={activeVideoUrl} onClose={() => setVideoOpen(false)} />
    </main>
  );
}
