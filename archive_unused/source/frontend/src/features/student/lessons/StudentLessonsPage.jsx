import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createLessonAnnotation,
  deleteLessonAnnotation,
  fetchLessonAnnotations,
  fetchStudentLesson,
  fetchStudentLessons,
  updateLessonAnnotation,
} from '../../../api/lessons.api.js';
import { getErrorMessage } from '../../../api/client.js';
import HeadacheFacialPainNotes from '../../../components/lessons/HeadacheFacialPainNotes.jsx';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../components/ui/ActionIcons.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const lessonUi = {
  layoutGrid:
    'grid grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(220px,300px)] items-start gap-5 max-[1080px]:grid-cols-1',
  lessonView: 'flex flex-col gap-4',
  demoView: 'py-1',
  demoCard:
    'relative cursor-pointer rounded-lg border border-line-soft bg-surface-glass-subtle p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-md',
  selectedCard: 'border-brand-primary/45 bg-brand-primary-light/40 shadow-md',
  notebookShell: 'relative overflow-hidden rounded-xl border border-line-soft bg-surface-1',
  doodleBase: 'pointer-events-none absolute select-none text-2xl opacity-[0.08]',
  doodleOne: 'right-[18px] top-3 -rotate-12',
  doodleTwo: 'bottom-4 right-7 rotate-[8deg] text-lg',
  doodleThree: 'bottom-3.5 left-5 -rotate-[6deg] text-xl',
  notebookHero:
    'border-b border-line-soft bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))] px-[22px] pb-4 pt-5',
  notebookTopline: 'mb-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted',
  notebookHeader: 'grid grid-cols-[auto_1fr_auto] items-start gap-3.5 max-[720px]:grid-cols-1',
  notebookBadge: 'mt-1 shrink-0 text-[28px] leading-none',
  notebookTitleWrap: 'flex min-w-0 flex-col gap-1',
  notebookTitle: 'm-0 text-[clamp(17px,2vw,21px)] font-extrabold leading-tight text-ink-strong',
  notebookScribble: 'my-0.5 mb-1 h-0.5 w-12 rounded bg-[var(--brand-gradient-primary)]',
  metaLine: 'm-0 text-xs leading-snug text-ink-soft',
  annotationToolbar: 'flex shrink-0 flex-col gap-1.5 max-[720px]:flex-row max-[720px]:flex-wrap',
  annotationButton: 'min-h-[30px] px-3 text-xs',
  activeTool: 'border-brand-primary/30 bg-brand-primary/15 text-brand-primary',
  annotationList: 'flex flex-col gap-3.5',
  annotationCard: 'flex flex-col gap-3 rounded-xl border border-line-soft bg-surface-glass-subtle p-4 shadow-xs',
  annotationQuote: 'm-0 rounded-lg border border-line-soft bg-surface-1 px-3.5 py-3 text-[13px] leading-relaxed text-ink-strong',
  annotationText: 'm-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft',
  notebookTabs: 'mt-3.5 flex flex-wrap gap-1.5',
  notebookTab:
    'inline-flex cursor-default items-center rounded-full border border-line-soft bg-surface-glass-subtle px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft',
  notebookTabButton:
    'cursor-pointer border-brand-primary/25 text-brand-primary hover:bg-brand-primary/10',
  videoLink:
    'inline-flex items-center gap-1.5 self-start rounded-md border border-brand-primary/25 bg-brand-primary/10 px-3.5 py-2 text-[13px] font-bold text-brand-primary no-underline transition hover:-translate-y-px hover:bg-brand-primary/15',
  paperHint:
    'rounded-lg border border-line-soft bg-surface-glass-subtle px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft [&_strong]:text-ink-strong',
  compactRowContent: 'flex min-w-0 w-full flex-col gap-1',
  compactRowTitle: 'm-0 text-sm font-bold leading-snug text-ink-strong',
  compactRowMeta: 'm-0 text-xs text-ink-soft',
};
const annotationMarkBaseClass =
  'rounded-[0.45rem] bg-[color-mix(in_srgb,var(--annotation-color)_72%,transparent)] px-[0.14rem] py-[0.04rem] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]';
const annotationMarkToneClass = {
  note: 'shadow-[inset_0_-2px_0_rgba(99,102,241,0.16)]',
  highlight: 'shadow-[inset_0_-2px_0_rgba(234,179,8,0.16)]',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

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
        ? `<button type="button" class="ml-1.5 min-h-6 rounded-full border border-indigo-500/20 bg-indigo-200/90 px-2 py-0.5 text-[10.5px] font-extrabold text-indigo-800 shadow-none" data-annotation-id="${annotation.id}" title="Note attached">Note</button>`
        : '';

    html += `<mark class="${annotationMarkBaseClass} ${annotationMarkToneClass[annotation.type] || annotationMarkToneClass.highlight}" data-annotation-id="${annotation.id}" style="--annotation-color: ${
      annotation.color || '#fff59d'
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

  const text = range.toString();
  return {
    selectedText: text,
    startOffset,
    endOffset: startOffset + text.length,
  };
}

export function StudentLessonsPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [viewerMode, setViewerMode] = useState('lesson');
  const [mode, setMode] = useState('highlight');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState({ saving: false, deletingId: null, editingId: null });
  const paperRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchStudentLessons();
        setLessons(data);
        if (data[0]) {
          setSelectedLessonId(data[0].id);
          setViewerMode('lesson');
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load lessons'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!selectedLessonId) {
      setSelectedLesson(null);
      setAnnotations([]);
      return;
    }

    async function loadLessonState() {
      setDetailLoading(true);
      try {
        const [lessonData, annotationData] = await Promise.all([
          fetchStudentLesson(selectedLessonId),
          fetchLessonAnnotations(selectedLessonId),
        ]);
        setSelectedLesson(lessonData);
        setAnnotations(annotationData);
        setError('');
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load lesson details'));
      } finally {
        setDetailLoading(false);
      }
    }

    loadLessonState();
  }, [selectedLessonId]);

  const selectedLessonSummary = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[0] || null,
    [lessons, selectedLessonId]
  );

  const plainLessonText = useMemo(() => toPlainText(selectedLesson?.lessonContent || ''), [selectedLesson?.lessonContent]);
  const renderedLessonHtml = useMemo(() => buildAnnotatedHtml(plainLessonText, annotations), [plainLessonText, annotations]);
  const noteAnnotations = useMemo(() => annotations.filter((item) => item.type === 'note'), [annotations]);

  async function refreshAnnotations() {
    if (!selectedLessonId) {
      return;
    }

    const data = await fetchLessonAnnotations(selectedLessonId);
    setAnnotations(data);
  }

  async function handleSelectionAction() {
    if (!selectedLessonId || !paperRef.current) {
      return;
    }

    const selection = window.getSelection();
    const range = getSelectionOffsets(paperRef.current, selection);
    if (!range || !range.selectedText.trim()) {
      return;
    }

    const payload = {
      type: mode === 'note' ? 'note' : 'highlight',
      selectedText: range.selectedText.trim(),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      color: mode === 'note' ? '#c7d2fe' : '#fff59d',
      noteText: '',
    };

    if (mode === 'note') {
      const noteText = window.prompt('Add your note for this selection');
      if (!noteText || !noteText.trim()) {
        selection?.removeAllRanges();
        return;
      }
      payload.noteText = noteText.trim();
    }

    setActionState((current) => ({ ...current, saving: true }));
    try {
      await createLessonAnnotation(selectedLessonId, payload);
      await refreshAnnotations();
      setError('');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save annotation'));
    } finally {
      setActionState((current) => ({ ...current, saving: false }));
      selection?.removeAllRanges();
    }
  }

  async function handlePaperClick(event) {
    if (mode !== 'erase') {
      return;
    }

    const annotationTarget = event.target.closest('[data-annotation-id]');
    if (!annotationTarget) {
      return;
    }

    const annotationId = Number(annotationTarget.getAttribute('data-annotation-id'));
    if (!annotationId) {
      return;
    }

    setActionState((current) => ({ ...current, deletingId: annotationId }));
    try {
      await deleteLessonAnnotation(selectedLessonId, annotationId);
      await refreshAnnotations();
      setError('');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to remove annotation'));
    } finally {
      setActionState((current) => ({ ...current, deletingId: null }));
    }
  }

  async function handleEditNote(annotation) {
    const noteText = window.prompt('Edit your note', annotation.noteText || '');
    if (noteText === null) {
      return;
    }

    setActionState((current) => ({ ...current, editingId: annotation.id }));
    try {
      await updateLessonAnnotation(selectedLessonId, annotation.id, { noteText: noteText.trim() });
      await refreshAnnotations();
      setError('');
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Unable to update note'));
    } finally {
      setActionState((current) => ({ ...current, editingId: null }));
    }
  }

  async function handleDeleteAnnotation(annotationId) {
    setActionState((current) => ({ ...current, deletingId: annotationId }));
    try {
      await deleteLessonAnnotation(selectedLessonId, annotationId);
      await refreshAnnotations();
      setError('');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete annotation'));
    } finally {
      setActionState((current) => ({ ...current, deletingId: null }));
    }
  }

  function handleSelectLesson(lessonId) {
    setViewerMode('lesson');
    setSelectedLessonId(lessonId);
  }

  function openNotesForLesson(lessonId) {
    navigate(`/notes?lessonId=${lessonId}`);
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Lessons"
          subtitle="Read each lesson in a protected notebook view, then add your own highlights and notes without changing the teacher’s original text."
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={lessonUi.layoutGrid}>
          <section className={cx(ui.panelCard, ui.compactPanel)}>
            <div className={ui.panelTop}>
              <div>
                <h2>Lesson library</h2>
                <p>{loading ? 'Loading lessons...' : `${lessons.length} active lesson(s)`}</p>
              </div>
            </div>

            <article
              className={cx(lessonUi.demoCard, viewerMode === 'demo' && lessonUi.selectedCard)}
              onClick={() => setViewerMode('demo')}
            >
              <span className={ui.eyebrow}>Notebook Demo</span>
              <h3>Headache & Facial Pain</h3>
              <p>Open the doodle-notes lesson mockup right inside the viewer panel with the same soft LMS tone.</p>
              <div className={ui.buttonRow}>
                <button className={ui.secondaryAction}
                  type="button"
                 
                  onClick={(event) => {
                    event.stopPropagation();
                    setViewerMode('demo');
                  }}
                >
                  Open In Viewer
                </button>
              </div>
            </article>

            <div className={ui.courseList}>
              {loading ? <div className={ui.emptyBox}>Loading lessons...</div> : null}
              {!loading && lessons.length === 0 ? <div className={ui.emptyBox}>No active lessons yet.</div> : null}
              {!loading &&
                lessons.map((lesson) => (
                  <article
                    key={lesson.id}
                    className={cx(
                      ui.courseRowCard,
                      'cursor-pointer items-start',
                      selectedLessonSummary?.id === lesson.id && 'border-brand-primary/45 bg-brand-primary-light/40 shadow-md'
                    )}
                    onClick={() => handleSelectLesson(lesson.id)}
                  >
                    <div className={lessonUi.compactRowContent}>
                      <h3 className={lessonUi.compactRowTitle}>{lesson.lessonTitle}</h3>
                      <p className={lessonUi.compactRowMeta}>
                        {lesson.courseTitle || 'General'} • {lesson.topicName || 'Subject'}
                        {lesson.subtopicName ? ` • ${lesson.subtopicName}` : ''}
                      </p>
                      <div className={ui.tableSubtext}>{lesson.excerpt}</div>
                      <div className={ui.buttonRow}>
                        <button className={ui.secondaryAction}
                          type="button"
                         
                          onClick={(event) => {
                            event.stopPropagation();
                            openNotesForLesson(lesson.id);
                          }}
                        >
                          Open In Notes
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </section>

          <section className={cx(ui.panelCard, 'lesson-paper-panel', viewerMode === 'demo' && 'lesson-paper-panel-demo')}>
            {viewerMode === 'demo' ? (
              <div className={cx(lessonUi.lessonView, lessonUi.demoView)}>
                <HeadacheFacialPainNotes embedded />
              </div>
            ) : selectedLesson ? (
              <div className={lessonUi.lessonView}>
                <div className={lessonUi.notebookShell}>
                  <div className={cx(lessonUi.doodleBase, lessonUi.doodleOne)} aria-hidden="true">✿</div>
                  <div className={cx(lessonUi.doodleBase, lessonUi.doodleTwo)} aria-hidden="true">✦</div>
                  <div className={cx(lessonUi.doodleBase, lessonUi.doodleThree)} aria-hidden="true">☕</div>

                  <header className={lessonUi.notebookHero}>
                    <div className={lessonUi.notebookTopline}>ERPM LMS Notes</div>
                    <div className={lessonUi.notebookHeader}>
                      <div className={lessonUi.notebookBadge} aria-hidden="true">📘</div>

                      <div className={lessonUi.notebookTitleWrap}>
                        <h2 className={lessonUi.notebookTitle}>{selectedLesson.lessonTitle}</h2>
                        <div className={lessonUi.notebookScribble} aria-hidden="true" />
                        <p className={lessonUi.metaLine}>
                          {selectedLesson.courseTitle || 'General'} • {selectedLesson.topicName || 'Subject'}
                          {selectedLesson.subtopicName ? ` • ${selectedLesson.subtopicName}` : ''}
                        </p>
                      </div>

                      <div className={lessonUi.annotationToolbar}>
                        <button className={cx(ui.secondaryButton, lessonUi.annotationButton, mode === 'highlight' && lessonUi.activeTool)}
                          type="button"
                         
                          onClick={() => setMode('highlight')}
                        >
                          Highlight
                        </button>
                        <button className={cx(ui.secondaryButton, lessonUi.annotationButton, mode === 'note' && lessonUi.activeTool)}
                          type="button"
                         
                          onClick={() => setMode('note')}
                        >
                          Add Note
                        </button>
                        <button className={cx(ui.secondaryButton, lessonUi.annotationButton, mode === 'erase' && lessonUi.activeTool)}
                          type="button"
                         
                          onClick={() => setMode('erase')}
                        >
                          Erase Own
                        </button>
                      </div>
                    </div>

                    <div className={lessonUi.notebookTabs} aria-label="Lesson metadata">
                      <span className={lessonUi.notebookTab}>{selectedLesson.courseTitle || 'General course'}</span>
                      <span className={lessonUi.notebookTab}>{selectedLesson.topicName || 'Subject lesson'}</span>
                      {selectedLesson.subtopicName ? <span className={lessonUi.notebookTab}>{selectedLesson.subtopicName}</span> : null}
                      <span className={lessonUi.notebookTab}>{noteAnnotations.length} note(s)</span>
                      <span
                        className={cx(lessonUi.notebookTab, lessonUi.notebookTabButton)}
                        role="button"
                        tabIndex={0}
                        onClick={() => openNotesForLesson(selectedLesson.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openNotesForLesson(selectedLesson.id);
                          }
                        }}
                      >
                        Open in notes
                      </span>
                    </div>
                  </header>
                </div>

                {selectedLesson.videoUrl ? (
                  <a className={lessonUi.videoLink} href={selectedLesson.videoUrl} target="_blank" rel="noreferrer">
                    Open lesson video
                  </a>
                ) : null}

                <div className={lessonUi.paperHint}>
                  <strong>How to use:</strong> select text, then release your mouse to add a highlight or note. Switch to
                  `Erase Own` and click your own annotation to remove it.
                </div>

                <div
                  ref={paperRef}
                  className={cx(ui.lessonNotebookContent, `mode-${mode}`)}
                  onMouseUp={handleSelectionAction}
                  onClick={handlePaperClick}
                  dangerouslySetInnerHTML={{ __html: renderedLessonHtml }}
                />

                {detailLoading || actionState.saving ? <div className={ui.tableSubtext}>Syncing your lesson annotations...</div> : null}
              </div>
            ) : (
              <div className={ui.emptyBox}>Select a lesson to start reading.</div>
            )}
          </section>

          <section className={cx(ui.panelCard, ui.compactPanel)}>
            <div className={ui.panelTop}>
              <div>
                <h2>Your notes</h2>
                <p>{noteAnnotations.length} saved note(s) for this lesson</p>
              </div>
            </div>

            <div className={lessonUi.annotationList}>
              {viewerMode === 'demo' ? (
                <div className={ui.emptyBox}>Notebook demo mode is open. Select a real lesson to view and manage your notes.</div>
              ) : null}
              {viewerMode !== 'demo' && noteAnnotations.length === 0 ? (
                <div className={ui.emptyBox}>No notes yet. Select text and choose `Add Note`.</div>
              ) : null}
              {viewerMode !== 'demo' &&
                noteAnnotations.map((annotation) => (
                <article key={annotation.id} className={lessonUi.annotationCard}>
                  <div className={lessonUi.annotationQuote}>"{annotation.selectedText}"</div>
                  <p className={lessonUi.annotationText}>{annotation.noteText || 'No note text added.'}</p>
                  <div className={ui.buttonRow}>
                    <button className={ui.iconButton}
                      type="button"
                     
                      aria-label="Edit note"
                      title="Edit note"
                      onClick={() => handleEditNote(annotation)}
                      disabled={actionState.editingId === annotation.id}
                    >
                      <EditActionIcon />
                    </button>
                    <button className={ui.dangerIconButton}
                      type="button"
                     
                      aria-label="Delete note"
                      title="Delete note"
                      onClick={() => handleDeleteAnnotation(annotation.id)}
                      disabled={actionState.deletingId === annotation.id}
                    >
                      <DeleteActionIcon />
                    </button>
                  </div>
                </article>
                ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
