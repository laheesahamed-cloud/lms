import { Link } from 'react-router-dom';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

const sections = [
  {
    title: '1. Essential Storage',
    body: 'xyndrome uses essential cookies, local storage, and similar browser storage to keep students signed in, protect sessions, remember interface preferences, and support learning features.',
  },
  {
    title: '2. Learning and Preference Data',
    body: 'The app may remember theme, accent color, route state, offline/PWA settings, and learning interface preferences so the study experience remains consistent across sessions.',
  },
  {
    title: '3. Payments and Security',
    body: 'Payment and security flows may use temporary identifiers, order references, anti-abuse signals, and session data needed to protect checkout, account access, and admin workflows.',
  },
  {
    title: '4. Analytics',
    body: 'If analytics tools are enabled, they should be configured to respect this policy and the Privacy Policy. The current codebase does not include a confirmed production analytics provider.',
  },
  {
    title: '5. Managing Cookies',
    body: 'Students can block cookies or storage in their browser settings, but login, subscriptions, PWA mode, and some study features may stop working correctly.',
  },
  {
    title: '6. Updates',
    body: 'This policy should be reviewed whenever analytics, advertising, payment providers, or third-party support tools are added.',
  },
];

export function CookiePolicyPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Cookie Policy"
        description="Cookie and local storage policy for xyndrome sessions, preferences, payment security, and learning features."
        path="/cookie-policy"
      />
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <XyndromeBrand
            className="min-w-0"
            markSize={38}
            subtitle="Cookie Policy"
            textClassName="!font-extrabold"
          />

          <div className={ui.buttonRow}>
            <Link to="/privacy-policy" className={ui.secondaryAction}>Privacy Policy</Link>
            <Link to="/" className={ui.secondaryAction}>Back to Home</Link>
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Cookies and Browser Storage</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Cookie Policy</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            Last updated: May 31, 2026. This policy explains how xyndrome uses cookies, local storage, and similar
            technologies to run the learning platform.
          </p>

          {sections.map((section) => (
            <div key={section.title} className="mt-7 grid gap-2">
              <h2 className="m-0 text-lg font-extrabold text-ink-strong">{section.title}</h2>
              <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">{section.body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
