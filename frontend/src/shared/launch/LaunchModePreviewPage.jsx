import { Navigate, useParams } from 'react-router-dom';
import { LaunchModePage } from './LaunchModePage.jsx';

export function LaunchModePreviewPage() {
  const { mode } = useParams();
  if (mode !== 'maintenance' && mode !== 'coming-soon') {
    return <Navigate to="/launch-preview/maintenance" replace />;
  }

  return <LaunchModePage mode={mode} preview />;
}
