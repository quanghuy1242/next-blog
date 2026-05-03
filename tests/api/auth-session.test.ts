import handler from 'pages/api/auth/session';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { describe, expect, test } from 'vitest';

import { BETTER_AUTH_TOKEN_COOKIE } from 'common/utils/auth';

function runHandler(req: Parameters<typeof createMocks>[0]) {
  const { req: request, res: response } = createMocks(req);

  handler(
    request as unknown as NextApiRequest,
    response as unknown as NextApiResponse
  );

  return { req: request, res: response };
}

describe('auth session API route', () => {
  test('returns signed-out state when no auth cookie is present', () => {
    const { res } = runHandler({
      method: 'GET',
    });

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Cache-Control')).toBe('no-store, max-age=0');
    expect(res._getJSONData()).toEqual({ isAuthenticated: false });
  });

  test('returns signed-in state when an auth cookie is present', () => {
    const { res } = runHandler({
      method: 'GET',
      cookies: {
        [BETTER_AUTH_TOKEN_COOKIE]: 'reader-token',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ isAuthenticated: true });
  });
});
