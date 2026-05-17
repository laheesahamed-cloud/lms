// Design tokens + shared primitives.
// Bold system: warm cream surfaces, deep teal ink, single rust accent.
// Display: Instrument Serif (italic numerals). UI: Plus Jakarta Sans.

const TOKENS = {
  // surfaces — lavender background, white cards
  bg:        '#EFF1FB',
  surface:   '#FFFFFF',
  surface2:  '#F4F5FB',
  ink:       '#0E1538',      // deep navy — primary text + dark surfaces
  inkDeep:   '#070A20',
  // borders
  border:    '#E5E7F0',
  borderSoft:'#EEF0F6',
  // text
  text:      '#0E1538',
  text2:     '#5C6582',
  text3:     '#A8AECB',
  // brand — cobalt blue / royal purple
  primary:   '#3D5AFE',
  primarySoft:'#E5E9FF',
  primaryInk:'#2336CC',
  accent2:   '#8B5CF6',      // purple companion
  accent2Soft:'#F0E7FF',
  // single "accent" still used by Tweaks (defaults to the brand blue)
  accent:    '#3D5AFE',
  accentSoft:'#E5E9FF',
  // brand gradient (used SPARINGLY — hero CTA, streak ring, one motif/screen)
  grad:      'linear-gradient(135deg, #3D5AFE 0%, #8B5CF6 100%)',
  gradSoft:  'linear-gradient(135deg, #E5E9FF 0%, #F0E7FF 100%)',
  // semantic
  ok:        '#16A974',
  okSoft:    '#DEF5E7',
  warn:      '#F08A2C',      // streak orange
  warnSoft:  '#FFF1DE',
  danger:    '#E5484D',
  // type — single family, used confidently
  serif:     "'Bricolage Grotesque', 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif",  // display font for vibe headlines
  sans:      "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif",
};
window.TOKENS = TOKENS;

// ─── ICONS ───────────────────────────────────────────────────
const Icon = ({ name, size = 22, stroke = 1.7, color = 'currentColor', style }) => {
  const paths = {
    menu:    <><path d="M4 7h16M4 12h16M4 17h10"/></>,
    bell:    <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    search:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    moon:    <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></>,
    play:    <><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none"/></>,
    flame:   <><path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 1.5 2C11 11 9 8 12 3Z"/></>,
    target:  <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></>,
    trophy:  <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3"/><path d="M9 17h6l-1 3h-4l-1-3ZM10 13v4M14 13v4"/></>,
    doc:     <><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 13h6M9 17h6M9 9h3"/></>,
    book:    <><path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 0 2 2h13"/></>,
    list:    <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></>,
    cap:     <><path d="M3 9l9-4 9 4-9 4-9-4Z"/><path d="M7 11v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4M20 10v5"/></>,
    chart:   <><path d="M4 19V5M4 19h16"/><rect x="7" y="12" width="3" height="7"/><rect x="12" y="9" width="3" height="10"/><rect x="17" y="6" width="3" height="13"/></>,
    home:    <><path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9Z"/></>,
    arrow:   <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    arrowL:  <><path d="M19 12H5M11 6l-6 6 6 6"/></>,
    plus:    <><path d="M12 5v14M5 12h14"/></>,
    check:   <><path d="m5 12 5 5 9-11"/></>,
    chev:    <><path d="m9 6 6 6-6 6"/></>,
    chevD:   <><path d="m6 9 6 6 6-6"/></>,
    chevU:   <><path d="m6 15 6-6 6 6"/></>,
    spark:   <><path d="m12 3 1.5 5L18 9.5 13.5 11 12 16l-1.5-5L6 9.5 10.5 8 12 3Z"/></>,
    heart:   <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></>,
    stetho:  <><path d="M6 4v6a4 4 0 0 0 8 0V4"/><path d="M5 4h2M13 4h2M10 14v3a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="13" r="2"/></>,
    flask:   <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 14h9"/></>,
    pulse:   <><path d="M3 12h4l2-5 4 10 2-5h6"/></>,
    pill:    <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)"/><path d="m8.5 7.5 8 8" transform="rotate(-30 12 12)"/></>,
    baby:    <><circle cx="12" cy="9" r="5"/><path d="M9 9h.01M15 9h.01M10 12c.5 1 1.5 1 2 1s1.5 0 2-1M12 14v3M9 17h6"/></>,
    user:    <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    filter:  <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    layers:  <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5"/></>,
    clock:   <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    dna:     <><path d="M6 3c0 6 12 6 12 12s-12 6-12 12M18 3c0 6-12 6-12 12s12 6 12 12"/></>,
    info:    <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></>,
    fire:    <><path d="M12 2c0 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1.5-3 1.5-3s.5 1.5 1.5 1.5C12 9.5 10 7 12 2Z"/></>,
    award:   <><circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></>,
    open:    <><path d="M14 4h6v6M20 4l-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>,
    sliders: <><path d="M4 6h12M20 6h0M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="18" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }}>
      {paths[name]}
    </svg>
  );
};
window.Icon = Icon;

// ─── PHONE FRAME ─────────────────────────────────────────────
const PhoneScreen = ({ children, bg = TOKENS.bg, statusDark = false, scrollKey }) => {
  return (
    <div style={{
      width: 390, height: 844, borderRadius: 48,
      background: bg, overflow: 'hidden', position: 'relative',
      boxShadow: '0 1px 0 rgba(15,20,48,0.04), 0 30px 70px -22px rgba(21,37,46,0.28), 0 0 0 1px rgba(15,20,48,0.06)',
      fontFamily: TOKENS.sans, color: TOKENS.text,
    }}>
      {/* status bar */}
      <div style={{
        height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px 0 32px', position: 'relative', zIndex: 5,
        color: statusDark ? '#fff' : TOKENS.ink,
        fontWeight: 700, fontSize: 15, letterSpacing: -0.2, fontFamily: TOKENS.sans,
      }}>
        <span>9:41</span>
        <div style={{
          position: 'absolute', left: '50%', top: 11, transform: 'translateX(-50%)',
          width: 124, height: 36, borderRadius: 22, background: '#000',
        }} />
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
            <rect x="0" y="6.5" width="3" height="4.5" rx="0.6"/>
            <rect x="4.5" y="4" width="3" height="7" rx="0.6"/>
            <rect x="9" y="1.5" width="3" height="9.5" rx="0.6"/>
            <rect x="13.5" y="0" width="3" height="11" rx="0.6"/>
          </svg>
          <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
            <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" strokeOpacity="0.4"/>
            <rect x="2" y="2" width="19" height="8" rx="1.8" fill="currentColor"/>
            <path d="M24 4v4c.7-.3 1.2-1 1.2-2s-.5-1.7-1.2-2Z" fill="currentColor" fillOpacity="0.4"/>
          </svg>
        </span>
      </div>

      <div
        key={scrollKey}
        style={{
          position: 'absolute', inset: '50px 0 0 0', overflow: 'auto',
          scrollbarWidth: 'none',
        }}
        className="phone-scroll"
      >
        {children}
      </div>

      <div style={{
        position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3,
        background: statusDark ? 'rgba(255,255,255,0.55)' : 'rgba(21,37,46,0.4)',
        zIndex: 10, pointerEvents: 'none',
      }} />
    </div>
  );
};
window.PhoneScreen = PhoneScreen;

// ─── SHARED HEADER ────────────────────────────────────────────
// Tight: just title + 2 actions (search + avatar). Dark mode tucked into menu.
const AppHeader = ({ title, eyebrow, dark, onToggleDark, onMenu, density = 'cozy' }) => {
  const padY = density === 'compact' ? 12 : 18;
  return (
    <div style={{ padding: `${padY}px 24px 8px`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onMenu} style={{
        width: 42, height: 42, borderRadius: 14, background: 'transparent',
        border: `1px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: TOKENS.ink, padding: 0,
      }} aria-label="Menu">
        <Icon name="menu" size={20} />
      </button>
      <div style={{ flex: 1, lineHeight: 1.1 }}>
        {eyebrow && <div style={{
          fontFamily: TOKENS.sans, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          color: TOKENS.text3, textTransform: 'uppercase', marginBottom: 2,
        }}>{eyebrow}</div>}
        <div style={{
          fontFamily: TOKENS.serif, fontSize: 26, fontWeight: 700, color: TOKENS.ink,
          letterSpacing: -0.9, fontVariationSettings: "'opsz' 32",
        }}>{title}</div>
      </div>
      <button style={{
        width: 42, height: 42, borderRadius: 14, background: 'transparent',
        border: `1px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: TOKENS.ink, padding: 0,
      }} aria-label="Search">
        <Icon name="search" size={20} />
      </button>
      <button style={{
        width: 42, height: 42, borderRadius: 14,
        background: TOKENS.grad, border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#fff', fontFamily: TOKENS.sans,
        fontWeight: 800, fontSize: 13, padding: 0, letterSpacing: 0.3,
      }} aria-label="Profile">
        LA
      </button>
    </div>
  );
};
window.AppHeader = AppHeader;

// ─── BOTTOM TAB NAV ───────────────────────────────────────────
const TABS = [
  { id: 'courses', label: 'Courses', icon: 'book' },
  { id: 'qbank',   label: 'Q-Bank',  icon: 'list' },
  { id: 'home',    label: 'Home',    icon: 'home' },
  { id: 'lessons', label: 'Lessons', icon: 'doc' },
  { id: 'results', label: 'Results', icon: 'chart' },
];
const BottomNav = ({ active, onChange }) => {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 24,
      background: 'linear-gradient(to top, rgba(239,241,251,0.98) 60%, rgba(239,241,251,0))',
      pointerEvents: 'none', zIndex: 4,
    }}>
      <div style={{
        margin: '0 16px', height: 64, borderRadius: 24,
        background: TOKENS.ink, color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 8px', pointerEvents: 'auto',
        boxShadow: '0 12px 30px -10px rgba(14,21,56,0.4)',
      }}>
        {TABS.map(t => {
          const isActive = t.id === active;
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{
              flex: 1, height: 48, borderRadius: 16, border: 'none', cursor: 'pointer',
              background: isActive ? TOKENS.grad : 'transparent',
              color: isActive ? '#FFF' : 'rgba(255,255,255,0.65)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, fontFamily: TOKENS.sans, fontSize: 10, fontWeight: 700,
              letterSpacing: 0.2, transition: 'all 0.18s',
              padding: 0,
            }}>
              <Icon name={t.icon} size={20} stroke={isActive ? 2 : 1.7} />
              <span style={{ opacity: isActive ? 1 : 0.85 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
window.BottomNav = BottomNav;
window.TABS = TABS;

Object.assign(window, { TOKENS, Icon, PhoneScreen, AppHeader, BottomNav, TABS });
