import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAiNote, listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const ANIM_CSS = `
@keyframes fcFadeUp {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes fcScaleIn {
  from { opacity:0; transform:scale(0.96); }
  to   { opacity:1; transform:scale(1); }
}
.fc-fade-up  { animation: fcFadeUp  0.36s cubic-bezier(0.23,1,0.32,1) both; }
.fc-scale-in { animation: fcScaleIn 0.28s cubic-bezier(0.23,1,0.32,1) both; }
.fc-d1 { animation-delay:  50ms; }
.fc-d2 { animation-delay: 110ms; }
.fc-d3 { animation-delay: 180ms; }
.fc-card-front-bg {
  background-color: var(--surface-1);
  background-image: radial-gradient(ellipse at 88% 12%, rgba(59,130,246,0.09), transparent 42%);
}
.fc-card-back-bg {
  background-color: var(--surface-1);
  background-image: radial-gradient(ellipse at 12% 12%, rgba(16,185,129,0.09), transparent 42%);
}
`;

/* ─────────────────────────────────────────
   CARD TYPE CONFIG
───────────────────────────────────────── */
const CARD_TYPE = {
  definition:     { label: 'Definition',        color: '#3B82F6', bg: 'rgba(59,130,246,0.10)'  },
  mechanism:      { label: 'Mechanism',          color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)'  },
  features:       { label: 'Clinical Features',  color: '#10B981', bg: 'rgba(16,185,129,0.10)'  },
  management:     { label: 'Management',         color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)'  },
  classification: { label: 'Classification',     color: '#F97316', bg: 'rgba(249,115,22,0.10)'  },
  causes:         { label: 'Causes / Etiology',  color: '#F43F5E', bg: 'rgba(244,63,94,0.10)'   },
  diagnosis:      { label: 'Investigations',     color: '#EAB308', bg: 'rgba(234,179,8,0.10)'   },
  complications:  { label: 'Complications',      color: '#EF4444', bg: 'rgba(239,68,68,0.10)'   },
  mnemonic:       { label: 'Mnemonic',           color: '#6366F1', bg: 'rgba(99,102,241,0.10)'  },
  keypoints:      { label: 'Key Points',         color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)'  },
  summary:        { label: 'Summary',            color: '#64748B', bg: 'rgba(100,116,139,0.10)' },
  explain:        { label: 'Concept',            color: '#6366F1', bg: 'rgba(99,102,241,0.10)'  },
};

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function plainText(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

const FLASHCARD_SESSION_PREFIX = 'lms.flashcards.session.';
const FLASHCARD_REVIEW_STATS_KEY = 'lms.flashcards.reviewStats.v1';
const FLASHCARD_BAD_IDS_KEY = 'lms.flashcards.badIds.v1';
const FLASHCARD_DECK_STATS_KEY = 'lms.flashcards.deckStats.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const LEARNING_STEP_MS = 10 * 60 * 1000;
const HARD_STEP_MS = 30 * 60 * 1000;
const DAILY_NEW_CARD_LIMIT = 20;
const QUICK_SESSION_LIMIT = 10;

function cleanStudyText(value) {
  return plainText(value)
    .replace(/={2,}/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[EXAM TRAP\]/gi, 'Exam trap:')
    .replace(/\[HIGH YIELD\]/gi, '')
    .replace(/\[KEY POINT\]/gi, '')
    .replace(/^\(?\d+[\).:-]?\s*/, '')
    .replace(/^[-•]\s*/, '')
    .replace(/^→\s*/, '')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*;\s*/g, '; ')
    .trim();
}

function isInteractiveElement(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select, [role="button"], [contenteditable="true"]'));
}

function isNestedControl(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select, [contenteditable="true"]'));
}

function cardStorageId(card) {
  return String(card?.id || card?.questionText || '');
}

function cardSignature(cards) {
  return (cards || []).map(cardStorageId).join('|');
}

function flashcardSessionKey(quiz) {
  return `${FLASHCARD_SESSION_PREFIX}${quiz?.id || 'deck'}`;
}

function readFlashcardSession(quiz, cards) {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(flashcardSessionKey(quiz)) || 'null');
    if (!parsed || parsed.signature !== cardSignature(cards)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeFlashcardSession(quiz, cards, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(flashcardSessionKey(quiz), JSON.stringify({
      signature: cardSignature(cards),
      ...data,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // Local progress is helpful, not required.
  }
}

function clearFlashcardSession(quiz) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(flashcardSessionKey(quiz));
  } catch {
    // Ignore storage failures.
  }
}

function readReviewStats() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(FLASHCARD_REVIEW_STATS_KEY) || '{}');
  } catch {
    return {};
  }
}

function readBadCardIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const ids = JSON.parse(window.localStorage.getItem(FLASHCARD_BAD_IDS_KEY) || '[]');
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function readDeckStatsCache() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FLASHCARD_DECK_STATS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function deckStatsCacheKey(note) {
  return `${note?.id || 'deck'}:${note?.updatedAt || ''}`;
}

function getCachedDeckStats(note, cache = readDeckStatsCache()) {
  const row = cache[deckStatsCacheKey(note)];
  const cardCount = Number(row?.cardCount);
  if (!Number.isFinite(cardCount)) return null;
  return {
    cardCount,
    loading: false,
    unavailable: false,
    countedAt: row?.countedAt || '',
  };
}

function writeDeckStatsCacheEntry(note, cardCount) {
  if (typeof window === 'undefined') return;
  try {
    const cache = readDeckStatsCache();
    cache[deckStatsCacheKey(note)] = {
      cardCount,
      countedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(FLASHCARD_DECK_STATS_KEY, JSON.stringify(cache));
  } catch {
    // Deck counts are only a convenience for the browser list.
  }
}

function reportBadCard(card) {
  if (typeof window === 'undefined') return false;
  const id = cardStorageId(card);
  if (!id) return false;

  try {
    const ids = readBadCardIds();
    ids.add(id);
    window.localStorage.setItem(FLASHCARD_BAD_IDS_KEY, JSON.stringify([...ids]));
    return true;
  } catch {
    return false;
  }
}

function startOfToday(time = Date.now()) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function parseDueTime(row) {
  const dueAt = row?.dueAt ? Date.parse(row.dueAt) : 0;
  return Number.isFinite(dueAt) ? dueAt : 0;
}

function getCardReviewRow(card, stats = readReviewStats()) {
  return stats[cardStorageId(card)] || null;
}

function isLearningRow(row) {
  if (!row) return false;
  if (row.state === 'learning' || row.state === 'relearning') return true;
  const attempts = Number(row.attempts) || 0;
  const repetitions = Number(row.repetitions) || 0;
  return attempts > 0 && repetitions < 2 && (Number(row.learning) || 0) > 0;
}

function isWeakReviewRow(row) {
  if (!row) return false;
  const attempts = Number(row.attempts) || 0;
  const correct = Number(row.correct) || 0;
  const learning = Number(row.learning) || 0;
  const successRate = attempts ? correct / attempts : 1;
  return row.lastRating === 'again' ||
    row.lastRating === 'hard' ||
    (Number(row.lapses) || 0) > 0 ||
    learning > correct ||
    (attempts > 1 && successRate < 0.6);
}

function getCardSchedule(card, stats = readReviewStats(), now = Date.now()) {
  const row = getCardReviewRow(card, stats);
  if (!row) {
    return {
      state: 'new',
      label: 'New',
      score: 3,
      dueAt: 0,
      isNew: true,
      isDue: false,
      isOverdue: false,
      isLearning: false,
      isWeak: false,
      isNotDue: false,
    };
  }

  const dueAt = parseDueTime(row);
  const today = startOfToday(now);
  const isLearning = isLearningRow(row);
  const isWeak = isWeakReviewRow(row);
  const isDue = Boolean(dueAt && dueAt <= now);
  const isOverdue = Boolean(dueAt && dueAt < today);

  if (isOverdue) {
    return { state: 'overdue', label: 'Overdue', score: 8, dueAt, isNew: false, isDue: true, isOverdue: true, isLearning, isWeak, isNotDue: false };
  }
  if (isDue && isLearning) {
    return { state: 'learning-due', label: 'Learning', score: 6, dueAt, isNew: false, isDue: true, isOverdue: false, isLearning: true, isWeak, isNotDue: false };
  }
  if (isDue) {
    return { state: isWeak ? 'weak-due' : 'due', label: isWeak ? 'Needs practice' : 'Due', score: isWeak ? 7 : 5, dueAt, isNew: false, isDue: true, isOverdue: false, isLearning: false, isWeak, isNotDue: false };
  }
  if (isLearning) {
    return { state: 'learning', label: 'Learning', score: 4, dueAt, isNew: false, isDue: false, isOverdue: false, isLearning: true, isWeak, isNotDue: true };
  }
  if (isWeak) {
    return { state: 'weak', label: 'Needs practice', score: 4, dueAt, isNew: false, isDue: false, isOverdue: false, isLearning: false, isWeak: true, isNotDue: true };
  }
  return { state: 'not-due', label: 'Coming later', score: 0, dueAt, isNew: false, isDue: false, isOverdue: false, isLearning: false, isWeak: false, isNotDue: true };
}

function uniqueCards(cards) {
  const seen = new Set();
  return (cards || []).filter((card) => {
    const id = cardStorageId(card);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function intervalLabel(dueAt) {
  if (!dueAt) return '';
  const diff = dueAt - Date.now();
  if (diff <= 0) return 'ready now';
  const minutes = Math.ceil(diff / (60 * 1000));
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

function formatLastReviewed(value) {
  const time = value ? Date.parse(value) : 0;
  if (!Number.isFinite(time) || !time) return 'Not reviewed';
  const diff = Date.now() - time;
  if (diff < 60 * 60 * 1000) return 'Reviewed today';
  if (diff < DAY_MS) return 'Reviewed today';
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return 'Reviewed yesterday';
  if (days < 7) return `Reviewed ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Reviewed ${weeks} wk${weeks === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(time));
}

function scheduleFromRating(previous, rating, now = Date.now()) {
  const oldEase = Number(previous?.ease) || 2.5;
  const oldInterval = Number(previous?.intervalDays) || 0;
  const oldRepetitions = Number(previous?.repetitions) || 0;
  const easeDelta = {
    again: -0.2,
    hard: -0.15,
    good: 0,
    easy: 0.15,
  }[rating] ?? 0;
  const ease = Math.max(1.3, Math.min(3.2, oldEase + easeDelta));

  if (rating === 'again') {
    return {
      state: 'relearning',
      intervalDays: 0,
      dueAt: new Date(now + LEARNING_STEP_MS).toISOString(),
      ease,
      repetitions: 0,
      remembered: false,
    };
  }

  if (rating === 'hard') {
    const isEarlyLearning = !previous || isLearningRow(previous) || oldRepetitions < 2;
    return {
      state: isEarlyLearning ? 'learning' : 'review',
      intervalDays: isEarlyLearning ? 0 : Math.max(1, Math.round(Math.max(oldInterval, 1) * 1.2)),
      dueAt: new Date(now + (isEarlyLearning ? HARD_STEP_MS : Math.max(1, Math.round(Math.max(oldInterval, 1) * 1.2)) * DAY_MS)).toISOString(),
      ease,
      repetitions: Math.max(oldRepetitions, 1),
      remembered: false,
    };
  }

  if (rating === 'easy') {
    const intervalDays = Math.max(4, Math.round(Math.max(oldInterval || 2, 2) * ease * 1.35));
    return {
      state: 'review',
      intervalDays,
      dueAt: new Date(now + intervalDays * DAY_MS).toISOString(),
      ease,
      repetitions: oldRepetitions + 1,
      remembered: true,
    };
  }

  const graduated = previous && !isLearningRow(previous) && oldRepetitions >= 1;
  const intervalDays = graduated ? Math.max(2, Math.round(Math.max(oldInterval, 1) * ease)) : 1;
  return {
    state: graduated ? 'review' : 'learning',
    intervalDays,
    dueAt: new Date(now + intervalDays * DAY_MS).toISOString(),
    ease,
    repetitions: oldRepetitions + 1,
    remembered: true,
  };
}

function recordFlashcardReview(card, ratingOrKnown) {
  if (typeof window === 'undefined') return;
  const id = cardStorageId(card);
  if (!id) return;

  try {
    const rating = typeof ratingOrKnown === 'boolean'
      ? (ratingOrKnown ? 'good' : 'again')
      : (ratingOrKnown || 'good');
    const stats = readReviewStats();
    const previous = stats[id] || {};
    const now = Date.now();
    const next = scheduleFromRating(previous, rating, now);
    const remembered = Boolean(next.remembered);

    stats[id] = {
      id,
      questionText: card.questionText,
      context: card.context,
      questionType: card.questionType,
      attempts: (Number(previous.attempts) || 0) + 1,
      correct: (Number(previous.correct) || 0) + (remembered ? 1 : 0),
      learning: (Number(previous.learning) || 0) + (remembered ? 0 : 1),
      lapses: (Number(previous.lapses) || 0) + (rating === 'again' ? 1 : 0),
      intervalDays: next.intervalDays,
      ease: next.ease,
      repetitions: next.repetitions,
      state: next.state,
      lastRating: rating,
      lastReviewedAt: new Date(now).toISOString(),
      dueAt: next.dueAt,
    };

    window.localStorage.setItem(FLASHCARD_REVIEW_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Review scheduling should never block the study flow.
  }
}

function reviewStatus(card, stats = readReviewStats()) {
  return getCardSchedule(card, stats);
}

function dedupeLines(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLowSignalLine(line) {
  const text = cleanStudyText(line);
  const normalized = text.toLowerCase();
  if (text.length < 5) return true;
  if (/^(note|important|remember|summary|overview|introduction|definition|key point|high yield)[:.]?$/i.test(text)) return true;
  if (/^(read|see|refer to|discuss|learn|understand)\b/i.test(text)) return true;
  if (/^(page|slide|chapter|lesson)\s+\d+/i.test(text)) return true;
  return normalized.split(/\s+/).length <= 2 && /^(types?|causes?|features?|symptoms?|management|treatment|diagnosis|summary|overview)$/.test(normalized);
}

function notePages(note) {
  const data = note?.noteData || {};
  if (Array.isArray(data.pages)) return data.pages;
  if (Array.isArray(data.sections) || data.summary_box || data.key_points) return [data];
  return [];
}

function inferCardType(heading) {
  const h = heading.toLowerCase();
  if (/\b(definition|define|what is|overview|introduction|concept)\b/.test(h)) return 'definition';
  if (/\b(mechanism|pathophysiology|pathogenesis|physiology)\b/.test(h)) return 'mechanism';
  if (/\b(clinical features?|signs?( and symptoms?)?|symptoms?|presentation|manifestation)\b/.test(h)) return 'features';
  if (/\b(treatment|management|therapy|therapeutic|pharmacolog|drug)\b/.test(h)) return 'management';
  if (/\b(classification|types?|categories|variants?|spectrum)\b/.test(h)) return 'classification';
  if (/\b(causes?|etiology|aetiology|risk factors?|predisposing)\b/.test(h)) return 'causes';
  if (/\b(diagnosis|investigation|workup|test|labs?|imaging|diagnostic)\b/.test(h)) return 'diagnosis';
  if (/\b(complications?|prognosis|outcome|sequelae)\b/.test(h)) return 'complications';
  return 'explain';
}

function readableTopic(heading, hierarchy) {
  const lesson = cleanStudyText(hierarchy?.lesson || '');
  const clean = cleanStudyText(heading)
    .replace(/\b(definition of|types of|classification of|causes of|management of|treatment of|investigations? for|diagnosis of|complications? of|clinical features? of|features of|pathophysiology of|mechanism of|overview of|summary of|key points? for)\b/gi, '')
    .replace(/^(the |a |an )/i, '')
    .trim();
  const generic = /^(definition|overview|introduction|clinical features?|features?|symptoms?|signs?|causes?|etiology|aetiology|risk factors?|pathophysiology|mechanism|classification|types?|investigations?|diagnosis|workup|management|treatment|complications?|prognosis|summary|key points?|exam points?|important points?)(\s*(and|\/|&)\s*(definition|classification|overview|clinical features?|features?|symptoms?|signs?|causes?|etiology|aetiology|risk factors?|pathophysiology|mechanism|types?|investigations?|diagnosis|workup|management|treatment|complications?|prognosis|summary|key points?|exam points?|important points?))*$/i.test(clean);
  return (lesson && generic) ? lesson : (clean || lesson || 'this lesson');
}

function isVagueHeading(heading, hierarchy) {
  const text = cleanStudyText(heading).toLowerCase();
  const lesson = lessonTopic(hierarchy).toLowerCase();
  if (!text) return true;
  if (/^(introduction|overview|summary|recap|conclusion|learning objectives?|objectives?|contents?|notes?)$/.test(text)) return true;
  if (lesson && text === lesson) return false;
  return false;
}

function lessonTopic(hierarchy, fallback = '') {
  return cleanStudyText(hierarchy?.lesson || fallback || 'this lesson');
}

function headingHas(heading, pattern) {
  return pattern.test(cleanStudyText(heading).toLowerCase());
}

function conciseFocus(heading, hierarchy) {
  const topic = readableTopic(heading, hierarchy);
  const lesson = lessonTopic(hierarchy, topic);
  const normalizedTopic = topic.toLowerCase();
  const normalizedLesson = lesson.toLowerCase();

  if (!normalizedTopic || normalizedTopic === 'this lesson') return lesson;
  if (normalizedTopic === normalizedLesson) return lesson;
  if (normalizedTopic.includes(normalizedLesson)) return topic;
  if (normalizedLesson.includes(normalizedTopic) && normalizedTopic.length < 8) return lesson;
  return topic;
}

function buildQuestion(heading, type, hierarchy) {
  const focus = conciseFocus(heading, hierarchy);
  const lesson = lessonTopic(hierarchy, focus);
  const hasDefinition = headingHas(heading, /\bdefinition|overview|introduction|what is\b/);
  const hasClassification = headingHas(heading, /\bclassification|types?|categories\b/);

  if (hasDefinition && hasClassification) {
    return `Define ${lesson} and classify it.`;
  }

  const prompts = {
    definition: `What is ${focus}?`,
    mechanism: `What is the key mechanism or pathophysiology of ${focus}?`,
    features: `A patient may have ${focus}. Which clinical features support this?`,
    management: `A patient has ${focus}. What is the management plan?`,
    classification: `How is ${focus} classified?`,
    causes: `What causes or risk factors are linked to ${focus}?`,
    diagnosis: `A patient may have ${focus}. What investigations or diagnostic steps are most useful?`,
    complications: `What complications should you watch for in ${focus}?`,
    keypoints: `What should you remember about ${lesson}?`,
    summary: `Summarize ${lesson} in a structured way.`,
    explain: focus.toLowerCase() === lesson.toLowerCase()
      ? `What are the most important facts about ${lesson}?`
      : `What are the important facts about ${focus} in ${lesson}?`,
  };

  return prompts[type] || prompts.explain;
}

function answerPriority(type, line) {
  const text = line.toLowerCase();
  const priority = {
    definition: ['definition', 'means', 'characterized', 'core', 'key'],
    mechanism: ['cause', 'trigger', 'leads to', 'pathway', 'mechanism', 'therefore'],
    features: ['symptom', 'sign', 'pain', 'fever', 'presentation', 'clinical'],
    diagnosis: ['history', 'examination', 'blood', 'lab', 'test', 'imaging', 'ct', 'mri', 'x-ray', 'diagnosis'],
    management: ['initial', 'first', 'acute', 'stabil', 'treatment', 'drug', 'follow', 'refer', 'surgery'],
    classification: ['type', 'class', 'stage', 'grade', 'group'],
    causes: ['common', 'cause', 'risk', 'etiology', 'secondary', 'primary'],
    complications: ['acute', 'chronic', 'complication', 'prognosis', 'mortality'],
  }[type] || [];
  const index = priority.findIndex((word) => text.includes(word));
  return index === -1 ? priority.length + 1 : index;
}

function trimAnswerLine(line) {
  const clean = cleanStudyText(line);
  if (clean.length <= 220) return clean;
  const sentenceEnd = clean.slice(0, 220).search(/[.!?](?=\s|$)/);
  if (sentenceEnd >= 80) return clean.slice(0, sentenceEnd + 1);
  return `${clean.slice(0, 217).trim()}...`;
}

function formatAnswerBullets(type, bullets, callout = '') {
  const cleaned = dedupeLines(
    [...(bullets || []), callout]
      .map(trimAnswerLine)
      .filter((line) => !isLowSignalLine(line))
  );

  return cleaned
    .map((line, index) => ({ line, index, rank: answerPriority(type, line) }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map((item) => item.line)
    .slice(0, 8);
}

function formatAnswerText(lines, fallback = '') {
  const answerLines = lines?.length ? lines : [cleanStudyText(fallback)].filter(Boolean);
  return answerLines.join('\n');
}

function cardDifficulty(type, answerBullets, answerText = '') {
  const wordCount = plainText(answerText || answerBullets?.join(' ')).split(/\s+/).filter(Boolean).length;
  if (type === 'mnemonic' || type === 'definition') return 'Easy';
  if (type === 'mechanism' || type === 'diagnosis' || type === 'management' || wordCount > 70) return 'Hard';
  return 'Medium';
}

function cardQualityScore(card) {
  const question = cleanStudyText(card?.questionText);
  const answer = cleanStudyText(card?.answerText || card?.answerBullets?.join(' '));
  let score = 100;

  if (question.length < 18) score -= 35;
  if (answer.length < 18) score -= 45;
  if (answer.length > 900) score -= 15;
  if (/^(what is|explain|summarize) this lesson\??$/i.test(question)) score -= 50;
  if (question.toLowerCase() === answer.toLowerCase()) score -= 60;
  if ((card.answerBullets || []).length > 8) score -= 10;
  if (isLowSignalLine(answer)) score -= 40;

  return Math.max(0, score);
}

function finalizeDeck(cards) {
  const badIds = readBadCardIds();
  const seen = new Set();

  return cards
    .map((card) => ({ ...card, qualityScore: cardQualityScore(card) }))
    .filter((card) => !badIds.has(cardStorageId(card)))
    .filter((card) => card.qualityScore >= 55)
    .filter((card) => {
      const key = cleanStudyText(`${card.questionText} ${card.answerText}`).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function prioritizeCards(cards) {
  const stats = readReviewStats();
  return [...cards]
    .map((card) => ({ card, status: reviewStatus(card, stats), tie: Math.random() }))
    .sort((a, b) => (b.status.score - a.status.score) || (a.tie - b.tie))
    .map((item) => item.card);
}

function dueQueueRank(status) {
  if (status.isOverdue) return 0;
  if (status.isDue && !status.isLearning) return 1;
  if (status.isDue && status.isLearning) return 2;
  if (status.isWeak) return 3;
  return 9;
}

function selectQueueCards(cards, queueType, limit = 60) {
  const stats = readReviewStats();
  const entries = uniqueCards(cards).map((card, index) => ({
    card,
    index,
    status: getCardSchedule(card, stats),
    row: getCardReviewRow(card, stats),
  }));

  const filtered = entries.filter(({ status }) => {
    if (queueType === 'due') return status.isDue || (status.isWeak && !status.isNew);
    if (queueType === 'new') return status.isNew;
    if (queueType === 'weak') return status.isWeak && !status.isNew;
    if (queueType === 'quick') return status.isDue || status.isWeak || status.isNew;
    return true;
  });

  const sorter = (a, b) => {
    if (queueType === 'due') {
      return (dueQueueRank(a.status) - dueQueueRank(b.status)) ||
        ((a.status.dueAt || Number.MAX_SAFE_INTEGER) - (b.status.dueAt || Number.MAX_SAFE_INTEGER)) ||
        (a.index - b.index);
    }
    if (queueType === 'new') return a.index - b.index;
    if (queueType === 'weak') {
      const aMisses = Number(a.row?.learning || 0) + Number(a.row?.lapses || 0);
      const bMisses = Number(b.row?.learning || 0) + Number(b.row?.lapses || 0);
      return (bMisses - aMisses) || (a.index - b.index);
    }
    if (queueType === 'quick') {
      return (dueQueueRank(a.status) - dueQueueRank(b.status)) ||
        (b.status.score - a.status.score) ||
        (a.index - b.index);
    }
    return (b.status.score - a.status.score) || (a.index - b.index);
  };

  return filtered.sort(sorter).slice(0, limit).map((entry) => entry.card);
}

function noteIdFromStoredCardId(id) {
  const first = String(id || '').split('-')[0];
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildInitialDeckStats(notes) {
  const cache = readDeckStatsCache();
  return (notes || []).reduce((acc, note) => {
    const cached = getCachedDeckStats(note, cache);
    if (cached) acc[note.id] = cached;
    return acc;
  }, {});
}

function getNoteReviewCounts(note, reviewStats = readReviewStats()) {
  const noteId = Number(note?.id);
  const rows = Object.entries(reviewStats || {})
    .filter(([cardId]) => noteIdFromStoredCardId(cardId) === noteId)
    .map(([, row]) => row || {});

  const now = Date.now();
  const today = startOfToday(now);
  const counts = rows.reduce((acc, row) => {
    const dueAt = parseDueTime(row);
    const learning = isLearningRow(row);
    const weak = isWeakReviewRow(row);
    const lastReviewedAt = row?.lastReviewedAt ? Date.parse(row.lastReviewedAt) : 0;

    if (learning) {
      acc.learning += 1;
      if (dueAt && dueAt <= now) acc.learningDue += 1;
    } else if (dueAt && dueAt < today) {
      acc.overdue += 1;
    } else if (dueAt && dueAt <= now) {
      acc.due += 1;
    } else if (dueAt > now) {
      acc.notDue += 1;
    }

    if (weak) acc.weak += 1;
    acc.attempts += Number(row.attempts) || 0;
    acc.correct += Number(row.correct) || 0;
    if (lastReviewedAt && (!acc.lastReviewedAt || lastReviewedAt > acc.lastReviewedAt)) acc.lastReviewedAt = lastReviewedAt;
    if (dueAt > now && (!acc.nextDueAt || dueAt < acc.nextDueAt)) acc.nextDueAt = dueAt;
    return acc;
  }, {
    due: 0,
    overdue: 0,
    learning: 0,
    learningDue: 0,
    weak: 0,
    notDue: 0,
    attempts: 0,
    correct: 0,
    lastReviewedAt: 0,
    nextDueAt: 0,
  });

  return {
    reviewedCount: rows.length,
    dueCount: counts.due,
    overdueCount: counts.overdue,
    learningCount: counts.learning,
    learningDueCount: counts.learningDue,
    weakCount: counts.weak,
    notDueCount: counts.notDue,
    lastReviewedAt: counts.lastReviewedAt ? new Date(counts.lastReviewedAt).toISOString() : '',
    accuracy: counts.attempts ? (counts.correct / counts.attempts) * 100 : null,
    nextDueAt: counts.nextDueAt,
    reviewCount: counts.overdue + counts.due + counts.learningDue,
  };
}

function hasDeckCardCount(stat) {
  return Number.isFinite(Number(stat?.cardCount));
}

function getDeckMetrics(note, deckStats = {}, reviewStats = readReviewStats()) {
  const stat = deckStats[note?.id] || {};
  const cardCount = hasDeckCardCount(stat) ? Number(stat.cardCount) : null;
  const review = getNoteReviewCounts(note, reviewStats);
  const newCount = cardCount === null ? null : Math.max(cardCount - review.reviewedCount, 0);

  return {
    cardCount,
    cardCountPending: Boolean(stat.loading) || (!note?.accessLocked && !hasDeckCardCount(stat) && !stat.unavailable),
    newCount,
    dueCount: review.dueCount,
    overdueCount: review.overdueCount,
    learningCount: review.learningCount,
    learningDueCount: review.learningDueCount,
    weakCount: review.weakCount,
    notDueCount: review.notDueCount,
    reviewCount: review.reviewCount,
    reviewedCount: review.reviewedCount,
    lastReviewedAt: review.lastReviewedAt,
    accuracy: review.accuracy,
    availableToday: review.reviewCount + Math.min(newCount || 0, DAILY_NEW_CARD_LIMIT),
    nextDueAt: review.nextDueAt,
  };
}

function summarizeDeckMetrics(notes, deckStats = {}, reviewStats = readReviewStats()) {
  return (notes || []).reduce((acc, note) => {
    const metrics = getDeckMetrics(note, deckStats, reviewStats);
    if (metrics.cardCount === null) {
      acc.cardsUnknown += note.accessLocked ? 0 : 1;
    } else {
      acc.cards += metrics.cardCount;
      acc.cardsKnown += 1;
    }
    if (metrics.newCount === null) {
      acc.newUnknown += note.accessLocked ? 0 : 1;
    } else {
      acc.new += metrics.newCount;
      acc.newKnown += 1;
    }
    acc.due += metrics.dueCount;
    acc.overdue += metrics.overdueCount;
    acc.learning += metrics.learningCount;
    acc.learningDue += metrics.learningDueCount;
    acc.weak += metrics.weakCount;
    acc.notDue += metrics.notDueCount;
    acc.reviewed += metrics.reviewedCount;
    acc.review += metrics.reviewCount;
    acc.availableToday += metrics.availableToday;
    if (metrics.nextDueAt && (!acc.nextDueAt || metrics.nextDueAt < acc.nextDueAt)) acc.nextDueAt = metrics.nextDueAt;
    return acc;
  }, {
    cards: 0,
    cardsKnown: 0,
    cardsUnknown: 0,
    new: 0,
    newKnown: 0,
    newUnknown: 0,
    due: 0,
    overdue: 0,
    learning: 0,
    learningDue: 0,
    weak: 0,
    notDue: 0,
    reviewed: 0,
    review: 0,
    availableToday: 0,
    nextDueAt: 0,
  });
}

function buildMnemonicQuestion(acronym, context) {
  return `In ${context}, what does ${acronym} stand for?`;
}

function buildLessonCards(note) {
  const cards = [];
  const hierarchy = {
    course:  note.courseTitle  || '',
    subject: note.topicName    || '',
    topic:   note.subtopicName || '',
    lesson:  note.lessonTitle  || note.title || '',
  };

  notePages(note).forEach((page, pi) => {
    (page.sections || []).forEach((sec, si) => {
      const heading  = cleanStudyText(sec.heading);
      if (!heading) return;

      const bullets  = (sec.bullets || []).map(cleanStudyText).filter(Boolean);
      const callout  = cleanStudyText(sec.callout);
      const mnemonic = cleanStudyText(sec.mnemonic);

      if ((bullets.length || callout) && !isVagueHeading(heading, hierarchy)) {
        const type = inferCardType(heading);
        const answerBullets = formatAnswerBullets(type, bullets, callout);
        if (answerBullets.length) {
          const answerText = formatAnswerText(answerBullets, callout);
          cards.push({
            id:           `${note.id ?? pi}-${pi}-${si}`,
            questionType: type,
            questionText: buildQuestion(heading, type, hierarchy),
            answerBullets,
            answerText,
            callout:      callout && !answerBullets.includes(callout) ? callout : '',
            mnemonic:     '',
            difficulty:   cardDifficulty(type, answerBullets, answerText),
            context:      heading,
            hierarchy,
          });
        }
      }

      // Separate mnemonic card when acronym found
      if (mnemonic) {
        const acronym = mnemonic.match(/\b([A-Z]{2,})\b/)?.[1];
        if (acronym) {
          const mnemonicTopic = lessonTopic(hierarchy, heading);
          const mnemonicContext = heading && heading.toLowerCase() !== mnemonicTopic.toLowerCase()
            ? `${mnemonicTopic} - ${heading}`
            : mnemonicTopic;
          cards.push({
            id:           `${note.id ?? pi}-${pi}-${si}-mn`,
            questionType: 'mnemonic',
            questionText: buildMnemonicQuestion(acronym, mnemonicContext),
            answerBullets: [],
            answerText:   mnemonic,
            callout:      '',
            mnemonic,
            difficulty:   'Easy',
            context:      mnemonicContext,
            hierarchy,
          });
        }
      }
    });

    const sum = cleanStudyText(page.summary_box);
    if (sum) {
      const title = cleanStudyText(page.title) || note.lessonTitle || note.title || 'this topic';
      cards.push({
        id:           `${note.id ?? pi}-${pi}-sum`,
        questionType: 'summary',
        questionText: buildQuestion(title, 'summary', hierarchy),
        answerBullets: [],
        answerText:   sum,
        callout:      '',
        mnemonic:     '',
        difficulty:   cardDifficulty('summary', [], sum),
        context:      title,
        hierarchy,
      });
    }
  });

  return finalizeDeck(cards);
}

/* ─────────────────────────────────────────
   ICONS
───────────────────────────────────────── */
function IcFlip() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 7a5.5 5.5 0 0 1 9.4-3.9M12.5 7a5.5 5.5 0 0 1-9.4 3.9"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10.5 3l.5 1.6-1.6.4M3.5 11l-.5-1.6 1.6-.4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IcKnow() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2.5 7.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IcReview() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 4v3.5l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </svg>
  );
}

function IcTrophy() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8m-4-4v4"/>
      <path d="M5 3H3a2 2 0 0 0-2 2v1c0 3.31 2.69 6 6 6M19 3h2a2 2 0 0 1 2 2v1c0 3.31-2.69 6-6 6"/>
      <path d="M7 3h10a2 2 0 0 1 2 2v5a7 7 0 0 1-14 0V5a2 2 0 0 1 2-2z"/>
    </svg>
  );
}

function IcStudy() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

function IcBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ─────────────────────────────────────────
   CARD TYPE BADGE
───────────────────────────────────────── */
function CardTypeBadge({ type }) {
  const cfg = CARD_TYPE[type] || CARD_TYPE.explain;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}28` }}
    >
      {cfg.label}
    </span>
  );
}

function DifficultyBadge({ level }) {
  const styles = {
    Easy:   { color: '#059669', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.22)' },
    Medium: { color: '#D97706', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' },
    Hard:   { color: '#DC2626', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)' },
  }[level] || { color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.22)' };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
      style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}
    >
      {level || 'Medium'}
    </span>
  );
}

function ReviewStatusBadge({ card }) {
  const status = reviewStatus(card);
  const styles = {
    new: ['New', '#2563EB', 'rgba(37,99,235,0.10)', 'rgba(37,99,235,0.22)'],
    overdue: ['Overdue', '#E11D48', 'rgba(244,63,94,0.10)', 'rgba(244,63,94,0.22)'],
    'learning-due': ['Learning', '#D97706', 'rgba(245,158,11,0.10)', 'rgba(245,158,11,0.22)'],
    learning: ['Learning', '#D97706', 'rgba(245,158,11,0.10)', 'rgba(245,158,11,0.22)'],
    'weak-due': ['Needs practice', '#E11D48', 'rgba(244,63,94,0.10)', 'rgba(244,63,94,0.22)'],
    weak: ['Needs practice', '#E11D48', 'rgba(244,63,94,0.10)', 'rgba(244,63,94,0.22)'],
    due: ['Due now', '#2563EB', 'rgba(37,99,235,0.10)', 'rgba(37,99,235,0.22)'],
    'not-due': ['Coming later', '#059669', 'rgba(16,185,129,0.10)', 'rgba(16,185,129,0.22)'],
  };
  const [label, color, bg, border] = styles[status.state] || styles['not-due'];

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────
   ANSWER BLOCK (back face)
───────────────────────────────────────── */
function AnswerBlock({ card }) {
  const { answerBullets, answerText, mnemonic, questionType, callout } = card;

  const mnemonicNode = mnemonic && (
    <div className="grid gap-2 rounded-xl border p-4"
      style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.20)' }}>
      <span className="block text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: '#6366F1' }}>Mnemonic</span>
      {card.context ? <span className="text-[12px] font-bold text-ink-soft">{card.context}</span> : null}
      <p className="m-0 text-[14px] font-bold leading-relaxed text-ink-strong whitespace-pre-line">{mnemonic}</p>
    </div>
  );

  if (questionType === 'mnemonic') {
    return <div className="grid gap-3">{mnemonicNode}</div>;
  }

  return (
    <div className="grid gap-3">
      {answerBullets && answerBullets.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {answerBullets.map((bullet, i) => (
            <li key={`${i}-${bullet.slice(0, 12)}`}
              className="flex gap-2.5 rounded-lg border border-line-soft bg-surface-2 px-3 py-2.5 text-[13.5px] font-semibold leading-relaxed text-ink-strong">
              <span className="mt-2 size-1.5 shrink-0 rounded-full"
                style={{ background: '#3B82F6' }} aria-hidden="true" />
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[15px] font-semibold leading-relaxed text-ink-strong whitespace-pre-line">
          {answerText}
        </p>
      )}
      {callout && (
        <div className="rounded-xl border p-3.5"
          style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.20)' }}>
          <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: '#D97706' }}>Note</span>
          <p className="m-0 text-[13px] font-semibold text-ink-medium">{callout}</p>
        </div>
      )}
      {mnemonic && mnemonicNode}
    </div>
  );
}

/* ─────────────────────────────────────────
   PICK PHASE
───────────────────────────────────────── */
function formatDeckCount(value, pending = false) {
  if (pending) return '...';
  if (value === null || value === undefined) return '0';
  return value;
}

const DECK_TABLE_COLUMNS = '104px minmax(0,1fr) minmax(132px,.42fr) 74px 88px';

function metricPercent(metrics) {
  const total = Number(metrics?.cardCount) || 0;
  if (!total) return 0;
  return Math.min(100, Math.round(((metrics?.reviewedCount || 0) / total) * 100));
}

function deckTitle(note) {
  return note.lessonTitle || note.title || 'Untitled lesson';
}

function deckContextLine(note) {
  return [note.courseTitle || 'General', note.topicName, note.subtopicName]
    .filter(Boolean)
    .join(' / ');
}

function deckStatus(note, metrics) {
  if (note.accessLocked) return { label: 'Locked', tone: 'slate' };
  if (Number(metrics.overdueCount) > 0 || Number(metrics.reviewCount) > 0) return { label: 'Due', tone: 'sky' };
  if (Number(metrics.learningCount) > 0) return { label: 'Learning', tone: 'amber' };
  if (Number(metrics.weakCount) > 0) return { label: 'Flagged', tone: 'rose' };
  if (Number(metrics.newCount) > 0) return { label: 'New', tone: 'emerald' };
  if (Number(metrics.notDueCount) > 0) return { label: 'Completed', tone: 'brand' };
  return { label: 'Ready', tone: 'slate' };
}

function deckDueLabel(metrics) {
  if (Number(metrics.overdueCount) > 0) return `${metrics.overdueCount} overdue`;
  if (Number(metrics.reviewCount) > 0) return `${metrics.reviewCount} due`;
  if (Number(metrics.learningDueCount) > 0) return `${metrics.learningDueCount} learning`;
  if (Number(metrics.weakCount) > 0) return `${metrics.weakCount} flagged`;
  if (Number(metrics.newCount) > 0) return `${metrics.newCount} new`;
  if (metrics.nextDueAt) return intervalLabel(metrics.nextDueAt);
  if (Number(metrics.notDueCount) > 0) return 'caught up';
  return 'ready';
}

function deckActionLabel(note, metrics) {
  if (note.accessLocked) return 'Unlock';
  if (Number(metrics.reviewCount) > 0 || Number(metrics.overdueCount) > 0) return 'Review';
  if (Number(metrics.weakCount) > 0) return 'Practice';
  if (Number(metrics.newCount) > 0) return 'Practice';
  return 'Browse';
}

function formatCardsCount(metrics) {
  return formatDeckCount(metrics.cardCount, metrics.cardCountPending);
}

function DeckChip({ label, tone = 'slate' }) {
  const tones = {
    brand: 'border-brand-primary/20 bg-brand-primary/10 text-brand-primary',
    sky: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    rose: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    slate: 'border-line-soft bg-surface-1 text-ink-muted',
  };

  return (
    <span className={cx('inline-flex min-h-6 items-center justify-center rounded-md border px-2 text-[10.5px] font-extrabold leading-none', tones[tone] || tones.slate)}>
      {label}
    </span>
  );
}

function SummaryPill({ label, value }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-line-soft bg-surface-1 px-2.5 text-[11px] font-extrabold text-ink-muted dark:border-white/[0.07] dark:bg-white/[0.03]">
      <span>{label}</span>
      <strong className="text-[12px] tabular-nums text-ink-strong">{value}</strong>
    </span>
  );
}

function FlashcardCompactHeader({
  summary,
  loading,
  starting,
  onStartDueReview,
  onStartNewCards,
  onStartAllCards,
  onStartQuick,
}) {
  const knownCards = formatDeckCount(summary.cards, summary.cardsUnknown > 0);
  const newCards = formatDeckCount(summary.new, summary.newUnknown > 0);

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 fc-fade-up">
      <div className="min-w-0">
        <h1 className="m-0 text-[26px] font-black leading-tight text-ink-strong max-[520px]:text-[23px]">Flashcards</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SummaryPill label="Due" value={summary.review} />
          <SummaryPill label="New" value={newCards} />
          <SummaryPill label="Learning" value={summary.learning} />
          <SummaryPill label="Completed" value={summary.notDue} />
          <SummaryPill label="Cards" value={knownCards} />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 max-[640px]:w-full max-[640px]:justify-start">
        <button
          type="button"
          className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded-lg border border-brand-primary/28 bg-brand-primary/10 px-3 text-[12px] font-extrabold text-brand-primary transition-[background,border-color,transform,opacity] hover:-translate-y-px hover:bg-brand-primary/14 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={starting || loading || !summary.review}
          onClick={onStartDueReview}
        >
          Start Due Review
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded-lg border border-line-soft bg-surface-1 px-3 text-[12px] font-extrabold text-ink-strong transition-[background,border-color,transform,opacity] hover:-translate-y-px hover:border-brand-primary/20 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={starting || loading || !Number(summary.new)}
          onClick={onStartNewCards}
        >
          New
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded-lg border border-line-soft bg-surface-1 px-3 text-[12px] font-extrabold text-ink-strong transition-[background,border-color,transform,opacity] hover:-translate-y-px hover:border-brand-primary/20 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={starting || loading || (!summary.cards && !summary.cardsUnknown)}
          onClick={onStartQuick}
        >
          Quick 10
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded-lg border border-line-soft bg-surface-1 px-3 text-[12px] font-extrabold text-ink-strong transition-[background,border-color,transform,opacity] hover:-translate-y-px hover:border-brand-primary/20 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={starting || loading || (!summary.cards && !summary.cardsUnknown)}
          onClick={onStartAllCards}
        >
          Browse All
        </button>
      </div>
    </header>
  );
}

function DeckProgress({ metrics }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-label={`${metricPercent(metrics)} percent reviewed`}>
      <span
        className="block h-full rounded-full bg-brand-primary transition-[width] duration-300"
        style={{ width: `${metricPercent(metrics)}%` }}
      />
    </span>
  );
}

function FlashcardDeckDesktopRow({ note, metrics, starting, onStartNote, onUnlock }) {
  const status = deckStatus(note, metrics);
  const actionLabel = deckActionLabel(note, metrics);
  const cardCount = formatCardsCount(metrics);
  const lastReviewed = metrics.reviewedCount ? formatLastReviewed(metrics.lastReviewedAt) : '';
  const disabled = starting || (!note.accessLocked && metrics.cardCount === 0 && !metrics.cardCountPending);
  const handleAction = () => note.accessLocked ? onUnlock() : onStartNote(note);

  return (
    <div
      role="row"
      className={cx(
        'grid min-h-[54px] items-center gap-3 border-t border-line-soft px-4 py-2 text-[13px] transition-[background,border-color] duration-150 hover:bg-surface-2/45 dark:border-white/[0.07] dark:hover:bg-white/[0.045]',
        disabled && 'opacity-60'
      )}
      style={{ gridTemplateColumns: DECK_TABLE_COLUMNS }}
    >
      <div role="cell"><DeckChip label={status.label} tone={status.tone} /></div>
      <div role="cell" className="min-w-0">
        <div className="truncate text-[13.5px] font-extrabold leading-tight text-ink-strong">{deckTitle(note)}</div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-semibold leading-tight text-ink-muted">
          <span className="max-w-full truncate">{deckContextLine(note)}</span>
          {lastReviewed ? <span className="shrink-0 text-ink-muted/80">{lastReviewed}</span> : null}
        </div>
      </div>
      <div role="cell" className="min-w-0">
        <div className="truncate text-[12px] font-extrabold text-ink-medium">{deckDueLabel(metrics)}</div>
        <div className="mt-1 max-w-[130px]"><DeckProgress metrics={metrics} /></div>
      </div>
      <div role="cell" className="text-right text-[12px] font-black tabular-nums text-ink-strong">{cardCount}</div>
      <div role="cell">
        <button
          type="button"
          className="inline-flex min-h-9 w-full touch-manipulation items-center justify-center rounded-lg border border-brand-primary/22 bg-brand-primary/10 px-3 text-[12px] font-extrabold text-brand-primary transition-[background,border-color,transform,opacity] hover:-translate-y-px hover:bg-brand-primary/14 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={handleAction}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function FlashcardDeckMobileRow({ note, metrics, starting, onStartNote, onUnlock }) {
  const status = deckStatus(note, metrics);
  const actionLabel = deckActionLabel(note, metrics);
  const cardCount = formatCardsCount(metrics);
  const disabled = starting || (!note.accessLocked && metrics.cardCount === 0 && !metrics.cardCountPending);
  const handleAction = () => note.accessLocked ? onUnlock() : onStartNote(note);

  return (
    <div className={cx('grid gap-2 border-t border-line-soft px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2/45 dark:border-white/[0.07] dark:hover:bg-white/[0.045]', disabled && 'opacity-60')}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <DeckChip label={status.label} tone={status.tone} />
        <h3 className="m-0 min-w-0 truncate text-[13.5px] font-black leading-tight text-ink-strong">{deckTitle(note)}</h3>
        <button
          type="button"
          className="inline-flex min-h-8 touch-manipulation items-center justify-center rounded-lg border border-brand-primary/22 bg-brand-primary/10 px-2.5 text-[11.5px] font-extrabold text-brand-primary transition-[background,border-color,transform,opacity] hover:bg-brand-primary/14 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={handleAction}
        >
          {actionLabel}
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 pl-16 max-[420px]:pl-0">
        <p className="m-0 min-w-0 truncate text-[11.5px] font-semibold text-ink-muted">
          {deckContextLine(note)} · {deckDueLabel(metrics)} · {cardCount} cards
        </p>
        <DeckProgress metrics={metrics} />
      </div>
    </div>
  );
}

function FlashcardDeckList({ notes, loading, allCount, starting, deckStats, reviewStats, onStartNote, onUnlock }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line-soft bg-surface-card shadow-none fc-fade-up fc-d3 dark:border-white/[0.08] dark:bg-white/[0.035]" aria-labelledby="flashcard-list-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft px-4 py-3 dark:border-white/[0.07] max-[640px]:px-3">
        <div>
          <h2 id="flashcard-list-title" className="m-0 text-[16px] font-black leading-tight text-ink-strong">Lessons</h2>
          <p className="m-0 mt-0.5 text-[12px] font-semibold text-ink-muted">
            {notes.length ? `${notes.length} lesson${notes.length === 1 ? '' : 's'} shown` : 'Browse available lessons'}
          </p>
        </div>
      </div>

      {loading ? (
        <div>
          <div className="hidden min-[1041px]:grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="grid min-h-[54px] items-center gap-3 border-t border-line-soft px-4 py-2 dark:border-white/[0.07]" style={{ gridTemplateColumns: DECK_TABLE_COLUMNS }}>
                <div className={ui.shimmer} style={{ height: 24, borderRadius: 8 }} />
                <div className={ui.shimmer} style={{ height: 16, borderRadius: 999 }} />
                <div className={ui.shimmer} style={{ height: 14, borderRadius: 999 }} />
                <div className={ui.shimmer} style={{ height: 18, borderRadius: 999 }} />
                <div className={ui.shimmer} style={{ height: 36, borderRadius: 10 }} />
              </div>
            ))}
          </div>
          <div className="min-[1041px]:hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="grid min-h-[56px] gap-2 border-t border-line-soft px-3 py-2.5 dark:border-white/[0.07]">
                <div className="grid grid-cols-[54px_minmax(0,1fr)_70px] gap-2">
                  <div className={ui.shimmer} style={{ height: 24, borderRadius: 8 }} />
                  <div className={ui.shimmer} style={{ height: 16, borderRadius: 999 }} />
                  <div className={ui.shimmer} style={{ height: 32, borderRadius: 10 }} />
                </div>
                <div className={ui.shimmer} style={{ height: 12, width: '70%', borderRadius: 999 }} />
              </div>
            ))}
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="grid min-h-[220px] place-items-center px-6 py-10 text-center">
          <div className="max-w-[420px]">
            <h3 className="m-0 text-[20px] font-black text-ink-strong">
              {allCount === 0 ? 'No flashcard decks available yet.' : 'No decks match those filters.'}
            </h3>
            <p className="m-0 mt-2 text-[14px] font-semibold leading-relaxed text-ink-muted">
              {allCount === 0
                ? 'Flashcards will appear here when lessons publish practice cards.'
                : 'Try All, Due, or clear the search to return to your full study set.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div role="table" aria-label="Flashcard decks" className="hidden min-[1041px]:block">
            <div
              role="row"
              className="grid items-center gap-3 bg-surface-1/70 px-4 py-2 text-[10.5px] font-black uppercase tracking-normal text-ink-muted dark:bg-white/[0.025]"
              style={{ gridTemplateColumns: DECK_TABLE_COLUMNS }}
            >
              {['Queue', 'Lesson', 'Progress', 'Cards', 'Action'].map((label) => (
                <div key={label} role="columnheader">{label}</div>
              ))}
            </div>
            {notes.map((note) => {
              const metrics = getDeckMetrics(note, deckStats, reviewStats);
              return (
                <FlashcardDeckDesktopRow
                  key={note.id}
                  note={note}
                  metrics={metrics}
                  starting={starting}
                  onStartNote={onStartNote}
                  onUnlock={onUnlock}
                />
              );
            })}
          </div>

          <div className="min-[1041px]:hidden">
            {notes.map((note) => {
              const metrics = getDeckMetrics(note, deckStats, reviewStats);
              return (
                <FlashcardDeckMobileRow
                  key={note.id}
                  note={note}
                  metrics={metrics}
                  starting={starting}
                  onStartNote={onStartNote}
                  onUnlock={onUnlock}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function matchesDeckFilter(note, filter) {
  if (!filter) return true;
  const q = filter.toLowerCase();
  return (
    (note.lessonTitle || note.title || '').toLowerCase().includes(q) ||
    (note.courseTitle  || '').toLowerCase().includes(q) ||
    (note.topicName    || '').toLowerCase().includes(q) ||
    (note.subtopicName || '').toLowerCase().includes(q)
  );
}

function matchesStatusFilter(note, statusFilter, deckStats, reviewStats) {
  if (statusFilter === 'all') return true;
  const metrics = getDeckMetrics(note, deckStats, reviewStats);
  if (statusFilter === 'due') return metrics.reviewCount > 0 || metrics.overdueCount > 0;
  if (statusFilter === 'new') return Number(metrics.newCount) > 0;
  if (statusFilter === 'learning') return metrics.learningCount > 0;
  if (statusFilter === 'weak') return metrics.weakCount > 0;
  if (statusFilter === 'mastered') return metrics.notDueCount > 0 && metrics.reviewCount === 0 && metrics.learningCount === 0;
  return true;
}

function sortDeckNotes(notes, sortMode, deckStats, reviewStats) {
  const withMetrics = (notes || []).map((note) => ({
    note,
    metrics: getDeckMetrics(note, deckStats, reviewStats),
  }));

  const sorters = {
    urgent: (a, b) =>
      (b.metrics.reviewCount - a.metrics.reviewCount) ||
      (b.metrics.overdueCount - a.metrics.overdueCount) ||
      (b.metrics.learningDueCount - a.metrics.learningDueCount) ||
      ((b.metrics.newCount || 0) - (a.metrics.newCount || 0)),
    newest: (a, b) => Date.parse(b.note.updatedAt || b.note.createdAt || 0) - Date.parse(a.note.updatedAt || a.note.createdAt || 0),
    weakest: (a, b) => (b.metrics.weakCount - a.metrics.weakCount) || (b.metrics.reviewCount - a.metrics.reviewCount),
    course: (a, b) =>
      `${a.note.courseTitle || ''} ${a.note.topicName || ''} ${a.note.lessonTitle || a.note.title || ''}`
        .localeCompare(`${b.note.courseTitle || ''} ${b.note.topicName || ''} ${b.note.lessonTitle || b.note.title || ''}`),
  };

  return withMetrics.sort(sorters[sortMode] || sorters.urgent).map((item) => item.note);
}

function FilterChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-8 touch-manipulation items-center justify-center rounded-lg border px-2.5 text-[11.5px] font-extrabold transition-[background,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18',
        active
          ? 'border-brand-primary/28 bg-brand-primary/10 text-brand-primary'
          : 'border-line-soft bg-surface-1 text-ink-muted hover:border-brand-primary/18 hover:text-ink-strong'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PickPhase({
  notes,
  loading,
  error,
  onStartNote,
  onStartMixed,
  onStartDueReview,
  onStartNewCards,
  onStartQuickSession,
  starting,
  deckStats,
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState('urgent');
  const reviewStats = readReviewStats();
  const summary = summarizeDeckMetrics(notes, deckStats, reviewStats);
  const visibleNotes = useMemo(() => {
    const filtered = (notes || [])
      .filter((note) => matchesDeckFilter(note, filter))
      .filter((note) => matchesStatusFilter(note, statusFilter, deckStats, reviewStats));
    return sortDeckNotes(filtered, sortMode, deckStats, reviewStats);
  }, [deckStats, filter, notes, reviewStats, sortMode, statusFilter]);

  return (
    <main className="dashboard-page study-hub-page student-flashcards-page min-h-dvh">
      <style>{ANIM_CSS}</style>
      <section className="study-hub-shell grid max-w-[1080px] gap-4">

        {error && <div className={cx(ui.feedbackError, 'fc-fade-up')}>{error}</div>}

        <FlashcardCompactHeader
          summary={summary}
          loading={loading}
          starting={starting}
          onStartDueReview={() => onStartDueReview(notes)}
          onStartNewCards={() => onStartNewCards(notes)}
          onStartAllCards={() => onStartMixed(notes, 'All Flashcards')}
          onStartQuick={() => onStartQuickSession(notes)}
        />

        <section className="grid gap-3 fc-fade-up fc-d2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-h-10 min-w-[min(100%,320px)] flex-1 items-center gap-2 rounded-lg border border-line-soft bg-surface-1 px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-brand-primary/35 focus-within:ring-4 focus-within:ring-brand-primary/10">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="shrink-0 text-ink-muted" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-semibold text-ink-strong outline-none placeholder:text-ink-muted"
                placeholder="Search lessons"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                aria-label="Search flashcard lessons"
              />
              {filter && (
                <button type="button"
                  className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-muted transition hover:text-ink-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15"
                  onClick={() => setFilter('')} aria-label="Clear search">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            <label className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-line-soft bg-surface-1 px-3 text-[12px] font-extrabold text-ink-muted">
              Sort
              <select
                className="border-0 bg-transparent text-[12px] font-extrabold text-ink-strong outline-none"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
              >
                <option value="urgent">Most urgent</option>
                <option value="newest">Newest</option>
                <option value="weakest">Weakest</option>
                <option value="course">Course / lesson</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter flashcards by status">
            {[
              ['all', 'All'],
              ['due', 'Due'],
              ['new', 'New'],
              ['learning', 'Learning'],
              ['weak', 'Flagged'],
              ['mastered', 'Mastered'],
            ].map(([value, label]) => (
              <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                {label}
              </FilterChip>
            ))}
          </div>
        </section>

        <FlashcardDeckList
          notes={visibleNotes}
          loading={loading}
          allCount={notes.length}
          starting={starting}
          deckStats={deckStats}
          reviewStats={reviewStats}
          onStartNote={onStartNote}
          onUnlock={() => navigate('/billing')}
        />
      </section>
    </main>
  );
}

/* ─────────────────────────────────────────
   SESSION PHASE
───────────────────────────────────────── */
function SessionPhase({ quiz, cards, onDone, onBack }) {
  const savedSession = readFlashcardSession(quiz, cards);
  const initialIndex = Math.min(Math.max(Number(savedSession?.idx) || 0, 0), Math.max(cards.length - 1, 0));
  const [idx,      setIdx]      = useState(initialIndex);
  const [flipped,  setFlipped]  = useState(false);
  const [known,    setKnown]    = useState(() => new Set((savedSession?.known || []).filter((i) => Number.isInteger(i) && i < cards.length)));
  const [learning, setLearning] = useState(() => new Set((savedSession?.learning || []).filter((i) => Number.isInteger(i) && i < cards.length)));
  const [advancing, setAdvancing] = useState(false);
  const [reportedIds, setReportedIds] = useState(() => readBadCardIds());

  const flippedRef = useRef(false);
  const advancingRef = useRef(false);
  const advanceRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, moved: false });

  useEffect(() => { flippedRef.current = flipped; }, [flipped]);
  useEffect(() => { advancingRef.current = advancing; }, [advancing]);
  useEffect(() => (
    () => window.clearTimeout(advanceTimerRef.current)
  ), []);

  useEffect(() => {
    writeFlashcardSession(quiz, cards, {
      idx,
      known: [...known],
      learning: [...learning],
    });
  }, [cards, idx, known, learning, quiz]);

  const card     = cards[idx];
  const progress = ((idx + 1) / cards.length) * 100;

  function flip() {
    if (advancingRef.current) return;
    setFlipped(f => !f);
  }

  function advance(rating) {
    if (!flippedRef.current || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    const remembered = rating === 'good' || rating === 'easy';
    const newKnown    = remembered ? new Set([...known, idx]) : known;
    const newLearning = !remembered ? new Set([...learning, idx]) : learning;
    recordFlashcardReview(card, rating);
    setKnown(newKnown);
    setLearning(newLearning);
    setFlipped(false);
    advanceTimerRef.current = window.setTimeout(() => {
      if (idx + 1 >= cards.length) {
        clearFlashcardSession(quiz);
        onDone({ cards, knownIds: newKnown, learningIds: newLearning });
      } else {
        setIdx(i => i + 1);
        advancingRef.current = false;
        setAdvancing(false);
      }
      advanceTimerRef.current = null;
    }, 160);
  }
  advanceRef.current = advance;

  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented || isInteractiveElement(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      if (flippedRef.current && e.key === 'ArrowRight') advanceRef.current('good');
      if (flippedRef.current && e.key === 'ArrowLeft')  advanceRef.current('again');
      if (flippedRef.current && e.key === '1') advanceRef.current('again');
      if (flippedRef.current && e.key === '2') advanceRef.current('hard');
      if (flippedRef.current && e.key === '3') advanceRef.current('good');
      if (flippedRef.current && e.key === '4') advanceRef.current('easy');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleCardPointerDown(event) {
    pointerRef.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function handleCardPointerMove(event) {
    const dx = Math.abs(event.clientX - pointerRef.current.x);
    const dy = Math.abs(event.clientY - pointerRef.current.y);
    if (dx > 8 || dy > 8) {
      pointerRef.current.moved = true;
    }
  }

  function handleCardClick(event) {
    if (pointerRef.current.moved || isNestedControl(event.target)) return;
    flip();
  }

  function handleReportCard(event) {
    event.stopPropagation();
    if (reportBadCard(card)) {
      setReportedIds(readBadCardIds());
    }
  }

  const isReported = reportedIds.has(cardStorageId(card));

  return (
    <main className="dashboard-page study-hub-page student-flashcards-page">
      <style>{ANIM_CSS}</style>
      <section className="study-hub-shell">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-1 px-5 py-3.5 shadow-xs fc-fade-up">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button"
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted
                transition-[background,transform] hover:bg-surface-3 hover:text-ink-strong active:scale-[0.97]
                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15"
              onClick={onBack} aria-label="Back to lesson picker">
              <IcBack/>
            </button>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-extrabold text-ink-strong">{quiz.quizTitle}</div>
              <div className="text-[11px] font-semibold text-ink-muted">Card {idx + 1} of {cards.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold"
              style={{ background: 'rgba(16,185,129,0.10)', color: '#10B981' }}>
              <IcKnow/>{known.size} Know
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#D97706' }}>
              <IcReview/>{learning.size} Review
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-surface-3 fc-fade-up fc-d1">
          <div className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)' }}/>
        </div>

        {/* Card */}
        <div
          className="mx-auto mb-5 min-h-[420px] w-full max-w-[800px] cursor-pointer touch-pan-y [perspective:1400px] fc-scale-in fc-d2 max-[600px]:min-h-[360px]"
          onPointerDown={handleCardPointerDown}
          onPointerMove={handleCardPointerMove}
          onClick={handleCardClick}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Card showing answer. Press Space to return to the question.' : 'Card showing question. Press Space to reveal answer.'}
          onKeyDown={e => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              flip();
            }
          }}
        >
          <div className="relative min-h-[420px] w-full transition-transform duration-500 [transform-style:preserve-3d] max-[600px]:min-h-[360px]"
            style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>

            {/* FRONT */}
            <div
              className="fc-card-front-bg absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-2xl border border-line-soft p-8 shadow-lg [backface-visibility:hidden] max-[600px]:p-5"
              aria-hidden={flipped}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTypeBadge type={card.questionType}/>
                  <DifficultyBadge level={card.difficulty}/>
                  <ReviewStatusBadge card={card}/>
                </div>
                <span className="text-[11px] font-bold text-ink-muted opacity-60">{idx + 1} / {cards.length}</span>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
                <p className="m-0 max-w-[560px] text-[1.1rem] font-extrabold leading-relaxed text-ink-strong max-[600px]:text-[1rem]">
                  {card.questionText}
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                {(card.hierarchy?.subject || card.hierarchy?.topic) && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted opacity-55">
                    {card.hierarchy.subject && <span>{card.hierarchy.subject}</span>}
                    {card.hierarchy.topic && <><span>›</span><span>{card.hierarchy.topic}</span></>}
                  </div>
                )}
                <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink-muted">
                  <IcFlip/> Tap or Space to reveal answer
                </span>
              </div>
            </div>

            {/* BACK */}
            <div
              className="fc-card-back-bg absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-2xl border border-line-soft p-8 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)] max-[600px]:p-5"
              aria-hidden={!flipped}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase"
                  style={{ background: 'rgba(16,185,129,0.10)', color: '#10B981', border: '1px solid rgba(16,185,129,0.22)' }}>
                  Answer
                </span>
                {card.context && (
                  <span className="max-w-[200px] truncate text-[11px] font-semibold text-ink-muted opacity-60">
                    {card.context}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <AnswerBlock card={card}/>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center rounded-full border border-line-soft bg-surface-2 px-3 text-[11px] font-extrabold text-ink-muted transition hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleReportCard}
                  disabled={isReported}
                >
                  {isReported ? 'Reported' : 'Report bad card'}
                </button>
                <p className="m-0 text-[11px] font-semibold text-ink-muted">
                  How well did you recall this?
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="mb-3 grid grid-cols-4 justify-center gap-2 transition-[opacity,transform] duration-200 max-[720px]:grid-cols-2 max-[420px]:grid-cols-1"
          style={{ opacity: flipped ? 1 : 0, pointerEvents: flipped ? 'auto' : 'none', transform: flipped ? 'translateY(0)' : 'translateY(4px)' }}
          aria-hidden={!flipped}
        >
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-extrabold
              transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(244,63,94,0.09)', borderColor: 'rgba(244,63,94,0.22)', color: '#E11D48' }}
            onClick={() => advance('again')} disabled={!flipped || advancing}>
            Again
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-extrabold
              transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(245,158,11,0.09)', borderColor: 'rgba(245,158,11,0.22)', color: '#D97706' }}
            onClick={() => advance('hard')} disabled={!flipped || advancing}>
            <IcReview/> Hard
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-extrabold
              transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.09)', borderColor: 'rgba(16,185,129,0.22)', color: '#059669' }}
            onClick={() => advance('good')} disabled={!flipped || advancing}>
            <IcKnow/> Good
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-extrabold
              transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(37,99,235,0.09)', borderColor: 'rgba(37,99,235,0.22)', color: '#2563EB' }}
            onClick={() => advance('easy')} disabled={!flipped || advancing}>
            Easy
          </button>
        </div>

        <p className="text-center text-xs font-semibold text-ink-muted">
          {flipped ? (
            <><kbd className="rounded bg-surface-2 px-1.5 py-0.5">1</kbd> Again &nbsp;·&nbsp; <kbd className="rounded bg-surface-2 px-1.5 py-0.5">2</kbd> Hard &nbsp;·&nbsp; <kbd className="rounded bg-surface-2 px-1.5 py-0.5">3</kbd> Good &nbsp;·&nbsp; <kbd className="rounded bg-surface-2 px-1.5 py-0.5">4</kbd> Easy</>
          ) : (
            <><kbd className="rounded bg-surface-2 px-1.5 py-0.5">Space</kbd> or <kbd className="rounded bg-surface-2 px-1.5 py-0.5">Enter</kbd> to flip</>
          )}
        </p>
      </section>
    </main>
  );
}

/* ─────────────────────────────────────────
   RESULT PHASE
───────────────────────────────────────── */
function ResultPhase({ quiz, result, onRetry, onRetryMissed, onBack }) {
  const { cards, knownIds, learningIds } = result;
  const pct          = Math.round((knownIds.size / cards.length) * 100);
  const isExcellent  = pct >= 80;
  const isGood       = pct >= 50;
  const accentColor  = isExcellent ? '#10B981' : isGood ? '#F59E0B' : '#6366F1';
  const circumference = 2 * Math.PI * 34;

  return (
    <main className="dashboard-page study-hub-page student-flashcards-page">
      <style>{ANIM_CSS}</style>
      <section className="study-hub-shell">
        <div className="flex flex-col items-center px-5 py-12 text-center">

          <div className="mb-5 grid size-20 place-items-center rounded-2xl fc-scale-in"
            style={{ background: `${accentColor}12`, color: accentColor }}>
            {isExcellent ? <IcTrophy/> : <IcStudy/>}
          </div>

          <h2 className="m-0 mb-1.5 text-[26px] font-black text-ink-strong fc-fade-up">
            {isExcellent ? 'Excellent work!' : isGood ? 'Good progress!' : 'Keep practicing!'}
          </h2>
          <p className="m-0 mb-10 text-sm font-semibold text-ink-muted fc-fade-up fc-d1">{quiz.quizTitle}</p>

          <div className="mb-10 flex flex-wrap items-center justify-center gap-8 fc-fade-up fc-d2 max-[600px]:gap-5">
            <div className="flex min-w-20 flex-col items-center gap-1">
              <strong className="text-[36px] font-black" style={{ color: '#10B981' }}>{knownIds.size}</strong>
              <span className="text-xs font-semibold text-ink-muted">Know It</span>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-2xl border border-line-soft bg-surface-1 px-6 py-5 shadow-xs">
              <svg viewBox="0 0 80 80" className="size-[96px]" aria-label={`Score: ${pct}%`}>
                <circle cx="40" cy="40" r="34" stroke="var(--surface-3)" strokeWidth="7" fill="none"/>
                <circle cx="40" cy="40" r="34"
                  stroke={accentColor} strokeWidth="7" fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - pct / 100)}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.23,1,0.32,1)' }}
                />
                <text x="40" y="37" textAnchor="middle" fill="var(--ink-strong,#111)" fontSize="15" fontWeight="800">{pct}%</text>
                <text x="40" y="51" textAnchor="middle" fill="var(--ink-muted,#888)" fontSize="9" fontWeight="600">score</text>
              </svg>
            </div>

            <div className="flex min-w-20 flex-col items-center gap-1">
              <strong className="text-[36px] font-black" style={{ color: '#D97706' }}>{learningIds.size}</strong>
              <span className="text-xs font-semibold text-ink-muted">Still Learning</span>
            </div>
          </div>

          <div className="grid w-full max-w-72 gap-2.5 fc-fade-up fc-d3">
            {learningIds.size > 0 && (
              <button className={ui.primaryAction} onClick={onRetryMissed}>
                Retry Missed Cards ({learningIds.size})
              </button>
            )}
            <button className={ui.secondaryAction} onClick={onRetry}>
              Restart Deck
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-transparent px-4
                text-sm font-bold text-ink-muted transition hover:text-ink-strong
                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15"
              onClick={onBack}
            >
              Pick Another Lesson
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ─────────────────────────────────────────
   ROOT
───────────────────────────────────────── */
export function StudentFlashcardsPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const autoNoteId     = searchParams.get('noteId') ? Number(searchParams.get('noteId')) : null;
  const deckCountLoadingRef = useRef(new Set());

  const [phase,    setPhase]    = useState('pick');
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [starting, setStarting] = useState(false);
  const [deckStats, setDeckStats] = useState({});

  const [activeQuiz,  setActiveQuiz]  = useState(null);
  const [activeCards, setActiveCards] = useState([]);
  const [result,      setResult]      = useState(null);

  useEffect(() => {
    listAiNotes()
      .then(rows => {
        setDeckStats(buildInitialDeckStats(rows));
        setNotes(rows);
        if (autoNoteId) {
          const match = rows.find(n => n.id === autoNoteId);
          if (match) loadLessonCards(match);
        }
      })
      .catch(e => setError(getErrorMessage(e, 'Unable to load flashcard decks')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notes.length) return undefined;
    let cancelled = false;
    const pending = notes
      .filter((note) => !note.accessLocked)
      .filter((note) => !hasDeckCardCount(deckStats[note.id]))
      .filter((note) => !deckStats[note.id]?.unavailable)
      .filter((note) => !deckCountLoadingRef.current.has(note.id));

    if (!pending.length) return undefined;

    async function loadDeckCounts() {
      const queue = [...pending];
      const workerCount = Math.min(3, queue.length);

      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (queue.length && !cancelled) {
          const note = queue.shift();
          if (!note) return;

          deckCountLoadingRef.current.add(note.id);
          setDeckStats((current) => ({
            ...current,
            [note.id]: {
              ...(current[note.id] || {}),
              loading: true,
              unavailable: false,
            },
          }));

          try {
            const fullNote = note.noteData ? note : await getAiNote(note.id);
            const cardCount = buildLessonCards(fullNote).length;
            writeDeckStatsCacheEntry(note, cardCount);
            if (cancelled) return;
            setDeckStats((current) => ({
              ...current,
              [note.id]: {
                cardCount,
                loading: false,
                unavailable: false,
                countedAt: new Date().toISOString(),
              },
            }));
          } catch {
            if (!cancelled) {
              setDeckStats((current) => ({
                ...current,
                [note.id]: {
                  ...(current[note.id] || {}),
                  loading: false,
                  unavailable: true,
                },
              }));
            }
          } finally {
            deckCountLoadingRef.current.delete(note.id);
          }
        }
      }));
    }

    loadDeckCounts();
    return () => {
      cancelled = true;
    };
  }, [notes]);

  async function buildCardsFromNotes(selectedNotes, maxNotes = 18) {
    const unlockedNotes = (Array.isArray(selectedNotes) ? selectedNotes : []).filter((note) => !note.accessLocked);
    if (!unlockedNotes.length) return [];
    const sampleNotes = unlockedNotes.slice(0, maxNotes);
    const fullNotes = await Promise.all(
      sampleNotes.map((note) => note.noteData ? Promise.resolve(note) : getAiNote(note.id))
    );
    return uniqueCards(fullNotes.flatMap((note) => buildLessonCards(note)));
  }

  function openFlashcardSession(cards, title, mode = 'mixed') {
    if (!cards.length) return false;
    setActiveQuiz({
      id: `${mode}-${Date.now()}`,
      quizTitle: title,
      sourceNoteId: null,
    });
    setActiveCards(cards);
    setPhase('session');
    navigate(`/flashcards?mode=${mode}`, { replace: true });
    return true;
  }

  async function loadLessonCards(note) {
    setStarting(true);
    setError('');
    try {
      const fullNote = note.noteData ? note : await getAiNote(note.id);
      const cards = selectQueueCards(buildLessonCards(fullNote), 'all', 80);
      if (cards.length === 0) {
        setError('This lesson does not have enough note content for flashcards yet.');
        setPhase('pick');
        return;
      }
      setActiveQuiz({
        id:          `note-${fullNote.id}`,
        quizTitle:   fullNote.lessonTitle || fullNote.title || 'Lesson Flashcards',
        sourceNoteId: fullNote.id,
      });
      setActiveCards(cards);
      setPhase('session');
      navigate(`/flashcards?noteId=${fullNote.id}`, { replace: true });
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load flashcards'));
      setPhase('pick');
    } finally {
      setStarting(false);
    }
  }

  async function loadMixedCards(selectedNotes, title = 'Mixed Flashcards') {
    const unlockedNotes = (Array.isArray(selectedNotes) ? selectedNotes : []).filter((note) => !note.accessLocked);
    if (!unlockedNotes.length) {
      setError('No available lessons are ready for this mixed deck.');
      return;
    }

    setStarting(true);
    setError('');
    try {
      const cards = selectQueueCards(await buildCardsFromNotes(shuffle(unlockedNotes), 12), 'all', 60);
      if (cards.length === 0) {
        setError('These lessons do not have enough note content for mixed flashcards yet.');
        setPhase('pick');
        return;
      }
      setActiveQuiz({
        id: `mixed-${Date.now()}`,
        quizTitle: title,
        sourceNoteId: null,
      });
      setActiveCards(cards);
      setPhase('session');
      navigate('/flashcards?mode=mixed', { replace: true });
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load mixed flashcards'));
      setPhase('pick');
    } finally {
      setStarting(false);
    }
  }

  async function loadDueCards(selectedNotes) {
    const stats = readReviewStats();
    const targetIds = new Set(Object.entries(stats)
      .filter(([, row]) => {
        const dueAt = parseDueTime(row);
        return Boolean(dueAt && dueAt <= Date.now());
      })
      .map(([id]) => id));

    if (!targetIds.size) {
      setError('No due flashcards yet. Learn new cards or preview a deck first.');
      return;
    }

    const noteIds = new Set([...targetIds].map(noteIdFromStoredCardId).filter(Boolean));
    const reviewNotes = (selectedNotes || [])
      .filter((note) => !note.accessLocked && noteIds.has(Number(note.id)));

    if (!reviewNotes.length) {
      setError('Your due cards are not available in the current lessons list.');
      return;
    }

    setStarting(true);
    setError('');
    try {
      const cards = selectQueueCards(await buildCardsFromNotes(reviewNotes, 24), 'due', 60)
        .filter((card) => targetIds.has(cardStorageId(card)));

      if (!cards.length) {
        setError('No due cards could be rebuilt from the current lesson content.');
        setPhase('pick');
        return;
      }

      setActiveQuiz({
        id: `due-${Date.now()}`,
        quizTitle: 'Due Flashcards',
        sourceNoteId: null,
      });
      setActiveCards(cards);
      setPhase('session');
      navigate('/flashcards?mode=due', { replace: true });
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load due flashcards'));
      setPhase('pick');
    } finally {
      setStarting(false);
    }
  }

  async function loadNewCards(selectedNotes) {
    setStarting(true);
    setError('');
    try {
      const cards = selectQueueCards(await buildCardsFromNotes(selectedNotes, 18), 'new', DAILY_NEW_CARD_LIMIT);
      if (!cards.length) {
        setError('No new flashcards are available right now.');
        setPhase('pick');
        return;
      }
      openFlashcardSession(cards, 'New Flashcards', 'new');
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load new flashcards'));
      setPhase('pick');
    } finally {
      setStarting(false);
    }
  }

  async function loadQuickSession(selectedNotes) {
    setStarting(true);
    setError('');
    try {
      const cards = selectQueueCards(await buildCardsFromNotes(selectedNotes, 18), 'quick', QUICK_SESSION_LIMIT);
      if (!cards.length) {
        setError('No cards are available for a quick session yet.');
        setPhase('pick');
        return;
      }
      openFlashcardSession(cards, 'Quick 10-card Session', 'quick');
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load quick session'));
      setPhase('pick');
    } finally {
      setStarting(false);
    }
  }

  function handleDone(res) {
    setResult(res);
    setPhase('result');
  }

  function handleRetry() {
    setActiveCards(selectQueueCards([...activeCards], 'all', activeCards.length));
    setPhase('session');
  }

  function handleRetryMissed() {
    const { cards, learningIds } = result;
    setActiveCards(shuffle([...learningIds].map(i => cards[i])));
    setPhase('session');
  }

  function handleBackToPick() {
    setPhase('pick');
    setResult(null);
    navigate('/flashcards', { replace: true });
  }

  if (phase === 'session') {
    return (
      <SessionPhase
        quiz={activeQuiz}
        cards={activeCards}
        onDone={handleDone}
        onBack={handleBackToPick}
      />
    );
  }

  if (phase === 'result') {
    return (
      <ResultPhase
        quiz={activeQuiz}
        result={result}
        onRetry={handleRetry}
        onRetryMissed={handleRetryMissed}
        onBack={handleBackToPick}
      />
    );
  }

  return (
    <PickPhase
      notes={notes}
      loading={loading}
      error={error}
      onStartNote={loadLessonCards}
      onStartMixed={loadMixedCards}
      onStartDueReview={loadDueCards}
      onStartNewCards={loadNewCards}
      onStartQuickSession={loadQuickSession}
      starting={starting}
      deckStats={deckStats}
    />
  );
}
