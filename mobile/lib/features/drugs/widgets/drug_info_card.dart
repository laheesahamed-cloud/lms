import 'package:flutter/material.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/glass_card.dart';

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
                      body: drug[sec.key] as String,
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
            child: Text(
              body,
              style: TextStyle(fontSize: 13, color: c.inkStrong, height: 1.5),
            ),
          ),
          Divider(height: 1, color: c.inkMuted.withValues(alpha: 0.08)),
        ],
      ),
    );
  }
}
