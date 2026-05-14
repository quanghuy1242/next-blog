'use client';

import { useEffect } from 'react';

import type { Book } from '@/types/cms';
import { useBooksFeed } from '@/hooks/useBooksFeed';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { Container } from '@/components/core/container';
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

export function BooksPageClient({
  initialBooks,
  initialHasMore,
  isAuthenticated,
}: BooksPageClientProps) {
  const { booksState, isFetching, error, loadMoreBooks, retryLoadMore, refreshBooks } =
    useBooksFeed({
      initialBooks,
      initialHasMore,
      pageSize: BOOKS_PAGE_SIZE,
    });
  const { ref: loaderRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: '200px 0px',
    enabled: booksState.hasMore,
  });

  useEffect(() => {
    if (isIntersecting && booksState.hasMore) {
      void loadMoreBooks();
    }
  }, [booksState.hasMore, isIntersecting, loadMoreBooks]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void refreshBooks();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshBooks();
      }
    }

    function handleWindowFocus() {
      void refreshBooks();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isAuthenticated, refreshBooks]);

  return (
    <Container className="my-4 w-full md:px-20">
      <div className="mx-auto w-full md:w-2/3">
        <Text text="Books" />
        <BooksGrid
          books={booksState.books}
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
