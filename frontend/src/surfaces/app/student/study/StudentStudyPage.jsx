import { NavLink } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { preloadRouteByPath } from '../../../../app/routePreloading.js';
import './StudentStudyPage.css';

const studyItems = [
  {
    to: '/app/notes',
    preload: '/notes',
    label: 'Notes',
    eyebrow: 'Notebook',
    description: 'Open AI notes and your study canvas.',
    tone: 'notes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3.5H17C18.1 3.5 19 4.4 19 5.5V18.5C19 19.6 18.1 20.5 17 20.5H7C5.9 20.5 5 19.6 5 18.5V5.5C5 4.4 5.9 3.5 7 3.5Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.5 9H15.5M8.5 12.5H15.5M8.5 16H12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/app/ai-notes',
    preload: '/ai-notes',
    label: 'AI Notes',
    eyebrow: 'Smart notes',
    description: 'Generate and revise AI-powered study notes.',
    tone: 'ai-notes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.5L13.6 8.4L18.5 10L13.6 11.6L12 16.5L10.4 11.6L5.5 10L10.4 8.4L12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M18 16.5L18.7 18.3L20.5 19L18.7 19.7L18 21.5L17.3 19.7L15.5 19L17.3 18.3L18 16.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/app/flashcards',
    preload: '/flashcards',
    label: 'Flashcards',
    eyebrow: 'Recall',
    description: 'Review flashcards and reinforce what you learn.',
    tone: 'flashcards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7.5C4 6.4 4.9 5.5 6 5.5H15C16.1 5.5 17 6.4 17 7.5V14.5C17 15.6 16.1 16.5 15 16.5H6C4.9 16.5 4 15.6 4 14.5V7.5Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 9.5V18.5C8 19.6 8.9 20.5 10 20.5H18C19.1 20.5 20 19.6 20 18.5V11.5C20 10.4 19.1 9.5 18 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/app/planner',
    preload: '/planner',
    label: 'Planner',
    eyebrow: 'Schedule',
    description: 'Plan study sessions and track your goals.',
    tone: 'planner',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 6.5H19C19.6 6.5 20 6.9 20 7.5V19C20 19.6 19.6 20 19 20H5C4.4 20 4 19.6 4 19V7.5C4 6.9 4.4 6.5 5 6.5Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4 10H20M8 4V8M16 4V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 14L10.5 16L14.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function StudentStudyPage() {
  return (
    <main className="dashboard-page study-hub-page student-study-page">
      <div className="study-hub-shell student-study-shell">
        <AppHeader title="Study" subtitle="AI notes and study canvas" />

        <section className="student-study-hero" aria-labelledby="student-study-title">
          <span className="student-study-hero__eyebrow">Study tools</span>
          <h1 id="student-study-title">Open your study canvas</h1>
          <p>Jump straight into your AI notes and study canvas.</p>
        </section>

        <section className="student-study-grid" aria-label="Study shortcuts">
          {studyItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={`student-study-card is-${item.tone}`}
              onPointerDown={() => preloadRouteByPath(item.preload, 'student')}
              onTouchStart={() => preloadRouteByPath(item.preload, 'student')}
              onFocus={() => preloadRouteByPath(item.preload, 'student')}
            >
              <span className="student-study-card__icon">{item.icon}</span>
              <span className="student-study-card__copy">
                <span>{item.eyebrow}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          ))}
        </section>
      </div>
    </main>
  );
}
