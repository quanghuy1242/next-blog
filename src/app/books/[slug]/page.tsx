import { cache } from 'react';

import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { BookPageClient } from '@/components/pages/books/book-page-client';
import { getBookPageData, getBookPageMetadataData } from '@/lib/server/books/page-data';
import { getCoverImageUrl } from '@/lib/shared/image';
import { buildMetadata } from '@/lib/shared/metadata';

interface BookPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

const getCachedBookPageData = cache(getBookPageData);
const getCachedBookPageMetadataData = cache(getBookPageMetadataData);

export async function generateMetadata({ params }: BookPageProps) {
  const { book } = await getCachedBookPageMetadataData((await params).slug);

  return buildMetadata({
    title: book.title,
    description: `Read ${book.title} chapter by chapter.`,
    image: book.cover ? getCoverImageUrl(book.cover) : null,
    type: 'article',
  });
}

export default async function BookPage({ params }: BookPageProps) {
  const data = await getCachedBookPageData((await params).slug);

  return (
    <Layout className="flex flex-col items-center" isDraftMode={data.isDraftMode}>
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <BookPageClient
            book={data.book}
            chapters={data.chapters}
            isAuthenticated={data.isAuthenticated}
          />
        </div>
      </Container>
    </Layout>
  );
}
