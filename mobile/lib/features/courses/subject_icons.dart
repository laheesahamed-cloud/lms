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
  /// Asset path of a Tabler SVG in assets/icons/medical/.
  final String asset;
  final Color colour;
  const SubjectIcon(this.asset, this.colour);
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

/// Ordered: the FIRST pattern that matches wins, so the specific ones come
/// before the general — "Obstetrics" must beat "medicine".
///
/// Short words carry \b on both sides. Without it the substrings bite: "ear"
/// is inside "research", "ent" ends "Management", "nose" is inside "diagnose",
/// "liver" is inside "delivery", and "vision" is inside "Revision" — which is
/// how "Paper 2 Revision" came out as an eyeball.
const List<(String, String, Color)> _rules = [
  // ── specialties whose names contain another subject's word ──
  (r'obstet|gyn[ae]ec|antenatal|obs\b', 'venus', _rose),
  (r'p[ae]ediatric|neonat|child health', 'baby-carriage', _amber),
  (r'forensic|medico.?legal', 'fingerprint', _gold),
  (r'community|public health|epidemiolog', 'users-group', _blue),
  (r'emergency|casualty|acute care|resus', 'ambulance', _rose),
  (r'an[ae]esthe', 'face-mask', _cyan),

  // ── organ systems ──
  (r'cardio|\bhearts?\b|coronar|arrhythm|myocard|vascular', 'heart', _rose),
  (r'respir|\blungs?\b|pulmo|asthma|\bcopd\b|\bchest\b', 'lungs', _blue),
  (r'neuro|\bbrain\b|\bstrokes?\b|seizure|epilep', 'brain', _violet),
  (r'psych|mental health|behaviou?r', 'mood-puzzled', _violet),
  (r'orthop|\bbones?\b|fracture|musculoskelet|rheumat|\bjoints?\b|arthrit', 'bone', _gold),
  (r'derma|\bskin\b', 'hand-finger', _rose),
  (r'ophthalm|\beyes?\b|\bvision\b|retina|optomet', 'eye', _blue),
  (r'\bent\b|otolaryng|\bears?\b|\bnose\b|\bthroat\b|audiolog', 'ear', _green),
  (r'dental|dentist|oral health|\btooth\b|\bteeth\b', 'dental', _blue),
  (r'h[ae]mat|\bblood\b|transfusion|an[ae]mia|leuk', 'droplet', _rose),
  (r'nephro|renal|kidney|urolog|bladder', 'droplets', _cyan),
  (r'gastro|hepat|\bliver\b|stomach|bowel|\bgit\b', 'flask', _amber),
  (r'endocrin|diabet|thyroid|hormone', 'atom', _green),

  // ── basic and lab sciences ──
  (r'anatom|dissect|histolog|embryo', 'body-scan', _violet),
  (r'physiolog', 'activity-heartbeat', _green),
  (r'bio ?chem', 'flask', _cyan),
  (r'pharmac|drug|therapeut|prescrib', 'prescription', _green),
  (r'patholog|histopath|autopsy', 'microscope', _violet),
  (r'micro ?bio|bacteri|viro|parasit|infect|mycolog', 'virus', _amber),
  (r'immun|vaccin|allerg', 'shield-check', _cyan),
  (r'genetic|genom|\bdna\b|hered', 'dna', _green),
  (r'nutrit|\bdiets?\b|dietet', 'apple', _green),
  (r'statistic|research|biostat|\baudit\b|\bdata\b', 'chart-bar', _gold),
  (r'radiolog|imaging|x.?ray|ultrasound|\bscans?\b|\bct\b|\bmri\b', 'radioactive', _cyan),
  (r'oncolog|cancer|tumou?r|malignan', 'ribbon-health', _violet),
  (r'surg|operat|theatre|suture|incision', 'needle-thread', _cyan),

  // ── last, because "medicine" appears inside many of the names above ──
  (r'medicine|medical|clinical|internal', 'stethoscope', _blue),
  (r'nurs', 'nurse', _green),
  (r'\bexams?\b|\bpapers?\b|revision|\bmocks?\b|\bmcqs?\b|past.?paper', 'book-2', _blue),
];

final List<(RegExp, String, Color)> _compiled = _rules
    .map((r) => (RegExp(r.$1, caseSensitive: false), r.$2, r.$3))
    .toList(growable: false);

/// Nothing in the name to go on. Deliberately generic rather than a guess.
const SubjectIcon _fallback = SubjectIcon('assets/icons/medical/book-2.svg', _blue);

SubjectIcon subjectIcon(String name) {
  final n = name.trim();
  if (n.isEmpty) return _fallback;
  for (final (pattern, asset, colour) in _compiled) {
    if (pattern.hasMatch(n)) {
      return SubjectIcon('assets/icons/medical/$asset.svg', colour);
    }
  }
  return _fallback;
}
