import { roleRouteMode } from '../shared/auth/roleAccess.js';
import { useAuthStore } from '../shared/stores/authStore.js';
import { shouldPreloadRoutes } from '../shared/utils/performanceProfile.js';

let commonRoutePreloaders = new Map();
let roleRoutePreloaders = {
  admin: new Map(),
  student: new Map(),
};
let dynamicRoutePreloader = () => null;

export function configureRoutePreloaders({
  commonRoutePreloaders: nextCommonRoutePreloaders,
  roleRoutePreloaders: nextRoleRoutePreloaders,
  dynamicRoutePreloader: nextDynamicRoutePreloader,
}) {
  commonRoutePreloaders = nextCommonRoutePreloaders instanceof Map
    ? nextCommonRoutePreloaders
    : new Map();
  roleRoutePreloaders = {
    admin: nextRoleRoutePreloaders?.admin instanceof Map ? nextRoleRoutePreloaders.admin : new Map(),
    student: nextRoleRoutePreloaders?.student instanceof Map ? nextRoleRoutePreloaders.student : new Map(),
  };
  dynamicRoutePreloader = typeof nextDynamicRoutePreloader === 'function'
    ? nextDynamicRoutePreloader
    : () => null;
}

export function preloadRouteByPath(path, role = useAuthStore.getState().user?.role) {
  if (!path || !shouldPreloadRoutes()) {
    return;
  }

  const cleanPath = path.replace(/^\/(?:admin|app|student)(?=\/|$)/, '') || '/dashboard';
  const lookupPath = cleanPath
    .split('#')[0]
    .split('?')[0] || '/dashboard';
  const preloadRole = roleRouteMode(role);
  const preload =
    dynamicRoutePreloader(cleanPath) ||
    roleRoutePreloaders[preloadRole]?.get(lookupPath) ||
    commonRoutePreloaders.get(lookupPath);
  if (typeof preload === 'function') {
    preload().catch(() => {});
  }
}
