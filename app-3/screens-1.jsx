// Screens 1–3: Home (Study Hub), Q-Bank, Courses

// ─── Shared bits ─────────────────────────────────────────────
const SCREEN_PAD = 24;
const Eyebrow = ({ children, color, style }) => (
  <div style={{
    fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
    color: color || TOKENS.text3, textTransform: 'uppercase', ...style,
  }}>{children}</div>
);
const Serif = ({ children, size = 32, italic, weight = 700, color, style }) => (
  <span style={{
    fontFamily: TOKENS.serif, fontSize: size, fontWeight: weight,
    color: color || TOKENS.ink, letterSpacing: -1, lineHeight: 0.98,
    fontVariantNumeric: 'lining-nums tabular-nums',
    fontVariationSettings: `'opsz' ${Math.min(96, Math.max(12, size))}`,
    display: 'inline-block', ...style,
  }}>{children}</span>
);
const SansHead = ({ children, size = 22, weight = 700, color, style }) => (
  <div style={{
    fontFamily: TOKENS.sans, fontSize: size, fontWeight: weight, color: color || TOKENS.ink,
    letterSpacing: -0.3, lineHeight: 1.15, ...style,
  }}>{children}</div>
);
const Body = ({ children, size = 14, color, weight = 500, style }) => (
  <div style={{
    fontFamily: TOKENS.sans, fontSize: size, fontWeight: weight, color: color || TOKENS.text2,
    lineHeight: 1.5, ...style,
  }}>{children}</div>
);
const Card = ({ children, bg = TOKENS.surface, border = true, pad = 18, radius = 22, style }) => (
  <div style={{
    background: bg, borderRadius: radius, padding: pad,
    border: border ? `1px solid ${TOKENS.border}` : 'none',
    ...style,
  }}>{children}</div>
);
const Chip = ({ children, tone = 'ink', size = 'sm', style }) => {
  const tones = {
    ink:     { bg: TOKENS.ink,     fg: '#fff' },
    primary: { bg: TOKENS.primary, fg: '#fff' },
    soft:    { bg: TOKENS.surface, fg: TOKENS.ink, border: TOKENS.border },
    accent:  { bg: TOKENS.accentSoft, fg: TOKENS.accent2 },
    primarySoft: { bg: TOKENS.primarySoft, fg: TOKENS.primaryInk },
    ok:      { bg: TOKENS.okSoft, fg: TOKENS.ok },
    warm:    { bg: TOKENS.surface2, fg: TOKENS.text },
  };
  const t = tones[tone];
  const sz = size === 'lg' ? { padding: '8px 14px', fontSize: 13 } : { padding: '5px 12px', fontSize: 12 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: t.bg, color: t.fg, borderRadius: 999,
      border: t.border ? `1px solid ${t.border}` : 'none',
      fontFamily: TOKENS.sans, fontWeight: 700, letterSpacing: 0.1,
      whiteSpace: 'nowrap', ...sz, ...style,
    }}>{children}</span>
  );
};
window.UI = { Eyebrow, Serif, SansHead, Body, Card, Chip };

// ═══════════════════════════════════════════════════════════════
// HOME (Study Hub)
// ═══════════════════════════════════════════════════════════════
const HomeScreen = ({ user = 'Laheez', onNav }) => {
  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="Study Hub" eyebrow="Today · Mar 17" />

      {/* Hero — white card, gradient text + CTA (matches the original's vibe) */}
      <div style={{ padding: `12px ${SCREEN_PAD}px 0` }}>
        <div style={{
          background: TOKENS.surface, borderRadius: 28, padding: 24,
          border: `1px solid ${TOKENS.border}`, position: 'relative', overflow: 'hidden',
        }}>
          {/* faint decorative gradient blob */}
          <div style={{
            position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: 999,
            background: TOKENS.gradSoft, opacity: 0.7, pointerEvents: 'none',
          }} />
          {/* stethoscope motif top-right */}
          <div style={{ position: 'absolute', right: 22, top: 22, opacity: 0.45 }}>
            <Icon name="stetho" size={48} color={TOKENS.accent2} stroke={1.4} />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <Eyebrow color={TOKENS.primary} style={{ marginBottom: 14 }}>Continue where you left off</Eyebrow>
            <div style={{ marginBottom: 4 }}>
              <Serif size={36} color={TOKENS.ink}>Hi,&nbsp;</Serif>
              <span style={{
                fontFamily: TOKENS.serif, fontSize: 36, fontWeight: 700,
                letterSpacing: -1.1, lineHeight: 0.98,
                fontVariationSettings: "'opsz' 48",
                background: TOKENS.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent', color: 'transparent',
                display: 'inline-block',
              }}>{user}</span>
              <span style={{ fontSize: 28, marginLeft: 6 }}>👋</span>
            </div>
            <Body color={TOKENS.text2} size={13} style={{ marginTop: 10, maxWidth: 300 }}>
              Next study move — <strong style={{ color: TOKENS.ink }}>Practice</strong>
            </Body>

            <div style={{ display: 'flex', gap: 8, marginTop: 18, marginBottom: 22 }}>
              <Chip tone="primarySoft" size="sm" style={{ whiteSpace: 'nowrap' }}>
                <Icon name="stetho" size={13} /> Surgery
              </Chip>
              <Chip size="sm" style={{ background: TOKENS.accent2Soft, color: TOKENS.accent2, whiteSpace: 'nowrap' }}>
                Hernia · Lesson 3
              </Chip>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{
                flex: 1, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
                background: TOKENS.grad, color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10, fontFamily: TOKENS.sans, fontWeight: 800, fontSize: 15,
                letterSpacing: -0.1,
                boxShadow: '0 10px 24px -8px rgba(61,90,254,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
                position: 'relative', overflow: 'hidden',
                animation: 'vibeShimmer 3.5s ease-in-out infinite',
              }}>
                <Icon name="play" size={16} /> Resume practice
              </button>
              <button style={{
                width: 56, height: 56, borderRadius: 18, cursor: 'pointer',
                background: TOKENS.surface, color: TOKENS.primary,
                border: `1px solid ${TOKENS.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }} title="Open exams">
                <Icon name="doc" size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Daily streak — compact, with 4-week heatmap */}
      <div style={{ padding: `16px ${SCREEN_PAD}px 0` }}>
        <Card pad={16} radius={20} style={{ background: 'linear-gradient(135deg, #FFF6E9 0%, #FFE4C2 100%)', border: `1px solid #F5D9A8` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: `linear-gradient(135deg, ${TOKENS.warn}, #E66B1F)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              flexShrink: 0,
              boxShadow: '0 6px 14px -4px rgba(240,138,44,0.55)',
            }}>
              <Icon name="flame" size={22} stroke={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow color={TOKENS.warn} style={{ marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7 }}>
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 999, background: TOKENS.warn,
                    animation: 'vibePulse 1.8s ease-out infinite',
                  }} />
                  <span style={{ position: 'absolute', inset: 1, borderRadius: 999, background: TOKENS.warn }} />
                </span>
                Daily streak
              </Eyebrow>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 15, fontWeight: 800, color: TOKENS.ink, letterSpacing: -0.3 }}>
                Start your first streak today
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Serif size={22} color={TOKENS.warn}>0</Serif>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 9, fontWeight: 800, color: 'rgba(115,75,30,0.65)', letterSpacing: 0.6, textTransform: 'uppercase' }}>days</div>
            </div>
          </div>
          {/* compact 4-week activity grid */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {(() => {
              const TODAY = 22;
              const data = [0,2,1,0,0,1,0, 0,0,1,2,0,0,0, 0,1,0,0,0,0,0, 0,0,0,0,0,0,0];
              const colors = ['transparent', 'rgba(240,138,44,0.4)', 'rgba(240,138,44,0.7)', TOKENS.warn];
              return data.map((v,i) => {
                const isToday = i === TODAY;
                const isFuture = i > TODAY;
                return (
                  <div key={i} style={{
                    height: 18, borderRadius: 4,
                    background: isFuture ? 'transparent' : colors[v],
                    border: v === 0 || isFuture
                      ? `1.2px dashed rgba(240,138,44,${isFuture ? 0.18 : 0.32})`
                      : 'none',
                    boxShadow: isToday ? `0 0 0 1.5px ${TOKENS.warn}` : 'none',
                  }} />
                );
              });
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 700, color: 'rgba(115,75,30,0.7)' }}>
              Past 4 weeks · <span style={{ color: TOKENS.warn, fontWeight: 800 }}>5</span> active days
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {[0,1,2,3].map(v => (
                <div key={v} style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: ['transparent', 'rgba(240,138,44,0.4)', 'rgba(240,138,44,0.7)', TOKENS.warn][v],
                  border: v === 0 ? `1px dashed rgba(240,138,44,0.4)` : 'none',
                }} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Exam countdown — navy with brand gradient ring */}
      <div style={{ padding: `12px ${SCREEN_PAD}px 0` }}>
        <Card pad={0} radius={24} bg={TOKENS.ink} border={false} style={{ overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: 999,
            background: `radial-gradient(circle, ${TOKENS.accent2}55, transparent 65%)` }} />
          <div style={{ position: 'absolute', left: -40, bottom: -60, width: 140, height: 140, borderRadius: 999,
            background: `radial-gradient(circle, ${TOKENS.primary}50, transparent 65%)` }} />
          <div style={{ position: 'relative', padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18, background: TOKENS.grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 8px 22px -6px rgba(61,90,254,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
              <Icon name="cap" size={26} color="#fff" stroke={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Eyebrow color="rgba(255,255,255,0.6)" style={{ whiteSpace: 'nowrap' }}>USMLE Step 1</Eyebrow>
                <span style={{ fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.4 }}>· Target 250</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <Serif size={32} color="#fff">47</Serif>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 700 }}>days to go</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '32%', background: TOKENS.grad, borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.2 }}>
                <span>Started Jan 15</span>
                <span>32% complete</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick actions row */}
      <div style={{ padding: `16px ${SCREEN_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 4 }}>
          <Eyebrow>Quick actions</Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text3, fontWeight: 600 }}>3 shortcuts</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { icon: 'check', label: 'Review\u00A0answers',  tone: TOKENS.primary, soft: TOKENS.primarySoft, n: '12' },
            { icon: 'play',  label: 'Resume\u00A0practice', tone: TOKENS.accent2, soft: TOKENS.accent2Soft, n: '3' },
            { icon: 'book',  label: 'Review\u00A0lesson',   tone: TOKENS.warn,    soft: TOKENS.warnSoft,    n: '5' },
          ].map((q, i) => (
            <Card key={i} pad={14} radius={20} style={{ position: 'relative' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: q.soft, color: q.tone, display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: 36,
              }}>
                <Icon name={q.icon} size={18} stroke={2} />
              </div>
              <div style={{ position: 'absolute', top: 14, right: 14,
                fontFamily: TOKENS.sans, fontSize: 18, fontWeight: 800, color: q.tone, lineHeight: 1, letterSpacing: -0.5 }}>
                {q.n}
              </div>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800, color: TOKENS.ink, lineHeight: 1.2, letterSpacing: -0.2 }}>
                {q.label}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Today's clinical case — the actual medical content */}
      <div style={{ padding: `20px ${SCREEN_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 4 }}>
          <Eyebrow>Today's clinical case</Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.primary, fontWeight: 800, cursor: 'pointer' }}>All cases →</span>
        </div>
        <Card pad={0} radius={22} style={{ position: 'relative', overflow: 'hidden' }}>
          {/* ECG line decoration */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }} viewBox="0 0 400 200" preserveAspectRatio="none">
            <path d="M0 100 L80 100 L92 92 L100 108 L106 40 L114 160 L120 78 L130 100 L210 100 L222 92 L230 108 L236 40 L244 160 L250 78 L260 100 L340 100 L352 92 L360 108 L366 40 L374 160 L380 78 L400 100"
              stroke={TOKENS.danger} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ position: 'relative', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Chip tone="primarySoft" size="sm">
                <Icon name="pulse" size={12} /> Cardiology
              </Chip>
              <Chip size="sm" style={{ background: TOKENS.warnSoft, color: '#A05A0F' }}>STEMI</Chip>
              <Chip size="sm" style={{ background: TOKENS.surface2, color: TOKENS.text2 }}>Step 1 · 5 min</Chip>
            </div>
            <SansHead size={17} style={{ marginBottom: 10, letterSpacing: -0.3, lineHeight: 1.3 }}>
              A 47-year-old man presents with sudden crushing substernal chest pain radiating to the left arm…
            </SansHead>
            <div style={{
              fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text2, lineHeight: 1.55, marginBottom: 16,
              padding: '10px 12px', background: TOKENS.surface2, borderRadius: 12,
              borderLeft: `2.5px solid ${TOKENS.danger}`,
            }}>
              <strong style={{ color: TOKENS.ink }}>Vitals:</strong> BP 90/60 · HR 110 · O₂ 92% RA ·
              <strong style={{ color: TOKENS.ink }}> ECG:</strong> ST elevation in II, III, aVF.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: TOKENS.sans, fontSize: 9, fontWeight: 800, color: TOKENS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>Difficulty</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1,2,3,4,5].map(d => (
                      <span key={d} style={{ width: 10, height: 5, borderRadius: 2, background: d <= 3 ? TOKENS.accent : TOKENS.borderSoft }} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: TOKENS.sans, fontSize: 9, fontWeight: 800, color: TOKENS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>Solved by</div>
                  <div style={{ fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 800, color: TOKENS.ink }}>78% of peers</div>
                </div>
              </div>
              <button style={{
                padding: '11px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: TOKENS.ink, color: '#fff', fontFamily: TOKENS.sans, fontWeight: 800, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 6px 14px -4px rgba(14,21,56,0.35)',
              }}>
                Solve <Icon name="arrow" size={12} />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
window.HomeScreen = HomeScreen;

// ═══════════════════════════════════════════════════════════════
// Q-BANK
// ═══════════════════════════════════════════════════════════════
const QBankScreen = () => {
  const [filter, setFilter] = React.useState('all');
  const courses = [
    { id: 'med', name: 'Medicine',  sets: 7, done: 7, color: TOKENS.primary, soft: TOKENS.primarySoft, icon: 'stetho' },
    { id: 'sur', name: 'Surgery',   sets: 1, done: 0, color: TOKENS.accent,  soft: TOKENS.accentSoft,  icon: 'pulse' },
  ];
  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="Q-Bank" eyebrow="Question banks" />
      <div style={{ padding: `4px ${SCREEN_PAD}px 0` }}>
        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
          borderRadius: 16, marginBottom: 14,
        }}>
          <Icon name="search" size={18} color={TOKENS.text3} />
          <span style={{ fontFamily: TOKENS.sans, fontSize: 14, color: TOKENS.text3 }}>Search question sets…</span>
        </div>

        {/* filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { id: 'all', label: 'All', n: 2 },
            { id: 'prog', label: 'In progress', n: 1 },
            { id: 'done', label: 'Completed', n: 0 },
            { id: 'new', label: 'Not started', n: 1 },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
              background: filter === f.id ? TOKENS.ink : 'transparent',
              color: filter === f.id ? '#FBF8F2' : TOKENS.text,
              border: filter === f.id ? 'none' : `1px solid ${TOKENS.border}`,
              fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {f.label}
              <span style={{
                background: filter === f.id ? 'rgba(251,248,242,0.18)' : TOKENS.borderSoft,
                color: filter === f.id ? '#FBF8F2' : TOKENS.text2,
                borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{f.n}</span>
            </button>
          ))}
        </div>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Choose a course</Eyebrow>
            <Body size={12} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>2 courses · 8 sets · 7 done</Body>
          </div>
          <button style={{
            flexShrink: 0, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999,
            background: 'transparent', border: `1px solid ${TOKENS.border}`, cursor: 'pointer',
            fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 700, color: TOKENS.ink,
          }}>
            <Icon name="layers" size={14} /> Subjects
          </button>
        </div>

        {/* course cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.map(c => {
            const pct = Math.round((c.done / c.sets) * 100);
            return (
              <Card key={c.id} pad={0} radius={22} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, background: c.soft, color: c.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name={c.icon} size={24} stroke={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SansHead size={18} style={{ marginBottom: 2 }}>{c.name}</SansHead>
                    <Body size={12}>{c.sets} sets · {c.done} completed</Body>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Serif size={28} italic color={c.color}>{pct}<span style={{ fontSize: 16, color: TOKENS.text3 }}>%</span></Serif>
                  </div>
                </div>
                {/* progress bar */}
                <div style={{ height: 4, background: TOKENS.borderSoft, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', inset: 0, width: `${pct}%`, background: c.color,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
                  fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text3, fontWeight: 600 }}>
                  <span>{c.done === c.sets ? '✓ All complete' : `${c.sets - c.done} set${c.sets-c.done===1?'':'s'} remaining`}</span>
                  <span style={{ color: c.color }}>Open →</span>
                </div>
              </Card>
            );
          })}

          {/* empty hint at end of list (replaces dead space) */}
          <div style={{
            border: `1.5px dashed ${TOKENS.border}`, borderRadius: 22, padding: 24,
            display: 'flex', alignItems: 'center', gap: 14, marginTop: 4,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, background: TOKENS.surface2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: TOKENS.text3,
            }}>
              <Icon name="plus" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <SansHead size={14}>Add a course</SansHead>
              <Body size={12}>Unlock more Q-Bank sets from your library.</Body>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
window.QBankScreen = QBankScreen;

// ═══════════════════════════════════════════════════════════════
// COURSES (All Courses)
// ═══════════════════════════════════════════════════════════════
const CoursesScreen = () => {
  const courses = [
    { id: 'gyn', name: 'Gynaecology & Obstetrics', subjects: 1, lessons: 2, remaining: 2, pct: 0,  icon: 'baby',   color: '#9F4AB8', soft: '#F5E4FA' },
    { id: 'med', name: 'Internal Medicine',         subjects: 3, lessons: 8, remaining: 6, pct: 25, icon: 'stetho', color: TOKENS.primary, soft: TOKENS.primarySoft },
    { id: 'sur', name: 'Surgery',                   subjects: 2, lessons: 5, remaining: 4, pct: 20, icon: 'pulse',  color: TOKENS.accent,  soft: TOKENS.accentSoft },
    { id: 'ped', name: 'Paediatrics',               subjects: 1, lessons: 1, remaining: 1, pct: 0,  icon: 'heart',  color: '#C0392B', soft: '#FBE3DE' },
  ];
  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="All Courses" eyebrow="Library" />

      <div style={{ padding: `4px ${SCREEN_PAD}px 0` }}>
        <Body size={13} style={{ marginBottom: 18, maxWidth: 300 }}>
          Track your subjects, lessons, and progress across every course.
        </Body>

        {/* Stats — editorial row with big italic numerals */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {[
            { n: 4, label: 'Active' },
            { n: 1, label: 'In progress' },
            { n: 0, label: 'Completed' },
          ].map((s, i) => (
            <Card key={i} pad={16} radius={20} style={{ flex: 1, textAlign: 'left' }}>
              <Serif size={40} italic color={i===0 ? TOKENS.accent : TOKENS.ink} style={{ display: 'block', marginBottom: 4 }}>{s.n}</Serif>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: TOKENS.text3, textTransform: 'uppercase' }}>{s.label}</div>
            </Card>
          ))}
        </div>

        {/* My courses section header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <Eyebrow style={{ marginBottom: 4 }}>My courses</Eyebrow>
            <SansHead size={22} weight={800}>Your active tracks</SansHead>
          </div>
          <Chip tone="ok" size="sm"><span style={{ width: 6, height: 6, borderRadius: 999, background: TOKENS.ok, display: 'inline-block' }}></span>4 courses</Chip>
        </div>

        {/* Compact list of courses (not billboard cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map(c => (
            <Card key={c.id} pad={16} radius={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: c.soft, color: c.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={c.icon} size={22} stroke={1.7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SansHead size={16} style={{ marginBottom: 2 }}>{c.name}</SansHead>
                  <Body size={12}>{c.subjects} subject · {c.lessons} lessons · {c.remaining} remaining</Body>
                </div>
                <Serif size={24} italic color={c.color}>{c.pct}<span style={{ fontSize: 14 }}>%</span></Serif>
              </div>
              {/* progress */}
              <div style={{ height: 5, background: TOKENS.borderSoft, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.pct}%`, background: c.color, borderRadius: 999 }} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
window.CoursesScreen = CoursesScreen;
