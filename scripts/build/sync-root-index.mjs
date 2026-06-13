import { copyFile, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const distIndex = path.join(repoRoot, 'frontend', 'dist', 'index.html');
const rootIndex = path.join(repoRoot, 'index.html');
const publicDir = path.join(repoRoot, 'frontend', 'public');
const rootPublicFiles = [
  ['sw.js', 'sw.js'],
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ['robots.txt', 'robots.txt'],
  ['sitemap.xml', 'sitemap.xml'],
  ['apple-touch-icon.png', 'apple-touch-icon.png'],
  ['favicon-light-32.png', 'favicon-light-32.png'],
  ['favicon-light-180.png', 'favicon-light-180.png'],
  ['favicon-light-192.png', 'favicon-light-192.png'],
  ['favicon-light-512.png', 'favicon-light-512.png'],
];

async function assertExists(filePath, label) {
  try {
    await stat(filePath);
  } catch (error) {
    throw new Error(`${label} was not found at ${filePath}`);
  }
}

await assertExists(distIndex, 'Built frontend index');

let html = await readFile(distIndex, 'utf8');
const jsMatch = html.match(/src="([^"]*\/assets\/app-[^"]+\.js)"/);

if (!jsMatch) {
  throw new Error('Built frontend index does not contain the expected versioned app JS asset.');
}
await assertExists(path.join(repoRoot, jsMatch[1].replace(/^\/lms\//, '')), 'Built app JS');

// Link the main stylesheet from the HTML head (M6). The bundler injects CSS
// from JS, which serializes the entire stylesheet download behind JS boot;
// this link lets it download in parallel with the entry chunk.
const cssDir = path.join(repoRoot, 'frontend', 'dist', 'assets', 'css');
const mainCss = (await readdir(cssDir)).find((name) => name.startsWith('main-') && name.endsWith('.css'));
if (!mainCss) {
  throw new Error('Built CSS directory does not contain the main stylesheet.');
}
const mainCssHref = `/lms/frontend/dist/assets/css/${mainCss}`;
if (!html.includes(mainCssHref)) {
  html = html.replace(
    '<link rel="manifest"',
    `<link rel="stylesheet" href="${mainCssHref}" />\n    <link rel="manifest"`
  );
}
if (!html.includes(mainCssHref)) {
  throw new Error('Could not inject the main stylesheet link into index.html.');
}

// Preload the self-hosted latin PJS file (Round-2 Task 17) so the variable
// font arrives in parallel with CSS/JS; font-display:optional then never
// falls back. Font preloads require crossorigin even same-origin.
const assetsDir = path.join(repoRoot, 'frontend', 'dist', 'assets');
const latinFont = (await readdir(assetsDir)).find((name) => name.startsWith('pjs-') && name.includes('latin') && !name.includes('latin-ext') && name.endsWith('.woff2'));
if (!latinFont) {
  throw new Error('Built assets do not contain the self-hosted PJS latin woff2.');
}
const fontHref = `/lms/frontend/dist/assets/${latinFont}`;
if (!html.includes(fontHref)) {
  html = html.replace(
    `<link rel="stylesheet" href="${mainCssHref}" />`,
    `<link rel="preload" as="font" type="font/woff2" href="${fontHref}" crossorigin />\n    <link rel="stylesheet" href="${mainCssHref}" />`
  );
}
await writeFile(distIndex, html);
await copyFile(distIndex, rootIndex);

// CSP hashes for every inline <script> and <style> (report sec 13.1): the
// .htaccess placeholders are replaced with the actual sha256 values so the
// document never needs 'unsafe-inline'.
const hashOf = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const inlineStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
// When there is no inline content the placeholder must vanish entirely —
// 'none' next to 'self' is invalid CSP and Chrome warns on every page.
const scriptHashes = inlineScripts.map(hashOf).join(' ');
const styleHashes = inlineStyles.map(hashOf).join(' ');

for (const htaccessPath of [path.join(repoRoot, 'frontend', 'dist', '.htaccess'), path.join(repoRoot, '.htaccess')]) {
  let template = await readFile(path.join(publicDir, '.htaccess'), 'utf8');
  template = template
    .replaceAll('__LMS_SCRIPT_HASHES__', scriptHashes)
    .replaceAll('__LMS_STYLE_HASHES__', styleHashes)
    .replaceAll("'self' ;", "'self';")
    .replaceAll("'self'  ", "'self' ");
  await writeFile(htaccessPath, template);
}

for (const [sourceName, targetName] of rootPublicFiles) {
  const sourcePath = path.join(publicDir, sourceName);
  const targetPath = path.join(repoRoot, targetName);
  await assertExists(sourcePath, sourceName);
  await copyFile(sourcePath, targetPath);
}

console.log(`Synced ${path.relative(repoRoot, rootIndex)} to ${path.relative(repoRoot, distIndex)} (main CSS linked, CSP hashes: ${inlineScripts.length} script / ${inlineStyles.length} style)`);
console.log('Synced root service worker and manifest from frontend/public');
