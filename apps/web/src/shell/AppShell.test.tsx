import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../auth/auth-types';
import { AppShell } from './AppShell';

const clearSessionMock = vi.fn();
let currentSession: AuthSession;

vi.mock('../auth/auth-store', () => ({
  useAuth: () => ({
    session: currentSession,
    clearSession: clearSessionMock
  })
}));

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
