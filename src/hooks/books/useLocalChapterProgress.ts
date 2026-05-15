'use client';

import { useEffect, useState } from 'react';

import type { Chapter } from '@/types/cms';
import {
  READING_POSITION_CHANGE_EVENT,
  readReadingProgressByChapterId,
} from '@/lib/client/books/reading-position';

/**
 * Reads browser-only progress hints for the TOC while persisted server progress
 * hydrates. These values are UX hints only; server viewer state still wins.
 */
export function useLocalChapterProgress(bookId: number, chapters: Chapter[], enabled = true) {
  const [localProgressByChapterId, setLocalProgressByChapterId] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!enabled) {
      setLocalProgressByChapterId({});
      return;
    }

    function syncLocalProgress() {
      setLocalProgressByChapterId(readReadingProgressByChapterId(bookId, chapters));
    }

    syncLocalProgress();
    window.addEventListener(READING_POSITION_CHANGE_EVENT, syncLocalProgress);

    return () => {
      window.removeEventListener(READING_POSITION_CHANGE_EVENT, syncLocalProgress);
    };
  }, [bookId, chapters, enabled]);

  return localProgressByChapterId;
}
