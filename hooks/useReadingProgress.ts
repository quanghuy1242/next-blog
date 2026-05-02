import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReadingProgressOptions {
  chapterId: number;
  bookId: number;
  enabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
  initialProgress?: number;
}

const MIN_INTERVAL = 5000;

export function useReadingProgress({
  chapterId,
  bookId,
  enabled,
  targetRef,
  initialProgress = 0,
}: UseReadingProgressOptions) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const lastSentProgress = useRef(Math.max(0, Math.min(initialProgress, 100)));
  const lastSentAt = useRef(0);
  const hasTrackedScroll = useRef(false);

  useEffect(() => {
    const clampedInitialProgress = Math.max(0, Math.min(initialProgress, 100));
    lastSentProgress.current = clampedInitialProgress;
    lastSentAt.current = 0;
    hasTrackedScroll.current = false;
    setCurrentProgress(0);
  }, [bookId, chapterId, initialProgress]);

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
      hasTrackedScroll.current = true;
      const progress = updateCurrentProgress();
      sendProgress(progress);
    }

    function onResize() {
      updateCurrentProgress();
    }

    function flushProgress() {
      if (!hasTrackedScroll.current) return;
      const finalProgress = computeScrollPercentage();
      setCurrentProgress(finalProgress);
      sendProgress(finalProgress, true);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', flushProgress);
    updateCurrentProgress();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', flushProgress);
      flushProgress();
    };
  }, [enabled, computeScrollPercentage, sendProgress]);

  return currentProgress;
}
