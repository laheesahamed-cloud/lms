import { getSubjectIcon } from '../utils/subjectIcon.js';

/**
 * The icon chosen for a course or subject name, tinted to its colour.
 *
 * Fills its parent chip (the parent needs `position: relative`), so the chip's
 * own size and radius are kept. The SVG is inlined and coloured with
 * `currentColor`, which every browser handles the same way.
 */
export function SubjectIcon({ name }) {
  const { svg, colour } = getSubjectIcon(name);
  return (
    <span
      className="subject-icon"
      style={{ '--subject-tone': colour }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
