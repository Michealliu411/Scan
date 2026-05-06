type ApiFetchOptions = RequestInit & {
  skipSessionExpiredHandler?: boolean;
};

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | undefined;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export function setSessionExpiredHandler(handler: SessionExpiredHandler | undefined): void {
  sessionExpiredHandler = handler;
}

export async function apiFetch<TResponse>(path: string, options: ApiFetchOptions = {}): Promise<TResponse> {
  const { skipSessionExpiredHandler, headers, ...requestOptions } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    }
  });

  const payload = await readJson(response);

  if (!response.ok) {
    if (
      response.status === 401 &&
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      payload.code === 'SESSION_EXPIRED' &&
      !skipSessionExpiredHandler
    ) {
      sessionExpiredHandler?.();
    }

    throw new ApiError(response.status, payload);
  }

  return payload as TResponse;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown
  ) {
    super(extractApiMessage(payload) ?? `API request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export function extractApiMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  return undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
