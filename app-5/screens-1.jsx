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
const HomeScreen = ({ user = 'Laheez', onNav, isDesktop }) => {
  // game-state mock data
  const xp = 240, xpTarget = 470, level = 7;
  const xpPct = Math.round((xp / xpTarget) * 100);
  const hearts = 4, heartsMax = 5;
  const streak = 5, gems = 12;

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* ── Game stats bar (replaces standard header) ─────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px 12px',
        flexWrap: 'wrap',
      }}>
        <GameStat icon="heart" value={`${hearts}/${heartsMax}`} bg={TOKENS.pinkSoft} fg={TOKENS.pink} pulse />
        <GameStat icon="flame" value={`${streak}`} suffix="d" bg={TOKENS.goldSoft} fg="#B07500" />
        <GameStat icon="bolt"  value={`${xp}`} bg={TOKENS.goldSoft} fg="#B07500" />
        <GameStat icon="gem"   value={`${gems}`} bg={TOKENS.goldSoft} fg="#B07500" />
        <div style={{ flex: 1 }} />
        <button style={{
          width: 42, height: 42, borderRadius: 14,
          background: TOKENS.grad, border: '3px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontFamily: TOKENS.sans,
          fontWeight: 800, fontSize: 13, padding: 0, letterSpacing: 0.3,
          boxShadow: '0 6px 14px -4px rgba(61,90,254,0.45)',
        }} aria-label="Profile">LA</button>
      </div>

      {/* ── HERO: mascot + level + XP bar ─────────────────────────────── */}
      <div style={{ padding: `0 ${SCREEN_PAD}px` }}>
        <div style={{
          background: TOKENS.surface, borderRadius: 28, padding: 22,
          border: `1.5px solid ${TOKENS.border}`,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 0 #fff inset, 0 14px 28px -18px rgba(61,90,254,0.18)',
        }}>
          {/* decorative blobs */}
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: 999,
            background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 60%)' }} />
          <div style={{ position: 'absolute', left: -30, bottom: -50, width: 160, height: 160, borderRadius: 999,
            background: 'radial-gradient(circle, rgba(61,90,254,0.14), transparent 60%)' }} />
          {/* sparkle decoration */}
          <SparkleDot top={28} right={28} size={14} color={TOKENS.gold} delay={0} />
          <SparkleDot top={60} right={60} size={10} color={TOKENS.accent2} delay={0.7} />
          <SparkleDot top={20} right={86} size={8} color={TOKENS.gold} delay={1.4} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18, position: 'relative' }}>
            <Mascot size={72} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 999,
                  background: TOKENS.grad, color: '#fff',
                  fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 10px -3px rgba(61,90,254,0.45)',
                }}>
                  <Icon name="shield" size={11} stroke={2.4} /> Lvl {level}
                </div>
                <span style={{
                  fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 800, color: TOKENS.text3,
                  letterSpacing: 0.8, textTransform: 'uppercase',
                }}>Resident</span>
              </div>
              <div>
                <span style={{ fontFamily: TOKENS.serif, fontSize: 26, fontWeight: 700, color: TOKENS.ink,
                  letterSpacing: -0.6, fontVariationSettings: "'opsz' 32" }}>Hey&nbsp;</span>
                <span style={{
                  fontFamily: TOKENS.serif, fontSize: 26, fontWeight: 700,
                  letterSpacing: -0.6, fontVariationSettings: "'opsz' 32",
                  background: TOKENS.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: 'transparent',
                }}>{user}</span>
                <span style={{ fontSize: 22, marginLeft: 4 }}>✨</span>
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: 4,
                  background: TOKENS.gradGold, alignItems: 'center', justifyContent: 'center', color: '#fff',
                  boxShadow: '0 2px 6px -1px rgba(255,184,0,0.55)' }}>
                  <Icon name="bolt" size={10} stroke={0} />
                </span>
                <span style={{ fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800, color: TOKENS.ink }}>{xp} XP</span>
                <span style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text2, fontWeight: 600 }}>
                  / {xpTarget}
                </span>
              </div>
              <span style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 800, color: TOKENS.text2, letterSpacing: 0.1 }}>
                {xpTarget - xp} XP to Lvl {level + 1} →
              </span>
            </div>
            <div style={{ position: 'relative', height: 10, borderRadius: 999, background: TOKENS.borderSoft, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${xpPct}%`, borderRadius: 999,
                background: TOKENS.gradGold,
                boxShadow: '0 0 14px rgba(255,184,0,0.5)',
                animation: 'vibeShimmer 3s ease-in-out infinite',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── TODAY'S QUEST ─────────────────────────────────────────────── */}
      <div style={{ padding: `18px ${SCREEN_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 4 }}>
          <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: TOKENS.accent2 }}>
            <Icon name="bolt" size={12} color={TOKENS.gold} stroke={0} /> Today's quest
          </Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 11, color: TOKENS.text3, fontWeight: 800, letterSpacing: 0.4 }}>
            QUEST 27 / 90
          </span>
        </div>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg, #FFF6E0 0%, #FFE9CA 100%)`,
          borderRadius: 28, padding: 22,
          border: '1.5px solid rgba(255,184,0,0.25)',
          boxShadow: '0 14px 30px -16px rgba(255,184,0,0.35)',
        }}>
          {/* ECG decoration */}
          <svg style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 60, opacity: 0.18 }}
            viewBox="0 0 400 60" preserveAspectRatio="none">
            <path d="M0 30 L80 30 L92 22 L100 38 L106 4 L114 56 L120 18 L130 30 L210 30 L222 22 L230 38 L236 4 L244 56 L250 18 L260 30 L340 30 L352 22 L360 38 L366 4 L374 56 L380 18 L400 30"
              stroke={TOKENS.accent2} strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          <SparkleDot top={20} right={20} size={12} color={TOKENS.gold} delay={0.2} />
          <SparkleDot top={40} right={48} size={8}  color={TOKENS.accent2} delay={1} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Chip size="sm" style={{ background: '#fff', color: TOKENS.primary, border: `1px solid ${TOKENS.border}` }}>
                <Icon name="pulse" size={12} /> Cardiology
              </Chip>
              <Chip size="sm" style={{ background: 'rgba(255,255,255,0.7)', color: TOKENS.text2 }}>5 min · 3 questions</Chip>
            </div>
            <SansHead size={20} weight={800} style={{ marginBottom: 8, letterSpacing: -0.4, color: TOKENS.ink, lineHeight: 1.25 }}>
              Diagnose the chest pain
            </SansHead>
            <Body size={13} style={{ marginBottom: 16, color: 'rgba(40,30,8,0.7)', lineHeight: 1.5 }}>
              A 47-yo man, sudden crushing substernal pain → left arm. BP 90/60, ECG: ST elevation II, III, aVF.
              Pick the dx, the drug, the next move.
            </Body>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RewardChip icon="bolt" value="+50" color={TOKENS.gold} bg="#fff" />
                <RewardChip icon="gem"  value="+1"  color={TOKENS.gold} bg="#fff" />
              </div>
              <button style={{
                padding: '12px 22px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: TOKENS.grad, color: '#fff',
                fontFamily: TOKENS.sans, fontWeight: 800, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 10px 22px -8px rgba(61,90,254,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
                animation: 'vibeShimmer 3s ease-in-out infinite',
              }}>
                Start <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── POWER-UPS ─────────────────────────────────────────────────── */}
      <div style={{ padding: `18px ${SCREEN_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 4 }}>
          <Eyebrow>Power-ups</Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 11, color: TOKENS.gem, fontWeight: 800, letterSpacing: 0.4 }}>
            SHOP →
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <PowerUp icon="flame"  label="Freeze" count={2} grad={TOKENS.grad} />
          <PowerUp icon="spark"  label="50/50"  count={5} grad={TOKENS.grad} />
          <PowerUp icon="bolt"   label="2× XP"  count={1} grad={TOKENS.gradGold} />
          <PowerUp icon="clock"  label="Time+"  count={3} grad={TOKENS.grad} />
        </div>
      </div>

      {/* ── WEEKLY LEAGUE ─────────────────────────────────────────────── */}
      <div style={{ padding: `20px ${SCREEN_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 4 }}>
          <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="crown" size={12} color={TOKENS.gold} /> Weekly league
          </Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 11, color: TOKENS.text3, fontWeight: 800, letterSpacing: 0.4 }}>
            ENDS IN 3D 14H
          </span>
        </div>
        <Card pad={18} radius={24} style={{ position: 'relative', overflow: 'hidden' }}>
          {/* league header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: TOKENS.grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 8px 18px -6px rgba(61,90,254,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>
              <Icon name="gem" size={22} stroke={1.6} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: TOKENS.sans, fontSize: 16, fontWeight: 800, color: TOKENS.ink, letterSpacing: -0.2 }}>Diamond league</div>
                <Chip size="sm" style={{ background: TOKENS.goldSoft, color: '#B07500', fontSize: 10, padding: '2px 7px' }}>TIER 4</Chip>
              </div>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 12, color: TOKENS.text2, fontWeight: 600 }}>
                Top 10 advance · You're #14 of 30
              </div>
            </div>
            <Serif size={28} color={TOKENS.accent2}>#14</Serif>
          </div>
          {/* top 3 + you */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { rank: 1, name: 'Priya M.',  xp: 1240, color: TOKENS.gold,    avatar: 'PM' },
              { rank: 2, name: 'Diego R.',  xp: 980,  color: '#B5B5B5',      avatar: 'DR' },
              { rank: 3, name: 'Sara K.',   xp: 890,  color: '#C97B45',      avatar: 'SK' },
              { rank: '…', name: '', xp: '', color: TOKENS.text3, avatar: null, divider: true },
              { rank: 14, name: 'You',     xp: 240,  color: TOKENS.accent,   avatar: 'LA', you: true },
            ].map((r, i) => (
              r.divider ? (
                <div key={i} style={{ textAlign: 'center', fontFamily: TOKENS.sans, fontSize: 14, color: TOKENS.text3, fontWeight: 700, letterSpacing: 2 }}>···</div>
              ) : (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 12,
                  background: r.you ? TOKENS.accentSoft : 'transparent',
                  border: r.you ? `1.5px solid ${TOKENS.accent}` : '1.5px solid transparent',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: r.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: TOKENS.sans, fontWeight: 800, fontSize: 11,
                  }}>{r.rank}</div>
                  <div style={{
                    width: 28, height: 28, borderRadius: 9,
                    background: r.you ? TOKENS.grad : TOKENS.surface2,
                    color: r.you ? '#fff' : TOKENS.ink,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: TOKENS.sans, fontWeight: 800, fontSize: 11, letterSpacing: 0.2,
                  }}>{r.avatar}</div>
                  <div style={{ flex: 1, fontFamily: TOKENS.sans, fontSize: 14, fontWeight: r.you ? 800 : 700, color: TOKENS.ink }}>{r.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800, color: r.you ? TOKENS.accent : TOKENS.ink }}>
                    <Icon name="bolt" size={11} color={TOKENS.gold} stroke={0}/> {r.xp}
                  </div>
                </div>
              )
            ))}
          </div>
        </Card>
      </div>

      {/* ── ACHIEVEMENTS ──────────────────────────────────────────────── */}
      <div style={{ padding: `20px ${SCREEN_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 4 }}>
          <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="medal" size={12} color={TOKENS.gold} /> Achievements
          </Eyebrow>
          <span style={{ fontFamily: TOKENS.sans, fontSize: 11, color: TOKENS.text3, fontWeight: 800, letterSpacing: 0.4 }}>
            7 / 32 UNLOCKED
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { name: 'First case',  icon: 'check',  bg: TOKENS.grad,     unlocked: true },
            { name: '5-day streak', icon: 'flame',  bg: TOKENS.gradGold, unlocked: true },
            { name: 'Cardio ace', icon: 'pulse',  bg: TOKENS.grad,     unlocked: true },
            { name: 'Top 10',     icon: 'crown',  bg: '#E5E7F0',       unlocked: false },
          ].map((a, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 16,
              background: a.unlocked ? a.bg : a.bg,
              border: a.unlocked ? 'none' : `1.5px dashed ${TOKENS.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, color: a.unlocked ? '#fff' : TOKENS.text3,
              filter: a.unlocked ? 'none' : 'grayscale(0.4)',
              boxShadow: a.unlocked ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px -6px rgba(14,21,56,0.2)' : 'none',
              position: 'relative',
            }}>
              <Icon name={a.icon} size={22} stroke={a.unlocked ? 2 : 1.5} />
              <div style={{ fontFamily: TOKENS.sans, fontSize: 9, fontWeight: 800, textAlign: 'center', letterSpacing: 0.2, padding: '0 4px' }}>
                {a.name}
              </div>
              {!a.unlocked && (
                <div style={{
                  position: 'absolute', bottom: 6, right: 6, width: 14, height: 14, borderRadius: 999,
                  background: '#fff', border: `1.5px solid ${TOKENS.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: TOKENS.text3,
                }}>🔒</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Game-feel sub-components ─────────────────────────────────
const GameStat = ({ icon, value, suffix = '', bg, fg, pulse }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 11px', borderRadius: 999,
    background: bg, color: fg,
    fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800, letterSpacing: -0.1,
    position: 'relative',
  }}>
    <Icon name={icon} size={14} stroke={icon === 'bolt' ? 0 : 1.9} />
    <span>{value}{suffix && <span style={{ opacity: 0.7, marginLeft: 1 }}>{suffix}</span>}</span>
    {pulse && (
      <span style={{
        position: 'absolute', top: 6, right: 7, width: 5, height: 5, borderRadius: 999,
        background: fg, animation: 'vibePulse 1.8s ease-out infinite',
      }} />
    )}
  </div>
);

const Mascot = ({ size = 72 }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    {/* glow */}
    <div style={{
      position: 'absolute', inset: -4, borderRadius: '50%',
      background: TOKENS.grad, opacity: 0.35, filter: 'blur(10px)',
    }} />
    {/* body */}
    <div style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      background: TOKENS.grad,
      boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.12), inset 0 4px 0 rgba(255,255,255,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 60 60" fill="none">
        {/* face white circle */}
        <circle cx="30" cy="32" r="20" fill="#fff" />
        {/* eyes */}
        <circle cx="22" cy="30" r="3" fill="#0E1538"/>
        <circle cx="38" cy="30" r="3" fill="#0E1538"/>
        <circle cx="23" cy="29" r="0.9" fill="#fff"/>
        <circle cx="39" cy="29" r="0.9" fill="#fff"/>
        {/* smile */}
        <path d="M22 38 q8 6 16 0" stroke="#0E1538" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        {/* blush */}
        <circle cx="18" cy="36" r="2" fill="#FF4D8F" opacity="0.4"/>
        <circle cx="42" cy="36" r="2" fill="#FF4D8F" opacity="0.4"/>
        {/* stethoscope hat */}
        <path d="M18 16 Q30 6 42 16" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <circle cx="42" cy="16" r="3" fill="#fff" stroke="#0E1538" strokeWidth="1.5"/>
        <circle cx="18" cy="16" r="3" fill="#fff" stroke="#0E1538" strokeWidth="1.5"/>
      </svg>
    </div>
  </div>
);

const SparkleDot = ({ top, right, size = 10, color, delay = 0 }) => (
  <span style={{
    position: 'absolute', top, right, width: size, height: size, color,
    animation: `vibeSparkle 2.4s ease-in-out ${delay}s infinite`,
  }}>
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <path d="M12 2 L13.5 9.5 L21 12 L13.5 14.5 L12 22 L10.5 14.5 L3 12 L10.5 9.5 Z"/>
    </svg>
  </span>
);

const RewardChip = ({ icon, value, color, bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 11px', borderRadius: 999,
    background: bg, color, fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800,
    border: `1.5px solid ${color}33`,
    boxShadow: '0 3px 8px -2px rgba(14,21,56,0.12)',
  }}>
    <Icon name={icon} size={12} stroke={icon === 'bolt' ? 0 : 1.9} />
    {value}
  </span>
);

const PowerUp = ({ icon, label, count, grad }) => (
  <div style={{
    aspectRatio: '1', borderRadius: 18,
    background: '#fff', border: `1.5px solid ${TOKENS.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, position: 'relative', overflow: 'hidden',
    boxShadow: '0 4px 10px -4px rgba(14,21,56,0.1)',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 11,
      background: grad, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
    }}>
      <Icon name={icon} size={18} stroke={1.9} />
    </div>
    <div style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 800, color: TOKENS.ink, letterSpacing: -0.1 }}>{label}</div>
    <div style={{
      position: 'absolute', top: 6, right: 6,
      minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
      background: TOKENS.ink, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 800,
    }}>{count}</div>
  </div>
);

window.HomeScreen = HomeScreen;

// ═══════════════════════════════════════════════════════════════
// Q-BANK
// ═══════════════════════════════════════════════════════════════
const QBankScreen = () => {
  const [filter, setFilter] = React.useState('all');
  const courses = [
    { id: 'med', name: 'Medicine',  sets: 7, done: 7, icon: 'stetho' },
    { id: 'sur', name: 'Surgery',   sets: 1, done: 0, icon: 'pulse'  },
  ];
  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="Q-Bank" eyebrow="Question banks" />
      <div style={{ padding: `4px ${SCREEN_PAD}px 0` }}>
        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
          background: TOKENS.surface, border: `1.5px solid ${TOKENS.border}`,
          borderRadius: 18, marginBottom: 14,
        }}>
          <Icon name="search" size={18} color={TOKENS.text3} />
          <span style={{ fontFamily: TOKENS.sans, fontSize: 14, color: TOKENS.text3, fontWeight: 500 }}>Search question sets…</span>
        </div>

        {/* filter chips — active is brand grad */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { id: 'all',  label: 'All', n: 2 },
            { id: 'prog', label: 'In progress', n: 1 },
            { id: 'done', label: 'Completed', n: 0 },
            { id: 'new',  label: 'Not started', n: 1 },
          ].map(f => {
            const isActive = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: '9px 15px', borderRadius: 999, cursor: 'pointer',
                background: isActive ? TOKENS.grad : 'transparent',
                color: isActive ? '#fff' : TOKENS.text,
                border: isActive ? 'none' : `1.5px solid ${TOKENS.border}`,
                fontFamily: TOKENS.sans, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: isActive ? '0 6px 14px -4px rgba(61,90,254,0.45)' : 'none',
                letterSpacing: -0.1,
              }}>
                {f.label}
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.22)' : TOKENS.borderSoft,
                  color: isActive ? '#fff' : TOKENS.text2,
                  borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 800,
                }}>{f.n}</span>
              </button>
            );
          })}
        </div>

        {/* section header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Choose a course</Eyebrow>
            <Body size={12} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>2 courses · 8 sets · 7 done</Body>
          </div>
          <button style={{
            flexShrink: 0, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
            background: 'transparent', border: `1.5px solid ${TOKENS.border}`, cursor: 'pointer',
            fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 700, color: TOKENS.ink,
          }}>
            <Icon name="layers" size={14} /> Subjects
          </button>
        </div>

        {/* course cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map(c => {
            const pct = Math.round((c.done / c.sets) * 100);
            const isDone = c.done === c.sets;
            return (
              <Card key={c.id} pad={18} radius={24} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* gradient mascot tile */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 18, background: TOKENS.grad,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                      boxShadow: '0 8px 18px -6px rgba(61,90,254,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                    }}>
                      <Icon name={c.icon} size={26} stroke={1.7} />
                    </div>
                    {isDone && (
                      <div style={{
                        position: 'absolute', bottom: -3, right: -3,
                        width: 22, height: 22, borderRadius: 999,
                        background: TOKENS.gradGold, color: '#fff',
                        border: '2px solid #fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 3px 8px -2px rgba(255,184,0,0.55)',
                      }}>
                        <Icon name="check" size={12} stroke={2.4} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SansHead size={18} style={{ marginBottom: 3 }}>{c.name}</SansHead>
                    <Body size={12}>{c.sets} sets · {c.done}/{c.sets} done</Body>
                  </div>
                  {/* circular progress ring */}
                  <ProgressRing pct={pct} size={52} stroke={5} />
                </div>
                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: `1px solid ${TOKENS.borderSoft}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 700,
                }}>
                  <span style={{ color: isDone ? TOKENS.ok : TOKENS.text3, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {isDone
                      ? (<><Icon name="check" size={12} stroke={2.4}/> All sets complete</>)
                      : `${c.sets - c.done} set${c.sets-c.done===1?'':'s'} remaining`}
                  </span>
                  <span style={{
                    color: '#fff',
                    background: TOKENS.grad,
                    padding: '6px 12px', borderRadius: 999,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    boxShadow: '0 4px 10px -3px rgba(61,90,254,0.4)',
                  }}>
                    {isDone ? 'Review' : 'Play'} <Icon name="arrow" size={11} />
                  </span>
                </div>
              </Card>
            );
          })}

          {/* end-of-list "Add a course" affordance */}
          <div style={{
            border: `1.5px dashed ${TOKENS.border}`, borderRadius: 24, padding: 22,
            display: 'flex', alignItems: 'center', gap: 14, marginTop: 4,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, background: TOKENS.surface2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: TOKENS.text3,
            }}>
              <Icon name="plus" size={22} />
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

// ─── ProgressRing — circular progress, brand grad fill ────────
const ProgressRing = ({ pct, size = 52, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`pring-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={TOKENS.primary}/>
            <stop offset="100%" stopColor={TOKENS.accent2}/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke={TOKENS.borderSoft} strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={`url(#pring-${size})`} strokeWidth={stroke}
          fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: TOKENS.sans, fontSize: size >= 50 ? 13 : 11, fontWeight: 800, color: TOKENS.ink,
        letterSpacing: -0.3,
      }}>
        {pct}<span style={{ fontSize: 9, marginLeft: 1, color: TOKENS.text3 }}>%</span>
      </div>
    </div>
  );
};
window.ProgressRing = ProgressRing;

// ═══════════════════════════════════════════════════════════════
// COURSES (All Courses)
// ═══════════════════════════════════════════════════════════════
const CoursesScreen = () => {
  const courses = [
    { id: 'gyn', name: 'Gynaecology & Obstetrics', subjects: 1, lessons: 2, remaining: 2, pct: 0,  icon: 'baby'   },
    { id: 'med', name: 'Internal Medicine',         subjects: 3, lessons: 8, remaining: 6, pct: 25, icon: 'stetho' },
    { id: 'sur', name: 'Surgery',                   subjects: 2, lessons: 5, remaining: 4, pct: 20, icon: 'pulse'  },
    { id: 'ped', name: 'Paediatrics',               subjects: 1, lessons: 1, remaining: 1, pct: 0,  icon: 'heart'  },
  ];
  return (
    <div style={{ paddingBottom: 120 }}>
      <AppHeader title="All Courses" eyebrow="Library" />

      <div style={{ padding: `4px ${SCREEN_PAD}px 0` }}>
        <Body size={13} style={{ marginBottom: 18, maxWidth: 320 }}>
          Track your subjects, lessons, and progress across every course.
        </Body>

        {/* Stat tiles — clean 3-up with single accent on Active */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {[
            { n: 4, label: 'Active',      grad: true },
            { n: 1, label: 'In progress', grad: false },
            { n: 0, label: 'Completed',   grad: false },
          ].map((s, i) => (
            <Card key={i} pad={16} radius={20} style={{ flex: 1 }}>
              <span style={{
                fontFamily: TOKENS.sans, fontSize: 38, fontWeight: 800,
                letterSpacing: -1.2, lineHeight: 1, display: 'block', marginBottom: 6,
                ...(s.grad ? {
                  background: TOKENS.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: 'transparent',
                } : { color: TOKENS.ink }),
              }}>{s.n}</span>
              <div style={{ fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: TOKENS.text3, textTransform: 'uppercase' }}>{s.label}</div>
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

        {/* Course list — gradient tiles, progress ring */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map(c => (
            <Card key={c.id} pad={18} radius={24}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, background: TOKENS.grad,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  flexShrink: 0,
                  boxShadow: '0 6px 14px -5px rgba(61,90,254,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}>
                  <Icon name={c.icon} size={24} stroke={1.7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SansHead size={16} style={{ marginBottom: 3 }}>{c.name}</SansHead>
                  <Body size={12}>
                    {c.subjects} subject · {c.lessons} lessons
                    {c.remaining > 0 && <> · <span style={{ color: TOKENS.text, fontWeight: 700 }}>{c.remaining} left</span></>}
                  </Body>
                </div>
                <window.ProgressRing pct={c.pct} size={48} stroke={4} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
window.CoursesScreen = CoursesScreen;
