/// Breaks a long single-paragraph explanation into 2–3 shorter paragraphs for
/// reading on a phone (user, 2026-11-18). Only line breaks are added — the
/// words are never changed. Text that already has line breaks, or is short,
/// is left as it is.
///
/// By words: under 30 → 1 paragraph; 30–79 → 2; 80+ → 3 (when there are
/// enough sentences). Each break goes at the sentence end nearest the even
/// split point, so the paragraphs come out about the same size.
String readableParagraphs(String text) {
  final t = text.trim();
  if (t.contains('\n')) return t;
  final words = t.split(RegExp(r'\s+')).length;
  if (words < 30) return t;

  // Sentence ends: ". " / "? " / "! " before a capital or a digit; skips
  // common abbreviations ("e.g.", "i.e.", "vs.", "etc.", "Dr.", "St.").
  final re = RegExp(r'(?<!\be\.g)(?<!\bi\.e)(?<!\bvs)(?<!\betc)(?<!\bDr)(?<!\bSt)[.?!](?=\s+[A-Z0-9])');
  final sentences = <String>[];
  var start = 0;
  for (final m in re.allMatches(t)) {
    sentences.add(t.substring(start, m.end).trim());
    start = m.end;
  }
  if (start < t.length) sentences.add(t.substring(start).trim());
  sentences.removeWhere((s) => s.isEmpty);
  if (sentences.length < 2) return t;

  final parts = words >= 80 && sentences.length >= 3 ? 3 : 2;
  // Word count at the end of each sentence (running total).
  final ends = <int>[];
  var total = 0;
  for (final s in sentences) {
    total += s.split(RegExp(r'\s+')).length;
    ends.add(total);
  }
  // For each wanted split point (1/2, or 1/3 and 2/3), take the nearest
  // sentence end that keeps the order and leaves no empty paragraph.
  final cuts = <int>[];
  for (var k = 1; k < parts; k++) {
    final target = total * k / parts;
    var best = -1;
    var bestDist = double.infinity;
    for (var i = 0; i < sentences.length - 1; i++) {
      if (cuts.isNotEmpty && i <= cuts.last) continue;
      final d = (ends[i] - target).abs().toDouble();
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0) cuts.add(best);
  }
  if (cuts.isEmpty) return t;
  final out = <String>[];
  var from = 0;
  for (final c in [...cuts, sentences.length - 1]) {
    out.add(sentences.sublist(from, c + 1).join(' '));
    from = c + 1;
  }
  return out.where((p) => p.isNotEmpty).join('\n\n');
}
