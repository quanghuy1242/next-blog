import { PageSection } from '@/components/layout/page-section';
import { PageShell } from '@/components/layout/page-shell';
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
    <PageShell className="flex flex-col items-center">
      <PageSection width="content">
        <BooksShelfContent
          isAuthenticated={Boolean(sessionToken)}
          visibleBookBookmarks={shelfData.visibleBookBookmarks}
          visibleChapterBookmarks={shelfData.visibleChapterBookmarks}
        />
      </PageSection>
    </PageShell>
  );
}
