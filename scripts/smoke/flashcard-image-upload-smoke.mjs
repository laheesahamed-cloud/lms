import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(repoRoot, 'tmp/flashcard-image-upload-smoke');

function imageDataUrl(index) {
  const fills = [
    ['#2563eb', '#7c3aed', '#eff6ff'],
    ['#059669', '#0891b2', '#ecfdf5'],
    ['#dc2626', '#ea580c', '#fff7ed'],
  ][index - 1];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${fills[0]}"/>
          <stop offset="1" stop-color="${fills[1]}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="675" rx="44" fill="${fills[2]}"/>
      <rect x="58" y="58" width="1084" height="559" rx="36" fill="url(#g)" opacity=".94"/>
      <circle cx="${index === 1 ? 880 : index === 2 ? 320 : 690}" cy="${index === 1 ? 190 : index === 2 ? 460 : 250}" r="118" fill="#fff" opacity=".20"/>
      <path d="M180 470 C310 310, 430 560, 560 370 S820 260, 1010 420" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" opacity=".55"/>
      <text x="92" y="128" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800" fill="#fff">Flashcard image ${index}</text>
      <text x="92" y="570" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#fff" opacity=".82">1200 x 675 · 16:9 smoke asset</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const images = [imageDataUrl(1), imageDataUrl(2), imageDataUrl(3)];

function imageGrid(count) {
  return images.slice(0, count).map((src, index) => `
    <figure class="image-frame">
      <img src="${src}" alt="Smoke image ${index + 1}" />
    </figure>
  `).join('');
}

function card(mode, count) {
  return `
    <article class="smoke-card ${mode}" data-shot="${mode}-${count}">
      <div class="card-top">
        <span>Answer</span>
        <small>${count} image${count === 1 ? '' : 's'}</small>
      </div>
      <p class="answer">A well-made medical flashcard can carry one focused visual, or a short visual sequence when the answer needs comparison.</p>
      <div class="gallery gallery-${count}">${imageGrid(count)}</div>
      <button type="button">Report bad card</button>
    </article>
  `;
}

function adminUploader() {
  return `
    <section class="admin-panel">
      <h1>Flashcard image upload smoke</h1>
      <p>Admin side: three slots, one upload flow, same fit/crop preview behavior.</p>
      <div class="slots">
        ${images.map((src, index) => `
          <label>
            Image ${index + 1}
            <input value="Generated smoke image ${index + 1}" readonly />
            <div class="mini-preview"><img src="${src}" alt="" /></div>
          </label>
        `).join('')}
      </div>
    </section>
  `;
}

const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Flashcard Image Upload Smoke</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f5f8fc; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: linear-gradient(180deg, #f8fbff, #eef4fb); }
    body.single-shot { min-height: 100vh; display: grid; place-items: center; }
    body.single-shot > * { display: none; }
    body.single-shot .shot-active { display: block; margin: 0; }
    .admin-panel, .smoke-card { width: min(720px, calc(100vw - 32px)); margin: 0 auto 32px; border: 1px solid rgba(148,163,184,.28); border-radius: 18px; box-shadow: 0 22px 60px rgba(15,23,42,.10); }
    .admin-panel { padding: 22px; background: rgba(255,255,255,.86); }
    h1 { margin: 0 0 6px; font-size: 22px; }
    p { margin: 0; }
    .slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
    label { display: grid; gap: 8px; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
    input { min-height: 34px; border: 1px solid #d7e0eb; border-radius: 10px; padding: 0 10px; color: #334155; background: #fff; font-size: 12px; }
    .mini-preview, .image-frame { aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid rgba(148,163,184,.24); border-radius: 12px; background: rgba(255,255,255,.72); }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .smoke-card { padding: 26px; background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.96)); }
    .smoke-card.dark { color: #e5edf7; background: linear-gradient(180deg, rgba(15,23,42,.97), rgba(30,41,59,.97)); box-shadow: 0 24px 70px rgba(2,6,23,.45); }
    .card-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .card-top span { display: inline-flex; align-items: center; min-height: 26px; border: 1px solid rgba(16,185,129,.22); border-radius: 999px; padding: 0 12px; color: #10b981; background: rgba(16,185,129,.10); font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .card-top small { color: #64748b; font-size: 11px; font-weight: 800; }
    .dark .card-top small { color: #94a3b8; }
    .answer { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; color: inherit; font-size: 14px; font-weight: 650; line-height: 1.6; }
    .gallery { display: grid; gap: 10px; margin-top: 14px; }
    .gallery-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .gallery-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .gallery-1 .image-frame { height: 190px; }
    .gallery-2 .image-frame { height: 132px; }
    .gallery-3 .image-frame { height: 108px; }
    .image-frame { aspect-ratio: auto; background: rgba(241,245,249,.72); padding: 8px; }
    .dark .image-frame { background: rgba(15,23,42,.72); border-color: rgba(148,163,184,.20); }
    button { margin-top: 14px; min-height: 24px; border: 1px solid rgba(148,163,184,.28); border-radius: 999px; padding: 0 8px; background: rgba(248,250,252,.72); color: #64748b; font-size: 10px; font-weight: 700; }
    .dark button { background: rgba(30,41,59,.78); color: #94a3b8; }
  </style>
</head>
<body>
  ${adminUploader()}
  ${[1, 2, 3].map((count) => card('light', count)).join('')}
  ${[1, 2, 3].map((count) => card('dark', count)).join('')}
  <script>
    const shot = new URLSearchParams(location.search).get('shot');
    if (shot) {
      document.body.classList.add('single-shot');
      document.querySelector('[data-shot="' + shot + '"]')?.classList.add('shot-active');
    }
  </script>
</body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'index.html'), html);
console.log(path.join(outDir, 'index.html'));
