import { LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth-store';
import { Button } from '../components/Button';
import { MasterDataPage } from '../master-data/MasterDataPage';
import { QueryAnalysisPage } from '../query/QueryAnalysisPage';
import { InspectionScanningPage } from '../scanning/InspectionScanningPage';
import { getAllowedModules, ModuleKey, RoleNav } from './RoleNav';

const roleLabels = {
  INSPECTOR: '检验员',
  QUERY: '查询用户',
  ADMIN: '管理员'
};

type ThemePreference = 'light' | 'dark';

const themePreferenceKey = 'scan.theme';
const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
];

export function AppShell() {
  const auth = useAuth();
  const session = auth.session;
  const allowedModules = useMemo(
    () => (session ? getAllowedModules(session.user.role) : []),
    [session]
  );
  const [activeModule, setActiveModule] = useState<ModuleKey>(() => allowedModules[0]?.key ?? 'inspection');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themePreferenceKey, theme);
  }, [theme]);

  if (!session) {
    return null;
  }

  const activeModuleDefinition = allowedModules.find((module) => module.key === activeModule) ?? allowedModules[0];

  if (!activeModuleDefinition) {
    return null;
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiFetch<{ ok: true }>('/auth/logout', {
        method: 'POST',
        skipSessionExpiredHandler: true
      });
    } catch {
      // Local session state must still be cleared if logout cannot reach the server.
    } finally {
      auth.clearSession(null);
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-sidebar__title">车间检验扫描统计系统</div>
        <RoleNav role={session.user.role} activeModule={activeModuleDefinition.key} onModuleChange={setActiveModule} />
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__meta" aria-label="当前登录信息">
            <span>{session.user.username}</span>
            <span>{roleLabels[session.user.role]}</span>
            <span>{session.productionLine.name}</span>
          </div>
          <div className="app-topbar__actions">
            <div className="segmented-control" aria-label="主题">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'segmented-control__button',
                    theme === option.value ? 'segmented-control__button--active' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={theme === option.value}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button type="button" variant="ghost" loading={isLoggingOut} loadingLabel="退出登录" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              退出登录
            </Button>
          </div>
        </header>

        <main className="app-content" aria-labelledby="module-title">
          {activeModuleDefinition.key === 'inspection' ? (
            <InspectionScanningPage />
          ) : activeModuleDefinition.key === 'masterData' ? (
            <MasterDataPage />
          ) : activeModuleDefinition.key === 'query' ? (
            <QueryAnalysisPage />
          ) : (
            <section className="module-placeholder">
              <h1 id="module-title">{activeModuleDefinition.label}</h1>
              <p>该功能将在后续阶段启用</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(themePreferenceKey);
  return stored === 'dark' || stored === 'light' ? stored : 'light';
}
