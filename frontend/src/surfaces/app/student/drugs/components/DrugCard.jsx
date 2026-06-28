import './DrugCard.css';

const MAX_POINTS = 6;
const MAX_POINT_LEN = 180;

function splitPoints(text) {
  if (!text) return [];
  // Try semicolon split first (how our import script joins items)
  let parts = text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  // If no semicolons, split on sentence boundaries
  if (parts.length === 1) {
    parts = text.split(/(?<=\.)\s+/).map(s => s.trim()).filter(Boolean);
  }
  // Truncate each point and limit count
  return parts
    .slice(0, MAX_POINTS)
    .map(s => s.replace(/^\d+(\.\d+)?\s+[A-Z][A-Z\s,()/-]+\s+/g, '').trim())
    .filter(Boolean)
    .map(s => s.length > MAX_POINT_LEN ? s.slice(0, MAX_POINT_LEN).trimEnd() + '…' : s);
}

function stripTag(text) {
  return text ? text.replace(/\s*\[EPC\]|\s*\[MoA\]|\s*\[PE\]|\s*\[CS\]/g, '').trim() : text;
}

const ICONS = {
  drug_class: (
    <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  sl_brand_names: (
    <svg viewBox="0 0 20 20" fill="none"><path d="M4 5h12M4 10h8M4 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  dosage_adult: (
    <svg viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="4" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M10 9v5M7.5 11.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  dosage_pediatric: (
    <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 17c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  uses: (
    <svg viewBox="0 0 20 20" fill="none"><path d="M10 3v1M10 16v1M3 10h1M16 10h1M5.05 5.05l.707.707M14.243 14.243l.707.707M5.05 14.95l.707-.707M14.243 5.757l.707-.707" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  side_effects: (
    <svg viewBox="0 0 20 20" fill="none"><path d="M10 3L2.5 16.5h15L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 8v4M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  warnings: (
    <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v5M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  drug_interactions: (
    <svg viewBox="0 0 20 20" fill="none"><path d="M4 10h12M13 7l3 3-3 3M7 7L4 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  pregnancy_info: (
    <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 9c-2 0-4 1.5-4 4v4h8v-4c0-2.5-2-4-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="10" cy="13" r="1.5" fill="currentColor"/></svg>
  ),
};

const SECTIONS = [
  { key: 'drug_class',        label: 'Drug Class',        tone: 'class' },
  { key: 'sl_brand_names',    label: 'Sri Lanka Brands',  tone: 'brands' },
  { key: 'uses',              label: 'Uses',              tone: 'uses' },
  { key: 'dosage_adult',      label: 'Adult Dosage',      tone: 'dosage' },
  { key: 'dosage_pediatric',  label: 'Pediatric Dosage',  tone: 'dosage' },
  { key: 'side_effects',      label: 'Side Effects',      tone: 'warn-amber' },
  { key: 'warnings',          label: 'Warnings',          tone: 'warn-red' },
  { key: 'drug_interactions', label: 'Drug Interactions', tone: 'warn-orange' },
  { key: 'pregnancy_info',    label: 'Pregnancy',         tone: 'pregnancy' },
];

export function DrugCard({ drug }) {
  if (!drug) return null;
  return (
    <div className="dc-root">
      <div className="dc-name-row">
        <div className="dc-pill" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="9" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <div>
          <h2 className="dc-name">{drug.name}</h2>
          {drug.drug_class && <p className="dc-sub">{stripTag(drug.drug_class)}</p>}
        </div>
      </div>

      <div className="dc-cards">
        {SECTIONS.map(({ key, label, tone }) => {
          const raw = key === 'drug_class' ? stripTag(drug[key]) : drug[key];
          if (!raw) return null;
          const points = splitPoints(raw);
          return (
            <div key={key} className={`dc-card dc-card--${tone}`}>
              <div className="dc-card-head">
                <span className="dc-card-icon" aria-hidden="true">{ICONS[key]}</span>
                <span className="dc-card-label">{label}</span>
              </div>
              {points.length === 1 ? (
                <p className="dc-card-single">{points[0]}</p>
              ) : (
                <ul className="dc-card-list">
                  {points.map((pt, i) => (
                    <li key={i} className="dc-card-item">{pt}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
