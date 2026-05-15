import { NextRequest } from 'next/server';
import { describe, expect, test } from 'vitest';

import { BETTER_AUTH_TOKEN_COOKIE } from '@/lib/domain/auth/tokens';
import { GET } from '@/app/api/auth/session/route';

async function runHandler(cookieHeader?: string) {
  return GET(
    new NextRequest('http://localhost/api/auth/session', {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })
  );
}

describe('auth session API route', () => {
  test('returns signed-out state when no auth cookie is present', async () => {
    const response = await runHandler();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    await expect(response.json()).resolves.toEqual({ isAuthenticated: false });
  });

  test('returns signed-in state when an auth cookie is present', async () => {
    const response = await runHandler(`${BETTER_AUTH_TOKEN_COOKIE}=reader-token`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ isAuthenticated: true });
  });
});
