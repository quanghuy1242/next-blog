import {
  clearBlogAuthTokenCookies,
  deriveSharedCookieDomain,
  setBlogAuthTokenCookies,
} from 'common/utils/auth-cookies';
import { createMocks } from 'node-mocks-http';
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('auth cookie helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('derives a shared parent domain for production-style hosts', () => {
    expect(
      deriveSharedCookieDomain({
        headers: {
          host: 'blog.quanghuy.dev',
        },
      })
    ).toBe('.quanghuy.dev');
  });

  test('uses host-only cookies for localhost', () => {
    expect(
      deriveSharedCookieDomain({
        headers: {
          host: 'localhost:3000',
        },
      })
    ).toBeUndefined();
  });

  test('sets mirrored auth cookies with a shared domain when available', () => {
    const { res } = createMocks();

    setBlogAuthTokenCookies({
      maxAgeSeconds: 60,
      req: {
        headers: {
          host: 'blog.quanghuy.dev',
        },
      },
      res,
      token: 'jwt-token',
    });

    const setCookie = res.getHeader('Set-Cookie');
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringContaining('betterAuthToken=jwt-token'),
        expect.stringContaining('payload-token=jwt-token'),
      ])
    );
    expect(setCookie).toEqual(
      expect.arrayContaining([expect.stringContaining('Domain=.quanghuy.dev')])
    );
  });

  test('clears mirrored auth cookies', () => {
    const { res } = createMocks();

    clearBlogAuthTokenCookies(res, {
      headers: {
        host: 'blog.quanghuy.dev',
      },
    });

    const setCookie = res.getHeader('Set-Cookie');
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringContaining('betterAuthToken='),
        expect.stringContaining('payload-token='),
        expect.stringContaining('Max-Age=0'),
      ])
    );
  });
});
