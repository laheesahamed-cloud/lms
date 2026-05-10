import { ui } from '../styles/tailwindClasses.js';
import { studyPageUi } from './studyPageStyles.js';

const studyPayload = {
  title: 'Notes: Heart Failure 101 🫀',
  sections: [
    {
      heading: 'What is Heart Failure?',
      sticker: '💡',
      content: [
        "It is not the heart stopping; it's the heart failing to pump enough blood to meet the body's needs.",
        "Think of it as a 'pump failure' leading to a backup of fluids.",
        'Chronic condition that requires long-term management.',
      ],
    },
    {
      heading: 'Left-Sided HF (Lungs)',
      sticker: '🫁',
      content: [
        'The most common type of heart failure.',
        'Blood backs up into the Pulmonary veins and lungs.',
        'Main symptom: Dyspnea (shortness of breath).',
        'Crackles/Wheezing heard on lung auscultation.',
      ],
    },
    {
      heading: 'Right-Sided HF (Body)',
      sticker: '🦶',
      content: [
        'Often caused by pre-existing Left-Sided HF.',
        'Blood backs up into the systemic circulation (the body).',
        'Key sign: Peripheral Edema (swelling in ankles and legs).',
        'Jugular Venous Distention (JVD) is a classic indicator.',
      ],
    },
    {
      heading: 'Red Flags & Symptoms',
      sticker: '⚠️',
      content: [
        'Fatigue: Reduced oxygen delivery to muscles.',
        'Orthopnea: Difficulty breathing while lying flat.',
        'Weight Gain: Rapid increase due to fluid retention.',
        'Persistent Cough: Often producing pink, frothy sputum.',
      ],
    },
    {
      heading: 'Management Basics',
      sticker: '💊',
      content: [
        'Diuretics: To help the body flush out excess fluid.',
        'Low-Sodium Diet: To prevent water retention.',
        'Daily Weighing: To monitor fluid status changes.',
        'ACE Inhibitors: To reduce the workload on the heart.',
      ],
    },
  ],
  images: [
    '[Image: Heart anatomy diagram showing chambers and valves]',
    '[Image: Pulmonary edema X-ray showing fluid in the lungs]',
  ],
};

export function GeminiPage() {
  return (
    <main className={studyPageUi.page}>
      <section className={studyPageUi.shell}>
        <header className={`${studyPageUi.panel} ${studyPageUi.hero}`}>
          <span className={ui.eyebrow}>Gemini Study Page</span>
          <p className={studyPageUi.breadcrumb}>Medicine &gt; Cardiology</p>
          <h1 className={studyPageUi.title}>{studyPayload.title}</h1>
          <p className={studyPageUi.subtitle}>
            Quick, structured notes focused on the clinical basics, warning signs, and first-line management ideas.
          </p>
        </header>

        <section className={`${studyPageUi.panel} ${studyPageUi.definition}`}>
          <span className={studyPageUi.definitionLabel}>Core Idea</span>
          <p className={studyPageUi.definitionText}>"Heart failure means the heart is not pumping well enough, so fluid backs up and tissues get less perfusion."</p>
        </section>

        <section className={studyPageUi.grid}>
          {studyPayload.sections.map((section) => (
            <article className={`${studyPageUi.panel} ${studyPageUi.card}`} key={section.heading}>
              <div className={studyPageUi.cardHead}>
                <span className={studyPageUi.sticker} aria-hidden="true">
                  {section.sticker}
                </span>
                <h2 className={studyPageUi.cardTitle}>{section.heading}</h2>
              </div>

              <ul className={studyPageUi.list}>
                {section.content.map((item) => (
                  <li className={studyPageUi.listItem} key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className={studyPageUi.images}>
          <div>
            <span className={ui.eyebrow}>Visual Study Prompts</span>
            <h2 className={studyPageUi.imagesTitle}>Images to revise alongside the notes</h2>
          </div>

          <div className={studyPageUi.imagesGrid}>
            {studyPayload.images.map((image) => (
              <article className={`${studyPageUi.panel} ${studyPageUi.imageCard}`} key={image}>
                <span className={studyPageUi.imageIcon} aria-hidden="true">
                  🖼️
                </span>
                <strong className={studyPageUi.imageTitle}>{image}</strong>
                <p className={studyPageUi.imageText}>Pair this visual with the section above to reinforce exam-style recall and pattern recognition.</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
