import { Link } from 'react-router-dom';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

const sections = [
  {
    title: '1. Subscription Access',
    body: 'xyndrome sells access to digital medical learning content, quizzes, notes, and study tools. Access may begin as soon as a payment is approved or an admin activates a plan.',
  },
  {
    title: '2. Refund Requests',
    body: 'Refund requests should be sent to the platform support/admin contact with the student account email, payment date, plan name, amount, and reason for the request.',
  },
  {
    title: '3. When Refunds May Be Considered',
    list: [
      'A duplicate payment was made for the same account and plan.',
      'A payment was taken but access was not activated after reasonable support time.',
      'A technical issue prevented meaningful use of the paid content and the issue could not be resolved.',
    ],
  },
  {
    title: '4. Non-Refundable Cases',
    list: [
      'The subscription period has been substantially used.',
      'The request is based only on a change of mind after accessing paid content.',
      'The account was suspended for misuse, credential sharing, unauthorized access attempts, or content redistribution.',
    ],
  },
  {
    title: '5. Bank Transfer Payments',
    body: 'Manual bank transfer payments require admin verification. If a transfer cannot be matched to a student account or plan, the student may be asked for additional proof before activation or refund handling.',
  },
  {
    title: '6. Processing Time',
    body: 'Approved refunds are processed through the original payment method where possible. Bank and payment-provider processing times may vary.',
  },
  {
    title: '7. Final Review',
    body: 'Refund approval depends on payment-provider records, account activity, access history, and applicable consumer protection rules. This policy should be adapted to the final business entity and local legal requirements before launch.',
  },
];

export function RefundPolicyPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Refund Policy"
        description="Refund and cancellation policy for xyndrome medical learning subscriptions and payment verification."
        path="/refund-policy"
      />
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <XyndromeBrand
            className="min-w-0"
            markSize={38}
            subtitle="Refund Policy"
            textClassName="!font-extrabold"
          />

          <div className={ui.buttonRow}>
            <Link to="/terms" className={ui.secondaryAction}>Terms</Link>
            <Link to="/" className={ui.secondaryAction}>Back to Home</Link>
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Payments and Cancellations</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Refund Policy</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            Last updated: May 31, 2026. This policy explains how refund requests are reviewed for xyndrome subscriptions,
            PayHere checkout payments, and manual bank transfer payments.
          </p>

          {sections.map((section) => (
            <div key={section.title} className="mt-7 grid gap-2">
              <h2 className="m-0 text-lg font-extrabold text-ink-strong">{section.title}</h2>
              {section.body ? <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">{section.body}</p> : null}
              {section.list ? (
                <ul className="m-0 grid gap-2 pl-5">
                  {section.list.map((item) => (
                    <li className="list-disc text-[14.5px] leading-[1.75] text-ink-soft" key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
