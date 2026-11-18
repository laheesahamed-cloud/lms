import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';
import '../../data/app_error.dart';
import '../../theme/tokens.dart';

/// Reasons agreed for a student report (2026-11-17).
const reportReasons = <String>[
  'Wrong answer',
  'Mistake in question or options',
  'Explanation wrong or unclear',
  'Image problem',
  'Other',
];

/// Report one question in a large centered popup: pick a reason ("Other"
/// opens a text box), send. One request (`POST /question-reports`) = one
/// INSERT on the server. Returns true when the report was saved.
Future<bool> showReportQuestionSheet(BuildContext context, int questionId) async {
  final saved = await showDialog<bool>(
    context: context,
    useRootNavigator: true,
    barrierDismissible: false,
    builder: (ctx) => Dialog(
      backgroundColor: ctx.c.card,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: _ReportDialog(questionId: questionId),
      ),
    ),
  );
  return saved == true;
}

class _ReportDialog extends ConsumerStatefulWidget {
  const _ReportDialog({required this.questionId});
  final int questionId;

  @override
  ConsumerState<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends ConsumerState<_ReportDialog> {
  String? _reason;
  final _note = TextEditingController();
  bool _sending = false;
  bool _done = false;
  String? _error;

  bool get _isOther => _reason == 'Other';

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final note = _note.text.trim();
    if (_reason == null) {
      setState(() => _error = 'Choose a reason');
      return;
    }
    if (_isOther && note.isEmpty) {
      setState(() => _error = 'Tell us what is wrong');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).dio.post('/question-reports', data: {
        'questionId': widget.questionId,
        'reason': _reason,
        if (_isOther) 'comment': note,
      });
      if (!mounted) return;
      setState(() {
        _sending = false;
        _done = true;
      });
      await Future<void>.delayed(const Duration(milliseconds: 1400));
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = appError(e).message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (_done) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, size: 52, color: c.success),
            const SizedBox(height: 14),
            Text('Thank you for the review',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: 6),
            Text('Our team will check this question.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: c.inkSoft)),
          ],
        ),
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 14, 12, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.flag_outlined, size: 22, color: c.error),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Report this question',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
              ),
              IconButton(
                onPressed: _sending ? null : () => Navigator.of(context).pop(false),
                icon: Icon(Icons.close_rounded, color: c.inkMedium),
              ),
            ],
          ),
          const SizedBox(height: 6),
          for (final r in reportReasons)
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: _sending
                  ? null
                  : () => setState(() {
                        _reason = r;
                        _error = null;
                      }),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                child: Row(
                  children: [
                    Icon(
                      _reason == r ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                      size: 22,
                      color: _reason == r ? c.primary : c.inkMuted,
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(r, style: TextStyle(fontSize: 15.5, color: c.inkStrong))),
                  ],
                ),
              ),
            ),
          if (_isOther) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextField(
                controller: _note,
                enabled: !_sending,
                autofocus: true,
                minLines: 3,
                maxLines: 5,
                maxLength: 500,
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                decoration: InputDecoration(
                  hintText: 'Tell us what is wrong',
                  filled: true,
                  fillColor: c.surface2,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 6),
            Text(_error!, style: TextStyle(fontSize: 13, color: c.error)),
          ],
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: _sending ? null : _send,
                child: _sending
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Submit report'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
