/**
 * The XP rules, in one place. Change a number here and nothing else.
 *
 * XP is earned only for things the server itself can verify: a graded exam
 * attempt, and a lesson the student kept open long enough. It is saved when
 * earned and never recalculated, so it only ever goes up.
 */
export const XP = {
  /** First time a student submits a quiz with at least MIN_PERCENT. */
  EXAM_TAKE: 4,
  /** First time they pass it (on top of EXAM_TAKE). */
  EXAM_PASS: 16,
  /** A repeat attempt at a quiz already taken. */
  EXAM_RETAKE: 2,
  /** How many repeat attempts per quiz pay at all. */
  MAX_PAID_RETAKES: 3,
  /** A finished lesson. */
  LESSON: 6,
  /** The first qualifying activity of a day. */
  STREAK_DAY: 2,
  STREAK_7: 10,
  STREAK_30: 40,
  /** Most XP one student can earn in a calendar day. */
  DAILY_CAP: 100,
  /** Below this score an attempt earns nothing (blank or guessed). */
  MIN_PERCENT: 30,
  /** A lesson must have been open this long before completing it pays. */
  LESSON_MIN_SECONDS: 60,
  /** An exam finished faster than this per question pays nothing. */
  EXAM_MIN_SECONDS_PER_QUESTION: 2,
  /** XP per level. */
  LEVEL_SIZE: 300,
} as const;
