import { cx, ui } from '../../../styles/tailwindClasses.js';

const aiPreviewUi = {
  panel: 'grid gap-4',
  questionCard:
    'grid gap-3 rounded-xl border border-line-soft bg-surface-1 px-5 py-[18px]',
  questionHead:
    'flex flex-wrap items-baseline gap-2.5 [&_strong]:flex-1 [&_strong]:text-[15px] [&_strong]:font-bold [&_strong]:leading-normal [&_strong]:text-ink-strong',
  questionTitle: 'm-0 text-base font-bold leading-snug text-ink-strong',
  meta:
    'flex flex-wrap gap-2 [&_span]:inline-flex [&_span]:items-center [&_span]:rounded-full [&_span]:border [&_span]:border-line-soft [&_span]:bg-surface-2 [&_span]:px-[9px] [&_span]:py-[3px] [&_span]:text-[11.5px] [&_span]:font-bold [&_span]:text-ink-soft',
  optionList: 'm-0 grid list-none gap-2 p-0',
  optionItem:
    'flex items-start gap-2.5 rounded-md border border-line-soft bg-surface-glass-subtle px-3.5 py-2.5 text-[13.5px] leading-normal text-ink-medium',
  optionKey:
    'inline-flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border border-line-soft bg-surface-2 text-[11px] font-extrabold text-ink-medium',
  answerStrip:
    'flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--color-success)_28%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-success)_8%,var(--surface-1))] px-3 py-2 text-[12.5px] font-bold text-brand-success',
  explanation:
    'm-0 rounded-md border-l-[3px] border-brand-primary bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--surface-1))] px-3.5 py-2.5 text-[13px] leading-[1.65] text-ink-medium',
  reason:
    'mt-1 block text-[12px] font-medium leading-relaxed text-ink-soft',
  statementList: 'grid gap-2',
  statementRow:
    'flex items-center gap-2.5 rounded-md border border-line-soft bg-surface-glass-subtle px-3.5 py-[9px] text-[13.5px] text-ink-medium',
  boolPill:
    'ml-auto inline-flex min-h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-extrabold',
  boolTrue:
    'border-brand-success/25 bg-[var(--color-success-light)] text-brand-success',
  boolFalse:
    'border-brand-error/20 bg-brand-error/10 text-brand-error',
  settingsBar:
    'flex flex-wrap items-end gap-3 border-b border-line-soft py-3.5 [&_span]:rounded-full [&_span]:border [&_span]:border-line-soft [&_span]:bg-surface-2 [&_span]:px-2.5 [&_span]:py-1 [&_span]:text-xs [&_span]:font-bold [&_span]:text-ink-soft',
  previewStack: 'flex flex-col gap-4',
  emptyState: 'px-5 py-10 text-center text-[13.5px] text-ink-soft',
};

function getOptionText(option) {
  if (typeof option === 'object' && option !== null) {
    return String(option.text ?? option.option_text ?? option.optionText ?? '').trim();
  }
  return String(option || '').trim();
}

function getOptionReason(option) {
  if (typeof option === 'object' && option !== null) {
    return String(option.why_incorrect ?? option.whyIncorrect ?? option.reason ?? option.explanation ?? '').trim();
  }
  return '';
}

function getQuestionType(item) {
  return String(item?.question_type ?? item?.questionType ?? '').trim();
}

function getQuestionText(item) {
  return String(item?.question_text ?? item?.questionText ?? item?.question ?? '').trim();
}

function getOptionLabel(option, index) {
  if (typeof option === 'object' && option !== null && option.label) {
    return String(option.label).trim().toUpperCase();
  }
  return String.fromCharCode(65 + index);
}

function getCorrectAnswer(item) {
  return String(item?.correct_answer ?? item?.correctAnswer ?? '').trim();
}

function normalizeAiBooleanValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', 'yes', 'y', '1'].includes(normalized)) {
      return true;
    }

    if (['false', 'f', 'no', 'n', '0'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function SbaPreviewCard({ item, index }) {
  return (
    <article className={aiPreviewUi.questionCard}>
      <div className={aiPreviewUi.questionHead}>
        <span className={ui.tablePill}>SBA</span>
        <strong>Question {index + 1}</strong>
      </div>
      <h3 className={aiPreviewUi.questionTitle}>{getQuestionText(item)}</h3>
      <div className={aiPreviewUi.meta}>
        <span>{item.course || 'No course'}</span>
        <span>{item.subject || 'No subject'}</span>
        <span>{item.topic || 'No topic'}</span>
        <span>{item.lesson || 'No lesson'}</span>
      </div>
      <ol className={aiPreviewUi.optionList}>
        {item.options.map((option, optionIndex) => (
          <li className={aiPreviewUi.optionItem} key={`${getQuestionText(item)}-${optionIndex}`}>
            <span className={aiPreviewUi.optionKey}>{getOptionLabel(option, optionIndex)}</span>
            <span>
              {getOptionText(option)}
              {getOptionReason(option) ? <span className={aiPreviewUi.reason}>{getOptionReason(option)}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <div className={aiPreviewUi.answerStrip}>
        <strong>Correct answer:</strong>
        <span>{getCorrectAnswer(item)}</span>
      </div>
      <p className={aiPreviewUi.explanation}>{item.explanation}</p>
    </article>
  );
}

function TrueFalsePreviewCard({ item, index }) {
  return (
    <article className={aiPreviewUi.questionCard}>
      <div className={aiPreviewUi.questionHead}>
        <span className={ui.tablePill}>True / False</span>
        <strong>Question {index + 1}</strong>
      </div>
      <h3 className={aiPreviewUi.questionTitle}>{getQuestionText(item)}</h3>
      <div className={aiPreviewUi.meta}>
        <span>{item.course || 'No course'}</span>
        <span>{item.subject || 'No subject'}</span>
        <span>{item.topic || 'No topic'}</span>
        <span>{item.lesson || 'No lesson'}</span>
      </div>
      <div className={aiPreviewUi.statementList}>
        {(item.statements || item.options || []).map((statement, statementIndex) => (
          <div key={`${getQuestionText(item)}-${statementIndex}`} className={aiPreviewUi.statementRow}>
            <div>
              <strong>{statementIndex + 1}.</strong> {statement.text}
              {getOptionReason(statement) ? <span className={aiPreviewUi.reason}>{getOptionReason(statement)}</span> : null}
            </div>
            <span className={cx(aiPreviewUi.boolPill, normalizeAiBooleanValue(statement.answer) ? aiPreviewUi.boolTrue : aiPreviewUi.boolFalse)}>
              {normalizeAiBooleanValue(statement.answer) ? 'True' : 'False'}
            </span>
          </div>
        ))}
      </div>
      <p className={aiPreviewUi.explanation}>{item.explanation}</p>
    </article>
  );
}

export function AiQuizPreview({ result, onCopyJson, onDownloadJson, onSaveQuestions, onSaveQuiz = null, hideSaveQuestions = false, isSaving, providerLabel = 'AI', saveQuizLabel = 'Save Quiz + Questions' }) {
  if (!result) {
    return (
      <section className={cx(ui.panelCard, aiPreviewUi.panel)}>
        <div className={ui.panelTop}>
          <div>
            <h2>Preview</h2>
            <p>Generated quiz items will appear here for manual review only.</p>
          </div>
        </div>
        <div className={cx(ui.tableEmpty, aiPreviewUi.emptyState)}>
          Generate a quiz to preview experimental AI output. Nothing is saved automatically.
        </div>
      </section>
    );
  }

  return (
    <section className={cx(ui.panelCard, aiPreviewUi.panel)}>
      <div className={ui.panelTop}>
        <div>
          <h2>Generated Preview</h2>
          <p>
            {result.items.length} question(s) generated by {result.provider?.label || providerLabel}. Review carefully before using anywhere else.
          </p>
        </div>
        <div className={ui.buttonRow}>
          <button type="button" className={ui.secondaryAction} onClick={onCopyJson}>
            Copy JSON
          </button>
          <button type="button" className={ui.secondaryAction} onClick={onDownloadJson}>
            Download JSON
          </button>
          {!hideSaveQuestions ? (
            <button type="button" className={ui.primaryAction} onClick={onSaveQuestions} disabled={isSaving}>
              {isSaving ? 'Saving to Questions...' : 'Save to Questions'}
            </button>
          ) : null}
          {onSaveQuiz ? (
            <button type="button" className={ui.primaryAction} onClick={onSaveQuiz} disabled={isSaving}>
              {isSaving ? 'Saving quiz...' : saveQuizLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className={aiPreviewUi.settingsBar}>
        <span>{result.settings.category}</span>
        <span>{result.settings.questionType}</span>
        <span>{result.settings.difficulty}</span>
        <span>{result.settings.numberOfQuestions} requested</span>
      </div>

      <div className={aiPreviewUi.previewStack}>
        {result.items.map((item, index) =>
          getQuestionType(item) === 'sba' ? (
            <SbaPreviewCard key={`ai-item-${index}`} item={item} index={index} />
          ) : (
            <TrueFalsePreviewCard key={`ai-item-${index}`} item={item} index={index} />
          )
        )}
      </div>
    </section>
  );
}
