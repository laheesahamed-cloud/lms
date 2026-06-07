import { Link } from 'react-router-dom';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

const sections = [
  {
    title: '1. Account Information',
    body: 'You must provide accurate and current information when creating your student account, registering for a package, or completing checkout. Fake names, misleading details, or duplicate accounts may be rejected, limited, or removed.',
  },
  {
    title: '2. Approval Before Full Access',
    body: 'New student accounts may remain pending until reviewed by the admin. Creating an account does not guarantee immediate access to all lessons, quizzes, or paid content.',
  },
  {
    title: '3. Account Security',
    body: 'You are responsible for keeping your login details confidential. Account sharing, credential resale, or allowing another person to use paid access may lead to suspension or cancellation without a refund.',
  },
  {
    title: '4. Respectful Use',
    list: [
      'Do not misuse the platform, attempt unauthorized access, or interfere with other users.',
      'Do not share private account credentials with others.',
      'Do not copy, resell, or redistribute course content without permission.',
      'Do not use automated scraping, bulk downloading, reverse engineering, or other activity that harms platform performance or content security.',
    ],
  },
  {
    title: '5. Course Access and Digital Delivery',
    body: 'Course availability, plan features, and learning access depend on the package purchased, payment status, account status, and admin approval settings. Paid access is delivered digitally inside the LMS after the payment is approved or verified.',
  },
  {
    title: '6. Plans, Pricing, and Availability',
    body: 'Plan names, prices, discounts, course access, and package features may change from time to time. Any active offer or coupon may have its own limits, expiry, access scope, and approval conditions.',
  },
  {
    title: '7. Orders and Payments',
    body: 'By submitting a subscription order, you confirm that the package and billing details are correct. PayHere checkout payments are processed by PayHere. Manual bank transfer requests are activated only after admin verification of the uploaded payment proof.',
  },
  {
    title: '8. Third-Party Payment Processing',
    body: 'Online payment details are handled by PayHere or the active payment provider. xyndrome does not store full card numbers or card security codes. Payment status, order references, and transaction records may be stored for subscription activation, support, accounting, and dispute handling.',
  },
  {
    title: '9. Refunds and Cancellations',
    body: 'Refund and cancellation requests are reviewed under the Refund Policy. Digital access, payment status, account activity, and usage history may affect the final decision.',
  },
  {
    title: '10. Content and Intellectual Property',
    body: 'Lessons, notes, explanations, questions, quizzes, designs, text, images, logos, and other LMS materials belong to xyndrome or its content owners. You may use them only for personal study unless written permission is given.',
  },
  {
    title: '11. Educational Use',
    body: 'xyndrome is an educational study platform. Content may support exam preparation and learning, but it is not a substitute for professional medical advice, clinical supervision, university requirements, or official examination guidance.',
  },
  {
    title: '12. Account Decisions',
    body: 'The admin may approve, limit, suspend, or deactivate accounts when needed to protect the LMS, course content, payments, students, or learning environment.',
  },
  {
    title: '13. Limitation of Liability',
    body: 'To the fullest extent permitted by law, xyndrome is not responsible for indirect, incidental, or consequential losses arising from platform use, delayed access, payment-provider delays, internet problems, device issues, or reliance on study material beyond its educational purpose.',
  },
  {
    title: '14. Changes to These Terms',
    body: 'These Terms and Conditions may be updated when platform features, payment flows, legal requirements, or operating practices change. The latest version will be posted on this page.',
  },
  {
    title: '15. Contact',
    body: 'For account, subscription, payment, or policy questions, contact the xyndrome admin or support channel shown on the platform or website.',
  },
];

export function TermsPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Terms and Conditions"
        description="Terms and conditions for xyndrome student accounts, digital course access, PayHere payments, subscriptions, refunds, and platform rules."
        path="/terms"
      />
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <XyndromeBrand
            className="min-w-0"
            markSize={38}
            subtitle="Terms and Conditions"
            textClassName="!font-extrabold"
          />

          <div className={ui.buttonRow}>
            <Link to="/privacy-policy" className={ui.secondaryAction}>Privacy</Link>
            <Link to="/refund-policy" className={ui.secondaryAction}>Refunds</Link>
            <Link to="/register" className={ui.secondaryAction}>Back to Create Account</Link>
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Student Agreement</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Terms &amp; Conditions</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            Last updated: June 6, 2026. These terms explain the rules for using xyndrome, creating an account,
            buying digital subscription access, and completing PayHere or bank transfer payments.
            {' '}Read the <Link to="/privacy-policy" className="font-bold text-brand-primary no-underline">Privacy Policy</Link> and <Link to="/refund-policy" className="font-bold text-brand-primary no-underline">Refund Policy</Link> for more details.
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
