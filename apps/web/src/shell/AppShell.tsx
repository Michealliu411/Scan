import { KeyRound, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, extractApiMessage } from '../api/client';
import { useAuth } from '../auth/auth-store';
import { AuthSession, AuthUser } from '../auth/auth-types';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
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
type ChangePasswordResponse = {
  ok: true;
  user: AuthUser;
};

const themePreferenceKey = 'scan.theme';
const sidebarPreferenceKey = 'scan.sidebar';
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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => readSidebarPreference());
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordChangedMessage, setPasswordChangedMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themePreferenceKey, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(sidebarPreferenceKey, isSidebarExpanded ? 'expanded' : 'collapsed');
  }, [isSidebarExpanded]);

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
    <div
      className={[
        'app-layout',
        isSidebarExpanded ? 'app-layout--sidebar-expanded' : 'app-layout--sidebar-collapsed'
      ].join(' ')}
    >
      <aside
        className={['app-sidebar', isSidebarExpanded ? 'app-sidebar--expanded' : 'app-sidebar--collapsed'].join(' ')}
        aria-label="主菜单"
      >
        <div className="app-sidebar__header">
          <div className="app-sidebar__title">车间检验扫描统计系统</div>
          <button
            type="button"
            className="app-sidebar__toggle"
            aria-label={isSidebarExpanded ? '收起菜单' : '展开菜单'}
            aria-pressed={isSidebarExpanded}
            onClick={() => setIsSidebarExpanded((current) => !current)}
          >
            {isSidebarExpanded ? (
              <PanelLeftClose size={18} strokeWidth={2} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={18} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </div>
        <RoleNav
          role={session.user.role}
          activeModule={activeModuleDefinition.key}
          isCollapsed={!isSidebarExpanded}
          onModuleChange={setActiveModule}
        />
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPasswordChangedMessage(null);
                setIsPasswordDialogOpen(true);
              }}
            >
              <KeyRound size={16} strokeWidth={2} aria-hidden="true" />
              修改密码
            </Button>
            <Button type="button" variant="ghost" loading={isLoggingOut} loadingLabel="退出登录" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              退出登录
            </Button>
          </div>
        </header>

        {passwordChangedMessage ? <Alert variant="success">{passwordChangedMessage}</Alert> : null}

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
      {isPasswordDialogOpen ? (
        <ChangeOwnPasswordDialog
          session={session}
          onClose={() => setIsPasswordDialogOpen(false)}
          onChanged={(nextSession) => {
            auth.setSession(nextSession);
            setIsPasswordDialogOpen(false);
            setPasswordChangedMessage('密码已修改');
          }}
        />
      ) : null}
    </div>
  );
}

function ChangeOwnPasswordDialog({
  session,
  onClose,
  onChanged
}: {
  session: AuthSession;
  onClose: () => void;
  onChanged: (session: AuthSession) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = Boolean(currentPassword && newPassword && confirmPassword && !isSubmitting);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<ChangePasswordResponse>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      onChanged({
        ...session,
        user: response.user
      });
    } catch (caught) {
      setError(extractPasswordError(caught, '密码修改失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="form-panel" role="dialog" aria-modal="true" aria-label="修改密码">
        <div className="form-panel__header">
          <h2>修改密码</h2>
          <Button type="button" variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        <form className="master-form" onSubmit={handleSubmit}>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <TextInput
            label="当前密码"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextInput
            label="新密码"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextInput
            label="确认新密码"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" loading={isSubmitting} loadingLabel="修改中" disabled={!canSubmit}>
              确认修改
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function extractPasswordError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return extractApiMessage(error.payload) ?? fallback;
  }

  return fallback;
}

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(themePreferenceKey);
  return stored === 'dark' || stored === 'light' ? stored : 'light';
}

function readSidebarPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(sidebarPreferenceKey) === 'expanded';
}
