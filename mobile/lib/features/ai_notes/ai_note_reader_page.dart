import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

class AiNoteReaderPage extends StatelessWidget {
  final String noteId;
  const AiNoteReaderPage({super.key, required this.noteId});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: Icon(Icons.arrow_back_ios_new_rounded,
                    size: 18, color: c.inkMedium),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => context.push('/app/canvas'),
                icon: Icon(Icons.draw_outlined, size: 20, color: c.inkMedium),
              ),
              IconButton(
                onPressed: () {},
                icon: Icon(Icons.bookmark_border_rounded,
                    size: 20, color: c.inkMedium),
              ),
            ],
          ),
          Text('CARDIOLOGY · AI NOTES',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: c.accent)),
          const SizedBox(height: 6),
          Text('Heart failure — pathophysiology',
              style: TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.5,
                  height: 1.15)),
          const SizedBox(height: 8),
          Text('12 min read · generated lesson',
              style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
          const SizedBox(height: 18),
          _Para(c,
              'Heart failure (HF) is a clinical syndrome where the heart cannot pump enough blood to meet metabolic demand, or can only do so at elevated filling pressures.'),
          _Heading(c, 'Two broad types'),
          _Para(c,
              'HFrEF (reduced ejection fraction, ≤40%) reflects impaired contractility. HFpEF (preserved EF, ≥50%) reflects impaired relaxation/filling with stiff ventricles.'),
          _Callout(c, Icons.lightbulb_outline_rounded,
              'Frank–Starling: up to a point, more preload → more stroke volume. In failure, the curve flattens and shifts down.'),
          _Heading(c, 'Compensatory mechanisms'),
          _Para(c,
              'Sympathetic activation and RAAS raise heart rate, contractility and volume. Helpful acutely, harmful chronically — driving remodeling, fibrosis and worsening function.'),
          _Callout(c, Icons.priority_high_rounded,
              'Key exam point: ACE inhibitors and beta-blockers improve survival in HFrEF by blunting this maladaptive neurohormonal response.'),
          _Heading(c, 'Clinical features'),
          _Para(c,
              'Left HF → pulmonary congestion (dyspnoea, orthopnoea, PND, crackles). Right HF → systemic congestion (raised JVP, peripheral oedema, hepatomegaly).'),
        ],
      ),
    );
  }
}

class _Para extends StatelessWidget {
  final AppColors c;
  final String text;
  const _Para(this.c, this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Text(text,
            style: TextStyle(fontSize: 15, height: 1.62, color: c.inkMedium)),
      );
}

class _Heading extends StatelessWidget {
  final AppColors c;
  final String text;
  const _Heading(this.c, this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 10),
        child: Text(text,
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: c.inkStrong)),
      );
}

class _Callout extends StatelessWidget {
  final AppColors c;
  final IconData icon;
  final String text;
  const _Callout(this.c, this.icon, this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: GlassCard(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 19, color: c.accent),
              const SizedBox(width: 11),
              Expanded(
                child: Text(text,
                    style: TextStyle(
                        fontSize: 13.5,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                        color: c.inkStrong)),
              ),
            ],
          ),
        ),
      );
}
