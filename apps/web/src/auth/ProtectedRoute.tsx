import { ReactNode } from 'react';
import { useAuth } from './auth-store';

type ProtectedRouteProps = {
  children: ReactNode;
  fallback: ReactNode;
};

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { session } = useAuth();

  if (!session) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
