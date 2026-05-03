import cn from 'classnames';
import { useAppContext } from 'context/state';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface NavigationItem {
  name: string;
  href: string;
  hardNavigate?: boolean;
}

interface HeaderTitleProps {
  text: string;
  link: string;
}

const HeaderTitle = ({ text, link }: HeaderTitleProps) => {
  return (
    <h3
      className={cn(
        'text-white',
        'text-2xl font-semibold',
        'tracking-tight md:tracking-tighter leading-tight'
      )}
    >
      <Link href={link} className="hover:underline whitespace-no-wrap">
        {text}
      </Link>
    </h3>
  );
};

const OptionItem = ({ name, href, hardNavigate = false }: NavigationItem) => {
  return (
    <span
      className={cn(
        'text-white',
        'font-semibold',
        'border-b-2 border-transparent hover:border-white'
      )}
    >
      {hardNavigate ? (
        <a href={href}>{name}</a>
      ) : (
        <Link href={href}>{name}</Link>
      )}
    </span>
  );
};

interface OptionProps {
  items?: NavigationItem[];
}

const Option = ({ items = [] }: OptionProps) => {
  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <OptionItem key={item.name} name={item.name} href={item.href} />
      ))}
    </div>
  );
};

interface HeaderProps {
  text?: string | null;
  isAuthenticated?: boolean;
}

export function Header({ text, isAuthenticated }: HeaderProps) {
  const { header } = useAppContext();
  const router = useRouter();
  const [authState, setAuthState] = useState(Boolean(isAuthenticated));
  const returnTo = router.asPath || '/';

  useEffect(() => {
    if (typeof isAuthenticated === 'boolean') {
      setAuthState(isAuthenticated);
    }
  }, [isAuthenticated]);

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

    router.events.on('routeChangeComplete', syncAuthState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      router.events.off('routeChangeComplete', syncAuthState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [router.events]);

  const authItems = authState
    ? [
        { name: 'About me', href: '/about' },
        {
          name: 'Logout',
          href: `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`,
          hardNavigate: true,
        },
      ]
    : [
        { name: 'About me', href: '/about' },
        {
          name: 'Sign in',
          href: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
          hardNavigate: true,
        },
      ];

  return (
    <div
      className={cn(
        'flex items-center',
        'fixed w-full h-16 top-0 z-50',
        'py-2 px-4',
        'bg-blue shadow-dark'
      )}
    >
      <HeaderTitle text={text || header} link="/" />
      <div className="flex-grow" />
      <Option items={authItems} />
    </div>
  );
}
