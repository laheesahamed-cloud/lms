import { FeedbackNotice } from '../../../shared/ui/FeedbackNotice.jsx';

export function AuthFeedbackNotice({ id, tone = 'error', children, onDismiss }) {
  return (
    <FeedbackNotice
      id={id}
      tone={tone}
      className="max-[420px]:top-[calc(env(safe-area-inset-top,0px)+12px)]"
      onDismiss={onDismiss}
    >
      {children}
    </FeedbackNotice>
  );
}
