import { ui } from '../styles/tailwindClasses.js';

export function PlaceholderPage({ title, description }) {
  return (
    <main className={ui.emptyPage}>
      <section className={ui.glassCard}>
        <span className={ui.placeholderKicker}>React Frontend</span>
        <h1 className={ui.placeholderTitle}>{title}</h1>
        <p className={ui.placeholderText}>{description}</p>
      </section>
    </main>
  );
}
