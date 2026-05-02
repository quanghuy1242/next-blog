import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReadingProgressOptions {
  chapterId: number;
  bookId: number;
  enabled: boolean;
  initialProgress?: number;
}

const MIN_INTERVAL = 5000;

export function useReadingProgress({
  chapterId,
  bookId,
  enabled,
  initialProgress = 0,
}: UseReadingProgressOptions) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const lastSentProgress = useRef(Math.max(0, Math.min(initialProgress, 100)));
  const throttleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clampedInitialProgress = Math.max(0, Math.min(initialProgress, 100));
    lastSentProgress.current = clampedInitialProgress;
    setCurrentProgress(0);
  }, [bookId, chapterId, initialProgress]);

  const sendProgress = useCallback((progress: number) => {
    if (progress <= lastSentProgress.current) return;
    lastSentProgress.current = progress;

    fetch('/api/reading-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, bookId, progress }),
      keepalive: true,
    }).catch(() => {});
  }, [chapterId, bookId]);

  const computeScrollPercentage = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollHeight <= clientHeight) return 100;

    return Math.min(
      Math.max(Math.round((scrollTop / (scrollHeight - clientHeight)) * 100), 0),
      100
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCurrentProgress(0);
      return;
    }

    function onScroll() {
      const progress = computeScrollPercentage();

      setCurrentProgress(progress);

      if (throttleTimeout.current) return;

      sendProgress(progress);

      throttleTimeout.current = setTimeout(() => {
        throttleTimeout.current = null;
      }, MIN_INTERVAL);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (throttleTimeout.current) {
        clearTimeout(throttleTimeout.current);
      }

      const finalProgress = computeScrollPercentage();
      setCurrentProgress(finalProgress);
      sendProgress(finalProgress);
    };
  }, [enabled, computeScrollPercentage, sendProgress]);

  return currentProgress;
}
