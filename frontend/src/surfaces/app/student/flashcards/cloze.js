import { createElement, Fragment } from 'react';

/**
 * Minimal Anki-style cloze rendering. A cloze field looks like:
 *   "The capital of {{c1::France::country}} is {{c2::Paris}}."
 * Front face hides the cloze (shows [...] or the hint); back face reveals it.
 * Lesson-generated cards are plain Q&A and never hit this path — it exists for
 * the student-created Cloze note type (Phase 3).
 */

const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

export function hasCloze(text) {
  return /\{\{c\d+::/.test(String(text || ''));
}

function tokenize(text) {
  const out = [];
  let lastIndex = 0;
  let match;
  CLOZE_RE.lastIndex = 0;
  while ((match = CLOZE_RE.exec(String(text || ''))) !== null) {
    if (match.index > lastIndex) out.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    out.push({ type: 'cloze', index: Number(match[1]), answer: match[2], hint: match[3] || '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < String(text || '').length) out.push({ type: 'text', value: text.slice(lastIndex) });
  return out;
}

// activeIndex (optional): when set, only that cloze is hidden on the front and
// other clozes show their answer — that's how one cloze sentence yields one
// card per index. When omitted, all clozes are hidden (preview mode).
export function renderClozeFront(text, activeIndex = null) {
  const parts = tokenize(text).map((part, i) => {
    if (part.type === 'text') return createElement(Fragment, { key: i }, part.value);
    const isActive = activeIndex == null || part.index === activeIndex;
    if (isActive) return createElement('span', { key: i, className: 'xfc-cloze-blank' }, part.hint ? `[${part.hint}]` : '[…]');
    return createElement(Fragment, { key: i }, part.answer);
  });
  return createElement('span', null, parts);
}

export function renderClozeBack(text, fallbackAnswer, activeIndex = null) {
  if (!hasCloze(text)) return String(fallbackAnswer || text || '');
  const parts = tokenize(text).map((part, i) => {
    if (part.type === 'text') return createElement(Fragment, { key: i }, part.value);
    const isActive = activeIndex == null || part.index === activeIndex;
    return createElement('span', { key: i, className: isActive ? 'xfc-cloze-fill' : undefined }, part.answer);
  });
  return createElement('span', null, parts);
}
