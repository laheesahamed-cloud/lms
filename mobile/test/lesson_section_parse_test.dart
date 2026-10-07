import 'package:flutter_test/flutter_test.dart';
import 'package:xyndrome/features/lessons/lesson_models.dart';

void main() {
  test('branch section parses root and branches', () {
    final s = LessonSection.fromJson({
      'type': 'branch',
      'heading': 'Classification of Shock',
      'root': 'Shock',
      'branches': [
        {'label': 'Hypovolaemic', 'detail': 'Blood or fluid loss'},
        {'label': 'Cardiogenic', 'detail': '==Pump failure== of the heart'},
      ],
    });
    expect(s.isBranch, isTrue);
    expect(s.branchRoot, 'Shock');
    expect(s.branches.length, 2);
    expect(s.branches[1].label, 'Cardiogenic');
    expect(s.branches[1].detail, contains('Pump failure'));
  });

  test('embedded flow and table are picked up off a TEXT section', () {
    final s = LessonSection.fromJson({
      'type': 'text',
      'heading': 'Management',
      'bullets': ['Fluids first'],
      'embedded_label': 'Adrenaline',
      'embedded_flow': ['Binds α1 receptors', 'Vasoconstriction', 'BP rises'],
      'embedded_table': {
        'headers': ['Drug', 'Dose'],
        'rows': [['Adrenaline', '1 mg'], ['Atropine', '0.5 mg']],
      },
    });
    expect(s.hasEmbeddedFlow, isTrue);
    expect(s.embeddedFlow.length, 3);
    expect(s.hasEmbeddedTable, isTrue);
    expect(s.embeddedTableHeaders, ['Drug', 'Dose']);
    expect(s.embeddedTableRows[1][1], '0.5 mg');
    expect(s.embeddedLabel, 'Adrenaline');
  });

  test('a section with none of it stays empty rather than throwing', () {
    final s = LessonSection.fromJson({'type': 'text', 'heading': 'Intro'});
    expect(s.isBranch, isFalse);
    expect(s.branches, isEmpty);
    expect(s.hasEmbeddedFlow, isFalse);
    expect(s.hasEmbeddedTable, isFalse);
  });

  test('plainInline strips markers so a header never prints them', () {
    expect(plainInline('==Severe== vs **mild**'), 'Severe vs mild');
    expect(plainInline('no markup here'), 'no markup here');
  });
}
