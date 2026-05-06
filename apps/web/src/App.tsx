import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/auth-store';
import { ChangePasswordPage } from './auth/ChangePasswordPage';
import { LoginPage } from './auth/LoginPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './shell/AppShell';

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

  const loginPage = <LoginPage onLoginComplete={() => setRouteKey((key) => key + 1)} />;

  if (auth.isCheckingSession) {
    return (
      <main className="login-page" aria-busy="true">
        <div className="login-panel">
          <p className="muted-text">正在检查登录状态...</p>
        </div>
      </main>
    );
  }

  if (!auth.session) {
    return loginPage;
  }

  if (auth.session.user.mustChangePassword) {
    return <ChangePasswordPage onPasswordChanged={() => setRouteKey((key) => key + 1)} />;
  }

  return (
    <ProtectedRoute fallback={loginPage}>
      <AppShell key={routeKey} />
    </ProtectedRoute>
  );
}
