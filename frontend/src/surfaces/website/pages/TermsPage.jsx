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
    body: 'Course availability, plan features, and learning access depend on the package purchased, payment status, account status, and admin approval settings. Paid access is delivered digitally inside the LMS after the payment is approved, verified, or confirmed by Apple for in-app purchases.',
  },
  {
    title: '6. Plans, Pricing, and Availability',
    body: 'Plan names, prices, discounts, course access, and package features may change from time to time. Any active offer or coupon may have its own limits, expiry, access scope, and approval conditions.',
  },
  {
    title: '7. Orders and Payments on the Website',
    body: 'By submitting a subscription order on the website, you confirm that the package and billing details are correct. PayHere checkout payments are processed by PayHere. Manual bank transfer requests are activated only after admin verification of the uploaded payment proof. Purchases made inside the iOS app are covered separately in section 8.',
  },
  {
    title: '8. In-App Purchases (iOS App)',
    body: 'Subscriptions offered inside the xyndrome iOS app are sold as in-app purchases through the Apple App Store. These Terms apply together with Apple’s own terms for in-app purchases and auto-renewable subscriptions.',
    list: [
      'Payment is charged to your Apple ID account when you confirm the purchase. Apple, not xyndrome, processes the payment.',
      'The plan name, length, and price are shown in the app before you buy. Prices appear in your App Store currency and may include taxes.',
      'Subscriptions renew automatically at the same length and price unless you cancel at least 24 hours before the end of the current period. Your Apple ID account is charged for renewal within 24 hours before the period ends.',
      'You can manage or cancel a subscription at any time in Settings → Apple ID → Subscriptions on your device. Cancelling stops future renewals, and you keep access until the end of the period you have paid for.',
      'Deleting the app or deleting your xyndrome account does not cancel an Apple subscription. Cancel it in your Apple ID settings first, or Apple will keep billing you.',
      'Access follows the period confirmed by Apple. If a renewal payment fails, Apple may give a billing grace period, and access continues during it. When a subscription ends, your account returns to free access.',
      'Use Restore Purchases in the app to reactivate your subscription after reinstalling the app or signing in on a new device, using the same Apple ID.',
      'Apple is not a party to these Terms and is not responsible for xyndrome’s content, support, or maintenance.',
    ],
  },
  {
    title: '9. Third-Party Payment Processing',
    body: 'Online payment details are handled by PayHere, Apple (for in-app purchases), or the active payment provider. xyndrome does not store full card numbers or card security codes. Payment status, order references, Apple transaction identifiers, and transaction records may be stored for subscription activation, support, accounting, and dispute handling.',
  },
  {
    title: '10. Refunds and Cancellations',
    body: 'Refund and cancellation requests for PayHere and bank transfer payments are reviewed under the Refund Policy. Purchases made through the Apple App Store are refunded only by Apple, so xyndrome cannot issue or reverse them; request those through reportaproblem.apple.com or Apple Support. Digital access, payment status, account activity, and usage history may affect the final decision.',
  },
  {
    title: '11. Content and Intellectual Property',
    body: 'Lessons, notes, explanations, questions, quizzes, designs, text, images, logos, and other LMS materials belong to xyndrome or its content owners. You may use them only for personal study unless written permission is given.',
  },
  {
    title: '12. Educational Use',
    body: 'xyndrome is an educational study platform. To ensure completeness and depth of coverage, some study materials are developed with the help of advanced technology tools and reviewed by qualified medical professionals before being published. This means the content you study is checked for accuracy and relevance to your curriculum, not simply generated and released. That said, xyndrome is a preparation aid — your results will always reflect your own effort, consistency, and readiness. The platform is not a substitute for professional medical advice, clinical supervision, university requirements, or official examination guidance. Reference tools such as the Drug Reference, ECG Library, and Auscultation (heart and lung sounds) library are provided strictly for study and exam preparation. They are not intended for clinical diagnosis or treatment, are not a substitute for a qualified healthcare professional, and must never be used to make decisions about an actual patient.',
  },
  {
    title: '13. Account Decisions',
    body: 'The admin may approve, limit, suspend, or deactivate accounts when needed to protect the LMS, course content, payments, students, or learning environment. A subscription gives you full access to the study tools, materials, and resources xyndrome provides. What you achieve with that access — your scores, your progress, your results — is shaped by your own dedication, effort, and consistency. xyndrome is here to give you the best possible environment to prepare; the journey and its outcomes are yours to own.',
  },
  {
    title: '14. Limitation of Liability',
    body: 'To the fullest extent permitted by law, xyndrome is not responsible for indirect, incidental, or consequential losses arising from platform use, delayed access, payment-provider delays, internet problems, device issues, or reliance on study material beyond its educational purpose.',
  },
  {
    title: '15. Changes to These Terms',
    body: 'These Terms and Conditions may be updated when platform features, payment flows, legal requirements, or operating practices change. The latest version will be posted on this page.',
  },
  {
    title: '16. Contact',
    body: 'For account, subscription, payment, or policy questions, contact the xyndrome admin or support channel shown on the platform or website.',
  },
];

export function TermsPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Terms and Conditions"
        description="Terms and conditions for xyndrome student accounts, digital course access, PayHere payments, Apple in-app subscriptions, refunds, and platform rules."
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
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Student Agreement</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Terms &amp; Conditions</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            Last updated: November 1, 2026. These terms explain the rules for using xyndrome, creating an account,
            buying digital subscription access, and paying by PayHere, bank transfer, or in-app purchase through the Apple App Store.
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
