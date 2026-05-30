import { Component } from 'react';
import { detectPlatform } from '../shared/platform/detect.js';

const PLATFORM = detectPlatform();

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('LMS render error', error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error?.message || 'The screen could not be rendered.';

    const native = PLATFORM.isNative;
    const pageBackground = native ? '#151c24' : 'var(--app-bg, var(--page-background, #ffffff))';
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
          <p style={{ margin: '0 0 6px', color: '#2563eb', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
            xyndrome
          </p>
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
              window.location.href = PLATFORM.isNative ? '/' : '/lms';
            }}
            style={{
              minHeight: 42,
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              background: '#eff6ff',
              color: '#1d4ed8',
              fontWeight: 800,
              padding: '0 14px',
            }}
          >
            Return to dashboard
          </button>
        </section>
      </main>
    );
  }
}
