import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { ApiError, apiFetch, extractApiMessage } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { TextInput } from '../components/TextInput';
import { AuthSession, ProductionLineOption } from './auth-types';
import { useAuth } from './auth-store';

type LoginPageProps = {
  onLoginComplete: () => void;
};

export function LoginPage({ onLoginComplete }: LoginPageProps) {
  const auth = useAuth();
  const [username, setUsername] = useState(() => auth.getRememberedUsername());
  const [password, setPassword] = useState('');
  const [productionLineId, setProductionLineId] = useState(() => auth.getRememberedProductionLineId());
  const [productionLines, setProductionLines] = useState<ProductionLineOption[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    apiFetch<ProductionLineOption[]>('/production-lines', { skipSessionExpiredHandler: true })
      .then((lines) => {
        if (!isCurrent) {
          return;
        }

        setProductionLines(lines);
        setProductionLineId((current) => {
          if (current && lines.some((line) => line.id === current)) {
            return current;
          }

          return lines[0]?.id ?? '';
        });
      })
      .catch((caught: unknown) => {
        if (isCurrent) {
          setError(extractErrorMessage(caught, '产线加载失败'));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingLines(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const canSubmit = useMemo(
    () => Boolean(username.trim() && password && productionLineId && !isLoadingLines && !isSubmitting),
    [username, password, productionLineId, isLoadingLines, isSubmitting]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError('请填写完整登录信息');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const session = await apiFetch<AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          productionLineId
        }),
        skipSessionExpiredHandler: true
      });

      auth.rememberLoginDefaults(session.user.username, session.productionLine.id);
      auth.setSession(session);
      onLoginComplete();
    } catch (caught) {
      setError(extractErrorMessage(caught, '用户或密码错误'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="login-title">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-brand" aria-hidden="true">
          <ScanLine size={28} strokeWidth={2.2} />
        </div>
        <header className="login-header">
          <h1 id="login-title">车间检验扫描统计系统</h1>
          <p>请选择产线并登录</p>
        </header>

        {auth.sessionExpiredNotice ? <Alert variant="error">{auth.sessionExpiredNotice}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="login-fields">
          <TextInput
            label="用户"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextInput
            label="密码"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Select
            label="产线"
            name="productionLineId"
            value={productionLineId}
            loading={isLoadingLines}
            disabled={productionLines.length === 0}
            onChange={(event) => setProductionLineId(event.target.value)}
          >
            <option value="">请选择产线</option>
            {productionLines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" loading={isSubmitting} loadingLabel="登录中..." disabled={!canSubmit}>
          登录
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
