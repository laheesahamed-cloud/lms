import 'package:flutter/material.dart';

/// Which icon and colour a course or subject gets, worked out from its name.
///
/// Before this, the courses page picked both from the card's POSITION in the
/// list — `globalIndex % _icons.length` — so Cardiology got a water drop if it
/// happened to land on the fourth slot, and the same course changed icon when
/// another was added above it.
///
/// Matching on the name instead needs no database column, no admin picker and
/// no deploy: medical subjects are named predictably, which is exactly the case
/// where matching beats storing a choice. A course whose name says nothing
/// ("Paper 2 Revision") falls through to a neutral default rather than being
/// given something misleading.
class SubjectIcon {
  /// Rendered width in points. Healthicons draw their shape across a 48 box
  /// where Tabler leaves padding inside a 24 one, so at one number the
  /// Healthicons read noticeably larger — they get their own, smaller.
  /// Asset path of an SVG in assets/icons/medical/.
  ///
  /// Mostly Tabler. The three named `hi-` are Healthicons, because Tabler has
  /// no scalpel, no uterus and no baby — the stand-ins were a suture needle, a
  /// venus symbol and a pram. Healthicons draws in filled shapes rather than
  /// strokes, so those three sit slightly heavier than the rest.
  final String asset;
  final Color colour;
  final double size;
  const SubjectIcon(this.asset, this.colour, this.size);
}

// The palette is the dashboard's section accents, so a subject is tinted the
// same way everywhere.
const _rose = Color(0xFFFB7185);
const _blue = Color(0xFF60A5FA);
const _violet = Color(0xFF8B5CF6);
const _green = Color(0xFF34D399);
const _cyan = Color(0xFF38BDF8);
const _amber = Color(0xFFFBBF24);
const _gold = Color(0xFFF4B740);
// Added so a page of subjects does not come out in seven repeating colours.
const _pink = Color(0xFFF472B6);
const _indigo = Color(0xFF818CF8);
const _teal = Color(0xFF2DD4BF);
const _orange = Color(0xFFFB923C);
const _lime = Color(0xFFA3E635);
const _sky = Color(0xFF7DD3FC);
const _plum = Color(0xFFC084FC);
const _slate = Color(0xFF94A3B8);

/// Ordered: the FIRST pattern that matches wins, so the specific ones come
/// before the general — "Obstetrics" must beat "medicine".
///
/// Short words carry \b on both sides. Without it the substrings bite: "ear"
/// is inside "research", "ent" ends "Management", "nose" is inside "diagnose",
/// "liver" is inside "delivery", and "vision" is inside "Revision" — which is
/// how "Paper 2 Revision" came out as an eyeball.
const List<(String, String, Color)> _rules = [
  // ── specialties whose names contain another subject's word ──
  (r'obstet|gyn[ae]ec|antenatal|obs\b', 'hi-female-reproductive', _pink),
  (r'p[ae]+diatric|neonat|child health', 'hi-baby', _amber),
  (r'forensic|medico.?legal', 'fingerprint', _slate),
  (r'community|public health|epidemiolog', 'users-group', _teal),
  (r'emergency|casualty|acute care|resus', 'ambulance', _rose),
  (r'an[ae]esthe', 'face-mask', _indigo),

  // ── organ systems ──
  (r'cardio|\bhearts?\b|coronar|arrhythm|myocard|vascular', 'heart', _rose),
  (r'respir|\blungs?\b|pulmo|asthma|\bcopd\b|\bchest\b', 'lungs', _blue),
  (r'neuro|\bbrain\b|\bstrokes?\b|seizure|epilep', 'brain', _violet),
  (r'psych|\bpsy\b|mental health|behaviou?r', 'mood-puzzled', _plum),
  (r'orthop|\bbones?\b|fracture|musculoskelet|rheumat|\bjoints?\b|arthrit', 'bone', _gold),
  (r'derma|\bskin\b', 'hand-finger', _orange),
  (r'ophthalm|\beyes?\b|\bvision\b|retina|optomet', 'eye', _blue),
  (r'\bent\b|otolaryng|\bears?\b|\bnose\b|\bthroat\b|audiolog', 'ear', _teal),
  (r'dental|dentist|oral health|\btooth\b|\bteeth\b', 'dental', _sky),
  (r'h[ae]mat|\bblood\b|transfusion|an[ae]mia|leuk', 'droplet', _rose),
  (r'nephro|renal|kidney|urolog|bladder', 'droplets', _sky),
  (r'gastro|hepat|\bliver\b|stomach|bowel|\bgit\b', 'flask', _orange),
  (r'endocrin|diabet|thyroid|hormone', 'atom', _lime),

  // ── basic and lab sciences ──
  (r'anatom|dissect|histolog|embryo', 'body-scan', _indigo),
  (r'physiolog', 'activity-heartbeat', _green),
  (r'bio ?chem', 'flask', _teal),
  (r'pharmac|drug|therapeut|prescrib', 'prescription', _green),
  (r'patholog|histopath|autopsy', 'microscope', _plum),
  (r'micro ?bio|bacteri|viro|parasit|infect|mycolog', 'virus', _lime),
  (r'immun|vaccin|allerg', 'shield-check', _sky),
  (r'genetic|genom|\bdna\b|hered', 'dna', _green),
  (r'nutrit|\bdiets?\b|dietet', 'apple', _green),
  (r'toxicolog|poison|overdose|venom', 'test-pipe', _lime),
  (r'statistic|research|biostat|\baudit\b|\bdata\b', 'chart-bar', _gold),
  (r'radiolog|imaging|x.?ray|ultrasound|\bscans?\b|\bct\b|\bmri\b', 'radioactive', _cyan),
  (r'oncolog|cancer|tumou?r|malignan', 'ribbon-health', _pink),
  (r'surg|operat|theatre|suture|incision', 'hi-surgery', _cyan),

  // ── last, because "medicine" appears inside many of the names above ──
  (r'medicine|medical|clinical|internal', 'stethoscope', _blue),
  (r'nurs', 'nurse', _teal),
  (r'\bexams?\b|\bpapers?\b|revision|\bmocks?\b|\bmcqs?\b|past.?paper', 'book-2', _slate),
];

final List<(RegExp, String, Color)> _compiled = _rules
    .map((r) => (RegExp(r.$1, caseSensitive: false), r.$2, r.$3))
    .toList(growable: false);

/// Nothing in the name to go on. Deliberately generic rather than a guess.
/// The glyph inside the 48 chip, in the proportion the rest of the app uses:
/// the Study hub puts a 22 glyph in a 40 chip, which is 0.55, and 0.55 of 48
/// is 26. Healthicons draw across a fuller box, so theirs comes down to match
/// optically rather than numerically.
const double _kTablerSize = 26;
const double _kHealthiconSize = 24;

const SubjectIcon _fallback =
    SubjectIcon('assets/icons/medical/book-2.svg', _slate, _kTablerSize);

SubjectIcon subjectIcon(String name) {
  final n = name.trim();
  if (n.isEmpty) return _fallback;
  for (final (pattern, asset, colour) in _compiled) {
    if (pattern.hasMatch(n)) {
      return SubjectIcon(
        'assets/icons/medical/$asset.svg',
        colour,
        asset.startsWith('hi-') ? _kHealthiconSize : _kTablerSize,
      );
    }
  }
  return _fallback;
}
