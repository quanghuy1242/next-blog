import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { BooksGrid } from '@/components/shared/books-grid';
import { Text } from '@/components/shared/text';
import { TextLink } from '@/components/shared/ui/text-link';
import { getBookmarks } from '@/lib/payload/bookmarks';
import { buildChapterHref } from '@/lib/routes/book-route';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';
import { buildMetadata } from '@/lib/utils/next-metadata';
import type { Book, BookmarkRecord } from '@/types/cms';

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
        <Container className="my-4 w-full md:px-20">
          <div className="mx-auto w-full md:w-2/3">
            <Text text="Bookshelf" />
          <p className="mt-4 text-gray-600">Please sign in to view your bookmarks.</p>
          </div>
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
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <Text text="Bookshelf" />
        {!hasAny ? (
          <p className="mt-4 text-gray-600">No bookmarks yet.</p>
        ) : (
            <div className="mt-4 space-y-8">
            {visibleBookBookmarks.length > 0 ? (
              <section>
                <BooksGrid
                  books={visibleBookBookmarks.map((bm) => bm.book).filter(Boolean) as Book[]}
                  bookmarkedBookIds={visibleBookBookmarks
                    .map((bm) => bm.book?.id)
                    .filter((id): id is number => typeof id === 'number')}
                  isAuthenticated
                />
              </section>
            ) : null}
            {visibleChapterBookmarks.length > 0 ? (
              <section>
                <Text text="Chapters" />
                <ul className="mt-3 space-y-2">
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
        </div>
      </Container>
    </Layout>
  );
}
