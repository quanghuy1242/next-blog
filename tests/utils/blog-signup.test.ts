import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('blog signup helpers', () => {
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

  test('creates a signup intent with server-only trigger credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signupUrl: 'https://auth.example.com/sign-up?intent=signed-token',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { createBlogSignupIntent } = await import('@/lib/domain/auth/signup');
    const result = await createBlogSignupIntent({ returnTo: '/books' });

    expect(result).toEqual({
      signupUrl: 'https://auth.example.com/sign-up?intent=signed-token',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.com/api/auth/signup-intents',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('blog-signup-trigger:server-secret').toString('base64')}`,
          'Content-Type': 'application/json',
        }),
      })
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      flow: 'blog-commenter',
      authorizationSpaceId: 'space-payload',
      trigger: {
        kind: 'oauth_client',
        id: 'blog-signup-trigger',
      },
      returnUrl: 'https://blog.example.com/auth/login?returnTo=%2Fbooks',
      expiresInSeconds: 300,
    });
    expect(JSON.stringify(body)).not.toContain('server-secret');
  });

  test('rejects absolute return URLs and invalid signup URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signupUrl: 'https://evil.example.com/sign-up?intent=signed-token',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { createBlogSignupIntent } = await import('@/lib/domain/auth/signup');

    await expect(createBlogSignupIntent({ returnTo: 'https://evil.example.com' }))
      .rejects
      .toThrow('invalid signupUrl');

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.returnUrl).toBe('https://blog.example.com/auth/login?returnTo=%2F');
  });
});
