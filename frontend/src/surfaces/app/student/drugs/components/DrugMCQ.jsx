import { useState } from 'react';
import './DrugMCQ.css';

const QUESTION_LABELS = {
  drug_class:        'What class does this drug belong to?',
  uses:              'What is this drug primarily used for?',
  warnings:          'What is the main warning for this drug?',
  pregnancy_info:    'What is the pregnancy safety status of this drug?',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function DrugMCQ({ drug, distractors, questionType, onAnswered }) {
  const correctAnswer = drug[questionType] || '—';
  const [options] = useState(() =>
    shuffle([correctAnswer, ...distractors.slice(0, 3)])
  );
  const [selected, setSelected] = useState(null);

  function pick(opt) {
    if (selected) return;
    setSelected(opt);
    const correct = opt === correctAnswer;
    setTimeout(() => onAnswered(correct), 900);
  }

  const question = QUESTION_LABELS[questionType] || 'What do you know about this drug?';

  return (
    <div className="mcq-root">
      <p className="mcq-drug-name">{drug.name}</p>
      <p className="mcq-question">{question}</p>
      <div className="mcq-options">
        {options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrect  = opt === correctAnswer;
          const state = !selected
            ? ''
            : isCorrect
              ? 'correct'
              : isSelected
                ? 'wrong'
                : 'dim';
          return (
            <button
              key={i}
              className={`mcq-option mcq-option--${state || 'idle'}`}
              onClick={() => pick(opt)}
              disabled={!!selected}
            >
              <span className="mcq-option-letter">{String.fromCharCode(65 + i)}</span>
              <span className="mcq-option-text">{opt}</span>
              {state === 'correct' && <span className="mcq-tick" aria-hidden="true">✓</span>}
              {state === 'wrong'   && <span className="mcq-cross" aria-hidden="true">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
