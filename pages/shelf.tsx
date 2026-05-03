import React from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getBookmarks } from 'common/apis/bookmarks';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';
import { Layout } from 'components/core/layout';
import { Container } from 'components/core/container';
import { buildBookHref, buildChapterHref } from 'common/utils/book-route';
import type { BookmarkRecord } from 'types/cms';

interface ShelfPageProps {
  bookBookmarks: BookmarkRecord[];
  chapterBookmarks: BookmarkRecord[];
  homepage: { header: string | null } | null;
  isAuthenticated: boolean;
}

export default function ShelfPage({
  bookBookmarks,
  chapterBookmarks,
  homepage,
  isAuthenticated,
}: ShelfPageProps) {
  if (!isAuthenticated) {
    return (
      <Layout
        header={homepage?.header}
        className="flex flex-col items-center"
        isAuthenticated={isAuthenticated}
      >
        <Container className="my-8">
          <h1 className="text-2xl font-bold text-gray-900">My Shelf</h1>
          <p className="mt-4 text-gray-600">Please sign in to view your bookmarks.</p>
        </Container>
      </Layout>
    );
  }

  const hasAny = bookBookmarks.length > 0 || chapterBookmarks.length > 0;

  return (
    <Layout
      header={homepage?.header}
      className="flex flex-col items-center"
      isAuthenticated={isAuthenticated}
    >
      <Container className="my-8">
        <h1 className="text-2xl font-bold text-gray-900">My Shelf</h1>
        {!hasAny ? (
          <p className="mt-4 text-gray-600">No bookmarks yet.</p>
        ) : (
          <div className="mt-6 space-y-8">
            {bookBookmarks.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">Books</h2>
                <ul className="space-y-2">
                  {bookBookmarks.map((bm) => {
                    const book = bm.book;
                    if (!book) return null;
                    return (
                      <li key={bm.id}>
                        <Link
                          href={buildBookHref(book.id, book.slug)}
                          className="text-blue hover:underline"
                        >
                          {book.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {chapterBookmarks.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">Chapters</h2>
                <ul className="space-y-2">
                  {chapterBookmarks.map((bm) => {
                    const chapter = bm.chapter;
                    if (!chapter) return null;
                    const book = chapter.book;
                    return (
                      <li key={bm.id}>
                        {book ? (
                          <Link
                            href={buildChapterHref(book.id, book.slug, chapter.slug)}
                            className="text-blue hover:underline"
                          >
                            {chapter.title}{' '}
                            <span className="text-gray-500">in {book.title}</span>
                          </Link>
                        ) : (
                          <span>{chapter.title}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<ShelfPageProps> = async ({ req }) => {
  const sessionToken = getBetterAuthTokenFromRequest(req);

  if (!sessionToken) {
    return {
      props: {
        bookBookmarks: [],
        chapterBookmarks: [],
        homepage: null,
        isAuthenticated: false,
      },
    };
  }

  try {
    const result = await getBookmarks({
      authToken: sessionToken,
      limit: 100,
    });

    const bookBookmarks = result.docs.filter((bm) => bm.contentType === 'book');
    const chapterBookmarks = result.docs.filter((bm) => bm.contentType === 'chapter');

    return {
      props: {
        bookBookmarks,
        chapterBookmarks,
        homepage: null,
        isAuthenticated: true,
      },
    };
  } catch {
    return {
      props: {
        bookBookmarks: [],
        chapterBookmarks: [],
        homepage: null,
        isAuthenticated: true,
      },
    };
  }
};
