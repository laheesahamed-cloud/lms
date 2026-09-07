import { strict as assert } from 'node:assert';
import { QuizAttemptsService } from '../src/modules/quiz-attempts/quiz-attempts.service';

const service = new QuizAttemptsService({} as any, {} as any) as any;

const sbaQuestion = {
  id: 101,
  question_type: 'sba',
  question_text: 'Most likely diagnosis?',
  explanation: 'Reviewed explanation.',
  contentVersion: 4,
  contentVersionedAt: '2026-05-31T08:00:00.000Z',
  contentSourceLabel: 'Question bank #101',
  theoryRecap: null,
  options: [
    { id: 1, optionLabel: 'A', optionText: 'Acute coronary syndrome', isCorrect: 1, whyIncorrect: '' },
    { id: 2, optionLabel: 'B', optionText: 'Pneumonia', isCorrect: 0, whyIncorrect: 'Fever and consolidation would be expected.' },
  ],
};

const trueFalseQuestion = {
  id: 102,
  question_type: 'true_false',
  question_text: 'Select true statements.',
  explanation: 'Reviewed T/F explanation.',
  contentVersion: 2,
  contentVersionedAt: '2026-05-31T08:00:00.000Z',
  contentSourceLabel: 'Question bank #102',
  theoryRecap: null,
  options: [
    { id: 11, optionLabel: 'A', optionText: 'Troponin may rise in ACS.', isCorrect: 1, whyIncorrect: '' },
    { id: 12, optionLabel: 'B', optionText: 'Normal ECG excludes ACS.', isCorrect: 0, whyIncorrect: 'Normal ECG does not exclude ACS.' },
    { id: 13, optionLabel: 'C', optionText: 'Serial testing can be needed.', isCorrect: 1, whyIncorrect: '' },
    { id: 14, optionLabel: 'D', optionText: 'Risk stratification is useful.', isCorrect: 1, whyIncorrect: '' },
    { id: 15, optionLabel: 'E', optionText: 'All chest pain is ACS.', isCorrect: 0, whyIncorrect: 'Chest pain has many causes.' },
  ],
};

function testSbaIntegrity() {
  assert.equal(
    service.evaluateAnswer(sbaQuestion, { selectedIds: [1], tfMap: {} }),
    'correct',
    'SBA correct option must be marked correct'
  );
  assert.equal(
    service.evaluateAnswer(sbaQuestion, { selectedIds: [2], tfMap: {} }),
    'wrong',
    'SBA distractor must be marked wrong'
  );
  assert.equal(
    service.calculateQuestionScore(sbaQuestion, { selectedIds: [1], tfMap: {} }),
    2,
    'SBA correct answer must earn full raw marks'
  );
}

function testTrueFalseIntegrity() {
  const allCorrect = { 11: 1, 12: 0, 13: 1, 14: 1, 15: 0 };
  const oneWrong = { 11: 1, 12: 1, 13: 1, 14: 1, 15: 0 };
  const partial = { 11: 1, 12: 0, 13: 1 };

  assert.equal(
    service.evaluateAnswer(trueFalseQuestion, { selectedIds: [], tfMap: allCorrect }),
    'correct',
    'T/F all-correct map must be marked correct'
  );
  assert.equal(
    service.evaluateAnswer(trueFalseQuestion, { selectedIds: [], tfMap: partial }),
    'wrong',
    'T/F incomplete map must require review'
  );
  assert.equal(
    service.calculateQuestionScore(trueFalseQuestion, { selectedIds: [], tfMap: allCorrect }),
    2,
    'T/F all-correct question must earn full raw marks'
  );
  assert.equal(
    service.calculateQuestionScore(trueFalseQuestion, { selectedIds: [], tfMap: oneWrong }),
    1.2,
    'T/F scoring must apply per-statement negative marking and floor at zero'
  );
}

function testScaledScoringAndReviewPayload() {
  assert.equal(service.scaleScoreToHundred(3.2, 2), 80);
  const review = service.mapReviewQuestion(sbaQuestion, [{ optionId: 2, isSelected: 1 }]);
  assert.equal(review.answerStatus, 'wrong');
  assert.equal(review.questionScore, 0);
  assert.equal(review.contentTrace.version, 4);
  assert.equal(review.options[1].whyIncorrect, 'Fever and consolidation would be expected.');
}

function testTimerIntegrity() {
  assert.equal(
    service.isExamSessionExpired({ deadline_at: new Date(Date.now() - 1000) }),
    true,
    'past exam deadline must be expired'
  );
  assert.equal(
    service.isExamSessionExpired({ deadline_at: new Date(Date.now() + 60_000) }),
    false,
    'future exam deadline must remain active'
  );
}

function testSubmittedAnswerNormalization() {
  const normalized = service.normalizeSubmittedAnswers(
    {
      101: 1,
      102: { 11: '1', 12: '0', 13: 'bad', 999: '1' },
      999: 1,
    },
    [sbaQuestion, trueFalseQuestion]
  );

  assert.deepEqual(normalized['101'], 1);
  assert.deepEqual(normalized['102'], { '11': 1, '12': 0 });
  assert.equal(normalized['999'], undefined);
}

testSbaIntegrity();
testTrueFalseIntegrity();
testScaledScoringAndReviewPayload();
testTimerIntegrity();
testSubmittedAnswerNormalization();
console.log('Medical content assessment integrity checks passed.');
