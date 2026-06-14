export function getQuizNumberLabel(quiz) {
  const candidates = [
    { value: quiz?.quizNumber },
    { value: quiz?.quizNo },
    { value: quiz?.quizOrder },
    { value: quiz?.displayOrder },
    { value: quiz?.sortOrder },
    { value: quiz?.sequence },
    { value: quiz?.orderIndex, zeroBased: true },
    { value: quiz?.index, zeroBased: true },
  ];
  const candidate = candidates.find((item) => {
    const numeric = Number(item.value);
    return Number.isFinite(numeric) && (item.zeroBased ? numeric >= 0 : numeric > 0);
  });
  if (candidate) {
    const numeric = Number(candidate.value);
    return `Quiz ${candidate.zeroBased ? numeric + 1 : numeric}`;
  }

  const titleMatch = String(quiz?.studentTitle || quiz?.quizTitle || '').match(/\bquiz\s*0*(\d+)\b/i);
  if (titleMatch) return `Quiz ${Number(titleMatch[1])}`;
  return 'Quiz';
}

export function getQuizTitleText(quiz, fallback = '') {
  return String(quiz?.studentTitle || quiz?.quizTitle || quiz?.title || fallback || '').trim();
}

export function getQuizDisplayLabel(quiz) {
  if (quiz?.displayTitleMode === 'number' && quiz?.quizNumber) {
    const n = String(quiz.quizNumber).padStart(2, '0');
    const parent = quiz.lessonTitle || quiz.topicName || quiz.subjectName || quiz.courseTitle || '';
    return parent ? `${parent} • Quiz ${n}` : `Quiz ${n}`;
  }
  return getQuizNumberLabel(quiz);
}
