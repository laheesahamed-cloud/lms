import { useEffect } from 'react';
import { clearServerNotResponding } from '../../../shared/stores/serverStatusStore.js';
import './MascotAnimationLabPage.css';

const mascotBase = `${import.meta.env.BASE_URL}temp/mascots/`;

function cutoutImage(fileName) {
  return fileName.replace(/\.png$/, '-cutout.png');
}

function mascotImagePath(card) {
  return `${mascotBase}${card.generated ? card.image : cutoutImage(card.image)}`;
}

const mascotCards = [
  {
    id: 1,
    key: 'start',
    title: 'Start Practice',
    image: 'start-practice.png',
    line: 'Checking your knowledge pulse...',
    accent: 'pulse',
  },
  {
    id: 2,
    key: 'loading',
    title: 'Loading',
    image: 'loading-brain.png',
    line: 'Warming up the neurons...',
    accent: 'neurons',
  },
  {
    id: 3,
    key: 'correct',
    title: 'Correct Answer',
    image: 'correct-stetho.png',
    line: 'Diagnosis: correct.',
    accent: 'correct',
  },
  {
    id: 4,
    key: 'wrong',
    title: 'Wrong Answer',
    image: 'wrong-skeleton.png',
    line: 'Minor fracture in logic. Repair it.',
    accent: 'repair',
    warm: true,
  },
  {
    id: 5,
    key: 'streak',
    title: 'Daily Streak',
    image: 'daily-streak.png',
    line: 'Streak is clinically alive.',
    accent: 'alive',
    warm: true,
  },
  {
    id: 6,
    key: 'readiness',
    title: 'Exam Readiness',
    image: 'exam-readiness.png',
    line: 'Your exam readiness is stabilizing...',
    accent: 'stabilizing',
  },
  {
    id: 7,
    key: 'rheum',
    title: 'Rheumatology Mood',
    image: 'rheumatology.png',
    line: 'Flexing your rheumatology muscles.',
    accent: 'muscles',
  },
  {
    id: 8,
    key: 'break',
    title: 'Back After a Break',
    image: 'back-break.png',
    line: 'Brain rebooted.',
    accent: 'rebooted',
  },
  {
    id: 9,
    key: 'lesson',
    title: 'Lesson Completed',
    image: 'lesson-completed.png',
    line: 'Knowledge successfully encoded.',
    accent: 'encoded',
  },
  {
    id: 10,
    key: 'qbank',
    title: 'Q-Bank Review',
    image: 'qbank-review.png',
    line: 'This question has entered rehab.',
    accent: 'rehab',
    warm: true,
  },
];

const heroCards = [
  {
    key: 'focus-dose',
    label: 'Hero 1',
    title: 'Daily Study Dose',
    image: 'generated/hero-dose-prescription.png',
    generated: true,
    line: 'Stetho checks today’s focus plan.',
    badge: 'Focus pulse',
  },
  {
    key: 'readiness',
    label: 'Hero 2',
    title: 'Exam Readiness',
    image: 'generated/hero-readiness-shield.png',
    generated: true,
    line: 'Readiness rises with a soft heartbeat.',
    badge: '+3% expected',
  },
  {
    key: 'streak-fire',
    label: 'Hero 3',
    title: 'Streak Hero',
    image: 'generated/hero-streak-calendar.png',
    generated: true,
    line: 'A warm streak moment without feeling childish.',
    badge: '7 days',
    warm: true,
  },
  {
    key: 'lesson-win',
    label: 'Hero 4',
    title: 'Lesson Complete',
    image: 'generated/hero-lesson-book.png',
    generated: true,
    line: 'A celebration for finishing a topic.',
    badge: 'Encoded',
  },
  {
    key: 'qbank-nudge',
    label: 'Hero 5',
    title: 'Q-Bank Nudge',
    image: 'generated/hero-qbank-magnifier.png',
    generated: true,
    line: 'Clipboard shake for questions due today.',
    badge: '12 due',
    warm: true,
  },
  {
    key: 'break-return',
    label: 'Hero 6',
    title: 'Back After Break',
    image: 'generated/hero-brain-coffee.png',
    generated: true,
    line: 'Sleepy brain wakes up gently.',
    badge: 'Reboot',
  },
];

const dashboardMascotCards = [
  {
    id: 'D1',
    key: 'dash-gauge',
    title: 'Dashboard Gauge',
    image: 'generated/dashboard-mascot-gauge.png',
    generated: true,
    line: 'Readiness is climbing.',
    accent: 'climbing',
  },
  {
    id: 'D2',
    key: 'dash-tablet',
    title: 'Study Snapshot',
    image: 'generated/dashboard-mascot-tablet.png',
    generated: true,
    line: 'Today’s data looks focused.',
    accent: 'focused',
  },
  {
    id: 'D3',
    key: 'dash-ecg',
    title: 'Progress Pulse',
    image: 'generated/dashboard-mascot-ecg.png',
    generated: true,
    line: 'Your progress has a pulse.',
    accent: 'pulse',
  },
  {
    id: 'D4',
    key: 'dash-map',
    title: 'Plan Route',
    image: 'generated/dashboard-mascot-map.png',
    generated: true,
    line: 'Next lesson is mapped.',
    accent: 'mapped',
  },
  {
    id: 'D5',
    key: 'dash-checklist',
    title: 'Ready Checklist',
    image: 'generated/dashboard-mascot-checklist.png',
    generated: true,
    line: 'Checklist says keep going.',
    accent: 'keep',
  },
];

const elementMascots = [
  {
    id: 'E1',
    key: 'stetho-wave',
    title: 'Stetho Wave',
    image: 'generated/dashboard-hero-companion.png',
    generated: true,
    label: 'Arm only',
    motion: 'wave',
    line: 'Mascot stays steady. Arm says start.',
  },
  {
    id: 'E2',
    key: 'rx-writer',
    title: 'Rx Writer',
    image: 'generated/hero-dose-prescription.png',
    generated: true,
    label: 'Pen only',
    motion: 'write',
    line: 'Prescription pad writes today plan.',
  },
  {
    id: 'E3',
    key: 'coffee-brain',
    title: 'Coffee Brain',
    image: 'generated/hero-brain-coffee.png',
    generated: true,
    label: 'Eyes + steam',
    motion: 'steam',
    line: 'Tiny wake-up motion for study mode.',
    warm: true,
  },
  {
    id: 'E4',
    key: 'pulse-gauge',
    title: 'Pulse Gauge',
    image: 'generated/dashboard-mascot-gauge.png',
    generated: true,
    label: 'Needle only',
    motion: 'needle',
    line: 'Readiness needle moves without body shake.',
  },
  {
    id: 'E5',
    key: 'clip-check',
    title: 'Clip Check',
    image: 'generated/dashboard-mascot-checklist.png',
    generated: true,
    label: 'Check only',
    motion: 'check',
    line: 'Checklist confirms the next action.',
    warm: true,
  },
];

const vibeMascots = [
  {
    id: 'V1',
    key: 'vial-stetho',
    title: 'Vial Stetho',
    image: 'generated/vibe/vibe-vial-stetho.png',
    generated: true,
    label: 'Bubble glow',
    motion: 'bubbles',
    line: 'Tiny science boost, very serious.',
  },
  {
    id: 'V2',
    key: 'headphone-brain',
    title: 'Focus Brain',
    image: 'generated/vibe/vibe-headphone-brain.png',
    generated: true,
    label: 'Sleepy vibe',
    motion: 'zzz',
    line: 'Low battery brain, still showing up.',
    indigo: true,
  },
  {
    id: 'V3',
    key: 'dna-surf',
    title: 'DNA Surf',
    image: 'generated/vibe/vibe-dna-surf.png',
    generated: true,
    label: 'Wave only',
    motion: 'surf',
    line: 'Riding the flashcard wave.',
  },
  {
    id: 'V4',
    key: 'indigo-clipboard',
    title: 'Boss Clipboard',
    image: 'generated/vibe/vibe-clipboard-teal.png',
    generated: true,
    label: 'Indigo check',
    motion: 'indigo-check',
    line: 'Judges the plan, approves anyway.',
    indigo: true,
  },
  {
    id: 'V5',
    key: 'exam-shield',
    title: 'Exam Shield',
    image: 'generated/vibe/vibe-exam-shield.png',
    generated: true,
    label: 'Glasses glint',
    motion: 'glint',
    line: 'Protected from silly mistakes.',
  },
];

const twoDMascots = [
  {
    id: '2D1',
    key: 'stetho-astronaut',
    title: 'Stetho Astronaut',
    image: 'generated/2d/2d-stetho-astronaut.png',
    generated: true,
    label: 'Orbit stars',
    motion: 'orbit',
    line: 'Floating through today’s tiny mission.',
  },
  {
    id: '2D2',
    key: 'brain-dj',
    title: 'Brain DJ',
    image: 'generated/2d/2d-brain-dj.png',
    generated: true,
    label: 'Beat lines',
    motion: 'music',
    line: 'Study rhythm, no chaos.',
    indigo: true,
  },
  {
    id: '2D3',
    key: 'flashcard-ninja',
    title: 'Card Ninja',
    image: 'generated/2d/2d-flashcard-ninja.png',
    generated: true,
    label: 'Quick slash',
    motion: 'slash',
    line: 'Cuts weak topics down to size.',
  },
  {
    id: '2D4',
    key: 'microscope-wizard',
    title: 'Scope Wizard',
    image: 'generated/2d/2d-microscope-wizard.png',
    generated: true,
    label: 'Magic dots',
    motion: 'magic',
    line: 'Zooms in, makes it make sense.',
    indigo: true,
  },
  {
    id: '2D5',
    key: 'shield-doctor',
    title: 'Shield Doctor',
    image: 'generated/2d/2d-shield-doctor.png',
    generated: true,
    label: 'Target lock',
    motion: 'target',
    line: 'Blocks panic, aims at progress.',
  },
];

const neon3DMascots = [
  {
    id: '3D1',
    key: 'neon-stetho-rocket',
    title: 'Stetho Rocket',
    image: 'generated/3d-neon/neon-stetho-rocket.png',
    generated: true,
    label: 'Rocket trail',
    motion: 'rocket',
    line: 'Dashboard energy, ready for lift-off.',
  },
  {
    id: '3D2',
    key: 'neon-brain-goggles',
    title: 'Goggle Brain',
    image: 'generated/3d-neon/neon-brain-goggles.png',
    generated: true,
    label: 'Lens scan',
    motion: 'goggles',
    line: 'Focused mode with violet glow.',
    indigo: true,
  },
  {
    id: '3D3',
    key: 'neon-dna-hoverboard',
    title: 'DNA Hover',
    image: 'generated/3d-neon/neon-dna-hoverboard.png',
    generated: true,
    label: 'Hover pulse',
    motion: 'hoverboard',
    line: 'Rides through weak topics smoothly.',
  },
  {
    id: '3D4',
    key: 'neon-tablet-doctor',
    title: 'Chart Doctor',
    image: 'generated/3d-neon/neon-tablet-doctor.png',
    generated: true,
    label: 'Chart rise',
    motion: 'chart',
    line: 'Tiny doctor says numbers look better.',
    indigo: true,
  },
  {
    id: '3D5',
    key: 'neon-exam-shield',
    title: 'Exam Shield',
    image: 'generated/3d-neon/neon-exam-shield.png',
    generated: true,
    label: 'Shield flash',
    motion: 'shield-spark',
    line: 'Blocks panic with multicolor confidence.',
  },
];

const labHeroCards = heroCards.filter((card) => !['Hero 4', 'Hero 6'].includes(card.label));
const labElementMascots = elementMascots.filter((card) => card.id !== 'E1');
const labVibeMascots = vibeMascots.filter((card) => !['V1', 'V2', 'V3'].includes(card.id));
const labTwoDMascots = twoDMascots.filter((card) => !['2D2', '2D4'].includes(card.id));
const labNeon3DMascots = neon3DMascots.filter((card) => !['3D1', '3D2', '3D3', '3D4'].includes(card.id));

function HeroMascotCard({ card, index }) {
  const imageSrc = mascotImagePath(card);

  return (
    <article className={`hero-mascot-card hero-mascot-card--${card.key}`} style={{ '--hero-order': index }}>
      <div className="hero-mascot-card__copy">
        <span className={card.warm ? 'hero-mascot-card__label is-warm' : 'hero-mascot-card__label'}>{card.label}</span>
        <h2>{card.title}</h2>
        <p>{card.line}</p>
        <strong>{card.badge}</strong>
      </div>
      <div className="hero-mascot-card__stage" aria-hidden="true">
        <span className="hero-mascot-card__orb hero-mascot-card__orb--one" />
        <span className="hero-mascot-card__orb hero-mascot-card__orb--two" />
        <span className="hero-mascot-card__spark hero-mascot-card__spark--one" />
        <span className="hero-mascot-card__spark hero-mascot-card__spark--two" />
        <span className="hero-mascot-card__rig">
          <img className="hero-mascot-card__image" src={imageSrc} alt="" draggable="false" />
        </span>
      </div>
    </article>
  );
}

function ElementMascotCard({ card, index }) {
  const imageSrc = mascotImagePath(card);
  const numberClassName = [
    'element-mascot-card__number',
    card.warm ? 'is-warm' : '',
    card.indigo ? 'is-indigo' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={`element-mascot-card element-mascot-card--${card.key}`} style={{ '--element-order': index }}>
      <div className="element-mascot-card__top">
        <span className={numberClassName}>{card.id}</span>
        <div>
          <h2>{card.title}</h2>
          <strong>{card.label}</strong>
        </div>
      </div>
      <div className="element-mascot-card__stage" aria-hidden="true">
        <span className="element-mascot-card__fx element-mascot-card__fx--one" />
        <span className="element-mascot-card__fx element-mascot-card__fx--two" />
        <span className="element-mascot-card__rig">
          <img className="element-mascot-card__image" src={imageSrc} alt="" draggable="false" />
          <span className={`element-mascot-card__motion element-mascot-card__motion--${card.motion}`}>
            <span />
            <span />
            <span />
          </span>
        </span>
      </div>
      <p>{card.line}</p>
    </article>
  );
}

function MascotCard({ card, index }) {
  const imageSrc = mascotImagePath(card);
  const accentIndex = card.line.indexOf(card.accent);
  const beforeAccent = accentIndex >= 0 ? card.line.slice(0, accentIndex) : card.line;
  const afterAccent = accentIndex >= 0 ? card.line.slice(accentIndex + card.accent.length) : '';
  const accentPunctuation = afterAccent.match(/^[.?!]+/)?.[0] || '';
  const afterAccentText = afterAccent.slice(accentPunctuation.length);

  return (
    <article className={`mascot-card mascot-card--${card.key}`} style={{ '--mascot-order': index }}>
      <div className="mascot-card__top">
        <span className={card.warm ? 'mascot-card__number is-warm' : 'mascot-card__number'}>{card.id}</span>
        <h2>{card.title}</h2>
      </div>
      <div className="mascot-card__stage" aria-hidden="true">
        <span className="mascot-card__fx mascot-card__fx--one" />
        <span className="mascot-card__fx mascot-card__fx--two" />
        <span className="mascot-card__rig">
          <img className="mascot-card__image" src={imageSrc} alt="" draggable="false" />
        </span>
      </div>
      <p>
        <span className="mascot-card__caption-text">
        {beforeAccent}
        {accentIndex >= 0 ? <strong>{card.accent}{accentPunctuation}</strong> : null}
        {afterAccentText}
        </span>
      </p>
    </article>
  );
}

export function MascotAnimationLabPage() {
  useEffect(() => {
    clearServerNotResponding();
  }, []);

  return (
    <main className="mascot-lab-page">
      <section className="mascot-lab-hero">
        <div className="mascot-lab-hero__title">
          <span>Temporary test page</span>
          <h1>Fun animation ideas</h1>
          <p>Source-image mascot crops with motion loops for quick visual checking.</p>
        </div>
        <div className="mascot-lab-hero__buddy">
          <div>
            <span>Meet</span>
            <strong>STETHO</strong>
            <p>Your study buddy animation sample.</p>
          </div>
          <img src={`${mascotBase}correct-stetho-cutout.png`} alt="" draggable="false" />
        </div>
      </section>

      <section className="hero-mascot-section" aria-label="Dashboard hero mascot previews">
        <div className="hero-mascot-section__title">
          <span>Dashboard hero mascots</span>
          <h2>Use one mascot only</h2>
          <p>Dashboard-specific mascot options listed like the normal animation samples.</p>
        </div>
        <div className="mascot-lab-grid mascot-lab-grid--dashboard">
          {dashboardMascotCards.map((card, index) => (
            <MascotCard key={card.key} card={card} index={index} />
          ))}
        </div>
      </section>

      <section className="hero-mascot-section" aria-label="Body part mascot animation previews">
        <div className="hero-mascot-section__title">
          <span>Single element mascots</span>
          <h2>Body parts move only</h2>
          <p>The selected dashboard mascot pick was moved out of this lab list.</p>
        </div>
        <div className="element-mascot-grid">
          {labElementMascots.map((card, index) => (
            <ElementMascotCard key={card.key} card={card} index={index} />
          ))}
        </div>
      </section>

      <section className="hero-mascot-section" aria-label="Blue cyan indigo funny mascot animation previews">
        <div className="hero-mascot-section__title">
          <span>Blue cyan indigo</span>
          <h2>Remaining funny mascots</h2>
          <p>The selected dashboard mascot picks were moved out of this lab list.</p>
        </div>
        <div className="element-mascot-grid">
          {labVibeMascots.map((card, index) => (
            <ElementMascotCard key={card.key} card={card} index={index} />
          ))}
        </div>
      </section>

      <section className="hero-mascot-section hero-mascot-section--neon-blue hero-mascot-section--neon-dashboard" aria-label="3D neon dashboard mascot animation previews">
        <div className="hero-mascot-section__title">
          <span>3D neon dashboard mascots</span>
          <h2>Remaining hero-card vibe</h2>
          <p>The main 3D dashboard picks now rotate inside the dashboard hero card.</p>
        </div>
        <div className="element-mascot-grid">
          {labNeon3DMascots.map((card, index) => (
            <ElementMascotCard key={card.key} card={card} index={index} />
          ))}
        </div>
      </section>

      <section className="hero-mascot-section hero-mascot-section--neon-blue" aria-label="Creative 2D mascot animation previews">
        <div className="hero-mascot-section__title">
          <span>Neon blue 2D mascots</span>
          <h2>Electric sticker motion set</h2>
          <p>The selected 2D dashboard picks were moved out of this lab list.</p>
        </div>
        <div className="element-mascot-grid">
          {labTwoDMascots.map((card, index) => (
            <ElementMascotCard key={card.key} card={card} index={index} />
          ))}
        </div>
      </section>

      <section className="hero-mascot-section" aria-label="Hero card mascot animation previews">
        <div className="hero-mascot-section__title">
          <span>Hero card animations</span>
          <h2>Pick a hero motion style</h2>
          <p>The selected hero mascots now rotate inside the dashboard hero card.</p>
        </div>
        <div className="hero-mascot-grid">
          {labHeroCards.map((card, index) => (
            <HeroMascotCard key={card.key} card={card} index={index} />
          ))}
        </div>
      </section>

      <section className="mascot-lab-grid" aria-label="Mascot animation previews">
        {mascotCards.map((card, index) => (
          <MascotCard key={card.key} card={card} index={index} />
        ))}
      </section>
    </main>
  );
}
