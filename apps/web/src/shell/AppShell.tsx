import { LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/auth-store';
import { Button } from '../components/Button';
import { InspectionScanningPage } from '../scanning/InspectionScanningPage';
import { getAllowedModules, ModuleKey, RoleNav } from './RoleNav';

const roleLabels = {
  INSPECTOR: '检验员',
  QUERY: '查询用户',
  ADMIN: '管理员'
};

export function AppShell() {
  const auth = useAuth();
  const session = auth.session;
  const allowedModules = useMemo(
    () => (session ? getAllowedModules(session.user.role) : []),
    [session]
  );
  const [activeModule, setActiveModule] = useState<ModuleKey>(() => allowedModules[0]?.key ?? 'inspection');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
          <Button type="button" variant="ghost" loading={isLoggingOut} loadingLabel="退出登录" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            退出登录
          </Button>
        </header>

        <main className="app-content" aria-labelledby="module-title">
          {activeModuleDefinition.key === 'inspection' ? (
            <InspectionScanningPage />
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
