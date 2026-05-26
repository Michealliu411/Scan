import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders the system title after session hydration falls back to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'SESSION_EXPIRED' }), { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }))
    );

    render(<App />);

    expect(await screen.findByText('车间检验扫描统计系统')).toBeTruthy();
  });

  it('hydrates a valid cookie session from auth/me on startup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'user-1', username: 'admin', role: 'ADMIN', mustChangePassword: false },
            productionLine: { id: 'line-1', code: 'L01', name: '一号产线' }
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    render(<App />);

    expect(await screen.findByText('admin')).toBeTruthy();
    expect(screen.getByText('全部产线')).toBeTruthy();
  });

  it('ignores an invalid auth/me payload instead of crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response('<!doctype html><div id="root"></div>'))
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }))
    );

    render(<App />);

    expect(await screen.findByText('检验员请选择产线，管理员和查询用户可直接登录')).toBeTruthy();
  });
});
