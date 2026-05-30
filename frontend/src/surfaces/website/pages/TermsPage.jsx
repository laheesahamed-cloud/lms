import { Link } from 'react-router-dom';
import { ui } from '../../../shared/styles/tailwindClasses.js';

const sections = [
  {
    title: '1. Account Information',
    body: 'You must provide accurate information when creating your student account. Fake names, misleading details, or duplicate accounts may be rejected or removed.',
  },
  {
    title: '2. Approval Before Full Access',
    body: 'New student accounts may remain pending until reviewed by the admin. Creating an account does not guarantee immediate access to all lessons, quizzes, or paid content.',
  },
  {
    title: '3. Respectful Use',
    list: [
      'Do not misuse the platform, attempt unauthorized access, or interfere with other users.',
      'Do not share private account credentials with others.',
      'Do not copy, resell, or redistribute course content without permission.',
    ],
  },
  {
    title: '4. Course Access',
    body: 'Course availability, plan features, and learning access may depend on the package purchased and the admin approval settings.',
  },
  {
    title: '5. Account Decisions',
    body: 'The admin may approve, limit, suspend, or deactivate accounts when needed to protect the LMS, course content, or learning environment.',
  },
  {
    title: '6. Friendly Final Note',
    body: 'Be kind, learn well, and avoid trying to outsmart the login screen.',
  },
];

export function TermsPage() {
  return (
    <main className="min-h-dvh px-[clamp(20px,4vw,40px)] py-[clamp(40px,6vw,80px)]">
      <div className="mx-auto grid w-full max-w-[900px] gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={ui.brandMark}>ER</div>
            <div>
              <div className="font-display text-[17px] font-extrabold leading-tight text-ink-strong max-[640px]:text-[15px]">xyndrome</div>
              <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-soft max-[640px]:text-[9.5px]">Terms and Conditions</div>
            </div>
          </div>

          <Link to="/register" className={ui.secondaryAction}>Back to Create Account</Link>
        </div>

        <section className={ui.pageCard}>
          <div className={ui.eyebrow}>Student Agreement</div>
          <h1 className="mt-3 mb-4 font-display text-[28px] font-extrabold leading-tight text-ink-strong">Terms &amp; Conditions</h1>
          <p className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
            These terms keep the platform safe, respectful, and useful for students. By creating an account, you agree
            to use xyndrome honestly and wait patiently while your access is reviewed by the admin.
            {' '}Read the <Link to="/privacy-policy" className="font-bold text-brand-primary no-underline">Privacy Policy</Link> to understand how student, subscription, and payment data is handled.
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
