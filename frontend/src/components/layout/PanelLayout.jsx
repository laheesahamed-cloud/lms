import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell.jsx';
import { ui } from '../../styles/tailwindClasses.js';

export function PanelLayout() {
  const location = useLocation();
  const desktopSidebarToggle = true;
  const desktopSidebarHiddenByDefault = false;

  return (
    <AppShell
      desktopSidebarToggle={desktopSidebarToggle}
      desktopSidebarHiddenByDefault={desktopSidebarHiddenByDefault}
    >
      <div className={ui.panelRouteScene} key={`${location.pathname}${location.search}`}>
        <Outlet />
      </div>
    </AppShell>
  );
}
