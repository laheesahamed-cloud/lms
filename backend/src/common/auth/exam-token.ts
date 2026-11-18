import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { signingSecret } from './access-token';

/**
 * The signed exam token (OPTIMIZE 10.16). Issued when an exam starts and sent
 * back with the answers: the server trusts what it carries by its signature
 * (no exam-session row read on submit). The progress row keeps only the
 * nonce, so a second submit of the same exam matches no row (duplicate
 * protection). Timing gates (minimum time) are the phone's job; the deadline
 * here only stops a token being used long after the exam.
 */
export type ExamClaims = {
  u: number;      // user id
  q: number;      // quiz id
  n: string;      // nonce (also stored on the progress row)
  s: number;      // started at (ms)
  d: number;      // deadline (ms)
  ids: number[];  // question ids, in order
};

const b64 = (v: Buffer | string) => Buffer.from(v).toString('base64url');
/** Accepted for this long after the deadline (slow networks, clock drift). */
const GRACE_MS = 10 * 60 * 1000;

export function newExamNonce(): string {
  return randomBytes(12).toString('hex');
}

export function signExamToken(claims: ExamClaims): string {
  const body = b64(JSON.stringify(claims));
  const sig = createHmac('sha256', signingSecret()).update(`exam.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

/** The claims of a valid, unexpired exam token for this user and quiz, or null. */
export function verifyExamToken(token: unknown, userId: number, quizId: number): ExamClaims | null {
  const raw = String(token || '');
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const want = createHmac('sha256', signingSecret()).update(`exam.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ExamClaims;
    if (Number(claims.u) !== Number(userId) || Number(claims.q) !== Number(quizId)) return null;
    if (!Array.isArray(claims.ids) || !claims.n) return null;
    if (Date.now() > Number(claims.d) + GRACE_MS) return null;
    return claims;
  } catch {
    return null;
  }
}
