import { AppShell } from './AppShell.jsx';
import { NativeRouteTransition } from '../routing/NativeRouteTransition.jsx';

export function PanelLayout() {
  const desktopSidebarToggle = true;
  const desktopSidebarHiddenByDefault = false;

  return (
    <AppShell
      desktopSidebarToggle={desktopSidebarToggle}
      desktopSidebarHiddenByDefault={desktopSidebarHiddenByDefault}
    >
      <div className="min-h-full">
        {/* Native runtime: iOS push/pop slide transitions. Off-native this is a
            plain <Outlet/> (existing route fade is unchanged). */}
        <NativeRouteTransition />
      </div>
    </AppShell>
  );
}
