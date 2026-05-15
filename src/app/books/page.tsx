import { Layout } from '@/components/core/layout';
import { BooksPageClient } from '@/components/pages/books/books-page-client';
import { getBooksListPageData } from '@/lib/server/books/list-data';
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
  const data = await getBooksListPageData();

  return (
    <Layout className="flex flex-col items-center">
      <BooksPageClient
        initialBooks={data.books}
        initialHasMore={data.hasMore}
        isAuthenticated={data.isAuthenticated}
      />
    </Layout>
  );
}
