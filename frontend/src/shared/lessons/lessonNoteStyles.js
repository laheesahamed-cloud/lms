export const noteTone = {
  symptoms: 'bg-[#dceefe]',
  causes: 'bg-[#fef0bc]',
  types: 'bg-[#e4e7ff]',
  diagnosis: 'bg-[#d6f2f0]',
  treat: 'bg-[#dff6e9]',
};

export const noteTilt = ['rotate-[-1.4deg]', 'rotate-[1.2deg]', 'rotate-[-2.1deg]', 'rotate-[1.8deg]'];

export const noteFloatPosition = [
  'top-[132px] right-2',
  'top-[440px] left-[-2px]',
  'top-[840px] right-5',
  'top-[1210px] left-3.5',
];

export const noteUi = {
  wrapper:
    'relative min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(156,217,255,0.28),transparent_30%),radial-gradient(circle_at_top_right,rgba(149,226,214,0.22),transparent_28%),linear-gradient(180deg,#f8fcff_0%,#fffef8_44%,#fbfcfe_100%)] px-3.5 pb-10 pt-3.5 min-[760px]:px-[22px] min-[760px]:pb-12 min-[760px]:pt-[18px]',
  embeddedWrapper: 'min-h-0 overflow-visible bg-transparent p-0',
  page: 'relative mx-auto max-w-[980px] pl-[18px] min-[760px]:pl-7',
  embeddedPage: 'max-w-none pl-0 min-[760px]:pl-0',
  spiral:
    'pointer-events-none fixed bottom-0 left-3 top-0 w-[18px] bg-[radial-gradient(circle,rgba(76,108,134,0.55)_2px,transparent_2.2px)] bg-[length:18px_28px] opacity-50',
  float:
    'pointer-events-none absolute text-2xl opacity-70 animate-hfFloat',
  embeddedFloat: 'opacity-50',
  hero:
    'sticky top-2.5 z-10 mb-[18px] rounded-[28px] border border-[rgba(216,227,237,0.85)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,250,245,0.92)),repeating-linear-gradient(to_bottom,rgba(86,131,177,0.08)_0,rgba(86,131,177,0.08)_1px,transparent_1px,transparent_32px)] px-4 pb-3.5 pt-[18px] shadow-[0_18px_32px_rgba(67,89,115,0.12)] backdrop-blur-[10px]',
  embeddedHero: 'top-0',
  miniDoodles: 'mb-2.5 text-[13px] tracking-[0.2em] text-[#3d90c8]',
  heroRow: 'grid grid-cols-[auto_1fr_auto] items-center gap-3',
  heroIcon:
    'grid size-[54px] rotate-[-4deg] place-items-center rounded-[18px] border-2 border-dashed border-[rgba(69,141,196,0.36)] bg-[#eef8ff] text-[26px]',
  titleWrap: 'relative',
  title:
    'm-0 font-["Comic_Sans_MS","Bradley_Hand","Marker_Felt",cursive] text-[clamp(2.35rem,10vw,4.2rem)] leading-[0.92] tracking-[0.02em] text-[#1d3a52]',
  scribble: 'mt-2.5 h-2.5 w-[92px] rotate-[-2deg] rounded-full border-b-4 border-[#61b3d8]',
  tabs:
    'flex gap-2.5 overflow-x-auto pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  tab:
    'shrink-0 rounded-full border border-[rgba(221,230,239,0.96)] bg-surface-card px-3.5 py-2.5 text-sm font-bold text-[#1d3a52] no-underline shadow-[0_6px_14px_rgba(98,118,138,0.08)]',
  lead:
    'm-0 mb-[18px] rotate-[-0.6deg] rounded-[22px] border border-[rgba(188,220,238,0.86)] bg-[linear-gradient(180deg,#f4fbff,#fffdf4)] px-4 py-[18px] text-base leading-[1.7] text-[#1d3a52] shadow-[0_12px_20px_rgba(97,106,117,0.06)]',
  section: 'relative mb-6',
  tape:
    'absolute left-[22px] top-[-6px] h-[22px] w-[68px] rotate-[-7deg] border border-[rgba(115,177,206,0.28)] bg-[rgba(216,242,255,0.78)]',
  sectionHead:
    'mb-3 flex flex-col gap-2 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between',
  sticky:
    'inline-block self-start rounded-[14px] px-4 py-2.5 font-["Comic_Sans_MS","Bradley_Hand","Marker_Felt",cursive] text-[1.2rem] font-bold text-[#1d3a52] shadow-[0_8px_16px_rgba(87,111,130,0.12)] rotate-[-2deg]',
  note:
    'pl-1 font-["Comic_Sans_MS","Bradley_Hand","Marker_Felt",cursive] text-[0.98rem] text-[#5b7388]',
  cards:
    'grid auto-cols-[minmax(230px,78%)] grid-flow-col gap-3.5 overflow-x-auto px-0.5 pb-2 pt-1.5 [scrollbar-width:thin] min-[760px]:grid-flow-row min-[760px]:grid-cols-4 min-[760px]:overflow-visible',
  card:
    'relative min-h-[198px] rounded-3xl border border-[rgba(223,229,237,0.98)] bg-[#fffef8] px-4 pb-4 pt-[18px] shadow-[0_16px_26px_rgba(87,105,125,0.1)] min-[760px]:min-h-[222px]',
  cardIcon: 'mb-2.5 text-[2rem]',
  pin:
    'absolute right-3.5 top-3 size-2.5 rounded-full bg-[#ef709a] shadow-[0_0_0_4px_rgba(239,112,154,0.16)]',
  cardTitle: 'm-0 mb-2 text-[1.05rem] text-[#1d3a52]',
  cardText: 'm-0 leading-[1.6] text-[#5b7388]',
  listCard:
    'relative rotate-[-0.7deg] rounded-3xl border border-[rgba(219,228,236,0.96)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,252,246,0.98)),repeating-linear-gradient(to_bottom,rgba(62,118,170,0.12)_0,rgba(62,118,170,0.12)_1px,transparent_1px,transparent_34px)] px-4 py-[18px] shadow-[0_14px_26px_rgba(83,103,122,0.08)]',
  checklist: 'm-0 grid list-none gap-3.5 p-0',
  checklistItem: 'grid grid-cols-[auto_1fr] items-start gap-2.5 leading-[1.7] text-[#1d3a52]',
  check:
    'inline-grid size-7 place-items-center rounded-[10px] bg-[rgba(209,238,255,0.92)] font-extrabold text-[#21669a]',
  pillRow: 'flex flex-wrap gap-2.5 pt-[18px]',
  pill:
    'rounded-full border border-dashed border-[rgba(169,191,214,0.9)] bg-surface-card px-3 py-2 text-[13px] font-bold text-[#506a80]',
  footer:
    'px-0 pb-1.5 pt-3 text-center font-["Comic_Sans_MS","Bradley_Hand","Marker_Felt",cursive] text-[1.05rem] text-[#7d718d]',
  embeddedFooter: 'pb-0',
};
