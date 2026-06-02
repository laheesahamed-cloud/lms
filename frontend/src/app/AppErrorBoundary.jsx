import { Component } from 'react';
import { XyndromeBrand } from '../shared/brand/XyndromeBrand.jsx';
import { detectPlatform } from '../shared/platform/detect.js';
import { requestSpaNavigation } from '../shared/routing/spaNavigation.js';

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
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (!isRecoverableBuildAssetError(error) || !canReloadForBuildAssetError()) {
      return;
    }

    this.setState({ recovering: true });
    window.setTimeout(() => window.location.reload(), 80);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.recovering
      ? 'Refreshing the latest app files...'
      : this.state.error?.message || 'The screen could not be rendered.';

    const native = PLATFORM.isNative;
    const pageBackground = native ? 'var(--lms-login-dark-bg, #060d22)' : 'var(--app-bg, var(--page-background, #ffffff))';
    const panelBackground = native ? '#1c2631' : '#ffffff';
    const borderColor = native ? 'rgba(205, 219, 235, 0.16)' : '#dbe3ef';
    const titleColor = native ? '#e3ebf5' : '#0f172a';
    const bodyColor = native ? '#c3cfdd' : '#475569';

    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 20,
          background: pageBackground,
          color: titleColor,
        }}
      >
        <section
          style={{
            width: 'min(560px, 100%)',
            border: `1px solid ${borderColor}`,
            borderRadius: 12,
            background: panelBackground,
            boxShadow: native ? '0 18px 40px rgba(0, 0, 0, 0.28)' : '0 18px 40px rgba(15, 23, 42, 0.08)',
            padding: 22,
          }}
        >
          <XyndromeBrand
            markSize={30}
            textClassName="!font-extrabold"
            style={{
              '--xyndrome-brand-text': native ? '#e3ebf5' : '#0f172a',
              margin: '0 0 10px',
            }}
          />
          <h1 style={{ margin: '0 0 10px', fontSize: 22, lineHeight: 1.15 }}>
            This page hit a render error
          </h1>
          <p style={{ margin: '0 0 16px', color: bodyColor, fontSize: 14, lineHeight: 1.5 }}>
            {message}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              requestSpaNavigation(PLATFORM.isNative ? '/dashboard' : '/lms/dashboard', { replace: true });
            }}
            disabled={this.state.recovering}
            style={{
              minHeight: 42,
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              background: '#eff6ff',
              color: '#1d4ed8',
              fontWeight: 800,
              padding: '0 14px',
              opacity: this.state.recovering ? 0.7 : 1,
            }}
          >
            {this.state.recovering ? 'Refreshing...' : 'Return to dashboard'}
          </button>
        </section>
      </main>
    );
  }
}
