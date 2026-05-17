import { Link } from 'react-router-dom';
import { OfflineExperience } from '../../../shared/pwa/OfflineExperience.jsx';
import { SlowNetworkExperience } from '../../../shared/pwa/SlowNetworkExperience.jsx';
import { ServerNotRespondingExperience } from '../../../shared/pwa/ServerNotRespondingExperience.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

export function PwaPreviewPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-page gap-6 px-page-x py-page-y">
      <section className="grid max-w-[860px] gap-4">
        <span className={ui.eyebrow}>PWA Preview</span>
        <h1 className="m-0 font-display text-[clamp(30px,5vw,56px)] font-extrabold leading-tight text-ink-strong">Preview the offline and slow-network states.</h1>
        <p className="m-0 max-w-[720px] text-[15px] leading-relaxed text-ink-soft">
          This route lets you view both experiences instantly without turning off your internet or opening DevTools
          throttling.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className={ui.primaryAction}>Back to Site</Link>
          <Link to="/notes" className={ui.secondaryAction}>Open Notes</Link>
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        <article className="grid gap-4 overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-5 shadow-md">
          <div className="grid gap-2">
            <span className={ui.eyebrow}>Offline Cache</span>
            <h2 className="m-0 text-lg font-extrabold text-ink-strong">Installed app with no internet</h2>
            <p className="m-0 text-[13px] leading-relaxed text-ink-soft">The full-screen fallback with cached motivational quotes and animated loading rings.</p>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-line-soft bg-surface-2">
            <OfflineExperience forceVisible previewClassName="offline-experience--preview" />
          </div>
        </article>

        <article className="grid gap-4 overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-5 shadow-md">
          <div className="grid gap-2">
            <span className={ui.eyebrow}>Slow Network</span>
            <h2 className="m-0 text-lg font-extrabold text-ink-strong">Internet exists, but loading is dragging</h2>
            <p className="m-0 text-[13px] leading-relaxed text-ink-soft">The lighter overlay used while requests are still in progress on a slow connection.</p>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-line-soft bg-surface-2 p-5">
            <SlowNetworkExperience forceVisible previewClassName="slow-network-experience--preview" />
            <div className="grid gap-3 opacity-70">
              <div className="h-8 rounded-md bg-surface-3" />
              <div className="h-20 rounded-lg bg-surface-1 shadow-xs" />
              <div className="h-16 w-3/4 rounded-lg bg-surface-1 shadow-xs" />
              <div className="h-20 rounded-lg bg-surface-1 shadow-xs" />
            </div>
          </div>
        </article>

        <article className="grid gap-4 overflow-hidden rounded-lg border border-line-soft bg-surface-1 p-5 shadow-md">
          <div className="grid gap-2">
            <span className={ui.eyebrow}>Server Not Responding</span>
            <h2 className="m-0 text-lg font-extrabold text-ink-strong">Internet exists, but the backend has stopped answering</h2>
            <p className="m-0 text-[13px] leading-relaxed text-ink-soft">The emergency fallback for timeout or server silence while the device is still online.</p>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-line-soft bg-surface-2">
            <ServerNotRespondingExperience forceVisible previewClassName="server-not-responding--preview" />
          </div>
        </article>
      </section>
    </main>
  );
}
