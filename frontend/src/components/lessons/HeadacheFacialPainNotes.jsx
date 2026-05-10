import React from 'react';
import { cx } from '../../styles/tailwindClasses';
import { noteFloatPosition, noteTone, noteUi } from './lessonNoteStyles';

const floatingDoodles = ['🧠', '⚡', '💊', '👁️'];

export const headacheFacialPainLesson = {
  title: 'Headache & Facial Pain',
  icon: '🧠',
  accentIcon: '⚡',
  doodles: ['✦', '☄', '✎', '⚕'],
  lead:
    'Headache can be primary, where the headache itself is the disease, or secondary, where pain points to an underlying medical condition. This lesson organizes common patterns, red flags, and management into a colorful study-notes layout.',
  sections: {
    classification: {
      label: 'Classification',
      note: 'primary vs secondary headache disorders',
      items: [
        {
          title: 'Primary Headache Disorders',
          text: 'The headache itself is the disease. Includes tension-type headache, migraine, and cluster headache.',
        },
        {
          title: 'Secondary Headache Disorders',
          text: 'Headache occurs because of an underlying condition such as raised ICP, infection, SAH, giant cell arteritis, or glaucoma.',
        },
      ],
      pills: ['tension-type', 'migraine', 'cluster', 'secondary causes'],
    },
    tension: {
      label: 'Tension-Type',
      note: 'most common chronic daily headache',
      items: [
        {
          title: 'Typical Pattern',
          text: 'Dull, pressure-like, non-throbbing pain with a “tight band” or “cap-like” sensation.',
        },
        {
          title: 'Distribution',
          text: 'Usually bilateral and mild to moderate in intensity.',
        },
        {
          title: 'Activity Effect',
          text: 'Not worsened by normal activity, though heavy activity may worsen symptoms.',
        },
        {
          title: 'Duration',
          text: 'Usually lasts from 30 minutes up to 7 days.',
        },
        {
          title: 'Absent Features',
          text: 'No nausea, vomiting, photophobia, or phonophobia.',
        },
      ],
      pills: ['band-like', 'bilateral', 'mild-moderate', 'no nausea'],
    },
    migraine: {
      label: 'Migraine',
      note: 'episodic throbbing headache with sensory symptoms',
      items: [
        {
          title: 'Types',
          text: 'Migraine with aura (classical, 20%) and migraine without aura (common, 80%).',
        },
        {
          title: 'Demographics',
          text: 'Females are affected more than males, often starting in adolescence or early adulthood, with family history common.',
        },
        {
          title: 'Pain Pattern',
          text: 'Usually unilateral fronto-temporal pain, moderate to severe, pulsating or throbbing, lasting hours up to 3 days.',
        },
        {
          title: 'Associated Symptoms',
          text: 'Nausea, vomiting, photophobia, and phonophobia are common.',
        },
        {
          title: 'Behavior',
          text: 'Worsens with physical activity, and patients often prefer a dark, quiet room.',
        },
        {
          title: 'Aura',
          text: 'Usually around 20 minutes long, followed by headache within 60 minutes. Visual aura includes photopsia, fortification spectra, and scotoma.',
        },
      ],
      pills: ['with aura', 'without aura', 'photophobia', 'dark quiet room'],
    },
    cluster: {
      label: 'Cluster',
      note: 'severe unilateral orbital pain in clusters',
      items: [
        {
          title: 'Cluster Pattern',
          text: 'Occurs daily for 1 to 2 months, often at the same time each day, especially at night.',
        },
        {
          title: 'Demographics',
          text: 'More common in males, usually between 20 and 30 years of age.',
        },
        {
          title: 'Pain',
          text: 'Severe, excruciating unilateral pain around the eye that peaks within minutes and lasts 30 minutes to 3 hours.',
        },
        {
          title: 'Associated Signs',
          text: 'Lacrimation, red eye, nasal congestion, and Horner’s syndrome may occur.',
        },
      ],
      pills: ['orbital pain', 'night attacks', 'tearing', 'Horner syndrome'],
    },
    diagnosis: {
      label: 'Diagnosis',
      note: 'when to image and what to look for',
      items: [
        {
          title: 'Image if Pattern Changes',
          text: 'Neuroimaging is indicated when there is change in pattern, frequency, or severity, or progressive worsening.',
        },
        {
          title: 'Image with Neuro Signs',
          text: 'Also image if there are focal neurological signs, exertional headache, or onset after age 40.',
        },
        {
          title: 'Sinister Causes',
          text: 'Consider raised ICP, intracranial infections, SAH, giant cell arteritis, glaucoma, and acute hypertension.',
        },
        {
          title: 'Red Flags',
          text: 'Sudden onset, progressive worsening, waking from sleep, fever, new headache after 50, papilledema, focal deficits, or meningism.',
        },
      ],
      pills: ['neuroimaging', 'red flags', 'SAH', 'papilledema'],
    },
    treatment: {
      label: 'Treatment',
      note: 'management changes with the headache type',
      items: [
        {
          title: 'Tension-Type',
          text: 'Reassurance, low-dose amitriptyline, stress management, and regular aerobic exercise.',
        },
        {
          title: 'Migraine Acute',
          text: 'NSAIDs plus anti-emetic, or triptans such as sumatriptan, rizatriptan, and naratriptan. Best taken early.',
        },
        {
          title: 'Migraine Prophylaxis',
          text: 'Use if at least 2 attacks per month or if daily life is affected. Options include propranolol, amitriptyline, flunarizine, pizotifen, topiramate, valproate, and candesartan.',
        },
        {
          title: 'Cluster Headache',
          text: 'Acute treatment with 100% oxygen, sumatriptan, or a short course of steroids. Preventive treatment includes verapamil, lithium, topiramate, and valproate.',
        },
        {
          title: 'Giant Cell Arteritis',
          text: 'Start high-dose steroids immediately and confirm with temporal artery biopsy. Do not wait because irreversible blindness can occur.',
        },
      ],
      pills: ['amitriptyline', 'triptans', 'oxygen', 'steroids', 'verapamil'],
    },
  },
  extraSections: [
    {
      label: 'Giant Cell Arteritis',
      note: 'always think about vision loss risk',
      items: [
        {
          title: 'Core Features',
          text: 'Systemic vasculitis with ESR usually above 50, more common in females, and can cause irreversible blindness.',
        },
        {
          title: 'Symptoms',
          text: 'Localized headache, scalp tenderness, jaw claudication, and constitutional symptoms.',
        },
        {
          title: 'Signs',
          text: 'Temporal artery may be tender, swollen, and non-pulsatile.',
        },
        {
          title: 'Diagnosis & Action',
          text: 'Confirm with temporal artery biopsy, but start high-dose steroids immediately.',
        },
      ],
      pills: ['ESR > 50', 'jaw claudication', 'temporal artery biopsy', 'blindness risk'],
    },
  ],
};

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

export default function HeadacheFacialPainNotes({ lesson = headacheFacialPainLesson, embedded = false }) {
  const sections = lesson.sections;
  const navItems = [
    { href: '#classification', label: sections.classification.label },
    { href: '#tension', label: sections.tension.label },
    { href: '#migraine', label: sections.migraine.label },
    { href: '#cluster', label: sections.cluster.label },
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
                Headache
                <br />
                &
                <br />
                Facial Pain
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

        <ListSection id="classification" section={sections.classification} toneClass={noteTone.symptoms} />
        <ListSection id="tension" section={sections.tension} toneClass={noteTone.causes} />
        <ListSection id="migraine" section={sections.migraine} toneClass={noteTone.types} />
        <ListSection id="cluster" section={sections.cluster} toneClass={noteTone.diagnosis} />
        <ListSection id="diagnosis" section={sections.diagnosis} toneClass={noteTone.symptoms} />
        <ListSection id="treatment" section={sections.treatment} toneClass={noteTone.treat} />

        {lesson.extraSections?.map((section, index) => (
          <ListSection
            key={section.label}
            id={`extra-${index + 1}`}
            section={section}
            toneClass={index % 2 === 0 ? noteTone.types : noteTone.diagnosis}
          />
        ))}

        <footer className={cx(noteUi.footer, embedded && noteUi.embeddedFooter)}>
          <span>Spot the red flags early ⚠️</span>
        </footer>
      </main>
    </div>
  );
}
