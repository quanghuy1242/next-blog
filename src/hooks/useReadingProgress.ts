import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    __historyScrollRestoredFor?: string;
  }
}

interface UseReadingProgressOptions {
  chapterId: number;
  bookId: number;
  enabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
  initialProgress?: number;
}

const MIN_INTERVAL = 5000;
const COMPLETION_THRESHOLD = 95;

interface StoredReadingPosition {
  progress: number;
  scrollY: number;
}

export function useReadingProgress({
  chapterId,
  bookId,
  enabled,
  targetRef,
  initialProgress = 0,
}: UseReadingProgressOptions) {
  const clampedInitialProgress = Math.max(0, Math.min(initialProgress, 100));
  const [currentProgress, setCurrentProgress] = useState(clampedInitialProgress);
  const lastSentProgress = useRef(clampedInitialProgress);
  const lastSentAt = useRef(0);
  const hasTrackedScroll = useRef(false);
  const hasRestoredPosition = useRef(false);
  const isRestoringPosition = useRef(false);

  const storageKey = `reading-position:${bookId}:${chapterId}`;

  useEffect(() => {
    lastSentProgress.current = clampedInitialProgress;
    lastSentAt.current = 0;
    hasTrackedScroll.current = false;
    hasRestoredPosition.current = false;
    isRestoringPosition.current = false;
    setCurrentProgress(clampedInitialProgress);
  }, [bookId, chapterId, clampedInitialProgress]);

  const readStoredPosition = useCallback((): StoredReadingPosition | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as Partial<StoredReadingPosition>;
      const progress =
        typeof parsedValue.progress === 'number' ? parsedValue.progress : NaN;
      const scrollY =
        typeof parsedValue.scrollY === 'number' ? parsedValue.scrollY : NaN;

      if (!Number.isFinite(progress) || !Number.isFinite(scrollY)) {
        return null;
      }

      return {
        progress: Math.min(Math.max(progress, 0), 100),
        scrollY: Math.max(scrollY, 0),
      };
    } catch {
      return null;
    }
  }, [storageKey]);

  const persistReadingPosition = useCallback((progress: number) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          progress: Math.min(Math.max(progress, 0), 100),
          scrollY: Math.max(window.scrollY, 0),
        } satisfies StoredReadingPosition)
      );
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  const sendProgress = useCallback((progress: number, force = false) => {
    if (progress <= lastSentProgress.current) return;

    if (!force && Date.now() - lastSentAt.current < MIN_INTERVAL) {
      return;
    }

    lastSentProgress.current = progress;
    lastSentAt.current = Date.now();

    fetch('/api/reading-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, bookId, progress }),
      keepalive: true,
    }).catch(() => {});
  }, [chapterId, bookId]);

  const computeScrollPercentage = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const target = targetRef.current;
    if (!target) return 0;

    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = target.getBoundingClientRect();
    const elementTop = rect.top + window.scrollY;
    const elementBottom = rect.bottom + window.scrollY;
    const elementHeight = Math.max(target.scrollHeight, rect.height);
    const viewportBottom = window.scrollY + viewportHeight;

    if (viewportHeight <= 0 || elementHeight <= 0) return 0;

    if (viewportBottom <= elementTop) {
      return 0;
    }

    if (viewportBottom >= elementBottom) {
      return 100;
    }

    const seenHeight = Math.min(
      Math.max(viewportBottom - elementTop, 0),
      elementHeight
    );

    const progress = (seenHeight / elementHeight) * 100;

    return Math.min(Math.max(Math.round(progress), 0), 100);
  }, [targetRef]);

  const computeScrollTargetForProgress = useCallback((progress: number): number | null => {
    if (typeof window === 'undefined') return null;
    const target = targetRef.current;
    if (!target) return null;

    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = target.getBoundingClientRect();
    const elementTop = rect.top + window.scrollY;
    const elementHeight = Math.max(target.scrollHeight, rect.height);
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );

    if (viewportHeight <= 0 || elementHeight <= 0 || documentHeight <= 0) {
      return null;
    }

    if (progress >= COMPLETION_THRESHOLD) {
      return Math.max(documentHeight - viewportHeight, 0);
    }

    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    const desiredViewportBottom =
      elementTop + (elementHeight * clampedProgress) / 100;
    const desiredScrollY = desiredViewportBottom - viewportHeight;
    const maxScrollY = Math.max(documentHeight - viewportHeight, 0);

    return Math.min(Math.max(desiredScrollY, 0), maxScrollY);
  }, [targetRef]);

  useEffect(() => {
    if (!enabled) {
      setCurrentProgress(0);
      return;
    }

    function updateCurrentProgress() {
      const progress = computeScrollPercentage();
      setCurrentProgress(progress);
      return progress;
    }

    function onScroll() {
      const progress = updateCurrentProgress();
      persistReadingPosition(progress);

      if (isRestoringPosition.current) {
        return;
      }

      hasTrackedScroll.current = true;
      sendProgress(progress);
    }

    function onResize() {
      updateCurrentProgress();
    }

    function flushProgress() {
      const finalProgress = computeScrollPercentage();
      persistReadingPosition(finalProgress);

      if (!hasTrackedScroll.current) return;
      setCurrentProgress(finalProgress);
      sendProgress(finalProgress, true);
    }

    function restoreReadingPosition() {
      if (hasRestoredPosition.current) {
        updateCurrentProgress();
        return;
      }

      const currentUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : '';

      if (
        currentUrl &&
        window.__historyScrollRestoredFor === currentUrl
      ) {
        hasRestoredPosition.current = true;
        window.__historyScrollRestoredFor = undefined;
        updateCurrentProgress();
        return;
      }

      const target = targetRef.current;
      if (!target || target.getBoundingClientRect().height <= 0) {
        window.requestAnimationFrame(restoreReadingPosition);
        return;
      }

      hasRestoredPosition.current = true;

      const storedPosition = readStoredPosition();
      const targetScrollY =
        storedPosition?.scrollY ??
        (clampedInitialProgress > 0
          ? computeScrollTargetForProgress(clampedInitialProgress)
          : null);

      if (targetScrollY == null) {
        updateCurrentProgress();
        return;
      }

      isRestoringPosition.current = true;
      window.scrollTo(window.scrollX, targetScrollY);
      window.requestAnimationFrame(() => {
        isRestoringPosition.current = false;
        const restoredProgress = updateCurrentProgress();
        persistReadingPosition(restoredProgress);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', flushProgress);
    restoreReadingPosition();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', flushProgress);
      flushProgress();
    };
  }, [
    clampedInitialProgress,
    computeScrollPercentage,
    computeScrollTargetForProgress,
    enabled,
    persistReadingPosition,
    readStoredPosition,
    sendProgress,
    targetRef,
  ]);

  return currentProgress;
}
