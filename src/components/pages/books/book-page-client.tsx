'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type {
  Book,
  BookmarkRecord,
  Chapter,
  ReadingProgressRecord,
} from '@/types/cms';
import {
  READING_POSITION_CHANGE_EVENT,
  readReadingProgressByChapterId,
} from '@/lib/browser/reading-position';
import {
  readCachedBookDetailViewerState,
  writeCachedBookDetailViewerState,
} from '@/lib/browser/book-viewer-state-cache';
import { getContinueReadingChapterSlug } from '@/lib/reading/continue-reading';
import { calculateWholeBookProgress } from '@/lib/reading/reading-progress';
import { buildBookHref } from '@/lib/routes/book-route';
import { BookHeader } from '@/components/pages/books/book-header';
import { ChapterList } from '@/components/pages/books/chapter-list';
import { BookmarkButton } from '@/components/shared/bookmark-button';
import { Text } from '@/components/shared/text';
import { ButtonLink } from '@/components/shared/ui/button';

interface BookPageClientProps {
  book: Book;
  chapters: Chapter[];
  isAuthenticated: boolean;
}

interface BookDetailViewerState {
  bookmark: BookmarkRecord | null;
  readingProgress: ReadingProgressRecord[];
  readingProgressByChapterId?: Record<number, number>;
  continueReadingChapterSlug: string | null;
  wholeBookProgress: number;
}

interface BooksViewerStateResponse {
  detail?: BookDetailViewerState | null;
}

/**
 * Hydrates live book viewer state after the server has already rendered content.
 *
 * This is intentionally client-owned: the server route returns the book/chapter shell
 * fast, this component uses the last local snapshot to avoid flicker, then refreshes
 * from `/api/books/viewer-state` for cross-device correctness.
 */
export function BookPageClient({
  book,
  chapters,
  isAuthenticated,
}: BookPageClientProps) {
  const [viewerState, setViewerState] = useState<BookDetailViewerState | null>(null);
  const [viewerStateLoaded, setViewerStateLoaded] = useState(!isAuthenticated);
  const [localProgressByChapterId, setLocalProgressByChapterId] = useState<Record<number, number>>({});
  const viewerStateRef = useRef<BookDetailViewerState | null>(null);

  useEffect(() => {
    viewerStateRef.current = viewerState;
  }, [viewerState]);

  useLayoutEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const cachedViewerState = readCachedBookDetailViewerState(book.id);

    if (cachedViewerState) {
      viewerStateRef.current = cachedViewerState;
      setViewerState(cachedViewerState);
      setViewerStateLoaded(true);
      return;
    }

    viewerStateRef.current = null;
    setViewerState(null);
    setViewerStateLoaded(false);
  }, [book.id, isAuthenticated]);

  // Local reading positions are instant hints; server progress still wins when it arrives.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    function syncLocalProgress() {
      setLocalProgressByChapterId(readReadingProgressByChapterId(book.id, chapters));
    }

    syncLocalProgress();
    window.addEventListener(READING_POSITION_CHANGE_EVENT, syncLocalProgress);

    return () => {
      window.removeEventListener(READING_POSITION_CHANGE_EVENT, syncLocalProgress);
    };
  }, [book.id, chapters, isAuthenticated]);

  // Always refresh in the background. The local snapshot is a UX cache, not authority.
  useEffect(() => {
    if (!isAuthenticated) {
      setViewerState(null);
      setViewerStateLoaded(true);
      return;
    }

    const controller = new AbortController();

    setViewerStateLoaded(viewerStateRef.current != null);

    async function loadViewerState() {
      try {
        const params = new URLSearchParams({
          bookIds: String(book.id),
          detail: '1',
        });
        const response = await fetch(`/api/books/viewer-state?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as BooksViewerStateResponse;
        const detail = payload.detail ?? null;

        viewerStateRef.current = detail;
        setViewerState(detail);

        if (detail) {
          writeCachedBookDetailViewerState({
            ...detail,
            bookId: book.id,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load book viewer state', error);
          setViewerState(null);
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
  }, [book.id, isAuthenticated]);

  const readingProgressByChapterId = useMemo(
    () => mergeProgressMaps(viewerState?.readingProgressByChapterId, localProgressByChapterId),
    [localProgressByChapterId, viewerState?.readingProgressByChapterId]
  );
  const readingProgressForDisplay = useMemo(
    () => recordsFromProgressMap(readingProgressByChapterId),
    [readingProgressByChapterId]
  );
  const wholeBookProgress = viewerState?.wholeBookProgress
    ?? calculateWholeBookProgress({
      chapters,
      records: readingProgressForDisplay,
      totalWordCount: book.totalWordCount,
    });
  const continueReadingChapterSlug = viewerState?.continueReadingChapterSlug
    ?? getContinueReadingChapterSlug(chapters, readingProgressForDisplay);
  const shouldShowProgress = isAuthenticated && (viewerStateLoaded || wholeBookProgress > 0);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <BookHeader book={book} />
        </div>
        <BookmarkButton
          contentType="book"
          contentId={book.id}
          isAuthenticated={isAuthenticated}
          initialBookmark={viewerState?.bookmark ?? null}
          initialStateLoaded={viewerStateLoaded}
        />
      </div>
      {shouldShowProgress || continueReadingChapterSlug ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {shouldShowProgress ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium tabular-nums text-gray-700">
              Progress: {wholeBookProgress}%
            </span>
          ) : null}
          {continueReadingChapterSlug ? (
            <ButtonLink
              href={`${buildBookHref(book.id, book.slug)}/chapters/${continueReadingChapterSlug}`}
              size="lg"
              prefetch={false}
            >
              Continue reading
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      <Text text="Chapters" />
      <ChapterList
        chapters={chapters}
        bookId={book.id}
        bookSlug={book.slug}
        readingProgressByChapterId={
          Object.keys(readingProgressByChapterId).length > 0
            ? readingProgressByChapterId
            : undefined
        }
      />
    </>
  );
}

function mergeProgressMaps(
  serverProgressByChapterId?: Record<number, number>,
  localProgressByChapterId: Record<number, number> = {}
) {
  const merged: Record<number, number> = {
    ...(serverProgressByChapterId ?? {}),
  };

  for (const [chapterId, localProgress] of Object.entries(localProgressByChapterId)) {
    const numericChapterId = Number(chapterId);
    const serverProgress = merged[numericChapterId] ?? 0;
    merged[numericChapterId] = Math.max(serverProgress, localProgress);
  }

  return merged;
}

function recordsFromProgressMap(
  progressByChapterId: Record<number, number>
): ReadingProgressRecord[] {
  return Object.entries(progressByChapterId).map(([chapterId, progress]) => ({
    chapterId,
    progress,
    completedAt: progress >= 95 ? '' : null,
    updatedAt: '',
  }));
}
