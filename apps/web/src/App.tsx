import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/auth-store';
import { ChangePasswordPage } from './auth/ChangePasswordPage';
import { LoginPage } from './auth/LoginPage';

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const auth = useAuth();
  const [routeKey, setRouteKey] = useState(0);

  if (!auth.session) {
    return <LoginPage onLoginComplete={() => setRouteKey((key) => key + 1)} />;
  }

  if (auth.session.user.mustChangePassword) {
    return <ChangePasswordPage onPasswordChanged={() => setRouteKey((key) => key + 1)} />;
  }

  return (
    <main className="app-shell" aria-labelledby="app-title" key={routeKey}>
      <h1 id="app-title">车间检验扫描统计系统</h1>
      <p>该功能将在后续阶段启用</p>
    </main>
  );
}
