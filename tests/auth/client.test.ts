import { existsSync } from 'node:fs';
import { expect, test, vi } from 'vitest';

const user = { id: 'player', email: 'player@example.test', displayName: 'ผู้เล่น', role: 'user' };

async function setup() {
  const entry = new URL('../../src/auth/client.ts', import.meta.url);
  expect(existsSync(entry), 'The web app needs a same-origin API client').toBe(true);
  const { createAuthClient } = await import(entry.href) as typeof import('../../src/auth/client.ts');
  const transport = vi.fn<typeof fetch>();
  return { client: createAuthClient(transport), transport };
}

test('login sends credentials to the API and returns the signed-in user', async () => {
  const { client, transport } = await setup();
  transport.mockResolvedValue(Response.json({ user }));
  expect(await client.login(user.email, 'test-fixture-password')).toEqual(user);
  expect(transport.mock.calls[0]?.[0]).toBe('/api/v1/auth/login');
  expect(transport.mock.calls[0]?.[1]?.method).toBe('POST');
  expect(JSON.parse(String(transport.mock.calls[0]?.[1]?.body))).toEqual({ email: user.email, password: 'test-fixture-password' });
});

test('session hydration returns null on 401 and returns the user on refresh', async () => {
  const { client, transport } = await setup();
  transport.mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ user }));
  expect(await client.current()).toBeNull();
  expect(await client.current()).toEqual(user);
  expect(transport.mock.calls[0]?.[0]).toBe('/api/v1/auth/me');
});

test('invalid login reports the API error and logout calls the revocation endpoint', async () => {
  const { client, transport } = await setup();
  transport.mockResolvedValueOnce(Response.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }, { status: 401 }));
  await expect(client.login(user.email, 'wrong')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  transport.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await client.logout();
  expect(transport.mock.calls[1]?.[0]).toBe('/api/v1/auth/logout');
  expect(transport.mock.calls[1]?.[1]?.method).toBe('POST');
});
