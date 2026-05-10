import { AuthBootstrap } from './AuthBootstrap.jsx';
import { ThemeBootstrap } from './ThemeBootstrap.jsx';

export function AppProviders({ children }) {
  return (
    <ThemeBootstrap>
      <AuthBootstrap>{children}</AuthBootstrap>
    </ThemeBootstrap>
  );
}
