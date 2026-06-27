/*
 * featureVisuals — the pastel "product UI" cards reused across the landing's
 * feature sections (extracted from the old ScrollMorphFeatures so the calm
 * scroll-reveal deep-dives can render real-looking screens without re-drawing).
 * Pure presentational, no motion — wrap them in framer where they're used.
 */

/* Inline SVG icons (replace the old emoji glyphs). All inherit `currentColor`
   and take size via className, so they tint with the surrounding text. */
function IcoCheck({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
  );
}
function IcoSparkle({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 6.6 6.6 1.9-6.6 1.9L12 19l-1.9-6.6L3.5 10.5l6.6-1.9z" /></svg>
  );
}
function IcoPin({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
  );
}
function IcoBell({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
  );
}
function IcoClock({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  );
}
function IcoTrendUp({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 7-7" /><path d="M17 8h4v4" /></svg>
  );
}
function IcoRefresh({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.3" /><path d="M3 4v4h4" /></svg>
  );
}

export function MCQVisual() {
  const opts = ['Aortic Regurgitation', 'Mitral Stenosis', 'Tricuspid Stenosis', 'Pulmonary Stenosis'];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <p className="mb-4 text-[13.5px] font-semibold leading-snug text-[#111118]">
        A 45-year-old presents with dyspnea and a mid-diastolic rumble at the apex. Most likely diagnosis?
      </p>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={o} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] ${i === 1 ? 'border-[#22c55e]/40 bg-[#d6ffe8]/70 font-bold text-[#15803d]' : 'border-black/8 text-[#374151]'}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i === 1 ? 'bg-[#22c55e] text-white' : 'bg-black/5 text-[#6b7280]'}`}>{String.fromCharCode(65 + i)}</span>
            {o}
            {i === 1 && <IcoCheck className="ml-auto h-4 w-4 text-[#22c55e]" />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#d6ffe8]/60 px-3 py-2 text-[12px] text-[#15803d]">
        <IcoSparkle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Classic MS: rumbling diastolic murmur + opening snap after S2.</span>
      </div>
    </div>
  );
}

export function MockExamVisual() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Mock Exam</span>
        <span className="font-mono text-2xl font-bold tabular-nums text-[#111118]">01:42:30</span>
      </div>
      <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-[#6b7280]"><span>Progress</span><span>34 / 100</span></div>
      <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-[#f1f1ee]"><span className="block h-full rounded-full bg-[#f59e0b]" style={{ width: '34%' }} /></div>
      <div className="flex items-center gap-4 rounded-xl bg-[#fff3d6]/60 p-3">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="7" /><circle cx="32" cy="32" r="26" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" strokeDasharray="163" strokeDashoffset="21" /></svg>
          <div className="absolute inset-0 grid place-items-center text-[14px] font-extrabold text-[#111118]">87%</div>
        </div>
        <div className="text-[13px] text-[#374151]"><b className="text-[#111118]">Predicted score</b><br />You’re on track to pass.</div>
      </div>
    </div>
  );
}

export function MasteryVisual() {
  const rings = [{ l: 'Cardio', v: 94, c: '#ef4444' }, { l: 'Pharma', v: 71, c: '#3b82f6' }, { l: 'Path', v: 83, c: '#8b5cf6' }, { l: 'Neuro', v: 65, c: '#10b981' }];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-4 grid grid-cols-4 gap-2">
        {rings.map((r) => (
          <div key={r.l} className="flex flex-col items-center">
            <div className="relative h-14 w-14">
              <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" /><circle cx="28" cy="28" r="22" fill="none" stroke={r.c} strokeWidth="6" strokeLinecap="round" strokeDasharray="138" strokeDashoffset={138 - (138 * r.v) / 100} /></svg>
              <div className="absolute inset-0 grid place-items-center text-[11px] font-bold text-[#111118]">{r.v}%</div>
            </div>
            <span className="mt-1 text-[10px] font-semibold text-[#6b7280]">{r.l}</span>
          </div>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }).map((_, i) => {
          const on = (i * 7) % 11 < 5;
          return <span key={i} className="aspect-square rounded-[3px]" style={{ background: on ? '#86efac' : '#eef0ec' }} />;
        })}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563eb]/10 px-3 py-1 text-[12px] font-bold text-[#2563eb]"><IcoTrendUp className="h-3.5 w-3.5" />+12% this week</span>
    </div>
  );
}

export function FlashcardVisual() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Flashcards</span>
        <div className="flex gap-1.5 text-[10.5px] font-bold">
          <span className="rounded-full bg-[#d6f0ff] px-2 py-0.5 text-[#0369a1]">New 8</span>
          <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[#b45309]">Learn 3</span>
          <span className="rounded-full bg-[#ffd6d6] px-2 py-0.5 text-[#b91c1c]">Due 5</span>
        </div>
      </div>
      <div className="rounded-xl bg-[#ffd6f0]/45 p-6 text-center ring-1 ring-black/5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#9d174d]">Cardiology</p>
        <p className="mt-2 text-[16px] font-bold leading-snug text-[#111118]">Most common cause of mitral stenosis?</p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6b7280]"><IcoRefresh className="h-3.5 w-3.5" />Tap to reveal answer</p>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] font-bold">
        <span className="rounded-lg bg-[#fee2e2] py-2 text-center text-[#b91c1c]">Again</span>
        <span className="rounded-lg bg-[#fff3d6] py-2 text-center text-[#b45309]">Hard</span>
        <span className="rounded-lg bg-[#d6ffe8] py-2 text-center text-[#15803d]">Good</span>
        <span className="rounded-lg bg-[#d6f0ff] py-2 text-center text-[#0369a1]">Easy</span>
      </div>
    </div>
  );
}

export function CanvasNotesVisual() {
  const points = [
    { c: '#10b981', a: 'Reduced cardiac output', b: ' → tissue hypoperfusion' },
    { c: '#3b82f6', a: 'Frank–Starling', b: ' compensates early' },
    { c: '#8b5cf6', a: 'RAAS activation', b: ' → fluid retention' },
  ];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Canvas Notes</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]"><IcoSparkle className="h-3 w-3" />Structured</span>
      </div>
      <h4 className="text-[16px] font-extrabold text-[#111118]">Heart Failure</h4>
      <div className="mt-3 space-y-2.5">
        {points.map((p) => (
          <div key={p.a} className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.c }} />
            <p className="text-[12.5px] leading-snug text-[#374151]"><b className="text-[#111118]">{p.a}</b>{p.b}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#e8f5e9]/70 px-3 py-2 text-[12px] font-semibold text-[#15803d]">
        <IcoPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Key: treat the cause, offload the heart.</span>
      </div>
    </div>
  );
}

export function PlannerVisual() {
  const tasks = [
    { t: 'Revise Cardiology: Heart Failure', tag: 'High', c: '#b91c1c', bg: '#fee2e2', done: false },
    { t: 'Pharmacology MCQs: 20 questions', tag: 'Today', c: '#0369a1', bg: '#d6f0ff', done: false },
    { t: 'Pathology flashcards (due)', tag: 'Med', c: '#b45309', bg: '#fff3d6', done: true },
  ];
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Today’s plan</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8d6ff] px-2 py-0.5 text-[10.5px] font-bold text-[#6d28d9]"><IcoBell className="h-3 w-3" />Reminder set</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.t} className="flex items-center gap-2.5 rounded-xl border border-black/8 px-3 py-2.5">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] ${task.done ? 'bg-[#22c55e] text-white' : 'border-[1.5px] border-black/15'}`}>{task.done ? <IcoCheck className="h-2.5 w-2.5" /> : null}</span>
            <span className={`text-[12.5px] leading-snug ${task.done ? 'text-[#9ca3af] line-through' : 'text-[#374151]'}`}>{task.t}</span>
            <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: task.bg, color: task.c }}>{task.tag}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#e8d6ff]/50 px-3 py-2 text-[12px] font-semibold text-[#6d28d9]">
        <IcoClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Next reminder in 25 min: Cardiology revision.</span>
      </div>
    </div>
  );
}

export function NotesReviewVisual() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_50px_-28px_rgba(17,17,24,0.35)] ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#6b7280]">Revision</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#d6ffe8] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]"><IcoCheck className="h-3 w-3" />Reviewed</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#374151]">
        The <mark className="rounded bg-[#ffe8d6] px-1 text-[#9a3412]">JVP rises</mark> in right heart failure, and a{' '}
        <mark className="rounded bg-[#fff3d6] px-1 text-[#b45309]">third heart sound (S3)</mark> points to volume overload.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f1ee]"><span className="block h-full rounded-full bg-[#fb923c]" style={{ width: '72%' }} /></div>
        <span className="text-[13px] font-extrabold tabular-nums text-[#111118]">72%</span>
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-[#6b7280]">18 of 25 cards mastered in this topic</p>
    </div>
  );
}
