import { createMocks } from 'node-mocks-http';
import type { GetServerSidePropsContext } from 'next';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { BLOG_AUTH_STATE_COOKIE } from 'common/utils/blog-auth';

const exchangeAuthorizationCodeMock = vi.hoisted(() => vi.fn());

vi.mock('common/utils/blog-auth', async () => {
  const actual =
    await vi.importActual<typeof import('common/utils/blog-auth')>(
      'common/utils/blog-auth'
    );

  return {
    ...actual,
    exchangeAuthorizationCode: exchangeAuthorizationCodeMock,
  };
});

function createContext(
  overrides: Partial<GetServerSidePropsContext> & {
    requestCookies?: Record<string, string>;
    requestHeaders?: Record<string, string>;
  } = {}
): GetServerSidePropsContext {
  const { req, res } = createMocks({
    method: 'GET',
    ...(('query' in overrides ? { query: overrides.query } : {}) as object),
  });

  const request = req as unknown as GetServerSidePropsContext['req'];
  const response = res as unknown as GetServerSidePropsContext['res'];

  if (overrides.requestCookies) {
    request.cookies = overrides.requestCookies;
  }

  if (overrides.requestHeaders) {
    request.headers = {
      ...request.headers,
      ...overrides.requestHeaders,
    };
  }

  return {
    params: {},
    query: {},
    resolvedUrl: '/',
    ...overrides,
    req: request,
    res: response,
  };
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
    const { getServerSideProps } = await import('pages/auth/login');
    const context = createContext({
      query: {
        returnTo: '/books/1~my-book',
      },
    });

    const result = await getServerSideProps(context);

    expect(result).toEqual({
      redirect: {
        destination: expect.stringContaining(
          'https://auth.example.com/api/auth/oauth2/authorize'
        ),
        permanent: false,
      },
    });

    const location = (result as { redirect: { destination: string } }).redirect.destination;
    const url = new URL(location);
    expect(url.searchParams.get('client_id')).toBe('blog-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://blog.example.com/auth/callback'
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('theme')).toBe('blog');

    const setCookie = context.res.getHeader('Set-Cookie');
    expect(setCookie).toEqual(
      expect.arrayContaining([expect.stringContaining(`${BLOG_AUTH_STATE_COOKIE}=`)])
    );
  });

  test('/auth/callback exchanges code, stores auth cookies, and redirects back', async () => {
    const { createBlogAuthStatePayload, encodeBlogAuthStatePayload } = await import(
      'common/utils/blog-auth'
    );
    const { getServerSideProps } = await import('pages/auth/callback');
    const pkceState = createBlogAuthStatePayload('/books');
    const context = createContext({
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
    });

    const result = await getServerSideProps(context);

    expect(exchangeAuthorizationCodeMock).toHaveBeenCalledWith({
      code: 'auth-code',
      verifier: pkceState.verifier,
    });
    expect(result).toEqual({
      redirect: {
        destination: '/books',
        permanent: false,
      },
    });

    const setCookie = context.res.getHeader('Set-Cookie');
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringContaining('betterAuthToken=id-token'),
        expect.stringContaining('payload-token=id-token'),
        expect.stringContaining(`${BLOG_AUTH_STATE_COOKIE}=`),
      ])
    );
  });

  test('/auth/logout clears auth cookies and redirects home', async () => {
    const { getServerSideProps } = await import('pages/auth/logout');
    const context = createContext({
      requestHeaders: {
        host: 'blog.quanghuy.dev',
      },
    });

    const result = await getServerSideProps(context);

    expect(result).toEqual({
      redirect: {
        destination: 'https://blog.example.com',
        permanent: false,
      },
    });

    const setCookie = context.res.getHeader('Set-Cookie');
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringContaining('betterAuthToken='),
        expect.stringContaining('payload-token='),
        expect.stringContaining(`${BLOG_AUTH_STATE_COOKIE}=`),
      ])
    );
  });
});
