/*
 * TestimonialsMarquee — section 8. Two-row infinite CSS marquee (opposite
 * directions), pause on hover. 8 testimonials with Dicebear avatars, indigo
 * star ratings, rotating pastel left-borders. Cream bg.
 */
const PASTELS = ['#ffd6d6', '#d6f0ff', '#e8d6ff', '#d6ffe8', '#fff3d6', '#ffd6f0', '#e8f5e9', '#ffe8d6'];

const TESTIMONIALS = [
  { name: 'Tharushi M.', uni: 'Faculty of Medicine, Kelaniya', quote: 'The MCQ explanations are unreal — every wrong answer actually teaches you something. I went from failing mocks to 87% in 3 months.' },
  { name: 'Ravindu P.', uni: 'University of Colombo', quote: 'Having all subjects in one place with real progress tracking changed everything. No more guessing what to study next.' },
  { name: 'Amali F.', uni: 'Sabaragamuwa University', quote: 'The streak system kept me consistent when I had zero motivation. Pharmacology used to scare me — now it’s my best subject.' },
  { name: 'Dilan W.', uni: 'University of Peradeniya', quote: 'Mock exam mode is incredibly realistic. The timer pressure, the interface — it prepared me mentally for the real thing.' },
  { name: 'Nethmi K.', uni: 'University of Ruhuna', quote: 'I tried the free trial for a week. Subscribed the next day. The quality of the explanations is unlike anything I’ve seen.' },
  { name: 'Chathura S.', uni: 'NSBM Green University', quote: 'The Pathology explanations read like a senior doctor is sitting next to you. That’s the level of detail I needed.' },
  { name: 'Shanika R.', uni: 'University of Jaffna', quote: 'I’ve told every single batchmate about xyndrome. When something works this well, you just share it.' },
  { name: 'Prathap A.', uni: 'Colombo South Teaching Hospital', quote: 'Biochemistry was my nightmare subject. Six weeks of targeted practice here and I scored 79% in the mock. Genuinely shocked.' },
];

function Stars() {
  return (
    <div className="flex gap-0.5 text-[#2563eb]" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M6 .5l1.39 2.82 3.11.45-2.25 2.19.53 3.1L6 7.5l-2.78 1.56.53-3.1L1.5 3.77l3.11-.45z" />
        </svg>
      ))}
    </div>
  );
}

function Card({ t, accent }) {
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.name)}`;
  return (
    <figure
      className="w-[340px] shrink-0 rounded-2xl bg-white p-6 shadow-[0_14px_36px_-24px_rgba(17,17,24,0.35)] ring-1 ring-black/5"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <img src={avatar} alt="" width="40" height="40" loading="lazy" className="h-10 w-10 rounded-full bg-[#f1f1ee]" />
        <figcaption className="min-w-0">
          <div className="truncate text-[14px] font-bold text-[#111118]">{t.name}</div>
          <div className="truncate text-[11.5px] text-[#6b7280]">{t.uni}</div>
        </figcaption>
        <div className="ml-auto"><Stars /></div>
      </div>
      <blockquote className="text-[13.5px] italic leading-relaxed text-[#374151]">“{t.quote}”</blockquote>
    </figure>
  );
}

function Row({ items, dir }) {
  // Duplicate the list so the translateX(-50%) loop is seamless.
  const doubled = [...items, ...items];
  return (
    <div className="lpv2-marquee group flex overflow-hidden">
      <div className={`flex w-max gap-4 ${dir === 'right' ? 'lpv2-marquee-track-r' : 'lpv2-marquee-track-l'} group-hover:[animation-play-state:paused]`}>
        {doubled.map((t, i) => <Card key={`${t.name}-${i}`} t={t} accent={PASTELS[i % PASTELS.length]} />)}
      </div>
    </div>
  );
}

export function TestimonialsMarquee() {
  const rowA = TESTIMONIALS.slice(0, 4);
  const rowB = TESTIMONIALS.slice(4);
  return (
    <section className="lpv2-section overflow-hidden bg-[#fafaf7]">
      <h2 className="font-display mb-12 text-center text-[clamp(32px,5vw,52px)] leading-tight text-[#111118]">
        Trusted by Sri Lanka’s future doctors
      </h2>
      <div className="flex flex-col gap-4">
        <Row items={rowA} dir="left" />
        <Row items={rowB} dir="right" />
      </div>
    </section>
  );
}

export default TestimonialsMarquee;
