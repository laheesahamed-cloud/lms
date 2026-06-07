import { Link } from 'react-router-dom';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { ui } from '../../../shared/styles/tailwindClasses.js';

const sections = [
  {
    title: '1. Information We Collect',
    body: 'We collect the information needed to create and manage your student account, provide lessons and quizzes, process subscriptions, and support your learning progress.',
    list: [
      'Account details such as name, email address, password, role, status, and contact information you choose to provide.',
      'Learning activity such as quiz attempts, answers, scores, bookmarks, lesson progress, generated study content, and subscription access history.',
      'Payment and order details such as plan, coupon code, order ID, transaction status, amount, currency, billing contact details, PayHere payment reference, and bank transfer slip or screenshot uploads.',
      'Technical information such as IP address, device/browser details, login sessions, security logs, cookies, local storage, and usage activity needed to operate the LMS.',
    ],
  },
  {
    title: '2. How We Use Information',
    list: [
      'To create accounts, authenticate users, and keep the LMS secure.',
      'To deliver lessons, MCQs, quizzes, results, analytics, and subscription-based access.',
      'To create payment orders, apply coupons, verify PayHere payment notifications, and activate subscriptions after successful payment.',
      'To send account, subscription, payment, support, and important service messages.',
      'To improve question quality, platform performance, content planning, and student learning experience.',
      'To investigate misuse, protect course content, enforce terms, and comply with legal or administrative obligations.',
    ],
  },
  {
    title: '3. Payments',
    body: 'Online card and payment details are handled by PayHere or the active payment provider. xyndrome stores order and transaction records, but does not store full card numbers, card security codes, or sensitive card verification data on LMS servers.',
  },
  {
    title: '4. Coupons and Billing Details',
    body: 'When you use a coupon or complete checkout, we may collect billing name, email, phone number, address, city, and country so the order can be created correctly and sent to PayHere.',
  },
  {
    title: '5. Cookies and Sessions',
    body: 'We may use cookies, local storage, or similar browser storage to keep you signed in, remember preferences, improve performance, and protect the platform from unauthorized access. Some parts of the LMS may not work correctly if these are disabled.',
  },
  {
    title: '6. Sharing Information',
    body: 'We do not sell student personal information. We may share limited information only when needed to operate the LMS, process payments, provide support, protect the platform, or comply with lawful requests.',
    list: [
      'Payment processors such as PayHere receive the checkout and billing information needed to process payments and send payment status notifications.',
      'Service providers may process hosting, email, analytics, storage, or security information on our behalf.',
      'Admins and authorized staff may access student account, subscription, and learning records only for platform operations and support.',
    ],
  },
  {
    title: '7. Security',
    body: 'We use reasonable technical and administrative safeguards to protect account, payment, and learning data. No internet system is perfectly secure, so students should protect passwords, keep devices secure, and avoid sharing account access.',
  },
  {
    title: '8. Data Retention',
    body: 'We keep account, learning, audit, and transaction records for as long as needed to provide the LMS, resolve disputes, maintain subscription history, improve academic support, and meet legal or accounting requirements.',
  },
  {
    title: '9. Your Choices',
    list: [
      'You may update basic account details from your profile where available.',
      'You may contact support to request correction, export, restriction, or deletion of your personal information.',
      'Some records, such as payment, audit, security, and subscription history, may need to be retained where required for legitimate business, security, or legal reasons.',
    ],
  },
  {
    title: '10. Student Content and Public Areas',
    body: 'If the LMS includes comments, reports, discussions, or other shared areas, avoid posting sensitive personal information. Content shared in these areas may be visible to admins or other authorized users depending on the feature.',
  },
  {
    title: '11. Children',
    body: 'xyndrome is intended for medical students and adult learners. We do not knowingly collect personal information from children.',
  },
  {
    title: '12. Changes to This Policy',
    body: 'We may update this Privacy Policy when the platform, payment flow, legal requirements, or operating practices change. The latest version will be posted on this page with the updated date.',
  },
  {
    title: '13. Contact',
    body: 'For privacy questions, account data requests, or payment record questions, contact the xyndrome admin or support channel shown on the platform.',
  },
];

export function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <PageMeta
        title="Privacy Policy"
        description="Privacy policy for xyndrome student accounts, learning activity, PayHere payments, subscriptions, security logs, and support."
        path="/privacy-policy"
      />
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <XyndromeBrand
            className="min-w-0"
            markSize={38}
            subtitle="Privacy Policy"
            textClassName="!font-extrabold"
          />

          <div className={ui.buttonRow}>
            <Link to="/terms" className={ui.secondaryAction}>Terms</Link>
            <Link to="/cookie-policy" className={ui.secondaryAction}>Cookies</Link>
            <Link to="/register" className={ui.secondaryAction}>Back to Create Account</Link>
          </div>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Student Data Protection</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Privacy Policy</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            Last updated: June 6, 2026. This policy explains how xyndrome collects, uses, protects, and shares
            information when students use the website, learning tools, subscriptions, coupons, and PayHere checkout.
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
