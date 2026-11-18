import { useEffect, useState } from 'react';
import { createAnnouncement, deleteAnnouncement, fetchAdminAnnouncements, updateAnnouncement } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

/**
 * In-app announcements (OPTIMIZE 10 step 4). Each is a centre card (with an
 * optional picture) or a Study Hub banner, shown inside the app between its
 * start and end, highest priority first, ONE at a time, once per device.
 * Kept in a small file on the server (no database). Phone push and the
 * notifications inbox are sent from Settings → Notifications instead.
 */
const emptyForm = {
  style: 'card',
  title: '',
  body: '',
  imageUrl: '',
  actionLabel: '',
  actionPath: '',
  startAt: '',
  endAt: '',
  priority: 0,
  audience: 'student',
  status: 'active',
};

// <input type="datetime-local"> works in local time without a zone.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}
function windowText(item) {
  const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const start = item.startAt ? fmt(item.startAt) : 'now';
  const end = item.endAt ? fmt(item.endAt) : 'no end';
  return `${start} → ${end}`;
}
// What the admin should read on the card: live, scheduled, ended or draft.
function stateOf(item) {
  if (item.status !== 'active') return 'draft';
  const now = Date.now();
  if (item.endAt && new Date(item.endAt).getTime() <= now) return 'ended';
  if (item.startAt && new Date(item.startAt).getTime() > now) return 'scheduled';
  return 'live';
}
function isLive(item) {
  const now = Date.now();
  return item.status === 'active'
    && (!item.startAt || new Date(item.startAt).getTime() <= now)
    && (!item.endAt || new Date(item.endAt).getTime() > now);
}

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function load() {
    try {
      const page = await fetchAdminAnnouncements();
      setItems(Array.isArray(page?.items) ? page.items : []);
    } catch (error) { setMessage(getErrorMessage(error, 'Unable to load announcements')); }
  }
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setWarning('');
    try {
      const payload = {
        ...form,
        priority: Number(form.priority) || 0,
        imageUrl: form.style === 'card' ? form.imageUrl : '',
        startAt: fromLocalInput(form.startAt),
        endAt: fromLocalInput(form.endAt),
      };
      const result = editingId ? await updateAnnouncement(editingId, payload) : await createAnnouncement(payload);
      setForm(emptyForm); setEditingId(null); await load();
      setMessage(editingId ? 'Announcement updated.' : 'Announcement saved. The app shows it from its start time.');
      if (Number(result?.overlapping) > 0) {
        setWarning(`${result.overlapping} other active announcement${result.overlapping === 1 ? '' : 's'} overlap this time. Students see only one at a time (highest priority first), so we recommend keeping just one active.`);
      }
    } catch (error) { setMessage(getErrorMessage(error, 'Unable to save announcement')); }
    finally { setSaving(false); }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.title || 'this announcement'}"?`)) return;
    setDeletingId(item.id);
    try {
      await deleteAnnouncement(item.id);
      await load();
      setMessage('Announcement deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to delete announcement'));
    } finally {
      setDeletingId(null);
    }
  }

  function edit(item) {
    setEditingId(item.id);
    setWarning('');
    setForm({
      style: item.style === 'banner' ? 'banner' : 'card',
      title: item.title || '',
      body: item.body || '',
      imageUrl: item.imageUrl || '',
      actionLabel: item.actionLabel || '',
      actionPath: item.actionPath || '',
      startAt: toLocalInput(item.startAt),
      endAt: toLocalInput(item.endAt),
      priority: item.priority ?? 0,
      audience: item.audience || item.targetRole || 'student',
      status: item.status === 'draft' ? 'draft' : 'active',
    });
  }

  const liveCount = items.filter(isLive).length;

  return (
    <main className={ui.screenShell}><section className={ui.managementLayout}>
      <AppHeader title="Announcements" subtitle="In-app cards and banners" />
      {message ? <div className={message.startsWith('Unable') ? ui.feedbackError : ui.feedbackSuccess}>{message}</div> : null}
      {warning ? <div className={ui.feedbackError}>{warning}</div> : null}
      <section className={ui.panelCard}>
        <div className={ui.infoCard}>
          Shown inside the app as a <b>centre card</b> (can have a picture) or a <b>banner</b> at the top of the Study Hub.
          Students see <b>one at a time</b>, highest priority first, once per device. Keep just one active for the best effect
          {liveCount > 1 ? ` (${liveCount} are live now)` : ''}. Phone push and inbox messages are sent from Settings → Notifications.
        </div>
        <form className={ui.stackForm} onSubmit={save}>
          <div className={ui.formGrid}>
            <label className={ui.formLabel}>Style<select className={ui.input} value={form.style} onChange={set('style')}><option value="card">Centre card</option><option value="banner">Study Hub banner</option></select></label>
            <label className={ui.formLabel}>Title<input className={ui.input} maxLength={120} value={form.title} onChange={set('title')} /></label>
            <label className={ui.formLabel}>Audience<select className={ui.input} value={form.audience} onChange={set('audience')}><option value="student">Students</option><option value="admin">Admins</option><option value="all">Everyone</option></select></label>
            <label className={ui.formLabel}>Status<select className={ui.input} value={form.status} onChange={set('status')}><option value="active">Active</option><option value="draft">Draft</option></select></label>
            <label className={ui.formLabel}>Starts<input type="datetime-local" className={ui.input} value={form.startAt} onChange={set('startAt')} /></label>
            <label className={ui.formLabel}>Ends<input type="datetime-local" className={ui.input} value={form.endAt} onChange={set('endAt')} /></label>
            <label className={ui.formLabel}>Priority (0–100, higher first)<input type="number" min={0} max={100} className={ui.input} value={form.priority} onChange={set('priority')} /></label>
            {form.style === 'card' ? <label className={ui.formLabel}>Picture link (https, optional)<input className={ui.input} value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://…" /></label> : null}
            <label className={ui.formLabel}>Button text (optional)<input className={ui.input} maxLength={40} value={form.actionLabel} onChange={set('actionLabel')} placeholder="Open OSCE" /></label>
            <label className={ui.formLabel}>Button opens (app path, optional)<input className={ui.input} value={form.actionPath} onChange={set('actionPath')} placeholder="/app/osce" /></label>
          </div>
          <label className={ui.formLabel}>Text<textarea className={ui.textarea} maxLength={600} value={form.body} onChange={set('body')} /></label>
          <div className={ui.buttonRow}><button className={ui.primaryAction} disabled={saving} aria-busy={saving}>{saving ? 'Saving...' : `${editingId ? 'Update' : 'Save'} announcement`}</button>{editingId ? <button type="button" className={ui.secondaryAction} onClick={() => { setEditingId(null); setForm(emptyForm); setWarning(''); }} disabled={saving}>Cancel</button> : null}</div>
        </form>
      </section>
      <section className={ui.dashboardGrid}>{items.map((item) => (
        <article className={ui.panelCard} key={item.id}>
          <div className={ui.panelTop}><div><h2>{item.title}</h2><p>{item.body}</p></div><span className={statusPill(stateOf(item) === 'live' ? 'active' : stateOf(item) === 'ended' ? 'expired' : 'draft')}>{stateOf(item)}</span></div>
          <p className={ui.panelText}>{item.style === 'banner' ? 'Study Hub banner' : 'Centre card'} · priority {item.priority} · {item.audience}</p>
          <p className={ui.panelText}>{windowText(item)}</p>
          <div className={ui.buttonRow}><button className={ui.secondaryAction} onClick={() => edit(item)} disabled={deletingId === item.id}>Edit</button><button className={ui.dangerAction} onClick={() => handleDelete(item)} disabled={deletingId === item.id} aria-busy={deletingId === item.id}>{deletingId === item.id ? 'Deleting...' : 'Delete'}</button></div>
        </article>
      ))}</section>
    </section></main>
  );
}
