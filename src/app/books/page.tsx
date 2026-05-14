import { Layout } from '@/components/core/layout';
import { BooksPageClient } from '@/components/pages/books/books-page-client';
import { getBookmarks } from '@/lib/payload/bookmarks';
import { getDataForBooksPage } from '@/lib/payload/books';
import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getChapterProgressMetadataByBookIds } from '@/lib/payload/chapters';
import { getReadingProgress } from '@/lib/payload/reading-progress';
import { calculateWholeBookProgress } from '@/lib/reading/reading-progress';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';
import { buildMetadata } from '@/lib/utils/next-metadata';
import type { Book, Chapter } from '@/types/cms';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return buildMetadata({
    title: 'Books',
    description: 'Browse the bookshelf and continue reading chapter by chapter.',
    type: 'article',
  });
}

export default async function BooksPage() {
  const sessionToken = await getAuthTokenFromAppRequest();
  const data = await getDataForBooksPage(6, {
    cache: ONE_HOUR_PAYLOAD_CACHE,
  });
  const privateState = sessionToken
    ? await getBooksPrivateState(data.books, sessionToken)
    : { bookmarkedBookIds: [], books: data.books };

  return (
    <Layout
      header={data.homepage?.header}
      className="flex flex-col items-center"
      isAuthenticated={Boolean(sessionToken)}
    >
      <BooksPageClient
        initialBooks={privateState.books}
        initialHasMore={data.hasMore}
        initialBookmarkedBookIds={privateState.bookmarkedBookIds}
        isAuthenticated={Boolean(sessionToken)}
      />
    </Layout>
  );
}

async function getBooksPrivateState(books: Book[], authToken: string) {
  const bookmarksPromise = getBookmarks({
    authToken,
    limit: 100,
  }).catch(() => ({ docs: [], totalDocs: 0 }));
  const bookIds = books.map((book) => book.id);
  const progressPromise = Promise.all([
    getChapterProgressMetadataByBookIds(bookIds, { authToken }).catch(
      (): Record<number, Array<Pick<Chapter, 'id' | 'chapterWordCount'>>> => ({})
    ),
    Promise.all(
      bookIds.map(async (bookId) => [
        bookId,
        await getReadingProgress(String(bookId), { authToken }).catch(() => []),
      ] as const)
    ),
  ]);

  const [bookmarks, [chaptersByBookId, readingProgressEntries]] =
    await Promise.all([bookmarksPromise, progressPromise]);
  const readingProgressByBookId = new Map(readingProgressEntries);
  const booksWithProgress = books.map((book) => ({
    ...book,
    readingProgressPct: calculateWholeBookProgress({
      chapters: chaptersByBookId[book.id] ?? [],
      records: readingProgressByBookId.get(book.id) ?? [],
      totalWordCount: book.totalWordCount,
    }),
  }));

  return {
    bookmarkedBookIds: bookmarks.docs
      .filter((bookmark) => bookmark.contentType === 'book' && bookmark.book != null)
      .map((bookmark) => bookmark.book!.id),
    books: booksWithProgress,
  };
}
