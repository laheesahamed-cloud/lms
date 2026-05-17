import React from 'react';
import { cx } from '../styles/tailwindClasses';
import { noteFloatPosition, noteTilt, noteTone, noteUi } from './lessonNoteStyles';

export const heartFailureLesson = {
  title: 'Heart Failure',
  icon: '🫀',
  accentIcon: '☕',
  doodles: ['✿', '♡', '✦', '✎'],
  lead:
    'The heart cannot pump blood effectively, so fluid builds up in the lungs or body. This lesson page is built as a real scrollable React interface with a doodle notebook style.',
  sections: {
    symptoms: {
      label: 'Symptoms',
      note: 'swipe cards on mobile →',
      items: [
        {
          icon: '🫁',
          title: 'Shortness of Breath',
          text: 'Breathing feels difficult during activity or even at rest.',
        },
        {
          icon: '😮‍💨',
          title: 'Fatigue',
          text: 'Low energy, weakness, and feeling tired all the time.',
        },
        {
          icon: '🦵',
          title: 'Swelling',
          text: 'Fluid buildup in legs, ankles, and feet causes edema.',
        },
        {
          icon: '🤧',
          title: 'Cough / Wheeze',
          text: 'Persistent coughing or wheezing from fluid in the lungs.',
        },
      ],
    },
    causes: {
      label: 'Causes',
      note: 'what makes the heart work harder?',
      items: [
        {
          title: 'High Blood Pressure',
          text: 'Raises the workload on the heart.',
        },
        {
          title: 'Coronary Artery Disease',
          text: 'Reduces blood flow to the heart muscle.',
        },
        {
          title: 'Cardiomyopathy',
          text: 'Weakens the heart muscle over time.',
        },
        {
          title: 'Valve Problems',
          text: 'Make pumping less effective.',
        },
      ],
    },
    types: {
      label: 'Types',
      note: 'left side vs right side',
      items: [
        {
          title: 'Left-Sided',
          text: 'Fluid backs up into the lungs.',
        },
        {
          title: 'Right-Sided',
          text: 'Fluid backs up into the body and legs.',
        },
        {
          title: 'Systolic',
          text: 'The heart does not pump strongly enough.',
        },
        {
          title: 'Diastolic',
          text: 'The heart does not relax and fill properly.',
        },
      ],
      pills: ['lung fluid', 'body swelling', 'weak pump', 'stiff ventricle'],
    },
    diagnosis: {
      label: 'Diagnosis',
      note: 'how doctors check it',
      items: [
        { title: 'Echocardiogram' },
        { title: 'EKG' },
        { title: 'Chest X-ray' },
        { title: 'BNP Blood Test' },
      ],
      pills: ['ultrasound', 'electrical test', 'imaging', 'lab test'],
    },
    treatment: {
      label: 'Treatment',
      note: 'protect the heart + manage symptoms',
      items: [
        {
          title: 'Medicines',
          text: 'Diuretics, ACE inhibitors, beta-blockers.',
        },
        {
          title: 'Lifestyle Changes',
          text: 'Low-salt diet, exercise, fluid control.',
        },
        {
          title: 'Devices',
          text: 'Pacemaker or ICD in selected cases.',
        },
      ],
      pills: ['beta-blockers', 'ACE inhibitors', 'diuretics', 'low salt', 'exercise'],
    },
  },
};

const floatingDoodles = ['✏️', '💊', '⚡', '☕'];

function ChecklistItem({ title, text }) {
  return (
    <li className={noteUi.checklistItem}>
      <span className={noteUi.check}>✓</span>
      <span>
        <strong>{title}</strong>
        {text ? (
          <>
            <br />
            {text}
          </>
        ) : null}
      </span>
    </li>
  );
}

function SectionHeader({ label, note, toneClass }) {
  return (
    <div className={noteUi.sectionHead}>
      <span className={cx(noteUi.sticky, toneClass)}>{label}</span>
      <span className={noteUi.note}>{note}</span>
    </div>
  );
}

function SymptomCard({ icon, title, text, rotateClass }) {
  return (
    <article className={cx(noteUi.card, rotateClass)}>
      <div className={noteUi.pin} />
      <div className={noteUi.cardIcon}>{icon}</div>
      <h3 className={noteUi.cardTitle}>{title}</h3>
      <p className={noteUi.cardText}>{text}</p>
    </article>
  );
}

function ListSection({ id, section, toneClass }) {
  return (
    <section className={noteUi.section} id={id}>
      <div className={noteUi.tape} />
      <SectionHeader label={section.label} note={section.note} toneClass={toneClass} />

      <div className={noteUi.listCard}>
        <ul className={noteUi.checklist}>
          {section.items.map((item) => (
            <ChecklistItem key={item.title} title={item.title} text={item.text} />
          ))}
        </ul>

        {section.pills?.length ? (
          <div className={noteUi.pillRow}>
            {section.pills.map((pill) => (
              <span className={noteUi.pill} key={pill}>
                {pill}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function HeartFailureNotes({ lesson = heartFailureLesson, embedded = false }) {
  const sections = lesson.sections;
  const navItems = [
    { href: '#symptoms', label: sections.symptoms.label },
    { href: '#causes', label: sections.causes.label },
    { href: '#types', label: sections.types.label },
    { href: '#diagnosis', label: sections.diagnosis.label },
    { href: '#treatment', label: sections.treatment.label },
  ];

  return (
    <div className={cx(noteUi.wrapper, embedded && noteUi.embeddedWrapper)}>
      <div className={cx(noteUi.spiral, embedded && 'hidden')} aria-hidden="true" />

      <main className={cx(noteUi.page, embedded && noteUi.embeddedPage)}>
        {floatingDoodles.map((item, index) => (
          <div className={cx(noteUi.float, noteFloatPosition[index], embedded && noteUi.embeddedFloat)} aria-hidden="true" key={`${item}-${index}`}>
            {item}
          </div>
        ))}

        <header className={cx(noteUi.hero, embedded && noteUi.embeddedHero)}>
          <div className={noteUi.miniDoodles} aria-hidden="true">
            {lesson.doodles.join(' ')}
          </div>

          <div className={noteUi.heroRow}>
            <div className={noteUi.heroIcon} aria-hidden="true">
              {lesson.icon}
            </div>

            <div className={noteUi.titleWrap}>
              <h1 className={noteUi.title}>
                {lesson.title.split(' ').map((word) => (
                  <React.Fragment key={word}>
                    {word}
                    <br />
                  </React.Fragment>
                ))}
              </h1>
              <div className={noteUi.scribble} aria-hidden="true" />
            </div>

            <div className={noteUi.heroIcon} aria-hidden="true">
              {lesson.accentIcon}
            </div>
          </div>

          <nav className={noteUi.tabs} aria-label="Lesson sections">
            {navItems.map((item) => (
              <a className={noteUi.tab} href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        <section className={noteUi.lead} aria-label="Lesson introduction">
          {lesson.lead}
        </section>

        <section className={noteUi.section} id="symptoms">
          <div className={noteUi.tape} />
          <SectionHeader label={sections.symptoms.label} note={sections.symptoms.note} toneClass={noteTone.symptoms} />

          <div className={noteUi.cards} role="list" aria-label="Symptoms">
            {sections.symptoms.items.map((card, index) => (
              <SymptomCard
                key={card.title}
                icon={card.icon}
                title={card.title}
                text={card.text}
                rotateClass={noteTilt[index % noteTilt.length]}
              />
            ))}
          </div>
        </section>

        <ListSection id="causes" section={sections.causes} toneClass={noteTone.causes} />
        <ListSection id="types" section={sections.types} toneClass={noteTone.types} />
        <ListSection id="diagnosis" section={sections.diagnosis} toneClass={noteTone.diagnosis} />
        <ListSection id="treatment" section={sections.treatment} toneClass={noteTone.treat} />

        <footer className={cx(noteUi.footer, embedded && noteUi.embeddedFooter)}>
          <span>Take care of your heart ♡</span>
        </footer>
      </main>
    </div>
  );
}
