import { FormEvent, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { ApiError, apiFetch, extractApiMessage } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
import { AuthSession, AuthUser } from './auth-types';
import { useAuth } from './auth-store';

type ChangePasswordPageProps = {
  onPasswordChanged: () => void;
};

type ChangePasswordResponse = {
  ok: true;
  user: AuthUser;
};

export function ChangePasswordPage({ onPasswordChanged }: ChangePasswordPageProps) {
  const auth = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(newPassword && confirmPassword && !isSubmitting),
    [newPassword, confirmPassword, isSubmitting]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!auth.session || !canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<ChangePasswordResponse>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });
      const nextSession: AuthSession = {
        ...auth.session,
        user: response.user
      };

      auth.setSession(nextSession);
      onPasswordChanged();
    } catch (caught) {
      setError(extractErrorMessage(caught, '密码修改失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="change-password-title">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-brand" aria-hidden="true">
          <KeyRound size={28} strokeWidth={2.2} />
        </div>
        <header className="login-header">
          <h1 id="change-password-title">请修改初始密码</h1>
          <p>当前账号仍在使用初始密码，修改后才能继续使用系统。</p>
        </header>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="login-fields">
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
        </div>

        <Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
          修改密码
        </Button>
      </form>
    </main>
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return extractApiMessage(error.payload) ?? fallback;
  }

  return fallback;
}
