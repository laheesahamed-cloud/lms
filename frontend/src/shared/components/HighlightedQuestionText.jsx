import { MedicalText } from './MedicalText.jsx';
import { splitTextForHighlights } from '../utils/highlightText.js';

// Renders the question stem with AI-identified clue phrases wrapped in <mark>.
// Falls back to plain MedicalText rendering when there are no highlights.
export function HighlightedQuestionText({
  as = 'p',
  text,
  highlights,
  className,
  imageLoading,
  imageFetchPriority,
  imageZoomable,
  ...props
}) {
  const imageOptions = { imageLoading, imageFetchPriority, imageZoomable };
  const segments = splitTextForHighlights(text, highlights);
  if (segments.length === 1 && !segments[0].highlighted) {
    return <MedicalText as={as} className={className} text={text} {...imageOptions} {...props} />;
  }

  const Component = as;
  return (
    <Component className={className} {...props}>
      {segments.map((segment, index) => (
        segment.highlighted ? (
          <mark className="lms-question-approach-highlight" key={index}>
            <MedicalText as="span" text={segment.text} {...imageOptions} />
          </mark>
        ) : (
          <MedicalText as="span" key={index} text={segment.text} {...imageOptions} />
        )
      ))}
    </Component>
  );
}
