import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const routerPath = path.join(rootDir, 'frontend/src/app/router.jsx');
const rootIndexPath = path.join(rootDir, 'index.html');

const routerSource = fs.readFileSync(routerPath, 'utf8');
const rootIndexSource = fs.readFileSync(rootIndexPath, 'utf8');

const requiredRouterSnippets = [
  "path: 'login'",
  "path: 'register'",
  "path: 'auth/login'",
  "path: 'auth/register'",
  "path: 'admin'",
  '<AdminDashboardPage />',
  '<CoursesPage />',
  '<StructurePage />',
  '<UsersPage />',
  '<QuestionsPage />',
  '<QuizzesPage />',
  "path: 'student'",
  '<StudentDashboardPage />',
  '<StudentCoursesPage />',
  '<StudentQuizzesPage />',
  "path: 'quizzes/:quizId'",
  "path: 'quizzes/:quizId/practice-review'",
  "path: 'results'",
  "path: 'results/:attemptId'",
  "path: 'review/:attemptId'",
];

const requiredRootEntrySnippets = [
  'href="/lms/frontend/dist/assets/app.css?v=20260430-neutral-routes"',
  'src="/lms/frontend/dist/assets/app.js?v=20260430-neutral-routes"',
  '<div id="root"></div>',
];

const missingRouterSnippets = requiredRouterSnippets.filter((snippet) => !routerSource.includes(snippet));
const missingRootEntrySnippets = requiredRootEntrySnippets.filter((snippet) => !rootIndexSource.includes(snippet));

if (missingRouterSnippets.length || missingRootEntrySnippets.length) {
  if (missingRouterSnippets.length) {
    console.error('Missing React router snippets:');
    for (const snippet of missingRouterSnippets) {
      console.error(`- ${snippet}`);
    }
  }

  if (missingRootEntrySnippets.length) {
    console.error('Missing root entry snippets:');
    for (const snippet of missingRootEntrySnippets) {
      console.error(`- ${snippet}`);
    }
  }

  process.exit(1);
}

console.log('Route smoke check passed.');
console.log(`Verified ${requiredRouterSnippets.length} router snippets and ${requiredRootEntrySnippets.length} root entry snippets.`);
