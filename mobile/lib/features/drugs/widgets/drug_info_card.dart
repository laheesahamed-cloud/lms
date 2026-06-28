import 'package:flutter/material.dart';
import '../../../theme/tokens.dart';

const _sections = [
  {'key': 'drug_class',        'label': 'Drug Class',        'icon': '⬡'},
  {'key': 'sl_brand_names',    'label': 'SL Brands',         'icon': '🏷'},
  {'key': 'dosage_adult',      'label': 'Adult Dosage',      'icon': '💊'},
  {'key': 'dosage_pediatric',  'label': 'Pediatric Dosage',  'icon': '🧒'},
  {'key': 'uses',              'label': 'Uses',               'icon': '✚'},
  {'key': 'side_effects',      'label': 'Side Effects',       'icon': '⚠'},
  {'key': 'warnings',          'label': 'Warnings',           'icon': '🔴'},
  {'key': 'drug_interactions', 'label': 'Drug Interactions',  'icon': '↔'},
  {'key': 'pregnancy_info',    'label': 'Pregnancy',          'icon': '♥'},
];

final _sectionColors = {
  'warnings':          const Color(0xFFFEE2E2),
  'side_effects':      const Color(0xFFFEF3C7),
  'pregnancy_info':    const Color(0xFFF3E8FF),
  'drug_interactions': const Color(0xFFFFF7ED),
};

class DrugInfoCard extends StatelessWidget {
  final Map<String, dynamic> drug;
  const DrugInfoCard({super.key, required this.drug});

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return Container(
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.inkMuted.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              children: [
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    color: c.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: const Text('💊', style: TextStyle(fontSize: 22)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (drug['name'] as String?) ?? '',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700,
                            color: c.inkStrong, letterSpacing: -0.3),
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
          Divider(height: 1, color: c.inkMuted.withValues(alpha: 0.1)),

          // sections
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
            child: Column(
              children: [
                for (final sec in _sections)
                  if ((drug[sec['key']] as String?)?.isNotEmpty == true)
                    _SectionTile(
                      icon: sec['icon']!,
                      label: sec['label']!,
                      body: drug[sec['key']] as String,
                      bgColor: _sectionColors[sec['key']],
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTile extends StatelessWidget {
  final String icon;
  final String label;
  final String body;
  final Color? bgColor;
  const _SectionTile({required this.icon, required this.label, required this.body, this.bgColor});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: bgColor != null
          ? BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
            child: Row(
              children: [
                Text(icon, style: const TextStyle(fontSize: 14)),
                const SizedBox(width: 6),
                Text(
                  label.toUpperCase(),
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                      letterSpacing: 0.06, color: c.inkSoft),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
            child: Text(body,
                style: TextStyle(fontSize: 13, color: c.inkStrong, height: 1.5)),
          ),
        ],
      ),
    );
  }
}
