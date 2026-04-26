import {
  BETTER_AUTH_TOKEN_COOKIE,
  PAYLOAD_ADMIN_TOKEN_COOKIE,
  PAYLOAD_BETTER_AUTH_TOKEN_COOKIE,
  getAuthCacheSubjectFromToken,
  getBetterAuthTokenFromRequest,
} from 'common/utils/auth';
import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getBetterAuthTokenFromRequest', () => {
  test('returns token from Authorization Bearer header', () => {
    expect(
      getBetterAuthTokenFromRequest({
        headers: {
          authorization: 'Bearer token-123',
        },
      })
    ).toBe('token-123');
  });

  test('returns token from Authorization JWT header for compatibility', () => {
    expect(
      getBetterAuthTokenFromRequest({
        headers: {
          authorization: 'JWT token-123',
        },
      })
    ).toBe('token-123');
  });

  test('uses Better Auth session cookie from the shared parent domain', () => {
    expect(
      getBetterAuthTokenFromRequest({
        cookies: {
          [BETTER_AUTH_TOKEN_COOKIE]: 'token-123',
        },
      })
    ).toBe('token-123');
  });

  test('falls back to payload betterAuthToken cookie', () => {
    expect(
      getBetterAuthTokenFromRequest({
        cookies: {
          [PAYLOAD_BETTER_AUTH_TOKEN_COOKIE]: 'token-123',
        },
      })
    ).toBe('token-123');
  });

  test('falls back to payload admin token cookie', () => {
    expect(
      getBetterAuthTokenFromRequest({
        cookies: {
          [PAYLOAD_ADMIN_TOKEN_COOKIE]: 'token-123',
        },
      })
    ).toBe('token-123');
  });

  test('prefers Authorization header over cookies', () => {
    expect(
      getBetterAuthTokenFromRequest({
        headers: {
          authorization: 'Bearer token-from-header',
        },
        cookies: {
          [BETTER_AUTH_TOKEN_COOKIE]: 'token-from-cookie',
        },
      })
    ).toBe('token-from-header');
  });

  test('returns null when no token source exists', () => {
    expect(getBetterAuthTokenFromRequest({})).toBeNull();
  });
});

describe('getAuthCacheSubjectFromToken', () => {
  function createJwtToken(
    payload: Record<string, unknown>,
    header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' }
  ): string {
    const encode = (value: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(value))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${encode(header)}.${encode(payload)}.signature`;
  }

  test('returns the JWT subject when the token is still valid', () => {
    const nowSeconds = 1_700_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);

    expect(
      getAuthCacheSubjectFromToken(
        createJwtToken({
          sub: 'user-123',
          exp: nowSeconds + 60,
        })
      )
    ).toBe('user-123');
  });

  test('returns null for expired JWTs', () => {
    const nowSeconds = 1_700_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);

    expect(
      getAuthCacheSubjectFromToken(
        createJwtToken({
          sub: 'user-123',
          exp: nowSeconds - 1,
        })
      )
    ).toBeNull();
  });

  test('returns null for non-JWT values', () => {
    expect(getAuthCacheSubjectFromToken('token-123')).toBeNull();
  });
});
