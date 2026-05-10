import { spawnSync } from 'node:child_process';

const auditArgs = [
  '--pcre2',
  '-n',
  '<(button|input|textarea|select|label)(?![^>]*className)',
  'frontend/src',
  '-g',
  '*.jsx',
];

const allowedGeneratedMarkup = [
  'frontend/src/features/student/notes/StudentNotesPage.jsx:',
  'frontend/src/features/student/lessons/StudentLessonsPage.jsx:',
];

const result = spawnSync('rg', auditArgs, {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (![0, 1].includes(result.status)) {
  process.stderr.write(result.stderr || '');
  process.exit(result.status || 1);
}

const lines = result.stdout
  .split('\n')
  .map((line) => line.trimEnd())
  .filter(Boolean);

const unexpected = lines.filter((line) => {
  const isAllowedFile = allowedGeneratedMarkup.some((prefix) => line.startsWith(prefix));
  return !isAllowedFile || !line.includes('`<button type="button" class=');
});

if (unexpected.length) {
  console.error('Unexpected bare controls found:');
  for (const line of unexpected) {
    console.error(line);
  }
  process.exit(1);
}

console.log('Bare-control audit passed.');
console.log(`Ignored ${lines.length - unexpected.length} generated annotation markup hit(s).`);
