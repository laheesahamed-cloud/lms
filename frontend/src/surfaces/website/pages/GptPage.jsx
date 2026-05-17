import { ui } from '../../../shared/styles/tailwindClasses.js';
import { studyPageUi } from './studyPageStyles.js';

const studyPayload = {
  title: '💙 Heart Failure — quick study notes',
  sections: [
    {
      heading: 'What is it? (the basics)',
      sticker: '🫀',
      content: [
        'Clinical syndrome where heart cannot pump enough blood to meet body needs',
        'Leads to congestion + poor tissue perfusion',
        'Common causes: ischemic heart disease, hypertension, cardiomyopathy',
      ],
    },
    {
      heading: 'Left vs Right HF — know the difference',
      sticker: '❤️',
      content: [
        'Left-sided HF -> blood backs up into lungs',
        'Right-sided HF -> blood backs up into systemic circulation',
        'Left HF often causes right HF over time',
      ],
    },
    {
      heading: 'Left-sided HF signs',
      sticker: '🌬️',
      content: [
        'Dyspnea (especially on exertion)',
        'Orthopnea (breathlessness lying flat)',
        'Paroxysmal nocturnal dyspnea',
        'Pulmonary edema -> crackles on auscultation',
      ],
    },
    {
      heading: 'Right-sided HF signs',
      sticker: '⚠️',
      content: [
        'Peripheral edema (legs, ankles)',
        'Ascites (fluid in abdomen)',
        'Hepatomegaly',
        'Raised JVP (jugular venous pressure)',
      ],
    },
    {
      heading: 'Key symptoms to remember',
      sticker: '🧠',
      content: [
        'Fatigue due to low cardiac output',
        'Fluid retention -> swelling + weight gain',
        'Reduced exercise tolerance',
        'Chronic cough (often worse at night)',
      ],
    },
    {
      heading: 'Simple idea to remember',
      sticker: '💡',
      content: [
        'Left = lungs (breathing problems)',
        'Right = body (swelling problems)',
        'Think: "backward failure" = fluid buildup',
      ],
    },
  ],
  images: ['Heart anatomy diagram showing chambers', 'Pulmonary edema chest X-ray'],
};

export function GptPage() {
  return (
    <main className={studyPageUi.page}>
      <section className={studyPageUi.shell}>
        <header className={`${studyPageUi.panel} ${studyPageUi.hero}`}>
          <span className={ui.eyebrow}>GPT Study Page</span>
          <p className={studyPageUi.breadcrumb}>Medicine &gt; Cardiology</p>
          <h1 className={studyPageUi.title}>{studyPayload.title}</h1>
          <p className={studyPageUi.subtitle}>
            A fast, clean review page for remembering the essentials of heart failure before quizzes or revision.
          </p>
        </header>

        <section className={`${studyPageUi.panel} ${studyPageUi.definition}`}>
          <span className={studyPageUi.definitionLabel}>Definition</span>
          <p className={studyPageUi.definitionText}>"A clinical condition where the heart cannot pump enough blood to meet the body's needs."</p>
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
            <span className={ui.eyebrow}>Suggested Visuals</span>
            <h2 className={studyPageUi.imagesTitle}>Helpful images to review</h2>
          </div>

          <div className={studyPageUi.imagesGrid}>
            {studyPayload.images.map((image) => (
              <article className={`${studyPageUi.panel} ${studyPageUi.imageCard}`} key={image}>
                <span className={studyPageUi.imageIcon} aria-hidden="true">
                  🖼️
                </span>
                <strong className={studyPageUi.imageTitle}>{image}</strong>
                <p className={studyPageUi.imageText}>Use this as a study companion visual while revising the core notes above.</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
