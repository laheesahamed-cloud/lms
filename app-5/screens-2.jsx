// Screens 4–6: Lessons (index), Lesson Detail, Results

// ═══════════════════════════════════════════════════════════════
// LESSONS (index)
// ═══════════════════════════════════════════════════════════════
const LessonsScreen = ({ onOpenLesson }) => {
  const { Eyebrow, Serif, SansHead, Body, Card, Chip } = window.UI;
  const courses = [
    { id: 'med', name: 'Medicine',    subjects: 3, lessons: 8,
      topics: ['Cardiology', 'Hematology', 'Toxicology'], icon: 'stetho', updated: '2 days ago' },
    { id: 'ped', name: 'Paediatrics', subjects: 1, lessons: 1,
      topics: ['General'], icon: 'baby', updated: 'New' },
    { id: 'sur', name: 'Surgery',     subjects: 2, lessons: 5,
      topics: ['Hernia', 'Abdominal'], icon: 'pulse', updated: 'Yesterday' },
  ];
  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="Lessons" eyebrow="Illustrated clinical revision" />

      <div style={{ padding: `4px 24px 0` }}>
        {/* search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
          background: TOKENS.surface, border: `1.5px solid ${TOKENS.border}`,
          borderRadius: 18, marginBottom: 14,
        }}>
          <Icon name="search" size={18} color={TOKENS.text3} />
          <span style={{ fontFamily: TOKENS.sans, fontSize: 14, color: TOKENS.text3, flex: 1, fontWeight: 500 }}>Search lessons, topics…</span>
          <Icon name="filter" size={16} color={TOKENS.text2} />
        </div>

        {/* stat row — bold numerals, one gradient highlight */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {[
            { n: 9, label: 'Lessons',  grad: false },
            { n: 4, label: 'Subjects', grad: false },
            { n: 2, label: 'Courses',  grad: true  },
          ].map((s, i) => (
            <Card key={i} pad={14} radius={20} style={{ flex: 1 }}>
              <span style={{
                fontFamily: TOKENS.sans, fontSize: 32, fontWeight: 800,
                letterSpacing: -1, lineHeight: 1, display: 'block', marginBottom: 4,
                ...(s.grad ? {
                  background: TOKENS.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: 'transparent',
                } : { color: TOKENS.ink }),
              }}>{s.n}</span>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: TOKENS.text3, textTransform: 'uppercase' }}>{s.label}</div>
            </Card>
          ))}
        </div>

        {/* section header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Courses</Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text3, fontWeight: 700 }}>{courses.length} courses</span>
        </div>

        {/* course cards — gradient tile, brand-consistent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map((c, i) => (
            <div key={c.id} onClick={() => onOpenLesson?.(c)} style={{ cursor: 'pointer' }}>
              <Card pad={18} radius={24}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, background: TOKENS.grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    boxShadow: '0 6px 14px -5px rgba(61,90,254,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}>
                    <Icon name={c.icon} size={24} stroke={1.7} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SansHead size={17} style={{ marginBottom: 2 }}>{c.name}</SansHead>
                    <Body size={12}>{c.subjects} subject{c.subjects>1?'s':''} · Updated {c.updated}</Body>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: TOKENS.sans, fontSize: 26, fontWeight: 800, color: TOKENS.ink, letterSpacing: -0.7, lineHeight: 1 }}>{c.lessons}</div>
                    <div style={{ fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: TOKENS.text3, textTransform: 'uppercase', marginTop: 3 }}>lessons</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {c.topics.map(t => (
                    <Chip key={t} tone="warm" size="sm">{t}</Chip>
                  ))}
                </div>
                <div style={{
                  borderTop: `1px solid ${TOKENS.borderSoft}`, paddingTop: 12, display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800, color: TOKENS.primary, letterSpacing: -0.1 }}>Open course</div>
                  <Icon name="chev" size={16} color={TOKENS.primary} />
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
window.LessonsScreen = LessonsScreen;

// ═══════════════════════════════════════════════════════════════
// LESSON DETAIL
// ═══════════════════════════════════════════════════════════════
const LessonDetailScreen = ({ onBack, course }) => {
  const { Eyebrow, Serif, SansHead, Body, Card, Chip } = window.UI;
  const [expanded, setExpanded] = React.useState('overview');
  const c = course || { name: 'Paediatrics' };

  const lessons = [
    { id: 'l1', title: 'Newborn examination',   sub: 'Lesson 1', time: '15 min', xp: 15, state: 'done',    free: false },
    { id: 'l2', title: 'Common infant rashes',  sub: 'Lesson 2', time: '15 min', xp: 15, state: 'inprog',  free: true },
    { id: 'l3', title: 'Vaccination schedule',  sub: 'Lesson 3', time: '20 min', xp: 20, state: 'todo',    free: false },
  ];

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Compact top bar with back button */}
      <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{
          width: 42, height: 42, borderRadius: 14, background: TOKENS.surface,
          border: `1.5px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: TOKENS.ink, padding: 0,
        }}>
          <Icon name="arrowL" size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: TOKENS.text3, textTransform: 'uppercase' }}>{c.name}</div>
          <div style={{ fontFamily: TOKENS.sans, fontSize: 16, fontWeight: 800, color: TOKENS.ink, lineHeight: 1.2, letterSpacing: -0.3 }}>Unit 1</div>
        </div>
        <button style={{
          width: 42, height: 42, borderRadius: 14, background: TOKENS.surface,
          border: `1.5px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: TOKENS.ink, padding: 0,
        }}>
          <Icon name="info" size={18} />
        </button>
      </div>

      {/* Unit hero card */}
      <div style={{ padding: '8px 20px 0' }}>
        <Card pad={20} radius={24}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, background: TOKENS.grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
              boxShadow: '0 8px 18px -6px rgba(61,90,254,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>
              <Icon name="book" size={24} stroke={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Chip tone="warm" size="sm" style={{ marginBottom: 6 }}>In progress</Chip>
              <SansHead size={19} weight={800} style={{ marginBottom: 2, letterSpacing: -0.3 }}>General lessons</SansHead>
              <Body size={12}>3 lessons · ~50 min · 50 XP total</Body>
            </div>
            <window.ProgressRing pct={33} size={48} stroke={4} />
          </div>
        </Card>
      </div>

      {/* Section: lessons in Unit 1 */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 4 }}>
          <Eyebrow>1.1 · Overview</Eyebrow>
          <button onClick={() => setExpanded(expanded === 'overview' ? null : 'overview')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, color: TOKENS.text2,
            fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 700,
          }}>
            {expanded === 'overview' ? 'Collapse' : 'Expand'}
            <Icon name={expanded === 'overview' ? 'chevU' : 'chevD'} size={14} />
          </button>
        </div>

        {expanded === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lessons.map((l, i) => {
              const isDone   = l.state === 'done';
              const isInProg = l.state === 'inprog';
              const isTodo   = l.state === 'todo';
              return (
                <Card key={l.id} pad={16} radius={20}
                  style={isInProg ? { border: `1.5px solid ${TOKENS.accent}55`, boxShadow: `0 0 0 4px ${TOKENS.accentSoft}55` } : undefined}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 13,
                      background: isDone ? TOKENS.okSoft : isInProg ? TOKENS.grad : TOKENS.surface2,
                      color: isDone ? TOKENS.ok : isInProg ? '#fff' : TOKENS.text2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      boxShadow: isInProg ? '0 4px 10px -3px rgba(61,90,254,0.4)' : 'none',
                    }}>
                      <Icon name={isDone ? 'check' : 'doc'} size={18} stroke={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <div style={{ fontFamily: TOKENS.sans, fontSize: 14, fontWeight: 800, color: TOKENS.ink, letterSpacing: -0.1 }}>{l.title}</div>
                        {l.free && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '2px 7px', borderRadius: 999,
                            background: TOKENS.goldSoft, color: '#B07500',
                            fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
                          }}>FREE</span>
                        )}
                      </div>
                      <Body size={12}>
                        {l.sub} · {l.time}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, color: '#B07500', fontWeight: 800 }}>
                          <Icon name="bolt" size={10} stroke={0}/> +{l.xp}
                        </span>
                      </Body>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {isDone
                      ? <Chip tone="ok" size="sm">Completed</Chip>
                      : isInProg
                        ? <Chip size="sm" style={{ background: TOKENS.accentSoft, color: TOKENS.primary }}>In progress</Chip>
                        : <span style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text3, fontWeight: 700 }}>Not started</span>}
                    <button style={{
                      padding: '10px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: isInProg ? TOKENS.grad : TOKENS.surface2,
                      color: isInProg ? '#fff' : TOKENS.ink,
                      fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800,
                      display: 'flex', alignItems: 'center', gap: 6,
                      border: isInProg ? 'none' : `1.5px solid ${TOKENS.border}`,
                      boxShadow: isInProg ? '0 6px 14px -4px rgba(61,90,254,0.45)' : 'none',
                      letterSpacing: -0.1,
                    }}>
                      {isInProg && <Icon name="play" size={12} />}
                      {isDone ? 'Review' : isInProg ? 'Continue' : 'Start'}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Continue where you left off — navy with brand-gradient glow */}
      <div style={{ padding: '24px 20px 0' }}>
        <Card pad={0} radius={24} bg={TOKENS.ink} border={false} style={{ overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', right: -80, bottom: -80, width: 240, height: 240,
            borderRadius: 999, background: `radial-gradient(circle, ${TOKENS.accent2}60, transparent 65%)`,
          }} />
          <div style={{
            position: 'absolute', left: -60, top: -60, width: 180, height: 180,
            borderRadius: 999, background: `radial-gradient(circle, ${TOKENS.primary}50, transparent 65%)`,
          }} />
          <div style={{ padding: 22, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Eyebrow color="rgba(255,255,255,0.6)">Continue where you left off</Eyebrow>
              <button style={{
                padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                background: TOKENS.grad, color: '#fff', border: 'none',
                fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 6px 16px -4px rgba(61,90,254,0.55)',
              }}>
                Resume <Icon name="arrow" size={12} />
              </button>
            </div>
            <Eyebrow color="rgba(255,255,255,0.5)" style={{ marginBottom: 6 }}>Up next</Eyebrow>
            <div style={{ fontFamily: TOKENS.sans, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.5, marginBottom: 8 }}>Common infant rashes</div>
            <Body size={12} color="rgba(255,255,255,0.65)">
              General lessons · Overview · ~15 min
            </Body>
          </div>
        </Card>
      </div>
    </div>
  );
};
window.LessonDetailScreen = LessonDetailScreen;

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════
const ResultsScreen = () => {
  const { Eyebrow, Serif, SansHead, Body, Card, Chip } = window.UI;
  // Score trend rendered as an ECG line — each data point becomes a heartbeat,
  // R-wave amplitude proportional to score.
  const trend = [12, 18, 22, 31, 28, 35, 26];
  const max = Math.max(...trend);
  const W = 290, H = 100;
  const baseY = H - 18;
  const segW = W / trend.length;
  function ecgBeat(x0, h) {
    return [
      [x0,                baseY],
      [x0 + segW * 0.28,  baseY],
      [x0 + segW * 0.32,  baseY - h * 0.12],  // P wave
      [x0 + segW * 0.36,  baseY],
      [x0 + segW * 0.40,  baseY + h * 0.08],  // Q
      [x0 + segW * 0.44,  baseY - h * 0.95],  // R peak
      [x0 + segW * 0.48,  baseY + h * 0.18],  // S
      [x0 + segW * 0.52,  baseY],
      [x0 + segW * 0.62,  baseY - h * 0.18],  // T wave
      [x0 + segW * 0.72,  baseY],
      [x0 + segW,         baseY],
    ];
  }
  const allPts = trend.flatMap((v, i) => ecgBeat(i * segW, (v / max) * (H - 24)));
  const path = allPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const lastR_x = (trend.length - 1) * segW + segW * 0.44;
  const lastR_y = baseY - ((trend[trend.length - 1] / max) * (H - 24)) * 0.95;

  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="Results" eyebrow="Your progress" />
      <div style={{ padding: '4px 24px 0' }}>
        {/* Hero: avg score — navy card, gradient sparkline */}
        <Card pad={24} radius={28} bg={TOKENS.ink} border={false} style={{ position: 'relative', overflow: 'hidden', color: '#FFFFFF' }}>
          {/* dual brand glows */}
          <div style={{
            position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: 999,
            background: `radial-gradient(circle, ${TOKENS.accent2}55, transparent 65%)`,
          }} />
          <div style={{
            position: 'absolute', left: -40, bottom: -80, width: 200, height: 200, borderRadius: 999,
            background: `radial-gradient(circle, ${TOKENS.primary}50, transparent 65%)`,
          }} />
          <div style={{
            position: 'absolute', right: -20, top: -20, opacity: 0.12,
          }}>
            <Icon name="trophy" size={140} color="#FFFFFF" stroke={1} />
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Eyebrow color="rgba(255,255,255,0.6)">Average score</Eyebrow>
              <Chip tone="ok" size="sm" style={{ background: 'rgba(22,169,116,0.22)', color: '#7DE6B0', padding: '3px 9px' }}>▲ 26%</Chip>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
              <span style={{ fontFamily: TOKENS.sans, fontSize: 64, fontWeight: 800, color: '#fff', letterSpacing: -2, lineHeight: 1 }}>25.63</span>
              <span style={{ fontFamily: TOKENS.sans, fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: -0.5 }}>%</span>
            </div>
            <Body size={13} color="rgba(255,255,255,0.7)">
              Strong upward trend across your last 4 exams — keep stacking reps.
            </Body>

            {/* ECG-style score trace */}
            <div style={{ marginTop: 14, position: 'relative' }}>
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="ecgStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"  stopColor={TOKENS.primary} stopOpacity="0.4"/>
                    <stop offset="40%" stopColor={TOKENS.primary} stopOpacity="0.95"/>
                    <stop offset="100%" stopColor={TOKENS.accent2}/>
                  </linearGradient>
                  <pattern id="ecgGrid" width="22" height="22" patternUnits="userSpaceOnUse">
                    <path d="M 22 0 L 0 0 0 22" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none"/>
                  </pattern>
                  <filter id="ecgGlow">
                    <feGaussianBlur stdDeviation="2.5"/>
                  </filter>
                </defs>
                {/* paper grid */}
                <rect width={W} height={H} fill="url(#ecgGrid)" />
                {/* baseline */}
                <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3"/>
                {/* glow under stroke */}
                <path d={path} stroke={TOKENS.accent2} strokeWidth="5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" opacity="0.35" filter="url(#ecgGlow)"/>
                {/* the trace */}
                <path d={path} stroke="url(#ecgStroke)" strokeWidth="2" fill="none"
                  strokeLinecap="round" strokeLinejoin="round"/>
                {/* live dot on last R peak */}
                <circle cx={lastR_x} cy={lastR_y} r="6" fill={TOKENS.accent2} opacity="0.25">
                  <animate attributeName="r" values="4;10;4" dur="1.8s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite"/>
                </circle>
                <circle cx={lastR_x} cy={lastR_y} r="3.5" fill="#fff" stroke={TOKENS.accent2} strokeWidth="2"/>
              </svg>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 6,
                fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
              }}>
                <span>Mock 1</span>
                <span>Mock 2</span>
                <span>Mock 3</span>
                <span>Latest</span>
              </div>
            </div>
          </div>
        </Card>

        {/* 2x2 stat tiles — cleaner, brand-consistent */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {[
            { n: 8, label: 'Available exams', icon: 'doc',    accent: 'brand' },
            { n: 4, label: 'Total attempts',  icon: 'target', accent: 'brand', sub: '4 this week' },
            { n: 0, label: 'Day streak',      icon: 'flame',  accent: 'gold',  sub: 'Start today' },
            { n: 4, label: 'Last 7 days',     icon: 'pulse',  accent: 'brand', sub: '+2 vs prev' },
          ].map((s, i) => {
            const grad  = s.accent === 'gold' ? TOKENS.gradGold : TOKENS.grad;
            const tintC = s.accent === 'gold' ? '#B07500' : TOKENS.primary;
            return (
              <Card key={i} pad={16} radius={20}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, background: grad, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  boxShadow: '0 4px 10px -4px rgba(14,21,56,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}>
                  <Icon name={s.icon} size={18} stroke={1.8} />
                </div>
                <div style={{
                  fontFamily: TOKENS.sans, fontSize: 36, fontWeight: 800,
                  color: TOKENS.ink, letterSpacing: -1.2, lineHeight: 1, marginBottom: 6,
                }}>{s.n}</div>
                <div style={{ fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 800, color: TOKENS.ink, letterSpacing: -0.1 }}>{s.label}</div>
                {s.sub && <Body size={11} style={{ marginTop: 2 }}>{s.sub}</Body>}
              </Card>
            );
          })}
        </div>

        {/* Recent attempts */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 12, paddingLeft: 4 }}>
          <Eyebrow>Recent attempts</Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.primary, fontWeight: 800 }}>See all →</span>
        </div>
        <Card pad={0} radius={22}>
          {[
            { title: 'Surgery · Mock 4',    when: 'Yesterday',  score: 35, qs: '40 q' },
            { title: 'Medicine · Mock 3',   when: '3 days ago', score: 28, qs: '50 q' },
            { title: 'Medicine · Mock 2',   when: '5 days ago', score: 22, qs: '50 q' },
            { title: 'Medicine · Mock 1',   when: 'Last week',  score: 17, qs: '50 q' },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderBottom: i < arr.length-1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: TOKENS.surface2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: TOKENS.ink,
              }}>
                <Icon name="doc" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: TOKENS.sans, fontSize: 14, fontWeight: 700, color: TOKENS.ink }}>{r.title}</div>
                <Body size={12} style={{ marginTop: 2 }}>{r.when} · {r.qs}</Body>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontFamily: TOKENS.sans, fontSize: 20, fontWeight: 800,
                  color: r.score >= 25 ? TOKENS.ok : TOKENS.ink, letterSpacing: -0.5,
                }}>
                  {r.score}<span style={{ fontSize: 12, color: TOKENS.text3, marginLeft: 1 }}>%</span>
                </span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};
window.ResultsScreen = ResultsScreen;
