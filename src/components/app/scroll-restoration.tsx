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
          return null;
        }

        const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
        const x = typeof parsed.x === 'number' ? parsed.x : 0;
        const y = typeof parsed.y === 'number' ? parsed.y : 0;
        return { x, y };
      } catch {
        return null;
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
      const savedPosition = restorePosition(currentUrl);

      if (savedPosition) {
        restoreWhenReady(currentUrl, savedPosition.x, savedPosition.y);
      }
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

function restoreWhenReady(url: string, x: number, y: number) {
  let attempts = 0;
  const maxAttempts = 60;

  const tryRestore = () => {
    attempts += 1;

    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const viewportHeight = window.innerHeight;
    const maxScrollableY = Math.max(scrollHeight - viewportHeight, 0);
    const targetY = Math.min(Math.max(y, 0), maxScrollableY);

    if (maxScrollableY >= y || attempts >= maxAttempts) {
      window.__historyScrollRestoredFor = url;
      window.scrollTo(x, targetY);
      return;
    }

    window.requestAnimationFrame(tryRestore);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(tryRestore);
  });
}
