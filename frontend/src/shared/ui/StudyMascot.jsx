const sizeMap = {
  sm: 'study-mascot--sm',
  md: 'study-mascot--md',
  lg: 'study-mascot--lg',
};

function StethoFace({ mood }) {
  const isCorrect = mood === 'correct' || mood === 'lesson';
  const isWrong = mood === 'wrong' || mood === 'review';

  return (
    <svg viewBox="0 0 96 96" className="study-mascot__svg" focusable="false" aria-hidden="true">
      <g className="study-mascot__bob">
        <path className="study-mascot__tube" d="M31 18c-9 3-15 12-15 23 0 15 11 28 25 30M65 18c9 3 15 12 15 23 0 15-11 28-25 30" />
        <circle className="study-mascot__ear" cx="26" cy="17" r="6" />
        <circle className="study-mascot__ear" cx="70" cy="17" r="6" />
        <circle className="study-mascot__head" cx="48" cy="47" r="25" />
        <circle className="study-mascot__cheek" cx="33" cy="52" r="5" />
        <circle className="study-mascot__cheek" cx="63" cy="52" r="5" />
        <g className="study-mascot__eyes">
          {isCorrect ? (
            <>
              <path d="M35 43c3 4 7 4 10 0" />
              <path d="M51 43c3 4 7 4 10 0" />
            </>
          ) : (
            <>
              <circle cx="39" cy="43" r="3" />
              <circle cx="57" cy="43" r="3" />
            </>
          )}
        </g>
        {isWrong ? (
          <path className="study-mascot__mouth" d="M40 59c5-4 11-4 16 0" />
        ) : (
          <path className="study-mascot__mouth" d="M39 58c4 5 14 5 18 0" />
        )}
        <path className="study-mascot__arm study-mascot__arm--left" d="M26 68c-8 4-11 9-11 15" />
        <path className="study-mascot__leg" d="M39 72v10M57 72v10" />
        <path className="study-mascot__arm study-mascot__arm--right" d="M70 67c8 4 13 3 16-4" />
        <circle className="study-mascot__scope" cx="87" cy="59" r="8" />
        {isCorrect ? (
          <g className="study-mascot__sparkles">
            <path d="M15 37l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
            <path d="M78 29l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}

function BrainRunner() {
  return (
    <svg viewBox="0 0 96 96" className="study-mascot__svg" focusable="false" aria-hidden="true">
      <g className="study-mascot__run">
        <path className="study-mascot__brain" d="M28 48c-6-3-8-10-4-16 2-4 6-6 11-6 2-7 9-12 17-9 5 2 8 6 9 11 7 1 12 6 12 13 0 8-6 14-14 14H37c-4 0-7-1-9-7Z" />
        <path className="study-mascot__brain-line" d="M36 28c4 2 5 6 3 11M51 20c-4 6-3 12 3 16M60 33c-5 1-8 4-9 9M36 45c4-4 9-5 14-2" />
        <circle className="study-mascot__eye" cx="42" cy="42" r="2.6" />
        <circle className="study-mascot__eye" cx="59" cy="42" r="2.6" />
        <path className="study-mascot__mouth" d="M47 49c4 3 9 3 13 0" />
        <path className="study-mascot__leg" d="M40 56l-8 10M58 56l10 9" />
        <path className="study-mascot__arm" d="M29 45l-9-5M69 43l11-8" />
        <rect className="study-mascot__tiny-card" x="76" y="24" width="12" height="16" rx="3" />
      </g>
      <path className="study-mascot__ground" d="M18 77h58" />
    </svg>
  );
}

function ReadinessPulse() {
  return (
    <svg viewBox="0 0 96 96" className="study-mascot__svg" focusable="false" aria-hidden="true">
      <g className="study-mascot__pulse">
        <rect className="study-mascot__iv" x="18" y="18" width="26" height="48" rx="8" />
        <path className="study-mascot__iv-fill" d="M22 44h18v12c0 4-3 7-7 7h-4c-4 0-7-3-7-7V44Z" />
        <path className="study-mascot__tube" d="M44 43c15 0 12 24 25 24 8 0 11-8 11-17V30" />
        <path className="study-mascot__ecg" d="M48 48h9l5-12 7 25 5-13h12" />
        <circle className="study-mascot__ear" cx="80" cy="27" r="7" />
      </g>
    </svg>
  );
}

function StreakFlame() {
  return (
    <svg viewBox="0 0 96 96" className="study-mascot__svg" focusable="false" aria-hidden="true">
      <g className="study-mascot__flame">
        <path className="study-mascot__flame-outer" d="M49 82c-17 0-28-10-28-25 0-14 9-22 17-31 4-4 7-8 8-14 12 10 16 20 13 31 4-4 7-9 8-15 7 7 10 16 10 27 0 16-11 27-28 27Z" />
        <path className="study-mascot__flame-inner" d="M49 76c-8 0-14-5-14-13 0-7 5-11 9-16 2-2 4-5 4-8 7 6 9 12 8 19 3-2 5-5 6-9 4 4 6 9 6 14 0 8-8 13-19 13Z" />
        <path className="study-mascot__glasses" d="M31 43h16v8H31zM51 43h16v8H51zM47 47h4" />
        <path className="study-mascot__mouth" d="M42 60c5 4 12 4 17 0" />
      </g>
    </svg>
  );
}

function ClipboardReview() {
  return (
    <svg viewBox="0 0 96 96" className="study-mascot__svg" focusable="false" aria-hidden="true">
      <g className="study-mascot__bob">
        <rect className="study-mascot__clipboard" x="26" y="18" width="44" height="62" rx="8" />
        <rect className="study-mascot__clip" x="38" y="12" width="20" height="12" rx="4" />
        <path className="study-mascot__clipboard-line" d="M37 38h22M37 49h18M37 60h20" />
        <circle className="study-mascot__eye" cx="42" cy="69" r="2.4" />
        <circle className="study-mascot__eye" cx="54" cy="69" r="2.4" />
        <path className="study-mascot__mouth" d="M43 75c4-2 8-2 12 0" />
        <path className="study-mascot__arm study-mascot__arm--left" d="M27 45c-8 3-10 8-7 14" />
        <path className="study-mascot__arm study-mascot__arm--right" d="M70 45c8 3 10 8 7 14" />
      </g>
    </svg>
  );
}

function MascotArt({ variant, mood }) {
  if (variant === 'brain') return <BrainRunner />;
  if (variant === 'readiness') return <ReadinessPulse />;
  if (variant === 'streak') return <StreakFlame />;
  if (variant === 'review') return <ClipboardReview />;
  return <StethoFace mood={mood} />;
}

export function StudyMascot({
  variant = 'stetho',
  mood = 'happy',
  size = 'md',
  label = '',
  caption = '',
  className = '',
}) {
  const classes = [
    'study-mascot',
    sizeMap[size] || sizeMap.md,
    `study-mascot--${variant}`,
    `study-mascot--mood-${mood}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}>
      <MascotArt variant={variant} mood={mood} />
      {caption ? <span className="study-mascot__caption">{caption}</span> : null}
    </span>
  );
}
