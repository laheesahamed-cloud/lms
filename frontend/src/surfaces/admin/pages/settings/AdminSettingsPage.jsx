import { useState } from 'react';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { AdminGeneralSettingsPanel } from './AdminGeneralSettingsPanel.jsx';
import { AdminLandingPageSettingsPanel } from './AdminLandingPageSettingsPanel.jsx';
import { AdminAiSettingsPanel } from './AdminAiSettingsPanel.jsx';
import { AdminPaymentSettingsPanel } from './AdminPaymentSettingsPanel.jsx';
import { AdminSmtpSettingsPanel } from './AdminSmtpSettingsPanel.jsx';
import { AdminPopupAlertSettingsPanel } from './AdminPopupAlertSettingsPanel.jsx';
import { AdminThemeSettingsPanel } from './AdminThemeSettingsPanel.jsx';
import { AdminNotificationSettingsPanel } from './AdminNotificationSettingsPanel.jsx';
import { AdminApiRecoverySettingsPanel } from './AdminApiRecoverySettingsPanel.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

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
    id: 'landing-page',
    label: 'Landing Page',
    title: 'Landing page',
    description: 'Edit the public landing page hero, section headings, CTA text, footer copy, and SEO preview.',
    panel: <AdminLandingPageSettingsPanel />,
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
    id: 'popup-alert',
    label: 'Popup Alert',
    title: 'Popup alert',
    description: 'Create an image or text popup for the landing page, login page, inside the app, or everywhere.',
    panel: <AdminPopupAlertSettingsPanel />,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    title: 'Notifications',
    description: 'Send in-app/native notifications and configure iOS APNs plus Android FCM.',
    panel: <AdminNotificationSettingsPanel />,
  },
  {
    id: 'api-recovery',
    label: 'API Recovery',
    title: 'API recovery',
    description: 'Tune automatic timeout recovery for slow LMS API responses on this browser.',
    panel: <AdminApiRecoverySettingsPanel />,
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
  const [activeCategoryId, setActiveCategoryId] = useState('landing-page');
  const activeCategory = settingsCategories.find((category) => category.id === activeCategoryId) || settingsCategories[0];

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Settings"
          subtitle="System Preferences"
        />

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>Setting category</h2>
              <p>Choose one area to edit at a time.</p>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,108px),1fr))] gap-2 rounded-lg border border-line-soft bg-surface-1 p-2 shadow-sm max-[760px]:grid-cols-[repeat(auto-fit,minmax(min(100%,132px),1fr))]" role="tablist" aria-label="Settings categories">
            {settingsCategories.map((category) => {
              const isActive = activeCategory.id === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cx(
                    'inline-flex min-h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-md border px-4 text-[13px] font-extrabold transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 max-[760px]:min-h-11',
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
