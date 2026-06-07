/*
 * MediaStrip — a light "peek inside" band that shows the medical
 * images (public/landing) as small rounded cards in an infinite marquee.
 * Keeps them small + tasteful so the editorial look stays clean.
 */
const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const img = (n) => `${ASSET}landing/${n}`;

// Lead with the cleaner renders; the rest add medical texture at small size.
const MEDIA = [
  { src: 'illustrations-lms.jpg', label: 'Interactive learning' },
  { src: 'steth-tablet.jpg', label: 'Neurology modules' },
  { src: 'steth-heart.jpg', label: 'Cardiology mastery' },
  { src: 'professor.jpg', label: 'Clinical skills' },
  { src: 'brain-scan.jpg', label: 'Visual anatomy' },
  { src: 'students-1.jpg', label: 'Lecture hub' },
  { src: 'vr-anatomy.jpg', label: 'Immersive study' },
  { src: 'surgeons.jpg', label: 'Real exam pressure' },
];

function Tile({ m }) {
  return (
    <figure className="group relative w-[260px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_14px_36px_-24px_rgba(17,17,24,0.4)] ring-1 ring-black/5">
      <img src={img(m.src)} alt={m.label} loading="lazy" className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-[12px] font-bold text-white">
        {m.label}
      </figcaption>
    </figure>
  );
}

export function MediaStrip() {
  const doubled = [...MEDIA, ...MEDIA];
  return (
    <section className="lpv2-section overflow-hidden bg-[#fafaf7]">
      <div className="lpv2-shell mb-10 text-center">
        <span className="mb-3 inline-block rounded-full bg-[#2563eb]/8 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2563eb]">Inside xyndrome</span>
        <h2 className="font-display text-[clamp(30px,5vw,48px)] leading-tight text-[#111118]">Built for how medical students really study.</h2>
      </div>
      <div className="lpv2-marquee group flex overflow-hidden">
        <div className="lpv2-marquee-track-l flex w-max gap-4 group-hover:[animation-play-state:paused]">
          {doubled.map((m, i) => <Tile key={`${m.src}-${i}`} m={m} />)}
        </div>
      </div>
    </section>
  );
}

export default MediaStrip;
