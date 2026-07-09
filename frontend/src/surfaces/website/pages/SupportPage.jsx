import { Link } from 'react-router-dom';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

// Public support page. Used as the App Store / Play Store "Support URL": a
// publicly reachable page where users can get help, contact us, and find
// answers to common questions.
const SUPPORT_EMAIL = 'support@xyndrome.lk';

const faqs = [
  {
    title: 'How do I create an account?',
    body: 'Open the app and tap "Create Account", or sign in with Google or Apple. Email sign-ups receive a one-time 6-digit verification code to confirm the address before your account is activated.',
  },
  {
    title: 'How do subscriptions and course access work?',
    body: 'You can browse the app and try features before subscribing. Access to premium courses, lessons, and question banks is managed through your account. If a subscription or course does not unlock as expected, contact us and we will check your access.',
  },
  {
    title: 'I forgot my password. What do I do?',
    body: 'On the sign-in screen, tap "Forgot password" and enter your account email. We will send a reset link so you can set a new password.',
  },
  {
    title: 'My quiz results or progress are not saving.',
    body: 'Make sure you have a working internet connection, as progress is synced to your account. If a completed quiz or lesson still does not update, sign out and back in, or email us with your account email and the quiz name.',
  },
  {
    title: 'How do I restore my notes and flashcards?',
    body: 'Personal notes and flashcards are stored per account on your device. Sign in with the same account you created them on to see them. Switching accounts on the same device keeps each account’s notes separate.',
  },
  {
    title: 'How do I delete my account?',
    body: 'Open Profile in the app and tap "Delete account", or visit the Delete Account page from the link below. Deletion is permanent and removes your personal data.',
  },
];

export function SupportPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Support"
        description="Get help with your Xyndrome account, subscriptions, lessons, quizzes, flashcards, and more. Contact our support team."
        path="/support"
      />
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <XyndromeBrand
            className="min-w-0"
            markSize={38}
            subtitle="Support"
            textClassName="!font-extrabold"
          />

          <div className={ui.buttonRow}>
            <Link to="/privacy-policy" className={ui.secondaryAction}>Privacy Policy</Link>
            <Link to="/delete-account" className={ui.secondaryAction}>Delete Account</Link>
            <Link to="/" className={ui.secondaryAction}>Back to Home</Link>
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Help and Contact</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Support</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            Need help with Xyndrome? We are here for you. Email us any time at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-ink-strong underline">{SUPPORT_EMAIL}</a>{' '}
            and include the email address on your account so we can help you faster. We aim to reply within 2 business days.
          </p>

          <div className="mt-7 grid gap-2">
            <h2 className="m-0 text-lg font-extrabold text-ink-strong">Frequently asked questions</h2>
          </div>

          {faqs.map((faq) => (
            <div key={faq.title} className="mt-7 grid gap-2">
              <h2 className="m-0 text-lg font-extrabold text-ink-strong">{faq.title}</h2>
              <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">{faq.body}</p>
            </div>
          ))}

          <div className="mt-7 grid gap-2">
            <h2 className="m-0 text-lg font-extrabold text-ink-strong">Still need help?</h2>
            <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
              If your question is not answered above, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-ink-strong underline">{SUPPORT_EMAIL}</a>.
              Describe what you were doing, the screen you were on, and your account email, and we will get back to you.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
