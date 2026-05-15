'use client';

import cn from 'classnames';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { ButtonLink } from '@/components/ui/aria/button';

interface NavigationItem {
  name: string;
  href: string;
  hardNavigate?: boolean;
}

interface AppHeaderProps {
  text?: string | null;
  isAuthenticated?: boolean;
}

function HeaderNavItems({ items = [] }: { items?: NavigationItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <ul className="menu menu-horizontal gap-1 p-0">
      {items.map((item) => (
        <li key={item.name}>
          <ButtonLink
            href={item.href}
            hardNavigate={item.hardNavigate}
            variant="ghost"
            size="sm"
            className="text-primary-content hover:bg-primary-content/15"
          >
            {item.name}
          </ButtonLink>
        </li>
      ))}
    </ul>
  );
}

export function AppHeader({ text, isAuthenticated }: AppHeaderProps) {
  const pathname = usePathname();
  const [authState, setAuthState] = useState<boolean | null>(isAuthenticated ?? null);
  const [returnTo, setReturnTo] = useState(pathname || '/');

  useEffect(() => {
    if (typeof isAuthenticated === 'boolean') {
      setAuthState(isAuthenticated);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (window.location.pathname === pathname) {
      setReturnTo(`${window.location.pathname}${window.location.search}`);
      return;
    }

    setReturnTo(pathname || '/');
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function syncAuthState() {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { isAuthenticated?: boolean };

        if (!cancelled && typeof data.isAuthenticated === 'boolean') {
          setAuthState(data.isAuthenticated);
        }
      } catch {
        // Keep the current UI state when the auth probe fails.
      }
    }

    void syncAuthState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncAuthState();
      }
    };

    const handleWindowFocus = () => {
      void syncAuthState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [pathname]);

  const authItems = authState
    ? [
        {
          name: 'Bookshelf',
          href: '/books/shelf',
        },
        {
          name: 'Logout',
          href: `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`,
          hardNavigate: true,
        },
      ]
    : authState === false
      ? [
          {
            name: 'Sign up',
            href: `/auth/signup?returnTo=${encodeURIComponent(returnTo)}&source=header`,
            hardNavigate: true,
          },
          {
            name: 'Sign in',
            href: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
            hardNavigate: true,
          },
        ]
      : [];

  return (
    <header
      className={cn(
        'navbar fixed top-0 z-50 min-h-16 w-full bg-primary px-4 py-2 text-primary-content shadow-sm'
      )}
    >
      <div className="navbar-start">
        <ButtonLink
          href="/"
          variant="ghost"
          className="h-auto min-h-0 px-0 text-2xl font-semibold leading-tight text-primary-content hover:bg-transparent hover:underline"
        >
          {text || 'Birdless Sky'}
        </ButtonLink>
      </div>
      <nav className="navbar-end" aria-label="Primary">
        <HeaderNavItems items={authItems} />
      </nav>
    </header>
  );
}
