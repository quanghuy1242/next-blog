import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { TextLink } from '@/components/shared/ui/text-link';
import { getBookmarks } from '@/lib/payload/bookmarks';
import { buildBookHref, buildChapterHref } from '@/lib/routes/book-route';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';
import { buildMetadata } from '@/lib/utils/next-metadata';
import type { BookmarkRecord } from '@/types/cms';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return buildMetadata({
    title: 'Bookshelf',
    description: 'View your saved books and chapter bookmarks.',
  });
}

export default async function BooksShelfPage() {
  const sessionToken = await getAuthTokenFromAppRequest();

  if (!sessionToken) {
    return (
      <Layout className="flex flex-col items-center" isAuthenticated={false}>
        <Container className="my-8">
          <h1 className="text-2xl font-bold text-gray-900">Bookshelf</h1>
          <p className="mt-4 text-gray-600">Please sign in to view your bookmarks.</p>
        </Container>
      </Layout>
    );
  }

  let bookBookmarks: BookmarkRecord[] = [];
  let chapterBookmarks: BookmarkRecord[] = [];

  try {
    const result = await getBookmarks({
      authToken: sessionToken,
      limit: 100,
    });
    bookBookmarks = result.docs.filter((bm) => bm.contentType === 'book');
    chapterBookmarks = result.docs.filter((bm) => bm.contentType === 'chapter');
  } catch {
    bookBookmarks = [];
    chapterBookmarks = [];
  }

  const visibleBookBookmarks = bookBookmarks.filter((bm) => bm.book != null);
  const visibleChapterBookmarks = chapterBookmarks.filter((bm) => bm.chapter != null);
  const hasAny = visibleBookBookmarks.length > 0 || visibleChapterBookmarks.length > 0;

  return (
    <Layout className="flex flex-col items-center" isAuthenticated>
      <Container className="my-8">
        <h1 className="text-2xl font-bold text-gray-900">Bookshelf</h1>
        {!hasAny ? (
          <p className="mt-4 text-gray-600">No bookmarks yet.</p>
        ) : (
          <div className="mt-6 space-y-8">
            {visibleBookBookmarks.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">Books</h2>
                <ul className="space-y-2">
                  {visibleBookBookmarks.map((bm) => {
                    const book = bm.book;

                    return book ? (
                      <li key={bm.id}>
                        <TextLink href={buildBookHref(book.id, book.slug)}>{book.title}</TextLink>
                      </li>
                    ) : null;
                  })}
                </ul>
              </section>
            ) : null}
            {visibleChapterBookmarks.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">Chapters</h2>
                <ul className="space-y-2">
                  {visibleChapterBookmarks.map((bm) => {
                    const chapter = bm.chapter;
                    const book = chapter?.book;

                    return chapter ? (
                      <li key={bm.id}>
                        {book ? (
                          <TextLink href={buildChapterHref(book.id, book.slug, chapter.slug)}>
                            {chapter.title} <span className="text-gray-500">in {book.title}</span>
                          </TextLink>
                        ) : (
                          <span>{chapter.title}</span>
                        )}
                      </li>
                    ) : null;
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
