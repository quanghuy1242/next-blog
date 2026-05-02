import React from 'react';
import { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { getBookmarks } from 'common/apis/bookmarks';
import { getDataForBooksPage } from 'common/apis/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from 'common/apis/cache';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { BooksGrid } from 'components/shared/books-grid';
import { Text } from 'components/shared/text';
import { generateMetaTags } from 'common/utils/meta-tags';
import { useBooksFeed } from 'hooks/useBooksFeed';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import type { Book, Homepage } from 'types/cms';

const BOOKS_PAGE_SIZE = 6;

interface BooksPageProps {
  initialBooks: Book[];
  initialHasMore: boolean;
  homepage: Pick<Homepage, 'header'> | null;
  initialBookmarkedBookIds: number[];
  isAuthenticated: boolean;
}

export default function BooksPage({
  initialBooks,
  initialHasMore,
  homepage,
  initialBookmarkedBookIds,
  isAuthenticated,
}: BooksPageProps) {
  const metaTags = generateMetaTags({
    title: 'Books',
    description: 'Browse the bookshelf and continue reading chapter by chapter.',
  });

  const { booksState, isFetching, error, loadMoreBooks, retryLoadMore, refreshBooks } =
    useBooksFeed({
      initialBooks,
      initialHasMore,
      pageSize: BOOKS_PAGE_SIZE,
    });

  const { ref: loaderRef, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({
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
    <Layout header={homepage?.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(metaTags)}</Head>
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <Text text="Books" />
          <BooksGrid
            books={booksState.books}
            bookmarkedBookIds={initialBookmarkedBookIds}
            isAuthenticated={isAuthenticated}
          />

          {!isFetching && !error && booksState.books.length === 0 && (
            <p className="mt-6 text-center text-sm text-gray-500">No books found.</p>
          )}

          <div ref={loaderRef} className="h-1 w-full" aria-hidden />

          {isFetching && (
            <div className="my-6 flex justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
          )}

          {error && (
            <div className="mt-4 flex flex-col items-center text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  void retryLoadMore();
                }}
                className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:text-gray-900"
              >
                Try again
              </button>
            </div>
          )}

          {!booksState.hasMore && !isFetching && booksState.books.length > 0 && (
            <p className="my-6 text-center text-sm text-gray-500">
              You&apos;ve reached the end.
            </p>
          )}
        </div>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<BooksPageProps> = async ({ req }) => {
  const sessionToken = getBetterAuthTokenFromRequest(req);
  const payloadCache = sessionToken ? AUTH_PAYLOAD_CACHE : ONE_HOUR_PAYLOAD_CACHE;
  const data = await getDataForBooksPage(BOOKS_PAGE_SIZE, {
    authToken: sessionToken,
    cache: payloadCache,
  });
  const bookmarks = sessionToken
    ? await getBookmarks({
        authToken: sessionToken,
        limit: 100,
      }).catch(() => ({ docs: [], totalDocs: 0 }))
    : { docs: [], totalDocs: 0 };
  const initialBookmarkedBookIds = bookmarks.docs
    .filter((bookmark) => bookmark.contentType === 'book' && bookmark.book != null)
    .map((bookmark) => bookmark.book!.id);

  return {
    props: {
      initialBooks: data.books,
      initialHasMore: data.hasMore,
      homepage: data.homepage,
      initialBookmarkedBookIds,
      isAuthenticated: !!sessionToken,
    },
  };
};
