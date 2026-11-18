import 'package:flutter/material.dart';

import '../data/countries.dart';
import '../theme/tokens.dart';

/// A country chosen from a list (sign-up and onboarding, 2026-11-17).
/// Looks like the text field around it ([decoration]); a tap opens a
/// searchable list in a bottom sheet.
class CountryField extends FormField<String> {
  CountryField({
    super.key,
    String? initialValue,
    required ValueChanged<String> onChanged,
    InputDecoration decoration = const InputDecoration(),
    TextStyle? style,
    String hint = 'Country of your university',
  }) : super(
          initialValue: initialValue,
          validator: (v) => (v == null || v.isEmpty) ? 'Choose your university\'s country' : null,
          builder: (state) {
            final context = state.context;
            final c = context.c;
            final value = state.value ?? '';
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () async {
                FocusManager.instance.primaryFocus?.unfocus();
                final picked = await showModalBottomSheet<String>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: c.card,
                  shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                  ),
                  builder: (_) => _CountrySheet(selected: value),
                );
                if (picked != null) {
                  state.didChange(picked);
                  onChanged(picked);
                }
              },
              child: InputDecorator(
                decoration: decoration.copyWith(
                  errorText: state.errorText,
                  suffixIcon: Icon(Icons.expand_more_rounded, color: c.inkSoft),
                ),
                isEmpty: value.isEmpty,
                child: Text(
                  value.isEmpty ? hint : value,
                  style: (style ?? TextStyle(fontSize: 15.5, color: c.inkStrong))
                      .copyWith(color: value.isEmpty ? c.inkMuted : null),
                ),
              ),
            );
          },
        );
}

class _CountrySheet extends StatefulWidget {
  final String selected;
  const _CountrySheet({required this.selected});
  @override
  State<_CountrySheet> createState() => _CountrySheetState();
}

class _CountrySheetState extends State<_CountrySheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final q = _q.trim().toLowerCase();
    final list = q.isEmpty ? kCountries : kCountries.where((x) => x.toLowerCase().contains(q)).toList();
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.75,
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(width: 36, height: 4, decoration: BoxDecoration(color: c.line, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: TextField(
                autofocus: false,
                onChanged: (v) => setState(() => _q = v),
                style: TextStyle(fontSize: 15, color: c.inkStrong),
                decoration: InputDecoration(
                  hintText: 'Search countries',
                  prefixIcon: Icon(Icons.search_rounded, color: c.inkSoft),
                  isDense: true,
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: list.length,
                itemBuilder: (_, i) {
                  final name = list[i];
                  final on = name == widget.selected;
                  return ListTile(
                    dense: true,
                    title: Text(name,
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                            color: c.inkStrong)),
                    trailing: on ? Icon(Icons.check_rounded, color: c.primary) : null,
                    onTap: () => Navigator.of(context).pop(name),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
