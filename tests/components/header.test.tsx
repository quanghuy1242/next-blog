import { render, screen, waitFor } from '@testing-library/react';
import { Header } from 'components/core/header';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('context/state', () => ({
  useAppContext: () => ({
    changeHeader: vi.fn(),
    header: 'Birdless Sky',
    homePosts: null,
    setHomePosts: vi.fn(),
  }),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/books',
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

describe('Header', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAuthenticated: false }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders the blog sign-in entry with the current return URL', () => {
    render(<Header text="Blog" />);

    const signInLink = screen.getByRole('link', { name: 'Sign in' });

    expect(signInLink).toHaveAttribute(
      'href',
      '/auth/login?returnTo=%2Fbooks'
    );
    expect(screen.getByRole('link', { name: 'About me' })).toHaveAttribute(
      'href',
      '/about'
    );
  });

  test('renders the logout entry when the user is authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAuthenticated: true }),
      })
    );

    render(<Header text="Blog" isAuthenticated />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
    });

    const logoutLink = screen.getByRole('link', { name: 'Logout' });

    expect(logoutLink).toHaveAttribute(
      'href',
      '/auth/logout?returnTo=%2Fbooks'
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  test('preserves the current auth UI when a later render has no server auth state', () => {
    const { rerender } = render(<Header text="Blog" isAuthenticated />);

    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();

    rerender(<Header text="Blog" />);

    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});
