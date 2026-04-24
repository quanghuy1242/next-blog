import {
  BETTER_AUTH_TOKEN_COOKIE,
  PAYLOAD_ADMIN_TOKEN_COOKIE,
  PAYLOAD_BETTER_AUTH_TOKEN_COOKIE,
  getBetterAuthTokenFromRequest,
} from 'common/utils/auth';

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