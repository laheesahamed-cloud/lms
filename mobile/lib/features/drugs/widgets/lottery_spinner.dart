import 'package:flutter/material.dart';
import '../../../theme/tokens.dart';

class LotterySpinner extends StatefulWidget {
  final String drugName;
  final VoidCallback onDone;
  const LotterySpinner({super.key, required this.drugName, required this.onDone});

  @override
  State<LotterySpinner> createState() => _LotterySpinnerState();
}

class _LotterySpinnerState extends State<LotterySpinner> with SingleTickerProviderStateMixin {
  static const _dummies = [
    'Amoxicillin','Metformin','Atorvastatin','Lisinopril','Omeprazole',
    'Paracetamol','Ibuprofen','Amlodipine','Metoprolol','Salbutamol',
    'Ciprofloxacin','Diazepam','Warfarin','Furosemide','Prednisolone',
    'Metronidazole','Doxycycline','Ranitidine','Cetirizine','Aspirin',
  ];

  late final FixedExtentScrollController _ctrl;
  late final AnimationController _anim;
  late final CurvedAnimation _curved;
  late final List<String> _items;

  @override
  void initState() {
    super.initState();
    _items = [..._dummies, ..._dummies, widget.drugName];
    _ctrl = FixedExtentScrollController();
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 2500));
    _curved = CurvedAnimation(parent: _anim, curve: Curves.easeOutQuart);

    WidgetsBinding.instance.addPostFrameCallback((_) => _startSpin());
  }

  void _startSpin() {
    final target = (_items.length - 1).toDouble();
    _curved.addListener(() {
      final idx = (_curved.value * target).round().clamp(0, _items.length - 1);
      if (_ctrl.hasClients) _ctrl.jumpToItem(idx);
    });
    _anim.forward().then((_) {
      if (mounted) widget.onDone();
    });
  }

  @override
  void dispose() {
    _curved.dispose();
    _anim.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Container(
        width: 280,
        height: 60,
        decoration: BoxDecoration(
          color: c.surface1.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.primary, width: 1.5),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(13),
          child: ListWheelScrollView.useDelegate(
            controller: _ctrl,
            physics: const NeverScrollableScrollPhysics(),
            itemExtent: 60,
            perspective: 0.001,
            childDelegate: ListWheelChildListDelegate(
              children: _items.map((name) => Center(
                child: Text(
                  name,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: c.inkStrong,
                    letterSpacing: -0.2,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              )).toList(),
            ),
          ),
        ),
      ),
    );
  }
}
