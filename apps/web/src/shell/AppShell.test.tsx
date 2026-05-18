import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import { AuthSession } from '../auth/auth-types';
import { AppShell } from './AppShell';

const clearSessionMock = vi.fn();
const setSessionMock = vi.fn((nextSession: AuthSession) => {
  currentSession = nextSession;
});
let currentSession: AuthSession;

vi.mock('../api/client', () => ({
  apiFetch: vi.fn()
}));

vi.mock('../auth/auth-store', () => ({
  useAuth: () => ({
    session: currentSession,
    clearSession: clearSessionMock,
    setSession: setSessionMock
  })
}));

const apiFetchMock = vi.mocked(apiFetch);

vi.mock('../scanning/InspectionScanningPage', () => ({
  InspectionScanningPage: () => <h1 id="module-title">检验扫描</h1>
}));

vi.mock('../query/QueryAnalysisPage', () => ({
  QueryAnalysisPage: () => <h1 id="module-title">查询分析</h1>
}));

vi.mock('../master-data/MasterDataPage', () => ({
  MasterDataPage: () => <h1 id="module-title">基础数据</h1>
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({ ok: true });
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    currentSession = createSession('ADMIN');
  });

  it('persists explicit dark and light theme choices on the document root', () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole('button', { name: '深色' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('scan.theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: '浅色' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('scan.theme')).toBe('light');
  });

  it('restores persisted theme preference on mount', () => {
    window.localStorage.setItem('scan.theme', 'dark');

    render(<AppShell />);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: '深色' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows only role-allowed navigation modules', () => {
    currentSession = createSession('QUERY');

    render(<AppShell />);

    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).queryByRole('button', { name: /检验扫描/ })).toBeNull();
    expect(within(nav).getByRole('button', { name: /查询分析/ })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: /基础数据/ })).toBeNull();
  });

  it('starts with the sidebar collapsed and persists explicit expansion', () => {
    render(<AppShell />);

    expect(screen.getByLabelText('主菜单').classList.contains('app-sidebar--collapsed')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '展开菜单' }));

    expect(screen.getByLabelText('主菜单').classList.contains('app-sidebar--expanded')).toBe(true);
    expect(window.localStorage.getItem('scan.sidebar')).toBe('expanded');
    expect(screen.getByRole('button', { name: '收起菜单' })).toBeTruthy();
  });

  it('lets a logged-in user change their own password from the top bar', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      user: {
        id: 'user-1',
        username: 'admin',
        role: 'ADMIN',
        mustChangePassword: false
      }
    });

    render(<AppShell />);

    fireEvent.click(screen.getByRole('button', { name: '修改密码' }));
    expect(screen.getByRole('dialog', { name: '修改密码' }).parentElement?.classList.contains('modal-backdrop')).toBe(true);
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' })
      });
      expect(setSessionMock).toHaveBeenCalledWith({
        ...currentSession,
        user: {
          id: 'user-1',
          username: 'admin',
          role: 'ADMIN',
          mustChangePassword: false
        }
      });
    });
    expect(await screen.findByText('密码已修改')).toBeTruthy();
  });
});

function createSession(role: AuthSession['user']['role']): AuthSession {
  return {
    user: {
      id: 'user-1',
      username: role.toLowerCase(),
      role,
      mustChangePassword: false
    },
    productionLine: {
      id: 'line-1',
      code: 'LINE-01',
      name: '产线01'
    }
  };
}
