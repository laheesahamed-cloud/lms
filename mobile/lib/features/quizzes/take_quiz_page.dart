import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../widgets/quiz_loading_view.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../services/tts_service.dart';
import '../../theme/tokens.dart';
import '../../widgets/content_image.dart';
import '../../widgets/locked_view.dart';
import '../dashboard/dashboard_repository.dart';
import 'quizzes_repository.dart';
import 'quiz_dialogs.dart';
import 'submit_transition_overlay.dart';

TextStyle _stemTextStyle(AppColors c) => TextStyle(
    fontSize: 17, height: 1.45, fontWeight: FontWeight.w600, color: c.inkStrong);

// A pastel straight off the palette reads fine as an underline on a light
// background, but is too washed-out/low-contrast against a dark one (and a
// naive darken goes the wrong way in dark mode). Same fix as the lesson
// canvas's _readableAccent: pull it darker for light mode, push it lighter
// for dark mode, so the same palette stays legible in both.
Color _readableAccent(Color color, bool dark) {
  final hsl = HSLColor.fromColor(color);
  final lightness = dark
      ? (hsl.lightness + 0.16).clamp(0.0, 0.92)
      : (hsl.lightness * 0.62).clamp(0.0, 0.58);
  return hsl.withLightness(lightness).toColor();
}

/// Builds spans for [text] with each phrase in [highlights] underlined in a
/// single consistent [highlightColor] — text colour and weight untouched,
/// same as the rest of the question — rather than filled with a background
/// or recoloured. Case-insensitive, exact-substring matching, mirroring the
/// web's highlightText.js. Longer phrases are matched first so overlapping
/// AI suggestions don't produce doubled-up marks. [style] should match the
/// surrounding text's TextStyle.
List<InlineSpan> buildHighlightedSpans(
  String text,
  List<String> highlights, {
  required Color highlightColor,
  required TextStyle style,
}) {
  final phrases = highlights.map((p) => p.trim()).where((p) => p.isNotEmpty).toList()
    ..sort((a, b) => b.length.compareTo(a.length));
  if (text.isEmpty || phrases.isEmpty) return [TextSpan(text: text)];

  final ranges = <List<int>>[]; // [start, end)
  final lower = text.toLowerCase();
  for (final phrase in phrases) {
    final lowerPhrase = phrase.toLowerCase();
    var fromIndex = 0;
    while (fromIndex <= lower.length) {
      final matchIndex = lower.indexOf(lowerPhrase, fromIndex);
      if (matchIndex == -1) break;
      final end = matchIndex + phrase.length;
      final overlaps = ranges.any((r) => matchIndex < r[1] && end > r[0]);
      if (!overlaps) ranges.add([matchIndex, end]);
      fromIndex = matchIndex + phrase.length;
    }
  }
  if (ranges.isEmpty) return [TextSpan(text: text)];
  ranges.sort((a, b) => a[0].compareTo(b[0]));

  final spans = <InlineSpan>[];
  var cursor = 0;
  for (final range in ranges) {
    if (range[0] > cursor) spans.add(TextSpan(text: text.substring(cursor, range[0]), style: style));
    // Deliberately no text-colour or weight change here — the highlighted
    // phrase stays the exact same font/colour as the rest of the question,
    // marked only by a plain underline in one consistent colour (not a
    // cycling pastel per phrase, unlike the approach block's quoted spans).
    spans.add(TextSpan(
      text: text.substring(range[0], range[1]),
      style: style.copyWith(
        decoration: TextDecoration.underline,
        decorationColor: highlightColor,
        decorationThickness: 1.6,
      ),
    ));
    cursor = range[1];
  }
  if (cursor < text.length) spans.add(TextSpan(text: text.substring(cursor), style: style));
  return spans;
}

/// Splits an AI-generated "1. ...\n2. ...\n3. ..." approach text into its
/// individual numbered steps. Falls back to the whole text as one step if it
/// isn't actually numbered.
List<String> _splitApproachSteps(String text) {
  final markers = RegExp(r'(?:^|\n)\s*\d+[.)]\s*').allMatches(text).toList();
  if (markers.isEmpty) {
    final trimmed = text.trim();
    return trimmed.isEmpty ? [] : [trimmed];
  }
  final steps = <String>[];
  for (var i = 0; i < markers.length; i++) {
    final start = markers[i].end;
    final end = i + 1 < markers.length ? markers[i + 1].start : text.length;
    final step = text.substring(start, end).trim();
    if (step.isNotEmpty) steps.add(step);
  }
  return steps;
}

/// Approach steps often quote the exact stem phrase they're referencing.
/// The AI isn't told a specific format for that, so it picks its own
/// emphasis style — most commonly **"phrase"** (bold + double-quoted), but
/// sometimes just "phrase", 'phrase', or **phrase** with no quotes at all.
/// Matching only bare 'single quotes' (the original, narrower pattern) left
/// every **"..."** reference showing its raw asterisks and quote marks on
/// screen — and worse, let that single-quote pattern accidentally match
/// between two unrelated stray apostrophes later in the same step (e.g. a
/// possessive like "patient's"), grabbing everything in between, previous
/// word included, as a bogus highlighted span. Matching the actual formats
/// the model uses, in order of how it typically wraps a reference, fixes
/// both: the markup gets stripped instead of shown, and a real quote/bold
/// pair is required before anything gets highlighted at all.
List<InlineSpan> _buildApproachStepSpans(String text, TextStyle base, Color accent) {
  // The bold-wrapped branch accepts EITHER quote character on EITHER side
  // (not a matched pair) — the model sometimes mixes them, e.g. **'phrase"**
  // — which is safe here only because both ends are still anchored to `**`,
  // making an accidental match against ordinary prose essentially
  // impossible. Unbolded double quotes are unguarded too, since a stray
  // double quote pair essentially never happens by accident in ordinary
  // prose. Unbolded SINGLE quotes are the risky case — a bare pair with no
  // `**` anchor is indistinguishable from two unrelated possessive/
  // contraction apostrophes later in the same step (e.g. "patient's ...
  // doctor's"), which previously matched everything in between, previous
  // word included, as one bogus highlighted span. A real quote mark isn't
  // wedged directly between two letters the way a possessive/contraction
  // apostrophe is, so requiring no letter/digit immediately outside each
  // quote mark keeps genuine 'quoted phrases' working (this question's most
  // common style) while still rejecting "patient's"/"doctor's".
  final re = RegExp(
    r'\*\*["\x27](.+?)["\x27]\*\*' // **"phrase"**, **'phrase'**, or mismatched **'phrase"**
    r'|\*\*([^*]+)\*\*' // **phrase**  (no quotes)
    r'|"(.+?)"' // "phrase"  (double-quote, not bolded)
    r"|(?<![A-Za-z0-9])'(.+?)'(?![A-Za-z0-9])", // 'phrase'  (single-quote, not bolded, guarded)
  );
  final spans = <InlineSpan>[];
  var cursor = 0;
  for (final m in re.allMatches(text)) {
    final phrase = m.group(1) ?? m.group(2) ?? m.group(3) ?? m.group(4);
    if (phrase == null || phrase.trim().isEmpty) continue;
    if (m.start > cursor) spans.add(TextSpan(text: text.substring(cursor, m.start), style: base));
    spans.add(TextSpan(
      text: phrase,
      style: base.copyWith(
        fontWeight: FontWeight.w800,
        color: accent,
        decoration: TextDecoration.underline,
        decorationColor: accent,
        decorationThickness: 1.4,
      ),
    ));
    cursor = m.end;
  }
  if (cursor < text.length) spans.add(TextSpan(text: text.substring(cursor), style: base));
  return spans;
}

/// Renders the question-approach text as a numbered flow: each step gets a
/// pastel-badged number, connected to the next by a down-arrow — the same
/// arrow-chain look as the lesson canvas's cause→effect flow sections, so the
/// walkthrough reads as an actual step-by-step "approach mode" rather than
/// one flat, messy paragraph.
class _ApproachFlow extends StatelessWidget {
  final String text;
  const _ApproachFlow({required this.text});

  static const _pastels = <Color>[
    Color(0xFFF6D98A), Color(0xFFA9CBEE), Color(0xFFB3DDB0), Color(0xFFEFB6CD),
    Color(0xFFCDBCE8), Color(0xFFA9DCE0), Color(0xFFF2B39E), Color(0xFFF3CDA0),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final stepStyle = TextStyle(fontSize: 15.5, height: 1.5, color: c.inkMedium);
    final steps = _splitApproachSteps(text);
    if (steps.length < 2) {
      final single = steps.isEmpty ? text : steps.first;
      return Text.rich(TextSpan(children: _buildApproachStepSpans(single, stepStyle, c.primary)));
    }

    final children = <Widget>[];
    for (var i = 0; i < steps.length; i++) {
      final accent = _pastels[i % _pastels.length];
      final badgeInk = _readableAccent(accent, dark);
      children.add(Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: accent.withValues(alpha: 0.55), shape: BoxShape.circle),
            child: Text('${i + 1}',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: badgeInk)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(children: _buildApproachStepSpans(steps[i], stepStyle, badgeInk)),
            ),
          ),
        ],
      ));
      if (i < steps.length - 1) {
        children.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Center(
            child: Icon(Icons.arrow_downward_rounded, size: 18, color: c.primary.withValues(alpha: 0.75)),
          ),
        ));
      }
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: children);
  }
}

class _SpeakerButton extends StatefulWidget {
  final String text;
  const _SpeakerButton({required this.text});

  @override
  State<_SpeakerButton> createState() => _SpeakerButtonState();
}

class _SpeakerButtonState extends State<_SpeakerButton> {
  bool _speaking = false;

  @override
  void dispose() {
    if (_speaking) TtsService.stop();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_speaking) {
      await TtsService.stop();
      if (mounted) setState(() => _speaking = false);
      return;
    }
    setState(() => _speaking = true);
    await TtsService.speak(widget.text);
    if (mounted) setState(() => _speaking = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!TtsService.supported) return const SizedBox.shrink();
    final c = context.c;
    return IconButton(
      onPressed: _toggle,
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      padding: EdgeInsets.zero,
      icon: Icon(
        _speaking ? Icons.stop_circle_rounded : Icons.volume_up_rounded,
        size: 20,
        color: c.primary,
      ),
      tooltip: _speaking ? 'Stop reading' : 'Read aloud',
    );
  }
}

/// Take a quiz. Practice mode: pick an answer, reveal the correct option with
/// the full explanation. Exam mode: a real timed exam session whose answers are
/// submitted to the backend and graded server-side.
class TakeQuizPage extends ConsumerStatefulWidget {
  final String quizId;
  final bool examMode;
  final String? questionId; // when set, show only this single question
  const TakeQuizPage({super.key, required this.quizId, this.examMode = false, this.questionId});

  @override
  ConsumerState<TakeQuizPage> createState() => _TakeQuizPageState();
}

class _TakeQuizPageState extends ConsumerState<TakeQuizPage> {
  int _index = 0;
  final Map<int, int> _selected = {}; // SBA: questionId -> optionId
  // True/False: questionId -> { optionId -> markedTrue }
  final Map<int, Map<int, bool>> _tf = {};
  final Set<int> _revealed = {}; // questionId (practice reveal)

  // Shuffled questions — initialised once on first data load, never again.
  List<PracticeQuestion>? _shuffled;
  final _rng = Random();
  static const _optLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  List<PracticeQuestion> _shuffleOnce(List<PracticeQuestion> questions) {
    if (_shuffled != null) return _shuffled!;
    _shuffled = questions.map((q) {
      final opts = [...q.options]..shuffle(_rng);
      final relabeled = opts.asMap().entries.map((e) {
        final o = e.value;
        return QOption(
          id: o.id,
          label: e.key < _optLabels.length ? _optLabels[e.key] : '${e.key + 1}',
          text: o.text,
          isCorrect: o.isCorrect,
          whyIncorrect: o.whyIncorrect,
        );
      }).toList();
      return PracticeQuestion(
        id: q.id,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        explanationImageUrl: q.explanationImageUrl,
        questionApproach: q.questionApproach,
        questionApproachHighlights: q.questionApproachHighlights,
        options: relabeled,
        correctOptionIds: q.correctOptionIds, // IDs never change
        recap: q.recap,
      );
    }).toList();
    // Single-question mode: filter down to the bookmarked question only.
    if (widget.questionId != null) {
      _shuffled = _shuffled!.where((q) => q.id.toString() == widget.questionId).toList();
    }
    return _shuffled!;
  }
  bool _started = false; // gated behind the start-confirm popup
  bool _startPrompting = false;
  bool _submitting = false; // exam submit / practice finish in-flight
  // Drives the two-screen "Badge verify" submit transition (see
  // SubmitTransitionOverlay). Snappier than the web: 700ms + 800ms holds.
  SubmitPhase _submitPhase = SubmitPhase.idle;
  static const int _submitMinMs = 700; // min "submitting" hold (or network)
  static const int _completeHoldMs = 800; // "complete" hold before leaving
  int _secondsLeft = 0;
  Timer? _timer;

  bool get _exam => widget.examMode;

  /// A question counts as answered when SBA has a pick, or every T/F statement
  /// has been marked true or false.
  bool _isAnswered(PracticeQuestion q) {
    if (q.type == 'true_false') {
      final marks = _tf[q.id];
      return marks != null && marks.length == q.options.length;
    }
    return _selected.containsKey(q.id);
  }

  int _answeredCount(List<PracticeQuestion> questions) =>
      questions.where(_isAnswered).length;

  void _setTf(int questionId, int optionId, bool isTrue) {
    HapticFeedback.selectionClick();
    setState(() => (_tf[questionId] ??= {})[optionId] = isTrue);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer(int seconds) {
    if (seconds <= 0) return;
    _secondsLeft = seconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) {
        t.cancel();
        _autoSubmitOnTimeout();
      }
    });
  }

  void _autoSubmitOnTimeout() {
    if (_submitting) return;
    final load = ref.read(examQuizProvider(widget.quizId)).asData?.value;
    if (load != null) _submitExam(load.questions);
  }

  /// Show the start-confirm popup once the quiz meta is known.
  Future<void> _promptStart({
    required int totalQuestions,
    required int timeLimitMinutes,
    required int timerSeconds,
  }) async {
    _startPrompting = true;
    final ok = await showQuizStartDialog(
      context,
      exam: _exam,
      totalQuestions: totalQuestions,
      timeLimitMinutes: timeLimitMinutes,
    );
    if (!mounted) return;
    if (ok != true) {
      context.pop();
      return;
    }
    setState(() => _started = true);
    if (_exam) _startTimer(timerSeconds);
  }

  Future<void> _confirmAndFinishPractice() async {
    final questions =
        ref.read(practiceQuizProvider(widget.quizId)).asData?.value.questions ??
            const <PracticeQuestion>[];
    final answered = _answeredCount(questions);
    final ok = await showQuizFinishDialog(context, exam: false, answered: answered);
    if (ok != true) return;
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _submitPhase = SubmitPhase.submitting;
    });
    // Only a fully-answered practice counts toward the daily streak (isolated
    // event, does not affect scores). Await it (within the submit animation
    // window) so the event is persisted before we pop — the quiz-list/dashboard
    // refetch on return then sees this quiz as done and stops recommending it.
    final id = int.tryParse(widget.quizId);
    if (id != null && questions.isNotEmpty && answered >= questions.length) {
      try {
        await recordPracticeCompletion(ref, id);
      } catch (_) {}
    }
    // Practice records study activity but does NOT create a graded attempt, so
    // the backend never flips isCompleted. Mark it done in the already-cached
    // quiz list so the dashboard "Continue where you left off" CTA advances to
    // the next quiz at once; invalidating the dashboard rebuilds the card.
    final cached = ref.read(quizListProvider).asData?.value;
    if (cached != null) {
      for (final q in cached) {
        if (q.id == widget.quizId) {
          q.isCompleted = true;
          break;
        }
      }
    }
    ref.invalidate(studentDashboardProvider);
    // Practice has nothing to wait on, so just hold the "submitting" phase for
    // the minimum, pop the badge, hold, then leave — same beats as the exam.
    await Future.delayed(const Duration(milliseconds: _submitMinMs));
    if (!mounted) return;
    setState(() => _submitPhase = SubmitPhase.complete);
    await Future.delayed(const Duration(milliseconds: _completeHoldMs));
    if (mounted) context.pop();
  }

  Future<void> _confirmAndSubmitExam(List<PracticeQuestion> questions) async {
    final ok = await showQuizFinishDialog(
      context,
      exam: true,
      answered: _answeredCount(questions),
      total: questions.length,
    );
    if (ok == true) _submitExam(questions);
  }

  Future<void> _submitExam(List<PracticeQuestion> questions) async {
    if (_submitting) return;
    _timer?.cancel();
    setState(() {
      _submitting = true;
      _submitPhase = SubmitPhase.submitting;
    });
    final answers = <String, dynamic>{};
    for (final q in questions) {
      if (q.type == 'true_false') {
        final marks = _tf[q.id];
        if (marks != null && marks.isNotEmpty) {
          // Backend expects { optionId: 1|0 } where 1 = marked True.
          answers['${q.id}'] = {
            for (final e in marks.entries) '${e.key}': e.value ? 1 : 0,
          };
        }
      } else {
        final sel = _selected[q.id];
        if (sel != null) answers['${q.id}'] = sel;
      }
    }
    try {
      // The submit runs underneath the "submitting" spinner; the spinner shows
      // for exactly as long as the real server submit takes (no padded hold).
      // Then pop the badge, hold briefly, and leave for the result.
      final attemptId = await submitExam(ref, widget.quizId, answers);
      if (!mounted) return;
      // Refresh the list (completed tick), the results history, and the
      // dashboard so the "Continue where you left off" CTA advances at once.
      ref.invalidate(quizListProvider);
      ref.invalidate(resultsListProvider);
      ref.invalidate(studentDashboardProvider);
      setState(() => _submitPhase = SubmitPhase.complete);
      await Future.delayed(const Duration(milliseconds: _completeHoldMs));
      if (!mounted) return;
      context.pushReplacement('/app/exam-complete/$attemptId');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitPhase = SubmitPhase.idle;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not submit exam. ${_short(e)}')),
      );
    }
  }

  String _short(Object e) {
    final s = e.toString();
    return s.length > 120 ? '${s.substring(0, 120)}…' : s;
  }

  String _fmt(int s) {
    final m = (s ~/ 60).toString().padLeft(2, '0');
    final ss = (s % 60).toString().padLeft(2, '0');
    return '$m:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final child = _exam ? _buildExam(context) : _buildPractice(context);
    // While an attempt is actually in progress, intercept back (button + swipe)
    // and confirm before leaving so a stray gesture can't discard the attempt.
    // Once submitting/leaving (or before the start prompt) let it pop freely.
    final blockBack = _started && !_submitting;
    return PopScope(
      canPop: !blockBack,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await showQuizLeaveDialog(context, exam: _exam) ?? false;
        if (leave && context.mounted) Navigator.of(context).pop();
      },
      child: child,
    );
  }

  // --- Practice mode ------------------------------------------------------

  Widget _buildPractice(BuildContext context) {
    final c = context.c;
    final quizAsync = ref.watch(practiceQuizProvider(widget.quizId));
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: quizAsync.when(
          loading: () => const QuizLoadingView(),
          error: (e, _) => _errorView(c, e),
          data: (quiz) {
            if (quiz.questions.isEmpty) return _empty(c);
            final questions = _shuffleOnce(quiz.questions);
            if (!_started && !_startPrompting) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && !_started && !_startPrompting) {
                  _promptStart(
                    totalQuestions: questions.length,
                    timeLimitMinutes: 0,
                    timerSeconds: 0,
                  );
                }
              });
            }
            if (!_started) return const QuizLoadingView();
            final i = _index.clamp(0, questions.length - 1);
            final q = questions[i];
            final revealed = _revealed.contains(q.id);
            return Stack(
              children: [
                Column(
                  children: [
                    _topBar(c, quiz.title, i, questions, showTimer: false),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        child: _QuestionView(
                          key: ValueKey(q.id),
                          question: q,
                          selectedOptionId: _selected[q.id],
                          tfMarks: _tf[q.id],
                          revealed: revealed,
                          selectable: !revealed,
                          showRevealButton: !revealed,
                          onSelect: (optId) {
                            HapticFeedback.selectionClick();
                            setState(() => _selected[q.id] = optId);
                          },
                          onTfSelect: (optId, isTrue) => _setTf(q.id, optId, isTrue),
                          onReveal: () => setState(() => _revealed.add(q.id)),
                        ),
                      ),
                    ),
                    _bottomBar(c, questions.length, isExam: false),
                  ],
                ),
                SubmitTransitionOverlay(
                  phase: _submitPhase,
                  submittingLabel: 'Your practice is submitting…',
                  completeLabel: 'All done — great work!',
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // --- Exam mode ----------------------------------------------------------

  Widget _buildExam(BuildContext context) {
    final c = context.c;
    final examAsync = ref.watch(examQuizProvider(widget.quizId));
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: examAsync.when(
          loading: () => const QuizLoadingView(),
          error: (e, _) => _errorView(c, e),
          data: (load) {
            // Already submitted on the server → jump straight to the result.
            if (load.session.submittedAttemptId != null) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  context.pushReplacement(
                      '/app/exam-complete/${load.session.submittedAttemptId}');
                }
              });
              return const Center(child: CircularProgressIndicator());
            }
            if (load.questions.isEmpty) return _empty(c);
            final questions = _shuffleOnce(load.questions);
            if (!_started && !_startPrompting) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && !_started && !_startPrompting) {
                  _promptStart(
                    totalQuestions: questions.length,
                    timeLimitMinutes: load.timeLimit,
                    timerSeconds: load.session.secondsRemaining ??
                        load.timeLimit * 60,
                  );
                }
              });
            }
            if (!_started) return const QuizLoadingView();
            final i = _index.clamp(0, questions.length - 1);
            final q = questions[i];
            return Stack(
              children: [
                Column(
                  children: [
                    _topBar(c, load.title, i, questions,
                        showTimer: load.timeLimit > 0),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        child: _QuestionView(
                          key: ValueKey(q.id),
                          question: q,
                          selectedOptionId: _selected[q.id],
                          tfMarks: _tf[q.id],
                          revealed: false, // never reveal during a live exam
                          selectable: !_submitting,
                          showRevealButton: false,
                          onSelect: (optId) {
                            HapticFeedback.selectionClick();
                            setState(() => _selected[q.id] = optId);
                          },
                          onTfSelect: (optId, isTrue) => _setTf(q.id, optId, isTrue),
                          onReveal: () {},
                        ),
                      ),
                    ),
                    _bottomBar(c, questions.length, isExam: true),
                  ],
                ),
                SubmitTransitionOverlay(
                  phase: _submitPhase,
                  submittingLabel: 'Your quiz is submitting…',
                  completeLabel: 'Submission complete!',
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _errorView(AppColors c, Object e) {
    // Subscription gating surfaces as a 400 ("… is included with selected
    // plans" / "subscription does not include …") — show a lock, not an error.
    final msg = e.toString().toLowerCase();
    final locked = msg.contains('included with') ||
        msg.contains('does not include') ||
        msg.contains('not include') ||
        msg.contains('upgrade');
    if (locked) {
      return LockedView(
        title: _exam ? 'Exam mode locked' : 'Practice mode locked',
        reason: _exam
            ? 'Exam mode is included with selected plans.'
            : 'Practice mode is included with selected plans.',
      );
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Could not load this quiz.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft)),
            const SizedBox(height: 16),
            TextButton(
                onPressed: () => context.pop(), child: const Text('Back')),
          ],
        ),
      ),
    );
  }

  Widget _empty(AppColors c) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.quiz_outlined, size: 40, color: c.inkMuted),
              const SizedBox(height: 12),
              Text('This quiz has no questions yet.',
                  style: TextStyle(color: c.inkSoft)),
              const SizedBox(height: 16),
              TextButton(onPressed: () => context.pop(), child: const Text('Back')),
            ],
          ),
        ),
      );

  Widget _topBar(AppColors c, String title, int i,
      List<PracticeQuestion> questions,
      {required bool showTimer}) {
    final total = questions.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 6, 16, 8),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                // Route through maybePop so the PopScope leave-confirm runs.
                onPressed: () => Navigator.of(context).maybePop(),
                icon: Icon(Icons.arrow_back_ios_new_rounded,
                    size: 18, color: c.inkMedium),
              ),
              Expanded(
                child: Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
              ),
              if (showTimer && !_submitting) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: (_secondsLeft <= 30 && _secondsLeft > 0
                            ? const Color(0xFFDC2626)
                            : c.primary)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.timer_outlined,
                          size: 13,
                          color: _secondsLeft <= 30 && _secondsLeft > 0
                              ? const Color(0xFFDC2626)
                              : c.primary),
                      const SizedBox(width: 4),
                      Text(_fmt(_secondsLeft < 0 ? 0 : _secondsLeft),
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: _secondsLeft <= 30 && _secondsLeft > 0
                                  ? const Color(0xFFDC2626)
                                  : c.primary)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
              ],
              InkWell(
                onTap: () => _openQuestionNav(questions),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${i + 1} / $total',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: c.inkSoft)),
                      const SizedBox(width: 4),
                      Icon(Icons.grid_view_rounded, size: 15, color: c.inkSoft),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: (i + 1) / total,
              minHeight: 5,
              backgroundColor: c.surface2,
              valueColor: AlwaysStoppedAnimation<Color>(c.primary),
            ),
          ),
        ],
      ),
    );
  }

  // Tap the "X / N" counter to jump to any question (answered = green).
  void _openQuestionNav(List<PracticeQuestion> questions) {
    final c = context.c;
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Questions',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const Spacer(),
                Text('${_answeredCount(questions)} / ${questions.length} answered',
                    style: TextStyle(fontSize: 13, color: c.inkSoft)),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (var idx = 0; idx < questions.length; idx++)
                  _navCell(c, idx, questions[idx]),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _legend(c, c.success, 'Answered'),
                const SizedBox(width: 18),
                _legend(c, c.inkMuted, 'Not yet'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _navCell(AppColors c, int idx, PracticeQuestion q) {
    final isCurrent = idx == _index;
    final answered = _isAnswered(q);
    final bg = isCurrent
        ? c.primary
        : (answered ? c.success.withValues(alpha: 0.16) : c.surface2);
    final fg = isCurrent
        ? Colors.white
        : (answered ? c.success : c.inkMedium);
    return GestureDetector(
      onTap: () {
        setState(() => _index = idx);
        Navigator.pop(context);
      },
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: isCurrent
                  ? c.primary
                  : (answered ? c.success.withValues(alpha: 0.5) : c.line)),
        ),
        child: Text('${idx + 1}',
            style: TextStyle(
                fontSize: 14.5, fontWeight: FontWeight.w800, color: fg)),
      ),
    );
  }

  Widget _legend(AppColors c, Color color, String label) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: color.withValues(alpha: 0.6)),
            ),
          ),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12, color: c.inkSoft)),
        ],
      );

  Widget _bottomBar(AppColors c, int total, {required bool isExam}) {
    final atStart = _index <= 0;
    final atEnd = _index >= total - 1;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: atStart ? null : () => setState(() => _index--),
              child: const Text('Previous'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              onPressed: _submitting
                  ? null
                  : () {
                      if (!atEnd) {
                        setState(() => _index++);
                      } else if (isExam) {
                        final load =
                            ref.read(examQuizProvider(widget.quizId)).asData?.value;
                        if (load != null) _confirmAndSubmitExam(load.questions);
                      } else {
                        _confirmAndFinishPractice();
                      }
                    },
              child: Text(atEnd ? (isExam ? 'Submit' : 'Finish') : 'Next'),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestionView extends StatelessWidget {
  final PracticeQuestion question;
  final int? selectedOptionId;
  final Map<int, bool>? tfMarks; // T/F: optionId -> markedTrue
  final bool revealed;
  final bool selectable;
  final bool showRevealButton;
  final ValueChanged<int> onSelect;
  final void Function(int optionId, bool isTrue) onTfSelect;
  final VoidCallback onReveal;
  const _QuestionView({
    super.key,
    required this.question,
    required this.selectedOptionId,
    required this.tfMarks,
    required this.revealed,
    required this.selectable,
    required this.showRevealButton,
    required this.onSelect,
    required this.onTfSelect,
    required this.onReveal,
  });

  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFDC2626);

  bool get _isTrueFalse => question.type == 'true_false';

  /// T/F: true when every statement has been marked and all match the key.
  bool get _tfAllCorrect {
    if (tfMarks == null || tfMarks!.length != question.options.length) {
      return false;
    }
    for (final o in question.options) {
      final shouldBeTrue = question.correctOptionIds.contains(o.id);
      if (tfMarks![o.id] != shouldBeTrue) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isCorrectPick = _isTrueFalse
        ? _tfAllCorrect
        : (selectedOptionId != null &&
            question.correctOptionIds.contains(selectedOptionId));
    final answered =
        _isTrueFalse ? (tfMarks?.isNotEmpty ?? false) : selectedOptionId != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: c.cardElevated,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: c.line),
          ),
          child: revealed && question.questionApproachHighlights.isNotEmpty
              ? RichText(
                  text: TextSpan(
                    style: _stemTextStyle(c),
                    children: buildHighlightedSpans(
                      question.text,
                      question.questionApproachHighlights,
                      highlightColor: c.primary,
                      style: _stemTextStyle(c),
                    ),
                  ),
                )
              : Text(question.text, style: _stemTextStyle(c)),
        ),
        const SizedBox(height: 14),
        if (_isTrueFalse) ...[
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 10),
            child: Text('Mark each statement True or False',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: c.inkSoft)),
          ),
          for (final o in question.options) ...[
            _TfStatementTile(
              option: o,
              marked: tfMarks?[o.id],
              revealed: revealed,
              correctIsTrue: question.correctOptionIds.contains(o.id),
              onMark: selectable ? (v) => onTfSelect(o.id, v) : null,
            ),
            const SizedBox(height: 9),
          ],
        ] else
          for (final o in question.options) ...[
            _OptionTile(
              option: o,
              selected: selectedOptionId == o.id,
              revealed: revealed,
              isCorrect: question.correctOptionIds.contains(o.id),
              onTap: selectable ? () => onSelect(o.id) : null,
            ),
            const SizedBox(height: 9),
          ],
        const SizedBox(height: 4),
        if (showRevealButton)
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onReveal,
              icon: const Icon(Icons.visibility_outlined, size: 18),
              label: const Text('Show answer'),
            ),
          ),
        if (revealed) ...[
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 2, bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: (!answered
                      ? c.primary
                      : (isCorrectPick ? _green : _red))
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  !answered
                      ? Icons.lightbulb_outline_rounded
                      : (isCorrectPick
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded),
                  size: 20,
                  color: !answered
                      ? c.primary
                      : (isCorrectPick ? _green : _red),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    !answered
                        ? 'Answer revealed'
                        : (isCorrectPick ? 'Correct!' : 'Not quite'),
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: !answered
                            ? c.primary
                            : (isCorrectPick ? _green : _red)),
                  ),
                ),
              ],
            ),
          ),
          if (question.explanationImageUrl.isNotEmpty ||
              question.explanation.isNotEmpty)
            _RevealBlock(
              icon: Icons.notes_rounded,
              title: 'Explanation',
              accent: c.primary,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (question.explanationImageUrl.isNotEmpty) ...[
                    ContentImage(question.explanationImageUrl),
                    if (question.explanation.isNotEmpty)
                      const SizedBox(height: 10),
                  ],
                  if (question.explanation.isNotEmpty)
                    Text(question.explanation,
                        style: TextStyle(
                            fontSize: 15.5, height: 1.5, color: c.inkMedium)),
                ],
              ),
            ),
          if (question.questionApproach.isNotEmpty)
            _RevealBlock(
              icon: Icons.route_outlined,
              title: 'How to approach this question',
              accent: c.primary,
              trailing: _SpeakerButton(text: question.questionApproach),
              child: _ApproachFlow(text: question.questionApproach),
            ),
          _whyWrong(c),
          if (question.recap != null) _recapTrigger(context, c, question.recap!),
        ],
      ],
    );
  }

  Widget _whyWrong(AppColors c) {
    // "Why other options are wrong" is an SBA concept; T/F shows per-statement.
    if (_isTrueFalse) return const SizedBox.shrink();
    final wrong = question.options
        .where((o) =>
            !question.correctOptionIds.contains(o.id) &&
            o.whyIncorrect.trim().isNotEmpty)
        .toList();
    if (wrong.isEmpty) return const SizedBox.shrink();
    return _RevealBlock(
      icon: Icons.rule_rounded,
      title: 'Why the other options are wrong',
      accent: _red,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final o in wrong)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: RichText(
                text: TextSpan(
                  style: TextStyle(
                      fontSize: 14, height: 1.45, color: c.inkMedium),
                  children: [
                    TextSpan(
                        text: '${o.label}. ',
                        style:
                            const TextStyle(fontWeight: FontWeight.w800, color: _red)),
                    TextSpan(text: o.whyIncorrect),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _recap(AppColors c, TheoryRecap r) {
    final inner = <Widget>[];
    void add(String label, List<String> items, {Color? tone}) {
      if (items.isNotEmpty) inner.add(_recapGroup(c, label, items, tone: tone));
    }

    // Every section card gets its own theme-token tone. Key points is NOT in
    // here: it renders inline under the recap button (see _recapTrigger).
    add('Aetiology', r.etiology, tone: c.warning);
    add('Pathophysiology', r.pathophysiology, tone: c.error);
    add('Clinical features', r.clinicalFeatures, tone: c.accent);
    add('Investigations', r.investigations, tone: c.primary);
    add('Treatment', r.treatment, tone: c.success);
    if (r.mnemonic.trim().isNotEmpty) {
      inner.add(Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFF59E0B).withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
          border:
              Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.35)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.psychology_rounded, size: 16),
            Expanded(
              child: Text(r.mnemonic,
                  style: TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                      color: c.inkStrong)),
            ),
          ],
        ),
      ));
    }
    return inner;
  }

  // The "Quick theory recap" trigger (like the web): a blue-tinted button that
  // opens the full recap (Aetiology, Pathophysiology, … each colour-coded) in a
  // bottom sheet. Key points are not in that sheet — they render inline right
  // below the button so the key takeaways stay visible without opening it.
  Widget _recapTrigger(BuildContext context, AppColors c, TheoryRecap r) {
    final groups = _recap(c, r);
    final hasKeyPoints = r.keyPoints.isNotEmpty;
    if (groups.isEmpty && !hasKeyPoints) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (groups.isNotEmpty)
            InkWell(
              onTap: () => _openRecap(context, c, r),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                decoration: BoxDecoration(
                  color: c.primaryTint,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.primary.withValues(alpha: 0.25)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.bolt_rounded, size: 20, color: c.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Quick theory recap',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: c.inkStrong)),
                          if (r.conceptName.isNotEmpty) ...[
                            const SizedBox(height: 1),
                            Text(r.conceptName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: c.inkSoft)),
                          ],
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded,
                        size: 20, color: c.inkMuted),
                  ],
                ),
              ),
            ),
          if (hasKeyPoints) ...[
            if (groups.isNotEmpty) const SizedBox(height: 10),
            _recapGroup(c, 'Key points', r.keyPoints, tone: c.primary),
          ],
        ],
      ),
    );
  }

  void _openRecap(BuildContext context, AppColors c, TheoryRecap r) {
    final groups = _recap(c, r);
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        builder: (ctx, scroll) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 8, 8),
              child: Row(
                children: [
                  Icon(Icons.bolt_rounded, size: 20, color: c.primary),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Quick theory recap',
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: c.inkStrong)),
                        if (r.conceptName.isNotEmpty)
                          Text(r.conceptName,
                              style:
                                  TextStyle(fontSize: 12.5, color: c.inkSoft)),
                      ],
                    ),
                  ),
                  IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: Icon(Icons.close_rounded, color: c.inkMedium)),
                ],
              ),
            ),
            Divider(height: 1, color: c.line),
            Expanded(
              child: ListView(
                controller: scroll,
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
                children: [
                  for (var k = 0; k < groups.length; k++) ...[
                    if (k > 0) const SizedBox(height: 14),
                    groups[k],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _recapGroup(AppColors c, String label, List<String> items,
      {Color? tone}) {
    final toned = tone != null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
      decoration: BoxDecoration(
        color: toned ? tone.withValues(alpha: 0.08) : c.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: toned ? tone.withValues(alpha: 0.30) : c.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: toned ? tone : c.inkSoft)),
          const SizedBox(height: 7),
          for (final it in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 7, right: 9),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                          color: toned ? tone : c.inkMuted,
                          shape: BoxShape.circle),
                    ),
                  ),
                  Expanded(
                    child: Text(it,
                        style: TextStyle(
                            fontSize: 14, height: 1.45, color: c.inkStrong)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// One true/false statement with a True / False toggle. On reveal it shows the
/// correct answer and whether the student's mark matched.
class _TfStatementTile extends StatelessWidget {
  final QOption option;
  final bool? marked; // null = unanswered, true = marked True
  final bool revealed;
  final bool correctIsTrue;
  final ValueChanged<bool>? onMark;
  const _TfStatementTile({
    required this.option,
    required this.marked,
    required this.revealed,
    required this.correctIsTrue,
    required this.onMark,
  });

  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFDC2626);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final wasRight = marked != null && marked == correctIsTrue;
    Color border = c.line;
    if (revealed) {
      border = (marked == null)
          ? c.line
          : (wasRight ? _green : _red);
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(
            color: border, width: revealed && marked != null ? 1.6 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (option.label.trim().isNotEmpty) ...[
                Text('${option.label}. ',
                    style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: c.inkSoft)),
              ],
              Expanded(
                child: Text(option.text,
                    style: TextStyle(
                        fontSize: 15.5, height: 1.4, color: c.inkStrong)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _tfButton(c, label: 'True', value: true),
              const SizedBox(width: 8),
              _tfButton(c, label: 'False', value: false),
            ],
          ),
          if (revealed) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  marked == null
                      ? Icons.remove_circle_outline
                      : (wasRight
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded),
                  size: 15,
                  color: marked == null
                      ? c.inkSoft
                      : (wasRight ? _green : _red),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'You: ${marked == null ? '—' : (marked! ? 'True' : 'False')}'
                    '   ·   Correct: ${correctIsTrue ? 'True' : 'False'}',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: marked == null
                            ? c.inkSoft
                            : (wasRight ? _green : _red)),
                  ),
                ),
              ],
            ),
            if (option.whyIncorrect.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(option.whyIncorrect,
                  style: TextStyle(
                      fontSize: 13, height: 1.45, color: c.inkMedium)),
            ],
          ],
        ],
      ),
    );
  }

  Widget _tfButton(AppColors c, {required String label, required bool value}) {
    final isPicked = marked == value;
    // After reveal, tint the correct choice green and a wrong pick red.
    Color bg = c.surface2;
    Color fg = c.inkMedium;
    Color border = c.line;
    if (revealed) {
      if (value == correctIsTrue) {
        bg = _green.withValues(alpha: 0.12);
        fg = _green;
        border = _green;
      } else if (isPicked) {
        bg = _red.withValues(alpha: 0.10);
        fg = _red;
        border = _red;
      }
    } else if (isPicked) {
      bg = c.primaryTint;
      fg = c.primary;
      border = c.primary;
    }
    return Expanded(
      child: GestureDetector(
        onTap: onMark == null ? null : () => onMark!(value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 130),
          padding: const EdgeInsets.symmetric(vertical: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: border, width: isPicked ? 1.6 : 1),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w800, color: fg)),
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final QOption option;
  final bool selected;
  final bool revealed;
  final bool isCorrect;
  final VoidCallback? onTap;
  const _OptionTile({
    required this.option,
    required this.selected,
    required this.revealed,
    required this.isCorrect,
    required this.onTap,
  });

  static const _green = Color(0xFF16A34A);
  static const _red = Color(0xFFDC2626);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Color border = c.line;
    Color bg = c.cardElevated;
    Color labelBg = c.surface2;
    Color labelFg = c.inkMedium;

    if (revealed && isCorrect) {
      border = _green;
      bg = _green.withValues(alpha: 0.09);
      labelBg = _green;
      labelFg = Colors.white;
    } else if (revealed && selected && !isCorrect) {
      border = _red;
      bg = _red.withValues(alpha: 0.08);
      labelBg = _red;
      labelFg = Colors.white;
    } else if (selected) {
      border = c.primary;
      bg = c.primaryTint;
      labelBg = c.primary;
      labelFg = Colors.white;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(13),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
              color: border,
              width: (selected || (revealed && isCorrect)) ? 1.6 : 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: labelBg, shape: BoxShape.circle),
              child: Text(option.label,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: labelFg)),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Text(option.text,
                  style: TextStyle(
                      fontSize: 15.5, height: 1.4, color: c.inkStrong)),
            ),
            if (revealed && isCorrect)
              const Icon(Icons.check_rounded, size: 20, color: _green),
            if (revealed && selected && !isCorrect)
              const Icon(Icons.close_rounded, size: 20, color: _red),
          ],
        ),
      ),
    );
  }
}

class _RevealBlock extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color accent;
  final Widget child;
  final Widget? trailing;
  const _RevealBlock({
    required this.icon,
    required this.title,
    required this.accent,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: accent),
              const SizedBox(width: 7),
              Expanded(
                child: Text(title,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                        color: accent)),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 9),
          child,
        ],
      ),
    );
  }
}
