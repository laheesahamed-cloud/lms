import { Suspense, lazy } from 'react';
import { usePlatform, usePlatformComponent } from '../platform/PlatformProvider.jsx';
import { NativeHeaderInstallAction } from '../platform/native/HeaderInstallAction.jsx';

const WebHeaderInstallAction = lazy(() =>
  import('../platform/web/HeaderInstallAction.jsx').then((module) => ({
    default: module.WebHeaderInstallAction,
  }))
);

const headerInstallActionComponents = {
  native: NativeHeaderInstallAction,
  'native-ios-phone': NativeHeaderInstallAction,
  'native-ios-tablet': NativeHeaderInstallAction,
};

export function HeaderInstallAction() {
  const { platform } = usePlatform();
  const SelectedHeaderInstallAction = usePlatformComponent(
    headerInstallActionComponents,
    WebHeaderInstallAction
  );

  return (
    <Suspense fallback={null}>
      <SelectedHeaderInstallAction key={platform.target} />
    </Suspense>
  );
}
