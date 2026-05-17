import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell.jsx';

export function PanelLayout() {
  const location = useLocation();
  const desktopSidebarToggle = true;
  const desktopSidebarHiddenByDefault = false;

  return (
    <AppShell
      desktopSidebarToggle={desktopSidebarToggle}
      desktopSidebarHiddenByDefault={desktopSidebarHiddenByDefault}
    >
      <div className="min-h-full overflow-x-hidden" key={`${location.pathname}${location.search}`}>
        <Outlet />
      </div>
    </AppShell>
  );
}
