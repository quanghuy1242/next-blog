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
  const lastSavedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!('scrollRestoration' in window.history)) {
      return;
    }

    window.history.scrollRestoration = 'manual';

    const currentUrl = buildUrl(pathname, searchParams);
    const savePos = (url: string) => {
      positionsRef.current[url] = {
        x: window.scrollX,
        y: window.scrollY,
      };
      lastSavedUrlRef.current = url;
    };

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
      savePos(currentUrl);
      delete event.returnValue;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = target.parentElement?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }

      if (
        anchor.hasAttribute('download') ||
        (anchor.getAttribute('target') &&
          anchor.getAttribute('target') !== '_self')
      ) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) {
        return;
      }

      let nextUrl: URL;

      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      if (nextPath === currentUrl) {
        return;
      }

      savePos(currentUrl);
    };

    const handlePopState = () => {
      if (previousUrlRef.current) {
        savePos(previousUrlRef.current);
      }

      shouldRestoreRef.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    if (
      previousUrlRef.current &&
      previousUrlRef.current !== currentUrl &&
      lastSavedUrlRef.current !== previousUrlRef.current
    ) {
      savePos(previousUrlRef.current);
    }

    previousUrlRef.current = currentUrl;
    lastSavedUrlRef.current = null;

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
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
