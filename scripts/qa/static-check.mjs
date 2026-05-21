import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'frontend/package.json',
  'backend/package.json',
  'backend/src/app.module.ts',
  'backend/src/main.ts',
  'frontend/src/main.jsx',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

const backendPackage = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8'));
const frontendPackage = JSON.parse(readFileSync(join(root, 'frontend/package.json'), 'utf8'));

if (!backendPackage.scripts?.build) failures.push('backend/package.json is missing scripts.build');
if (!frontendPackage.scripts?.build) failures.push('frontend/package.json is missing scripts.build');

const appModule = readFileSync(join(root, 'backend/src/app.module.ts'), 'utf8');
for (const moduleName of ['AuthModule', 'CoursesModule', 'QuizAttemptsModule', 'ResultsModule', 'DashboardModule']) {
  if (!appModule.includes(moduleName)) {
    failures.push(`AppModule is missing ${moduleName}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Static LMS smoke checks passed.');
