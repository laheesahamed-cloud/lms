import { useState } from 'react';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { AdminGeneralSettingsPanel } from './AdminGeneralSettingsPanel.jsx';
import { AdminAiSettingsPanel } from './AdminAiSettingsPanel.jsx';
import { AdminPaymentSettingsPanel } from './AdminPaymentSettingsPanel.jsx';
import { AdminSmtpSettingsPanel } from './AdminSmtpSettingsPanel.jsx';
import { AdminThemeSettingsPanel } from './AdminThemeSettingsPanel.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const settingsCategories = [
  {
    id: 'general',
    label: 'General',
    title: 'General settings',
    description: 'Reserved for future LMS-wide preferences.',
    panel: <div className={ui.emptyBox}>No general settings added yet.</div>,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    title: 'WhatsApp settings',
    description: 'Store the main support or admissions WhatsApp number for the LMS.',
    panel: <AdminGeneralSettingsPanel />,
  },
  {
    id: 'payhere',
    label: 'PayHere',
    title: 'PayHere payments',
    description: 'Configure sandbox checkout, callback URLs, and the student payment experience without editing environment files.',
    panel: <AdminPaymentSettingsPanel />,
  },
  {
    id: 'smtp',
    label: 'SMTP',
    title: 'SMTP email',
    description: 'Configure your domain email SMTP account and preview the password reset email students receive.',
    panel: <AdminSmtpSettingsPanel />,
  },
  {
    id: 'themes',
    label: 'Themes',
    title: 'Themes',
    description: 'Preview and switch the LMS accent palette without changing light or dark mode.',
    panel: <AdminThemeSettingsPanel />,
  },
  {
    id: 'ai',
    label: 'AI',
    title: 'AI provider settings',
    description: 'Save and switch Gemini, ChatGPT, Claude, or OpenRouter credentials here. AI-powered pages always follow the active provider.',
    panel: <AdminAiSettingsPanel />,
  },
];

export function AdminSettingsPage() {
  const [activeCategoryId, setActiveCategoryId] = useState('payhere');
  const activeCategory = settingsCategories.find((category) => category.id === activeCategoryId) || settingsCategories[0];

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Settings"
          subtitle="Manage lightweight system preferences for the new LMS workspace without editing environment files manually."
        />

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>Setting category</h2>
              <p>Choose one area to edit at a time.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 rounded-lg border border-line-soft bg-surface-1 p-2 shadow-sm" role="tablist" aria-label="Settings categories">
            {settingsCategories.map((category) => {
              const isActive = activeCategory.id === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cx(
                    'inline-flex min-h-10 flex-1 items-center justify-center rounded-md border px-4 text-[13px] font-extrabold transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 max-[560px]:flex-[1_1_44%]',
                    isActive
                      ? 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary shadow-xs'
                      : 'border-transparent bg-transparent text-ink-soft hover:-translate-y-px hover:border-line-soft hover:bg-surface-2 hover:text-ink-strong'
                  )}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>{activeCategory.title}</h2>
              <p>{activeCategory.description}</p>
            </div>
          </div>
          {activeCategory.panel}
        </section>
      </section>
    </main>
  );
}
