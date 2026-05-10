import { AppHeader } from '../components/layout/AppHeader.jsx';
import { ui } from '../styles/tailwindClasses.js';

export function DashboardPage({ title, subtitle, cards = [] }) {
  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader title={title} subtitle={subtitle} />
        <div className={ui.dashboardGrid}>
          {cards.map((card) => (
            <article className={ui.dashboardCard} key={card.title}>
              <span className={ui.eyebrow}>{card.kicker}</span>
              <h2 className={ui.dashboardCardTitle}>{card.title}</h2>
              <p className={ui.dashboardCardText}>{card.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
