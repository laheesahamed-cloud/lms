import { Link } from 'react-router-dom';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

// Public account-deletion page. Required by Google Play (Data Safety → Account
// deletion) and Apple: a publicly reachable URL where users can request full
// account + data deletion, including those who have uninstalled the app.
const SUPPORT_EMAIL = 'support@xyndrome.lk';

const sections = [
  {
    title: '1. Delete from inside the app',
    body: 'Open the Xyndrome app, go to Profile, and tap "Delete account". Confirm the prompt. Your account is deleted immediately and you are signed out.',
  },
  {
    title: '2. Delete from the web',
    body: 'Sign in at xyndrome.lk/lms, open your Profile, and choose "Delete account". This works even if you no longer have the app installed — just sign in with the same account.',
  },
  {
    title: '3. What is deleted',
    body: 'Your name, email address, profile photo, password, and all login sessions are permanently removed or anonymized the moment you delete. You are signed out and can no longer log in with that account, and your personal profile can no longer be identified.',
  },
  {
    title: '4. What may be retained',
    body: 'De-identified learning records (such as aggregate quiz statistics) and records we are legally required to keep — for example payment, tax, security, and fraud-prevention records — may be retained without any personal identifiers that link them back to you.',
  },
  {
    title: '5. Timeline',
    body: 'Personal data is removed immediately when you delete your account. Any residual copies in encrypted backups are purged within 30 days.',
  },
  {
    title: '6. Need help, or can’t sign in?',
    body: `If you have uninstalled the app or can’t access your account, email ${SUPPORT_EMAIL} from the email address on your account. We will verify your identity and delete the account and its associated personal data for you.`,
  },
];

export function DeleteAccountPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Delete Your Account"
        description="How to permanently delete your Xyndrome account and associated personal data, from the app or the web."
        path="/delete-account"
      />
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <XyndromeBrand
            className="min-w-0"
            markSize={38}
            subtitle="Delete Account"
            textClassName="!font-extrabold"
          />

          <div className={ui.buttonRow}>
            <Link to="/login" className={ui.primaryAction}>Sign in to delete</Link>
            <Link to="/privacy-policy" className={ui.secondaryAction}>Privacy Policy</Link>
            <Link to="/" className={ui.secondaryAction}>Back to Home</Link>
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Account and Data Deletion</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Delete Your Account</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            This page explains how to permanently delete your Xyndrome account and the personal data linked to it.
            <strong> Deleting your account is permanent and cannot be undone.</strong> You can delete it yourself in
            seconds from the app or the web — no request needed — and a support option is provided if you can no longer
            sign in.
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
