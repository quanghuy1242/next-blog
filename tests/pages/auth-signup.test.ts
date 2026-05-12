import { createMocks } from 'node-mocks-http';
import type { GetServerSidePropsContext } from 'next';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function createContext(
  overrides: Partial<GetServerSidePropsContext> = {}
): GetServerSidePropsContext {
  const { req, res } = createMocks({
    method: 'GET',
    ...(('query' in overrides ? { query: overrides.query } : {}) as object),
  });

  return {
    params: {},
    query: {},
    resolvedUrl: '/',
    ...overrides,
    req: req as unknown as GetServerSidePropsContext['req'],
    res: res as unknown as GetServerSidePropsContext['res'],
  };
}

describe('blog signup route', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_BASE_URL', 'https://auth.example.com');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://blog.example.com');
    vi.stubEnv('BLOG_SIGNUP_FLOW_SLUG', 'blog-commenter');
    vi.stubEnv('BLOG_SIGNUP_AUTHORIZATION_SPACE_ID', 'space-payload');
    vi.stubEnv('BLOG_SIGNUP_TRIGGER_KIND', 'oauth_client');
    vi.stubEnv('BLOG_SIGNUP_TRIGGER_CLIENT_ID', 'blog-signup-trigger');
    vi.stubEnv('BLOG_SIGNUP_TRIGGER_CLIENT_SECRET', 'server-secret');
    vi.stubEnv('BLOG_SIGNUP_INTENT_TTL_SECONDS', '300');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test('/auth/signup redirects to Auther signup URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          signupUrl: 'https://auth.example.com/sign-up?intent=signed-token',
        }),
      })
    );

    const { getServerSideProps } = await import('pages/auth/signup');
    const result = await getServerSideProps(createContext({
      query: {
        returnTo: '/books/1',
      },
    }));

    expect(result).toEqual({
      redirect: {
        destination: 'https://auth.example.com/sign-up?intent=signed-token',
        permanent: false,
      },
    });
  });

  test('/auth/signup renders unavailable state without exposing Auther errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'space_payload denied' }),
      })
    );

    const { getServerSideProps } = await import('pages/auth/signup');
    const result = await getServerSideProps(createContext({
      query: {
        returnTo: 'https://evil.example.com',
      },
    }));

    expect(result).toEqual({
      props: {
        returnTo: '/',
        unavailable: true,
      },
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[blog-signup] Failed to create signup intent.',
      expect.any(Error)
    );
  });
});
