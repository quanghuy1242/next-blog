import { cache } from 'react';

import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { BookHeader } from '@/components/pages/books/book-header';
import { ChapterList } from '@/components/pages/books/chapter-list';
import { BookmarkButton } from '@/components/shared/bookmark-button';
import { Text } from '@/components/shared/text';
import { ButtonLink } from '@/components/shared/ui/button';
import { buildBookHref } from '@/lib/routes/book-route';
import { getBookPageData, getBookPageMetadataData } from '@/lib/server/books/page-data';
import { getCoverImageUrl } from '@/lib/utils/image';
import { buildMetadata } from '@/lib/utils/next-metadata';

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
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <BookHeader book={data.book} />
            </div>
            <BookmarkButton
              contentType="book"
              contentId={data.book.id}
              isAuthenticated={data.isAuthenticated}
              initialBookmark={data.initialBookmark}
            />
          </div>
          {data.isAuthenticated || data.continueReadingChapterSlug ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {data.isAuthenticated ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium tabular-nums text-gray-700">
                  Progress: {data.wholeBookProgress}%
                </span>
              ) : null}
              {data.continueReadingChapterSlug ? (
                <ButtonLink
                  href={`${buildBookHref(data.book.id, data.book.slug)}/chapters/${data.continueReadingChapterSlug}`}
                  size="lg"
                  prefetch={false}
                >
                  Continue reading
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
          <Text text="Chapters" />
          <ChapterList
            chapters={data.chapters}
            bookId={data.book.id}
            bookSlug={data.book.slug}
            readingProgressByChapterId={data.readingProgressByChapterId}
          />
        </div>
      </Container>
    </Layout>
  );
}
