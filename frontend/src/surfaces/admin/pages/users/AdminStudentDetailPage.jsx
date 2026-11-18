import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchUserDetail } from '../../../../shared/api/users.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../../../../shared/utils/userIdentity.js';

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
        <AppHeader title={data?.user ? getAdminUserIdentifier(data.user, 'Student detail') : 'Student detail'} subtitle="Student Profile" />
        <Link className={ui.secondaryAction} to="/users">Back to students</Link>
        {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
        {status.loading ? <div className={ui.emptyBox}>Loading student detail...</div> : null}
        {data ? (
          <>
            <section className={ui.panelCard}>
                <div className={ui.panelTop}><div><h2>{getAdminUserIdentifier(data.user)}</h2><p>{getAdminUserSecondaryIdentifier(data.user) || 'No name on file'}</p></div><span className={statusPill(data.user.status)}>{data.user.status}</span></div>
              <div className={ui.dashboardMetricGrid}>
                <Stat label="Completed lessons" value={`${data.progress.completedLessons}/${data.progress.trackedLessons}`} />
                <Stat label="Average progress" value={`${data.progress.averageProgress}%`} />
                <Stat label="Recent results" value={data.attempts.length} />
              </div>
            </section>
            <section className={ui.dashboardGrid}>
              <div className={ui.panelCard}><div className={ui.panelTop}><div><h2>Subscriptions</h2><p>Recent access records.</p></div></div>{data.subscriptions.length ? data.subscriptions.map((s) => <p key={s.id} className={ui.alert}><strong>{s.planName}</strong> · {s.status} · ends {s.endDate}</p>) : <div className={ui.emptyBox}>No subscriptions found.</div>}</div>
              <div className={ui.panelCard}><div className={ui.panelTop}><div><h2>Recent quizzes</h2><p>The student's newest exam results (up to 5).</p></div></div>{data.attempts.length ? data.attempts.map((a) => <p key={a.id} className={ui.alert}><strong>{a.quizTitle}</strong> · {a.score}% · {a.passStatus}</p>) : <div className={ui.emptyBox}>No results yet.</div>}</div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
