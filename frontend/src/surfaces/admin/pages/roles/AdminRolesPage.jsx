import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchStaffUsers, updateUserAccess } from '../../../../shared/api/users.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../../../../shared/utils/userIdentity.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

// Admin-panel sections an administrator can switch on per staff member. `admin.access`
// is implicit — every staff account keeps it so they can sign in — so it is not listed.
const PERMISSION_SECTIONS = [
  { key: 'content.manage', label: 'Content', hint: 'Courses, Structure, Lessons, Drugs, ECG, Auscultation' },
  { key: 'questions.manage', label: 'Questions', hint: 'Question bank & question reports' },
  { key: 'quizzes.manage', label: 'Assessments', hint: 'Quizzes & exams' },
  { key: 'ai.manage', label: 'AI Tools', hint: 'Gemini & ChatGPT settings' },
  { key: 'subscriptions.manage', label: 'Subscriptions', hint: 'Subscriptions & plans' },
  { key: 'plans.manage', label: 'Plans', hint: 'Subscription plan catalogue' },
  { key: 'reports.view', label: 'Reports & Finance', hint: 'Reports dashboard & finance (with Subscriptions)' },
  { key: 'students.manage', label: 'Users & Roles', hint: 'Manage accounts and this access page' },
  { key: 'notifications.manage', label: 'Announcements', hint: 'Announcements & notifications' },
  { key: 'content.review', label: 'Content Review', hint: 'Review submitted content' },
  { key: 'settings.manage', label: 'Settings', hint: 'Setup & system settings' },
];

const TICKABLE_KEYS = PERMISSION_SECTIONS.map((section) => section.key);

function baseGrant(user) {
  // Sections currently enforced for this account (drop the implicit admin.access gate).
  return (user.effectivePermissions || []).filter((permission) => permission !== 'admin.access');
}

function draftFromUser(user) {
  return {
    mode: user.role === 'admin' ? 'admin' : 'custom',
    perms: baseGrant(user).filter((permission) => TICKABLE_KEYS.includes(permission)),
  };
}

function isSamePermissionSet(a, b) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

function StaffAccessCard({ user, isSelf, onSaved, onError }) {
  const initialDraft = useMemo(() => draftFromUser(user), [user]);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftFromUser(user));
  }, [user]);

  const isAdminMode = draft.mode === 'admin';
  const dirty =
    draft.mode !== initialDraft.mode || !isSamePermissionSet(draft.perms, initialDraft.perms);

  function setMode(mode) {
    if (isSelf) return;
    setDraft((current) => ({ ...current, mode }));
  }

  function togglePermission(key) {
    setDraft((current) => {
      const has = current.perms.includes(key);
      return {
        ...current,
        perms: has ? current.perms.filter((item) => item !== key) : [...current.perms, key],
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = draft.mode === 'admin'
        ? { role: 'admin', permissions: [] }
        : { role: 'staff', permissions: draft.perms };
      const updated = await updateUserAccess(user.id, payload);
      onSaved(updated);
    } catch (error) {
      onError(getErrorMessage(error, 'Unable to update access'));
    } finally {
      setSaving(false);
    }
  }

  const identifier = getAdminUserIdentifier(user);
  const secondary = getAdminUserSecondaryIdentifier(user);

  return (
    <section className={ui.panelCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={ui.panelTitle}>{identifier}</h3>
            <span className={ui.tablePill}>{isAdminMode ? 'Full admin' : 'Custom staff'}</span>
            {isSelf ? <span className={ui.tablePill}>You</span> : null}
          </div>
          <p className={ui.panelText}>{secondary || user.email}</p>
        </div>

        <div className="inline-flex overflow-hidden rounded-lg border border-line-medium">
          {[
            { key: 'admin', label: 'Full admin' },
            { key: 'custom', label: 'Custom access' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={isSelf}
              onClick={() => setMode(option.key)}
              className={cx(
                'min-h-9 px-3.5 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60',
                draft.mode === option.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-surface-1 text-ink-soft hover:bg-surface-2'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset
        disabled={isAdminMode || isSelf}
        className={cx('mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3', (isAdminMode || isSelf) && 'opacity-60')}
      >
        {PERMISSION_SECTIONS.map((section) => {
          const checked = isAdminMode || draft.perms.includes(section.key);
          return (
            <label
              key={section.key}
              className={cx(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition',
                checked ? 'border-brand-primary/40 bg-brand-primary-light' : 'border-line-soft bg-surface-1 hover:border-line-medium',
                (isAdminMode || isSelf) && 'cursor-not-allowed'
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-brand-primary"
                checked={checked}
                disabled={isAdminMode || isSelf}
                onChange={() => togglePermission(section.key)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink-strong">{section.label}</span>
                <span className="block text-xs text-ink-soft">{section.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className={cx(ui.buttonRow, 'mt-4 items-center justify-between')}>
        <p className="text-xs text-ink-muted">
          {isSelf
            ? 'You cannot change your own access.'
            : isAdminMode
              ? 'Full administrators can open every admin page.'
              : 'Only ticked sections are visible to this account. They can always reach the Admin Hub.'}
        </p>
        <button
          type="button"
          className={ui.primaryAction}
          onClick={handleSave}
          disabled={!dirty || saving || isSelf}
        >
          {saving ? 'Saving…' : 'Save access'}
        </button>
      </div>
    </section>
  );
}

export function AdminRolesPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
  }, []);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchStaffUsers();
      setStaff(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load staff accounts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleSaved(updated) {
    setStaff((current) => current.map((user) => (user.id === updated.id ? { ...user, ...updated } : user)));
    showToast('Access updated successfully.', 'success');
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title="Roles & Access" subtitle="Access Control" />

        {toast && createPortal(
          <div className={ui.toastContainer} role="status" aria-live="polite">
            <FeedbackNotice
              tone={toast.type === 'success' ? 'success' : 'error'}
              variant="toast"
              onDismiss={() => setToast(null)}
              resetKey={toast.text}
            >
              {toast.text}
            </FeedbackNotice>
          </div>,
          document.body
        )}

        <section className={ui.panelCard}>
          <h2 className={ui.panelTitle}>Staff admin-panel access</h2>
          <p className={ui.panelText}>
            Choose <strong>Full admin</strong> to grant every page, or <strong>Custom access</strong> and tick exactly
            which admin sections each staff member can open. Create staff accounts from the Users page (set the role to
            &ldquo;Staff&rdquo;), then fine-tune their access here.
          </p>
        </section>

        {loading ? (
          <section className={ui.panelCard}>
            <p className={ui.panelText}>Loading staff accounts…</p>
          </section>
        ) : null}

        {!loading && loadError ? (
          <FeedbackNotice tone="error" resetKey={loadError}>
            {loadError}
          </FeedbackNotice>
        ) : null}

        {!loading && !loadError && staff.length === 0 ? (
          <section className={ui.panelCard}>
            <p className={ui.panelText}>No staff accounts yet. Create one from the Users page to get started.</p>
          </section>
        ) : null}

        {!loading && !loadError
          ? staff.map((user) => (
              <StaffAccessCard
                key={user.id}
                user={user}
                isSelf={currentUser?.id === user.id}
                onSaved={handleSaved}
                onError={(message) => showToast(message, 'error')}
              />
            ))
          : null}
      </section>
    </main>
  );
}
