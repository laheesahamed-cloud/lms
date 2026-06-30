import 'package:flutter/material.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/glass_card.dart';

const _maxPoints   = 6;
const _maxPointLen = 180;

// Mirror of web DrugCard splitPoints logic
List<String> _splitPoints(String text) {
  // 1. Try semicolon split (how import script joins items)
  List<String> parts = text.split(RegExp(r';\s*')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();

  // 2. Fall back to sentence boundaries
  if (parts.length == 1) {
    parts = text.split(RegExp(r'(?<=\.)\s+')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  }

  // 3. Strip leading section numbers like "1.1 SECTION HEADER "
  final sectionPrefix = RegExp(r'^\d+(\.\d+)?\s+[A-Z][A-Z\s,()/\-]+\s+');
  parts = parts.map((s) => s.replaceFirst(sectionPrefix, '').trim()).where((s) => s.isNotEmpty).toList();

  // 4. Limit count and length
  return parts
      .take(_maxPoints)
      .map((s) => s.length > _maxPointLen ? '${s.substring(0, _maxPointLen).trimRight()}…' : s)
      .toList();
}

String _stripTag(String text) =>
    text.replaceAll(RegExp(r'\s*\[EPC\]|\s*\[MoA\]|\s*\[PE\]|\s*\[CS\]'), '').trim();

const _sections = [
  _Section('drug_class',        'Drug Class',        Icons.category_outlined),
  _Section('sl_brand_names',    'SL Brand Names',    Icons.local_pharmacy_outlined),
  _Section('uses',              'Uses',               Icons.add_circle_outline_rounded),
  _Section('dosage_adult',      'Adult Dosage',      Icons.person_outline_rounded),
  _Section('dosage_pediatric',  'Pediatric Dosage',  Icons.child_care_outlined),
  _Section('side_effects',      'Side Effects',      Icons.warning_amber_rounded),
  _Section('warnings',          'Warnings',          Icons.error_outline_rounded),
  _Section('drug_interactions', 'Drug Interactions', Icons.compare_arrows_rounded),
  _Section('pregnancy_info',    'Pregnancy',         Icons.favorite_border_rounded),
];

class _Section {
  final String key;
  final String label;
  final IconData icon;
  const _Section(this.key, this.label, this.icon);
}

class DrugInfoCard extends StatelessWidget {
  final Map<String, dynamic> drug;
  const DrugInfoCard({super.key, required this.drug});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Row(
              children: [
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        c.accent.withValues(alpha: 0.22),
                        c.primary.withValues(alpha: 0.14),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.inner),
                  ),
                  child: Icon(Icons.medication_outlined, size: 24, color: c.primary),
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
                          drug['drug_class'] as String,
                          style: TextStyle(fontSize: 13, color: c.inkSoft),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Divider(height: 1, color: c.inkMuted.withValues(alpha: 0.12)),

          // Sections
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
            child: Column(
              children: [
                for (final sec in _sections)
                  if ((drug[sec.key] as String?)?.isNotEmpty == true)
                    _SectionRow(
                      icon: sec.icon,
                      label: sec.label,
                      body: sec.key == 'drug_class'
                          ? _stripTag(drug[sec.key] as String)
                          : drug[sec.key] as String,
                      c: c,
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String body;
  final AppColors c;
  const _SectionRow({required this.icon, required this.label, required this.body, required this.c});

  @override
  Widget build(BuildContext context) {
    final points = _splitPoints(body);

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 10, 8, 4),
            child: Row(
              children: [
                Icon(icon, size: 14, color: c.inkSoft),
                const SizedBox(width: 6),
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: c.inkSoft,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
            child: points.length == 1
                ? Text(points[0],
                    style: TextStyle(fontSize: 13, color: c.inkStrong, height: 1.5))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: points
                        .map((pt) => Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.only(top: 5, right: 6),
                                    child: Container(
                                      width: 5,
                                      height: 5,
                                      decoration: BoxDecoration(
                                        color: c.primary.withValues(alpha: 0.7),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(pt,
                                        style: TextStyle(
                                            fontSize: 13,
                                            color: c.inkStrong,
                                            height: 1.5)),
                                  ),
                                ],
                              ),
                            ))
                        .toList(),
                  ),
          ),
          Divider(height: 1, color: c.inkMuted.withValues(alpha: 0.08)),
        ],
      ),
    );
  }
}
