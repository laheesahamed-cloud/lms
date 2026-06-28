import { NavLink } from 'react-router-dom';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { preloadRouteByPath } from '../../../../app/routePreloading.js';
import './StudentStudyPage.css';

const studyItems = [
  {
    to: '/app/lessons',
    preload: '/lessons',
    label: 'Lessons',
    eyebrow: 'Learn',
    description: 'Browse your courses and open their lessons.',
    tone: 'lessons',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 5.5C5 4.7 5.7 4 6.5 4H18.5C19.3 4 20 4.7 20 5.5V18.5C20 19.3 19.3 20 18.5 20H6.5C5.7 20 5 19.3 5 18.5V5.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8.5 8.5H16.5M8.5 12H16.5M8.5 15.5H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  {
    to: '/app/bookmarks',
    preload: '/bookmarks',
    label: 'Saved',
    eyebrow: 'Bookmarks',
    description: 'Your saved notes, questions, quizzes and exams.',
    tone: 'bookmarks',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 4.5h11c.55 0 1 .45 1 1v14.2c0 .4-.45.64-.8.43L12 16.7l-5.7 3.43c-.35.21-.8-.03-.8-.43V5.5c0-.55.45-1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/app/drugs',
    preload: '/drugs',
    label: 'Drug Randomizer',
    eyebrow: 'Pharmacology',
    description: 'Spin for a random drug, answer a quiz, see the full drug card.',
    tone: 'drugs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export function StudentStudyPage() {
  return (
    <main className="dashboard-page study-hub-page student-study-page">
      <div className="study-hub-shell student-study-shell">
        <AppHeader title="Study" subtitle="AI notes and study canvas" />

        <nav className="student-study-card-stack" aria-label="Study shortcuts">
          {studyItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={`student-study-row is-${item.tone}`}
              onPointerDown={() => preloadRouteByPath(item.preload, 'student')}
              onTouchStart={() => preloadRouteByPath(item.preload, 'student')}
              onFocus={() => preloadRouteByPath(item.preload, 'student')}
            >
              <span className="student-study-row__icon">{item.icon}</span>
              <span className="student-study-row__copy">
                <span>{item.eyebrow}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <svg className="student-study-row__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </NavLink>
          ))}
        </nav>
      </div>
    </main>
  );
}
