import { useState, useEffect, useRef, useDeferredValue, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { isStaffRole, isStaffUser } from '../auth/roleAccess.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { cx } from '../styles/tailwindClasses.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../utils/userIdentity.js';

const searchUi = {
  backdrop:
    'fixed inset-0 z-[9000] flex items-start justify-center bg-black/45 px-4 pb-4 pt-[72px] backdrop-blur animate-overlayIn',
  modal:
    'w-full max-w-[560px] overflow-hidden rounded-xl border border-line-medium bg-surface-glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.18)] backdrop-blur-[20px] animate-scaleInFast dark:border-white/10 dark:bg-[rgba(15,17,32,0.92)]',
  inputRow:
    'flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5 text-ink-soft',
  input:
    'min-h-0 flex-1 border-0 bg-transparent p-0 font-body text-[15px] text-ink-strong shadow-none outline-none placeholder:text-ink-muted focus:border-0 focus:bg-transparent focus:shadow-none',
  close:
    'flex min-h-0 items-center justify-center rounded-xs border-0 bg-transparent p-1 text-ink-muted shadow-none transition-[color,background] duration-150 hover:translate-y-0 hover:bg-surface-2 hover:text-ink-strong hover:shadow-none hover:brightness-100 focus-visible:ring-2 focus-visible:ring-brand-primary/20',
  body: 'max-h-[360px] min-h-20 overflow-y-auto py-2',
  hint:
    'px-[18px] py-5 text-center text-[13px] text-ink-muted [&_strong]:text-ink-medium',
  list: 'm-0 list-none p-0',
  item:
    'flex w-full cursor-pointer items-center gap-2.5 rounded-none border-0 bg-transparent px-3.5 py-[9px] text-left shadow-none transition-colors duration-100 hover:translate-y-0 hover:bg-surface-2 hover:shadow-none hover:brightness-100 dark:hover:bg-white/[0.06]',
  itemSelected: 'bg-surface-2 dark:bg-white/[0.06]',
  itemIcon:
    'flex size-7 shrink-0 items-center justify-center rounded-sm',
  itemIconNote: 'bg-violet-600/10 text-violet-600',
  itemIconQuiz: 'bg-emerald-600/10 text-emerald-600',
  itemIconCourse: 'bg-cyan-600/10 text-cyan-600',
  itemIconUser: 'bg-amber-600/10 text-amber-600',
  itemBody: 'min-w-0 flex-1',
  itemTitle:
    'block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-ink-strong dark:text-white/90',
  itemSub:
    'mt-px block text-[11.5px] text-ink-muted',
  itemType:
    'shrink-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted',
  footer:
    'flex gap-4 border-t border-line-soft px-3.5 py-2 text-[11px] text-ink-muted',
};

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M10 3h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M4.5 4.5h3M4.5 6.5h3M4.5 8.5h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M4.5 5.5a2 2 0 0 1 3.5 1.3c0 1-1.5 1.5-1.5 2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="6.5" cy="10" r="0.6" fill="currentColor"/>
    </svg>
  );
}

function CourseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 3.25h6.75a2.25 2.25 0 0 1 2.25 2.25v5.25H4.75A2.25 2.25 0 0 1 2.5 8.5V3.25Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 5.75h4.75M4.5 7.75h3.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="4.75" r="2.15" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 11.75c.62-2.05 2.08-3.1 4-3.1s3.38 1.05 4 3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.quizzes)) return value.quizzes;
  if (Array.isArray(value?.courses)) return value.courses;
  if (Array.isArray(value?.users)) return value.users;
  return [];
}

function includesQuery(value, q) {
  return String(value || '').toLowerCase().includes(q);
}

function resultIconClass(type) {
  if (type === 'quiz') return searchUi.itemIconQuiz;
  if (type === 'course') return searchUi.itemIconCourse;
  if (type === 'user') return searchUi.itemIconUser;
  return searchUi.itemIconNote;
}

function ResultIcon({ type }) {
  if (type === 'quiz') return <QuizIcon />;
  if (type === 'course') return <CourseIcon />;
  if (type === 'user') return <UserIcon />;
  return <NoteIcon />;
}

function resultLabel(type) {
  if (type === 'quiz') return 'Quiz';
  if (type === 'course') return 'Course';
  if (type === 'user') return 'Student';
  return 'Lesson';
}

function rolePath(path, isAdmin) {
  if (path.startsWith('/admin') || path.startsWith('/app')) return path;
  return `${isAdmin ? '/admin' : '/app'}${path}`;
}

export function GlobalSearch({ onClose }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const isAdmin = isStaffUser(user);

  useEffect(() => {
    inputRef.current?.focus();
    let cancelled = false;
    const role = user?.role;
    const roleIsAdmin = isStaffRole(role);
    const roleIsStudent = role === 'student';

    if (!roleIsAdmin && !roleIsStudent) {
      setNotes([]);
      setQuizzes([]);
      setCourses([]);
      setUsers([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    const notesRequest = import('../api/aiNotes.api.js')
      .then((api) => roleIsAdmin ? api.adminListAiNotes() : api.listAiNotes())
      .catch(() => []);
    const quizzesRequest = roleIsAdmin
      ? import('../api/quizzes.api.js').then((api) => api.fetchQuizzes({})).catch(() => [])
      : import('../api/quizAttempts.api.js').then((api) => api.fetchStudentQuizzes()).catch(() => []);
    const coursesRequest = import('../api/courses.api.js')
      .then((api) => roleIsAdmin ? api.fetchCourses() : api.fetchStudentCourses())
      .catch(() => []);
    const usersRequest = roleIsAdmin
      ? import('../api/users.api.js').then((api) => api.fetchUsers({ role: 'student' })).catch(() => [])
      : Promise.resolve([]);

    Promise.all([notesRequest, quizzesRequest, coursesRequest, usersRequest]).then(([n, qz, c, u]) => {
      if (cancelled) return;
      setNotes(asArray(n));
      setQuizzes(asArray(qz));
      setCourses(asArray(c));
      setUsers(roleIsAdmin ? asArray(u) : []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useFocusTrap({
    active: true,
    containerRef: modalRef,
    initialFocusRef: inputRef,
    onEscape: onClose,
  });

  const q = deferredQuery.trim().toLowerCase();
  const results = useMemo(() => {
    if (q.length < 2) {
      return [];
    }

    const noteResults = notes
      .filter(n =>
        includesQuery(n.title, q) ||
        includesQuery(n.courseTitle, q) ||
        includesQuery(n.topicName, q)
      )
      .slice(0, 4)
      .map(n => ({
        type: 'note',
        id: n.id,
        title: n.title,
        sub: [n.courseTitle, n.topicName].filter(Boolean).join(' › '),
        url: rolePath(`/ai-notes/${n.id}`, isAdmin),
      }));

    const courseResults = courses
      .filter(c =>
        includesQuery(c.title || c.courseTitle || c.name, q) ||
        includesQuery(c.description, q)
      )
      .slice(0, 4)
      .map(c => ({
        type: 'course',
        id: c.id,
        title: c.title || c.courseTitle || c.name || 'Course',
        sub: isAdmin ? 'Course management' : 'Course library',
        url: rolePath('/courses', isAdmin),
        state: isAdmin ? undefined : { selectedCourseId: c.id },
      }));

    const quizResults = quizzes
      .filter(qz =>
        includesQuery(qz.title || qz.quizTitle, q) ||
        includesQuery(qz.courseTitle, q) ||
        includesQuery(qz.topicName, q)
      )
      .slice(0, 4)
      .map(qz => ({
        type: 'quiz',
        id: qz.id,
        title: qz.title || qz.quizTitle || 'Quiz',
        sub: [qz.courseTitle, qz.topicName].filter(Boolean).join(' › '),
        url: rolePath(isAdmin ? `/quizzes/${qz.id}/edit` : `/quizzes/${qz.id}?mode=practice`, isAdmin),
      }));

    const adminStudentResults = isAdmin
      ? users
          .filter(u =>
            includesQuery(u.fullName || u.full_name, q) ||
            includesQuery(u.email, q) ||
            includesQuery(u.status, q)
          )
          .slice(0, 4)
            .map(u => ({
              type: 'user',
              id: u.id,
              title: getAdminUserIdentifier(u, 'Student'),
              sub: [getAdminUserSecondaryIdentifier(u), u.status].filter(Boolean).join(' • '),
              url: rolePath('/users', isAdmin),
            }))
      : [];

    return [
      ...courseResults,
      ...noteResults,
      ...quizResults,
      ...adminStudentResults,
    ].slice(0, 12);
  }, [courses, isAdmin, notes, q, quizzes, users]);

  useEffect(() => { setSelected(0); }, [deferredQuery]);

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) {
      navigate(results[selected].url, { state: results[selected].state });
      onClose();
    }
  }

  function go(result) {
    navigate(result.url, { state: result.state });
    onClose();
  }

  return (
    <div className={searchUi.backdrop} onClick={onClose}>
      <div
        ref={modalRef}
        className={searchUi.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        tabIndex={-1}
      >
        <div className={searchUi.inputRow}>
          <SearchIcon/>
          <input className={searchUi.input}
            ref={inputRef}
            aria-label={isAdmin ? 'Search admin content, courses, quizzes, and students' : 'Search your courses, lessons, and quizzes'}
            placeholder={isAdmin ? 'Search courses, lessons, quizzes, students...' : 'Search your courses, lessons, quizzes...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button type="button" className={searchUi.close} onClick={onClose} aria-label="Close search"><CloseIcon/></button>
        </div>

        <div className={searchUi.body}>
          {loading ? (
            <div className={searchUi.hint}>Loading…</div>
          ) : q.length < 2 ? (
            <div className={searchUi.hint}>Type at least 2 characters to search.</div>
          ) : results.length === 0 ? (
            <div className={searchUi.hint}>No results for "<strong>{query}</strong>"</div>
          ) : (
            <ul className={searchUi.list}>
              {results.map((r, i) => (
                <li key={`${r.type}-${r.id}`}>
                  <button className={cx(searchUi.item, i === selected && searchUi.itemSelected)}
                    type="button"
                   
                    onClick={() => go(r)}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <span className={cx(searchUi.itemIcon, resultIconClass(r.type))}>
                      <ResultIcon type={r.type} />
                    </span>
                    <span className={searchUi.itemBody}>
                      <span className={searchUi.itemTitle}>{r.title}</span>
                      {r.sub && <span className={searchUi.itemSub}>{r.sub}</span>}
                    </span>
                    <span className={searchUi.itemType}>{resultLabel(r.type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={searchUi.footer}>
          <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
