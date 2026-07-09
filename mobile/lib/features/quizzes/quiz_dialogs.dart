import 'package:flutter/material.dart';
import '../../theme/tokens.dart';

/// Confirm popup shown before a quiz/exam begins.
Future<bool?> showQuizStartDialog(
  BuildContext context, {
  required bool exam,
  required int totalQuestions,
  required int timeLimitMinutes,
}) {
  final c = context.c;
  final lines = <String>[
    '$totalQuestions question${totalQuestions == 1 ? '' : 's'}',
    if (exam && timeLimitMinutes > 0) '$timeLimitMinutes minute time limit',
  ];
  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      backgroundColor: c.cardElevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(exam ? 'Start exam?' : 'Start quiz?',
          style: TextStyle(
              fontWeight: FontWeight.w800, color: c.inkStrong, fontSize: 18)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final l in lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Row(
                children: [
                  Icon(Icons.circle, size: 5, color: c.inkMuted),
                  const SizedBox(width: 8),
                  Text(l, style: TextStyle(fontSize: 14, color: c.inkSoft)),
                ],
              ),
            ),
          if (exam) ...[
            const SizedBox(height: 8),
            Text(
                timeLimitMinutes > 0
                    ? 'The timer starts as soon as you begin. Your answers are graded and saved when you submit.'
                    : 'Your answers are graded and saved when you submit.',
                style: TextStyle(fontSize: 13, color: c.inkSoft, height: 1.4)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(exam ? 'Start exam' : 'Start'),
        ),
      ],
    ),
  );
}

/// Confirm popup shown when the student tries to leave mid-quiz (back button
/// or swipe). Guards against losing an in-progress attempt by accident.
Future<bool?> showQuizLeaveDialog(BuildContext context, {required bool exam}) {
  final c = context.c;
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: c.cardElevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(exam ? 'Leave exam?' : 'Leave quiz?',
          style: TextStyle(
              fontWeight: FontWeight.w800, color: c.inkStrong, fontSize: 18)),
      content: Text(
        exam
            ? 'Your answers won\'t be submitted or graded if you leave now. This attempt will be lost.'
            : 'You\'ll lose your progress on this practice set if you leave now.',
        style: TextStyle(fontSize: 14, color: c.inkSoft, height: 1.45),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Stay'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: c.error),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Leave'),
        ),
      ],
    ),
  );
}

/// Confirm popup shown before finishing a practice quiz / submitting an exam.
Future<bool?> showQuizFinishDialog(
  BuildContext context, {
  required bool exam,
  required int answered,
  int? total,
}) {
  final c = context.c;
  final unanswered = (total != null) ? (total - answered) : 0;
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: c.cardElevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(exam ? 'Submit exam?' : 'Finish quiz?',
          style: TextStyle(
              fontWeight: FontWeight.w800, color: c.inkStrong, fontSize: 18)),
      content: Text(
        exam
            ? (total != null && unanswered > 0
                ? 'You answered $answered of $total. $unanswered left unanswered will be marked wrong. You can\'t change answers after submitting.'
                : 'You answered all $total questions. You can\'t change answers after submitting.')
            : 'You can review answers afterwards from your results.',
        style: TextStyle(fontSize: 14, color: c.inkSoft, height: 1.45),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(exam ? 'Keep going' : 'Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(exam ? 'Submit' : 'Finish'),
        ),
      ],
    ),
  );
}
