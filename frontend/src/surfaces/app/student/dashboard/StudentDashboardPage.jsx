import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentDashboard } from '../../../../shared/api/dashboard.api.js';
import { listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchStudentQuizzes } from '../../../../shared/api/quizAttempts.api.js';
import { fetchStudyBookmarks } from '../../../../shared/api/studyBookmarks.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { ImpactStyle, nativeImpact, nativeSuccess, webVibrate } from '../../../../shared/utils/nativeHaptics.js';

const defaultDashboardState = {
  totalQuizzes: 0,
  totalAttempts: 0,
  avgScore: 0,
  totalPassed: 0,
  passRate: 0,
  quizDayStreak: 0,
  dailyGoalsCompleted: 0,
  recentAttempts: [],
  weakTopics: [],
  strongTopics: [],
  topicMastery: [],
  missedPatterns: [],
  dailyGoals: [],
  adaptivePlan: [],
  questionOfDay: null,
  performanceSnapshot: {
    readinessScore: 0,
    readinessLabel: 'Baseline not set',
    weeklyAttempts: 0,
    weeklyAverage: 0,
    previousWeeklyAverage: 0,
    scoreDelta: 0,
    scoreTrend: 'empty',
    trendLabel: 'No exam activity yet',
    consistencyLabel: 'Start today',
  },
};

function normalizeDashboardState(data) {
  const source = data && typeof data === 'object' ? data : {};
  return {
    ...defaultDashboardState,
    ...source,
    recentAttempts: Array.isArray(source.recentAttempts) ? source.recentAttempts : [],
    weakTopics: Array.isArray(source.weakTopics) ? source.weakTopics : [],
    strongTopics: Array.isArray(source.strongTopics) ? source.strongTopics : [],
    topicMastery: Array.isArray(source.topicMastery) ? source.topicMastery : [],
    missedPatterns: Array.isArray(source.missedPatterns) ? source.missedPatterns : [],
    dailyGoals: Array.isArray(source.dailyGoals) ? source.dailyGoals : [],
    adaptivePlan: Array.isArray(source.adaptivePlan) ? source.adaptivePlan : [],
    performanceSnapshot: {
      ...defaultDashboardState.performanceSnapshot,
      ...(source.performanceSnapshot && typeof source.performanceSnapshot === 'object'
        ? source.performanceSnapshot
        : {}),
    },
  };
}

function runWhenIdle(task) {
  if (typeof window === 'undefined') {
    task();
    return () => {};
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(task, 260);
  return () => window.clearTimeout(timer);
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function plural(value, singular, pluralLabel = `${singular}s`) {
  return `${value} ${Number(value) === 1 ? singular : pluralLabel}`;
}

function formatDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getFirstName(user) {
  const source = user?.fullName || user?.name || user?.email || '';
  const name = String(source).trim().split(/\s+/)[0];
  if (!name || name.includes('@')) return 'there';
  return name;
}

function getQuizId(quiz) {
  return quiz?.id || quiz?.quizId || quiz?.quiz?.id || null;
}

function getAttemptId(attempt) {
  return attempt?.id || attempt?.attemptId || null;
}

function getTopicLabel(item, fallback = 'General medicine') {
  const course = item?.courseTitle || item?.courseName || '';
  const topic = item?.topicName || item?.title || '';
  if (course && topic) return `${course} / ${topic}`;
  return course || topic || fallback;
}

function getQuizTitle(quiz, fallback = 'Focused exam') {
  return quiz?.studentTitle || quiz?.quizTitle || quiz?.title || fallback;
}

function getStudyMood({ attempts, readinessScore, streak }) {
  if (readinessScore >= 80) {
    return {
      label: 'Confidence level',
      value: 'Clinically dramatic',
      text: 'Your dashboard is wearing a tiny white coat today.',
      meter: 92,
    };
  }
  if (streak >= 5) {
    return {
      label: 'Streak energy',
      value: 'Suspiciously consistent',
      text: 'Five-plus active days. The syllabus is starting to look nervous.',
      meter: 84,
    };
  }
  if (attempts >= 3) {
    return {
      label: 'Practice mood',
      value: 'Many tabs, one dream',
      text: 'You have been attempting things. Academically, that is a personality trait.',
      meter: 72,
    };
  }
  if (readinessScore > 0) {
    return {
      label: 'Brain status',
      value: 'Loading nicely',
      text: 'Not fully charged yet, but the neurons have clocked in.',
      meter: Math.max(38, readinessScore),
    };
  }
  return {
    label: 'Dashboard verdict',
    value: 'Emotionally prepared',
    text: 'Opening the Study Hub counts as a warm-up set. We take those.',
    meter: 34,
  };
}

function appRoute(path) {
  return `/app${path}`;
}

function Icon({ name }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' };
  if (name === 'menu') {
    return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  if (name === 'search') {
    return <svg {...common}><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  if (name === 'play') {
    return <svg {...common}><path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" /></svg>;
  }
  if (name === 'book') {
    return <svg {...common}><path d="M5.5 4.5h6A2.5 2.5 0 0 1 14 7v12H7.5a2 2 0 0 1-2-2V4.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M14 7a2.5 2.5 0 0 1 2.5-2.5H18V19h-4" stroke="currentColor" strokeWidth="1.8" /><path d="M8 9.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'doc') {
    return <svg {...common}><path d="M6.5 3.5h7.2l3.8 3.8v13.2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" /><path d="M13.5 3.5v4h4M8.5 12h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'review') {
    return <svg {...common}><path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v13A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M9 10h6M9 14h4M9 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9.5 3h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'thumb') {
    return <svg {...common} fill="currentColor"><path d="M1.5 21h4V9h-4v12Zm21-11c0-1.1-.9-2-2-2h-6.28l.95-4.56.03-.32c0-.42-.17-.8-.44-1.07L13.7 1 7.1 7.6c-.37.36-.6.86-.6 1.4v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.85-1.22l3-7.05c.1-.23.15-.48.15-.73v-2Z" /></svg>;
  }
  if (name === 'chart') {
    return <svg {...common}><path d="M5 19V5M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 15v-4M13 15V8M17 15v-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
  }
  if (name === 'target') {
    return <svg {...common}><circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'spark') {
    return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z" fill="currentColor" /></svg>;
  }
  if (name === 'flame') {
    return (
      <svg {...common} className="study-fire-svg" viewBox="0 0 24 24">
        <path className="study-fire-outer" d="M12 2.8s5.7 4.8 5.7 10.4a5.7 5.7 0 0 1-11.4 0c0-2.4 1.25-3.8 1.25-3.8s0 2.4 1.82 2.4C11.3 11.8 8.58 8.38 12 2.8Z" fill="currentColor" />
        <path className="study-fire-inner" d="M12.05 11.1s2.35 2.05 2.35 4.15a2.42 2.42 0 0 1-4.84 0c0-1.02.5-1.72.5-1.72s.26.9 1.02.9c.92 0-.38-1.55.97-3.33Z" fill="rgba(255, 238, 170, 0.96)" />
      </svg>
    );
  }
  if (name === 'cap') {
    return <svg {...common}><path d="m3.5 9 8.5-4 8.5 4-8.5 4-8.5-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M7.5 11v4.2c0 1.6 2 2.8 4.5 2.8s4.5-1.2 4.5-2.8V11M19.5 10v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }
  if (name === 'stetho') {
    return <svg {...common}><path d="M6 4v6a4 4 0 0 0 8 0V4M5 4h2M13 4h2M10 14v3a4 4 0 0 0 8 0v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="18" cy="13" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (name === 'arrow') {
    return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return <svg {...common}><path d="M12 3v18M4.2 7.5h15.6M4.2 16.5h15.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M7.5 4.5c2.4 2.4 2.4 12.6 0 15M16.5 4.5c-2.4 2.4-2.4 12.6 0 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/* ── Hero motif library ─────────────────────────────────────────
   Five SVG decorations that bloom inside the hero card. The dashboard
   picks one at random on mount, so every visit feels fresh. Every
   motif uses currentColor so light/dark/accent flip automatically.
   ────────────────────────────────────────────────────────────── */

const HERO_MOTIFS = ['sonar', 'dna', 'caduceus', 'aurora', 'ekg'];

function pickHeroMotif() {
  return HERO_MOTIFS[Math.floor(Math.random() * HERO_MOTIFS.length)];
}

function HeroMotif({ variant }) {
  if (variant === 'sonar') {
    return (
      <span className="study-hero-motif study-hero-motif--sonar" aria-hidden="true">
        <span className="study-hero-sonar-ring" />
        <span className="study-hero-sonar-ring" />
        <span className="study-hero-sonar-ring" />
      </span>
    );
  }
  if (variant === 'dna') {
    return (
      <svg className="study-hero-motif study-hero-motif--dna" viewBox="0 0 80 120" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path className="study-hero-dna-strand" d="M14 10 Q40 30 14 50 Q-12 70 14 90 Q40 110 14 130" />
          <path className="study-hero-dna-strand study-hero-dna-strand--b" d="M66 10 Q40 30 66 50 Q92 70 66 90 Q40 110 66 130" />
          <line x1="20" y1="20" x2="60" y2="20" />
          <line x1="14" y1="32" x2="66" y2="32" />
          <line x1="20" y1="44" x2="60" y2="44" />
          <line x1="14" y1="58" x2="66" y2="58" />
          <line x1="20" y1="70" x2="60" y2="70" />
          <line x1="14" y1="84" x2="66" y2="84" />
          <line x1="20" y1="96" x2="60" y2="96" />
        </g>
      </svg>
    );
  }
  if (variant === 'caduceus') {
    return (
      <svg className="study-hero-motif study-hero-motif--caduceus" viewBox="0 0 200 200" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="100" y1="20" x2="100" y2="180" />
          <path d="M70 40 Q100 60 130 80 Q100 100 70 120 Q100 140 130 160" />
          <path d="M130 40 Q100 60 70 80 Q100 100 130 120 Q100 140 70 160" />
          <path d="M80 30 Q100 12 120 30" />
          <path d="M76 38 Q66 28 56 30" />
          <path d="M124 38 Q134 28 144 30" />
        </g>
      </svg>
    );
  }
  if (variant === 'aurora') {
    return (
      <span className="study-hero-motif study-hero-motif--aurora" aria-hidden="true">
        <span className="study-hero-aurora-band" />
        <span className="study-hero-aurora-band study-hero-aurora-band--b" />
      </span>
    );
  }
  if (variant === 'ekg') {
    return (
      <svg className="study-hero-motif study-hero-motif--ekg" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="study-hero-ekg-trace"
          d="M0 40 L60 40 L80 40 L92 38 L100 42 L108 12 L120 68 L132 28 L144 40 L200 40 L220 40 L232 36 L242 44 L252 14 L264 64 L276 30 L288 40 L400 40"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return null;
}

/* Floating dust particles — dark mode atmospheric layer ────────── */
function DashboardDustLayer() {
  const particles = [
    { left: '8%',  delay: 0,    duration: 14 },
    { left: '18%', delay: 3.2,  duration: 16 },
    { left: '28%', delay: 6.4,  duration: 13 },
    { left: '38%', delay: 1.8,  duration: 17 },
    { left: '48%', delay: 8.1,  duration: 15 },
    { left: '58%', delay: 4.4,  duration: 14 },
    { left: '68%', delay: 11,   duration: 18 },
    { left: '78%', delay: 7.3,  duration: 12 },
    { left: '88%', delay: 2.5,  duration: 16 },
    { left: '95%', delay: 9.6,  duration: 14 },
  ];
  return (
    <div className="study-dust-layer" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="study-dust-particle"
          style={{
            left: p.left,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* SVG empty-state illustration for the Question of the Day card ── */
function QuestionEmptyIllustration() {
  return (
    <svg className="study-question-empty-art" viewBox="0 0 120 96" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 78 L20 70 L20 30 L60 38 Z" />
        <path d="M60 78 L100 70 L100 30 L60 38 Z" />
        <path d="M60 38 L60 78" />
        <path d="M28 42 L46 45" />
        <path d="M28 52 L46 55" />
        <path d="M28 62 L42 64" />
        <path d="M74 42 L92 39" />
        <path d="M74 52 L92 49" />
        <path d="M74 62 L88 60" />
        <path d="M60 22 L60 30 M55 25 L65 27 M55 19 L52 17 M65 19 L68 17 M50 22 L48 25 M70 22 L72 25" strokeWidth="1.4" />
        <circle cx="60" cy="14" r="2.4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

function StethoscopeMark() {
  return (
    <svg className="study-hero-mark" viewBox="0 0 180 180" role="img" aria-label="Study progress illustration">
      <defs>
        <linearGradient id="study-hero-mark-gradient" x1="22" y1="26" x2="152" y2="154" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r="78" fill="rgba(56,189,248,0.15)" />
      <path d="M56 43v35c0 18 14 32 32 32s32-14 32-32V43" stroke="url(#study-hero-mark-gradient)" strokeWidth="12" strokeLinecap="round" />
      <path d="M88 110v12c0 16 13 29 29 29s29-13 29-29v-12" stroke="#060c1a" strokeWidth="12" strokeLinecap="round" />
      <circle cx="146" cy="105" r="16" fill="#ffffff" stroke="#060c1a" strokeWidth="9" />
      <circle cx="56" cy="43" r="10" fill="#ffffff" />
      <circle cx="120" cy="43" r="10" fill="#ffffff" />
    </svg>
  );
}

function StudyButton({ children, tone = 'primary', icon = null, onClick }) {
  return (
    <button type="button" className={`study-button study-button--${tone}`} onClick={onClick}>
      <span>{children}</span>
      {icon ? <Icon name={icon} /> : null}
    </button>
  );
}

function MetricCard({ label, value, hint, icon, tone, progress = null }) {
  return (
    <article className={`study-metric study-metric--${tone}`}>
      <span className="study-metric__icon"><Icon name={icon} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <p>{hint}</p>
      </div>
      {progress !== null ? (
        <div className="study-mini-rail" aria-hidden="true">
          <span style={{ width: `${clampPercent(progress)}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function StreakHeatmap({ streak, goalsCompleted }) {
  const activeCells = Math.min(28, Math.max(Number(streak || 0), Number(goalsCompleted || 0)));
  return (
    <div className="study-heatmap" aria-label={`${activeCells} active study days`}>
      {Array.from({ length: 28 }).map((_, index) => {
        const active = index >= 28 - activeCells;
        const intensity = active ? ((index + activeCells) % 3) + 1 : 0;
        return <span className={`study-heatmap__cell is-${intensity}`} key={index} />;
      })}
    </div>
  );
}

function ScoreTrend({ attempts, average }) {
  const values = attempts.length
    ? attempts.slice(0, 7).reverse().map((attempt) => clampPercent(attempt.percentage))
    : [Math.max(18, clampPercent(average) - 16), clampPercent(average), Math.min(100, clampPercent(average) + 10)];
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 92 - (value * 0.72);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="study-score-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 82H100" stroke="rgba(20,28,64,0.08)" strokeWidth="1" />
      <path d="M0 54H100" stroke="rgba(20,28,64,0.08)" strokeWidth="1" />
      <path d="M0 26H100" stroke="rgba(20,28,64,0.08)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#3d5afe" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TopicList({ title, items, emptyText, tone }) {
  return (
    <section className="study-card study-topic-card">
      <div className="study-card__head">
        <div>
          <span className="study-eyebrow">{title}</span>
          <h2>{tone === 'strong' ? 'Strong areas' : 'Focus areas'}</h2>
        </div>
        <span className={`study-soft-icon study-soft-icon--${tone}`}><Icon name={tone === 'strong' ? 'spark' : 'target'} /></span>
      </div>
      <div className="study-topic-list">
        {items.length ? items.slice(0, 4).map((item, index) => (
          <button
            type="button"
            className="study-topic-row"
            key={`${item.courseTitle || 'course'}-${item.topicName || item.title || index}`}
          >
            <span className={`study-topic-dot study-topic-dot--${tone}`} />
            <span>
              <strong>{item.topicName || item.title || 'Untitled topic'}</strong>
              <small>{item.courseTitle || item.courseName || 'General course'}</small>
            </span>
            <em>{clampPercent(item.averagePercentage || item.score || item.masteryScore)}%</em>
          </button>
        )) : (
          <p className="study-empty-copy">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function DailyQuestionCard({ question }) {
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);

  useEffect(() => {
    setSelectedOptionId(null);
    setAnswerFeedback(null);
  }, [question?.id]);

  if (!question?.questionText || !Array.isArray(question.options) || question.options.length === 0) {
    return (
      <section className="study-card study-question-card">
        <div className="study-card__head">
          <div>
            <span className="study-eyebrow">Question of the day</span>
            <h2>SBA practice</h2>
          </div>
          <span className="study-soft-icon study-soft-icon--indigo"><Icon name="review" /></span>
        </div>
        <div className="study-question-empty">
          <QuestionEmptyIllustration />
          <p>A random SBA will appear here once active questions are added to the bank.</p>
        </div>
      </section>
    );
  }

  const revealAnswer = selectedOptionId !== null;

  const triggerAnswerFeedback = (option) => {
    const isCorrect = Boolean(option.isCorrect);
    setSelectedOptionId(option.id);

    if (isCorrect) {
      void nativeSuccess();
    } else {
      webVibrate([24, 28, 24]);
      void nativeImpact(ImpactStyle.Medium);
    }

    const replayFeedback = () => {
      setAnswerFeedback({
        optionId: option.id,
        type: isCorrect ? 'correct' : 'wrong',
        id: `${option.id}-${Date.now()}`,
      });
    };

    setAnswerFeedback(null);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(replayFeedback);
    } else {
      replayFeedback();
    }
  };

  return (
    <section className="study-card study-question-card">
      <div className="study-card__head">
        <div>
          <span className="study-eyebrow">Question of the day</span>
          <h2>{question.topicName || question.subjectName || question.courseTitle || 'Question bank'}</h2>
        </div>
        <span className="study-soft-icon study-soft-icon--indigo"><Icon name="review" /></span>
      </div>
      <p className="study-question-text">{question.questionText}</p>
      <div className="study-answer-list" role="list" aria-label="Question answers">
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          const isCorrect = Boolean(option.isCorrect);
          const answerStateClass = [
            revealAnswer
              ? isCorrect
                ? 'is-correct'
                : 'is-wrong'
              : '',
            isSelected ? 'is-selected' : '',
            answerFeedback?.type === 'wrong' && answerFeedback.optionId === option.id ? 'is-shaking' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              type="button"
              className={`study-answer-option ${answerStateClass}`}
              key={option.id}
              onClick={() => triggerAnswerFeedback(option)}
            >
              <span>{option.optionLabel}</span>
              <strong>{option.optionText}</strong>
              {answerFeedback?.type === 'correct' && answerFeedback.optionId === option.id ? (
                <span className="study-correct-burst" key={answerFeedback.id} aria-hidden="true">
                  <Icon name="thumb" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StudyMoodCard({ mood, todayLabel }) {
  return (
    <section className="study-card study-mood-card" aria-label="Study mood">
      <span className="study-mood-orbit" aria-hidden="true" />
      <div className="study-mood-main">
        <span className="study-soft-icon study-soft-icon--cyan"><Icon name="spark" /></span>
        <div>
          <span className="study-eyebrow">{mood.label}</span>
          <strong>{mood.value}</strong>
        </div>
      </div>
      <p>{mood.text}</p>
      <div className="study-mood-meter" aria-label={`${mood.value}: ${mood.meter}%`}>
        <span style={{ width: `${clampPercent(mood.meter)}%` }} />
      </div>
      <small>{todayLabel} mood check</small>
    </section>
  );
}

function StudyTodoCard({ todo, onOpen }) {
  return (
    <section className="study-card study-todo-card" aria-label="Today todo">
      <div className="study-todo-copy">
        <span className="study-eyebrow">{todo.eyebrow}</span>
        <strong>{todo.title}</strong>
        <small>{todo.text}</small>
      </div>
      <button type="button" className="study-todo-action" onClick={onOpen}>
        {todo.actionLabel}
      </button>
    </section>
  );
}

export function StudentDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState(defaultDashboardState);
  const [studentQuizzes, setStudentQuizzes] = useState([]);
  const [aiNotes, setAiNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [heroMotif] = useState(pickHeroMotif);

  useEffect(() => {
    let cancelled = false;
    let cancelSecondary = () => {};
    setLoading(true);
    setError('');

    async function loadDashboard() {
      try {
        const [data, quizzes] = await Promise.all([
          fetchStudentDashboard(),
          fetchStudentQuizzes().catch(() => []),
        ]);
        if (cancelled) return;
        setDashboard(normalizeDashboardState(data));
        setStudentQuizzes(Array.isArray(quizzes) ? quizzes : []);
        cancelSecondary = runWhenIdle(async () => {
          const [notes, savedItems] = await Promise.all([
            listAiNotes().catch(() => []),
            fetchStudyBookmarks().catch(() => []),
          ]);
          if (cancelled) return;
          setAiNotes(Array.isArray(notes) ? notes : []);
          setBookmarks(Array.isArray(savedItems) ? savedItems : []);
        });
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'Unable to load dashboard'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
      cancelSecondary();
    };
  }, [reloadKey, user?.id, user?.role, user?.status]);

  const firstName = getFirstName(user);
  const todayLabel = formatDateLabel();
  const inProgressQuiz = useMemo(
    () => studentQuizzes.find((quiz) => quiz.practiceSessionId),
    [studentQuizzes]
  );
  const latestAttempt = dashboard.recentAttempts[0] || null;
  const latestAttemptId = getAttemptId(latestAttempt);
  const weakTopic = dashboard.weakTopics[0] || null;
  const recommendedQuiz = useMemo(() => {
    if (!studentQuizzes.length) return null;
    if (inProgressQuiz) return inProgressQuiz;
    if (weakTopic) {
      const match = studentQuizzes.find((quiz) =>
        String(quiz.courseTitle || '') === String(weakTopic.courseTitle || '') &&
        String(quiz.topicName || '') === String(weakTopic.topicName || '')
      );
      if (match) return match;
    }
    return studentQuizzes.find((quiz) => !quiz.isCompleted && !quiz.completed) || studentQuizzes[0];
  }, [inProgressQuiz, studentQuizzes, weakTopic]);
  const recommendedNote = useMemo(() => {
    if (!aiNotes.length) return null;
    if (!weakTopic) return aiNotes[0];
    return aiNotes.find((note) =>
      String(note.courseTitle || '') === String(weakTopic.courseTitle || '') &&
      String(note.topicName || '') === String(weakTopic.topicName || '')
    ) || aiNotes[0];
  }, [aiNotes, weakTopic]);

  const readinessScore = clampPercent(dashboard.performanceSnapshot?.readinessScore || dashboard.avgScore);
  const scoreDelta = Number(dashboard.performanceSnapshot?.scoreDelta || 0);
  const studyMood = getStudyMood({
    attempts: dashboard.totalAttempts,
    readinessScore,
    streak: dashboard.quizDayStreak,
  });
  const nextQuizId = getQuizId(recommendedQuiz);
  const continueTarget = inProgressQuiz && getQuizId(inProgressQuiz)
    ? appRoute(`/quizzes/${getQuizId(inProgressQuiz)}?mode=practice`)
    : nextQuizId
      ? appRoute(`/quizzes/${nextQuizId}`)
      : recommendedNote?.id
        ? appRoute(`/ai-notes/${recommendedNote.id}`)
        : appRoute('/quizzes');
  const continueLabel = inProgressQuiz ? 'Resume practice' : nextQuizId ? 'Start practice' : recommendedNote?.id ? 'Review lesson' : 'Open quizzes';
  const continueTitle = inProgressQuiz || recommendedQuiz
    ? getQuizTitle(inProgressQuiz || recommendedQuiz)
    : recommendedNote?.title || 'Build today\'s study rhythm';
  const continueText = inProgressQuiz
    ? `Next question ${Number(inProgressQuiz.lastQuestionIndex || 0) + 1}. Keep the set moving while it is fresh.`
    : weakTopic
      ? `${weakTopic.topicName} is the best place to gain marks today.`
      : latestAttempt
        ? `Your last attempt scored ${clampPercent(latestAttempt.percentage)}%. Review once, then try another focused set.`
        : 'Start with one compact practice set, review the answers, and finish with one lesson.';

  const metrics = [
    {
      label: 'Quizzes',
      value: studentQuizzes.length || dashboard.totalQuizzes,
      hint: 'Available sets',
      icon: 'book',
      tone: 'indigo',
    },
    {
      label: 'Attempts',
      value: dashboard.totalAttempts,
      hint: `${dashboard.totalPassed} passed`,
      icon: 'review',
      tone: 'cyan',
    },
    {
      label: 'Average',
      value: `${clampPercent(dashboard.avgScore)}%`,
      hint: scoreDelta ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta}% this week` : 'Current score',
      icon: 'chart',
      tone: 'violet',
      progress: dashboard.avgScore,
    },
    {
      label: 'Streak',
      value: dashboard.quizDayStreak,
      hint: plural(dashboard.quizDayStreak, 'active day'),
      icon: 'spark',
      tone: 'amber',
    },
  ];

  const quickActions = [
    {
      label: latestAttemptId ? 'Review answers' : 'Results',
      hint: latestAttemptId ? 'Open latest explanations' : 'View attempt history',
      icon: 'review',
      count: dashboard.recentAttempts.length || dashboard.totalAttempts || 0,
      onClick: () => navigate(latestAttemptId ? appRoute(`/review/${latestAttemptId}`) : appRoute('/results')),
    },
    {
      label: inProgressQuiz ? 'Resume set' : 'Practice',
      hint: inProgressQuiz ? 'Continue active quiz' : 'Start focused exam',
      icon: 'play',
      count: inProgressQuiz ? 1 : studentQuizzes.length || dashboard.totalQuizzes || 0,
      onClick: () => navigate(continueTarget),
    },
    {
      label: recommendedNote?.id ? 'Review lesson' : 'Lessons',
      hint: recommendedNote?.id ? getTopicLabel(recommendedNote, 'Suggested note') : 'Browse study notes',
      icon: 'book',
      count: aiNotes.length || bookmarks.length || 0,
      onClick: () => navigate(recommendedNote?.id ? appRoute(`/ai-notes/${recommendedNote.id}`) : appRoute('/ai-notes')),
    },
  ];

  const planItems = [
    {
      label: 'Practice',
      title: weakTopic ? `Answer questions on ${weakTopic.topicName}` : 'Do one focused practice set',
      detail: weakTopic ? weakTopic.courseTitle : 'Use any short set you can finish today',
      action: () => navigate(continueTarget),
    },
    {
      label: 'Review',
      title: latestAttemptId ? 'Review your latest answers' : 'Check your results page',
      detail: latestAttemptId ? getTopicLabel(latestAttempt, 'Latest result') : 'Create a result by completing an exam',
      action: () => navigate(latestAttemptId ? appRoute(`/review/${latestAttemptId}`) : appRoute('/results')),
    },
    {
      label: 'Lesson',
      title: recommendedNote?.title || 'Open one lesson note',
      detail: recommendedNote ? getTopicLabel(recommendedNote, 'Suggested note') : `${bookmarks.length} saved study items`,
      action: () => navigate(recommendedNote?.id ? appRoute(`/ai-notes/${recommendedNote.id}`) : appRoute('/ai-notes')),
    },
  ];

  const openDailyGoal = dashboard.dailyGoals.find((goal) => !goal.completed) || dashboard.dailyGoals[0] || null;
  const openAdaptivePlan = dashboard.adaptivePlan.find((item) => item.status !== 'done') || dashboard.adaptivePlan[0] || null;
  const todoCard = openDailyGoal
    ? {
        eyebrow: openDailyGoal.completed ? 'Plan done' : 'Next to do',
        title: openDailyGoal.title || 'Today plan',
        text: openDailyGoal.description || openDailyGoal.progressText || 'Keep today moving.',
        actionLabel: openDailyGoal.completed ? 'View plan' : 'Do this',
        route: openDailyGoal.key === 'note_today'
          ? appRoute('/ai-notes')
          : openDailyGoal.key === 'weak_topic_today'
            ? continueTarget
            : appRoute('/quizzes'),
      }
    : openAdaptivePlan
      ? {
          eyebrow: 'Study plan',
          title: openAdaptivePlan.title || 'Next study step',
          text: openAdaptivePlan.description || 'Follow the next recommended action.',
          actionLabel: openAdaptivePlan.status === 'done' ? 'View plan' : 'Start',
          route: openAdaptivePlan.actionType === 'note'
            ? appRoute('/ai-notes')
            : openAdaptivePlan.actionType === 'results'
              ? appRoute('/results')
              : appRoute('/quizzes'),
        }
      : planItems[0]
        ? {
            eyebrow: 'Today plan',
            title: planItems[0].title,
            text: planItems[0].detail,
            actionLabel: 'Start',
            action: planItems[0].action,
          }
        : {
            eyebrow: 'Today plan',
            title: 'No plans yet',
            text: 'Create one small target for today.',
            actionLabel: 'Create one',
            route: appRoute('/planner'),
          };

  const onNavigate = (route) => {
    void nativeImpact(ImpactStyle.Light);
    if (route) navigate(route);
  };

  if (loading) {
    return (
      <main className="dashboard-page study-hub-page">
        <div className="study-hub-shell">
          <div className="study-loading-card">
            <span className="study-loader" />
            <p>Loading your study hub...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-page study-hub-page">
        <div className="study-hub-shell">
          <section className="study-error-card" role="alert">
            <span className="study-soft-icon study-soft-icon--danger"><Icon name="target" /></span>
            <div>
              <h1>Dashboard needs a refresh</h1>
              <p>{error}</p>
            </div>
            <StudyButton tone="primary" icon="arrow" onClick={() => setReloadKey((key) => key + 1)}>Try again</StudyButton>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page study-hub-page" data-hero-motif={heroMotif}>
      <DashboardDustLayer />
      <div className="study-hub-shell">
        <AppHeader title="Study Hub" subtitle="Daily Focus" />

        <section className="study-continue-card" aria-label="Continue studying">
          <div className="study-hero-soft-shape" aria-hidden="true" />
          <HeroMotif variant={heroMotif} />
          <span className="study-hero-stetho" aria-hidden="true"><Icon name="stetho" /></span>
          <div className="study-continue-card__copy">
            <span className="study-eyebrow">Continue where you left off</span>
            <div className="study-hero-name">
              <span>Hi,&nbsp;</span>
              <strong>{firstName}</strong>
            </div>
            <p className="study-hero-lead">Next study move - <b>{inProgressQuiz ? 'Practice' : recommendedNote ? 'Lesson' : 'Practice'}</b></p>
            <div className="study-chip-row">
              <span><Icon name="stetho" /> {recommendedQuiz?.courseTitle || weakTopic?.courseTitle || 'Surgery'}</span>
              <span>{recommendedQuiz?.topicName || weakTopic?.topicName || recommendedNote?.topicName || 'Hernia'} · {readinessScore}% ready</span>
            </div>
            <div className="study-hero-actions">
              <StudyButton tone="primary" icon="play" onClick={() => onNavigate(continueTarget)}>{continueLabel}</StudyButton>
              <button type="button" className="study-square-action" aria-label="Open results" onClick={() => onNavigate(appRoute('/results'))}>
                <Icon name="doc" />
              </button>
            </div>
          </div>
        </section>

        <section className="study-card study-streak-card">
          <div className="study-streak-top">
            <span className="study-streak-icon"><Icon name="flame" /></span>
            <div>
              <span className="study-eyebrow">Daily streak</span>
              <strong>{dashboard.quizDayStreak > 0 ? plural(dashboard.quizDayStreak, 'day') : 'Start your first streak today'}</strong>
            </div>
            <div className="study-streak-days">
              <strong>{dashboard.quizDayStreak}</strong>
              <span>days</span>
            </div>
          </div>
          <StreakHeatmap streak={dashboard.quizDayStreak} goalsCompleted={dashboard.dailyGoalsCompleted} />
          <div className="study-streak-footer">
            <span>Past 4 weeks · <b>{Math.max(dashboard.quizDayStreak, dashboard.dailyGoalsCompleted)}</b> active days</span>
            <span className="study-heatmap-key"><i /><i /><i /><i /></span>
          </div>
        </section>

        <div className="study-readiness-stack">
          <section className="study-card study-readiness-card">
            <span className="study-readiness-glow study-readiness-glow--one" aria-hidden="true" />
            <span className="study-readiness-glow study-readiness-glow--two" aria-hidden="true" />
            <div className="study-readiness-icon"><Icon name="cap" /></div>
            <div className="study-readiness-copy">
              <div className="study-readiness-meta">
                <span className="study-eyebrow">Exam readiness</span>
                <span>Target {Math.max(75, readinessScore)}%</span>
              </div>
              <div className="study-readiness-card__score">
                <strong>{readinessScore}</strong>
                <span>% ready</span>
              </div>
              <div className="study-large-rail" aria-hidden="true">
                <span style={{ width: `${readinessScore}%` }} />
              </div>
              <div className="study-readiness-foot">
                <span>{dashboard.performanceSnapshot?.readinessLabel || 'Keep building'}</span>
                <span>{readinessScore}% complete</span>
              </div>
            </div>
          </section>

          <StudyTodoCard
            todo={todoCard}
            onOpen={() => {
              if (todoCard.action) {
                todoCard.action();
                return;
              }
              onNavigate(todoCard.route);
            }}
          />
        </div>

        <StudyMoodCard mood={studyMood} todayLabel={todayLabel} />

        <section className="study-section-head">
          <span className="study-eyebrow">Quick actions</span>
          <small>3 shortcuts</small>
        </section>

        <section className="study-action-grid" aria-label="Quick actions">
          {quickActions.map((action) => (
            <button type="button" className="study-action-card" key={action.label} onClick={() => onNavigate(null) || action.onClick()}>
              <span><Icon name={action.icon} /></span>
              <em>{action.count}</em>
              <strong>{action.label}</strong>
            </button>
          ))}
        </section>

        <section className="study-section-head study-section-head--question">
          <span className="study-eyebrow">Question of the day</span>
          <small>Tap an answer</small>
        </section>

        <DailyQuestionCard question={dashboard.questionOfDay} />
      </div>
    </main>
  );
}
