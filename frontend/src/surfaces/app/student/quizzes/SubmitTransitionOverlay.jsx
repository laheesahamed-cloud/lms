import { createPortal } from 'react-dom';
import '../../../../shared/styles/03-components/submit-transition.css';

/**
 * Two-screen submit transition (design: "Badge verify" — see desktop/opt/quizanim.md).
 *
 * Both screens stay mounted inside one card; the phase drives a CSS morph
 * (spinner cross-fades/scales into the badge, the two labels cross-fade) so it
 * feels like one card transforming rather than two cards swapping.
 *
 *   phase="submitting"  → spinner + "…is submitting" label
 *   phase="complete"    → verified badge + done label
 *   phase=null/"idle"   → nothing rendered
 *
 * Non-blocking by design: the real scoring/save runs while this plays. The caller
 * holds each phase for a minimum duration so the moment never flashes.
 */
export default function SubmitTransitionOverlay({
  phase,
  submittingLabel = 'Your quiz is submitting…',
  completeLabel = 'Submission complete!',
}) {
  if (!phase || phase === 'idle') return null;
  if (typeof document === 'undefined') return null;

  const overlay = (
    <div className="qsubmit-scrim" role="status" aria-live="polite">
      <div className="qsubmit-panel" data-phase={phase}>
        <div className="qsubmit-icon">
          <span className="qsubmit-spinner" aria-hidden="true" />
          <span className="qsubmit-badge" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="60"
              height="60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7c.412 .41 .97 .64 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1c0 .58 .23 1.138 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" />
              <path d="M9 12l2 2l4 -4" />
            </svg>
          </span>
        </div>
        <div className="qsubmit-textwrap">
          <p className="qsubmit-text qsubmit-text--submitting">{submittingLabel}</p>
          <p className="qsubmit-text qsubmit-text--done">{completeLabel}</p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
