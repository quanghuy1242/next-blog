import { render, screen } from '@testing-library/react';
import { Header } from 'components/core/header';
import { afterEach, describe, expect, test, vi } from 'vitest';

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
  }),
}));

describe('Header', () => {
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

  test('renders the logout entry when the user is authenticated', () => {
    render(<Header text="Blog" isAuthenticated />);

    const logoutLink = screen.getByRole('link', { name: 'Logout' });

    expect(logoutLink).toHaveAttribute(
      'href',
      '/auth/logout?returnTo=%2Fbooks'
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});
