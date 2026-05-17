import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAttemptReview } from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { ReviewWorkspace } from './ReviewWorkspace.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getQuizNumberLabel, getQuizTitleText } from '../quizzes/quizLabels.js';

const reviewPageNavClass = 'flex items-center justify-start';

export function ReviewPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setData(await fetchAttemptReview(attemptId));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load review'));
      }
    }
    load();
  }, [attemptId]);

  if (!data && !error) {
    return <main className={ui.screenShell}><div className={ui.emptyBox}>Loading review...</div></main>;
  }

  const summary = data ? data.questions.reduce(
    (acc, question) => {
      if (question.answerStatus === 'correct') acc.correct += 1;
      else if (question.answerStatus === 'wrong') acc.wrong += 1;
      else acc.unanswered += 1;
      return acc;
    },
    {
      total: data.questions.length,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      score: Number(data.attempt.score || 0),
      percentage: Number(data.attempt.percentage || 0),
    }
  ) : null;

  return (
      <main className={cx(ui.screenShell, 'lms-review-page')}>
        <section className={ui.managementLayout}>
        <AppHeader
          title={data ? `${getQuizNumberLabel(data.attempt)} review` : 'Review answers'}
          subtitle={data ? `${getQuizTitleText(data.attempt, data.attempt.quizTitle)} • ${data.attempt.topicDisplay}` : ''}
        />
        <div className={reviewPageNavClass}>
          <button type="button" className={ui.secondaryAction} onClick={() => navigate(-1)}>
            Back to results
          </button>
        </div>
        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {data ? (
          <ReviewWorkspace
            questions={data.questions}
            summary={summary}
            navigatorVariant="bubbles"
            exitLabel="Finish"
            onExit={() => navigate(-1)}
          />
        ) : null}
        </section>
      </main>
  );
}
