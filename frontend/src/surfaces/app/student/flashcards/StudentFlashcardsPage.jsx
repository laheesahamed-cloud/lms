import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAiNote, listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { StudentPageHero } from '../components/StudentPageHero.jsx';
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

function recordFlashcardReview(card, wasKnown) {
  if (typeof window === 'undefined') return;
  const id = cardStorageId(card);
  if (!id) return;

  try {
    const stats = readReviewStats();
    const previous = stats[id] || {};
    const intervalDays = wasKnown
      ? Math.min(Math.max(Number(previous.intervalDays) || 1, 1) * 2, 30)
      : 1;
    const now = Date.now();

    stats[id] = {
      id,
      questionText: card.questionText,
      context: card.context,
      questionType: card.questionType,
      attempts: (Number(previous.attempts) || 0) + 1,
      correct: (Number(previous.correct) || 0) + (wasKnown ? 1 : 0),
      learning: (Number(previous.learning) || 0) + (wasKnown ? 0 : 1),
      intervalDays,
      lastReviewedAt: new Date(now).toISOString(),
      dueAt: new Date(now + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
    };

    window.localStorage.setItem(FLASHCARD_REVIEW_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Review scheduling should never block the study flow.
  }
}

function reviewStatus(card, stats = readReviewStats()) {
  const row = stats[cardStorageId(card)];
  if (!row) return { state: 'new', score: 1 };

  const dueAt = row.dueAt ? Date.parse(row.dueAt) : 0;
  const isDue = dueAt && dueAt <= Date.now();
  const correct = Number(row.correct) || 0;
  const learning = Number(row.learning) || 0;
  const attempts = Number(row.attempts) || 0;
  const weak = learning > correct || (attempts > 1 && correct / attempts < 0.6);

  if (isDue && weak) return { state: 'due weak', score: 5 };
  if (isDue) return { state: 'due', score: 4 };
  if (weak) return { state: 'weak', score: 3 };
  return { state: 'reviewed', score: 0 };
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

function noteIdFromStoredCardId(id) {
  const first = String(id || '').split('-')[0];
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : null;
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

function buildCourseGroups(notes, filter) {
  const filtered = filter
    ? notes.filter(n => {
        const q = filter.toLowerCase();
        return (
          (n.lessonTitle || n.title || '').toLowerCase().includes(q) ||
          (n.courseTitle  || '').toLowerCase().includes(q) ||
          (n.topicName    || '').toLowerCase().includes(q) ||
          (n.subtopicName || '').toLowerCase().includes(q)
        );
      })
    : notes;

  const groups = {};
  filtered.forEach(note => {
    const c = note.courseTitle || 'General';
    const s = note.topicName   || 'Other';
    if (!groups[c])    groups[c]    = {};
    if (!groups[c][s]) groups[c][s] = [];
    groups[c][s].push(note);
  });
  return groups;
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

function IcCards() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="11" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <rect x="3" y="2.5" width="11" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".36"/>
    </svg>
  );
}

function IcChevron({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
      style={{ transition: 'transform 0.22s cubic-bezier(0.23,1,0.32,1)', transform: open ? 'rotate(180deg)' : 'none' }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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
  if (status.state === 'new' || status.state === 'reviewed') return null;

  const isWeak = status.state.includes('weak');
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: isWeak ? 'rgba(244,63,94,0.10)' : 'rgba(59,130,246,0.10)',
        color: isWeak ? '#E11D48' : '#2563EB',
        border: `1px solid ${isWeak ? 'rgba(244,63,94,0.22)' : 'rgba(59,130,246,0.22)'}`,
      }}
    >
      {isWeak ? 'Needs Review' : 'Due'}
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
function LessonCard({ note, onStart, starting }) {
  const navigate = useNavigate();
  const isLocked = Boolean(note.accessLocked);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line-soft bg-surface-1 p-4 shadow-xs
      transition-[transform,box-shadow] duration-150 ease-out
      hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-md">
      <h3 className="m-0 line-clamp-2 text-[13.5px] font-extrabold leading-snug text-ink-strong">
        {note.lessonTitle || note.title}
      </h3>
      {note.subtopicName && (
        <p className="m-0 text-[11px] font-semibold text-ink-muted">{note.subtopicName}</p>
      )}
      <div className="mt-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft opacity-60">
          <IcCards/>Lesson deck
        </span>
        <button
          type="button"
          className="ml-auto inline-flex min-h-8 items-center justify-center rounded-full border px-3.5
            text-[12px] font-extrabold transition-[transform,opacity] duration-150 ease-out
            hover:-translate-y-0.5 active:scale-[0.97]
            disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
          style={{ background: 'rgba(59,130,246,0.09)', borderColor: 'rgba(59,130,246,0.22)', color: '#3B82F6' }}
          onClick={() => isLocked ? navigate('/billing') : onStart(note)}
          disabled={starting}
        >
          {isLocked ? 'Upgrade' : starting ? 'Loading...' : 'Start'}
        </button>
      </div>
    </div>
  );
}

function SubjectSection({ subjectName, notes, onStartNote, onStartMixed, starting }) {
  return (
    <div className="border-b border-line-soft/60 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5" style={{ background: 'var(--surface-2)' }}>
        <span className="text-[10.5px] font-black uppercase tracking-[0.09em] text-ink-muted">
          {subjectName}
          <span className="ml-2 font-bold opacity-55">({notes.length})</span>
        </span>
        <button
          type="button"
          className="inline-flex min-h-7 items-center justify-center rounded-full border px-3 text-[11px] font-extrabold text-brand-primary transition-[transform,opacity] hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.20)' }}
          onClick={() => onStartMixed(notes, `${subjectName} Mixed Flashcards`)}
          disabled={starting || notes.every((note) => note.accessLocked)}
        >
          Mix {subjectName}
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3 p-4">
        {notes.map(note => (
          <LessonCard key={note.id} note={note} onStart={onStartNote} starting={starting}/>
        ))}
      </div>
    </div>
  );
}

function CourseAccordion({ courseName, subjects, onStartNote, onStartMixed, starting }) {
  const [open, setOpen] = useState(true);
  const lessonCount  = Object.values(subjects).reduce((n, arr) => n + arr.length, 0);
  const subjectCount = Object.keys(subjects).length;
  const courseNotes = Object.values(subjects).flat();

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-line-soft bg-surface-1 shadow-xs">
      <div
        className="flex w-full items-center gap-3 px-5 py-4 text-left
          transition-[background] duration-150 hover:bg-surface-2/50
          focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/15"
      >
        <button
          type="button"
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setOpen(v => !v)}
        >
          <span
          className="grid size-9 shrink-0 place-items-center rounded-xl text-[14px] font-extrabold"
          style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6' }}
          aria-hidden="true"
          >
            {courseName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-ink-strong">{courseName}</div>
            <div className="text-xs font-semibold text-ink-muted">
              {subjectCount} subject{subjectCount !== 1 ? 's' : ''} · {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
            </div>
          </div>
          <IcChevron open={open}/>
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border px-3.5 text-[12px] font-extrabold text-brand-primary transition-[transform,opacity] hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 max-[520px]:w-full"
          style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.22)' }}
          onClick={() => onStartMixed(courseNotes, `${courseName} Mixed Flashcards`)}
          disabled={starting || courseNotes.every((note) => note.accessLocked)}
        >
          Mix course
        </button>
      </div>
      {open && (
        <div className="border-t border-line-soft/60">
          {Object.entries(subjects).map(([subj, notes]) => (
            <SubjectSection
              key={subj}
              subjectName={subj}
              notes={notes}
              onStartNote={onStartNote}
              onStartMixed={onStartMixed}
              starting={starting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PickPhase({ notes, loading, error, onStartNote, onStartMixed, onStartDueReview, starting }) {
  const [filter, setFilter] = useState('');
  const groups      = buildCourseGroups(notes, filter);
  const courseNames = Object.keys(groups);
  const reviewRows = Object.values(readReviewStats());
  const dueCount = reviewRows.filter((row) => row?.dueAt && Date.parse(row.dueAt) <= Date.now()).length;
  const weakCount = reviewRows.filter((row) => (Number(row.learning) || 0) > (Number(row.correct) || 0)).length;

  return (
    <main className="dashboard-page study-hub-page student-flashcards-page">
      <style>{ANIM_CSS}</style>
      <section className="study-hub-shell">
        <AppHeader
          title="Flashcards"
          subtitle="Recall Practice"
        />

        <StudentPageHero
          title="Flashcards"
          subtitle="Recall Practice"
          metrics={[
            { label: 'Lessons', value: loading ? '-' : notes.length },
            { label: 'Courses', value: loading ? '-' : courseNames.length },
            { label: 'Modes', value: '2' },
          ]}
        />

        {error && <div className={cx(ui.feedbackError, 'mb-4 fc-fade-up')}>{error}</div>}

        {/* How-to strip */}
        <div className="mb-5 grid grid-cols-3 gap-3 rounded-xl border border-line-soft bg-surface-1 p-3 shadow-xs fc-fade-up max-[720px]:grid-cols-1">
          {[
            ['Pick a lesson',  'Browse by course and subject. Each lesson generates focused Q&A cards.'],
            ['Mix a topic',     'Use Mix on a course or subject to practice random cards from many lessons.'],
            ['Recall first',   "Form your answer mentally before flipping — that's where learning happens."],
          ].map(([title, desc], i) => (
            <div key={title} className="flex items-start gap-3 rounded-lg bg-surface-2 px-3.5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold"
                style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6' }} aria-hidden="true">{i + 1}</span>
              <div>
                <strong className="block text-[13px] font-extrabold text-ink-strong">{title}</strong>
                <span className="text-[12px] leading-relaxed text-ink-soft">{desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-1 px-4 py-3 shadow-xs fc-fade-up fc-d1">
          <div>
            <strong className="block text-[13px] font-extrabold text-ink-strong">Smart review</strong>
            <span className="text-[12px] font-semibold text-ink-muted">
              {dueCount || weakCount
                ? `${dueCount} due · ${weakCount} needs review`
                : 'Mark cards during study to build a review deck.'}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center rounded-full border px-3.5 text-[12px] font-extrabold transition-[transform,opacity] hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            style={{ background: 'rgba(16,185,129,0.09)', borderColor: 'rgba(16,185,129,0.22)', color: '#059669' }}
            disabled={starting || (!dueCount && !weakCount)}
            onClick={() => onStartDueReview(notes)}
          >
            Review due
          </button>
        </div>

        {/* Search */}
        <div className="mb-5 flex min-h-11 items-center gap-2.5 rounded-xl border border-line-soft bg-surface-1 px-3 shadow-xs
          transition-[border-color,box-shadow] duration-150
          focus-within:border-brand-primary/40 focus-within:ring-4 focus-within:ring-brand-primary/10 fc-fade-up fc-d1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: .4 }} aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] font-semibold text-ink-strong outline-none placeholder:text-ink-muted"
            placeholder="Search by lesson, subject, or course…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Search flashcard lessons"
          />
          {filter && (
            <button type="button"
              className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-muted transition hover:text-ink-strong"
              onClick={() => setFilter('')} aria-label="Clear search">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map(i => <div key={i} className={ui.shimmer} style={{ height: 120, borderRadius: 16 }}/>)}
          </div>
        ) : courseNames.length === 0 ? (
          <div className={ui.emptyBox}>
            <p>{notes.length === 0 ? 'No flashcard decks available yet.' : 'No lessons match your search.'}</p>
          </div>
        ) : (
          <div className="fc-fade-up fc-d2">
            {courseNames.map(course => (
              <CourseAccordion
                key={course}
                courseName={course}
                subjects={groups[course]}
                onStartNote={onStartNote}
                onStartMixed={onStartMixed}
                starting={starting}
              />
            ))}
          </div>
        )}
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
  const pointerRef = useRef({ x: 0, y: 0, moved: false });

  useEffect(() => { flippedRef.current = flipped; }, [flipped]);
  useEffect(() => { advancingRef.current = advancing; }, [advancing]);

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

  function advance(wasKnown) {
    if (!flippedRef.current || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    const newKnown    = wasKnown  ? new Set([...known,    idx]) : known;
    const newLearning = !wasKnown ? new Set([...learning, idx]) : learning;
    recordFlashcardReview(card, wasKnown);
    setKnown(newKnown);
    setLearning(newLearning);
    setFlipped(false);
    setTimeout(() => {
      if (idx + 1 >= cards.length) {
        clearFlashcardSession(quiz);
        onDone({ cards, knownIds: newKnown, learningIds: newLearning });
      } else {
        setIdx(i => i + 1);
        advancingRef.current = false;
        setAdvancing(false);
      }
    }, 160);
  }
  advanceRef.current = advance;

  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented || isInteractiveElement(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      if (flippedRef.current && e.key === 'ArrowRight') advanceRef.current(true);
      if (flippedRef.current && e.key === 'ArrowLeft')  advanceRef.current(false);
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
          className="mb-3 flex flex-wrap justify-center gap-3 transition-[opacity,transform] duration-200 max-[520px]:grid max-[520px]:grid-cols-1"
          style={{ opacity: flipped ? 1 : 0, pointerEvents: flipped ? 'auto' : 'none', transform: flipped ? 'translateY(0)' : 'translateY(4px)' }}
          aria-hidden={!flipped}
        >
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-6 text-sm font-extrabold
              transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(245,158,11,0.09)', borderColor: 'rgba(245,158,11,0.22)', color: '#D97706' }}
            onClick={() => advance(false)} disabled={!flipped || advancing}>
            <IcReview/> Still Learning
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-6 text-sm font-extrabold
              transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.09)', borderColor: 'rgba(16,185,129,0.22)', color: '#059669' }}
            onClick={() => advance(true)} disabled={!flipped || advancing}>
            <IcKnow/> Know It
          </button>
        </div>

        <p className="text-center text-xs font-semibold text-ink-muted">
          {flipped ? (
            <><kbd className="rounded bg-surface-2 px-1.5 py-0.5">←</kbd> Still Learning &nbsp;·&nbsp; <kbd className="rounded bg-surface-2 px-1.5 py-0.5">→</kbd> Know It</>
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

  const [phase,    setPhase]    = useState('pick');
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [starting, setStarting] = useState(false);

  const [activeQuiz,  setActiveQuiz]  = useState(null);
  const [activeCards, setActiveCards] = useState([]);
  const [result,      setResult]      = useState(null);

  useEffect(() => {
    listAiNotes()
      .then(rows => {
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

  async function loadLessonCards(note) {
    setStarting(true);
    setError('');
    try {
      const fullNote = note.noteData ? note : await getAiNote(note.id);
      const cards = prioritizeCards(buildLessonCards(fullNote));
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
      const sampleNotes = shuffle(unlockedNotes).slice(0, 12);
      const fullNotes = await Promise.all(
        sampleNotes.map((note) => note.noteData ? Promise.resolve(note) : getAiNote(note.id))
      );
      const cards = prioritizeCards(fullNotes.flatMap((note) => buildLessonCards(note))).slice(0, 60);
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
    const targetIds = new Set(
      Object.entries(stats)
        .filter(([, row]) => {
          const due = row?.dueAt && Date.parse(row.dueAt) <= Date.now();
          const weak = (Number(row?.learning) || 0) > (Number(row?.correct) || 0);
          return due || weak;
        })
        .map(([id]) => id)
    );

    if (!targetIds.size) {
      setError('No due or weak flashcards yet. Study a lesson first.');
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
      const fullNotes = await Promise.all(
        reviewNotes.map((note) => note.noteData ? Promise.resolve(note) : getAiNote(note.id))
      );
      const cards = prioritizeCards(fullNotes.flatMap((note) => buildLessonCards(note)))
        .filter((card) => targetIds.has(cardStorageId(card)))
        .slice(0, 60);

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

  function handleDone(res) {
    setResult(res);
    setPhase('result');
  }

  function handleRetry() {
    setActiveCards(prioritizeCards([...activeCards]));
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
      starting={starting}
    />
  );
}
