import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { setSessionExpiredHandler } from '../api/client';
import { AuthSession } from './auth-types';

const rememberedUsernameKey = 'scan:lastUsername';
const rememberedProductionLineKey = 'scan:lastProductionLineId';
const sessionExpiredMessage = '登录状态已失效，请重新登录';

type AuthContextValue = {
  session: AuthSession | null;
  sessionExpiredNotice: string | null;
  setSession: (session: AuthSession) => void;
  clearSession: (notice?: string | null) => void;
  rememberLoginDefaults: (username: string, productionLineId: string) => void;
  getRememberedUsername: () => string;
  getRememberedProductionLineId: () => string;
  clearSessionExpiredNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const value = useMemo<AuthContextValue>(() => {
    const clearSession = (notice: string | null = null) => {
      setSessionState(null);
      setSessionExpiredNotice(notice);
    };

    setSessionExpiredHandler(() => {
      clearSession(sessionExpiredMessage);
    });

    return {
      session,
      sessionExpiredNotice,
      setSession(nextSession) {
        setSessionState(nextSession);
        setSessionExpiredNotice(null);
      },
      clearSession,
      rememberLoginDefaults(username, productionLineId) {
        writeLocalStorage(rememberedUsernameKey, username);
        writeLocalStorage(rememberedProductionLineKey, productionLineId);
      },
      getRememberedUsername() {
        return readLocalStorage(rememberedUsernameKey);
      },
      getRememberedProductionLineId() {
        return readLocalStorage(rememberedProductionLineKey);
      },
      clearSessionExpiredNotice() {
        setSessionExpiredNotice(null);
      }
    };
  }, [session, sessionExpiredNotice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

function readLocalStorage(key: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(key) ?? '';
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value);
}
