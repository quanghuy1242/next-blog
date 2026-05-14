import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { BLOG_AUTH_STATE_COOKIE } from '@/lib/auth/blog-auth';

const exchangeAuthorizationCodeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/blog-auth', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/blog-auth')>(
      '@/lib/auth/blog-auth'
    );

  return {
    ...actual,
    exchangeAuthorizationCode: exchangeAuthorizationCodeMock,
  };
});

function createRequest(
  pathname: string,
  {
    query,
    requestCookies,
    requestHeaders,
  }: {
    query?: Record<string, string>;
    requestCookies?: Record<string, string>;
    requestHeaders?: Record<string, string>;
  } = {}
) {
  const url = new URL(`http://localhost${pathname}`);
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const cookieHeader = requestCookies
    ? Object.entries(requestCookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    : undefined;

  return new NextRequest(url, {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(requestHeaders ?? {}),
    },
  });
}

describe('blog auth routes', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_BASE_URL', 'https://auth.example.com');
    vi.stubEnv('BLOG_CLIENT_ID', 'blog-client-id');
    vi.stubEnv('BLOG_REDIRECT_URI', 'https://blog.example.com/auth/callback');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://blog.example.com');
    exchangeAuthorizationCodeMock.mockReset();
    exchangeAuthorizationCodeMock.mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 3600,
      idToken: 'id-token',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test('/auth/login stores PKCE state and redirects to auther authorize', async () => {
    const { GET } = await import('@/app/auth/login/route');
    const response = await GET(
      createRequest('/auth/login', {
        query: {
          returnTo: '/books/1~my-book',
        },
      })
    );

    const location = response.headers.get('location');
    expect(location).toContain('https://auth.example.com/api/auth/oauth2/authorize');

    const url = new URL(location!);
    expect(url.searchParams.get('client_id')).toBe('blog-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://blog.example.com/auth/callback'
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('theme')).toBe('blog');
    expect(response.headers.get('set-cookie')).toContain(`${BLOG_AUTH_STATE_COOKIE}=`);
  });

  test('/auth/callback exchanges code, stores auth cookies, and redirects back', async () => {
    const { createBlogAuthStatePayload, encodeBlogAuthStatePayload } = await import(
      '@/lib/auth/blog-auth'
    );
    const { GET } = await import('@/app/auth/callback/route');
    const pkceState = createBlogAuthStatePayload('/books');
    const response = await GET(
      createRequest('/auth/callback', {
        query: {
          code: 'auth-code',
          state: pkceState.state,
        },
        requestCookies: {
          [BLOG_AUTH_STATE_COOKIE]: encodeBlogAuthStatePayload(pkceState),
        },
        requestHeaders: {
          host: 'blog.quanghuy.dev',
        },
      })
    );

    expect(exchangeAuthorizationCodeMock).toHaveBeenCalledWith({
      code: 'auth-code',
      verifier: pkceState.verifier,
    });
    expect(response.headers.get('location')).toBe('http://localhost/books');

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('betterAuthToken=access-token');
    expect(setCookie).toContain('payload-token=access-token');
    expect(setCookie).toContain(`${BLOG_AUTH_STATE_COOKIE}=`);
  });

  test('/auth/logout clears auth cookies and redirects home', async () => {
    const { GET } = await import('@/app/auth/logout/route');
    const response = await GET(
      createRequest('/auth/logout', {
        requestHeaders: {
          host: 'blog.quanghuy.dev',
        },
      })
    );

    expect(response.headers.get('location')).toBe('https://blog.example.com/');

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('betterAuthToken=');
    expect(setCookie).toContain('payload-token=');
    expect(setCookie).toContain(`${BLOG_AUTH_STATE_COOKIE}=`);
  });
});
