import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'adaptive_sheet.dart';

DateTime _at(TimeOfDay t) => DateTime(2024, 1, 1, t.hour, t.minute);

/// Hour, minute and AM/PM wheels in the app's own colours, replacing Flutter's
/// stock dial/keyboard clock. [onChanged] fires as the wheels settle.
class TimeWheel extends StatelessWidget {
  final TimeOfDay initial;
  final ValueChanged<TimeOfDay> onChanged;
  final double height;
  const TimeWheel({
    super.key,
    required this.initial,
    required this.onChanged,
    this.height = 132,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      height: height,
      child: CupertinoTheme(
        data: CupertinoThemeData(
          brightness: Theme.of(context).brightness,
          textTheme: CupertinoTextThemeData(
            dateTimePickerTextStyle: TextStyle(
                fontSize: 21, fontWeight: FontWeight.w600, color: c.inkStrong),
          ),
        ),
        child: CupertinoDatePicker(
          mode: CupertinoDatePickerMode.time,
          use24hFormat: false,
          initialDateTime: _at(initial),
          onDateTimeChanged: (d) =>
              onChanged(TimeOfDay(hour: d.hour, minute: d.minute)),
        ),
      ),
    );
  }
}

/// A sheet (a centred card on big screens) with the wheels and a Done button.
/// Returns the chosen time, or null if it was dismissed.
Future<TimeOfDay?> pickTimeWheel(BuildContext context,
    {required TimeOfDay initial, String title = 'Reminder time'}) {
  var chosen = initial;
  return showAdaptiveSheet<TimeOfDay>(
    context: context,
    useRootNavigator: true,
    backgroundColor: context.c.page,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) {
      final c = ctx.c;
      return SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const SizedBox(height: 8),
              TimeWheel(initial: initial, height: 170, onChanged: (t) => chosen = t),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(chosen),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      );
    },
  );
}
