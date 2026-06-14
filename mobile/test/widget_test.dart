import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xyndrome/theme/app_theme.dart';
import 'package:xyndrome/widgets/app_button.dart';

void main() {
  testWidgets('AppButton renders its label', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        home: Scaffold(
          body: AppButton('Get started', onPressed: () {}),
        ),
      ),
    );
    expect(find.text('Get started'), findsOneWidget);
  });
}
