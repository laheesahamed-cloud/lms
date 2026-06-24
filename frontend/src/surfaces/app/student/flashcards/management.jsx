import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listLocalDecks,
  createDeck,
  deleteDeck,
  addNote,
  updateNote,
  deleteNote,
  browseCards,
  allTags,
} from '../../../../shared/flashcards/localStore.js';
import { renderClozeFront, hasCloze } from './cloze.js';

/* ── shape local decks like the server deck tree (for DeckRow reuse) ── */
export function loadLocalDeckTree() {
  const map = (node, depth) => ({
    key: node.id,
    deckId: node.id,
    label: node.name,
    type: depth === 0 ? 'course' : 'lesson',
    depth,
    noteIds: [],
    newCount: node.newCount || 0,
    learningCount: node.learningCount || 0,
    dueCount: node.dueCount || 0,
    cardCount: node.cardCount || 0,
    locked: false,
    _local: true,
    children: (node.children || []).map((c) => map(c, depth + 1)),
  });
  return listLocalDecks().map((d) => map(d, 0));
}

/* ── tiny modal shell ─────────────────────────────────────── */
function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (typeof document === 'undefined') return null;

  return createPortal((
    <div className="xfc-modal-backdrop" onClick={onClose}>
      <div className={`xfc-modal ${wide ? 'xfc-modal--wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="xfc-modal-head">
          <h2>{title}</h2>
          <button type="button" className="xfc-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="xfc-modal-body">{children}</div>
        {footer ? <footer className="xfc-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  ), document.body);
}

/* ── Add / edit card ──────────────────────────────────────── */
const NOTE_TYPES = [
  { key: 'basic', label: 'Basic', hint: 'Front → Back' },
  { key: 'reversed', label: 'Basic + reversed', hint: 'Two cards' },
  { key: 'cloze', label: 'Cloze', hint: '{{c1::hidden}}' },
];

export function AddCardModal({ onClose, onSaved, editNote = null }) {
  const decks = useMemo(() => flattenLocal(loadLocalDeckTree()), []);
  const [noteType, setNoteType] = useState(editNote?.noteType || 'basic');
  const [front, setFront] = useState(editNote?.fields?.front || '');
  const [back, setBack] = useState(editNote?.fields?.back || '');
  const [text, setText] = useState(editNote?.fields?.text || '');
  const [image, setImage] = useState(editNote?.fields?.image || '');
  const [tags, setTags] = useState((editNote?.tags || []).join(', '));
  const [deckId, setDeckId] = useState(editNote?.deckId || decks[0]?.deckId || '__new');
  const [newDeckName, setNewDeckName] = useState('');
  const [error, setError] = useState('');
  const clozeRef = useRef(null);

  const valid = noteType === 'cloze'
    ? hasCloze(text)
    : front.trim().length > 0 && back.trim().length > 0;

  const wrapCloze = () => {
    const el = clozeRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = text.slice(start, end) || 'answer';
    const nextIdx = (text.match(/\{\{c(\d+)::/g) || []).length + 1;
    const wrapped = `${text.slice(0, start)}{{c${nextIdx}::${sel}}}${text.slice(end)}`;
    setText(wrapped);
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_500_000) { setError('Image is too large (max ~2.5MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!valid) { setError('Fill in the card content first.'); return; }
    let targetDeck = deckId;
    if (deckId === '__new') {
      const created = createDeck(newDeckName || 'My deck');
      targetDeck = created.id;
    }
    const fields = noteType === 'cloze' ? { text, image } : { front, back, image };
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (editNote) updateNote(editNote.id, { fields, tags: tagList, deckId: targetDeck });
    else addNote(targetDeck, noteType, fields, tagList);
    onSaved();
  };

  return (
    <Modal
      title={editNote ? 'Edit card' : 'Add card'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="xfc-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="xfc-primary" onClick={save} disabled={!valid}>{editNote ? 'Save' : 'Add card'}</button>
        </>
      }
    >
      <label className="xfc-field-label">Type</label>
      <div className="xfc-type-picker">
        {NOTE_TYPES.map((t) => (
          <button key={t.key} type="button" className={`xfc-type ${noteType === t.key ? 'is-active' : ''}`} onClick={() => setNoteType(t.key)} disabled={!!editNote && editNote.noteType !== t.key}>
            <span>{t.label}</span><small>{t.hint}</small>
          </button>
        ))}
      </div>

      {noteType === 'cloze' ? (
        <>
          <label className="xfc-field-label">Text <button type="button" className="xfc-mini" onClick={wrapCloze}>＋ cloze</button></label>
          <textarea ref={clozeRef} className="xfc-input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="The {{c1::mitochondria}} is the powerhouse of the cell." />
          {hasCloze(text) ? <div className="xfc-cloze-preview">{renderClozeFront(text)}</div> : <p className="xfc-help">Select a word and tap “＋ cloze”, or type <code>{'{{c1::answer}}'}</code>.</p>}
        </>
      ) : (
        <>
          <label className="xfc-field-label">Front</label>
          <textarea className="xfc-input" rows={2} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Question" />
          <label className="xfc-field-label">Back</label>
          <textarea className="xfc-input" rows={3} value={back} onChange={(e) => setBack(e.target.value)} placeholder="Answer" />
        </>
      )}

      <label className="xfc-field-label">Image (optional)</label>
      <div className="xfc-image-row">
        <input type="file" accept="image/*" onChange={onPickImage} />
        {image ? <button type="button" className="xfc-mini" onClick={() => setImage('')}>Remove</button> : null}
      </div>
      {image ? <img className="xfc-image-prev" src={image} alt="" /> : null}

      <label className="xfc-field-label">Deck</label>
      <select className="xfc-input" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
        {decks.map((d) => <option key={d.deckId} value={d.deckId}>{'— '.repeat(d.depth)}{d.label}</option>)}
        <option value="__new">＋ New deck…</option>
      </select>
      {deckId === '__new' ? <input className="xfc-input" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="New deck name" /> : null}

      <label className="xfc-field-label">Tags (comma separated)</label>
      <input className="xfc-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cardio, high-yield" />

      {error ? <p className="xfc-err">{error}</p> : null}
    </Modal>
  );
}

/* ── virtualized card browser ─────────────────────────────── */
const ROW_H = 64;

function VirtualList({ items, height, renderRow }) {
  const [scrollTop, setScrollTop] = useState(0);
  const total = items.length * ROW_H;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / ROW_H) + 4);
  const visible = items.slice(start, end);
  return (
    <div className="xfc-vlist" style={{ height }} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: total, position: 'relative' }}>
        {visible.map((item, i) => (
          <div key={item.id} style={{ position: 'absolute', top: (start + i) * ROW_H, left: 0, right: 0, height: ROW_H }}>
            {renderRow(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardBrowserModal({ onClose, onChanged }) {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [tag, setTag] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [version, setVersion] = useState(0);
  const tags = useMemo(() => allTags(), [version]);
  const cards = useMemo(
    () => browseCards({ query, state: stateFilter, tag }),
    [query, stateFilter, tag, version],
  );

  const refresh = useCallback(() => { setVersion((v) => v + 1); setSelected(new Set()); onChanged?.(); }, [onChanged]);

  const toggleSel = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkSuspend = () => {
    const noteIds = new Set([...selected].map((id) => String(id).split(':')[0]));
    noteIds.forEach((nid) => updateNote(nid, { suspended: true }));
    refresh();
  };
  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selected.size} card(s)? This removes their notes.`)) return;
    const noteIds = new Set([...selected].map((id) => String(id).split(':')[0]));
    noteIds.forEach((nid) => deleteNote(nid));
    refresh();
  };

  return (
    <Modal title={`Browse cards (${cards.length})`} onClose={onClose} wide>
      <div className="xfc-browse-controls">
        <input className="xfc-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search question, answer, tag…" />
        <select className="xfc-input xfc-input--sm" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="new">New</option>
          <option value="learning">Learning</option>
          <option value="due">Due</option>
          <option value="later">Later</option>
          <option value="suspended">Suspended</option>
        </select>
        {tags.length ? (
          <select className="xfc-input xfc-input--sm" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="xfc-bulkbar">
          <span>{selected.size} selected</span>
          <button type="button" className="xfc-mini" onClick={bulkSuspend}>Suspend</button>
          <button type="button" className="xfc-mini xfc-mini--danger" onClick={bulkDelete}>Delete</button>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <p className="xfc-help" style={{ padding: '24px 0', textAlign: 'center' }}>No cards match.</p>
      ) : (
        <VirtualList
          items={cards}
          height={Math.min(440, cards.length * ROW_H)}
          renderRow={(card) => (
            <CardRow card={card} selected={selected.has(card.id)} onToggle={() => toggleSel(card.id)} onChanged={refresh} />
          )}
        />
      )}
    </Modal>
  );
}

function CardRow({ card, selected, onToggle, onChanged }) {
  const noteId = String(card.id).split(':')[0];
  return (
    <div className={`xfc-card-row ${selected ? 'is-sel' : ''}`}>
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select card" />
      <button type="button" className="xfc-card-row-main" onClick={onToggle}>
        <span className="xfc-card-row-q">{String(card.question || '').replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1').slice(0, 90)}</span>
        <span className="xfc-card-row-meta">{card.noteType} · {card.bucket}{card.tags?.length ? ` · ${card.tags.join(', ')}` : ''}</span>
      </button>
      <button type="button" className="xfc-mini" onClick={() => { updateNote(noteId, { suspended: !card.suspended }); onChanged(); }}>
        {card.bucket === 'suspended' ? 'Unsuspend' : 'Suspend'}
      </button>
      <button type="button" className="xfc-mini xfc-mini--danger" onClick={() => { deleteNote(noteId); onChanged(); }}>Delete</button>
    </div>
  );
}

function flattenLocal(tree, depth = 0, out = []) {
  for (const node of tree) {
    out.push({ deckId: node.deckId, label: node.label, depth });
    if (node.children?.length) flattenLocal(node.children, depth + 1, out);
  }
  return out;
}

export { deleteDeck, createDeck };
