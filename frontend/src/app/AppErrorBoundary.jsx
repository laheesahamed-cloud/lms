import { Component } from 'react';
import { detectPlatform } from '../shared/platform/detect.js';
import { requestSpaNavigation } from '../shared/routing/spaNavigation.js';
import { SystemStatusOverlay } from '../shared/ui/SystemStatusOverlay.jsx';

const PLATFORM = detectPlatform();
const BUILD_ASSET_RECOVERY_RELOAD_KEY = 'lms_build_asset_recovery_reload_at';
const BUILD_ASSET_RECOVERY_RELOAD_WINDOW_MS = 30_000;

function isRecoverableBuildAssetError(error) {
  const message = String(error?.message || error || '');
  return /valid JavaScript MIME type|dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);
}

function canReloadForBuildAssetError() {
  if (typeof window === 'undefined') return false;

  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(BUILD_ASSET_RECOVERY_RELOAD_KEY) || 0);
    if (lastReloadAt && Date.now() - lastReloadAt < BUILD_ASSET_RECOVERY_RELOAD_WINDOW_MS) {
      return false;
    }
    window.sessionStorage.setItem(BUILD_ASSET_RECOVERY_RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
    this.recoveryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isRecoverableBuildAssetError(error) && canReloadForBuildAssetError()) {
      this.setState({ recovering: true });
      window.setTimeout(() => window.location.reload(), 80);
      return;
    }

    if (!this.recoveryTimer) {
      this.recoveryTimer = window.setTimeout(() => {
        this.setState({ error: null, recovering: false });
        requestSpaNavigation(PLATFORM.isNative ? '/dashboard' : '/lms/dashboard', { replace: true });
      }, 1400);
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimer) {
      window.clearTimeout(this.recoveryTimer);
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return <SystemStatusOverlay variant="render" zIndex={12000} />;
  }
}
