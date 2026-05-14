'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    __historyScrollRestoredFor?: string;
  }
}

const STORAGE_KEY_PREFIX = 'scroll-pos:';

export function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldRestoreRef = useRef(false);
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentUrl = buildUrl(pathname, searchParams);

    const savePosition = (url: string) => {
      try {
        window.sessionStorage.setItem(
          getStorageKey(url),
          JSON.stringify({
            x: window.scrollX,
            y: window.scrollY,
          })
        );
      } catch {
        // Best effort only.
      }
    };

    const restorePosition = (url: string) => {
      try {
        const raw = window.sessionStorage.getItem(getStorageKey(url));

        if (!raw) {
          return false;
        }

        const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
        const x = typeof parsed.x === 'number' ? parsed.x : 0;
        const y = typeof parsed.y === 'number' ? parsed.y : 0;

        window.__historyScrollRestoredFor = url;
        window.scrollTo(x, y);
        return true;
      } catch {
        return false;
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      savePosition(currentUrl);
      delete event.returnValue;
    };

    const handlePageHide = () => {
      savePosition(currentUrl);
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
        (anchor.target && anchor.target !== '_self')
      ) {
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

      const nextRoute = `${nextUrl.pathname}${nextUrl.search}`;
      if (nextRoute === currentUrl) {
        return;
      }

      savePosition(currentUrl);
    };

    const handlePopState = () => {
      savePosition(previousUrlRef.current ?? currentUrl);
      shouldRestoreRef.current = true;
    };

    window.history.scrollRestoration = 'manual';
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);

    if (shouldRestoreRef.current) {
      shouldRestoreRef.current = false;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          restorePosition(currentUrl);
        });
      });
    }

    previousUrlRef.current = currentUrl;

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
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

function getStorageKey(url: string) {
  return `${STORAGE_KEY_PREFIX}${url}`;
}
