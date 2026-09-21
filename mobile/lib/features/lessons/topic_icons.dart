/// Topic-family icon matching for lesson cards — a Dart port of the web
/// app's `guessTopicFamily`/`TopicFamilyIconSvg` (NoteCanvas.jsx). Web-only
/// features (icons, dividers, WYSIWYG editing, tables) never reached the
/// Flutter app before; this is the first one ported over so mobile shows
/// the same topic icon as web instead of nothing.
///
/// Icons are the same Lucide (lucide.dev, ISC license) paths used on web,
/// so the visual identity matches across platforms — not a re-drawing.
library;

class _FamilyPattern {
  final String key;
  final RegExp test;
  const _FamilyPattern(this.key, this.test);
}

// Same order/patterns as TOPIC_FAMILY_PATTERNS in NoteCanvas.jsx — kept in
// sync by hand since it's a small, stable list on both sides.
final List<_FamilyPattern> _familyPatterns = [
  // 'definition' goes FIRST: a combined heading like "Definition &
  // Pathophysiology" contains both words, and without this it matched
  // 'pathophysiology' below instead — showing the wrong icon.
  _FamilyPattern('definition', RegExp(r'definition|\bdefined\b')),
  _FamilyPattern('differential', RegExp(r'differential|\bddx\b')),
  _FamilyPattern('red-flags', RegExp(r'red flag')),
  _FamilyPattern('mechanism-of-action', RegExp(r'mechanism of action|\bmoa\b')),
  _FamilyPattern('risk-stratification', RegExp(r'risk (stratification|score|assessment)')),
  _FamilyPattern('adverse-effects', RegExp(r'adverse (effect|reaction|event)|side[- ]?effect')),
  _FamilyPattern('contraindications', RegExp(r'contraindicat')),
  _FamilyPattern('dosing', RegExp(r'\bdos(e|ing|age)\b')),
  _FamilyPattern('follow-up', RegExp(r'follow[- ]?up|monitoring')),
  _FamilyPattern('management', RegExp(r'manage|treat|therap')),
  _FamilyPattern('investigations', RegExp(r'investigat|work[- ]?up')),
  _FamilyPattern('pathophysiology', RegExp(r'pathophysiolog|pathogenes|mechanism')),
  _FamilyPattern('clinical-features', RegExp(r'clinical feature|symptom|\bsigns?\b|presentation')),
  _FamilyPattern('complications', RegExp(r'complication')),
  _FamilyPattern('aetiology', RegExp(r'aetiolog|etiolog|\bcauses?\b|risk factor')),
  _FamilyPattern('classification', RegExp(r'classification|staging|\bgrades?\b')),
  _FamilyPattern('diagnosis', RegExp(r'diagnos')),
  _FamilyPattern('epidemiology', RegExp(r'epidemiolog|incidence|prevalence')),
  _FamilyPattern('prevention', RegExp(r'prevention|prophylax|screening')),
  _FamilyPattern('prognosis', RegExp(r'prognos|outcome')),
];

final RegExp _leadingNumber = RegExp(r'^\s*\d+(?:\.\d+)*[.)]?\s*');

/// Returns the matched topic-family key for a card heading (e.g.
/// "3. Investigations" -> "investigations"), or null if nothing matches.
String? guessTopicFamily(String heading) {
  final h = heading.replaceFirst(_leadingNumber, '').trim().toLowerCase();
  if (h.isEmpty) return null;
  for (final f in _familyPatterns) {
    if (f.test.hasMatch(h)) return f.key;
  }
  return null;
}

String _svg(String innerPaths) => '''
<svg viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  $innerPaths
</svg>
''';

/// Family key -> full SVG markup (stroke hardcoded to black; tint at render
/// time via ColorFilter, same approach as the web version's `currentColor`).
final Map<String, String> kTopicIconSvgs = {
  'definition': _svg(
    '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  ),
  'epidemiology': _svg(
    '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  ),
  'aetiology': _svg(
    '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  ),
  'risk-stratification': _svg(
    '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  ),
  'classification': _svg(
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  ),
  'pathophysiology': _svg(
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  ),
  'mechanism-of-action': _svg(
    '<path d="m2 21 9.6-9.6"/><path d="m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19"/><circle cx="15.5" cy="7.5" r="5.5"/>',
  ),
  'clinical-features': _svg(
    '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  ),
  'red-flags': _svg(
    '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  ),
  'differential': _svg(
    '<path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>',
  ),
  'investigations': _svg(
    '<path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/>',
  ),
  'diagnosis': _svg(
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  ),
  'management': _svg(
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
  ),
  'dosing': _svg(
    '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  ),
  'adverse-effects': _svg(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
  'contraindications': _svg(
    '<circle cx="12" cy="12" r="10"/><path d="M4.929 4.929 19.07 19.071"/>',
  ),
  'complications': _svg(
    '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>',
  ),
  'follow-up': _svg(
    '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  ),
  'prognosis': _svg(
    '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  ),
  'prevention': _svg(
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  ),
};
