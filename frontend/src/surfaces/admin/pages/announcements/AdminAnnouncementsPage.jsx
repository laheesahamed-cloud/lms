import { useEffect, useState } from 'react';
import { createAnnouncement, deleteAnnouncement, fetchAdminAnnouncements, updateAnnouncement } from '../../../../shared/api/workspace.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const emptyForm = { title: '', body: '', targetRole: 'student', status: 'published' };

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    try { setItems(await fetchAdminAnnouncements()); } catch (error) { setMessage(getErrorMessage(error, 'Unable to load announcements')); }
  }
  useEffect(() => { load(); }, []);
  async function save(event) {
    event.preventDefault();
    try {
      editingId ? await updateAnnouncement(editingId, form) : await createAnnouncement(form);
      setForm(emptyForm); setEditingId(null); await load();
      setMessage(editingId ? 'Announcement updated.' : 'Announcement published. In-app notification is created and native app notification is sent to enabled devices.');
    } catch (error) { setMessage(getErrorMessage(error, 'Unable to save announcement')); }
  }

  return (
    <main className={ui.screenShell}><section className={ui.managementLayout}>
      <AppHeader title="Announcements" subtitle="Message Center" />
      {message ? <div className={message.startsWith('Unable') ? ui.feedbackError : ui.feedbackSuccess}>{message}</div> : null}
      <section className={ui.panelCard}>
        <div className={ui.infoCard}>
          Published announcements create app notifications automatically. If users enabled native notifications, the same announcement is also delivered to the installed app.
        </div>
        <form className={ui.stackForm} onSubmit={save}>
          <div className={ui.formGrid}>
            <label className={ui.formLabel}>Title<input className={ui.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
            <label className={ui.formLabel}>Audience<select className={ui.input} value={form.targetRole} onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}><option value="student">Students</option><option value="admin">Admins</option><option value="all">Everyone</option></select></label>
            <label className={ui.formLabel}>Status<select className={ui.input} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
          </div>
          <label className={ui.formLabel}>Message<textarea className={ui.textarea} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></label>
          <div className={ui.buttonRow}><button className={ui.primaryAction}>{editingId ? 'Update' : 'Publish'} announcement</button>{editingId ? <button type="button" className={ui.secondaryAction} onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button> : null}</div>
        </form>
      </section>
      <section className={ui.dashboardGrid}>{items.map((item) => <article className={ui.panelCard} key={item.id}><div className={ui.panelTop}><div><h2>{item.title}</h2><p>{item.body}</p></div><span className={statusPill(item.status)}>{item.status}</span></div><p className={ui.panelText}>Audience: {item.targetRole}</p><div className={ui.buttonRow}><button className={ui.secondaryAction} onClick={() => { setEditingId(item.id); setForm({ title: item.title, body: item.body, targetRole: item.targetRole, status: item.status }); }}>Edit</button><button className={ui.dangerAction} onClick={async () => { await deleteAnnouncement(item.id); await load(); }}>Delete</button></div></article>)}</section>
    </section></main>
  );
}
