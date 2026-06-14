import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';

enum _CardType { qa, definition, mechanism, features, management, mnemonic }

class _Flashcard {
  final _CardType type;
  final String question;
  final String answer;
  final String subject;

  const _Flashcard({
    required this.type,
    required this.question,
    required this.answer,
    required this.subject,
  });
}

const List<_Flashcard> _kDeck = <_Flashcard>[
  _Flashcard(
    type: _CardType.qa,
    question: 'What is the most common cause of acute pancreatitis?',
    answer:
        'Gallstones, followed by alcohol. Together they account for roughly '
        '80% of cases.',
    subject: 'Gastroenterology',
  ),
  _Flashcard(
    type: _CardType.definition,
    question: 'Define "anion gap" and give the normal range.',
    answer:
        'Anion gap = Na⁺ − (Cl⁻ + HCO₃⁻). Normal is 8–12 mmol/L. A raised gap '
        'suggests added unmeasured acids (e.g. lactate, ketones).',
    subject: 'Biochemistry',
  ),
  _Flashcard(
    type: _CardType.mechanism,
    question: 'How do ACE inhibitors lower blood pressure?',
    answer:
        'They block conversion of angiotensin I to angiotensin II, reducing '
        'vasoconstriction and aldosterone-driven sodium retention.',
    subject: 'Pharmacology',
  ),
  _Flashcard(
    type: _CardType.features,
    question: 'Name the classic clinical features of hypothyroidism.',
    answer:
        'Fatigue, cold intolerance, weight gain, constipation, dry skin, '
        'bradycardia and delayed relaxation of deep tendon reflexes.',
    subject: 'Endocrinology',
  ),
  _Flashcard(
    type: _CardType.management,
    question: 'Outline the immediate management of anaphylaxis.',
    answer:
        'IM adrenaline 0.5 mg (1:1000), high-flow oxygen, IV fluids, and lie '
        'the patient flat with legs raised. Repeat adrenaline at 5 min if no '
        'response.',
    subject: 'Emergency Medicine',
  ),
  _Flashcard(
    type: _CardType.mnemonic,
    question: 'Recall the causes of clubbing using "ABCDEF".',
    answer:
        'Abscess (lung) / Bronchiectasis, Cyanotic heart disease / Cystic '
        'fibrosis, Damaged (IBD), Endocarditis, Fibrosis (pulmonary).',
    subject: 'Respiratory',
  ),
];

class FlashcardsPage extends StatefulWidget {
  const FlashcardsPage({super.key});

  @override
  State<FlashcardsPage> createState() => _FlashcardsPageState();
}

class _FlashcardsPageState extends State<FlashcardsPage> {
  int _index = 0;
  bool _revealed = false;

  void _toggleReveal() {
    setState(() => _revealed = !_revealed);
  }

  void _advance() {
    setState(() {
      _index = (_index + 1) % _kDeck.length;
      _revealed = false;
    });
  }

  String _typeLabel(_CardType t) {
    switch (t) {
      case _CardType.qa:
        return 'Q&A';
      case _CardType.definition:
        return 'Definition';
      case _CardType.mechanism:
        return 'Mechanism';
      case _CardType.features:
        return 'Features';
      case _CardType.management:
        return 'Management';
      case _CardType.mnemonic:
        return 'Mnemonic';
    }
  }

  Color _typeColor(BuildContext context, _CardType t) {
    final c = context.c;
    switch (t) {
      case _CardType.qa:
        return c.primary;
      case _CardType.definition:
        return c.accent;
      case _CardType.mechanism:
        return c.warning;
      case _CardType.features:
        return c.success;
      case _CardType.management:
        return c.error;
      case _CardType.mnemonic:
        return c.primaryHover;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final card = _kDeck[_index];
    final typeColor = _typeColor(context, card.type);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: <Widget>[
          Text(
            'SPACED REPETITION',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: c.accent,
            ),
          ),
          const SizedBox(height: AppSpace.x1),
          Text(
            'Flashcards',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: AppSpace.x5),
          GlassCard(
            onTap: _toggleReveal,
            padding: const EdgeInsets.all(AppSpace.x5),
            child: SizedBox(
              height: 230,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      _TypeBadge(
                        label: _typeLabel(card.type),
                        color: typeColor,
                      ),
                      const SizedBox(width: AppSpace.x3),
                      Flexible(
                        child: Text(
                          card.subject,
                          textAlign: TextAlign.right,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: c.inkSoft,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpace.x4),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: AppDur.card,
                      switchInCurve: AppCurves.easeOut,
                      switchOutCurve: AppCurves.easeIn,
                      transitionBuilder:
                          (Widget child, Animation<double> anim) {
                        final slide = Tween<Offset>(
                          begin: const Offset(0, 0.04),
                          end: Offset.zero,
                        ).animate(anim);
                        return FadeTransition(
                          opacity: anim,
                          child: SlideTransition(
                            position: slide,
                            child: child,
                          ),
                        );
                      },
                      child: _CardFace(
                        key: ValueKey<bool>(_revealed),
                        revealed: _revealed,
                        text: _revealed ? card.answer : card.question,
                        accent: typeColor,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpace.x3),
          Center(
            child: Text(
              'Tap the card to reveal',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: c.inkMuted,
              ),
            ),
          ),
          const SizedBox(height: AppSpace.x5),
          Center(
            child: Text(
              'Card ${_index + 1} of ${_kDeck.length}',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: c.inkMedium,
              ),
            ),
          ),
          const SizedBox(height: AppSpace.x4),
          Row(
            children: <Widget>[
              Expanded(
                child: AppButton(
                  'Again',
                  kind: AppButtonKind.ghost,
                  expand: true,
                  onPressed: _advance,
                  leading: Icon(
                    Icons.refresh_rounded,
                    size: 18,
                    color: c.inkMedium,
                  ),
                ),
              ),
              const SizedBox(width: AppSpace.x3),
              Expanded(
                child: AppButton(
                  'Got it',
                  kind: AppButtonKind.primary,
                  expand: true,
                  onPressed: _advance,
                  leading: const Icon(
                    Icons.check_rounded,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpace.x3,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
          color: color,
        ),
      ),
    );
  }
}

class _CardFace extends StatelessWidget {
  const _CardFace({
    super.key,
    required this.revealed,
    required this.text,
    required this.accent,
  });

  final bool revealed;
  final String text;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        Text(
          revealed ? 'ANSWER' : 'QUESTION',
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            color: revealed ? accent : c.inkMuted,
          ),
        ),
        const SizedBox(height: AppSpace.x2),
        Flexible(
          child: Text(
            text,
            style: TextStyle(
              fontSize: revealed ? 16 : 19,
              height: 1.35,
              fontWeight: revealed ? FontWeight.w500 : FontWeight.w700,
              color: revealed ? c.inkMedium : c.inkStrong,
            ),
          ),
        ),
      ],
    );
  }
}
