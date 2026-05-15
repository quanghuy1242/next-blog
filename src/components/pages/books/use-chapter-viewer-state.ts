'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Book, BookmarkRecord, Chapter, ReadingProgressRecord } from '@/types/cms';
import {
  readCachedBookDetailViewerState,
  readCachedChapterBookmark,
  writeCachedBookDetailViewerState,
  writeCachedChapterBookmark,
} from '@/lib/browser/book-viewer-state-cache';
import { getContinueReadingChapterSlug } from '@/lib/reading/continue-reading';
import { calculateWholeBookProgress } from '@/lib/reading/reading-progress';
import { progressByChapterIdFromRecords } from './chapter-reader-progress';

interface UseChapterViewerStateOptions {
  book: Book;
  chapter: Chapter;
  chapters: Chapter[];
  isAuthenticated: boolean;
  initialBookmark?: BookmarkRecord | null;
  initialReadingProgress: ReadingProgressRecord[];
}

interface ChapterViewerStateResponse {
  bookmark?: BookmarkRecord | null;
  readingProgress?: ReadingProgressRecord[];
}

/**
 * Owns the live reader state boundary.
 *
 * The server sends cacheable chapter content first. This hook replays the local
 * viewer-state snapshot before paint, then refreshes `/api/chapters/viewer-state`
 * for cross-device bookmark/progress correctness.
 */
export function useChapterViewerState({
  book,
  chapter,
  chapters,
  isAuthenticated,
  initialBookmark,
  initialReadingProgress,
}: UseChapterViewerStateOptions) {
  const [viewerBookmark, setViewerBookmark] = useState<BookmarkRecord | null>(initialBookmark ?? null);
  const [viewerReadingProgress, setViewerReadingProgress] =
    useState<ReadingProgressRecord[]>(initialReadingProgress);
  const [viewerStateLoaded, setViewerStateLoaded] = useState(!isAuthenticated || initialBookmark !== undefined);
  const viewerBookmarkRef = useRef<BookmarkRecord | null>(viewerBookmark);
  const viewerReadingProgressRef = useRef<ReadingProgressRecord[]>(viewerReadingProgress);

  // Preserve compatibility with callers that still pass initial viewer state.
  useEffect(() => {
    if (isAuthenticated && initialBookmark === undefined && initialReadingProgress.length === 0) {
      return;
    }

    const nextBookmark = initialBookmark ?? null;
    viewerBookmarkRef.current = nextBookmark;
    viewerReadingProgressRef.current = initialReadingProgress;
    setViewerBookmark(nextBookmark);
    setViewerReadingProgress(initialReadingProgress);
    setViewerStateLoaded(!isAuthenticated || initialBookmark !== undefined);
  }, [initialBookmark, initialReadingProgress, isAuthenticated]);

  useEffect(() => {
    viewerBookmarkRef.current = viewerBookmark;
  }, [viewerBookmark]);

  useEffect(() => {
    viewerReadingProgressRef.current = viewerReadingProgress;
  }, [viewerReadingProgress]);

  useLayoutEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const cachedBookState = readCachedBookDetailViewerState(book.id);
    const cachedChapterBookmark = readCachedChapterBookmark(chapter.id);

    if (cachedBookState) {
      viewerReadingProgressRef.current = cachedBookState.readingProgress;
      setViewerReadingProgress(cachedBookState.readingProgress);
      setViewerStateLoaded(true);
    }

    if (cachedChapterBookmark !== undefined) {
      viewerBookmarkRef.current = cachedChapterBookmark;
      setViewerBookmark(cachedChapterBookmark);
      setViewerStateLoaded(true);
    }
  }, [book.id, chapter.id, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const controller = new AbortController();

    setViewerStateLoaded(
      viewerBookmarkRef.current != null || viewerReadingProgressRef.current.length > 0
    );

    async function loadViewerState() {
      try {
        const params = new URLSearchParams({
          bookId: String(book.id),
          chapterId: String(chapter.id),
        });
        const response = await fetch(`/api/chapters/viewer-state?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as ChapterViewerStateResponse;
        const nextBookmark = payload.bookmark ?? null;
        const nextReadingProgress = payload.readingProgress ?? [];

        viewerBookmarkRef.current = nextBookmark;
        viewerReadingProgressRef.current = nextReadingProgress;
        setViewerBookmark(nextBookmark);
        setViewerReadingProgress(nextReadingProgress);
        writeCachedChapterBookmark(chapter.id, nextBookmark);
        writeCachedBookDetailViewerState({
          bookId: book.id,
          bookmark: readCachedBookDetailViewerState(book.id)?.bookmark ?? null,
          readingProgress: nextReadingProgress,
          readingProgressByChapterId: progressByChapterIdFromRecords(nextReadingProgress),
          continueReadingChapterSlug: getContinueReadingChapterSlug(
            chapters,
            nextReadingProgress
          ),
          wholeBookProgress: calculateWholeBookProgress({
            chapters,
            records: nextReadingProgress,
            totalWordCount: book.totalWordCount,
          }),
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load chapter viewer state', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setViewerStateLoaded(true);
        }
      }
    }

    void loadViewerState();

    return () => {
      controller.abort();
    };
  }, [book.id, book.totalWordCount, chapter.id, chapters, isAuthenticated]);

  const readingProgressByChapterId = useMemo(
    () => progressByChapterIdFromRecords(viewerReadingProgress),
    [viewerReadingProgress]
  );

  return {
    viewerBookmark,
    viewerStateLoaded,
    readingProgressByChapterId,
  };
}
