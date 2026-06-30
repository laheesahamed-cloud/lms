import 'package:flutter/material.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/glass_card.dart';

// ── Tone colours matching web dc-card--* variants ───────────────────────────
const _blue   = Color(0xFF3B82F6);
const _slate  = Color(0xFF64748B);
const _sky    = Color(0xFF0EA5E9);
const _green  = Color(0xFF10B981);
const _amber  = Color(0xFFD97706);
const _red    = Color(0xFFDC2626);
const _orange = Color(0xFFEA580C);
const _purple = Color(0xFF7C3AED);

class _Section {
  final String   key;
  final String   label;
  final IconData icon;
  final Color    tone;
  final bool     warn; // tinted border + background
  const _Section(this.key, this.label, this.icon, this.tone, {this.warn = false});
}

const _sections = [
  _Section('drug_class',        'Drug Class',        Icons.category_outlined,          _blue),
  _Section('sl_brand_names',    'SL Brand Names',    Icons.local_pharmacy_outlined,    _slate),
  _Section('uses',              'Uses',              Icons.add_circle_outline_rounded, _sky),
  _Section('dosage_adult',      'Adult Dosage',      Icons.person_outline_rounded,     _green),
  _Section('dosage_pediatric',  'Pediatric Dosage',  Icons.child_care_outlined,        _green),
  _Section('side_effects',      'Side Effects',      Icons.warning_amber_rounded,      _amber,  warn: true),
  _Section('warnings',          'Warnings',          Icons.error_outline_rounded,      _red,    warn: true),
  _Section('drug_interactions', 'Drug Interactions', Icons.compare_arrows_rounded,     _orange, warn: true),
  _Section('pregnancy_info',    'Pregnancy',         Icons.favorite_border_rounded,    _purple, warn: true),
];

// ── Text parsing (mirrors web splitPoints) ───────────────────────────────────
const _maxPoints   = 6;
const _maxPointLen = 180;

List<String> _splitPoints(String text) {
  List<String> parts = text
      .split(RegExp(r';\s*'))
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();

  if (parts.length == 1) {
    parts = text
        .split(RegExp(r'(?<=\.)\s+'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  final sectionPrefix = RegExp(r'^\d+(\.\d+)?\s+[A-Z][A-Z\s,()/\-]+\s+');
  parts = parts
      .map((s) => s.replaceFirst(sectionPrefix, '').trim())
      .where((s) => s.isNotEmpty)
      .toList();

  return parts
      .take(_maxPoints)
      .map((s) => s.length > _maxPointLen
          ? '${s.substring(0, _maxPointLen).trimRight()}…'
          : s)
      .toList();
}

String _stripTag(String text) =>
    text.replaceAll(RegExp(r'\s*\[EPC\]|\s*\[MoA\]|\s*\[PE\]|\s*\[CS\]'), '').trim();

// ── Main widget ──────────────────────────────────────────────────────────────

class DrugInfoCard extends StatelessWidget {
  final Map<String, dynamic> drug;
  const DrugInfoCard({super.key, required this.drug});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Drug name header card
        GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: _blue.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.medication_outlined, size: 22, color: _blue),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (drug['name'] as String?) ?? '',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: c.inkStrong,
                        letterSpacing: -0.3,
                      ),
                    ),
                    if ((drug['drug_class'] as String?)?.isNotEmpty == true)
                      Text(
                        _stripTag(drug['drug_class'] as String),
                        style: TextStyle(fontSize: 13, color: c.inkSoft),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 10),

        // One card per section
        for (final sec in _sections)
          if ((drug[sec.key] as String?)?.isNotEmpty == true) ...[
            _SectionCard(
              sec: sec,
              body: sec.key == 'drug_class'
                  ? _stripTag(drug[sec.key] as String)
                  : drug[sec.key] as String,
              c: c,
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

// ── Single section card ──────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final _Section sec;
  final String   body;
  final AppColors c;
  const _SectionCard({required this.sec, required this.body, required this.c});

  @override
  Widget build(BuildContext context) {
    final points = _splitPoints(body);
    final tone   = sec.tone;

    return Container(
      decoration: BoxDecoration(
        color: sec.warn
            ? tone.withValues(alpha: 0.04)
            : c.surface1,
        border: Border.all(
          color: sec.warn
              ? tone.withValues(alpha: 0.20)
              : c.inkMuted.withValues(alpha: 0.12),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: sec.warn
                      ? tone.withValues(alpha: 0.15)
                      : c.inkMuted.withValues(alpha: 0.08),
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(sec.icon, size: 15, color: tone),
                const SizedBox(width: 7),
                Text(
                  sec.label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.07 * 11,
                    color: tone,
                  ),
                ),
              ],
            ),
          ),

          // Body
          Padding(
            padding: points.length == 1
                ? const EdgeInsets.symmetric(horizontal: 14, vertical: 10)
                : const EdgeInsets.fromLTRB(14, 8, 14, 12),
            child: points.length == 1
                ? Text(
                    points[0],
                    style: TextStyle(
                        fontSize: 14, color: c.inkStrong, height: 1.6),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: points
                        .map((pt) => Padding(
                              padding: const EdgeInsets.only(bottom: 5),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6, right: 8),
                                    child: Container(
                                      width: 5, height: 5,
                                      decoration: BoxDecoration(
                                        color: tone.withValues(alpha: 0.7),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(pt,
                                        style: TextStyle(
                                            fontSize: 14,
                                            color: c.inkStrong,
                                            height: 1.55)),
                                  ),
                                ],
                              ),
                            ))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}
