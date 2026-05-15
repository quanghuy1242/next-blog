import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ host: 'blog.example.com' })),
}));

vi.mock('@/components/core/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/core/container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/surface/card', () => ({
  CenteredPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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
    redirectMock.mockReset();
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

    const { default: BlogAuthSignupPage } = await import('@/app/auth/signup/page');

    await expect(
      BlogAuthSignupPage({
        searchParams: Promise.resolve({
          returnTo: '/books/1',
        }),
      })
    ).rejects.toThrow('REDIRECT:https://auth.example.com/sign-up?intent=signed-token');
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

    const { default: BlogAuthSignupPage } = await import('@/app/auth/signup/page');
    const page = await BlogAuthSignupPage({
      searchParams: Promise.resolve({
        returnTo: 'https://evil.example.com',
      }),
    });

    render(page);

    expect(screen.getByText('Sign up is not available')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth/login?returnTo=%2F'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[blog-signup] Failed to create signup intent.',
      expect.any(Error)
    );
  });
});
