import { render, screen, waitFor } from '@testing-library/react';
import { Header } from '@/components/core/header';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/context/state', () => ({
  useAppContext: () => ({
    authState: null,
    changeHeader: vi.fn(),
    header: 'Birdless Sky',
    homePosts: null,
    setAuthState: vi.fn(),
    setHomePosts: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/books',
  useSearchParams: () => ({
    toString: () => '',
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

  test('renders blog auth entries with the current return URL', async () => {
    render(<Header text="Blog" />);

    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();

    const signUpLink = await screen.findByRole('link', { name: 'Sign up' });
    const signInLink = screen.getByRole('link', { name: 'Sign in' });

    expect(signUpLink).toHaveAttribute(
      'href',
      '/auth/signup?returnTo=%2Fbooks&source=header'
    );
    expect(signInLink).toHaveAttribute(
      'href',
      '/auth/login?returnTo=%2Fbooks'
    );
    expect(screen.queryByRole('link', { name: 'About me' })).not.toBeInTheDocument();
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
