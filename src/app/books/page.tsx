import { Layout } from '@/components/core/layout';
import { BooksPageClient } from '@/components/pages/books/books-page-client';
import { getBookmarks } from '@/lib/payload/bookmarks';
import { getDataForBooksPage } from '@/lib/payload/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';
import { buildMetadata } from '@/lib/utils/next-metadata';

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
  const payloadCache = sessionToken ? AUTH_PAYLOAD_CACHE : ONE_HOUR_PAYLOAD_CACHE;
  const data = await getDataForBooksPage(6, {
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

  return (
    <Layout
      header={data.homepage?.header}
      className="flex flex-col items-center"
      isAuthenticated={Boolean(sessionToken)}
    >
      <BooksPageClient
        initialBooks={data.books}
        initialHasMore={data.hasMore}
        initialBookmarkedBookIds={initialBookmarkedBookIds}
        isAuthenticated={Boolean(sessionToken)}
      />
    </Layout>
  );
}
