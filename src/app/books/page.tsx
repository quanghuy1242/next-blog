import { PageShell } from '@/components/layout/page-shell';
import { BooksPageClient } from '@/components/pages/books/books-page-client';
import { getBooksListPageData } from '@/lib/server/books/list-data';
import { buildMetadata } from '@/lib/shared/metadata';

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
    <PageShell className="flex flex-col items-center">
      <BooksPageClient
        initialBooks={data.books}
        initialHasMore={data.hasMore}
        isAuthenticated={data.isAuthenticated}
      />
    </PageShell>
  );
}
