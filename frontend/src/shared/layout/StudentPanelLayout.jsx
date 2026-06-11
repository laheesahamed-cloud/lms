import '../../surfaces/app/student-surface.css';
import { PanelLayout } from './PanelLayout.jsx';

// Same shell as PanelLayout, but carries the student-surface stylesheet so
// student routes (and legacy mixed-role paths) load it with the layout chunk
// while the admin tree stays free of it.
export function StudentPanelLayout() {
  return <PanelLayout />;
}
