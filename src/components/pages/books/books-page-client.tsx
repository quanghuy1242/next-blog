'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Book } from '@/types/cms';
import type { BookCardViewerState } from '@/types/book-viewer-state';
import { useBooksFeed } from '@/hooks/books/useBooksFeed';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { Container } from '@/components/core/container';
import {
  readCachedBookCardViewerStates,
  writeCachedBookCardViewerStates,
} from '@/lib/client/books/viewer-state-cache';
import { BooksGrid } from '@/components/shared/books-grid';
import { Text } from '@/components/shared/text';
import { Button } from '@/components/shared/ui/button';
import { LoadingSpinner } from '@/components/shared/ui/loading-spinner';

interface BooksPageClientProps {
  initialBooks: Book[];
  initialHasMore: boolean;
  isAuthenticated: boolean;
}

const BOOKS_PAGE_SIZE = 6;
const VIEWER_STATE_REFRESH_INTERVAL_MS = 30 * 1000;

interface BooksViewerStateResponse {
  books?: BookCardViewerState[];
}

/**
 * Book cards render from base server data first, then hydrate bookmark/progress badges.
 *
 * Keep this separate from `/api/books`: list pagination should stay content-focused,
 * while `/api/books/viewer-state` supplies mutable per-user state after render.
 */
export function BooksPageClient({
  initialBooks,
  initialHasMore,
  isAuthenticated,
}: BooksPageClientProps) {
  const { booksState, isFetching, error, loadMoreBooks, retryLoadMore } =
    useBooksFeed({
      initialBooks,
      initialHasMore,
      pageSize: BOOKS_PAGE_SIZE,
    });
  const [viewerStateByBookId, setViewerStateByBookId] = useState<Record<number, BookCardViewerState>>({});
  const lastViewerStateRefreshAt = useRef(0);
  const { ref: loaderRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: '200px 0px',
    enabled: booksState.hasMore,
  });
  const visibleBookIds = useMemo(
    () => booksState.books.map((book) => book.id).filter((bookId) => Number.isInteger(bookId) && bookId > 0),
    [booksState.books]
  );
  const visibleBookIdsKey = visibleBookIds.join(',');
  const booksForDisplay = useMemo(
    () =>
      booksState.books.map((book) => {
        const viewerState = viewerStateByBookId[book.id];

        if (!viewerState) {
          return book;
        }

        return {
          ...book,
          isBookmarked: viewerState.isBookmarked,
          readingProgressPct: viewerState.readingProgressPct,
        };
      }),
    [booksState.books, viewerStateByBookId]
  );

  // Replay the last known state before paint so repeat visits do not flash empty badges.
  useLayoutEffect(() => {
    if (!isAuthenticated || visibleBookIds.length === 0) {
      return;
    }

    const cachedViewerStateByBookId = readCachedBookCardViewerStates(visibleBookIds);

    if (Object.keys(cachedViewerStateByBookId).length > 0) {
      setViewerStateByBookId((previous) => ({
        ...previous,
        ...cachedViewerStateByBookId,
      }));
    }
  }, [isAuthenticated, visibleBookIdsKey, visibleBookIds]);

  // Refresh badges in the background; the local snapshot only smooths perceived latency.
  const refreshViewerState = useCallback(async (force = false) => {
    if (!isAuthenticated || visibleBookIds.length === 0) {
      return;
    }

    const now = Date.now();

    if (!force && now - lastViewerStateRefreshAt.current < VIEWER_STATE_REFRESH_INTERVAL_MS) {
      return;
    }

    lastViewerStateRefreshAt.current = now;

    try {
      const params = new URLSearchParams({ bookIds: visibleBookIds.join(',') });
      const response = await fetch(`/api/books/viewer-state?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as BooksViewerStateResponse;
      writeCachedBookCardViewerStates(payload.books ?? []);
      const nextViewerStateByBookId = Object.fromEntries(
        (payload.books ?? []).map((viewerState) => [viewerState.bookId, viewerState])
      );

      setViewerStateByBookId((previous) => ({
        ...previous,
        ...nextViewerStateByBookId,
      }));
    } catch (viewerStateError) {
      console.error('Failed to refresh books viewer state', viewerStateError);
    }
  }, [isAuthenticated, visibleBookIds]);

  useEffect(() => {
    if (isIntersecting && booksState.hasMore) {
      void loadMoreBooks();
    }
  }, [booksState.hasMore, isIntersecting, loadMoreBooks]);

  useEffect(() => {
    void refreshViewerState(true);
  }, [refreshViewerState, visibleBookIdsKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshViewerState();
      }
    }

    function handleWindowFocus() {
      void refreshViewerState();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isAuthenticated, refreshViewerState]);

  return (
    <Container className="my-4 w-full md:px-20">
      <div className="mx-auto w-full md:w-2/3">
        <Text text="Books" />
        <BooksGrid
          books={booksForDisplay}
          isAuthenticated={isAuthenticated}
        />

        {!isFetching && !error && booksState.books.length === 0 ? (
          <p className="mt-6 text-center text-sm text-gray-500">No books found.</p>
        ) : null}

        <div ref={loaderRef} className="h-1 w-full" aria-hidden />

        {isFetching ? (
          <div className="my-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 flex flex-col items-center text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              type="button"
              onClick={() => {
                void retryLoadMore();
              }}
              variant="secondary"
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {!booksState.hasMore && !isFetching && booksState.books.length > 0 ? (
          <p className="my-6 text-center text-sm text-gray-500">
            You&apos;ve reached the end.
          </p>
        ) : null}
      </div>
    </Container>
  );
}
