'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    __historyScrollRestoredFor?: string;
  }
}

interface ScrollPosition {
  x: number;
  y: number;
}

type ScrollMap = Record<string, ScrollPosition>;

export function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const positionsRef = useRef<ScrollMap>({});
  const previousUrlRef = useRef<string | null>(null);
  const shouldRestoreRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!('scrollRestoration' in window.history)) {
      return;
    }

    window.history.scrollRestoration = 'manual';

    const currentUrl = buildUrl(pathname, searchParams);

    if (shouldRestoreRef.current) {
      shouldRestoreRef.current = false;
      const saved = positionsRef.current[currentUrl];

      if (saved) {
        window.__historyScrollRestoredFor = currentUrl;
        window.scrollTo(saved.x, saved.y);
      }
    } else if (previousUrlRef.current === null) {
      const saved = positionsRef.current[currentUrl];

      if (saved) {
        window.__historyScrollRestoredFor = currentUrl;
        window.scrollTo(saved.x, saved.y);
      }
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      positionsRef.current[currentUrl] = {
        x: window.scrollX,
        y: window.scrollY,
      };
      delete event.returnValue;
    };

    const handlePopState = () => {
      if (previousUrlRef.current) {
        positionsRef.current[previousUrlRef.current] = {
          x: window.scrollX,
          y: window.scrollY,
        };
      }

      shouldRestoreRef.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    if (previousUrlRef.current && previousUrlRef.current !== currentUrl) {
      positionsRef.current[previousUrlRef.current] = {
        x: window.scrollX,
        y: window.scrollY,
      };
    }

    previousUrlRef.current = currentUrl;

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname, searchParams]);

  return null;
}

function buildUrl(
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams>
) {
  const search = searchParams?.toString();

  return `${pathname || '/'}${search ? `?${search}` : ''}`;
}
