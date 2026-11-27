export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
}

export class AuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function readFailure(response: Response): Promise<never> {
  const payload = await response.json().catch(() => null) as { error?: { code: string; message: string } } | null;
  throw new AuthError(payload?.error?.code ?? 'REQUEST_FAILED', payload?.error?.message ?? 'Request failed');
}

async function readUser(response: Response) {
  if (!response.ok) return readFailure(response);
  return (await response.json() as { user: User }).user;
}

export function createAuthClient(transport: typeof fetch = fetch) {
  return {
    async current(): Promise<User | null> {
      const response = await transport('/api/v1/auth/me');
      return response.status === 401 ? null : readUser(response);
    },
    async login(email: string, password: string): Promise<User> {
      return readUser(await transport('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }));
    },
    async logout(): Promise<void> {
      const response = await transport('/api/v1/auth/logout', { method: 'POST' });
      if (!response.ok) await readFailure(response);
    },
  };
}
