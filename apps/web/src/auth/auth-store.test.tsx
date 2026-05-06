import { useEffect, useRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import { AuthProvider, useAuth } from './auth-store';

describe('AuthProvider session expiry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clears auth state and shows the session-expired notice after SESSION_EXPIRED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        new Response(JSON.stringify({ code: 'SESSION_EXPIRED', message: '登录状态已失效，请重新登录' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    render(
      <AuthProvider>
        <SessionExpiryProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('admin')).toBeTruthy();

    await act(async () => {
      await apiFetch('/auth/me').catch(() => undefined);
    });

    await waitFor(() => {
      expect(screen.getByText('登录状态已失效，请重新登录')).toBeTruthy();
      expect(screen.queryByText('admin')).toBeNull();
    });
  });
});

function SessionExpiryProbe() {
  const auth = useAuth();
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current && !auth.session && !auth.sessionExpiredNotice && !auth.isCheckingSession) {
      seeded.current = true;
      auth.setSession({
        user: { id: 'user-1', username: 'admin', role: 'ADMIN', mustChangePassword: false },
        productionLine: { id: 'line-1', code: 'L01', name: '一号产线' }
      });
    }
  }, [auth]);

  if (!auth.session && auth.sessionExpiredNotice) {
    return <p>{auth.sessionExpiredNotice}</p>;
  }

  if (!auth.session) {
    return null;
  }

  return <p>{auth.session.user.username}</p>;
}
