import { fetchPlannerAgenda } from '../api/workspace.api.js';
import {
  showLocalNotification,
  cancelLocalNotifications,
  getLocalNotificationPermission,
} from '../platform/native/LocalNotifications.js';

/**
 * On-device study reminders. Two sources:
 *   1. Planner agenda due-dates  -> remind N hours before each open task/exam.
 *   2. User-set custom times     -> a daily reminder at a chosen HH:MM.
 *
 * Everything is scheduled locally on the device (no server push). Preferences live in
 * localStorage. Reminder ids are derived deterministically so re-reconciling cancels the
 * previous batch and re-schedules cleanly without duplicates.
 */

const PREFS_KEY = 'lms_study_reminder_prefs';
const SCHEDULED_IDS_KEY = 'lms_study_reminder_ids';

// Deterministic id ranges so we only cancel/replace our own scheduled reminders.
const PLANNER_ID_BASE = 700_000_000;
const PLANNER_ID_SPAN = 100_000;
const CUSTOM_ID = 690_000_001;

const DEFAULT_PREFS = {
  plannerEnabled: true,
  plannerLeadHours: 3,
  customEnabled: false,
  customTime: '18:00', // HH:MM, local
};

export function getStudyReminderPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}');
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveStudyReminderPrefs(next) {
  if (typeof window === 'undefined') return getStudyReminderPrefs();
  const merged = { ...getStudyReminderPrefs(), ...next };
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  return merged;
}

function plannerReminderId(index) {
  return PLANNER_ID_BASE + (index % PLANNER_ID_SPAN);
}

/** Ids we actually scheduled last time, so we only cancel our own batch. */
function readScheduledIds() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SCHEDULED_IDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function writeScheduledIds(ids) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

function parseDueDate(item) {
  const raw =
    item?.dueAt || item?.dueDate || item?.due_at || item?.due_date || item?.date || item?.startAt || '';
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextDailyOccurrence(timeStr) {
  const [h, m] = String(timeStr || '18:00')
    .split(':')
    .map((v) => Number(v));
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function isOpenAgendaItem(item) {
  const status = String(item?.status || '').toLowerCase();
  return status !== 'done' && status !== 'completed' && status !== 'archived';
}

/**
 * Reconcile all study reminders against current prefs + planner agenda.
 * Cancels our prior batch, then re-schedules. Safe to call repeatedly.
 */
export async function reconcileStudyReminders() {
  const permission = await getLocalNotificationPermission();
  if (permission !== 'granted') {
    return { ok: false, scheduled: 0, reason: 'permission' };
  }

  const prefs = getStudyReminderPrefs();

  // Clear only the reminders we scheduled previously (native only; no-op on web).
  await cancelLocalNotifications(readScheduledIds());

  const scheduledIds = [];
  let scheduled = 0;

  // 1. Custom daily reminder.
  if (prefs.customEnabled) {
    const at = nextDailyOccurrence(prefs.customTime);
    if (at) {
      await showLocalNotification({
        id: CUSTOM_ID,
        title: 'Study time',
        body: 'Time for your study session. Open your planner to get started.',
        url: '/planner',
        at,
      });
      scheduledIds.push(CUSTOM_ID);
      scheduled += 1;
    }
  }

  // 2. Planner due-date reminders.
  if (prefs.plannerEnabled) {
    const agenda = await fetchPlannerAgenda().catch(() => []);
    const items = Array.isArray(agenda) ? agenda : agenda?.items || [];
    const leadMs = Math.max(0, Number(prefs.plannerLeadHours) || 0) * 60 * 60 * 1000;
    const now = Date.now();

    const upcoming = items
      .filter(isOpenAgendaItem)
      .map((item) => ({ item, due: parseDueDate(item) }))
      .filter(({ due }) => due && due.getTime() - leadMs > now)
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 32); // cap scheduled reminders

    let index = 0;
    for (const { item, due } of upcoming) {
      const at = new Date(due.getTime() - leadMs);
      const title = item?.title ? `Upcoming: ${item.title}` : 'Upcoming study task';
      const typeLabel = item?.type ? `${item.type} ` : '';
      const id = plannerReminderId(index);
      await showLocalNotification({
        id,
        title,
        body: `Your ${typeLabel}is due soon. Tap to review it in your planner.`,
        url: '/planner',
        at,
      });
      scheduledIds.push(id);
      index += 1;
      scheduled += 1;
    }
  }

  writeScheduledIds(scheduledIds);
  return { ok: true, scheduled };
}

/** Cancel every study reminder we scheduled (native only). */
export async function clearStudyReminders() {
  await cancelLocalNotifications(readScheduledIds());
  writeScheduledIds([]);
}
