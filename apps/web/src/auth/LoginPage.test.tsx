import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth-store';
import { LoginPage } from './LoginPage';

const productionLines = [
  { id: 'line-1', code: 'L01', name: '一号产线' },
  { id: 'line-2', code: 'L02', name: '二号产线' }
];

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('prefills remembered username and production line and does not persist password', async () => {
    window.localStorage.setItem('scan:lastUsername', 'admin');
    window.localStorage.setItem('scan:lastProductionLineId', 'line-2');

    const fetchMock = createLoginFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    renderLoginPage();

    expect(await screen.findByDisplayValue('admin')).toBeTruthy();
    expect(await screen.findByDisplayValue('二号产线')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(window.localStorage.getItem('scan:lastUsername')).toBe('admin');
      expect(window.localStorage.getItem('scan:lastProductionLineId')).toBe('line-2');
    });

    expect(JSON.stringify(window.localStorage)).not.toContain('secret-password');
  });

  it('blocks login when password is missing', async () => {
    const fetchMock = createLoginFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    renderLoginPage();

    fireEvent.change(await screen.findByLabelText('用户'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('产线'), { target: { value: 'line-1' } });

    const loginButton = screen.getByRole('button', { name: '登录' }) as HTMLButtonElement;
    expect(loginButton.disabled).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows submitting without a production line so non-inspector roles are not blocked', async () => {
    const fetchMock = createLoginFetchMock({ productionLines: [] });
    vi.stubGlobal('fetch', fetchMock);

    renderLoginPage();

    fireEvent.change(await screen.findByLabelText('用户'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'admin' } });

    const loginButton = screen.getByRole('button', { name: '登录' }) as HTMLButtonElement;
    expect(loginButton.disabled).toBe(false);

    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'admin',
            password: 'admin'
          })
        })
      );
    });
  });
});

function renderLoginPage() {
  return render(
    <AuthProvider>
      <LoginPage onLoginComplete={() => undefined} />
    </AuthProvider>
  );
}

function createLoginFetchMock(options?: { productionLines?: typeof productionLines }) {
  const lines = options?.productionLines ?? productionLines;

  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith('/auth/me')) {
      return Promise.resolve(jsonResponse({ code: 'SESSION_EXPIRED' }, { status: 401 }));
    }

    if (url.endsWith('/production-lines')) {
      return Promise.resolve(jsonResponse(lines));
    }

    if (url.endsWith('/auth/login')) {
      return Promise.resolve(
        jsonResponse({
          user: { id: 'user-1', username: 'admin', role: 'ADMIN', mustChangePassword: false },
          productionLine: lines[1] ?? productionLines[0]
        })
      );
    }

    return Promise.resolve(jsonResponse({ message: 'unexpected request' }, { status: 404 }));
  });
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}
