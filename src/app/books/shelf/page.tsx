import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { BooksShelfContent } from '@/components/pages/books/books-shelf-content';
import { getBooksShelfData } from '@/lib/server/books/shelf-data';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';
import { buildMetadata } from '@/lib/shared/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return buildMetadata({
    title: 'Bookshelf',
    description: 'View your saved books and chapter bookmarks.',
  });
}

export default async function BooksShelfPage() {
  const sessionToken = await getAuthTokenFromAppRequest();
  const shelfData = sessionToken
    ? await getBooksShelfData(sessionToken)
    : { visibleBookBookmarks: [], visibleChapterBookmarks: [] };

  return (
    <Layout className="flex flex-col items-center">
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <BooksShelfContent
            isAuthenticated={Boolean(sessionToken)}
            visibleBookBookmarks={shelfData.visibleBookBookmarks}
            visibleChapterBookmarks={shelfData.visibleChapterBookmarks}
          />
        </div>
      </Container>
    </Layout>
  );
}
