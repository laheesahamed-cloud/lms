import { emptyState, applyGrade, preview } from './fsrsClient.js';

/**
 * On-device store for student-created flashcards. Decks, notes, and per-card
 * FSRS state all live in localStorage (works offline + in the iOS WebView).
 * These never touch the server — they're the user's private collection. Note
 * types: basic (Front/Back), reversed (two cards), cloze ({{c1::…}}).
 */

const KEY = 'xfc.local.v2';
const DAY_MS = 86400000;

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return { version: 2, decks: [], notes: [], state: {}, ...parsed };
    }
  } catch {
    /* corrupt → fresh */
  }
  return { version: 2, decks: [], notes: [], state: {} };
}

function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota — best effort */ }
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clozeIndexes(text) {
  const set = new Set();
  const re = /\{\{c(\d+)::/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

/* ── derive cards from a note ─────────────────────────────── */
function cardsForNote(note) {
  const base = {
    noteId: note.id,
    deckId: note.deckId,
    tags: note.tags || [],
    suspended: !!note.suspended,
    imageUrls: note.fields?.image ? [note.fields.image] : [],
    imageFit: note.fields?.imageFit || 'contain',
    sourceHint: '',
    _local: true,
  };
  if (note.noteType === 'cloze') {
    const text = note.fields?.text || '';
    return clozeIndexes(text).map((ci) => ({
      ...base,
      id: `${note.id}:${ci}`,
      ord: ci,
      question: text,
      answer: '',
      clozeText: text,
      clozeIndex: ci,
    }));
  }
  if (note.noteType === 'reversed') {
    return [
      { ...base, id: `${note.id}:0`, ord: 0, question: note.fields?.front || '', answer: note.fields?.back || '' },
      { ...base, id: `${note.id}:1`, ord: 1, question: note.fields?.back || '', answer: note.fields?.front || '' },
    ];
  }
  return [{ ...base, id: `${note.id}:0`, ord: 0, question: note.fields?.front || '', answer: note.fields?.back || '' }];
}

function descendantDeckIds(db, deckId) {
  const ids = [deckId];
  let added = true;
  while (added) {
    added = false;
    for (const d of db.decks) {
      if (ids.includes(d.parentId) && !ids.includes(d.id)) { ids.push(d.id); added = true; }
    }
  }
  return ids;
}

function bucketOf(state, now) {
  if (!state) return 'new';
  const due = Date.parse(state.due);
  if ((state.state === 1 || state.state === 3) && due <= now) return 'learning';
  if (state.state === 2 && due <= now + DAY_MS) return 'due';
  return 'later';
}

/* ── decks ────────────────────────────────────────────────── */
export function listLocalDecks() {
  const db = load();
  const now = Date.now();
  const counts = new Map();
  for (const note of db.notes) {
    for (const card of cardsForNote(note)) {
      if (card.suspended) continue;
      const b = bucketOf(db.state[card.id], now);
      const ids = ancestorChain(db, note.deckId);
      for (const id of ids) {
        const c = counts.get(id) || { newCount: 0, learningCount: 0, dueCount: 0, cardCount: 0 };
        c.cardCount += 1;
        if (b === 'new') c.newCount += 1;
        else if (b === 'learning') c.learningCount += 1;
        else if (b === 'due') c.dueCount += 1;
        counts.set(id, c);
      }
    }
  }
  const byId = new Map(db.decks.map((d) => [d.id, { ...d, children: [], ...(counts.get(d.id) || { newCount: 0, learningCount: 0, dueCount: 0, cardCount: 0 }) }]));
  const roots = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  });
  return roots;
}

function ancestorChain(db, deckId) {
  const chain = [];
  let id = deckId;
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    chain.push(id);
    const deck = db.decks.find((d) => d.id === id);
    id = deck?.parentId || null;
  }
  return chain;
}

export function createDeck(name, parentId = null) {
  const db = load();
  const deck = { id: uid('deck'), name: String(name || 'New deck').trim() || 'New deck', parentId: parentId || null, createdAt: new Date().toISOString() };
  db.decks.push(deck);
  save(db);
  return deck;
}

export function deleteDeck(deckId) {
  const db = load();
  const ids = descendantDeckIds(db, deckId);
  const removedNotes = db.notes.filter((n) => ids.includes(n.deckId));
  for (const n of removedNotes) for (const c of cardsForNote(n)) delete db.state[c.id];
  db.notes = db.notes.filter((n) => !ids.includes(n.deckId));
  db.decks = db.decks.filter((d) => !ids.includes(d.id));
  save(db);
}

/* ── notes ────────────────────────────────────────────────── */
export function addNote(deckId, noteType, fields, tags = []) {
  const db = load();
  const note = {
    id: uid('note'),
    deckId,
    noteType: ['basic', 'reversed', 'cloze'].includes(noteType) ? noteType : 'basic',
    fields: fields || {},
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    suspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.notes.push(note);
  save(db);
  return note;
}

export function updateNote(noteId, patch) {
  const db = load();
  const note = db.notes.find((n) => n.id === noteId);
  if (!note) return null;
  if (patch.fields) note.fields = { ...note.fields, ...patch.fields };
  if (patch.tags) note.tags = patch.tags.filter(Boolean);
  if (patch.deckId) note.deckId = patch.deckId;
  if (patch.suspended != null) note.suspended = !!patch.suspended;
  note.updatedAt = new Date().toISOString();
  save(db);
  return note;
}

export function deleteNote(noteId) {
  const db = load();
  const note = db.notes.find((n) => n.id === noteId);
  if (note) for (const c of cardsForNote(note)) delete db.state[c.id];
  db.notes = db.notes.filter((n) => n.id !== noteId);
  save(db);
}

/* ── browse (search/filter across all local cards) ────────── */
export function browseCards({ query = '', deckId = null, state: stateFilter = 'all', tag = '' } = {}) {
  const db = load();
  const now = Date.now();
  const ids = deckId ? descendantDeckIds(db, deckId) : null;
  const q = query.trim().toLowerCase();
  const out = [];
  for (const note of db.notes) {
    if (ids && !ids.includes(note.deckId)) continue;
    if (tag && !(note.tags || []).includes(tag)) continue;
    for (const card of cardsForNote(note)) {
      const st = db.state[card.id];
      const bucket = card.suspended ? 'suspended' : bucketOf(st, now);
      if (stateFilter !== 'all') {
        if (stateFilter === 'suspended' && !card.suspended) continue;
        if (stateFilter !== 'suspended' && bucket !== stateFilter) continue;
      }
      const hay = `${card.question} ${card.answer} ${(note.tags || []).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      out.push({ ...card, noteType: note.noteType, bucket, tags: note.tags || [] });
    }
  }
  return out;
}

export function allTags() {
  const db = load();
  return [...new Set(db.notes.flatMap((n) => n.tags || []))].sort();
}

/* ── review queue + grading (client FSRS) ─────────────────── */
export function buildLocalQueue(deckId, { newLimit = 20, reviewLimit = 200 } = {}) {
  const db = load();
  const now = Date.now();
  const ids = descendantDeckIds(db, deckId);
  const learning = [];
  const due = [];
  const fresh = [];
  for (const note of db.notes) {
    if (!ids.includes(note.deckId)) continue;
    for (const card of cardsForNote(note)) {
      if (card.suspended) continue;
      const st = db.state[card.id];
      const item = { card, state: st ? bucketName(st) : 'new', due: st ? st.due : new Date().toISOString(), previews: preview(st || emptyState(new Date(now)), new Date(now)) };
      const b = bucketOf(st, now);
      if (b === 'new') fresh.push(item);
      else if (b === 'learning') learning.push(item);
      else if (b === 'due') due.push(item);
    }
  }
  learning.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  due.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  return [...learning, ...due.slice(0, reviewLimit), ...fresh.slice(0, Math.max(0, newLimit))];
}

function bucketName(st) {
  if (st.state === 1) return 'learning';
  if (st.state === 2) return 'review';
  if (st.state === 3) return 'relearning';
  return 'new';
}

export function gradeLocalCard(cardId, rating, reviewTime = new Date()) {
  const db = load();
  const prior = db.state[cardId] || emptyState(reviewTime);
  const next = applyGrade(prior, rating, reviewTime);
  const log = Array.isArray(prior.log) ? prior.log.slice(-199) : [];
  log.push({ rating: Number(rating), ts: reviewTime.toISOString(), due: next.due });
  db.state[cardId] = { ...next, log };
  save(db);
  return db.state[cardId];
}

export function undoLocalCard(cardId) {
  const db = load();
  const st = db.state[cardId];
  if (!st || !Array.isArray(st.log) || st.log.length === 0) {
    delete db.state[cardId];
    save(db);
    return null;
  }
  st.log.pop();
  if (!st.log.length) { delete db.state[cardId]; save(db); return null; }
  save(db);
  return db.state[cardId];
}

export function localStats() {
  const db = load();
  const now = Date.now();
  const counts = { new: 0, learning: 0, review: 0, relearning: 0 };
  let totalReviews = 0;
  let good = 0;
  const perDay = {};
  for (const note of db.notes) {
    for (const card of cardsForNote(note)) {
      const st = db.state[card.id];
      if (!st) { counts.new += 1; continue; }
      counts[bucketName(st)] += 1;
      for (const e of st.log || []) {
        totalReviews += 1;
        if (e.rating >= 3) good += 1;
        const k = new Date(e.ts).toISOString().slice(0, 10);
        perDay[k] = (perDay[k] || 0) + 1;
      }
    }
  }
  return {
    counts,
    totalReviews,
    retention: totalReviews ? Math.round((good / totalReviews) * 1000) / 10 : null,
    reviewsPerDay: Object.entries(perDay).map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? -1 : 1)),
    now,
  };
}
