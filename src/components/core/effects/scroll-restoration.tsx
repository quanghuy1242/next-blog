'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    __historyScrollRestoredFor?: string;
  }
}

const STORAGE_KEY_PREFIX = 'scroll-pos:';

interface ScrollPosition {
  x: number;
  y: number;
}

export function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = buildUrl(pathname, searchParams);
  const [restoreTargetUrl, setRestoreTargetUrl] = useState<string | null>(null);
  const currentUrlRef = useRef(currentUrl);
  const suspendedSaveUrlRef = useRef<string | null>(null);
  const saveFrameRef = useRef<number | null>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const previousUrl = currentUrlRef.current;
    currentUrlRef.current = currentUrl;

    if (
      suspendedSaveUrlRef.current &&
      suspendedSaveUrlRef.current !== currentUrl
    ) {
      suspendedSaveUrlRef.current = null;
    }

    if (previousUrl !== currentUrl) {
      window.__historyScrollRestoredFor = undefined;
    }

    if (restoreTargetUrl === currentUrl) {
      setRestoreTargetUrl(null);
      restoreSavedPosition(currentUrl, cancelRestoreRef);
    }
  }, [currentUrl, restoreTargetUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const previousScrollRestoration =
      'scrollRestoration' in window.history
        ? window.history.scrollRestoration
        : null;

    const saveCurrentPosition = (force = false) => {
      if (
        !force &&
        suspendedSaveUrlRef.current === currentUrlRef.current
      ) {
        return;
      }

      savePosition(currentUrlRef.current);
    };

    const flushCurrentPosition = () => {
      saveCurrentPosition(true);
    };

    const scheduleSaveCurrentPosition = () => {
      if (saveFrameRef.current !== null) {
        return;
      }

      saveFrameRef.current = window.requestAnimationFrame(() => {
        saveFrameRef.current = null;
        saveCurrentPosition();
      });
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

      const anchor = findAnchor(event.target);
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
      if (nextRoute === currentUrlRef.current) {
        return;
      }

      const currentRoute = currentUrlRef.current;
      savePosition(currentRoute);
      suspendedSaveUrlRef.current = currentRoute;
    };

    const handlePopState = () => {
      const restoreUrl = getWindowUrl();
      const leavingRoute = currentUrlRef.current;

      if (leavingRoute !== restoreUrl) {
        savePosition(leavingRoute);
        suspendedSaveUrlRef.current = leavingRoute;
      }

      setRestoreTargetUrl(restoreUrl);
    };

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.addEventListener('scroll', scheduleSaveCurrentPosition, {
      passive: true,
    });
    window.addEventListener('pagehide', flushCurrentPosition);
    document.addEventListener('visibilitychange', flushCurrentPosition);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      flushCurrentPosition();

      if (saveFrameRef.current !== null) {
        window.cancelAnimationFrame(saveFrameRef.current);
        saveFrameRef.current = null;
      }

      cancelRestoreRef.current?.();
      cancelRestoreRef.current = null;

      if (
        previousScrollRestoration &&
        'scrollRestoration' in window.history
      ) {
        window.history.scrollRestoration = previousScrollRestoration;
      }

      window.removeEventListener('scroll', scheduleSaveCurrentPosition);
      window.removeEventListener('pagehide', flushCurrentPosition);
      document.removeEventListener('visibilitychange', flushCurrentPosition);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

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

function getWindowUrl() {
  return `${window.location.pathname}${window.location.search}`;
}

function savePosition(url: string) {
  try {
    window.sessionStorage.setItem(
      getStorageKey(url),
      JSON.stringify({
        x: window.scrollX,
        y: window.scrollY,
      } satisfies ScrollPosition)
    );
  } catch {
    // Best effort only.
  }
}

function restorePosition(url: string): ScrollPosition | null {
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
}

function restoreSavedPosition(
  url: string,
  cancelRestoreRef: { current: (() => void) | null }
) {
  const savedPosition = restorePosition(url);

  if (!savedPosition) {
    return;
  }

  window.__historyScrollRestoredFor = url;
  cancelRestoreRef.current?.();
  cancelRestoreRef.current = restoreWhenReady(
    url,
    savedPosition.x,
    savedPosition.y
  );
}

function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Node)) {
    return null;
  }

  const element = target instanceof Element ? target : target.parentElement;

  return element?.closest<HTMLAnchorElement>('a[href]') ?? null;
}

function restoreWhenReady(url: string, x: number, y: number) {
  let attempts = 0;
  let restoreFrames = 0;
  let frameId: number | null = null;
  let cancelled = false;
  const maxAttempts = 600;
  const minRestoreFrames = 2;

  const cancel = () => {
    cancelled = true;

    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }

    removeUserCancelListeners(cancel);
  };

  addUserCancelListeners(cancel);

  const scrollToTarget = () => {
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const viewportHeight = window.innerHeight;
    const maxScrollableY = Math.max(scrollHeight - viewportHeight, 0);
    const targetY = Math.min(Math.max(y, 0), maxScrollableY);

    window.__historyScrollRestoredFor = url;
    window.scrollTo(x, targetY);
  };

  const hasEnoughHeight = () => {
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const viewportHeight = window.innerHeight;
    const maxScrollableY = Math.max(scrollHeight - viewportHeight, 0);
    return maxScrollableY >= y;
  };

  // Fast path: restore synchronously before paint (runs in useLayoutEffect).
  if (hasEnoughHeight()) {
    scrollToTarget();
    frameId = window.requestAnimationFrame(() => {
      scrollToTarget();
      frameId = window.requestAnimationFrame(() => {
        scrollToTarget();
        cancel();
      });
    });
    return cancel;
  }

  // Slow path: poll until lazy content loads and the page is tall enough.
  const tryRestore = () => {
    if (cancelled) {
      return;
    }

    attempts += 1;

    if (hasEnoughHeight() || attempts >= maxAttempts) {
      restoreFrames += 1;
      scrollToTarget();

      if (restoreFrames >= minRestoreFrames || attempts >= maxAttempts) {
        cancel();
        return;
      }
    }

    frameId = window.requestAnimationFrame(tryRestore);
  };

  frameId = window.requestAnimationFrame(tryRestore);

  return cancel;
}

function addUserCancelListeners(cancel: () => void) {
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', cancel);
}

function removeUserCancelListeners(cancel: () => void) {
  window.removeEventListener('wheel', cancel);
  window.removeEventListener('touchstart', cancel);
  window.removeEventListener('keydown', cancel);
}
