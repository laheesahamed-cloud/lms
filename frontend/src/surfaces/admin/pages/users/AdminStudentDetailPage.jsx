import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchUserDetail } from '../../../../shared/api/users.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

function Stat({ label, value }) {
  return <div className={ui.metricCard}><span className="text-xs font-bold text-ink-soft">{label}</span><strong className="mt-1 block text-2xl text-ink-strong">{value}</strong></div>;
}

export function AdminStudentDetailPage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });

  useEffect(() => {
    setStatus({ loading: true, error: '' });
    fetchUserDetail(userId)
      .then((next) => { setData(next); setStatus({ loading: false, error: '' }); })
      .catch((error) => setStatus({ loading: false, error: getErrorMessage(error, 'Unable to load student detail') }));
  }, [userId]);

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title={data?.user?.fullName || 'Student detail'} subtitle="Student Profile" />
        <Link className={ui.secondaryAction} to="/users">Back to students</Link>
        {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
        {status.loading ? <div className={ui.emptyBox}>Loading student detail...</div> : null}
        {data ? (
          <>
            <section className={ui.panelCard}>
              <div className={ui.panelTop}><div><h2>{data.user.fullName}</h2><p>{data.user.email}</p></div><span className={statusPill(data.user.status)}>{data.user.status}</span></div>
              <div className={ui.dashboardMetricGrid}>
                <Stat label="Completed lessons" value={`${data.progress.completedLessons}/${data.progress.trackedLessons}`} />
                <Stat label="Average progress" value={`${data.progress.averageProgress}%`} />
                <Stat label="Quiz attempts" value={data.attempts.length} />
                <Stat label="Open doubts" value={data.doubts.filter((d) => d.status === 'open').length} />
              </div>
            </section>
            <section className={ui.dashboardGrid}>
              <div className={ui.panelCard}><div className={ui.panelTop}><div><h2>Subscriptions</h2><p>Recent access records.</p></div></div>{data.subscriptions.length ? data.subscriptions.map((s) => <p key={s.id} className={ui.alert}><strong>{s.planName}</strong> · {s.status} · ends {s.endDate}</p>) : <div className={ui.emptyBox}>No subscriptions found.</div>}</div>
              <div className={ui.panelCard}><div className={ui.panelTop}><div><h2>Recent quizzes</h2><p>Latest submitted exam attempts.</p></div></div>{data.attempts.length ? data.attempts.map((a) => <p key={a.id} className={ui.alert}><strong>{a.quizTitle}</strong> · {a.score}% · {a.passStatus}</p>) : <div className={ui.emptyBox}>No attempts yet.</div>}</div>
              <div className={ui.panelCard}><div className={ui.panelTop}><div><h2>Bookmarks</h2><p>Saved study items.</p></div></div>{data.bookmarks.length ? data.bookmarks.map((b) => <p key={b.itemType} className={ui.alert}>{b.itemType}: <strong>{b.total}</strong></p>) : <div className={ui.emptyBox}>No bookmarks yet.</div>}</div>
              <div className={ui.panelCard}><div className={ui.panelTop}><div><h2>Doubts</h2><p>Latest lesson questions.</p></div></div>{data.doubts.length ? data.doubts.map((d) => <p key={d.id} className={ui.alert}><strong>{d.subject}</strong> · {d.status}</p>) : <div className={ui.emptyBox}>No doubts yet.</div>}</div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
