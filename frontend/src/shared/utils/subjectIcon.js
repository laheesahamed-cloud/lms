// Which icon and colour a course gets, worked out from its name — the same
// rules and the same SVG files as the mobile app (mobile/lib/features/courses/
// subject_icons.dart), so a course looks the same on the website and in the app.
//
// Name matching needs no database column and no admin picker. The FIRST pattern
// that matches wins, so the specific ones come before the general ("Obstetrics"
// must beat "medicine"). Short words carry \b on both sides, otherwise "ear"
// matches inside "research" and "vision" inside "Revision".
//
// Icons are Tabler (stroke) plus three Healthicons (filled) where Tabler has no
// scalpel, uterus or baby. Licences sit beside the SVGs.

const SVGS = import.meta.glob('../assets/subject-icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const C = {
  rose: '#FB7185',
  blue: '#60A5FA',
  violet: '#8B5CF6',
  green: '#34D399',
  cyan: '#38BDF8',
  amber: '#FBBF24',
  gold: '#F4B740',
  pink: '#F472B6',
  indigo: '#818CF8',
  teal: '#2DD4BF',
  orange: '#FB923C',
  lime: '#A3E635',
  sky: '#7DD3FC',
  plum: '#C084FC',
  slate: '#94A3B8',
};

const FALLBACK = { asset: 'book-2', colour: C.slate };

const RULES = [

  // ── specialties whose names contain another subject's word ──
  [/obstet|gyn[ae]ec|antenatal|obs\b/i, 'hi-female-reproductive', C.pink],
  [/p[ae]+diatric|neonat|child health/i, 'hi-baby', C.amber],
  [/forensic|medico.?legal/i, 'fingerprint', C.slate],
  [/community|public health|epidemiolog/i, 'users-group', C.teal],
  [/emergency|casualty|acute care|resus/i, 'ambulance', C.rose],
  [/an[ae]esthe/i, 'face-mask', C.indigo],

  // ── organ systems ──
  [/cardio|\bhearts?\b|coronar|arrhythm|myocard|vascular/i, 'heart', C.rose],
  [/respir|\blungs?\b|pulmo|asthma|\bcopd\b|\bchest\b/i, 'lungs', C.blue],
  [/neuro|\bbrain\b|\bstrokes?\b|seizure|epilep/i, 'brain', C.violet],
  [/psych|\bpsy\b|mental health|behaviou?r/i, 'mood-puzzled', C.plum],
  [/orthop|\bbones?\b|fracture|musculoskelet|rheumat|\bjoints?\b|arthrit/i, 'bone', C.gold],
  [/derma|\bskin\b/i, 'hand-finger', C.orange],
  [/ophthalm|\beyes?\b|\bvision\b|retina|optomet/i, 'eye', C.blue],
  [/\bent\b|otolaryng|\bears?\b|\bnose\b|\bthroat\b|audiolog/i, 'ear', C.teal],
  [/dental|dentist|oral health|\btooth\b|\bteeth\b/i, 'dental', C.sky],
  [/h[ae]mat|\bblood\b|transfusion|an[ae]mia|leuk/i, 'droplet', C.rose],
  [/nephro|renal|kidney|urolog|bladder/i, 'droplets', C.sky],
  [/gastro|hepat|\bliver\b|stomach|bowel|\bgit\b/i, 'flask', C.orange],
  [/endocrin|diabet|thyroid|hormone/i, 'atom', C.lime],

  // ── basic and lab sciences ──
  [/anatom|dissect|histolog|embryo/i, 'body-scan', C.indigo],
  [/physiolog/i, 'activity-heartbeat', C.green],
  [/bio ?chem/i, 'flask', C.teal],
  [/pharmac|drug|therapeut|prescrib/i, 'prescription', C.green],
  [/patholog|histopath|autopsy/i, 'microscope', C.plum],
  [/micro ?bio|bacteri|viro|parasit|infect|mycolog/i, 'virus', C.lime],
  [/immun|vaccin|allerg/i, 'shield-check', C.sky],
  [/genetic|genom|\bdna\b|hered/i, 'dna', C.green],
  [/nutrit|\bdiets?\b|dietet/i, 'apple', C.green],
  [/toxicolog|poison|overdose|venom/i, 'test-pipe', C.lime],
  [/statistic|research|biostat|\baudit\b|\bdata\b/i, 'chart-bar', C.gold],
  [/radiolog|imaging|x.?ray|ultrasound|\bscans?\b|\bct\b|\bmri\b/i, 'radioactive', C.cyan],
  [/oncolog|cancer|tumou?r|malignan/i, 'ribbon-health', C.pink],
  [/surg|operat|theatre|suture|incision/i, 'hi-surgery', C.cyan],

  // ── last, because "medicine" appears inside many of the names above ──
  [/medicine|medical|clinical|internal/i, 'stethoscope', C.blue],
  [/nurs/i, 'nurse', C.teal],
  [/\bexams?\b|\bpapers?\b|revision|\bmocks?\b|\bmcqs?\b|past.?paper/i, 'book-2', C.slate],
];

function svgFor(asset) {
  return SVGS[`../assets/subject-icons/${asset}.svg`] || '';
}

/** { svg, colour } for a course or subject name; a neutral book when the name says nothing. */
export function getSubjectIcon(name) {
  const text = String(name || '').trim();
  if (text) {
    for (const [pattern, asset, colour] of RULES) {
      if (pattern.test(text)) return { svg: svgFor(asset), colour };
    }
  }
  return { svg: svgFor(FALLBACK.asset), colour: FALLBACK.colour };
}
