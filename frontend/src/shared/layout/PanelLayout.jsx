import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell.jsx';

export function PanelLayout() {
  const desktopSidebarToggle = true;
  const desktopSidebarHiddenByDefault = false;

  return (
    <AppShell
      desktopSidebarToggle={desktopSidebarToggle}
      desktopSidebarHiddenByDefault={desktopSidebarHiddenByDefault}
    >
      <div className="min-h-full">
        <Outlet />
      </div>
    </AppShell>
  );
}
