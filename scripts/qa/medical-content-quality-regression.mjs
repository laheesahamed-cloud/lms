import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runAssessmentIntegrityChecks() {
  const tsNodeBin = process.platform === 'win32'
    ? join(root, 'backend', 'node_modules', '.bin', 'ts-node.cmd')
    : join(root, 'backend', 'node_modules', '.bin', 'ts-node');

  const result = spawnSync(tsNodeBin, [
    '--project',
    join(root, 'backend', 'tsconfig.json'),
    join(root, 'backend', 'test', 'medical-content-quality-regression.ts'),
  ], {
    cwd: root,
    stdio: 'inherit',
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function checkMedicalRenderingSupport() {
  const source = readFileSync(join(root, 'frontend', 'src', 'shared', 'components', 'MedicalText.jsx'), 'utf8');
  const requiredSignals = [
    ['clinical images', 'medicalImageNode'],
    ['tables', 'medicalTableNode'],
    ['abbreviations', 'medicalAbbreviationNode'],
    ['formulas', 'role="math"'],
    ['references', 'medicalReferenceListNode'],
    ['responsive table overflow', 'overflowX'],
  ];

  for (const [label, token] of requiredSignals) {
    assert(source.includes(token), `MedicalText must support ${label}`);
  }
}

function checkLearnerTrustLanguage() {
  const files = [
    join(root, 'frontend', 'src', 'surfaces', 'app', 'student', 'quizzes', 'TakeQuizPage.jsx'),
    join(root, 'frontend', 'src', 'surfaces', 'app', 'student', 'results', 'ReviewWorkspace.jsx'),
    join(root, 'frontend', 'src', 'surfaces', 'app', 'student', 'results', 'ReviewPage.jsx'),
    join(root, 'frontend', 'src', 'surfaces', 'app', 'student', 'results', 'PracticeReviewPage.jsx'),
    join(root, 'frontend', 'src', 'surfaces', 'app', 'student', 'results', 'ResultPage.jsx'),
    join(root, 'frontend', 'src', 'surfaces', 'app', 'student', 'results', 'ResultsListPage.jsx'),
  ];
  const bannedPatterns = [
    /\byou failed\b/i,
    /\bbad job\b/i,
    /\bpoor performance\b/i,
    /\bnot good enough\b/i,
    /\bcareless\b/i,
    /\blazy\b/i,
    /\bobviously wrong\b/i,
    /\byou should have known\b/i,
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of bannedPatterns) {
      assert(!pattern.test(source), `Learner feedback language failed trust scan in ${file}: ${pattern}`);
    }
  }
}

function checkAuditabilitySurface() {
  const service = readFileSync(join(root, 'backend', 'src', 'modules', 'content-governance', 'content-governance.service.ts'), 'utf8');
  const app = readFileSync(join(root, 'backend', 'src', 'app.module.ts'), 'utf8');
  const requiredSignals = [
    'author',
    'reviewer',
    'approvalDate',
    'version',
    'rollbackPath',
    'exportEvidence',
    'content_governance_evidence.viewed',
  ];

  for (const token of requiredSignals) {
    assert(service.includes(token), `Content governance evidence must expose ${token}`);
  }
  assert(app.includes('ContentGovernanceModule'), 'ContentGovernanceModule must be registered');
}

runAssessmentIntegrityChecks();
checkMedicalRenderingSupport();
checkLearnerTrustLanguage();
checkAuditabilitySurface();
console.log('Medical content quality gate checks passed.');
