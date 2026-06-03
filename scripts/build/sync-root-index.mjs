import { copyFile, readFile, stat } from 'node:fs/promises';
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

const html = await readFile(distIndex, 'utf8');
const cssMatches = [...html.matchAll(/href="([^"]*\/assets\/app-[^"]+\.css)"/g)];
const jsMatch = html.match(/src="([^"]*\/assets\/app-[^"]+\.js)"/);

if (!jsMatch) {
  throw new Error('Built frontend index does not contain the expected versioned app JS asset.');
}

for (const cssMatch of cssMatches) {
  await assertExists(path.join(repoRoot, cssMatch[1].replace(/^\/lms\//, '')), 'Built app CSS');
}
await assertExists(path.join(repoRoot, jsMatch[1].replace(/^\/lms\//, '')), 'Built app JS');
await copyFile(distIndex, rootIndex);

for (const [sourceName, targetName] of rootPublicFiles) {
  const sourcePath = path.join(publicDir, sourceName);
  const targetPath = path.join(repoRoot, targetName);
  await assertExists(sourcePath, sourceName);
  await copyFile(sourcePath, targetPath);
}

console.log(`Synced ${path.relative(repoRoot, rootIndex)} to ${path.relative(repoRoot, distIndex)}`);
console.log('Synced root service worker and manifest from frontend/public');
